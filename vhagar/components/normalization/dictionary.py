"""Dictionary and surface alias lookup.

Normalizes keys (lowercase + Unicode NFKC + collapsed whitespace) and checks
canonical aliases and overrides in the SQLite repository.
"""

from __future__ import annotations

from typing import Any, Optional
import structlog

from vhagar.db.repo import get_repo
from vhagar.db.seed_taxonomy import normalize_key

logger = structlog.get_logger(__name__)


class DictionaryNormalizer:
    """Exact and normalized surface-key alias lookup."""

    def __init__(self, repo=None):
        self.repo = repo or get_repo()

    def lookup(self, raw_label: str) -> Optional[dict[str, Any]]:
        """Look up raw_label in aliases table."""
        match = self.repo.get_alias_match(raw_label)
        if not match:
            return None

        # If relation is 'different' (e.g. Sales Tax vs VAT), don't auto-map as equivalent
        if match["relation"] == "different":
            return {
                "concept_id": match["concept_id"],
                "concept_label": match["concept_label"],
                "parent_id": match["parent_id"],
                "match_method": "override" if match["source"] == "user_override" else "dictionary",
                "similarity": 0.95,
                "confidence": 0.70,
                "state": "needs_review",  # Different regime flagged for human review
                "relation": "different",
                "candidates": [{"concept_id": match["concept_id"], "score": 0.95}],
            }

        is_override = match["source"] == "user_override"
        return {
            "concept_id": match["concept_id"],
            "concept_label": match["concept_label"],
            "parent_id": match["parent_id"],
            "match_method": "override" if is_override else "dictionary",
            "similarity": 1.0,
            "confidence": 0.99 if is_override else 0.95,
            "state": "user_confirmed" if is_override else "auto_accepted",
            "relation": match["relation"],
            "candidates": [{"concept_id": match["concept_id"], "score": 1.0}],
        }

