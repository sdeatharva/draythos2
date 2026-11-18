"""Calibrated confidence gating for concept normalization.

Logistic regression gate based on:
- Top similarity score (s1)
- Margin gap between top-1 and top-2 candidates (s1 - s2)

Decision states:
- auto_accepted (confidence >= high_threshold, default 0.80)
- needs_review  (confidence between abstention_threshold and high_threshold, 0.50 - 0.80)
- abstained     (confidence < abstention_threshold, default 0.50)
- conflict      (top candidates within tiny margin and conflicting parents)
"""

from __future__ import annotations

import math
from typing import Any, List, Tuple


class NormalizationCalibrator:
    """Computes calibrated probabilities and routing states."""

    def __init__(
        self,
        w0: float = -4.5,
        w_s1: float = 6.0,
        w_margin: float = 3.5,
        high_threshold: float = 0.80,
        abstention_threshold: float = 0.50,
        conflict_margin: float = 0.03,
    ):
        self.w0 = w0
        self.w_s1 = w_s1
        self.w_margin = w_margin
        self.high_threshold = high_threshold
        self.abstention_threshold = abstention_threshold
        self.conflict_margin = conflict_margin

    def calibrate(
        self, candidates: List[dict[str, Any]]
    ) -> Tuple[float, str]:
        """Given a sorted list of candidate dicts with 'concept_id' and 'score',

        returns (calibrated_confidence, state).
        """
        if not candidates:
            return 0.0, "abstained"

        s1 = float(candidates[0].get("score", 0.0))
        s2 = float(candidates[1].get("score", 0.0)) if len(candidates) > 1 else 0.0
        margin = max(0.0, s1 - s2)

        # Check conflict condition
        if len(candidates) > 1 and margin <= self.conflict_margin and s1 >= 0.65:
            # Check if candidates refer to distinct concept trees
            c1 = candidates[0].get("concept_id", "")
            c2 = candidates[1].get("concept_id", "")
            if c1 != c2:
                # Close tie between different concepts
                logit = self.w0 + self.w_s1 * s1 + self.w_margin * margin
                prob = 1.0 / (1.0 + math.exp(-max(min(logit, 10.0), -10.0)))
                return round(prob, 3), "conflict"

        # Logistic sigmoid calibration
        logit = self.w0 + self.w_s1 * s1 + self.w_margin * margin
        calibrated_prob = 1.0 / (1.0 + math.exp(-max(min(logit, 10.0), -10.0)))
        calibrated_prob = round(calibrated_prob, 3)

        if calibrated_prob >= self.high_threshold:
            state = "auto_accepted"
        elif calibrated_prob >= self.abstention_threshold:
            state = "needs_review"
        else:
            state = "abstained"

        return calibrated_prob, state

