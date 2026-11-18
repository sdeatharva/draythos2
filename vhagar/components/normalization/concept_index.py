"""Concept prototype index for dense embedding matching.

Strictly preserves separation of embedding spaces (Section 3):
"Document chunks use the unchanged base encoder; fine-tuned encoder only
 for the concept index. Never compare vectors from different checkpoints."
"""

from __future__ import annotations

from typing import Any, List, Optional
import numpy as np
import structlog

from vhagar.db.repo import get_repo

logger = structlog.get_logger(__name__)


class ConceptIndex:
    """Exact cosine top-k search over canonical concept prototypes."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", repo=None):
        self.repo = repo or get_repo()
        self.model_name = model_name
        self._model = None
        self._concept_ids: list[str] = []
        self._concept_texts: list[str] = []
        self._concept_vectors: Optional[np.ndarray] = None
        self._initialized = False

    def _ensure_initialized(self):
        if self._initialized:
            return

        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)
        except Exception as exc:
            logger.warning("sentence_transformers_load_failed", model=self.model_name, error=str(exc))
            self._initialized = True
            return

        concepts = self.repo.list_concepts()
        if not concepts:
            self._initialized = True
            return

        self._concept_ids = []
        self._concept_texts = []
        for c in concepts:
            self._concept_ids.append(c["concept_id"])
            # Prototype text combines label and definition
            self._concept_texts.append(f"{c['label']} : {c['definition']}")

        try:
            vecs = self._model.encode(self._concept_texts, normalize_embeddings=True, show_progress_bar=False)
            self._concept_vectors = np.array(vecs, dtype=np.float32)
            self._initialized = True
            logger.info("concept_index_initialized", count=len(self._concept_ids), model=self.model_name)
        except Exception as exc:
            logger.error("concept_embedding_failed", error=str(exc))
            self._initialized = True

    def find_top_k(self, raw_label: str, k: int = 5) -> List[dict[str, Any]]:
        """Return top-k candidate concepts with cosine similarity scores."""
        self._ensure_initialized()
        if self._model is None or self._concept_vectors is None or len(self._concept_ids) == 0:
            return []

        try:
            query_vec = self._model.encode([raw_label], normalize_embeddings=True, show_progress_bar=False)
            scores = np.dot(self._concept_vectors, query_vec[0])
            top_indices = np.argsort(scores)[::-1][:k]

            results = []
            for idx in top_indices:
                cid = self._concept_ids[idx]
                score = float(scores[idx])
                results.append({"concept_id": cid, "score": round(score, 4)})
            return results
        except Exception as exc:
            logger.warning("concept_search_failed", query=raw_label, error=str(exc))
            return []

