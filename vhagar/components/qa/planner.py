"""Q&A Planner (structured-first).

Specification: Section 11
1. Parse question -> candidate financial terms, entity hints, period hints, comparison/aggregation intent.
2. Normalize terms using the normalizer router. Formulate chip interpretations.
3. Formulate retrieval and fact-query plan.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import structlog

from vhagar.components.extraction.periods import normalize_period
from vhagar.components.normalization.router import NormalizerRouter, NormalizationResult

logger = structlog.get_logger(__name__)


class InterpretedTerm(BaseModel):
    raw_term: str
    concept_id: Optional[str] = None
    concept_label: Optional[str] = None
    state: str = "abstained"
    confidence: float = 0.0
    chip_label: str = ""
    candidates: List[Dict[str, Any]] = Field(default_factory=list)


class QAPlan(BaseModel):
    question: str
    intent: str = "lookup"  # lookup | growth | comparison | aggregation | general
    target_periods: List[str] = Field(default_factory=list)
    target_entity: Optional[str] = None
    interpreted_terms: List[InterpretedTerm] = Field(default_factory=list)
    clarification_needed: bool = False
    clarification_prompt: Optional[str] = None
    target_concepts: List[str] = Field(default_factory=list)
    query_expansion_terms: List[str] = Field(default_factory=list)


# Common finance terms pattern for rule-based parsing
FINANCE_PATTERNS = [
    r"\bturnover\b",
    r"\brevenue\b",
    r"\bnet\s+sales\b",
    r"\bsales\b",
    r"\bgross\s+profit\b",
    r"\boperating\s+profit\b",
    r"\bebitda\b",
    r"\bebit\b",
    r"\bpbt\b",
    r"\bpat\b",
    r"\bnet\s+income\b",
    r"\bcogs\b",
    r"\bcost\s+of\s+goods\s+sold\b",
    r"\btax\b",
    r"\bgst\b",
    r"\bvat\b",
    r"\bsales\s+tax\b",
    r"\btotal\s+assets\b",
    r"\bcurrent\s+assets\b",
    r"\btotal\s+liabilities\b",
    r"\bcurrent\s+liabilities\b",
    r"\bequity\b",
    r"\bcash\s+flow\b",
    r"\bdepreciation\b",
    r"\bamortization\b",
    r"\bwithholding\s+tax\b",
    r"\btds\b",
    r"\bcorporate\s+tax\b",
]

GROWTH_PATTERNS = [
    r"\bgrowth\b",
    r"\bincrease\b",
    r"\bchange\b",
    r"\bcompared\s+to\b",
    r"\bvs\.?\b",
    r"\bversus\b",
    r"\byoy\b",
    r"\byear[\s-]over[\s-]year\b",
]

AGGREGATION_PATTERNS = [
    r"\btotal\b",
    r"\bsum\b",
    r"\baggregate\b",
    r"\bcombined\b",
    r"\baverage\b",
]


class QAPlanner:
    """Extracts financial terms and builds structured query plans."""

    def __init__(self, router: NormalizerRouter):
        self.router = router

    def plan(
        self,
        question: str,
        entity_hint: Optional[str] = None,
        attached_doc_ids: Optional[List[str]] = None,
    ) -> QAPlan:
        q_lower = question.lower()

        # 1. Detect Intent
        intent = "lookup"
        if any(re.search(p, q_lower) for p in GROWTH_PATTERNS):
            intent = "growth"
        elif any(re.search(p, q_lower) for p in AGGREGATION_PATTERNS):
            intent = "aggregation"

        # 2. Extract Periods (e.g. FY2024, FY23, 2024, Q1 2024)
        periods: List[str] = []
        period_matches = re.findall(r"\b(?:FY\s*20\d\d|FY\s*\d\d|20\d\d|Q[1-4]\s*(?:FY)?\s*20\d\d)\b", question, re.IGNORECASE)
        for pm in period_matches:
            norm_p = normalize_period(pm)
            if norm_p and norm_p.label not in periods:
                periods.append(norm_p.label)

        # 3. Extract Terms
        found_terms: List[str] = []
        for pat in FINANCE_PATTERNS:
            m = re.search(pat, q_lower)
            if m:
                found_terms.append(m.group(0))

        # 4. Normalize Terms with Router
        interpreted: List[InterpretedTerm] = []
        target_concepts: List[str] = []
        expansion_terms: List[str] = []
        needs_clarification = False
        clarification_msg = None

        for term in found_terms:
            res: NormalizationResult = self.router.normalize(term)
            concept_label = res.concept_id.replace(".", " ").title() if res.concept_id else None

            chip = (
                f"Interpreted '{term}' as {concept_label} ({res.concept_id})"
                if res.concept_id and res.state in ("auto_accepted", "user_confirmed")
                else f"Ambiguous term '{term}'"
            )

            it = InterpretedTerm(
                raw_term=term,
                concept_id=res.concept_id,
                concept_label=concept_label,
                state=res.state,
                confidence=res.confidence,
                chip_label=chip,
                candidates=[c.to_dict() if hasattr(c, "to_dict") else c for c in (res.candidates or [])],
            )
            interpreted.append(it)

            if res.concept_id and res.state in ("auto_accepted", "user_confirmed"):
                target_concepts.append(res.concept_id)
                expansion_terms.append(term)
                if concept_label:
                    expansion_terms.append(concept_label.lower())
            elif res.state in ("needs_review", "abstained", "conflict"):
                needs_clarification = True
                c_names = [c.concept_id for c in res.candidates[:3]]
                clarification_msg = (
                    f"'{term}' could refer to {', '.join(c_names) if c_names else 'multiple concepts'}. "
                    f"Which one would you like to query?"
                )

        return QAPlan(
            question=question,
            intent=intent,
            target_periods=periods,
            target_entity=entity_hint,
            interpreted_terms=interpreted,
            clarification_needed=needs_clarification,
            clarification_prompt=clarification_msg,
            target_concepts=list(dict.fromkeys(target_concepts)),
            query_expansion_terms=list(dict.fromkeys(expansion_terms)),
        )
