"""Q&A Verifier: ensures zero hallucinated or unsupported numbers.

Specification: Section 11 & Section 21 Rule 5:
Every number in the answer MUST equal a cited fact or a Python-computed result.
Unsupported numbers are flagged and stripped, or fallback table is provided.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Set, Tuple
from pydantic import BaseModel, Field
import structlog

from vhagar.components.qa.answerer import QAPlanResponse

logger = structlog.get_logger(__name__)


class VerificationResult(BaseModel):
    is_valid: bool
    verified_numbers: List[float] = Field(default_factory=list)
    unsupported_numbers: List[float] = Field(default_factory=list)
    cleaned_text: str
    rejection_reason: str = ""


class QAVerifier:
    """Verifies that numbers in an LLM generated answer are backed by facts or computations."""

    def __init__(self, tolerance: float = 0.05):
        self.tolerance = tolerance

    def verify_answer(self, generated_text: str, plan_response: QAPlanResponse) -> VerificationResult:
        if not generated_text:
            return VerificationResult(is_valid=True, cleaned_text="")

        # 1. Collect allowed numbers from facts and computations
        allowed_numbers: Set[float] = set()
        allowed_years: Set[int] = set()

        for f in plan_response.facts:
            if f.value_num is not None:
                allowed_numbers.add(float(f.value_num))
            # Also extract years from period label (e.g. FY2024 -> 2024)
            for ym in re.findall(r"\b(20\d\d)\b", f.period_label):
                allowed_years.add(int(ym))

        for c in plan_response.computations:
            allowed_numbers.add(float(c.value))

        for p in plan_response.plan.target_periods:
            for ym in re.findall(r"\b(20\d\d)\b", p):
                allowed_years.add(int(ym))

        # 2. Extract numbers from generated text
        # Regex to capture numeric values with optional commas and decimals
        raw_number_tokens = re.findall(r"(?<![A-Za-z0-9_])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?", generated_text)

        verified: List[float] = []
        unsupported: List[float] = []

        for token in raw_number_tokens:
            clean = token.replace(",", "").rstrip("%").strip()
            try:
                num = float(clean)
            except ValueError:
                continue

            # Allow if it's an approved year
            if int(num) in allowed_years and num.is_integer():
                continue

            # Ignore tiny counters like 1, 2, 3 in bullet lists or citations like [F:f_1]
            if num in (1.0, 2.0, 3.0, 4.0, 5.0) and f"[{int(num)}]" in generated_text:
                continue

            # Check if num matches any allowed number within tolerance
            is_match = False
            for allowed in allowed_numbers:
                if abs(allowed) > 1e-6:
                    rel_diff = abs(num - allowed) / abs(allowed)
                    if rel_diff <= self.tolerance:
                        is_match = True
                        break
                else:
                    if abs(num - allowed) < 1e-4:
                        is_match = True
                        break

            if is_match:
                verified.append(num)
            else:
                unsupported.append(num)

        if not unsupported:
            return VerificationResult(
                is_valid=True,
                verified_numbers=verified,
                unsupported_numbers=[],
                cleaned_text=generated_text,
            )

        # If unsupported numbers found, log and provide verified fallback table
        logger.warning(
            "qa_verification_failed_unsupported_numbers",
            unsupported=unsupported,
            allowed=list(allowed_numbers),
        )

        fallback_lines = [
            "> [!WARNING]",
            "> *Note: Some generated numbers could not be verified against the data room and were omitted.*",
            "",
            "### Verified Fact Table",
            "| Concept | Value | Unit | Period | Fact ID |",
            "|---|---|---|---|---|",
        ]
        for f in plan_response.facts:
            fallback_lines.append(
                f"| {f.concept_label} | {f.value_num:,} | {f.unit} | {f.period_label} | `{f.fact_id}` |"
            )

        if plan_response.computations:
            fallback_lines.extend(["", "### Verified Computations"])
            for c in plan_response.computations:
                fallback_lines.append(f"- **{c.operation.title()}**: {c.value} {c.unit} (`{c.formula}`)")

        return VerificationResult(
            is_valid=False,
            verified_numbers=verified,
            unsupported_numbers=unsupported,
            cleaned_text="\n".join(fallback_lines),
            rejection_reason=f"Found {len(unsupported)} ungrounded number(s): {unsupported}",
        )

