"""Operational latency and throughput benchmark.

Specification: Section 10.5 & Milestone 2 O5
Runs 1,000 warmed batch-size-one normalization requests:
- Embedding latency (median / p95)
- Cosine search latency (median / p95)
- Total latency and queries-per-second (QPS)
- Target: p95 <= 200 ms on CPU.
"""

from __future__ import annotations

import platform
import time
from pathlib import Path
from typing import Dict, List
import numpy as np


def benchmark_operational_latency(
    model,
    prototypes: np.ndarray,
    sample_queries: List[str],
    n_requests: int = 1000,
) -> Dict[str, float]:
    """Measure median and p95 latency for embedding and top-k search."""
    if not sample_queries:
        sample_queries = ["Turnover", "Cost of Sales", "Net Profit", "EBITDA", "Value Added Tax", "Goods and Services Tax"]

    # 1. Warm-up
    for q in sample_queries[:5]:
        v = model.encode([q], normalize_embeddings=True, show_progress_bar=False)
        _ = np.dot(v, prototypes.T)

    embed_times = []
    search_times = []
    total_times = []

    # 2. 1,000 requests
    for i in range(n_requests):
        q = sample_queries[i % len(sample_queries)]

        t0 = time.perf_counter()
        v = model.encode([q], normalize_embeddings=True, show_progress_bar=False)
        t1 = time.perf_counter()
        _ = np.dot(v, prototypes.T)
        t2 = time.perf_counter()

        embed_ms = (t1 - t0) * 1000.0
        search_ms = (t2 - t1) * 1000.0
        tot_ms = (t2 - t0) * 1000.0

        embed_times.append(embed_ms)
        search_times.append(search_ms)
        total_times.append(tot_ms)

    return {
        "n_requests": n_requests,
        "cpu_info": platform.processor() or platform.machine(),
        "embed_median_ms": round(float(np.median(embed_times)), 2),
        "embed_p95_ms": round(float(np.percentile(embed_times, 95)), 2),
        "search_median_ms": round(float(np.median(search_times)), 2),
        "search_p95_ms": round(float(np.percentile(search_times, 95)), 2),
        "total_median_ms": round(float(np.median(total_times)), 2),
        "total_p95_ms": round(float(np.percentile(total_times, 95)), 2),
        "qps": round(float(1000.0 / np.mean(total_times)), 1),
    }

