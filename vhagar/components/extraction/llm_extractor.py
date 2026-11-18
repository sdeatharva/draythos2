"""Schema-constrained LLM extractor with verbatim quote verification.

Specification: Section 8.6
1. Fixed JSON schema: {label, value_raw, unit?, period?, page, quote}
2. Verbatim quote check: fuzzy match >= 0.9 against source/OCR text. Items failing are dropped.
3. No concept mapping or number normalization in LLM (Python handles that).
4. Temperature 0. Caching by (doc_sha256, page, prompt_version).
5. Controlled by EXTRACTION_LLM flag.
"""

from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional
import structlog
from pydantic import BaseModel, Field

from vhagar.components.extraction.base import CandidateField
from vhagar.components.extraction.locators import make_pdf_locator, make_txt_locator
from vhagar.config import get_config

logger = structlog.get_logger(__name__)

PROMPT_VERSION = "llm_ext_v1.0"

EXTRACTION_SYSTEM_PROMPT = """You are a financial information extractor.
Extract all financial candidate fields (revenue, tax, profit, expenses, assets, liabilities, metrics) from the text.
You MUST output a valid JSON list of objects strictly adhering to this schema:
[
  {
    "label": "Original line item label exactly as shown in text",
    "value_raw": "Original value string exactly as shown in text (e.g., '(1,234)', '12.5 Cr')",
    "unit": "Currency symbol or code or unit (e.g., 'INR', '$', '%', or null)",
    "period": "Period string (e.g., 'FY2024', 'Q3', '2023-12-31', or null)",
    "page": 1,
    "quote": "Exact verbatim excerpt (sentence or table row) from the input text containing both the label and value"
  }
]

CRITICAL RULES:
1. "quote" MUST be a verbatim substring from the source text.
2. DO NOT normalize numbers (e.g., do NOT turn (500) into -500).
3. DO NOT map concepts to canonical names.
4. If no financial fields are present, return [].
5. Output JSON only, no markdown wrappers, no commentary.
"""


class LLMExtractedItem(BaseModel):
    label: str
    value_raw: str
    unit: Optional[str] = None
    period: Optional[str] = None
    page: int = 1
    quote: str


def verify_verbatim_quote(quote: str, source_text: str, threshold: float = 0.9) -> tuple[bool, float]:
    """Verify that quote appears in source_text with fuzzy ratio >= threshold."""
    if not quote or not source_text:
        return False, 0.0

    clean_quote = " ".join(quote.split()).lower()
    clean_source = " ".join(source_text.split()).lower()

    if clean_quote in clean_source:
        return True, 1.0

    # Search best matching window of approximate length
    q_len = len(clean_quote)
    if q_len == 0:
        return False, 0.0

    step = max(1, q_len // 4)
    best_ratio = 0.0

    for i in range(0, max(1, len(clean_source) - q_len + 1), step):
        window = clean_source[i : i + int(q_len * 1.3)]
        ratio = difflib.SequenceMatcher(None, clean_quote, window).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
        if best_ratio >= threshold:
            return True, best_ratio

    return best_ratio >= threshold, best_ratio


class LLMExtractor:
    """Schema-constrained LLM field extractor with strict quote verification."""

    def __init__(self, cache_dir: Optional[str] = None):
        self._cache: Dict[str, List[Dict[str, Any]]] = {}
        self.settings = get_config()

    def _cache_key(self, doc_sha256: str, page: int) -> str:
        return f"{doc_sha256}_{page}_{PROMPT_VERSION}"

    def extract_from_page(
        self,
        doc_id: str,
        doc_sha256: str,
        page_num: int,
        page_text: str,
        doc_format: str = "pdf",
        entity: Optional[str] = None,
        jurisdiction: Optional[str] = None,
        llm_response_override: Optional[str] = None,
    ) -> List[CandidateField]:
        """Extract candidate fields using schema-constrained LLM output and verify quotes."""
        # 1. Feature flag check
        if not getattr(self.settings, "extraction_llm", False) and not llm_response_override:
            logger.debug("llm_extraction_disabled", doc_id=doc_id)
            return []

        if not page_text or not page_text.strip():
            return []

        ckey = self._cache_key(doc_sha256, page_num)
        raw_items: List[Dict[str, Any]] = []

        if ckey in self._cache:
            raw_items = self._cache[ckey]
        else:
            raw_response = llm_response_override
            if not raw_response:
                raw_response = self._call_llm_api(page_text, page_num)

            if not raw_response:
                return []

            try:
                # Clean json code block markers if present
                clean_json = re.sub(r"^```(?:json)?\s*", "", raw_response.strip())
                clean_json = re.sub(r"\s*```$", "", clean_json)
                parsed = json.loads(clean_json)
                if isinstance(parsed, list):
                    raw_items = parsed
                elif isinstance(parsed, dict) and "fields" in parsed:
                    raw_items = parsed["fields"]
            except Exception as e:
                logger.warning("llm_json_parse_failed", doc_id=doc_id, error=str(e))
                return []

            self._cache[ckey] = raw_items

        results: List[CandidateField] = []
        for item_dict in raw_items:
            try:
                item = LLMExtractedItem(**item_dict)
            except Exception as e:
                logger.debug("llm_item_schema_mismatch", error=str(e), item=item_dict)
                continue

            # 2. Verbatim quote verification (fuzzy ratio >= 0.9)
            valid, ratio = verify_verbatim_quote(item.quote, page_text, threshold=0.9)
            if not valid:
                logger.warning(
                    "llm_quote_verification_failed",
                    doc_id=doc_id,
                    page=page_num,
                    label=item.label,
                    ratio=ratio,
                    quote=item.quote,
                )
                continue

            # 3. Build verified candidate field
            if doc_format == "pdf":
                locator = make_pdf_locator(page=page_num, bbox=[0, 0, 0, 0], quote=item.quote, doc_id=doc_id)
            else:
                locator = make_txt_locator(line=page_num, char_start=0, char_end=len(item.quote), quote=item.quote, doc_id=doc_id)

            method = "llm_vision" if doc_format == "pdf" else "llm_text"
            conf = 0.8  # Capped at 0.8 per specification Section 8.6

            results.append(
                CandidateField(
                    raw_label=item.label.strip(),
                    value_raw=item.value_raw.strip(),
                    locator=locator,
                    context_heading=f"Page {page_num}",
                    entity=entity,
                    jurisdiction=jurisdiction,
                    period_raw=item.period,
                    unit_hint=item.unit,
                    extraction_method=method,
                    extraction_confidence=conf,
                )
            )

        return results

    def _call_llm_api(self, text: str, page_num: int) -> Optional[str]:
        """Call external LLM API if configured."""
        openrouter_key = os.getenv("OPENROUTER_API_KEY")
        gemini_key = os.getenv("GEMINI_API_KEY")

        if not openrouter_key and not gemini_key:
            return None

        # Implementation of provider request with temperature 0
        try:
            import urllib.request

            if openrouter_key:
                url = "https://openrouter.ai/api/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json",
                }
                body = {
                    "model": "openai/gpt-4o-mini",
                    "temperature": 0.0,
                    "messages": [
                        {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Text from page {page_num}:\n\n{text}"},
                    ],
                }
                req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data["choices"][0]["message"]["content"]
        except Exception as e:
            logger.warning("llm_api_call_exception", error=str(e))
            return None

        return None
