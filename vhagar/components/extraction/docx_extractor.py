"""DOCX document extractor.

Extracts candidate fields from Word tables and paragraphs with exact locators:
locator: {"type": "docx", "doc_id": "...", "table_index": 0, "row": 2, "col": 1, "quote": "..."}
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, List, Optional
import docx
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import make_docx_locator
from vhagar.components.extraction.numbers import parse_financial_number, detect_context_scale_and_unit
from vhagar.components.extraction.periods import parse_period

logger = structlog.get_logger(__name__)


class DocxExtractor(BaseExtractor):
    """Extracts candidate fields from DOCX tables and paragraphs."""

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
            doc = docx.Document(str(path))
        except Exception as exc:
            logger.warning("docx_load_error", path=str(path), error=str(exc))
            return []

        # 1. Process all tables
        for t_idx, table in enumerate(doc.tables):
            rows_data = []
            for row in table.rows:
                rows_data.append([cell.text.strip() for cell in row.cells])

            if not rows_data:
                continue

            # Detect scale and period headers in table
            context_scale = 1.0
            context_unit = None
            period_cols: dict[int, dict[str, Any]] = {}

            for r in rows_data[:3]:
                for c_idx, cell_text in enumerate(r):
                    scale, unit = detect_context_scale_and_unit(cell_text)
                    if scale != 1.0 or unit:
                        context_scale = scale
                        if unit:
                            context_unit = unit
                    if c_idx > 0:
                        p = parse_period(cell_text, jurisdiction=jurisdiction)
                        if p["type"] != "unspecified":
                            period_cols[c_idx] = p

            for r_idx, row in enumerate(rows_data):
                if len(row) < 2:
                    continue
                label_val = row[0]
                col_offset = 0
                if not label_val and len(row) > 1:
                    label_val = row[1]
                    col_offset = 1

                if not label_val or label_val.replace(".", "").isdigit() or len(label_val) < 2:
                    continue

                for c_idx in range(col_offset + 1, len(row)):
                    raw_val = row[c_idx]
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
                        locator = make_docx_locator(
                            table_index=t_idx,
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
                                context_heading=f"Table {t_idx + 1}",
                                extraction_method="native_table",
                                extraction_confidence=0.95,
                                entity=entity,
                                jurisdiction=jurisdiction,
                            )
                        )

        # 2. Process paragraphs for inline Key: Value or prose statements
        for p_idx, para in enumerate(doc.paragraphs):
            text = para.text.strip()
            if not text or len(text) < 4:
                continue

            match = re.search(
                r"^([A-Za-z\s\(\)\/]{3,50})\s*[:|=]\s*([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:cr|lakh|mn|m|k|%|crores)?)$",
                text,
                re.IGNORECASE,
            )
            # Prose fallback: "Revenue reached $1,250 million"
            if not match:
                match = re.search(
                    r"\b([A-Za-z\s\(\)\/]{3,40}?)\s+(?:reached|stood at|amounted to|amount to|crossed|was|is|totalling|totaled)\s+([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:million|crore|lakh|thousand|mn|m|k|%|cr|lakhs)?)\b",
                    text,
                    re.IGNORECASE,
                )

            if match:
                raw_label = match.group(1).strip()
                raw_val = match.group(2).strip()
                val_num, unit, scale = parse_financial_number(raw_val)
                if val_num is not None:
                    locator = make_docx_locator(
                        para_index=p_idx,
                        quote=text,
                        doc_id=doc_id,
                    )
                    fields.append(
                        CandidateField(
                            doc_id=doc_id,
                            raw_label=raw_label,
                            value_raw=raw_val,
                            value_num=val_num,
                            unit=unit,
                            scale=scale,
                            period={"label": "Current", "start": None, "end": None, "type": "unspecified"},
                            locator=locator,
                            context_heading=f"Paragraph {p_idx}",
                            extraction_method="native_text",
                            extraction_confidence=0.88,
                            entity=entity,
                            jurisdiction=jurisdiction,
                        )
                    )

        return fields

