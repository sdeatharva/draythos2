"""Field extraction engine for mixed data rooms."""

from pathlib import Path
from typing import List, Optional
import structlog

from vhagar.components.extraction.base import BaseExtractor, CandidateField
from vhagar.components.extraction.locators import validate_locator, format_locator_display
from vhagar.components.extraction.xlsx_extractor import XlsxExtractor
from vhagar.components.extraction.csv_extractor import CsvExtractor
from vhagar.components.extraction.pdf_extractor import PdfExtractor
from vhagar.components.extraction.docx_extractor import DocxExtractor
from vhagar.components.extraction.text_extractor import TextExtractor
from vhagar.components.extraction.json_xml_extractor import JsonXmlExtractor
from vhagar.components.extraction.llm_extractor import LLMExtractor, verify_verbatim_quote

logger = structlog.get_logger(__name__)

EXTRACTOR_MAP = {
    ".xlsx": XlsxExtractor(),
    ".xls": XlsxExtractor(),
    ".csv": CsvExtractor(),
    ".pdf": PdfExtractor(),
    ".docx": DocxExtractor(),
    ".txt": TextExtractor(),
    ".md": TextExtractor(),
    ".json": JsonXmlExtractor(),
    ".xml": JsonXmlExtractor(),
}


def extract_document_fields(
    file_path: Path | str,
    doc_id: str,
    entity: Optional[str] = None,
    jurisdiction: str = "GLOBAL",
) -> List[CandidateField]:
    """Extract candidate financial fields from any supported document format."""
    p = Path(file_path)
    ext = p.suffix.lower()
    extractor = EXTRACTOR_MAP.get(ext)
    if not extractor:
        logger.warning("no_extractor_for_extension", extension=ext, path=str(p))
        return []

    fields = extractor.extract_fields(
        file_path=p,
        doc_id=doc_id,
        entity=entity,
        jurisdiction=jurisdiction,
    )

    # Hard invariant check: every single field MUST have a valid locator
    valid_fields = []
    for f in fields:
        if validate_locator(f.locator):
            valid_fields.append(f)
        else:
            logger.error("omitting_field_missing_locator", doc_id=doc_id, raw_label=f.raw_label)

    logger.info("extracted_fields_from_document", doc_id=doc_id, count=len(valid_fields), ext=ext)
    return valid_fields


__all__ = [
    "CandidateField",
    "BaseExtractor",
    "extract_document_fields",
    "validate_locator",
    "format_locator_display",
]

