"""JSON and XML document extractor.

Extracts candidate fields with json_path and xpath locators:
locator: {"type": "json", "doc_id": "...", "json_path": "$.financials.revenue", "quote": "..."}
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Optional
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import make_json_locator, make_xml_locator
from vhagar.components.extraction.numbers import parse_financial_number

logger = structlog.get_logger(__name__)


class JsonXmlExtractor(BaseExtractor):
    """Extracts candidate fields from JSON files and XML/XBRL representations."""

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

        ext = path.suffix.lower()
        if ext == ".json":
            return self._extract_json(path, doc_id, entity, jurisdiction)
        elif ext == ".xml":
            return self._extract_xml(path, doc_id, entity, jurisdiction)
        return []

    def _extract_json(
        self, path: Path, doc_id: str, entity: Optional[str], jurisdiction: str
    ) -> List[CandidateField]:
        fields: List[CandidateField] = []
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("json_read_error", error=str(exc))
            return []

        def recurse(node: Any, current_path: str):
            if isinstance(node, dict):
                for k, v in node.items():
                    sub_path = f"{current_path}.{k}" if current_path else f"$.{k}"
                    if isinstance(v, (int, float, str)) and not isinstance(v, bool):
                        val_num, unit, scale = parse_financial_number(v)
                        if val_num is not None:
                            locator = make_json_locator(
                                json_path=sub_path,
                                quote=f"{k}: {v}",
                                doc_id=doc_id,
                            )
                            fields.append(
                                CandidateField(
                                    doc_id=doc_id,
                                    raw_label=k.replace("_", " ").title(),
                                    value_raw=str(v),
                                    value_num=val_num,
                                    unit=unit,
                                    scale=scale,
                                    period={"label": "Current", "start": None, "end": None, "type": "unspecified"},
                                    locator=locator,
                                    context_heading=current_path or "root",
                                    extraction_method="native_text",
                                    extraction_confidence=0.95,
                                    entity=entity,
                                    jurisdiction=jurisdiction,
                                )
                            )
                    else:
                        recurse(v, sub_path)
            elif isinstance(node, list):
                for idx, item in enumerate(node):
                    recurse(item, f"{current_path}[{idx}]")

        recurse(data, "$")
        return fields

    def _extract_xml(
        self, path: Path, doc_id: str, entity: Optional[str], jurisdiction: str
    ) -> List[CandidateField]:
        fields: List[CandidateField] = []
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(str(path))
            root = tree.getroot()
        except Exception as exc:
            logger.warning("xml_read_error", error=str(exc))
            return []

        for elem in root.iter():
            text = (elem.text or "").strip()
            if text and len(text) < 50:
                val_num, unit, scale = parse_financial_number(text)
                if val_num is not None:
                    tag = elem.tag.split("}")[-1]  # Strip XML namespace
                    locator = make_xml_locator(
                        xpath=f"//{elem.tag}",
                        quote=f"<{tag}>{text}</{tag}>",
                        doc_id=doc_id,
                    )
                    fields.append(
                        CandidateField(
                            doc_id=doc_id,
                            raw_label=tag.replace("_", " ").title(),
                            value_raw=text,
                            value_num=val_num,
                            unit=unit,
                            scale=scale,
                            period={"label": "Current", "start": None, "end": None, "type": "unspecified"},
                            locator=locator,
                            context_heading="XML Document",
                            extraction_method="xbrl" if "xbrl" in root.tag.lower() else "native_text",
                            extraction_confidence=0.93,
                            entity=entity,
                            jurisdiction=jurisdiction,
                        )
                    )
        return fields

