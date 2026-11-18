"""Facts service: creation, normalization, persistence, and review workflow."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import structlog

from vhagar.db.repo import get_repo
from vhagar.components.extraction import extract_document_fields
from vhagar.components.normalization.router import NormalizationRouter

logger = structlog.get_logger(__name__)


class FactsService:
    """Manages fact extraction, normalization, review, and querying."""

    def __init__(self, repo=None, router: Optional[NormalizationRouter] = None):
        self.repo = repo or get_repo()
        self.router = router or NormalizationRouter(repo=self.repo)

    def ingest_document_facts(
        self,
        file_path: Path | str,
        doc_id: str,
        entity: Optional[str] = None,
        jurisdiction: str = "GLOBAL",
    ) -> List[Dict[str, Any]]:
        """Extract candidate fields from a document, normalize against canonical taxonomy,

        and persist into the SQLite facts store.
        """
        candidate_fields = extract_document_fields(
            file_path=file_path,
            doc_id=doc_id,
            entity=entity,
            jurisdiction=jurisdiction,
        )

        mapping_version = self.repo.get_mapping_version()
        saved_facts = []

        for candidate in candidate_fields:
            # Normalize candidate label to canonical concept
            norm = self.router.normalize(candidate.raw_label)

            fact_payload = {
                "fact_id": f"f_{uuid.uuid4().hex[:16]}",
                "doc_id": doc_id,
                "entity": candidate.entity or entity,
                "jurisdiction": candidate.jurisdiction or jurisdiction,
                "raw_label": candidate.raw_label,
                "context_heading": candidate.context_heading,
                "concept_id": norm.get("concept_id"),
                "concept_label": norm.get("concept_label"),
                "parent_id": norm.get("parent_id"),
                "match_method": norm.get("match_method", "dictionary"),
                "similarity": norm.get("similarity", 0.0),
                "confidence": norm.get("confidence", 0.0),
                "state": norm.get("state", "needs_review"),
                "candidates": norm.get("candidates", []),
                "value_raw": candidate.value_raw,
                "value_num": candidate.value_num,
                "unit": candidate.unit,
                "scale": candidate.scale,
                "period": candidate.period,
                "locator": candidate.locator,
                "extraction_method": candidate.extraction_method,
                "extraction_confidence": candidate.extraction_confidence,
                "taxonomy_version": "tax-1.0.0",
                "model_version": "enc-1.0.0",
                "mapping_version": mapping_version,
                "reviewed_by": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

            try:
                fact = self.repo.save_fact(fact_payload)
                saved_facts.append(fact)
            except Exception as exc:
                logger.error("failed_to_save_fact", error=str(exc), label=candidate.raw_label)

        logger.info("document_facts_ingested", doc_id=doc_id, total_facts=len(saved_facts))
        return saved_facts

    def list_facts(
        self,
        doc_id: Optional[str] = None,
        state: Optional[str] = None,
        concept_id: Optional[str] = None,
        kind: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Tuple[List[Dict[str, Any]], int]:
        return self.repo.list_facts(
            doc_id=doc_id,
            state=state,
            concept_id=concept_id,
            kind=kind,
            search=search,
            limit=limit,
            offset=offset,
        )

    def get_fact(self, fact_id: str) -> Optional[Dict[str, Any]]:
        return self.repo.get_fact(fact_id)

    def review_fact(
        self,
        fact_id: str,
        action: str,  # 'accept' | 'reject' | 'reassign'
        new_concept_id: Optional[str] = None,
        by: str = "user",
        note: Optional[str] = None,
    ) -> Dict[str, Any]:
        return self.repo.review_fact(
            fact_id=fact_id,
            action=action,
            new_concept_id=new_concept_id,
            by=by,
            note=note,
        )

    def recompute_facts_for_alias(self, alias: str, new_concept_id: str) -> int:
        """Section 12: Incremental recompute on affected facts when alias override is added."""
        from vhagar.db.seed_taxonomy import normalize_key
        key = normalize_key(alias)
        concept = self.repo.get_concept(new_concept_id)
        concept_label = concept["label"] if concept else new_concept_id

        count = 0
        with self.repo.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE facts
                SET concept_id = ?, concept_label = ?, match_method = 'override', state = 'user_confirmed'
                WHERE label_key = ?
                """,
                (new_concept_id, concept_label, key),
            )
            count = cur.rowcount
            conn.commit()
        return count

    def query_facts(
        self,
        concept_id: Optional[str] = None,
        doc_id: Optional[str] = None,
        state: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        facts, _ = self.repo.list_facts(concept_id=concept_id, doc_id=doc_id, state=state, limit=limit)
        return facts

