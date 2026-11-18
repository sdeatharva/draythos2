"""Concept normalization router.

Connects:
User Override -> Dictionary -> Encoder Cosine Top-k -> Calibrator -> Router Decision
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import structlog

from vhagar.db.repo import get_repo
from vhagar.components.normalization.dictionary import DictionaryNormalizer
from vhagar.components.normalization.calibrator import NormalizationCalibrator
from vhagar.components.normalization.concept_index import ConceptIndex

logger = structlog.get_logger(__name__)


class NormalizationResult(dict):
    """Result object supporting both attribute access (dot) and key access (brackets)."""
    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError:
            return None

    def __setattr__(self, name: str, value: Any) -> None:
        self[name] = value


class NormalizationRouter:
    """Multi-stage concept normalizer with calibrated abstention."""

    def __init__(
        self,
        mode: str = "dictionary",  # "dictionary" | "base" | "finetuned"
        repo=None,
        concept_index: Optional[ConceptIndex] = None,
        calibrator: Optional[NormalizationCalibrator] = None,
        dictionary: Optional[DictionaryNormalizer] = None,
    ):
        self.repo = repo or get_repo()
        self.mode = mode
        self.dict_normalizer = dictionary or DictionaryNormalizer(self.repo)
        self.calibrator = calibrator or NormalizationCalibrator()
        self.concept_index = concept_index or (ConceptIndex(repo=self.repo) if mode != "dictionary" else None)

    def normalize(self, raw_label: str) -> NormalizationResult:
        """Map raw surface label to canonical concept with calibrated confidence."""
        # Step 1 & 2: User override and Dictionary lookup
        dict_match = self.dict_normalizer.lookup(raw_label)
        if dict_match:
            return NormalizationResult(dict_match)

        # If dictionary-only mode is active and no match was found:
        if self.mode == "dictionary" or not self.concept_index:
            return NormalizationResult({
                "concept_id": None,
                "concept_label": None,
                "parent_id": None,
                "match_method": "dictionary",
                "similarity": 0.0,
                "confidence": 0.0,
                "state": "abstained",
                "candidates": [],
            })

        # Step 3: Dense vector cosine top-k
        candidates = self.concept_index.find_top_k(raw_label, k=5)
        if not candidates:
            return NormalizationResult({
                "concept_id": None,
                "concept_label": None,
                "parent_id": None,
                "match_method": "model",
                "similarity": 0.0,
                "confidence": 0.0,
                "state": "abstained",
                "candidates": [],
            })

        # Step 4: Calibrate confidence & determine state
        conf, state = self.calibrator.calibrate(candidates)
        top_cand = candidates[0]
        cid = top_cand["concept_id"]
        concept = self.repo.get_concept(cid)

        return NormalizationResult({
            "concept_id": cid,
            "concept_label": concept["label"] if concept else cid,
            "parent_id": concept["parent_id"] if concept else None,
            "match_method": "model",
            "similarity": float(top_cand.get("score", 0.0)),
            "confidence": conf,
            "state": state,
            "candidates": candidates,
        })


NormalizerRouter = NormalizationRouter


