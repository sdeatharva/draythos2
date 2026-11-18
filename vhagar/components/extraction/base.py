"""Base extractor protocol and CandidateField schema."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class CandidateField:
    """A raw field extracted from a document before concept normalization."""

    doc_id: str
    raw_label: str
    value_raw: str
    locator: Dict[str, Any]  # MUST NOT BE EMPTY
    value_num: Optional[float] = None
    unit: Optional[str] = None
    scale: float = 1.0
    period: Dict[str, Any] = field(default_factory=lambda: {"label": "Unknown", "start": None, "end": None, "type": "unspecified"})
    context_heading: Optional[str] = None
    extraction_method: str = "native_table"
    extraction_confidence: float = 1.0
    entity: Optional[str] = None
    jurisdiction: Optional[str] = "GLOBAL"

    def to_fact_payload(self) -> Dict[str, Any]:
        """Convert to base dictionary for fact creation."""
        return {
            "doc_id": self.doc_id,
            "raw_label": self.raw_label,
            "value_raw": self.value_raw,
            "value_num": self.value_num,
            "unit": self.unit,
            "scale": self.scale,
            "period": self.period,
            "locator": self.locator,
            "context_heading": self.context_heading,
            "extraction_method": self.extraction_method,
            "extraction_confidence": self.extraction_confidence,
            "entity": self.entity,
            "jurisdiction": self.jurisdiction,
        }


class BaseExtractor(ABC):
    """Abstract interface for all document format extractors."""

    @abstractmethod
    def extract_fields(
        self,
        file_path: Path,
        doc_id: str,
        entity: Optional[str] = None,
        jurisdiction: str = "GLOBAL",
    ) -> List[CandidateField]:
        """Extract all candidate fields and values paired with precise locators."""
        pass

