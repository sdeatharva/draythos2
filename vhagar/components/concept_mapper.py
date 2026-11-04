"""Concept mapper – canonical concepts, synonyms, fuzzy matching."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


class ConceptMapping(BaseModel):
    model_config = {"extra": "allow"}

    canonical: str
    synonyms: list[str] = Field(default_factory=list)
    category: Optional[str] = None
    description: Optional[str] = None
    concept_id: Optional[str] = None
    jurisdiction: Optional[str] = None
    source: Optional[str] = None
    hard_negatives: list[str] = Field(default_factory=list)
    synthetic_variants: list[str] = Field(default_factory=list)
    corpus_negatives: list[str] = Field(default_factory=list)
    tier: Optional[int] = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MappingUpdate(BaseModel):
    action: str  # "add", "remove", "update"
    canonical: str
    synonym: Optional[str] = None
    category: Optional[str] = None


class ConceptMapper:
    """Maintains canonical concept ↔ synonym relationships."""

    def __init__(self, config):
        self.config = config
        self._store_path: Path = config.data_dir / "concept_mappings.json"
        self._mappings: dict[str, ConceptMapping] = {}
        self._synonym_index: dict[str, str] = {}  # synonym_lower -> canonical
        self._threshold: float = config.fuzzy_threshold

    async def add_mapping(
        self, canonical: str, synonyms: list[str], category: str | None = None
    ) -> ConceptMapping:
        """Add or update a concept mapping."""
        key = canonical.lower()

        if key in self._mappings:
            existing = self._mappings[key]
            for syn in synonyms:
                if syn.lower() not in [s.lower() for s in existing.synonyms]:
                    existing.synonyms.append(syn)
                    self._synonym_index[syn.lower()] = canonical
            if category:
                existing.category = category
            existing.updated_at = datetime.now(timezone.utc)
            mapping = existing
        else:
            mapping = ConceptMapping(
                canonical=canonical,
                synonyms=synonyms,
                category=category,
            )
            self._mappings[key] = mapping
            for syn in synonyms:
                self._synonym_index[syn.lower()] = canonical

        self._synonym_index[key] = canonical
        await self._save()
        logger.info("mapping_added", canonical=canonical, synonyms=len(synonyms))
        return mapping

    async def remove_synonym(self, synonym: str) -> bool:
        """Remove a synonym from its mapping."""
        key = synonym.lower()
        canonical = self._synonym_index.pop(key, None)
        if not canonical:
            return False

        canon_key = canonical.lower()
        if canon_key in self._mappings:
            mapping = self._mappings[canon_key]
            mapping.synonyms = [s for s in mapping.synonyms if s.lower() != key]
            mapping.updated_at = datetime.now(timezone.utc)
            if not mapping.synonyms and canon_key != key:
                pass  # Keep the canonical entry even without synonyms

        await self._save()
        return True

    async def get_canonical(self, term: str, allow_fuzzy: bool = True) -> str | None:
        """Find the canonical form for a term."""
        key = term.lower().strip()

        # Exact match
        if key in self._synonym_index:
            return self._synonym_index[key]

        if not allow_fuzzy:
            return None

        # Fuzzy match (only for terms with <= 2 words to avoid false positive substring matches)
        if len(key.split()) > 2:
            return None

        all_terms = list(self._synonym_index.keys())
        match = self._fuzzy_match(key, all_terms, self._threshold)
        if match:
            return self._synonym_index[match]

        return None

    async def expand_term(self, term: str, allow_fuzzy: bool = True) -> list[str]:
        """Return all synonyms for a term's canonical form."""
        canonical = await self.get_canonical(term, allow_fuzzy=allow_fuzzy)
        if not canonical:
            return [term]

        canon_key = canonical.lower()
        mapping = self._mappings.get(canon_key)
        if not mapping:
            return [term]

        result = [mapping.canonical] + mapping.synonyms + (mapping.synthetic_variants or [])
        return list(dict.fromkeys(result))  # Deduplicate preserving order

    async def get_all_mappings(self) -> list[ConceptMapping]:
        return list(self._mappings.values())

    async def update_from_document(self, terms: list[str]) -> list[MappingUpdate]:
        """Auto-map new terms from a document to existing or new concepts."""
        updates: list[MappingUpdate] = []

        for term in terms:
            if len(term) < 3:
                continue
            canonical = await self.get_canonical(term)
            if canonical:
                # Already mapped, check if this exact form is a synonym
                canon_key = canonical.lower()
                mapping = self._mappings.get(canon_key)
                if mapping and term.lower() not in [s.lower() for s in mapping.synonyms] and term.lower() != canon_key:
                    mapping.synonyms.append(term)
                    self._synonym_index[term.lower()] = canonical
                    mapping.updated_at = datetime.now(timezone.utc)
                    updates.append(MappingUpdate(action="update", canonical=canonical, synonym=term))
            # We don't auto-create new canonical entries to avoid noise

        if updates:
            await self._save()

        return updates

    def _fuzzy_match(self, term: str, candidates: list[str], threshold: float) -> str | None:
        """Find the best fuzzy match above threshold."""
        best_match: str | None = None
        best_score = 0.0

        for candidate in candidates:
            score = SequenceMatcher(None, term, candidate).ratio()
            if score > best_score and score >= threshold:
                best_score = score
                best_match = candidate

        return best_match

    async def _save(self):
        """Persist mappings to JSON."""
        data = {k: v.model_dump(mode="json") for k, v in self._mappings.items()}
        self._store_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self._store_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)

    async def _load(self):
        """Load mappings from JSON."""
        if not self._store_path.exists():
            return

        try:
            with open(self._store_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for key, val in data.items():
                mapping = ConceptMapping(**val)
                self._mappings[key] = mapping
                self._synonym_index[key] = mapping.canonical
                for syn in mapping.synonyms:
                    self._synonym_index[syn.lower()] = mapping.canonical
                for var in (mapping.synthetic_variants or []):
                    self._synonym_index[var.lower()] = mapping.canonical

            logger.info("concept_mappings_loaded", count=len(self._mappings))
        except Exception as exc:
            logger.error("concept_mappings_load_failed", error=str(exc))

