"""Query engine – concept-aware retrieval, expansion, citation building."""

from __future__ import annotations

from typing import Optional

import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)


class ExpandedQuery(BaseModel):
    original: str
    expanded_terms: list[str] = Field(default_factory=list)
    synonyms_used: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    document_id: str
    source_filename: str
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    section: Optional[str] = None
    text_excerpt: str = ""


class QueryResult(BaseModel):
    answer_context: str = ""
    citations: list[Citation] = Field(default_factory=list)
    retrieval_scores: dict[str, float] = Field(default_factory=dict)
    expanded_query: Optional[ExpandedQuery] = None
    sources_used: int = 0


class QueryEngine:
    """Orchestrates retrieval with concept expansion and citation building."""

    def __init__(self, index, concept_mapper, concept_memory, config):
        self.index = index
        self.concept_mapper = concept_mapper
        self.concept_memory = concept_memory
        self.config = config

    async def query(
        self,
        question: str,
        session_id: str = "",
        document_ids: list[str] | None = None,
        include_global: bool = False,
        user_id: Optional[str] = None,
    ) -> QueryResult:
        """Run an expanded, concept-aware query and return results with citations."""
        expanded = await self.expand_query(question)

        # Build the search query from original + expanded terms
        search_query = question
        if expanded.expanded_terms:
            search_query = f"{question} {' '.join(expanded.expanded_terms)}"

        from vhagar.components.hybrid_index import SearchRequest

        # Search attached documents first
        attached_results = []
        if document_ids:
            req = SearchRequest(
                query=search_query,
                session_id=session_id,
                user_id=user_id,
                document_ids=document_ids,
                top_k=self.config.max_snippet_length // 50 or 10,
            )
            attached_results = await self.index.search(req)

        # Optionally search global index
        global_results = []
        if include_global or self._should_include_global(question, attached_results, document_ids):
            req = SearchRequest(
                query=search_query,
                session_id=session_id,
                user_id=user_id,
                top_k=5,
                include_global=True,
            )
            global_results = await self.index.search(req)

        # Combine results, prioritizing attached docs
        all_results = attached_results + [
            r for r in global_results
            if r.chunk_id not in {a.chunk_id for a in attached_results}
        ]

        # Enrich with concept memory
        concept_context = ""
        if self.concept_memory:
            enrichments = await self.concept_memory.get_enrichment_for_query(question)
            if enrichments:
                concept_context = "\n".join(enrichments)

        # Build context and citations
        context = self._build_retrieval_context(all_results)
        if concept_context:
            context = f"{context}\n\nRelated concepts:\n{concept_context}"

        citations = self._format_citations(all_results)

        scores = {}
        for r in all_results[:10]:
            scores[r.chunk_id] = r.score

        return QueryResult(
            answer_context=context,
            citations=citations,
            retrieval_scores=scores,
            expanded_query=expanded,
            sources_used=len(set(r.document_id for r in all_results)),
        )

    async def expand_query(self, query: str) -> ExpandedQuery:
        """Expand query using concept mapper for synonym coverage (supporting phrases & n-grams)."""
        import re
        clean_query = re.sub(r"[^\w\s-]", " ", query).strip()
        words = clean_query.split()
        expanded_terms: list[str] = []
        synonyms_used: list[str] = []

        # Generate candidates from multi-word n-grams (up to 4 words) down to single words
        candidates: list[str] = []
        for n in range(min(4, len(words)), 0, -1):
            for i in range(len(words) - n + 1):
                phrase = " ".join(words[i : i + n]).strip().lower()
                if len(phrase) >= 3 and phrase not in candidates:
                    candidates.append(phrase)

        for candidate in candidates:
            try:
                expansions = await self.concept_mapper.expand_term(candidate)
                for exp in expansions:
                    if exp.lower() != candidate and exp.lower() not in [t.lower() for t in expanded_terms]:
                        expanded_terms.append(exp)
                        synonyms_used.append(f"{candidate}->{exp}")
            except Exception:
                pass

        return ExpandedQuery(
            original=query,
            expanded_terms=expanded_terms[:15],
            synonyms_used=synonyms_used[:15],
        )

    def _build_retrieval_context(self, results, max_tokens: int = 4000) -> str:
        """Build a text context from search results."""
        if not results:
            return ""

        context_parts: list[str] = []
        total_len = 0

        for i, result in enumerate(results):
            source_info = f"[Source {i+1}: {result.source_filename}"
            if result.page_number:
                source_info += f", page {result.page_number}"
            if result.sheet_name:
                source_info += f", sheet '{result.sheet_name}'"
            source_info += "]"

            entry = f"{source_info}\n{result.text}\n"
            entry_len = len(entry)

            if total_len + entry_len > max_tokens * 4:  # Rough char estimate
                break

            context_parts.append(entry)
            total_len += entry_len

        return "\n".join(context_parts)

    def _format_citations(self, results) -> list[Citation]:
        """Convert search results to citation objects."""
        seen: set[str] = set()
        citations: list[Citation] = []

        for r in results:
            key = f"{r.document_id}:{r.page_number}:{r.sheet_name}"
            if key in seen:
                continue
            seen.add(key)

            citations.append(Citation(
                document_id=r.document_id,
                source_filename=r.source_filename,
                page_number=r.page_number,
                sheet_name=r.sheet_name,
                section=r.section,
                text_excerpt=r.text[:200] if r.text else "",
            ))

        return citations

    def _should_include_global(
        self,
        question: str,
        attached_results: list,
        document_ids: Optional[list[str]] = None,
    ) -> bool:
        """Decide whether global retrieval is needed based on attached results quality.

        If the caller explicitly restricted search to specific document_ids, global retrieval is suppressed.
        """
        if document_ids is not None:
            return False
        if not attached_results:
            return True
        avg_score = sum(r.score for r in attached_results) / len(attached_results) if attached_results else 0
        return avg_score < 0.3 or len(attached_results) < 2

