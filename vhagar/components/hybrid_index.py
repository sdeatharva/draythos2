"""Hybrid index – dense + BM25 retrieval with reciprocal rank fusion."""

from __future__ import annotations

import asyncio
import hashlib
import re
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import numpy as np
import structlog
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)


def _deterministic_token_hash(token: str, dim: int = 384) -> int:
    """Stable, process-independent 32-bit token hash using SHA-256."""
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "little") % dim


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    text: str
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    section: Optional[str] = None
    embedding: Optional[list[float]] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    source_filename: str = ""


class SearchResult(BaseModel):
    document_id: str
    chunk_id: str
    text: str
    score: float
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    section: Optional[str] = None
    source_filename: str = ""
    matched_terms: list[str] = Field(default_factory=list)


class SearchRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    document_ids: Optional[list[str]] = None
    pinned_document_ids: Optional[list[str]] = None
    top_k: int = 10
    include_global: bool = False


class HybridIndex:
    """Dense + BM25 hybrid retrieval index."""

    def __init__(self, config):
        self.config = config
        self._chunks: dict[str, DocumentChunk] = {}
        self._doc_chunks: dict[str, list[str]] = {}  # doc_id -> [chunk_ids]
        self._chunk_to_doc: dict[str, str] = {}      # chunk_id -> doc_id
        self._embeddings: dict[str, np.ndarray] = {}
        self._model = None
        self._bm25 = None
        self._bm25_corpus: list[list[str]] = []
        self._bm25_chunk_ids: list[str] = []

    def _get_embedding_model(self):
        """Lazy-load the sentence transformer model with local files priority."""
        if self._model is None and not getattr(self, "_model_failed", False):
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
                logger.info("embedding_model_loaded", model="all-MiniLM-L6-v2")
            except Exception:
                self._model_failed = True
                logger.info("embedding_model_using_fast_fallback")
        return self._model

    async def index_document(self, doc_ref, content) -> None:
        """Atomic, version-scoped re-indexing.

        Prepares chunks, computes embeddings, and commits to SQLite FIRST.
        If persistence fails, the active in-memory index is preserved without corruption.
        """
        from vhagar.components.document_processor import DocumentReference, ExtractedContent

        doc_id = doc_ref.document_id
        filename = doc_ref.source_filename

        # 1. Chunk content into local staging list
        chunks: list[DocumentChunk] = []

        for page in content.pages:
            if not page.text.strip():
                continue
            text_chunks = self._chunk_text(page.text)
            for chunk_text in text_chunks:
                chunk_id = str(uuid.uuid4())
                chunk = DocumentChunk(
                    chunk_id=chunk_id,
                    document_id=doc_id,
                    text=chunk_text,
                    page_number=page.page_number,
                    sheet_name=getattr(page, "sheet_name", None),
                    section=getattr(page, "section", None),
                    source_filename=filename,
                    metadata={"confidence": page.confidence},
                )
                chunks.append(chunk)

        if not chunks and content.full_text:
            text_chunks = self._chunk_text(content.full_text)
            for chunk_text in text_chunks:
                chunk_id = str(uuid.uuid4())
                chunks.append(DocumentChunk(
                    chunk_id=chunk_id,
                    document_id=doc_id,
                    text=chunk_text,
                    source_filename=filename,
                ))

        # 2. Compute embeddings
        texts = [c.text for c in chunks]
        embeddings = await self._compute_batch_embeddings(texts)
        for chunk, emb in zip(chunks, embeddings):
            chunk.embedding = emb.tolist()

        # 3. Transactional persistence: Commit to SQLite FIRST before touching active memory
        try:
            from vhagar.database import get_db
            user_id = getattr(doc_ref, "user_id", "usr_default") or "usr_default"
            get_db().save_document_chunks(
                document_id=doc_id,
                version_id="v1",
                chunks=[c.model_dump() for c in chunks],
                user_id=user_id,
            )
        except Exception as e:
            logger.error("atomic_index_persistence_failed", document_id=doc_id, error=str(e))
            raise RuntimeError(f"Atomic persistence failed for document {doc_id}: {e}") from e

        # 4. Atomic memory swap: Clear previous chunks for doc_id and replace with new ones
        old_chunk_ids = self._doc_chunks.get(doc_id, [])
        for old_cid in old_chunk_ids:
            self._chunks.pop(old_cid, None)
            self._embeddings.pop(old_cid, None)
            self._chunk_to_doc.pop(old_cid, None)

        new_chunk_ids = []
        for chunk, emb in zip(chunks, embeddings):
            self._embeddings[chunk.chunk_id] = emb
            self._chunks[chunk.chunk_id] = chunk
            self._chunk_to_doc[chunk.chunk_id] = doc_id
            new_chunk_ids.append(chunk.chunk_id)

        self._doc_chunks[doc_id] = new_chunk_ids

        # 5. Rebuild BM25 index
        self._rebuild_bm25()
        logger.info("document_indexed_atomically", document_id=doc_id, chunks=len(chunks))

    async def search(self, request: SearchRequest) -> list[SearchResult]:
        """Hybrid search combining BM25 and dense retrieval."""
        query = request.query
        top_k = request.top_k

        # Build document filter with strict multi-tenant / user isolation
        doc_filter: set[str] | None = None
        if request.document_ids:
            doc_filter = set(request.document_ids)
            # If user_id is provided, reject/strip any document IDs belonging to other users
            if request.user_id:
                try:
                    from vhagar.database import get_db
                    user_docs = set(get_db().get_user_document_ids(request.user_id))
                    doc_filter = doc_filter.intersection(user_docs)
                except Exception:
                    pass
        elif request.session_id and not request.include_global:
            try:
                from vhagar.database import get_db
                sess_docs = get_db().get_session_document_ids(request.session_id)
                doc_filter = set(sess_docs)
            except Exception:
                doc_filter = set()
        elif request.include_global:
            if request.user_id:
                # Global search is strictly bounded to the user's own workspace/library
                try:
                    from vhagar.database import get_db
                    user_docs = get_db().get_user_document_ids(request.user_id)
                    doc_filter = set(user_docs)
                except Exception:
                    doc_filter = set()
            else:
                # If no user_id is provided, unauthenticated global retrieval is denied
                doc_filter = set()

        # BM25 search
        bm25_results = self._bm25_search(query, top_k * 2, doc_filter)

        # Dense search
        dense_results = await self._dense_search(query, top_k * 2, doc_filter)

        # Fuse results with optional pinned source boost
        pinned_set = set(request.pinned_document_ids) if request.pinned_document_ids else None
        fused = self._reciprocal_rank_fusion(dense_results, bm25_results, pinned_doc_ids=pinned_set)

        # Build SearchResult objects
        results: list[SearchResult] = []
        query_terms = set(query.lower().split())

        missing_ids = [cid for cid, _ in fused[:top_k] if cid not in self._chunks]
        if missing_ids:
            try:
                from vhagar.database import get_db
                for d in get_db().get_chunks(missing_ids):
                    self._chunks[d["chunk_id"]] = DocumentChunk(
                        chunk_id=d["chunk_id"],
                        document_id=d["document_id"],
                        text=d["text"],
                        page_number=d.get("page_number"),
                        sheet_name=d.get("sheet_name"),
                        section=d.get("section"),
                        source_filename=d.get("source_filename", ""),
                        metadata=d.get("metadata", {}),
                    )
            except Exception:
                pass

        for chunk_id, score in fused[:top_k]:
            chunk = self._chunks.get(chunk_id)
            if not chunk:
                continue

            matched = [t for t in query_terms if t in chunk.text.lower()]

            results.append(SearchResult(
                document_id=chunk.document_id,
                chunk_id=chunk.chunk_id,
                text=self._get_snippet(chunk, query),
                score=score,
                page_number=chunk.page_number,
                sheet_name=chunk.sheet_name,
                section=chunk.section,
                source_filename=chunk.source_filename,
                matched_terms=matched,
            ))

        return results

    async def remove_document(self, document_id: str) -> None:
        """Remove all chunks for a document."""
        chunk_ids = self._doc_chunks.pop(document_id, [])
        for cid in chunk_ids:
            self._chunks.pop(cid, None)
            self._embeddings.pop(cid, None)
            self._chunk_to_doc.pop(cid, None)
        self._rebuild_bm25()
        logger.info("document_removed", document_id=document_id, chunks_removed=len(chunk_ids))

    def _chunk_text(self, text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
        """Split text into overlapping chunks."""
        if not text.strip():
            return []

        words = text.split()
        if len(words) <= chunk_size:
            return [text.strip()] if text.strip() else []

        chunks: list[str] = []
        start = 0
        while start < len(words):
            end = min(start + chunk_size, len(words))
            chunk = " ".join(words[start:end])
            if chunk.strip():
                chunks.append(chunk.strip())
            start += chunk_size - overlap

        return chunks

    async def _compute_embedding(self, text: str) -> np.ndarray:
        """Compute text embedding using sentence-transformers with graceful offline fallback."""
        loop = asyncio.get_event_loop()

        def _encode():
            model = self._get_embedding_model()
            if model is not None:
                try:
                    return model.encode(text, normalize_embeddings=True)
                except Exception:
                    pass

            # Stable deterministic offline fallback (384 dims, restart-invariant SHA-256)
            vec = np.zeros(384, dtype=np.float32)
            words = text.lower().split()
            for w in words:
                idx = _deterministic_token_hash(w, 384)
                vec[idx] += 1.0
            norm = np.linalg.norm(vec)
            return vec / (norm + 1e-9)

        return await loop.run_in_executor(_executor, _encode)

    async def _compute_batch_embeddings(self, texts: list[str]) -> list[np.ndarray]:
        """Compute text embeddings in batches for high ingestion throughput."""
        if not texts:
            return []
        loop = asyncio.get_event_loop()

        def _encode_batch():
            model = self._get_embedding_model()
            if model is not None:
                try:
                    embs = model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)
                    return [np.array(e, dtype=np.float32) for e in embs]
                except Exception:
                    pass

            # Stable deterministic fallback in batch (restart-invariant SHA-256)
            results = []
            for t in texts:
                vec = np.zeros(384, dtype=np.float32)
                for w in t.lower().split():
                    vec[_deterministic_token_hash(w, 384)] += 1.0
                norm = np.linalg.norm(vec)
                results.append(vec / (norm + 1e-9))
            return results

        return await loop.run_in_executor(_executor, _encode_batch)

    async def _dense_search(
        self, query: str, top_k: int, doc_filter: set[str] | None
    ) -> list[tuple[str, float]]:
        """Cosine similarity search against stored embeddings."""
        if not self._embeddings:
            # Fallback to persistent SQLite vectors if server was restarted
            try:
                from vhagar.database import get_db
                db_embs = get_db().get_all_chunk_embeddings(list(doc_filter) if doc_filter else None)
                for cid, did, vec in db_embs:
                    self._embeddings[cid] = vec
                    self._chunk_to_doc[cid] = did
            except Exception:
                pass

        if not self._embeddings:
            return []

        query_emb = await self._compute_embedding(query)

        results: list[tuple[str, float]] = []
        for chunk_id, emb in self._embeddings.items():
            if doc_filter is not None:
                doc_id = self._chunk_to_doc.get(chunk_id) or (self._chunks[chunk_id].document_id if chunk_id in self._chunks else None)
                if not doc_id:
                    try:
                        from vhagar.database import get_db
                        c_meta = get_db().get_chunks([chunk_id])
                        if c_meta:
                            doc_id = c_meta[0]["document_id"]
                            self._chunk_to_doc[chunk_id] = doc_id
                    except Exception:
                        pass
                if not doc_id or doc_id not in doc_filter:
                    continue

            score = float(np.dot(query_emb, emb))
            results.append((chunk_id, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def _bm25_search(
        self, query: str, top_k: int, doc_filter: set[str] | None
    ) -> list[tuple[str, float]]:
        """BM25 lexical search with FTS5 persistent fallback."""
        if not self._bm25 or not self._bm25_chunk_ids:
            try:
                from vhagar.database import get_db
                fts_hits = get_db().search_chunks_fts(
                    query=query,
                    document_ids=list(doc_filter) if doc_filter else None,
                    top_k=top_k,
                )
                return [(h["id"], float(h.get("rank_score", 1.0))) for h in fts_hits]
            except Exception:
                return []

        tokenized_query = query.lower().split()
        scores = self._bm25.get_scores(tokenized_query)

        results: list[tuple[str, float]] = []
        for idx, score in enumerate(scores):
            if score <= 0:
                continue
            chunk_id = self._bm25_chunk_ids[idx]
            if doc_filter is not None:
                doc_id = self._chunk_to_doc.get(chunk_id) or (self._chunks[chunk_id].document_id if chunk_id in self._chunks else None)
                if not doc_id:
                    try:
                        from vhagar.database import get_db
                        c_meta = get_db().get_chunks([chunk_id])
                        if c_meta:
                            doc_id = c_meta[0]["document_id"]
                            self._chunk_to_doc[chunk_id] = doc_id
                    except Exception:
                        pass
                if not doc_id or doc_id not in doc_filter:
                    continue
            results.append((chunk_id, float(score)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]

    def _reciprocal_rank_fusion(
        self,
        dense_results: list[tuple[str, float]],
        bm25_results: list[tuple[str, float]],
        k: int = 60,
        pinned_doc_ids: Optional[set[str]] = None,
    ) -> list[tuple[str, float]]:
        """Combine two ranked lists using RRF with 1.5x score weighting for pinned documents."""
        scores: dict[str, float] = {}

        for rank, (chunk_id, _) in enumerate(dense_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)

        for rank, (chunk_id, _) in enumerate(bm25_results):
            scores[chunk_id] = scores.get(chunk_id, 0) + 1.0 / (k + rank + 1)

        # Apply pinned document priority weighting (1.5x boost)
        if pinned_doc_ids:
            for chunk_id in list(scores.keys()):
                doc_id = self._chunk_to_doc.get(chunk_id) or (self._chunks[chunk_id].document_id if chunk_id in self._chunks else None)
                if doc_id and doc_id in pinned_doc_ids:
                    scores[chunk_id] *= 1.5

        fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return fused

    def _get_snippet(self, chunk: DocumentChunk, query: str, max_len: int = 1500) -> str:
        """Extract a relevant snippet from a chunk."""
        text = chunk.text
        if len(text) <= max_len:
            return text

        query_terms = query.lower().split()
        text_lower = text.lower()

        best_pos = 0
        for term in query_terms:
            pos = text_lower.find(term)
            if pos != -1:
                best_pos = max(0, pos - 50)
                break

        snippet = text[best_pos : best_pos + max_len]
        if best_pos > 0:
            snippet = "..." + snippet
        if best_pos + max_len < len(text):
            snippet += "..."

        return snippet

    def _rebuild_bm25(self):
        """Rebuild the BM25 index from current chunks."""
        try:
            from rank_bm25 import BM25Okapi

            self._bm25_corpus = []
            self._bm25_chunk_ids = []

            for chunk_id, chunk in self._chunks.items():
                tokens = chunk.text.lower().split()
                self._bm25_corpus.append(tokens)
                self._bm25_chunk_ids.append(chunk_id)

            if self._bm25_corpus:
                self._bm25 = BM25Okapi(self._bm25_corpus)
            else:
                self._bm25 = None
        except ImportError:
            logger.warning("rank_bm25_not_available")

    async def get_stats(self) -> dict:
        """Return index statistics."""
        doc_formats: dict[str, int] = {}
        for chunk in self._chunks.values():
            fmt = chunk.metadata.get("format", "unknown")
            doc_formats[fmt] = doc_formats.get(fmt, 0) + 1

        return {
            "total_chunks": len(self._chunks),
            "total_documents": len(self._doc_chunks),
            "total_embeddings": len(self._embeddings),
            "documents": list(self._doc_chunks.keys()),
        }

