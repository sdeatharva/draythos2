"""Concept memory – persistent backend-only concept learning store."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


class ConceptRecord(BaseModel):
    model_config = {"extra": "allow"}

    concept_name: str
    keywords: list[str] = Field(default_factory=list)
    meaning: str = ""
    context: str = ""
    provenance: str = ""
    occurrence_count: int = 1
    concept_id: Optional[str] = None
    tier: Optional[int] = 1
    jurisdiction: Optional[str] = None
    source: Optional[str] = None
    hard_negatives: list[str] = Field(default_factory=list)
    synthetic_variants: list[str] = Field(default_factory=list)
    corpus_negatives: list[str] = Field(default_factory=list)
    first_seen: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_seen: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemoryStats(BaseModel):
    total_concepts: int = 0
    total_occurrences: int = 0
    last_updated: Optional[datetime] = None


class ConceptMemory:
    """Persistent backend-only concept memory. Never exposed directly to users."""

    def __init__(self, config):
        self.config = config
        self._store_path: Path = config.data_dir / "concept_memory.json"
        self._concepts: dict[str, ConceptRecord] = {}

    async def ingest_from_document(
        self, document_id: str, terms: list[str], content_summary: str
    ) -> int:
        """Ingest concept-level knowledge from a processed document."""
        added_or_updated = 0
        now = datetime.now(timezone.utc)

        for term in terms:
            key = term.lower()
            if key in self._concepts:
                record = self._concepts[key]
                record.occurrence_count += 1
                record.last_seen = now
                if document_id not in record.provenance:
                    record.provenance = f"{record.provenance},{document_id}" if record.provenance else document_id
                added_or_updated += 1
            else:
                self._concepts[key] = ConceptRecord(
                    concept_name=term,
                    keywords=[term],
                    meaning="",
                    context=content_summary[:200] if content_summary else "",
                    provenance=document_id,
                    first_seen=now,
                    last_seen=now,
                )
                added_or_updated += 1

        await self._save()
        logger.info("concepts_ingested", document_id=document_id, concepts=added_or_updated)
        return added_or_updated

    async def get_concept(self, name: str) -> ConceptRecord | None:
        return self._concepts.get(name.lower())

    async def search_concepts(self, query: str, top_k: int = 10) -> list[ConceptRecord]:
        """Search concepts by keyword overlap, token matching, and phrase inclusion."""
        query_lower = query.lower().strip()
        query_terms = set(query_lower.split())
        scored: list[tuple[ConceptRecord, float]] = []

        for record in self._concepts.values():
            rec_name_lower = record.concept_name.lower()
            record_terms = set()
            for kw in record.keywords:
                for w in kw.lower().split():
                    record_terms.add(w)
            for w in rec_name_lower.split():
                record_terms.add(w)

            score = 0.0
            # Direct phrase match bonus
            if rec_name_lower in query_lower or (len(rec_name_lower) > 4 and query_lower in rec_name_lower):
                score += 100.0

            # Token overlap
            overlap = len(query_terms & record_terms)
            if overlap > 0:
                score += overlap * 15.0 + float(record.occurrence_count)

            # Hard negatives or synthetic variants check
            for syn in getattr(record, "synthetic_variants", []):
                if syn.lower() in query_lower:
                    score += 50.0

            if score > 0:
                scored.append((record, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [r for r, _ in scored[:top_k]]

    async def get_stats(self) -> MemoryStats:
        total_occ = sum(c.occurrence_count for c in self._concepts.values())
        last = max((c.last_seen for c in self._concepts.values()), default=None) if self._concepts else None
        return MemoryStats(
            total_concepts=len(self._concepts),
            total_occurrences=total_occ,
            last_updated=last,
        )

    async def get_enrichment_for_query(self, query: str) -> list[str]:
        """Return concept-level context useful for query enrichment."""
        matches = await self.search_concepts(query, top_k=5)
        enrichments: list[str] = []
        for m in matches:
            header = f"• {m.concept_name}"
            jur = getattr(m, "jurisdiction", None)
            src = getattr(m, "source", None)
            if jur or src:
                header += f" [{jur or ''}{' - ' if jur and src else ''}{src or ''}]"
            info = f"{header}: {m.meaning}" if m.meaning else header
            if m.context:
                info += f" (Context: {m.context[:250]})"
            negatives = getattr(m, "hard_negatives", None)
            if negatives and len(negatives) > 0:
                info += f" [Note: Distinct from {', '.join(negatives[:3])}]"
            enrichments.append(info)
        return enrichments

    async def _save(self):
        """Persist concept memory to JSON."""
        data = {k: v.model_dump(mode="json") for k, v in self._concepts.items()}
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._store_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    async def _load(self):
        """Load concept memory from JSON."""
        if not self._store_path.exists():
            return

        try:
            with open(self._store_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for key, val in data.items():
                try:
                    self._concepts[key] = ConceptRecord(**val)
                except Exception as rec_err:
                    logger.warning("concept_record_parse_skipped", key=key, error=str(rec_err))
            logger.info("concept_memory_loaded", concepts=len(self._concepts))
        except Exception as exc:
            logger.error("concept_memory_load_failed", error=str(exc))

