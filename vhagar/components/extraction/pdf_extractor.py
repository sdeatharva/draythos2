"""PDF document extractor.

Extracts candidate fields from PDF pages with exact page and bbox locators:
locator: {"type": "pdf", "doc_id": "...", "page": 1, "bbox": [x0, y0, x1, y1], "quote": "..."}
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, List, Optional
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import make_pdf_locator
from vhagar.components.extraction.numbers import parse_financial_number, detect_context_scale_and_unit
from vhagar.components.extraction.periods import parse_period

logger = structlog.get_logger(__name__)


class PdfExtractor(BaseExtractor):
    """Extracts candidate financial facts with bounding box locators from PDF documents."""

    def extract_fields(
        self,
        file_path: Path,
        doc_id: str,
        entity: Optional[str] = None,
        jurisdiction: str = "GLOBAL",
    ) -> List[CandidateField]:
        path = Path(file_path)
        if not path.exists():
            return []

        fields: List[CandidateField] = []

        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
        except Exception as exc:
            logger.warning("pymupdf_open_failed", path=str(path), error=str(exc))
            return self._extract_with_pypdf(path, doc_id, entity, jurisdiction)

        try:
            for page_idx, page in enumerate(doc):
                page_num = page_idx + 1
                page_text = page.get_text()
                if not page_text:
                    continue

                scale, unit = detect_context_scale_and_unit(page_text[:500])
                detected_period = parse_period(page_text[:500], jurisdiction=jurisdiction)

                # Extract line blocks with coordinates
                # blocks format: (x0, y0, x1, y1, text, block_no, block_type)
                blocks = page.get_text("blocks")
                for b in blocks:
                    block_text = b[4].strip()
                    bbox = [float(b[0]), float(b[1]), float(b[2]), float(b[3])]

                    # Check each line in block
                    lines = block_text.splitlines()
                    for line in lines:
                        line = line.strip()
                        if not line or len(line) < 4:
                            continue

                        # Pattern 1: Table-like "Label ... Value" or "Label: Value" or "Label | Value"
                        match = re.search(
                            r"^(.*?)(?:\s{2,}|\s*[:|=|\t]\s*|\s+)([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:cr|lakh|mn|m|k|%|crores)?)$",
                            line,
                            re.IGNORECASE,
                        )
                        if not match:
                            match = re.search(
                                r"\b([A-Za-z\s\(\)\/]{3,40}?)\s+(?:reached|stood at|amounted to|amount to|crossed|was|is|totalling|totaled)\s+([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:million|crore|lakh|thousand|mn|m|k|%|cr|lakhs)?)\b",
                                line,
                                re.IGNORECASE,
                            )
                        if match:
                            raw_label = match.group(1).strip()
                            raw_val = match.group(2).strip()

                            if not raw_label or raw_label.replace(".", "").isdigit() or len(raw_label) < 2:
                                continue

                            val_num, parsed_unit, parsed_scale = parse_financial_number(
                                raw_val, default_scale=scale, default_unit=unit
                            )
                            if val_num is not None or "%" in raw_val:
                                locator = make_pdf_locator(
                                    page=page_num,
                                    bbox=bbox,
                                    quote=line,
                                    doc_id=doc_id,
                                )
                                fields.append(
                                    CandidateField(
                                        doc_id=doc_id,
                                        raw_label=raw_label,
                                        value_raw=raw_val,
                                        value_num=val_num,
                                        unit=parsed_unit,
                                        scale=parsed_scale,
                                        period=detected_period,
                                        locator=locator,
                                        context_heading=f"Page {page_num}",
                                        extraction_method="native_text",
                                        extraction_confidence=0.92,
                                        entity=entity,
                                        jurisdiction=jurisdiction,
                                    )
                                )
            doc.close()
        except Exception as exc:
            logger.warning("pdf_extraction_error", path=str(path), error=str(exc))

        return fields

    def _extract_with_pypdf(
        self,
        path: Path,
        doc_id: str,
        entity: Optional[str] = None,
        jurisdiction: str = "GLOBAL",
    ) -> List[CandidateField]:
        fields: List[CandidateField] = []
        try:
            import pypdf
            reader = pypdf.PdfReader(str(path))
            for page_idx, page in enumerate(reader.pages):
                page_num = page_idx + 1
                text = page.extract_text() or ""
                lines = text.splitlines()
                scale, unit = detect_context_scale_and_unit(text[:500])
                detected_period = parse_period(text[:500], jurisdiction=jurisdiction)

                for line in lines:
                    line = line.strip()
                    match = re.search(
                        r"^(.*?)(?:\s{2,}|\s*[:|=|\t]\s*|\s+)([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:cr|lakh|mn|m|k|%|crores)?)$",
                        line,
                        re.IGNORECASE,
                    )
                    if match:
                        raw_label = match.group(1).strip()
                        raw_val = match.group(2).strip()
                        val_num, parsed_unit, parsed_scale = parse_financial_number(
                            raw_val, default_scale=scale, default_unit=unit
                        )
                        if val_num is not None:
                            locator = make_pdf_locator(
                                page=page_num,
                                bbox=[0.0, 0.0, 0.0, 0.0],
                                quote=line,
                                doc_id=doc_id,
                            )
                            fields.append(
                                CandidateField(
                                    doc_id=doc_id,
                                    raw_label=raw_label,
                                    value_raw=raw_val,
                                    value_num=val_num,
                                    unit=parsed_unit,
                                    scale=parsed_scale,
                                    period=detected_period,
                                    locator=locator,
                                    context_heading=f"Page {page_num}",
                                    extraction_method="native_text",
                                    extraction_confidence=0.85,
                                    entity=entity,
                                    jurisdiction=jurisdiction,
                                )
                            )
        except Exception as exc:
            logger.warning("pypdf_fallback_failed", error=str(exc))
        return fields

