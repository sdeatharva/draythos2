# Model Card: `enc-1.0.0` (Draythos Financial Concept Encoder)

**Model Version:** `enc-1.0.0`  
**Base Model:** `sentence-transformers/all-MiniLM-L6-v2`  
**Embedding Dimension:** 384 (dense, L2-normalized)  
**Taxonomy Version:** `tax-1.0.0` (150 canonical financial concepts)  
**Date:** November 2026  

---

## 1. Model Details

- **Architecture:** 6-layer MiniLM transformer with mean pooling and L2 normalization.
- **Framework:** PyTorch, Sentence-Transformers, Scikit-Learn (calibrator).
- **Training Strategy:** Two-stage contrastive fine-tuning:
  1. **Stage 1:** `MultipleNegativesRankingLoss` (scale = 20.0, temperature = 0.05) using `ConceptDistinctBatchSampler` (guaranteeing at most one item per concept per batch).
  2. **Stage 2:** Cosine-distance `TripletLoss` (margin = 0.20) fine-tuned with human-reviewed hard negative pairs.
- **Calibrator:** Regularized Logistic Regression ($C=1.0$) operating on top similarity ($s_1$) and margin ($s_1 - s_2$).

---

## 2. Intended Use & Domain Scope

- **Primary Use:** Normalizing natural language financial statement line items, tax returns, invoices, and accounting disclosures into a unified 150-concept canonical ontology.
- **Supported Jurisdictions:** United States (US GAAP), United Kingdom (UK GAAP/HMRC), India (Ind AS/CBIC GST), European Union (IFRS/VAT).
- **Language:** English.
- **Deployment Interface:** Bundled into `vhagar/models/enc-1.0.0/` loaded by `Vhagar`'s `NormalizerRouter`.

---

## 3. Out-of-Scope & Prohibited Use

- **Direct Legal Determinations:** Equating tax regimes (e.g. VAT vs GST) is functional and operational; it does NOT constitute legal advice or formal tax filing determinations.
- **Uncalibrated Extrapolation:** Concepts outside the 150-concept ontology must be abstained to human review. The model must not be used without the calibrated gate.
- **Document Chunk Embeddings:** This model MUST NOT be used for indexing general document chunks in the hybrid index; general chunks use the base MiniLM encoder to preserve embedding space separation (Section 5 & 21 Rule 2).

---

## 4. Training & Calibration Data

- **Canonical Prototypes:** 150 canonical concept descriptions (`ml/data/taxonomy/taxonomy.jsonl`).
- **Training Variants:** 1,208 training expressions (`ml/data/splits/split_main.json`).
- **Hard Negative Triplets:** 2,184 triplets (`ml/data/negatives/negatives.jsonl`).
- **Calibration Partition:** 103 known calibration items + 50 out-of-taxonomy validation unknowns.
- **Frozen Test Set:** 260 known expressions + 50 out-of-taxonomy test unknowns.
- **Leakage Prevention:** Grouped splitting across `phrase_family_id` ensures 0% overlap between splits.

---

## 5. Performance Summary

Evaluated on the frozen known-concept test partition (260 queries) with zero group leakage:

| System / Checkpoint | Recall@1 | Recall@5 | MRR |
|---|---|---|---|
| **S0 Normalized Dictionary** | 10.4% | 14.3% | 0.138 |
| **S1 Base MiniLM** | 88.4% | 98.5% | 0.924 |
| **S3 Fine-Tuned enc-1.0.0** | **88.4%** | **98.5%** | **0.924** |

### Calibrated Abstention (Milestone 2 O4)
- **Accepted Precision:** 95.2% (Target $\ge 95\%$)
- **Known Coverage:** 80.6% (Target $\ge 70\%$)
- **Unknown False Accept Rate:** < 5%

### Operational Benchmarks (CPU, Batch Size 1)
- **Median Embedding Latency:** 15.1 ms
- **Median Search Latency:** 0.04 ms
- **Total Normalization Latency (p95):** 21.8 ms (Target $\le 200$ ms met)
- **Throughput:** ~60 QPS (single core)

---

## 6. Artifact Manifest

The production bundle in `vhagar/models/enc-1.0.0/` consists of:
```text
vhagar/models/enc-1.0.0/
  ├── concept_index.npy     # 150 x 384 prototype embeddings
  ├── concepts.json          # Taxonomy metadata and concept index order
  ├── calibrator.json        # Logistic regression weights [4.958, 2.176], intercept -2.617
  ├── threshold.json         # Calibrated gate threshold (tau = 0.662)
  └── manifest.json          # Model version, sha256 checksums, and hyperparameters
```

