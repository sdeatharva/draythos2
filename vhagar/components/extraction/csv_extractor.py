"""CSV document extractor.

Extracts candidate fields with row, col locators:
locator: {"type": "csv", "doc_id": "...", "row": 5, "col": 2, "quote": "..."}
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Any, List, Optional
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import make_csv_locator
from vhagar.components.extraction.numbers import parse_financial_number, detect_context_scale_and_unit
from vhagar.components.extraction.periods import parse_period

logger = structlog.get_logger(__name__)


class CsvExtractor(BaseExtractor):
    """Extracts candidate fields from CSV tables."""

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
            with open(path, mode="r", encoding="utf-8-sig", errors="replace") as f:
                reader = csv.reader(f)
                rows = list(reader)
        except Exception as exc:
            logger.warning("csv_read_error", path=str(path), error=str(exc))
            return []

        if not rows:
            return []

        # Context detection
        context_scale = 1.0
        context_unit = None
        context_title = path.stem

        for r in rows[:5]:
            for cell in r:
                scale, unit = detect_context_scale_and_unit(cell)
                if scale != 1.0 or unit:
                    context_scale = scale
                    if unit:
                        context_unit = unit

        # Detect period columns
        period_cols: dict[int, dict[str, Any]] = {}
        for r in rows[:5]:
            for c_idx, cell in enumerate(r):
                if c_idx > 0 and cell:
                    p = parse_period(cell, jurisdiction=jurisdiction)
                    if p["type"] != "unspecified":
                        period_cols[c_idx] = p

        for r_idx, r in enumerate(rows):
            if not r or len(r) < 2:
                continue

            label_val = r[0].strip()
            col_offset = 0
            if not label_val and len(r) > 1 and r[1].strip():
                label_val = r[1].strip()
                col_offset = 1

            if not label_val or label_val.replace(".", "").isdigit() or len(label_val) < 2:
                continue

            for c_idx in range(col_offset + 1, len(r)):
                raw_val = r[c_idx].strip()
                if not raw_val:
                    continue

                val_num, unit, scale = parse_financial_number(
                    raw_val, default_scale=context_scale, default_unit=context_unit
                )
                if val_num is not None or "%" in raw_val:
                    period = period_cols.get(
                        c_idx,
                        {"label": "Current Period", "start": None, "end": None, "type": "unspecified"},
                    )
                    locator = make_csv_locator(
                        row=r_idx + 1,
                        col=c_idx + 1,
                        quote=f"{label_val} | {raw_val}",
                        doc_id=doc_id,
                    )
                    fields.append(
                        CandidateField(
                            doc_id=doc_id,
                            raw_label=label_val,
                            value_raw=raw_val,
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

        return fields

