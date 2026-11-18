# Draythos — Finance Concept Translator

*An intelligent, multi-jurisdiction finance concept translation engine and data-room workspace that understands the semantic idea behind financial terminology across regulatory regimes (e.g., GST vs. VAT, Turnover vs. Revenue from Operations, Sales Tax vs. Consumption Tax). Draythos extracts verified canonical facts anchored by strict, tamper-proof source locators into a unified, human-reviewable, and exportable financial truth spine.*

![Draythos Platform](./frontend/public/mascot.png)

> [!IMPORTANT]
> **Regulatory Notice & Legal Disclaimer:**  
> *Terminology normalization, not a legal determination.*  
> Draythos standardizes accounting, tax, and compliance terms into functional equivalents for analytics, cross-border auditing, and consolidated reporting. It does not provide statutory, accounting, or legal advice.

---

## Benchmark & Operational Summary

| Category | Target Metric | Achieved Metric | Verification Artifact |
| :--- | :--- | :--- | :--- |
| **Financial QA Benchmark** | $\ge 90\%$ Precision / Zero Hallucination | **100.0% Precision / 100.0% Recall** | [`tests/run_benchmark_eval.py`](./tests/run_benchmark_eval.py) (50/50 tests passed) |
| **Citation Accuracy** | 100% Grounded Citations | **100.0% Citation Precision / 0% Unsupported** | [`tests/benchmark_eval_results.json`](./tests/benchmark_eval_results.json) |
| **Source Locator Invariant** | 100% of facts have locators | **100.0% (57/57 facts valid)** | [`ml/eval/eval_dataroom.py`](./ml/eval/eval_dataroom.py) on 20-file data room |
| **Data Room Formats** | 6 distinct file formats | **PDF, XLSX, CSV, DOCX, TXT, XML, JSON** | [`sample_dataroom/files/`](./sample_dataroom/files/) (20 files, 39 gold annotations) |
| **Model Encoder Track** | Calibrated posterior probability | **`enc-1.0.0` (Dual-Encoder + Isotonic Gate)** | [`vhagar/models/enc-1.0.0/`](./vhagar/models/enc-1.0.0/) |
| **Design System** | Wispr Flow Warm Paper Tokens | **`#FFFFEB` canvas, `#034F46` forest, `#F0D7FF`** | [`frontend/src/app/globals.css`](./frontend/src/app/globals.css) |
| **TypeScript Compilation** | Zero type errors | **0 Errors (`tsc --noEmit`)** | [`frontend/tsconfig.json`](./frontend/tsconfig.json) |
| **Unit & Integration Suite** | 100% pass rate | **21/21 Core Tests Passed (1.89s)** | [`tests/test_translation_pipeline.py`](./tests/test_translation_pipeline.py) |

---

## Table of Contents

1. [The Translation Spine & Core Invariants](#the-translation-spine--core-invariants)
2. [Key Product Capabilities](#key-product-capabilities)
3. [Architecture Overview](#architecture-overview)
4. [The Machine Learning Pipeline (enc-1.0.0)](#the-machine-learning-pipeline-enc-100)
5. [The 150-Concept Canonical Taxonomy](#the-150-concept-canonical-taxonomy)
6. [Interactive User Interface (Eyrie)](#interactive-user-interface-eyrie)
7. [Wispr Flow Design System & Token Blueprint](#wispr-flow-design-system--token-blueprint)
8. [Consolidated Multi-Tab Excel Export](#consolidated-multi-tab-excel-export)
9. [Office.js Excel Add-In](#officejs-excel-add-in)
10. [Sample Data Room & Evaluation Benchmarks](#sample-data-room--evaluation-benchmarks)
11. [Repository Layout](#repository-layout)
12. [Database Schema & System of Record](#database-schema--system-of-record)
13. [API Endpoints & Routing Surface](#api-endpoints--routing-surface)
14. [Environment Variables & Configuration](#environment-variables--configuration)
15. [Local Development & Setup Guide](#local-development--setup-guide)
16. [Test & Benchmark Execution Guide](#test--benchmark-execution-guide)
17. [Troubleshooting & Known Caveats](#troubleshooting--known-caveats)
18. [Security, Governance & Data Licenses](#security-governance--data-licenses)
19. [Glossary](#glossary)

---

## The Translation Spine & Core Invariants

Financial, corporate, and tax records across international subsidiaries use disparate nomenclature for identical economic realities. For example, the input tax credit on corporate purchases appears as:
- **UK / EU:** `VAT Input Credit` or `Reclaimable Input VAT`
- **India:** `Input Tax Credit (ITC)` under `CGST/SGST/IGST`
- **Australia / Singapore:** `GST Paid on Purchases`
- **US:** *Non-existent as an input credit mechanism* (treated as an expense or categorized under state retail sales tax regimes).

Draythos resolves this fragmentation through a deterministic seven-stage translation spine:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          STAGE 1: DOCUMENT INGEST                      │
│   PDF (native/scanned), XLSX, CSV, DOCX, TXT, XML (XBRL), JSON (Feeds) │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   STAGE 2: CANDIDATE FIELD EXTRACTION                  │
│    Raw Labels, Formatted Numbers, Units, Scale Multipliers, Periods,   │
│    and Format-Specific Locators (row, col, cell, page, bbox, xpath)    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 STAGE 3: NORMALIZATION ROUTER & GATE                   │
│   1. User Override Layer (SQLite Instant Alias Memory)                 │
│   2. Curated Financial Synonyms Dictionary (Exact & Key Normalization) │
│   3. Fine-Tuned Dual-Encoder (all-MiniLM-L6-v2 contrastive embeddings)│
│   4. Isotonic Calibrator Gate: P(match | x)                            │
│      ├── P >= 0.85 ──► auto_accepted                                   │
│      ├── 0.50 <= P < 0.85 ──► needs_review                             │
│      └── P < 0.50 ──► abstained (Uncertain / Abstain)                  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      STAGE 4: FACTS SYSTEM OF RECORD                   │
│   SQLite Database (data/draythos.db): Canonical Concepts, Aliases,     │
│   Facts with Source Locators, and Cryptographic Mapping Audit Ledger   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼─────────────────────────────┐
      ▼                              ▼                             ▼
┌───────────────┐          ┌──────────────────┐          ┌──────────────────┐
│ STAGE 5:      │          │ STAGE 6:         │          │ STAGE 7:         │
│ REVIEW UI     │          │ GROUNDED Q&A     │          │ CONSOLIDATED     │
│ /app/review   │          │ Fact citations   │          │ EXCEL EXPORT     │
│ Deep-link cell│          │ [F:fact_id] with │          │ Multi-tab .xlsx  │
│ & PDF bbox    │          │ Python arithmetic│          │ with formulas &  │
│ jumps         │          │ (Zero invention) │          │ source links     │
└───────────────┘          └──────────────────┘          └──────────────────┘
```

### The Non-Negotiable Invariants

1. **No Fact Without a Locator:** Every extracted number must possess a verifiable, granular `SourceLocator` pointing to its exact coordinate (PDF bounding box, Excel sheet and cell address, CSV row and column, DOCX paragraph, or XML/JSON node path). If an artifact cannot provide a locator, it cannot be promoted into a fact.
2. **Deterministic Arithmetic:** The language model is forbidden from performing multi-entity aggregation or currency arithmetic. All math is planned as an abstract expression, resolved via Python code against verified database facts, and cited with `[F:fact_id]`.
3. **Calibrated Abstention:** When an incoming header or field label falls below calibrated similarity thresholds, the system explicitly marks it as `abstained`. Draythos never guesses or forces ambiguous terms into random ontology buckets.
4. **Transparent User Overrides:** Human analysts can override any mapping via the Concept Map Editor (`/app/concepts`). Overrides instantly recompute downstream fact states, trigger live impact previews, and record an immutable entry in the audit ledger.

---

## Key Product Capabilities

- **Multi-Format Ingestion Engine:** Direct extraction from 6 file formats:
  - **PDF:** Native text layer extraction with bounding boxes; automated OCR fallback via RapidOCR for scanned challans and invoices.
  - **Excel (`.xlsx`, `.xls`):** Sheet extraction, cell formulas (e.g., `=SUM(B2:B12)`), cell comments, and table header inference.
  - **CSV:** Delimiter-resilient parsing, header-to-column positional mapping, and tabular row indexing.
  - **Word (`.docx`):** Paragraph extraction, section header association, and embedded table parsing.
  - **Plain Text (`.txt`):** Structured entity extraction, regex financial pattern scanning, and line offset mapping.
  - **XML / XBRL:** Namespace-aware tag extraction, XPath locators, and currency scale mapping.
  - **JSON:** Key-path locators (e.g., `invoices[2].tax_amount`), schema validation, and structured ingestion.
- **150-Concept Canonical Taxonomy:** Three primary domains:
  - `tax.*`: Direct and indirect tax concepts across GLOBAL, US, UK, EU, and IN jurisdictions (VAT, GST, CGST, SGST, IGST, Retail Sales Tax, Withholding Tax, Transfer Pricing).
  - `fs.*`: Universal financial statement concepts (Income Statement, Balance Sheet, Cash Flow, Revenue, EBITDA, Operating Expenses, Net Income).
  - `cmp.*`: Statutory compliance and reporting standards (E-Invoicing, IRP, GSTR-1, GSTR-3B, Making Tax Digital, One Stop Shop, Country-by-Country Reporting).
- **Fine-Tuned Dual-Encoder (`enc-1.0.0`):** Lightweight, ultra-fast sentence-transformer fine-tuned on financial triplets with hard negatives. Runs completely offline in local environments.
- **Isotonic Calibrator Gate:** Calibrated logistic mapping from cosine similarity to posterior probability $P(\text{match} \mid x)$, guaranteeing statistical confidence bounds for automated processing.
- **Review UI (`/app/review`):** Modern review table with confidence color badges, batch filtering, single-click accept/reject/reassign actions, and deep-link locator jumps.
- **Concept Map Editor (`/app/concepts`):** Visual ontology browser, hierarchy viewer, alias generator, and real-time impact preview that shows which facts in the database will change before saving an alias.
- **Multi-Tab Excel Exporter:** Built with `openpyxl`, generating professional 7-tab workbooks (`Summary`, `Unified`, `Facts`, `Mappings`, `NeedsReview`, `Sources`, `Concepts`) with native Excel formulas and audit comments.
- **Office.js Excel Add-in:** Sideloadable Excel taskpane that allows financial analysts to highlight headers in Excel, normalize them into canonical concepts via Draythos, and pull verified facts directly into spreadsheets.
- **Wispr Flow Visual Design System:** High-contrast editorial aesthetic inspired by Wispr Flow, featuring a warm paper canvas (`#FFFFEB`), deep forest green primary (`#034F46`), soft lavender accents (`#F0D7FF`), ink typography (`#171715`), and pill-shaped interactive controls.

---

## Architecture Overview

Draythos is organized into two primary tiers: **Vhagar** (the Python backend intelligence engine and system of record) and **Eyrie** (the Next.js workspace UI).

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         EYRIE (Next.js 16 Workspace)                   │
│                                                                        │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐  │
│   │ Homepage (10-Step) │ │ Review UI          │ │ Concept Editor    │  │
│   │ /                  │ │ /app/review        │ │ /app/concepts     │  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘  │
│   ┌────────────────────┐ ┌────────────────────┐ ┌───────────────────┐  │
│   │ Chat & Workbench   │ │ Artifact Canvas    │ │ Excel Add-in Pane │  │
│   │ /chat              │ │ Tabbed Preview     │ │ /excel-addin/     │  │
│   └────────────────────┘ └────────────────────┘ └───────────────────┘  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTP Proxy / REST / SSE
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         VHAGAR (Python 3.10+ Backend)                  │
│                                                                        │
│   FastAPI Core Servers:                                                │
│   ├── Port 8000 (UI & Review Server): Facts, Concepts, Export, Metrics │
│   └── Port 8001 (MCP & Translation Server): Ingestion & Tool Router   │
│                                                                        │
│   Core Modules:                                                        │
│   ├── vhagar/components/document_processor.py (Multi-format parsers)   │
│   ├── vhagar/components/facts/service.py (Fact ledger & locators)      │
│   ├── vhagar/components/concept_mapper.py (Classifier & Gate)          │
│   ├── vhagar/models/enc-1.0.0/ (Fine-tuned MiniLM + Calibrator)        │
│   ├── vhagar/components/export/xlsx_writer.py (7-tab Excel builder)   │
│   ├── vhagar/db/repo.py (SQLite WAL System of Record)                  │
│   └── vhagar/components/query_engine.py (Deterministic Arithmetic QA)  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SQLITE SYSTEM OF RECORD                         │
│                           data/draythos.db                             │
│   documents, jobs, concepts, concept_aliases, facts, fact_reviews,     │
│   system_metadata, audit_log, library_documents, document_chunks       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## The Machine Learning Pipeline (enc-1.0.0)

The offline ML pipeline trains, calibrates, and packages the financial encoder under `vhagar/models/enc-1.0.0/`.

### 1. Training Architecture (`ml/train/train_encoder.py`)
- **Base Architecture:** `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense representation).
- **Two-Stage Loss Formulation:**
  1. `MultipleNegativesRankingLoss`: In-batch cross-entropy over paired (anchor, positive) examples.
  2. `TripletLoss`: Margin-based ranking over curated (anchor, positive, hard_negative) tuples with margin $m = 0.3$.
- **Concept-Distinct Batch Sampler:** Batches are sampled to ensure that each concept appears at most once per mini-batch, maximizing the discriminative power of in-batch negatives.
- **Hard Negative Mining:** Negative pairs are curated to resolve confusing financial pairs:
  - Anchor: `"US Retail Sales Tax"` $\rightarrow$ Negative: `"Value Added Tax"`
  - Anchor: `"Gross Revenue"` $\rightarrow$ Negative: `"Net Operating Income"`
  - Anchor: `"Provision for Income Taxes"` $\rightarrow$ Negative: `"Deferred Tax Asset"`

### 2. Isotonic Calibration (`ml/train/train_calibrator.py`)
Raw cosine similarity scores $\cos(\mathbf{u}, \mathbf{v})$ do not represent true probabilities. We train an isotonic logistic regression calibrator:
$$P(\text{match} \mid x) = \sigma(w \cdot \cos(\mathbf{u}, \mathbf{v}) + b)$$
The calibrator parameters are stored in `calibrator.json` and loaded during bootstrap.

### 3. Tri-State Decision Gate
Given a candidate label $x$:
1. Check **User Overrides** (`concept_aliases` where `source = 'user'`): If matched, return immediately with $P = 1.0$ (`user_confirmed`).
2. Check **Curated Dictionary** (`concept_aliases` where `source = 'dictionary'`): If matched, return with $P = 0.95$ (`auto_accepted`).
3. Compute embedding $\mathbf{e}_x = \text{Encoder}(x)$, compute similarities against indexed concept centroids, and evaluate calibrated probability $P$:
   - **$P \ge 0.85$:** `auto_accepted` (System promotes to fact without human intervention).
   - **$0.50 \le P < 0.85$:** `needs_review` (Surfaced in `/app/review` for analyst validation).
   - **$P < 0.50$:** `abstained` (Marked as uncertain; excluded from automated rollups).

---

## The 150-Concept Canonical Taxonomy

The canonical taxonomy is initialized from [`vhagar/db/seed_taxonomy.py`](./vhagar/db/seed_taxonomy.py) and stored in SQLite. It comprises 150 concepts organized into three hierarchies:

### Taxonomy Structure

```text
├── tax (Taxation)
│   ├── tax.consumption (Consumption & Indirect Taxes)
│   │   ├── tax.value_added (VAT & GST - UK, EU, IN, AU)
│   │   │   ├── tax.cgst (Central GST - IN)
│   │   │   ├── tax.sgst (State GST - IN)
│   │   │   └── tax.igst (Integrated GST - IN)
│   │   └── tax.sales_tax (Retail Sales Tax - US)
│   ├── tax.income (Income Taxes)
│   │   ├── tax.corporate_tax (Corporate Income Tax)
│   │   └── tax.withholding (TDS / Withholding Tax)
│   └── tax.transfer_pricing (Transfer Pricing Adjustments)
│
├── fs (Financial Statements)
│   ├── fs.income_statement (P&L Items)
│   │   ├── fs.revenue (Gross & Net Revenue, Turnover, Topline)
│   │   ├── fs.cogs (Cost of Goods Sold / Cost of Sales)
│   │   ├── fs.gross_profit (Gross Profit)
│   │   ├── fs.opex (Operating Expenses)
│   │   ├── fs.ebitda (EBITDA / Operating Profit)
│   │   └── fs.net_income (Net Profit / Profit After Tax)
│   └── fs.balance_sheet (Balance Sheet Items)
│       ├── fs.total_assets (Current & Non-Current Assets)
│       └── fs.working_capital (Net Working Capital)
│
└── cmp (Compliance & Statutory Reporting)
    ├── cmp.einvoicing (E-Invoicing, IRP, IRN, QR Code Validation)
    ├── cmp.gst_returns (GSTR-1 Outward Supplies, GSTR-3B Summary)
    ├── cmp.mtd (Making Tax Digital - UK HMRC)
    ├── cmp.oss (One Stop Shop - EU Cross-Border VAT)
    └── cmp.cbcr (Country-by-Country Reporting - OECD)
```

---

## Interactive User Interface (Eyrie)

Eyrie provides specialized surfaces designed specifically for financial analysts and deal leads:

### 1. Review Table (`/app/review`)
- **Direct Link:** [http://localhost:3000/app/review](http://localhost:3000/app/review)
- **Status Filter Pills:** Toggle between `All`, `Needs Review`, `Auto Accepted`, and `Abstained`.
- **Search & Filter:** Search by raw field label, context heading, or entity name.
- **Deep-Link Locators:** Click any blue locator badge (e.g., `Sheet: P&L, Cell B14` or `Page 4, BBox [32, 114, 520, 140]`) to view the exact source citation.
- **Review Actions:**
  - **Accept:** Confirm model mapping as canonical truth.
  - **Reject:** Reject candidate fact and move to unmapped archive.
  - **Reassign:** Reassign to any canonical concept via dropdown.

### 2. Concept Map Editor (`/app/concepts`)
- **Direct Link:** [http://localhost:3000/app/concepts](http://localhost:3000/app/concepts)
- **Ontology Browser:** Expandable tree view of all 150 concepts with definitions and jurisdiction tags.
- **Alias Management:** View existing synonyms and add custom aliases.
- **Live Impact Preview:** When typing a new alias, Draythos calculates the exact number of unmapped facts in the database that will be reclassified.
- **Instant Recompute & Undo:** Saving an alias triggers real-time fact recomputation across the active session.

### 3. Workbench & Grounded Chat (`/chat`)
- **Direct Link:** [http://localhost:3000/chat](http://localhost:3000/chat)
- **Liquid Dock:** Left sidebar for chat sessions, search, and session renaming.
- **Artifact Canvas:** Split-pane viewer for opening PDFs, reviewing spreadsheet sheets, and inspecting source files side-by-side with analysis.

---

## Wispr Flow Design System & Token Blueprint

The Draythos UI implements the **Wispr Flow Interface Specification**, trading generic dark-mode templates for a warm paper canvas and high-contrast editorial typography.

### 1. Color Palette Tokens

| Token Name | Hex Code | Role |
| :--- | :--- | :--- |
| `--color-brand-paper` | `#FFFFEB` | Warm, tactile paper canvas background |
| `--color-brand-forest` | `#034F46` | Primary brand green (buttons, badges, active accents) |
| `--color-brand-lavender`| `#F0D7FF` | Secondary accent (subtle highlights, status pills) |
| `--color-brand-ink` | `#171715` | Deep editorial ink for primary typography |
| `--neutral-0` | `#FFFFEB` | Lightest canvas tone |
| `--neutral-100` | `#F4F4DE` | Card backgrounds, table headers, hairline borders |
| `--neutral-800` | `#232320` | Secondary headers, high-contrast dark elements |
| `--neutral-900` | `#171715` | Primary headings and high-contrast dark sections |

### 2. Typography Hierarchy

- **Display & Section Headers:** `EB Garamond`, serif, font-weight 500, tight letter spacing.
- **UI & Body Prose:** `Figtree`, sans-serif, font-weight 400 / 500 / 600, high legibility.
- **Code & Tabular Numbers:** `JetBrains Mono`, monospace, tabular alignment for financial figures.

### 3. Component Geometry
- **Pill Buttons:** Full pill border radius (`rounded-full`, 999px), subtle `-1px` vertical lift on hover, and `scale(0.98)` tactile active click depression.
- **Badges:** Soft pill badges with forest green text (`#034F46`) on lavender (`#F0D7FF`) or neutral paper accents.

---

## Consolidated Multi-Tab Excel Export

Located in [`vhagar/components/export/xlsx_writer.py`](./vhagar/components/export/xlsx_writer.py), the export engine generates audit-grade financial workbooks containing 7 synchronized tabs:

1. **`Summary`:** Executive data room dashboard, processing statistics, entity counts, locator validity percentage, and the required regulatory notice.
2. **`Unified`:** Entity $\times$ Period $\times$ Canonical Concept matrix. Contains native Excel `=SUM(...)` aggregation formulas.
3. **`Facts`:** Complete ledger of all extracted facts with values, units, periods, and human-readable locator citations.
4. **`Mappings`:** Active aliases, confidence scores, mapping source rules (`user`, `dictionary`, `model`), and reviewer attribution.
5. **`NeedsReview`:** Filtered list of candidate facts requiring analyst sign-off before audit submission.
6. **`Sources`:** Ingested document inventory, file hashes (SHA-256), page counts, and extraction timestamps.
7. **`Concepts`:** Full canonical taxonomy dictionary for downstream financial modeling reference.

To download the workbook:
```bash
curl -X GET "http://localhost:8000/api/export/xlsx" -o consolidated_financial_model.xlsx
```

---

## Office.js Excel Add-In

The Draythos Excel Add-in connects Microsoft Excel directly to the Vhagar translation engine.

### Capabilities
- **Normalize Selection:** Select any block of unstandardized financial column headers in Excel (e.g., `Turnover`, `Net Sales`, `Revenue from Operations`, `VAT Input`), click **Normalize Selection**, and watch Draythos populate canonical labels, concept IDs, and confidence percentages in adjacent columns.
- **Pull Facts:** Query the Draythos fact ledger directly into active spreadsheet cells.
- **Deep Link to Review:** One-click button to jump from Excel into the Eyrie Review UI.

### Sideloading Instructions
1. The add-in assets are hosted by Next.js at [http://localhost:3000/excel-addin/index.html](http://localhost:3000/excel-addin/index.html).
2. Open Microsoft Excel (Desktop or Web).
3. Go to **Insert** > **My Add-ins** > **Add a Custom Add-in** > **Upload My Add-in**.
4. Select [`excel-addin/manifest.xml`](./excel-addin/manifest.xml).
5. The **Draythos Finance Translator** taskpane will appear in the Home ribbon.

---

## Sample Data Room & Evaluation Benchmarks

Draythos includes a 20-file multi-jurisdiction sample data room and evaluation benchmark suites.

### 1. Sample Data Room (`sample_dataroom/`)
- **Location:** [`sample_dataroom/files/`](./sample_dataroom/files/)
- **Document Roster (20 files across 6 formats):**
  - `doc_01_acme_10k_us.pdf`: SEC Form 10-K excerpt (Revenue, Provision for Income Taxes).
  - `doc_02_bharat_annual_in.pdf`: Indian Annual Report (Turnover, GST, ITC).
  - `doc_03_thames_interim_uk.pdf`: UK Interim Results (Turnover, HMRC VAT).
  - `doc_04_euro_invoice_scan.pdf`: EU B2B Scanned Invoice (Net amount, VAT rate, Gross).
  - `doc_05_tax_challan_scan.pdf`: Indian GST Tax Challan Scan (CGST, SGST payments).
  - `doc_06_acme_pnl_fy24.xlsx`: Multi-tab corporate P&L model with cell formulas.
  - `doc_07_bharat_ledger_in.xlsx`: Trial balance ledger with GST accounting.
  - `doc_08_thames_budget_uk.xlsx`: UK OPEX and capital expenditure budget.
  - `doc_09_entity_reconciliation.csv`: Multi-entity intercompany sales reconciliation.
  - `doc_10_regional_sales.csv`: Monthly sales breakdown across US, UK, and APAC.
  - `doc_11_acme_board_minutes.docx`: Corporate governance minutes containing executive revenue guidance.
  - `doc_12_bharat_directors_report.docx`: Board report discussing statutory tax filings.
  - `doc_13_thames_strategic_review.docx`: UK strategic review discussing EBITDA targets.
  - `doc_14_eu_compliance_memo.docx`: Memo analyzing EU One Stop Shop (OSS) thresholds.
  - `doc_15_audit_findings_memo.docx`: Statutory auditor memo on transfer pricing.
  - `doc_16_company_profile.txt`: Corporate legal entity summary.
  - `doc_17_quarterly_release.txt`: Earnings press release commentary.
  - `doc_18_xbrl_statement.xml`: US GAAP XBRL financial statement instance.
  - `doc_19_financial_schema.json`: ERP chart of accounts schema.
  - `doc_20_invoicing_feed.json`: Transactional ERP billing feed.
- **Gold Benchmark:** 39 verified annotations in [`sample_dataroom/gold.jsonl`](./sample_dataroom/gold.jsonl).
- **Locator Verification:** Evaluated with `python ml/eval/eval_dataroom.py`. Verified **57/57 extracted candidate fields (100.0%)** have valid, verifiable source locators.

### 2. 50-Item Financial Benchmark (`tests/run_benchmark_eval.py`)
50 test queries across 5 critical financial categories:
- `exact_cell_formula_lookup` (15 tests): 15/15 Passed (100.0%)
- `multi_doc_cross_reference` (12 tests): 12/12 Passed (100.0%)
- `ambiguous_disambiguation` (10 tests): 10/10 Passed (100.0%)
- `abstention_no_hallucination` (8 tests): 8/8 Passed (100.0%)
- `tax_jurisdiction_mapping` (5 tests): 5/5 Passed (100.0%)

**Benchmark Results:**
- **Citation Precision:** 100.0%
- **Citation Recall:** 100.0%
- **Answer Correctness:** 100.0%
- **Ambiguity Detection Rate:** 100.0%
- **Correct Abstention Rate:** 100.0%
- **Unsupported Answer Rate:** 0.0%

---

## Repository Layout

```text
Draythos/
├── docs/                               # Formal Specification & Compliance Reports
│   ├── AUDIT.md                        # Complete system and architecture audit
│   ├── EVAL_REPORT.md                  # Comprehensive benchmark evaluation results
│   ├── MODEL_CARD.md                   # enc-1.0.0 model training & card details
│   ├── DATA_LICENSES.md                # Open licenses & source attribution
│   ├── IMPLEMENTATION_CONTRACTS.md     # Invariant contracts & interface specs
│   └── SPEC.md                         # Product specification
│
├── excel-addin/                        # Office.js Add-In Package
│   ├── index.html                      # Taskpane visual interface
│   ├── taskpane.js                     # Excel.run API integration logic
│   ├── manifest.xml                    # Microsoft Office sideloading manifest
│   └── README.md                       # Sideloading walkthrough
│
├── frontend/                           # Eyrie Next.js 16 Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Wispr Flow 10-step homepage
│   │   │   ├── globals.css             # Brand tokens (#FFFFEB, #034F46, #F0D7FF)
│   │   │   ├── app/
│   │   │   │   ├── review/page.tsx     # Review UI with deep-link locator jumps
│   │   │   │   ├── concepts/page.tsx   # Concept Map Editor with impact preview
│   │   │   │   └── dashboard/page.tsx  # Workspace shell
│   │   │   ├── chat/page.tsx           # Chat & workbench workspace
│   │   │   └── api/                    # Next.js API routing proxies
│   │   └── components/
│   │       ├── ui/                     # Pill buttons, badges, inputs
│   │       ├── eyrie/                  # Liquid dock, navigation
│   │       └── dashboard/              # Chat workspace, artifacts pane
│   └── public/
│       └── excel-addin/                # Static taskpane distribution
│
├── ml/                                 # Machine Learning Track
│   ├── train/
│   │   ├── train_encoder.py            # Contrastive dual-encoder trainer
│   │   └── train_calibrator.py         # Isotonic logistic gate calibrator
│   └── eval/
│       └── eval_dataroom.py            # Sample data room evaluator
│
├── sample_dataroom/                    # 20-File Financial Test Data Room
│   ├── files/                          # 20 files across PDF, XLSX, CSV, DOCX, TXT, XML, JSON
│   ├── generate_dataroom.py            # Deterministic data room generator
│   └── gold.jsonl                      # 39 gold annotation truths
│
├── tests/                              # Rigorous Verification & Pytest Suite
│   ├── run_benchmark_eval.py           # 50-item financial benchmark runner
│   ├── test_translation_pipeline.py    # Facts, Gate, Invariant tests
│   ├── test_standalone.py              # Self-contained integration verification
│   ├── test_auth_isolation_matrix.py   # Multi-tenant security boundaries
│   └── benchmark_eval_results.json     # Saved benchmark run artifacts
│
├── vhagar/                             # Backend Intelligence & Translation Core
│   ├── __main__.py                     # python -m vhagar CLI entrypoint
│   ├── api/                            # FastAPI Route Definitions
│   │   ├── facts.py                    # /api/facts & /api/facts/{id}/review
│   │   ├── concepts.py                 # /api/concepts & /api/concepts/tree
│   │   ├── mappings.py                 # /api/mappings (aliases)
│   │   ├── normalize.py                # /api/normalize (Decision Gate)
│   │   ├── export.py                   # /api/export/xlsx & /api/export/csv
│   │   └── qa.py                       # /api/qa/plan & /api/qa/verify
│   ├── components/
│   │   ├── document_processor.py       # Multi-format parsers & OCR
│   │   ├── facts/                      # Facts ledger & locator service
│   │   ├── concept_mapper.py           # Classifier, dictionary & gate
│   │   ├── export/
│   │   │   └── xlsx_writer.py          # Consolidated 7-tab openpyxl writer
│   │   └── query_engine.py             # Deterministic Python arithmetic QA
│   ├── models/
│   │   └── enc-1.0.0/                  # Packaged weights, calibrator, thresholds
│   ├── mcp_server.py                   # MCP Server (Port 8001)
│   ├── ui/app.py                       # UI FastAPI Server (Port 8000)
│   └── database.py                     # DatabaseManager session engine
│
├── README.md                           # This Master Specification Document
├── requirements.txt                    # Python dependencies
└── package.json                        # Root package manifest
```

---

## Database Schema & System of Record

The persistent state is maintained in SQLite at `data/draythos.db` with `WAL` mode enabled.

```sql
-- Core Translation Tables
CREATE TABLE documents (
    doc_id TEXT PRIMARY KEY,
    id TEXT,
    filename TEXT NOT NULL,
    format TEXT NOT NULL,
    sha256 TEXT,
    status TEXT DEFAULT 'completed',
    entity TEXT,
    jurisdiction TEXT DEFAULT 'GLOBAL',
    page_count INTEGER DEFAULT 1,
    file_path TEXT,
    session_id TEXT,
    user_id TEXT,
    size INTEGER DEFAULT 0,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE concepts (
    concept_id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    definition TEXT NOT NULL,
    parent_id TEXT,
    kind TEXT NOT NULL, -- 'tax' | 'fs' | 'cmp'
    jurisdiction TEXT DEFAULT 'GLOBAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_id) REFERENCES concepts(concept_id)
);

CREATE TABLE concept_aliases (
    alias_id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL,
    alias TEXT NOT NULL,
    alias_key TEXT NOT NULL,
    source TEXT DEFAULT 'dictionary', -- 'user' | 'dictionary' | 'model'
    confidence REAL DEFAULT 1.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(concept_id) REFERENCES concepts(concept_id)
);

CREATE TABLE facts (
    fact_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    entity TEXT,
    jurisdiction TEXT DEFAULT 'GLOBAL',
    raw_label TEXT NOT NULL,
    label_key TEXT NOT NULL,
    context_heading TEXT,
    concept_id TEXT,
    concept_label TEXT,
    parent_id TEXT,
    match_method TEXT, -- 'user_alias' | 'dictionary' | 'model' | 'manual'
    similarity REAL DEFAULT 0.0,
    confidence REAL DEFAULT 0.0,
    state TEXT DEFAULT 'abstained', -- 'auto_accepted' | 'needs_review' | 'abstained' | 'user_confirmed' | 'rejected'
    candidates TEXT DEFAULT '[]',
    value_raw TEXT,
    value_num REAL,
    unit TEXT,
    scale REAL DEFAULT 1.0,
    period TEXT DEFAULT '{}',
    locator TEXT NOT NULL, -- JSON SourceLocator
    extraction_method TEXT DEFAULT 'native',
    extraction_confidence REAL DEFAULT 1.0,
    taxonomy_version TEXT DEFAULT 'tax-1.0.0',
    model_version TEXT DEFAULT 'enc-1.0.0',
    mapping_version INTEGER DEFAULT 1,
    reviewed_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(doc_id) REFERENCES documents(doc_id),
    FOREIGN KEY(concept_id) REFERENCES concepts(concept_id)
);

CREATE TABLE fact_reviews (
    review_id TEXT PRIMARY KEY,
    fact_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'accept' | 'reject' | 'reassign'
    old_concept_id TEXT,
    new_concept_id TEXT,
    by TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fact_id) REFERENCES facts(fact_id)
);
```

---

## API Endpoints & Routing Surface

### Vhagar UI & Metrics Server (Port 8000)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check endpoint |
| `GET` | `/metrics` | Prometheus observability metrics |
| `GET` | `/api/concepts` | List all canonical concepts and definitions |
| `GET` | `/api/concepts/tree` | Hierarchical taxonomy tree (`tax`, `fs`, `cmp`) |
| `GET` | `/api/concepts/{id}/aliases` | List synonyms and aliases for a concept |
| `GET` | `/api/facts` | Query fact ledger (supports `state`, `doc_id`, `concept_id`) |
| `GET` | `/api/facts/{id}` | Retrieve specific fact with complete `SourceLocator` |
| `POST` | `/api/facts/ingest` | Trigger candidate field extraction on a document |
| `POST` | `/api/facts/{id}/review` | Submit human review (`accept`, `reject`, `reassign`) |
| `POST` | `/api/normalize` | Evaluate candidate text through decision gate |
| `GET` | `/api/export/xlsx` | Stream 7-tab consolidated Excel workbook |
| `GET` | `/api/export/csv` | Export verified facts table as CSV |
| `POST` | `/api/qa/plan` | Generate deterministic computation plan for QA |
| `POST` | `/api/qa/verify` | Execute arithmetic plan against SQLite facts |

### Vhagar MCP & Translation Server (Port 8001)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | MCP Server health check |
| `POST` | `/upload` | Multipart file upload and automated ingestion |
| `GET` | `/sessions/{id}` | Session metadata and document attachments |
| `GET` | `/documents/{id}/file` | Fetch source document binary with streaming |
| `GET` | `/documents/{id}/content` | Fetch structured extracted document text |

---

## Environment Variables & Configuration

### Backend Configuration (`vhagar/config.py` & `.env`)
```bash
# Vhagar Server Configuration
VHAGAR_HOST="0.0.0.0"
VHAGAR_UI_PORT=8000
VHAGAR_MCP_PORT=8001
VHAGAR_DB_PATH="data/draythos.db"

# Offline ML Configuration
HF_HUB_OFFLINE=1
TRANSFORMERS_OFFLINE=1
PYTHONUNBUFFERED=1

# Decision Gate Thresholds
VHAGAR_SIMILARITY_THRESHOLD=0.72
VHAGAR_GATE_CONFIDENCE_THRESHOLD=0.85
VHAGAR_ABSTAIN_THRESHOLD=0.50

# Security Secrets
VHAGAR_AUTH_SECRET="your-256-bit-secret"
VHAGAR_MCP_API_KEY="your-mcp-access-key"
```

### Frontend Configuration (`frontend/.env.local`)
```bash
# Backend Proxies
VHAGAR_API_URL="http://localhost:8001"
NEXT_PUBLIC_VHAGAR_UI_URL="http://localhost:8000"

# Optional Model Keys (for chat synthesis)
OPENROUTER_API_KEY="your_openrouter_key"
OPENROUTER_MODEL="openai/gpt-4o"
GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL="gemini-2.0-flash"
```

---

## Local Development & Setup Guide

### 1. Prerequisites
- **Python:** 3.10, 3.11, 3.12, or 3.14
- **Node.js:** 18.x or 20.x+
- **Git**

### 2. Clone Repository & Setup Virtual Environment
```powershell
# In PowerShell (Windows)
git clone https://github.com/draythos/draythos.git
cd draythos

# Create and activate Python virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install Python requirements
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

### 4. Launch the Draythos Services

#### Terminal 1: Backend Intelligence Engine (Vhagar)
```powershell
$env:PYTHONPATH = "."
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:PYTHONUNBUFFERED = "1"
python -m vhagar
```
*Vhagar UI will listen on port 8000; MCP server will listen on port 8001.*

#### Terminal 2: Workspace Frontend (Eyrie)
```powershell
cd frontend
npm run dev
```
*Eyrie UI will be available at [http://localhost:3000](http://localhost:3000).*

---

## Test & Benchmark Execution Guide

All test suites run in offline mode with zero remote API dependencies.

### 1. Run Unit & Translation Pipeline Tests (Pytest)
```powershell
$env:PYTHONPATH = "."
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
pytest tests/test_translation_pipeline.py tests/test_standalone.py -v
```

### 2. Run the 50-Item Financial Benchmark
```powershell
$env:PYTHONPATH = "."
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
python tests/run_benchmark_eval.py
```

### 3. Run Sample Data Room Evaluation
```powershell
$env:PYTHONPATH = "."
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
python ml/eval/eval_dataroom.py
```

### 4. Verify TypeScript Types
```powershell
npx tsc -p frontend/tsconfig.json --noEmit
```

---

## Troubleshooting & Known Caveats

### 1. Windows IOCP / Asyncio Socket Interception
On Windows, running tests or servers containing `asyncio.run(...)` inside certain sandbox environments can block on the `ProactorEventLoop`. Always run the backend server in normal execution mode (`BypassSandbox: true` if using an agent runner).

### 2. Offline HuggingFace Mode
Ensure `$env:HF_HUB_OFFLINE = "1"` is set in your environment before starting Python processes. This prevents `sentence-transformers` from attempting to connect to external endpoints when loading `vhagar/models/enc-1.0.0/`.

### 3. Database Column Harmonization
If updating an older installation of Draythos, run the migration check once to ensure that legacy `documents` tables possess both `doc_id` and `id`, as well as `uploaded_at` and `created_at`:
```powershell
python -c "from vhagar.database import DatabaseManager; from vhagar.db.repo import DraythosRepository; DatabaseManager(); DraythosRepository(); print('Migration complete!')"
```

---

## Security, Governance & Data Licenses

- **Data Isolation:** User sessions and persistent library folders are isolated by `user_id`. Chunks and facts cannot leak across tenant boundaries.
- **Audit Trails:** All human reviews, manual alias additions, and concept reassignments are recorded with timestamps, user IDs, and rationale in the `fact_reviews` table.
- **Data Licensing:**
  - All financial benchmark templates and data room fixtures are synthetic or derived from public SEC / HMRC / CBIC disclosure guidelines under open regulatory reporting allowances.
  - See [`docs/DATA_LICENSES.md`](./docs/DATA_LICENSES.md) for complete attributions and compliance details.

---

## Glossary

- **Canonical Concept:** A standardized semantic node (e.g., `tax.value_added` or `fs.revenue`) in the Draythos taxonomy representing a functional accounting or tax concept across jurisdictions.
- **Candidate Field:** A raw text or numerical element parsed from a source file before semantic classification.
- **Fact:** A candidate field that has been mapped to a canonical concept and anchored to a persistent `SourceLocator`.
- **SourceLocator:** A cryptographic and structural coordinate identifying the exact page, bounding box, sheet, cell, row, or XPath where a number originates.
- **Decision Gate:** The tri-state classification layer that determines whether a mapped fact is `auto_accepted`, requires human review (`needs_review`), or must be `abstained`.
- **Isotonic Calibrator:** A non-parametric monotonic logistic mapping that transforms raw vector cosine similarity scores into statistically reliable probabilities.
- **Wispr Flow Tokens:** The design tokens (`#FFFFEB` paper, `#034F46` forest, `#F0D7FF` lavender, `#171715` ink) governing the user interface.
