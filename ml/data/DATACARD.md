# Draythos Dataset Card

**Dataset Name:** Draythos Finance & Tax Concept Translation Benchmark  
**Version:** `1.0.0`  
**License:** Apache 2.0 (Code) / CC-BY 4.0 (Taxonomy and Annotations)  
**Curators:** Draythos Engineering Team  

---

## 1. Dataset Overview

This dataset supports contrastive training and calibrated abstention for the **Finance Concept Translator**. It maps natural language financial line items, statutory disclosures, tax labels, and idioms across US, UK, IN, and EU jurisdictions into a canonical 150-concept financial ontology.

### Summary Statistics
- **Canonical Concepts:** 150 concepts across `tax.*` (40), `fs.*` (80), and `cmp.*` (30).
- **Domain Variants:** 1,500+ variants across 4 jurisdictions and international reporting standards.
- **Hard Negative Triplets:** 1,000+ triplets (anchor, positive, reviewed hard negative).
- **Out-of-Taxonomy Terms:** 100 ambiguous and non-financial metrics (50 validation, 50 test).

---

## 2. Schema Definitions

### 2.1 Canonical Taxonomy (`taxonomy/taxonomy.jsonl`)
| Field | Type | Description |
|---|---|---|
| `concept_id` | string | Stable hierarchical dot-notation ID (e.g. `fs.revenue`, `tax.value_added`) |
| `label` | string | Canonical human-readable concept label |
| `definition` | string | Concise functional definition |
| `parent_id` | string \| null | Parent concept in hierarchy |
| `kind` | string | Family: `tax`, `fs`, `cmp` |
| `jurisdiction` | string | Primary jurisdiction: `GLOBAL`, `US`, `UK`, `IN`, `EU` |
| `source_ref` | string | Citation to origin standard |

### 2.2 Variants (`variants/variants.jsonl`)
| Field | Type | Description |
|---|---|---|
| `example_id` | string | Unique identifier (`ex_00001`) |
| `concept_id` | string | Canonical concept reference |
| `text` | string | Natural language surface form |
| `variant_type` | string | `glossary`, `heading`, `statutory`, `business`, `abbrev`, `idiom` |
| `jurisdiction` | string | `US`, `UK`, `IN`, `EU`, `GLOBAL` |
| `phrase_family_id`| string | Group identifier connecting near-duplicates for zero-leakage splitting |
| `relation` | string | `equivalent` (positive pair), `related`, `different` |
| `is_synthetic` | boolean | `true` if synthetically derived, `false` if human-curated |
| `split` | string | Partition assignment: `train`, `val`, `test` |

### 2.3 Hard Negative Triplets (`negatives/negatives.jsonl`)
| Field | Type | Description |
|---|---|---|
| `triplet_id` | string | Unique identifier (`trip_00001`) |
| `anchor_text` | string | Anchor query |
| `anchor_concept` | string | Canonical ID of anchor |
| `positive_text` | string | Positive synonym sharing anchor concept |
| `negative_text` | string | Confusing line item from different concept |
| `negative_concept`| string | Canonical ID of negative item |
| `difficulty` | string | `hard` (confused pair), `standard` |
| `review_status` | string | Human review confirmation (`accepted`) |

---

## 3. Data Integrity & Leakage Prevention Rules

1. **Grouped Splitting (Zero Overlap):**
   - Splitting is performed strictly over `phrase_family_id` clusters.
   - All near-duplicates, spelling variants, and sub-phrases of a concept are confined to a single split.
   - Evaluated by `ml/scripts/validate_dataset.py`.

2. **Split-First, Augment-Second:**
   - Synthetic variation and negative mining are executed strictly on the `train` partition.
   - Validation and test partitions contain only unaugmented human expressions.

3. **Held-Out Jurisdiction Split:**
   - Jurisdiction `IN` (India / CBIC) is completely held out in `ml/data/splits/split_cross_jur.json` to evaluate cross-jurisdictional zero-shot generalization.

---

## 4. Public Sources & Reference Licenses
- **IFRS Accounting Taxonomy:** International Financial Reporting Standards Foundation.
- **US GAAP Taxonomy:** Financial Accounting Standards Board (FASB).
- **CBIC GST Acts & Rules:** Government of India.
- **HMRC Guidance & Manuals:** UK Crown Copyright.
- **OECD Model Tax Convention:** OECD.
Full license details registered in `docs/DATA_LICENSES.md`.

