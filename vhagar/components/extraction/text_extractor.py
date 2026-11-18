"""Plain text extractor.

Extracts candidate fields from plain text and markdown documents:
locator: {"type": "txt", "doc_id": "...", "line": 10, "char_start": 0, "char_end": 45, "quote": "..."}
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List, Optional
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import make_txt_locator
from vhagar.components.extraction.numbers import parse_financial_number, detect_context_scale_and_unit
from vhagar.components.extraction.periods import parse_period

logger = structlog.get_logger(__name__)


class TextExtractor(BaseExtractor):
    """Extracts candidate fields from TXT, Markdown, or raw text files."""

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
            content = path.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:
            logger.warning("text_read_error", path=str(path), error=str(exc))
            return []

        lines = content.splitlines()
        context_scale = 1.0
        context_unit = None
        current_heading = path.stem

        # Check early lines for context scale
        for line in lines[:10]:
            scale, unit = detect_context_scale_and_unit(line)
            if scale != 1.0 or unit:
                context_scale = scale
                if unit:
                    context_unit = unit

        detected_period = parse_period(content[:500], jurisdiction=jurisdiction)

        for l_idx, line in enumerate(lines):
            line_str = line.strip()
            if not line_str:
                continue

            # Update heading if markdown header or all caps
            if line_str.startswith("#"):
                current_heading = line_str.lstrip("#").strip()
                continue

            # Match "Label: Value" or "Label = Value" or "Label \t Value"
            match = re.search(
                r"^([A-Za-z\s\(\)\/]{3,50})\s*[:|=|\t]\s*([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:cr|lakh|mn|m|k|%|crores)?)$",
                line_str,
                re.IGNORECASE,
            )
            # Prose fallback
            if not match:
                match = re.search(
                    r"\b([A-Za-z\s\(\)\/]{3,40}?)\s+(?:reached|stood at|amounted to|amount to|crossed|was|is|totalling|totaled)\s+([\$₹€£]?\s*[\(\-]?\d[\d,]*\.?\d*\)?\s*(?:million|crore|lakh|thousand|mn|m|k|%|cr|lakhs)?)\b",
                    line_str,
                    re.IGNORECASE,
                )
            if match:
                raw_label = match.group(1).strip()
                raw_val = match.group(2).strip()
                val_num, unit, scale = parse_financial_number(
                    raw_val, default_scale=context_scale, default_unit=context_unit
                )
                if val_num is not None or "%" in raw_val:
                    locator = make_txt_locator(
                        line=l_idx + 1,
                        char_start=0,
                        char_end=len(line_str),
                        quote=line_str,
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
                            period=detected_period,
                            locator=locator,
                            context_heading=current_heading,
                            extraction_method="native_text",
                            extraction_confidence=0.90,
                            entity=entity,
                            jurisdiction=jurisdiction,
                        )
                    )

        return fields

