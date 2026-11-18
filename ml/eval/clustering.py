"""Clustering evaluation using Adjusted Rand Index (ARI) and Normalized Mutual Info (NMI).

Specification: Section 10.5 & Milestone 2 O3
Framework: AgglomerativeClustering with average linkage and cosine distance.
Diagnostic evaluation only; does not generate production concept IDs.
"""

from __future__ import annotations

from typing import Dict, List, Sequence
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score


def evaluate_clustering(
    embeddings: np.ndarray,
    true_labels: Sequence[str],
    distance_threshold: float = 0.35,
) -> Dict[str, float]:
    """Evaluate clustering alignment with canonical taxonomy labels."""
    if len(embeddings) < 2:
        return {"ari": 0.0, "nmi": 0.0, "cluster_count": 1}

    # Normalize embeddings for cosine distance
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    norm_embeddings = embeddings / norms

    # Metric = cosine
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=distance_threshold,
        metric="cosine",
        linkage="average",
    )
    cluster_labels = clustering.fit_predict(norm_embeddings)

    ari = float(adjusted_rand_score(true_labels, cluster_labels))
    nmi = float(normalized_mutual_info_score(true_labels, cluster_labels))

    return {
        "ari": round(ari, 4),
        "nmi": round(nmi, 4),
        "cluster_count": int(clustering.n_clusters_),
    }

