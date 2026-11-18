"""Paired concept-group bootstrap 95% confidence intervals.

Specification: Section 10.5 & Milestone 2 O3
Resamples groups of concept test items with replacement to compute empirical 95% CIs
for differences in Recall@1 between systems (e.g., S3 vs S0, S3 vs S1).
"""

from __future__ import annotations

import random
from collections import defaultdict
from typing import Dict, List, Sequence, Tuple
import numpy as np


def compute_paired_bootstrap_ci(
    system_a_hits: Sequence[int],
    system_b_hits: Sequence[int],
    concept_groups: Sequence[str],
    n_bootstrap: int = 1000,
    seed: int = 42,
) -> Dict[str, float]:
    """Calculate 95% CI for difference: mean(system_b) - mean(system_a)."""
    assert len(system_a_hits) == len(system_b_hits) == len(concept_groups)
    rng = random.Random(seed)

    # Group sample indices by concept
    group_map = defaultdict(list)
    for idx, grp in enumerate(concept_groups):
        group_map[grp].append(idx)

    unique_groups = list(group_map.keys())
    diffs = []

    for _ in range(n_bootstrap):
        sampled_groups = rng.choices(unique_groups, k=len(unique_groups))
        sampled_indices = [idx for grp in sampled_groups for idx in group_map[grp]]

        if not sampled_indices:
            continue

        a_acc = np.mean([system_a_hits[i] for i in sampled_indices])
        b_acc = np.mean([system_b_hits[i] for i in sampled_indices])
        diffs.append(b_acc - a_acc)

    diffs.sort()
    lower_idx = int(0.025 * len(diffs))
    upper_idx = int(0.975 * len(diffs))

    point_diff = float(np.mean(system_b_hits) - np.mean(system_a_hits))

    return {
        "point_diff": round(point_diff, 4),
        "ci_lower_95": round(float(diffs[lower_idx]), 4),
        "ci_upper_95": round(float(diffs[upper_idx]), 4),
        "p_value_heuristic": round(float(np.mean([1 if d <= 0 else 0 for d in diffs])), 4),
    }

