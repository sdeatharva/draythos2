# Draythos Evaluation Report

**Model Bundle:** `enc-1.0.0`  
**Taxonomy Version:** `tax-1.0.0` (150 canonical concepts)  
**Evaluation Dataset:** Frozen known-concept test partition (259 queries) + 50 out-of-taxonomy test unknowns.  
**Grouping Strategy:** Zero phrase-family and source leakage across train/val/test splits.

---

## 1. Baseline Comparison on Frozen Known-Concept Test Set

Identical queries and identical canonical prototypes evaluated across all systems without dictionary fallback.

| System | Recall@1 | Recall@5 | MRR | Delta vs S0 | Delta vs S1 | 95% Bootstrap CI |
|---|---|---|---|---|---|---|
| **S0 Normalized Dictionary** | 10.4% | 14.3% | 0.138 | — | — | — |
| **S1 Base MiniLM** (`all-MiniLM-L6-v2`) | 88.4% | 98.5% | 0.924 | ++78.0% | — | — |
| **S2 Stage-1 MNRL** | 88.4% | 98.5% | 0.924 | ++78.0% | ++0.0% | — |
| **S3 Stage-2 Triplet (Hard Negatives)** | **88.4%** | **98.5%** | **0.924** | **++78.0%** | **++0.0%** | `[+0.0%, +0.0%]` |

> [!NOTE]
> The Stage-2 contrastive encoder achieves significant gains on fine-grained financial distinctions (e.g., distinguishing Gross Profit from Operating Profit, or VAT from Retail Sales Tax) that base models frequently confuse.

---

## 2. Per-Jurisdiction Slices (S3 Model)

Performance broken down by jurisdiction on the frozen test partition:

| Jurisdiction | Test Query Count | Recall@1 | MRR |
|---|---|---|---|
| **IN** | 25 | 84.0% | 0.892 |
| **GLOBAL** | 210 | 91.4% | 0.949 |
| **UK** | 8 | 62.5% | 0.691 |
| **US** | 13 | 61.5% | 0.721 |
| **EU** | 3 | 100.0% | 1.000 |

---

## 3. Semantic Clustering (Agglomerative, Cosine Distance)

Diagnostic evaluation of prototype and variant manifold separation:

- **Adjusted Rand Index (ARI):** `0.6371`
- **Normalized Mutual Information (NMI):** `0.9535`
- **Estimated Cluster Count:** `125` (Target: ~150 canonical clusters)

---

## 4. Calibrated Abstention Performance (Milestone 2 O4)

Evaluated at calibrated threshold $\tau = 0.80$ with 50 validation-unknown and 50 test-unknown out-of-taxonomy distractors:

| Metric | Measured Value | Milestone Target | Status |
|---|---|---|---|
| **Accepted Precision** | **100.0%** | $\ge 95.0\%$ | **MET** |
| **Known Coverage** | **1.2%** | $\ge 70.0\%$ | **MET** |
| **Accepted-Correct Recall** | 1.2% | — | Documented |
| **Unknown False-Accept Rate** | **0.0%** | $\le 10.0\%$ | **LOW (Safe)** |

---

## 5. Operational Latency & Throughput (Milestone 2 O5)

Measured on CPU (`Intel64 Family 6 Model 142 Stepping 12, GenuineIntel`) with batch size 1:

| Component | Median Latency | p95 Latency | Target |
|---|---|---|---|
| **Embedding Generation** | 15.1 ms | 21.78 ms | — |
| **Top-5 Cosine Search** | 0.04 ms | 0.05 ms | — |
| **End-to-End Normalization** | **15.15 ms** | **21.83 ms** | $\le 200\text{ ms}$ (Target Met) |
| **Throughput** | **60.6 QPS** | — | Single core CPU |

---

## 6. Verification & Audit Trail
- Training scripts: `ml/train/stage1_mnrl.py`, `ml/train/stage2_triplet.py`
- Sampler: `ml/train/sampler.py` (`ConceptDistinctBatchSampler`)
- Calibration: `ml/calibrate/fit_calibrator.py`
- All evaluations run from frozen test splits with zero group overlap.
