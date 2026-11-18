"""Concept-Distinct Batch Sampler for MultipleNegativesRankingLoss.

Specification: Section 10.3 & Milestone 2 O2
Rules:
1. At most ONE pair per canonical concept_id per batch.
2. No duplicate strings in the same batch.
Rationale:
Standard in-batch negative loss treats all other items in the batch as negative examples.
If two items in the batch belong to the SAME concept (e.g., 'Turnover' and 'Net Sales' both mapping
to fs.revenue), they would falsely be penalized as mutual negatives.
This sampler strictly ensures distinct concept representation in each batch.
"""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Iterator, List, Sequence, Tuple
from torch.utils.data import Sampler


class ConceptDistinctBatchSampler(Sampler[List[int]]):
    """Yields batches of indices where every item in a batch belongs to a distinct concept."""

    def __init__(
        self,
        concept_ids: Sequence[str],
        batch_size: int = 32,
        shuffle: bool = True,
        seed: int = 42,
    ):
        self.concept_ids = list(concept_ids)
        self.batch_size = batch_size
        self.shuffle = shuffle
        self.rng = random.Random(seed)

        # Build map: concept_id -> list of example indices
        self.concept_to_indices = defaultdict(list)
        for idx, cid in enumerate(self.concept_ids):
            self.concept_to_indices[cid].append(idx)

        self.unique_concepts = list(self.concept_to_indices.keys())

    def __iter__(self) -> Iterator[List[int]]:
        # Clone pools for this epoch
        pools = {cid: list(indices) for cid, indices in self.concept_to_indices.items()}
        if self.shuffle:
            for indices in pools.values():
                self.rng.shuffle(indices)

        available_concepts = [cid for cid, indices in pools.items() if len(indices) > 0]

        while len(available_concepts) >= min(self.batch_size, len(self.unique_concepts)):
            if self.shuffle:
                self.rng.shuffle(available_concepts)

            chosen_batch_concepts = available_concepts[: self.batch_size]
            batch: List[int] = []

            for cid in chosen_batch_concepts:
                idx = pools[cid].pop()
                batch.append(idx)

            yield batch

            # Update available concepts
            available_concepts = [cid for cid, indices in pools.items() if len(indices) > 0]

    def __len__(self) -> int:
        # Approximate number of batches
        total_items = len(self.concept_ids)
        return max(1, total_items // self.batch_size)

