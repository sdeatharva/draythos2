"""User-override layer and live-edit impact analysis.

Supports the boundary-push capability:
"A user edits a synonym or concept-map entry, answers adapt, and after
 adding a new document a follow-up question reflects the change."
"""

from __future__ import annotations

from typing import Any, Dict, List
import structlog

from vhagar.db.repo import get_repo
from vhagar.db.seed_taxonomy import normalize_key

logger = structlog.get_logger(__name__)


class OverrideManager:
    """Manages user overrides, impact previews, and incremental recomputation."""

    def __init__(self, repo=None):
        self.repo = repo or get_repo()

    def preview_impact(self, alias: str, new_concept_id: str) -> Dict[str, Any]:
        """Preview how many facts will change before committing an override."""
        key = normalize_key(alias)
        target_concept = self.repo.get_concept(new_concept_id)
        if not target_concept:
            raise ValueError(f"Concept '{new_concept_id}' does not exist")

        matching_facts = self.repo.get_facts_by_label_key(key)
        affected_docs = list({f["doc_id"] for f in matching_facts})

        samples = []
        for f in matching_facts[:10]:
            samples.append({
                "fact_id": f["fact_id"],
                "doc_id": f["doc_id"],
                "raw_label": f["raw_label"],
                "old_concept_id": f.get("concept_id"),
                "old_concept_label": f.get("concept_label"),
                "new_concept_id": new_concept_id,
                "new_concept_label": target_concept["label"],
                "value_raw": f["value_raw"],
            })

        return {
            "alias": alias,
            "alias_key": key,
            "target_concept": target_concept,
            "total_affected_facts": len(matching_facts),
            "affected_document_ids": affected_docs,
            "samples": samples,
        }

    def apply_override(
        self,
        alias: str,
        new_concept_id: str,
        relation: str = "equivalent",
        by: str = "user",
        reason: str | None = None,
    ) -> Dict[str, Any]:
        """Apply user override, recomputing all affected facts immediately."""
        key = normalize_key(alias)
        target_concept = self.repo.get_concept(new_concept_id)
        if not target_concept:
            raise ValueError(f"Target concept '{new_concept_id}' not found")

        # 1. Register override in repository (bumps mapping_version)
        override_record = self.repo.add_override(
            alias=alias,
            concept_id=new_concept_id,
            relation=relation,
            by=by,
            reason=reason,
        )
        new_version = override_record["mapping_version"]

        # 2. Update existing facts that match this label key
        matching_facts = self.repo.get_facts_by_label_key(key)
        updated_count = 0

        with self.repo.get_connection() as conn:
            cur = conn.cursor()
            for f in matching_facts:
                cur.execute(
                    """
                    UPDATE facts
                    SET concept_id = ?,
                        concept_label = ?,
                        parent_id = ?,
                        match_method = 'override',
                        state = 'user_confirmed',
                        mapping_version = ?,
                        confidence = 0.99,
                        similarity = 1.0
                    WHERE fact_id = ?
                    """,
                    (
                        new_concept_id,
                        target_concept["label"],
                        target_concept["parent_id"],
                        new_version,
                        f["fact_id"],
                    ),
                )
                updated_count += 1
            conn.commit()

        logger.info(
            "override_applied_and_recomputed",
            alias=alias,
            concept_id=new_concept_id,
            recomputed_facts=updated_count,
            mapping_version=new_version,
        )

        return {
            "override": override_record,
            "updated_facts_count": updated_count,
            "mapping_version": new_version,
        }

