"""Document processor – format detection, extraction, OCR fallback."""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)


class DocumentFormat(str, Enum):
    PDF = "pdf"
    XLSX = "xlsx"
    XLS = "xls"
    CSV = "csv"
    DOCX = "docx"
    TXT = "txt"
    JSON = "json"
    XML = "xml"
    IMAGE = "image"
    UNKNOWN = "unknown"


class ProcessingStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    PARTIALLY_COMPLETED = "partially_completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PageContent(BaseModel):
    page_number: int
    text: str = ""
    confidence: float = 1.0
    has_text_layer: bool = True
    ocr_applied: bool = False


class ExtractedContent(BaseModel):
    pages: list[PageContent] = Field(default_factory=list)
    full_text: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)
    terms: list[str] = Field(default_factory=list)
    format: DocumentFormat = DocumentFormat.UNKNOWN
    total_pages: int = 0
    processing_status: ProcessingStatus = ProcessingStatus.COMPLETED


class DocumentReference(BaseModel):
    document_id: str
    session_id: str
    user_id: Optional[str] = "usr_default"
    media_type: str = "application/octet-stream"
    source_filename: str
    original_path: str
    working_copy_path: Optional[str] = None
    processing_status: ProcessingStatus = ProcessingStatus.QUEUED
    format: DocumentFormat = DocumentFormat.UNKNOWN
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    file_hash: str = ""


class ProcessingJob(BaseModel):
    job_id: str
    document_id: str
    status: ProcessingStatus = ProcessingStatus.QUEUED
    progress: float = 0.0
    pages_completed: int = 0
    pages_total: int = 0
    error_message: Optional[str] = None
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


EXTENSION_MAP: dict[str, DocumentFormat] = {
    ".pdf": DocumentFormat.PDF,
    ".xlsx": DocumentFormat.XLSX,
    ".xls": DocumentFormat.XLS,
    ".csv": DocumentFormat.CSV,
    ".docx": DocumentFormat.DOCX,
    ".txt": DocumentFormat.TXT,
    ".json": DocumentFormat.JSON,
    ".xml": DocumentFormat.XML,
    ".png": DocumentFormat.IMAGE,
    ".jpg": DocumentFormat.IMAGE,
    ".jpeg": DocumentFormat.IMAGE,
    ".tiff": DocumentFormat.IMAGE,
    ".bmp": DocumentFormat.IMAGE,
}

MIME_MAP: dict[DocumentFormat, str] = {
    DocumentFormat.PDF: "application/pdf",
    DocumentFormat.XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    DocumentFormat.XLS: "application/vnd.ms-excel",
    DocumentFormat.CSV: "text/csv",
    DocumentFormat.DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    DocumentFormat.TXT: "text/plain",
    DocumentFormat.JSON: "application/json",
    DocumentFormat.XML: "application/xml",
}


class DocumentProcessor:
    """Detects formats, extracts content, orchestrates OCR fallback."""

    def __init__(self, config):
        self.config = config
        self.documents_dir: Path = config.documents_dir
        self.working_copies_dir: Path = config.working_copies_dir
        self._jobs: dict[str, ProcessingJob] = {}
        self._ocr_cache: dict[str, list[PageContent]] = {}

    async def detect_format(self, file_path: Path) -> DocumentFormat:
        """Detect document format by extension and magic bytes."""
        ext = file_path.suffix.lower()
        fmt = EXTENSION_MAP.get(ext, DocumentFormat.UNKNOWN)

        if fmt == DocumentFormat.UNKNOWN:
            # Try magic bytes
            try:
                data = await asyncio.get_event_loop().run_in_executor(
                    _executor, lambda: file_path.read_bytes()[:16]
                )
                if data[:4] == b"%PDF":
                    fmt = DocumentFormat.PDF
                elif data[:2] == b"PK":
                    if ext in (".xlsx", ".xls"):
                        fmt = DocumentFormat.XLSX
                    elif ext == ".docx":
                        fmt = DocumentFormat.DOCX
                    else:
                        fmt = DocumentFormat.XLSX  # Default ZIP-based to xlsx
            except Exception:
                pass

        return fmt

    async def process_document(
        self, file_path: Path, session_id: str, document_id: str | None = None
    ) -> DocumentReference:
        """Main entry point: detect format, extract, and return a document reference."""
        doc_id = document_id or str(uuid.uuid4())
        job_id = str(uuid.uuid4())

        job = ProcessingJob(job_id=job_id, document_id=doc_id, status=ProcessingStatus.PROCESSING)
        self._jobs[job_id] = job

        fmt = await self.detect_format(file_path)
        file_hash = await self._compute_file_hash(file_path)

        doc_ref = DocumentReference(
            document_id=doc_id,
            session_id=session_id,
            media_type=MIME_MAP.get(fmt, "application/octet-stream"),
            source_filename=file_path.name,
            original_path=str(file_path),
            format=fmt,
            file_hash=file_hash,
            processing_status=ProcessingStatus.PROCESSING,
        )

        try:
            content = await self.extract_content(file_path, fmt)
            doc_ref.processing_status = content.processing_status
            job.status = content.processing_status
            job.progress = 1.0
            job.completed_at = datetime.now(timezone.utc)
            logger.info(
                "document_processed",
                document_id=doc_id,
                format=fmt.value,
                pages=content.total_pages,
                text_length=len(content.full_text),
            )
        except Exception as exc:
            doc_ref.processing_status = ProcessingStatus.FAILED
            job.status = ProcessingStatus.FAILED
            job.error_message = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            logger.error("document_processing_failed", document_id=doc_id, error=str(exc))

        doc_ref.updated_at = datetime.now(timezone.utc)
        return doc_ref

    async def extract_content(self, file_path: Path, format: DocumentFormat) -> ExtractedContent:
        """Dispatch to format-specific extractor."""
        extractors = {
            DocumentFormat.PDF: self._extract_pdf,
            DocumentFormat.XLSX: lambda p: self._extract_spreadsheet(p, DocumentFormat.XLSX),
            DocumentFormat.XLS: lambda p: self._extract_spreadsheet(p, DocumentFormat.XLS),
            DocumentFormat.CSV: self._extract_csv,
            DocumentFormat.DOCX: self._extract_docx,
            DocumentFormat.TXT: self._extract_text,
            DocumentFormat.JSON: self._extract_json,
            DocumentFormat.XML: self._extract_xml,
        }

        extractor = extractors.get(format)
        if not extractor:
            return ExtractedContent(
                format=format,
                processing_status=ProcessingStatus.FAILED,
                metadata={"error": f"Unsupported format: {format.value}"},
            )

        return await extractor(file_path)

    async def _extract_pdf(self, file_path: Path) -> ExtractedContent:
        """Extract text from PDF using pypdf + pdfplumber, with OCR fallback."""
        loop = asyncio.get_event_loop()

        def _do_extract():
            import pypdf
            import pdfplumber

            pages: list[PageContent] = []
            pages_needing_ocr: list[int] = []

            # Try pypdf first for text layer
            try:
                reader = pypdf.PdfReader(str(file_path))
                total = len(reader.pages)

                for i, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    confidence = 1.0 if len(text.strip()) > 20 else 0.3
                    has_text = len(text.strip()) > 10

                    if not has_text:
                        pages_needing_ocr.append(i)

                    pages.append(PageContent(
                        page_number=i + 1,
                        text=text,
                        confidence=confidence,
                        has_text_layer=has_text,
                    ))
            except Exception as exc:
                logger.warning("pypdf_failed", error=str(exc), path=str(file_path))
                total = 0

            # Enhance with pdfplumber for tables/better extraction
            try:
                with pdfplumber.open(str(file_path)) as pdf:
                    if total == 0:
                        total = len(pdf.pages)
                    for i, ppage in enumerate(pdf.pages):
                        plumber_text = ppage.extract_text() or ""
                        if i < len(pages):
                            if len(plumber_text) > len(pages[i].text):
                                pages[i].text = plumber_text
                                pages[i].confidence = min(1.0, pages[i].confidence + 0.2)
                                if len(plumber_text.strip()) > 10:
                                    pages[i].has_text_layer = True
                                    if i in pages_needing_ocr:
                                        pages_needing_ocr.remove(i)
                        else:
                            pages.append(PageContent(
                                page_number=i + 1,
                                text=plumber_text,
                                confidence=0.8 if plumber_text else 0.1,
                                has_text_layer=bool(plumber_text.strip()),
                            ))
            except Exception as exc:
                logger.warning("pdfplumber_failed", error=str(exc))

            return pages, pages_needing_ocr, total

        pages, pages_needing_ocr, total_pages = await loop.run_in_executor(_executor, _do_extract)

        # OCR fallback for pages with no text
        if pages_needing_ocr:
            file_hash = await self._compute_file_hash(file_path)
            cache_key = f"{file_hash}_{','.join(str(p) for p in pages_needing_ocr)}"

            if cache_key in self._ocr_cache:
                ocr_pages = self._ocr_cache[cache_key]
                for op in ocr_pages:
                    idx = op.page_number - 1
                    if idx < len(pages):
                        pages[idx] = op
            else:
                try:
                    ocr_results = await self._extract_pdf_with_ocr(file_path, pages_needing_ocr)
                    self._ocr_cache[cache_key] = ocr_results
                    for op in ocr_results:
                        idx = op.page_number - 1
                        if idx < len(pages):
                            pages[idx] = op
                except Exception as exc:
                    logger.warning("ocr_fallback_failed", error=str(exc))

        full_text = "\n\n".join(p.text for p in pages if p.text)
        terms = self._extract_terms(full_text)

        status = ProcessingStatus.COMPLETED
        if not pages and not full_text:
            status = ProcessingStatus.FAILED
        elif pages_needing_ocr and any(not p.text for p in pages):
            status = ProcessingStatus.PARTIALLY_COMPLETED

        return ExtractedContent(
            pages=pages,
            full_text=full_text,
            metadata={"source": str(file_path), "extractor": "pypdf+pdfplumber"},
            terms=terms,
            format=DocumentFormat.PDF,
            total_pages=total_pages or len(pages),
            processing_status=status,
        )

    async def _extract_pdf_with_ocr(
        self, file_path: Path, pages_needing_ocr: list[int]
    ) -> list[PageContent]:
        """Run OCR on specific pages that lack text."""
        loop = asyncio.get_event_loop()

        def _do_ocr():
            results: list[PageContent] = []
            try:
                from rapidocr_onnxruntime import RapidOCR

                ocr_engine = RapidOCR()

                import pdfplumber

                with pdfplumber.open(str(file_path)) as pdf:
                    for page_idx in pages_needing_ocr:
                        if page_idx >= len(pdf.pages):
                            continue
                        page = pdf.pages[page_idx]
                        img = page.to_image(resolution=200)

                        # Save temp image for OCR
                        import tempfile
                        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                            img.save(tmp.name)
                            result, _ = ocr_engine(tmp.name)

                        text_parts = []
                        if result:
                            for line in result:
                                if len(line) >= 2:
                                    text_parts.append(str(line[1]))

                        ocr_text = "\n".join(text_parts)
                        results.append(PageContent(
                            page_number=page_idx + 1,
                            text=ocr_text,
                            confidence=0.7 if ocr_text else 0.1,
                            has_text_layer=False,
                            ocr_applied=True,
                        ))
            except ImportError:
                logger.warning("rapidocr_not_available")
            except Exception as exc:
                logger.error("ocr_error", error=str(exc))

            return results

        return await loop.run_in_executor(_executor, _do_ocr)

    async def _extract_docx(self, file_path: Path) -> ExtractedContent:
        """Extract content from DOCX using python-docx."""
        loop = asyncio.get_event_loop()

        def _do_extract():
            from docx import Document

            doc = Document(str(file_path))
            pages: list[PageContent] = []
            sections: list[str] = []
            current_text: list[str] = []
            page_num = 1

            for para in doc.paragraphs:
                text = para.text.strip()
                if not text:
                    continue
                current_text.append(text)
                if para.style and para.style.name and "Heading" in para.style.name:
                    sections.append(text)

            # Extract tables
            table_texts: list[str] = []
            for table in doc.tables:
                rows = []
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    rows.append(" | ".join(cells))
                table_texts.append("\n".join(rows))

            full_text = "\n".join(current_text)
            if table_texts:
                full_text += "\n\nTables:\n" + "\n\n".join(table_texts)

            # Approximate pages (1 page ≈ 3000 chars)
            chunk_size = 3000
            for i in range(0, max(len(full_text), 1), chunk_size):
                chunk = full_text[i : i + chunk_size]
                pages.append(PageContent(page_number=page_num, text=chunk, confidence=0.95))
                page_num += 1

            return pages, full_text, sections

        pages, full_text, sections = await loop.run_in_executor(_executor, _do_extract)
        terms = self._extract_terms(full_text)

        return ExtractedContent(
            pages=pages,
            full_text=full_text,
            metadata={"sections": sections, "extractor": "python-docx"},
            terms=terms,
            format=DocumentFormat.DOCX,
            total_pages=len(pages),
            processing_status=ProcessingStatus.COMPLETED,
        )

    async def _extract_spreadsheet(self, file_path: Path, format: DocumentFormat) -> ExtractedContent:
        """Delegate spreadsheet extraction to ExcelProcessor or basic openpyxl."""
        loop = asyncio.get_event_loop()

        def _do_extract():
            import openpyxl

            wb = openpyxl.load_workbook(str(file_path), data_only=True)
            pages: list[PageContent] = []
            all_text: list[str] = []

            for sheet_name in wb.sheetnames:
                ws = wb[sheet_name]
                rows: list[str] = []
                for row in ws.iter_rows(values_only=True):
                    cell_values = [str(c) if c is not None else "" for c in row]
                    if any(cell_values):
                        rows.append(" | ".join(cell_values))

                sheet_text = f"Sheet: {sheet_name}\n" + "\n".join(rows)
                all_text.append(sheet_text)
                pages.append(PageContent(
                    page_number=len(pages) + 1,
                    text=sheet_text,
                    confidence=0.95,
                ))

            wb.close()
            return pages, "\n\n".join(all_text)

        pages, full_text = await loop.run_in_executor(_executor, _do_extract)
        terms = self._extract_terms(full_text)

        return ExtractedContent(
            pages=pages,
            full_text=full_text,
            metadata={"extractor": "openpyxl"},
            terms=terms,
            format=format,
            total_pages=len(pages),
            processing_status=ProcessingStatus.COMPLETED,
        )

    async def _extract_csv(self, file_path: Path) -> ExtractedContent:
        """Extract CSV content."""
        loop = asyncio.get_event_loop()

        def _do_extract():
            import csv

            rows: list[str] = []
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f)
                for row in reader:
                    rows.append(" | ".join(row))
            return "\n".join(rows)

        full_text = await loop.run_in_executor(_executor, _do_extract)
        terms = self._extract_terms(full_text)

        return ExtractedContent(
            pages=[PageContent(page_number=1, text=full_text, confidence=1.0)],
            full_text=full_text,
            metadata={"extractor": "csv"},
            terms=terms,
            format=DocumentFormat.CSV,
            total_pages=1,
            processing_status=ProcessingStatus.COMPLETED,
        )

    async def _extract_text(self, file_path: Path) -> ExtractedContent:
        """Extract plain text."""
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(
            _executor, lambda: file_path.read_text(encoding="utf-8", errors="replace")
        )
        terms = self._extract_terms(text)
        return ExtractedContent(
            pages=[PageContent(page_number=1, text=text, confidence=1.0)],
            full_text=text,
            metadata={"extractor": "text"},
            terms=terms,
            format=DocumentFormat.TXT,
            total_pages=1,
            processing_status=ProcessingStatus.COMPLETED,
        )

    async def _extract_json(self, file_path: Path) -> ExtractedContent:
        """Extract JSON content."""
        loop = asyncio.get_event_loop()

        def _do():
            raw = file_path.read_text(encoding="utf-8", errors="replace")
            try:
                parsed = json.loads(raw)
                formatted = json.dumps(parsed, indent=2, default=str)
            except json.JSONDecodeError:
                formatted = raw
            return formatted

        text = await loop.run_in_executor(_executor, _do)
        terms = self._extract_terms(text)
        return ExtractedContent(
            pages=[PageContent(page_number=1, text=text, confidence=1.0)],
            full_text=text,
            metadata={"extractor": "json"},
            terms=terms,
            format=DocumentFormat.JSON,
            total_pages=1,
            processing_status=ProcessingStatus.COMPLETED,
        )

    async def _extract_xml(self, file_path: Path) -> ExtractedContent:
        """Extract XML content."""
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(
            _executor, lambda: file_path.read_text(encoding="utf-8", errors="replace")
        )
        # Strip tags for term extraction
        plain = re.sub(r"<[^>]+>", " ", text)
        terms = self._extract_terms(plain)
        return ExtractedContent(
            pages=[PageContent(page_number=1, text=text, confidence=1.0)],
            full_text=text,
            metadata={"extractor": "xml"},
            terms=terms,
            format=DocumentFormat.XML,
            total_pages=1,
            processing_status=ProcessingStatus.COMPLETED,
        )

    async def _compute_file_hash(self, file_path: Path) -> str:
        """SHA-256 hash of a file."""
        loop = asyncio.get_event_loop()

        def _hash():
            h = hashlib.sha256()
            with open(file_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    h.update(chunk)
            return h.hexdigest()

        return await loop.run_in_executor(_executor, _hash)

    def _extract_terms(self, text: str, max_terms: int = 200) -> list[str]:
        """Simple term extraction from text."""
        if not text:
            return []
        # Remove common stop words and extract meaningful terms
        stop = {"the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
                "have", "has", "had", "do", "does", "did", "will", "would", "shall",
                "should", "may", "might", "must", "can", "could", "and", "but", "or",
                "nor", "not", "so", "yet", "both", "either", "neither", "each", "every",
                "all", "any", "few", "more", "most", "other", "some", "such", "no",
                "only", "own", "same", "than", "too", "very", "just", "because",
                "as", "until", "while", "of", "at", "by", "for", "with", "about",
                "against", "between", "through", "during", "before", "after", "above",
                "below", "to", "from", "up", "down", "in", "out", "on", "off", "over",
                "under", "again", "further", "then", "once", "here", "there", "when",
                "where", "why", "how", "this", "that", "these", "those", "it", "its"}

        words = re.findall(r"\b[a-zA-Z][a-zA-Z0-9_-]{2,}\b", text.lower())
        terms = list(dict.fromkeys(w for w in words if w not in stop))
        return terms[:max_terms]

    async def get_processing_status(self, job_id: str) -> ProcessingJob | None:
        return self._jobs.get(job_id)

    async def cancel_processing(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job and job.status == ProcessingStatus.PROCESSING:
            job.status = ProcessingStatus.CANCELLED
            job.completed_at = datetime.now(timezone.utc)
            return True
        return False

