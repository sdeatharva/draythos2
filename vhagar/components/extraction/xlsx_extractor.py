"""Native Excel extractor for XLSX/XLS workbooks.

Extracts candidate fields, values, period columns, and precise cell locators:
locator: {"type": "xlsx", "doc_id": "...", "sheet": "P&L", "cell": "C7", "quote": "..."}
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, List, Optional
import openpyxl
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import make_xlsx_locator
from vhagar.components.extraction.numbers import parse_financial_number, detect_context_scale_and_unit
from vhagar.components.extraction.periods import parse_period

logger = structlog.get_logger(__name__)


class XlsxExtractor(BaseExtractor):
    """Extracts candidate financial facts with cell locators from Excel workbooks."""

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
            wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
        except Exception as exc:
            logger.warning("xlsx_load_error", path=str(path), error=str(exc))
            return []

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            sheet_rows = list(ws.iter_rows(values_only=False))
            if not sheet_rows:
                continue

            # Context detection: title and scale from first 5 rows
            context_scale = 1.0
            context_unit = None
            context_title = sheet_name

            for r in sheet_rows[:6]:
                for cell in r:
                    val = str(cell.value or "").strip()
                    if val and len(val) > 3:
                        scale, unit = detect_context_scale_and_unit(val)
                        if scale != 1.0 or unit:
                            context_scale = scale
                            if unit:
                                context_unit = unit
                        if "statement" in val.lower() or "balance sheet" in val.lower() or "profit" in val.lower():
                            context_title = val

            # Detect period headers in the first 8 rows
            period_cols: dict[int, dict[str, Any]] = {}
            for r_idx, r in enumerate(sheet_rows[:8]):
                for c_idx, cell in enumerate(r):
                    val = str(cell.value or "").strip()
                    if not val:
                        continue
                    p = parse_period(val, jurisdiction=jurisdiction)
                    if p["type"] != "unspecified" and c_idx > 0:
                        period_cols[c_idx] = p

            # Iterate through data rows
            for r_idx, r in enumerate(sheet_rows):
                if not r or len(r) < 2:
                    continue

                label_cell = r[0]
                label_val = str(label_cell.value or "").strip()

                # If first cell is empty, check second cell for indented label
                col_offset = 0
                if not label_val and len(r) > 1 and r[1].value:
                    label_cell = r[1]
                    label_val = str(label_cell.value or "").strip()
                    col_offset = 1

                # Filter out pure numbers or empty labels
                if not label_val or label_val.replace(".", "").isdigit() or len(label_val) < 2:
                    continue

                # Check cells in this row for values
                for c_idx in range(col_offset + 1, len(r)):
                    cell = r[c_idx]
                    if cell.value is None:
                        continue

                    raw_val_str = str(cell.value).strip()
                    if not raw_val_str:
                        continue

                    val_num, unit, scale = parse_financial_number(
                        raw_val_str,
                        default_scale=context_scale,
                        default_unit=context_unit,
                    )

                    # Only record if it contains numeric or financial content
                    if val_num is not None or "%" in raw_val_str or any(c in raw_val_str for c in ("$", "₹", "€", "£")):
                        period = period_cols.get(c_idx, {"label": "Current Period", "start": None, "end": None, "type": "unspecified"})
                        locator = make_xlsx_locator(
                            sheet=sheet_name,
                            cell=cell.coordinate,
                            quote=f"{label_val} | {raw_val_str}",
                            doc_id=doc_id,
                        )

                        fields.append(
                            CandidateField(
                                doc_id=doc_id,
                                raw_label=label_val,
                                value_raw=raw_val_str,
                                value_num=val_num,
                                unit=unit,
                                scale=scale,
                                period=period,
                                locator=locator,
                                context_heading=context_title,
                                extraction_method="native_table",
                                extraction_confidence=0.98,
                                entity=entity,
                                jurisdiction=jurisdiction,
                            )
                        )

        wb.close()
        return fields

