"""Evaluation metrics: Recall@k and Mean Reciprocal Rank (MRR).

Specification: Section 10.5 & Milestone 2 O3
Computes micro, macro by concept, and per-jurisdiction metrics.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Sequence
import numpy as np


def compute_retrieval_metrics(
    query_results: List[Dict[str, Any]],
    k_list: Sequence[int] = (1, 5),
) -> Dict[str, Any]:
    """Compute micro, macro, and slice-level retrieval metrics."""
    if not query_results:
        return {"count": 0, "recall@1": 0.0, "recall@5": 0.0, "mrr": 0.0}

    recalls = {k: [] for k in k_list}
    reciprocal_ranks = []

    by_concept = defaultdict(list)
    by_jurisdiction = defaultdict(list)

    for item in query_results:
        target = item["true_concept"]
        ranked_preds = item["ranked_concepts"]
        jur = item.get("jurisdiction", "GLOBAL")

        # Rank of target
        rank = None
        for idx, pred in enumerate(ranked_preds, 1):
            if pred == target:
                rank = idx
                break

        rr = 1.0 / rank if rank else 0.0
        reciprocal_ranks.append(rr)

        for k in k_list:
            hit = 1.0 if rank and rank <= k else 0.0
            recalls[k].append(hit)

        by_concept[target].append((recalls[1][-1], rr))
        by_jurisdiction[jur].append((recalls[1][-1], rr))

    # Micro averages
    micro_r1 = float(np.mean(recalls[1])) if recalls[1] else 0.0
    micro_r5 = float(np.mean(recalls[5])) if recalls.get(5) else 0.0
    micro_mrr = float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0

    # Macro averages (by concept)
    macro_r1_list = [np.mean([x[0] for x in vals]) for vals in by_concept.values()]
    macro_mrr_list = [np.mean([x[1] for x in vals]) for vals in by_concept.values()]
    macro_r1 = float(np.mean(macro_r1_list)) if macro_r1_list else 0.0
    macro_mrr = float(np.mean(macro_mrr_list)) if macro_mrr_list else 0.0

    # Per-jurisdiction slice
    jur_metrics = {}
    for jur, vals in by_jurisdiction.items():
        jur_metrics[jur] = {
            "count": len(vals),
            "recall@1": float(np.mean([x[0] for x in vals])),
            "mrr": float(np.mean([x[1] for x in vals])),
        }

    return {
        "count": len(query_results),
        "micro": {
            "recall@1": round(micro_r1, 4),
            "recall@5": round(micro_r5, 4),
            "mrr": round(micro_mrr, 4),
        },
        "macro": {
            "recall@1": round(macro_r1, 4),
            "mrr": round(macro_mrr, 4),
        },
        "per_jurisdiction": jur_metrics,
    }

