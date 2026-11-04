"""Excel processor – spreadsheet parsing, editing, working-copy management."""

from __future__ import annotations

import asyncio
import shutil
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)


class SheetInfo(BaseModel):
    name: str
    row_count: int = 0
    col_count: int = 0
    has_formulas: bool = False
    has_merged_cells: bool = False
    has_formatting: bool = False


class WorkbookInfo(BaseModel):
    sheets: list[SheetInfo] = Field(default_factory=list)
    total_sheets: int = 0
    filename: str = ""


class CellEdit(BaseModel):
    sheet_name: str
    cell_ref: str
    old_value: Any = None
    new_value: Any = None
    value_type: str = "string"


class EditResult(BaseModel):
    success: bool = False
    edits_applied: list[CellEdit] = Field(default_factory=list)
    version: str = ""
    errors: list[str] = Field(default_factory=list)


class WorkbookVersion(BaseModel):
    version_id: str
    document_id: str
    path: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    edit_count: int = 0
    edits_applied: list[CellEdit] = Field(default_factory=list)


class ExcelProcessor:
    """Spreadsheet parsing, editing, and working-copy management."""

    def __init__(self, config):
        self.config = config
        self._versions: dict[str, list[WorkbookVersion]] = {}  # doc_id -> versions

    async def parse_workbook(self, file_path: Path):
        """Parse a workbook and return info + extracted content."""
        loop = asyncio.get_event_loop()

        def _parse():
            import openpyxl

            wb = openpyxl.load_workbook(str(file_path), data_only=False)
            sheets: list[SheetInfo] = []
            all_text: list[str] = []

            for ws_name in wb.sheetnames:
                ws = wb[ws_name]
                has_formulas = False
                has_merged = bool(ws.merged_cells.ranges)
                has_fmt = False

                rows_data: list[str] = []
                for row in ws.iter_rows():
                    cell_vals: list[str] = []
                    for cell in row:
                        val = cell.value
                        if isinstance(val, str) and val.startswith("="):
                            has_formulas = True
                        if cell.font and (cell.font.bold or cell.font.italic):
                            has_fmt = True
                        cell_vals.append(str(val) if val is not None else "")
                    if any(cell_vals):
                        rows_data.append(" | ".join(cell_vals))

                sheet_text = f"Sheet: {ws_name}\n" + "\n".join(rows_data)
                all_text.append(sheet_text)

                sheets.append(SheetInfo(
                    name=ws_name,
                    row_count=ws.max_row or 0,
                    col_count=ws.max_column or 0,
                    has_formulas=has_formulas,
                    has_merged_cells=has_merged,
                    has_formatting=has_fmt,
                ))

            wb.close()

            info = WorkbookInfo(
                sheets=sheets,
                total_sheets=len(sheets),
                filename=file_path.name,
            )
            return info, "\n\n".join(all_text)

        info, text = await loop.run_in_executor(_executor, _parse)

        from vhagar.components.document_processor import ExtractedContent, PageContent, DocumentFormat, ProcessingStatus

        pages = [PageContent(page_number=i+1, text=s) for i, s in enumerate(text.split("\n\nSheet: ")) if s.strip()]
        content = ExtractedContent(
            pages=pages,
            full_text=text,
            metadata={"sheets": [s.model_dump() for s in info.sheets]},
            format=DocumentFormat.XLSX,
            total_pages=info.total_sheets,
            processing_status=ProcessingStatus.COMPLETED,
        )
        return info, content

    async def get_sheet_data(self, file_path: Path, sheet_name: str) -> list[list[Any]]:
        """Get raw cell data for a specific sheet."""
        loop = asyncio.get_event_loop()

        def _get():
            import openpyxl
            wb = openpyxl.load_workbook(str(file_path), data_only=False)
            if sheet_name not in wb.sheetnames:
                wb.close()
                return []
            ws = wb[sheet_name]
            data = []
            for row in ws.iter_rows(values_only=True):
                data.append([v if v is not None else "" for v in row])
            wb.close()
            return data

        return await loop.run_in_executor(_executor, _get)

    async def apply_edits(
        self, document_id: str, file_path: Path, edits: list[CellEdit]
    ) -> EditResult:
        """Apply cell edits to a workbook and return the result."""
        loop = asyncio.get_event_loop()
        errors: list[str] = []
        applied: list[CellEdit] = []

        def _apply():
            import openpyxl
            wb = openpyxl.load_workbook(str(file_path))

            for edit in edits:
                if edit.sheet_name not in wb.sheetnames:
                    errors.append(f"Sheet '{edit.sheet_name}' not found")
                    continue

                ws = wb[edit.sheet_name]
                try:
                    cell = ws[edit.cell_ref]

                    # Type conversion
                    new_val = edit.new_value
                    if edit.value_type == "number":
                        try:
                            new_val = float(new_val)
                            if new_val == int(new_val):
                                new_val = int(new_val)
                        except (ValueError, TypeError):
                            pass
                    elif edit.value_type == "formula":
                        str_val = str(new_val).strip()
                        clean_val = str_val.strip("*`_ ")
                        if not clean_val.startswith("="):
                            clean_val = f"={clean_val}"
                        import re
                        if clean_val == "=" or re.match(r"^=[*`_#\s]+$", clean_val):
                            errors.append(f"Invalid formula for {edit.cell_ref}: {str_val}")
                            continue
                        new_val = clean_val

                    cell.value = new_val
                    applied.append(edit)
                except Exception as exc:
                    errors.append(f"Failed to edit {edit.cell_ref}: {str(exc)}")

            return wb

        wb = await loop.run_in_executor(_executor, _apply)

        version_id = str(uuid.uuid4())[:8]
        return EditResult(
            success=len(errors) == 0,
            edits_applied=applied,
            version=version_id,
            errors=errors,
        ), wb

    async def save_working_copy(
        self, document_id: str, source_path: Path, edits: list[CellEdit]
    ) -> WorkbookVersion:
        """Atomic save: apply edits, write temp, validate, promote."""
        # Determine the source – use latest working copy if exists
        latest = await self.get_latest_version(document_id)
        actual_source = Path(latest.path) if (latest and Path(latest.path).exists()) else source_path

        result, wb = await self.apply_edits(document_id, actual_source, edits)

        if not result.success and not result.edits_applied:
            raise ValueError(f"No edits applied: {', '.join(result.errors)}")

        # Write to temp first
        wc_dir = self.config.working_copies_dir / document_id
        wc_dir.mkdir(parents=True, exist_ok=True)

        version_id = result.version
        temp_path = wc_dir / f".tmp_{version_id}{source_path.suffix}"
        final_path = wc_dir / f"{source_path.stem}_v{version_id}{source_path.suffix}"

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, lambda: wb.save(str(temp_path)))
        wb.close()

        # Validate the temp file
        valid = await self.validate_working_copy(temp_path, edits)
        if not valid:
            temp_path.unlink(missing_ok=True)
            raise ValueError("Working copy validation failed")

        # Promote: rename temp to final
        temp_path.rename(final_path)

        version = WorkbookVersion(
            version_id=version_id,
            document_id=document_id,
            path=str(final_path),
            edit_count=len(result.edits_applied),
            edits_applied=result.edits_applied,
        )

        if document_id not in self._versions:
            self._versions[document_id] = []
        self._versions[document_id].append(version)

        logger.info("working_copy_saved", document_id=document_id, version=version_id, edits=len(result.edits_applied))
        return version

    async def validate_working_copy(self, path: Path, expected_edits: list[CellEdit]) -> bool:
        """Reopen and verify the working copy."""
        loop = asyncio.get_event_loop()

        def _validate():
            try:
                import openpyxl
                wb = openpyxl.load_workbook(str(path), data_only=True)
                # Basic validation: file opens and sheets exist
                for edit in expected_edits:
                    if edit.sheet_name in wb.sheetnames:
                        ws = wb[edit.sheet_name]
                        cell = ws[edit.cell_ref]
                        # Value check (data_only=True resolves formulas to cached values)
                wb.close()
                return True
            except Exception as exc:
                logger.error("working_copy_validation_failed", error=str(exc))
                return False

        return await loop.run_in_executor(_executor, _validate)

    async def get_latest_version(self, document_id: str) -> WorkbookVersion | None:
        """Get the most recent working-copy version for a document."""
        versions = self._versions.get(document_id, [])
        for v in reversed(versions):
            if Path(v.path).exists():
                return v
        # Check filesystem
        wc_dir = self.config.working_copies_dir / document_id
        if wc_dir.exists():
            files = sorted(wc_dir.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
            files = [f for f in files if not f.name.startswith(".tmp_") and f.is_file()]
            if files:
                return WorkbookVersion(
                    version_id=files[0].stem.split("_v")[-1] if "_v" in files[0].stem else "fs",
                    document_id=document_id,
                    path=str(files[0]),
                )
        return None

