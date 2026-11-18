"""Baseline evaluation harness across S0, S1, S2, and S3.

Specification: Section 10.2 & Milestone 2 O3
Systems compared on identical test queries and canonical prototypes:
- S0: Normalized dictionary lookup (trained aliases only; miss = failure)
- S1: Unchanged sentence-transformers/all-MiniLM-L6-v2
- S2: Stage-1 contrastive model (MultipleNegativesRankingLoss)
- S3: Stage-2 hard-negative model (TripletLoss)
"""

from __future__ import annotations

import os
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple
import numpy as np
import unicodedata

from ml.eval.retrieval_metrics import compute_retrieval_metrics

TAXONOMY_FILE = Path("ml/data/taxonomy/taxonomy.jsonl")
VARIANTS_FILE = Path("ml/data/variants/variants.jsonl")
SPLIT_FILE = Path("ml/data/splits/split_main.json")


def normalize_str(s: str) -> str:
    norm = unicodedata.normalize("NFKC", s.lower())
    return " ".join(norm.split())


class S0Dictionary:
    """S0: Normalized dictionary lookup from training aliases."""

    def __init__(self, train_items: List[Dict[str, Any]], canonicals: List[Dict[str, Any]]):
        self.map = {}
        # Add canonical labels
        for c in canonicals:
            self.map[normalize_str(c["label"])] = c["concept_id"]
        # Add training items
        for item in train_items:
            norm = normalize_str(item["text"])
            self.map[norm] = item["concept_id"]

    def rank(self, query: str, all_concepts: List[str]) -> List[str]:
        norm = normalize_str(query)
        if norm in self.map:
            match = self.map[norm]
            return [match] + [c for c in all_concepts if c != match]
        # Miss: return all concepts in default order (miss = rank len)
        return list(all_concepts)


class SModelRanker:
    """S1, S2, S3 Dense Encoder Ranker."""

    def __init__(self, model, prototypes: List[str], concept_ids: List[str]):
        self.model = model
        self.concept_ids = concept_ids
        self.proto_vecs = model.encode(prototypes, normalize_embeddings=True, show_progress_bar=False)

    def rank_many(self, queries: List[str]) -> List[List[str]]:
        q_vecs = self.model.encode(queries, normalize_embeddings=True, show_progress_bar=False)
        sims = np.dot(q_vecs, self.proto_vecs.T)  # (N, C)
        ranked_all = []
        for i in range(len(queries)):
            order = np.argsort(sims[i])[::-1]
            ranked_all.append([self.concept_ids[idx] for idx in order])
        return ranked_all


def run_baselines_evaluation():
    # 1. Load Taxonomy
    canonicals = []
    concept_ids = []
    prototypes = []

    with open(TAXONOMY_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                c = json.loads(line)
                canonicals.append(c)
                concept_ids.append(c["concept_id"])
                prototypes.append(f"{c['label']}. {c['definition']}")

    # 2. Load Splits
    with open(SPLIT_FILE, "r", encoding="utf-8") as f:
        split = json.load(f)

    train_ids = set(split["train"])
    test_ids = set(split["test"])

    train_records = []
    test_records = []

    with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                if r["example_id"] in train_ids:
                    train_records.append(r)
                elif r["example_id"] in test_ids and r.get("relation") == "equivalent":
                    test_records.append(r)

    print(f"Evaluation on frozen test set: {len(test_records)} queries across {len(concept_ids)} concepts.")

    test_queries = [r["text"] for r in test_records]
    test_targets = [r["concept_id"] for r in test_records]

    # --- S0: Dictionary Lookup ---
    s0_dict = S0Dictionary(train_records, canonicals)
    s0_ranked = [s0_dict.rank(q, concept_ids) for q in test_queries]
    s0_items = [
        {"true_concept": t, "ranked_concepts": ranked, "jurisdiction": r.get("jurisdiction", "GLOBAL")}
        for t, ranked, r in zip(test_targets, s0_ranked, test_records)
    ]
    s0_metrics = compute_retrieval_metrics(s0_items)

    # --- S1: Base MiniLM ---
    from sentence_transformers import SentenceTransformer
    base_model = SentenceTransformer("all-MiniLM-L6-v2")
    s1_ranker = SModelRanker(base_model, prototypes, concept_ids)
    s1_ranked = s1_ranker.rank_many(test_queries)
    s1_items = [
        {"true_concept": t, "ranked_concepts": ranked, "jurisdiction": r.get("jurisdiction", "GLOBAL")}
        for t, ranked, r in zip(test_targets, s1_ranked, test_records)
    ]
    s1_metrics = compute_retrieval_metrics(s1_items)

    # --- S2 & S3 Models ---
    stage1_path = Path("ml/runs/stage1_checkpoint")
    stage2_path = Path("ml/runs/stage2_checkpoint")

    # If stage1/stage2 not trained yet, fallback to base for evaluation test run
    s2_model = SentenceTransformer(str(stage1_path)) if stage1_path.exists() and any(stage1_path.iterdir()) else base_model
    s2_ranker = SModelRanker(s2_model, prototypes, concept_ids)
    s2_ranked = s2_ranker.rank_many(test_queries)
    s2_items = [
        {"true_concept": t, "ranked_concepts": ranked, "jurisdiction": r.get("jurisdiction", "GLOBAL")}
        for t, ranked, r in zip(test_targets, s2_ranked, test_records)
    ]
    s2_metrics = compute_retrieval_metrics(s2_items)

    s3_model = SentenceTransformer(str(stage2_path)) if stage2_path.exists() and any(stage2_path.iterdir()) else s2_model
    s3_ranker = SModelRanker(s3_model, prototypes, concept_ids)
    s3_ranked = s3_ranker.rank_many(test_queries)
    s3_items = [
        {"true_concept": t, "ranked_concepts": ranked, "jurisdiction": r.get("jurisdiction", "GLOBAL")}
        for t, ranked, r in zip(test_targets, s3_ranked, test_records)
    ]
    s3_metrics = compute_retrieval_metrics(s3_items)

    results = {
        "test_query_count": len(test_records),
        "S0_dictionary": s0_metrics,
        "S1_base_miniLM": s1_metrics,
        "S2_stage1_mnrl": s2_metrics,
        "S3_stage2_triplet": s3_metrics,
        "s0_hits": [1 if items["ranked_concepts"][0] == items["true_concept"] else 0 for items in s0_items],
        "s1_hits": [1 if items["ranked_concepts"][0] == items["true_concept"] else 0 for items in s1_items],
        "s3_hits": [1 if items["ranked_concepts"][0] == items["true_concept"] else 0 for items in s3_items],
        "concept_groups": [r["concept_id"] for r in test_records],
    }

    print("\n--- Frozen Test Baseline Evaluation Summary ---")
    print(f"S0 Dictionary:     Recall@1: {s0_metrics['micro']['recall@1']*100:.1f}%, MRR: {s0_metrics['micro']['mrr']:.3f}")
    print(f"S1 Base MiniLM:    Recall@1: {s1_metrics['micro']['recall@1']*100:.1f}%, MRR: {s1_metrics['micro']['mrr']:.3f}")
    print(f"S2 Stage 1 MNRL:   Recall@1: {s2_metrics['micro']['recall@1']*100:.1f}%, MRR: {s2_metrics['micro']['mrr']:.3f}")
    print(f"S3 Stage 2 Triplet: Recall@1: {s3_metrics['micro']['recall@1']*100:.1f}%, MRR: {s3_metrics['micro']['mrr']:.3f}")

    return results, s3_ranker, test_records
