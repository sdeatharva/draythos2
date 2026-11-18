# Draythos — Master Build Specification

*Finance Concept Translator: realigning the project to the original problem statement while preserving Milestones 1 and 2*

Based on: the original hackathon problem statement, the current README, and the Milestone 1 and Milestone 1+2 reports. Version 1.0.

## 0. How to use this document

- **Sections 1–3** explain what drifted and the decisions taken. **Sections 4–16** are the build specification. **Sections 17–23** cover testing, plan, audit, traceability, rules and the demo.
- Priorities: **P0** = required for the demo and the professor's milestones, **P1** = should have, **P2** = optional/stretch.
- **Important limitation:** I could only read the README and the two milestone reports, not the code. Everything stated about the current state comes from the README. Section 19 (Phase 0 audit) makes the developer verify it before building. Where the README and the milestones disagree, Section 3 gives a ruling.
- **MUST / MUST NOT** are hard requirements. Do not skip them.

## 1. Executive summary

**What the original problem asks for:** an agent that understands the *idea* behind financial words (GST vs VAT, Turnover vs Revenue) and returns **clean, consistent fields with sources**, working on a **mixed data room**, usable in **Excel**, with a **simple review UI** (source links, quick export), measured on **accuracy**. The boundary-push: a user edits a synonym or concept-map entry, answers adapt, and after adding a new document a follow-up question reflects the change.

**How the project drifted:** the README describes a strong *document workspace*: chat over uploaded files, artifact canvas, spreadsheet/PDF editing and download, provider-backed answers. The *output the problem actually wants* (a unified table of canonical fields, each with a source link, reviewable and exportable) is not described anywhere in it. The fine-tuned encoder, taxonomy, calibrated abstention and evaluation that Milestones 1–2 promise are also not mentioned in the README at all.

**The fix, in three moves:**

1. **Keep everything that exists** (Vhagar, Eyrie, hybrid index, OCR, artifact canvas, concept memory, streaming chat). Nothing is deleted.
2. **Add the missing spine:** *document → candidate fields → canonical concept → fact with source locator → unified table → review → export / Q&A.*
3. **Make the Milestone 1–2 model the engine of the concept step:** a fine-tuned MiniLM encoder + calibrated gate + dictionary, trained and evaluated exactly as the milestones describe, with a user-override layer on top for the live-edit demo.

**What to freeze:** new work on chat-driven editing of PDF/DOCX and cosmetic artifact work. These were the main source of drift. Keep the spreadsheet working-copy path only because the export feature needs it.

## 2. Gap analysis: original requirement vs. today vs. milestones

| # | Original requirement | README today | Milestone promise | Action |
| --- | --- | --- | --- | --- |
| 1 | Understand the idea behind words | Alias dictionary + concept memory (string-level) | Fine-tuned MiniLM, two-stage contrastive training, calibrated abstention | **Build the ML track and wire it in as the normalizer** |
| 2 | Clean, consistent fields **with sources** | Chat answers with snippets; no canonical field schema | Concept memory links with source location | **Build field extraction and a `facts` store with precise locators** |
| 3 | Mixed data room, varied layouts | Many formats; spreadsheets/PDF stronger, DOCX partial | 20-file integration set | **Per-format extractors that output fields, plus a sample data room with gold labels** |
| 4 | "Unified Excel for processing" | "Unified Excel processor" = parse/preview/edit one workbook | — | **Redefine: one consolidated canonical workbook across all documents, plus an Excel add-in** |
| 5 | Q&A bot | Streaming chat via OpenRouter/Gemini | Source-grounded answers | **Make Q&A structured-first (query the facts), cite fact and source, verify numbers** |
| 6 | Review UI, source links, quick export | Artifact canvas; legacy mapping endpoints | Review states (proposed/accepted/rejected) | **Build Review page, deep-linked sources, one-click export** |
| 7 | Accuracy | Nothing measured | Recall@k, MRR, ARI/NMI, precision-coverage | **Gold-annotated data room + evaluation harness + report** |
| 8 | Edit a synonym, answers adapt; add doc + follow-up | `POST/DELETE /api/mappings`, SSE stream exist | — | **User-override layer, impact preview, incremental recompute, scripted demo** |
| 9 | Pathway (optional) | None | — | **Index adapter interface; Pathway backend as P2** |

## 3. Reconciliation rulings (README vs. Milestones)

The milestones are already submitted, so the system must be able to demonstrate what they claim. Where the README conflicts, the ruling is below.

| Topic | README | Milestones | Ruling |
| --- | --- | --- | --- |
| Persistence | JSON files (e.g., concept memory JSON) | SQLite initially | **SQLite is the system of record** for taxonomy, aliases, facts, links, audit. Import existing JSON on first run. Keep JSON export. |
| OCR | `rapidocr_onnxruntime` | Tesseract fallback | Config key `ocr.backend`: `rapidocr` (default) or `tesseract` (adapter). State in the final report which one was actually used. |
| Concept memory fields | names, keywords, meaning, context, provenance, counts | proposed/accepted/rejected link, source location, similarity, calibrated score, taxonomy version, model version | **Extend** the schema to the union. Migrate old records with `state=legacy`. |
| Concept inference | Dictionary + fuzzy threshold (`VHAGAR_FUZZY_THRESHOLD`) | Dictionary baseline + fine-tuned encoder + calibrated gate | **Router (Section 9).** Dictionary stays as baseline and conflict check. `VHAGAR_CONFIDENCE_THRESHOLD` is fed from the calibrator output. |
| Embedding spaces | One hybrid index (dense + lexical) | Document chunks use the **unchanged base encoder**; fine-tuned encoder only for the concept index | **MUST keep two separate spaces.** Never compare vectors from different checkpoints. Enforce with version checks. |
| Frontend | Next.js 16, React 19, TypeScript | React + TypeScript | Consistent. No change. |
| Frontend-facing API | UI backend on 8000, MCP server on 8001, frontend defaults to 8001 | FastAPI | All new endpoints go on **whichever FastAPI app the frontend proxies to** (Phase 0 confirms). Single-process mode MUST serve every endpoint the frontend needs. |
| LLM use | OpenRouter (`openai/gpt-5.4`) then Gemini fallback | LLM fallback is optional, outside the core evaluation | Keep. LLM is used for (a) answer synthesis, (b) extraction from unstructured text and scans, (c) optional low-confidence disambiguation. **LLM output is never a gold label or training label.** |
| "Unified Excel" | Single workbook preview/edit | Not defined | **Unified Excel = consolidated canonical output workbook** (Section 14). |
| VAT/GST | Alias relationship | Equivalence policy: equivalent / related / different; not legally identical | Concepts are defined at a **functional** level (Section 7.2): VAT and GST map to one concept, with jurisdiction labels as metadata and a visible caveat. US sales tax is a *different* concept under the same parent. |

## 4. Target product behavior

### 4.1 End-to-end user journey

1. User opens Eyrie and uploads a **data room** (any mix of PDF, XLSX/XLS, CSV, DOCX, TXT, JSON, XML, scanned PDFs).
2. Vhagar ingests each file as a background job (status visible in UI): parse, OCR when needed, chunk, index.
3. An extractor emits **candidate fields**: a label, a value, unit/scale, period, entity, and an exact source locator.
4. The **normalizer** maps each label to a canonical concept with top-5 candidates, similarity, calibrated confidence and a state (accepted / review / abstained / conflict).
5. Fields are saved as **facts** in a unified table.
6. The user opens the **Review page**: a grid of facts with canonical concept, original wording, value, period, confidence, and a **source link** that opens the file at the exact page/cell, highlighted. They accept, reject or reassign.
7. The user asks questions in the **Q&A bot**. The answer cites fact IDs and source links. Numbers come from facts, never from model memory.
8. The user clicks **Export** and gets a consolidated Excel workbook (also CSV/JSON) with sources.
9. **Live edit:** the user adds or changes a synonym/mapping in the Concept Map editor. They see an impact preview, apply it, and the grid and subsequent answers update immediately.
10. The user uploads a **new document** and asks a follow-up. The new document is normalized with the edited map, and the answer reflects both.

### 4.2 The output record (Fact)

Every extracted field MUST be stored in this shape. A fact without a locator MUST NOT be saved.

```json
{
  "fact_id": "f_01H...",
  "doc_id": "d_...",
  "entity": "Acme Ltd",
  "jurisdiction": "IN",
  "raw_label": "Turnover",
  "label_key": "turnover",
  "context_heading": "Statement of Profit and Loss",
  "concept_id": "fs.revenue",
  "concept_label": "Revenue",
  "parent_id": "fs.income_statement",
  "match_method": "override|dictionary|model|llm_assist|manual",
  "similarity": 0.81,
  "confidence": 0.93,
  "state": "auto_accepted|needs_review|abstained|conflict|user_confirmed|rejected",
  "candidates": [{"concept_id": "fs.revenue", "score": 0.81}],
  "value_raw": "1,23,45,000",
  "value_num": 12345000,
  "unit": "INR",
  "scale": 1,
  "period": {"label": "FY2024", "start": "2023-04-01", "end": "2024-03-31", "type": "fiscal_year"},
  "locator": {"type": "xlsx", "doc_id": "d_...", "sheet": "P&L", "cell": "C7", "quote": "Turnover | 1,23,45,000"},
  "extraction_method": "native_table|native_text|ocr|llm_vision|llm_text|xbrl",
  "extraction_confidence": 0.97,
  "taxonomy_version": "tax-1.0.0",
  "model_version": "enc-1.0.0",
  "mapping_version": 42,
  "reviewed_by": null,
  "created_at": "..."
}
```

Locator formats (each MUST be openable in the artifact canvas):

| Format | Locator fields |
| --- | --- |
| PDF | `page`, `bbox` [x0,y0,x1,y1], `quote` |
| XLSX / XLS | `sheet`, `cell` (or `range`), `quote` |
| CSV | `row`, `col`, `quote` |
| DOCX | `para_index` or (`table_index`, `row`, `col`), `quote` |
| JSON | `json_path` |
| XML | `xpath` |
| TXT | `line`, `char_start`, `char_end` |

## 5. Architecture

```text
Eyrie (Next.js)
  Dashboard chat | Review page | Concept Map editor | Artifact canvas | Export
        |  (Next.js API routes proxy to Vhagar; chat orchestration stays here)
        v
Vhagar (FastAPI)
  Ingestion jobs -> Document processor (parse, OCR) -> Field extractor
                                      |                       |
                                      v                       v
                              Chunk store + Hybrid index   Normalization engine
                              (BM25 + base-encoder dense,  [override -> dictionary -> encoder -> calibrator -> router]
                               RRF)                                |
                                      |                            v
                                      |                   Facts store (SQLite)  <->  Concept memory (hidden)
                                      |                            |
                                      v                            v
                              Query engine  <--------------  Q&A orchestrator (structured-first)
                                                                   |
                                                          Export service (xlsx/csv/json)

Offline ML track (ml/): taxonomy -> dataset -> stage-1 MNRL -> hard negatives -> stage-2 triplet
      -> calibration -> frozen-test evaluation -> versioned model bundle -> loaded by Vhagar
```

**Design principles (follow them when in doubt):**

1. **Structured first, text second.** Facts answer the question; retrieved text supports it.
2. **Every number has a source.** No locator, no fact.
3. **Abstain over guess.** A wrong confident mapping is worse than a review flag.
4. **Humans override machines, immediately and reversibly.** Every override is logged and undoable.
5. **Everything is versioned** (taxonomy, model, mapping). Facts remember which versions produced them.
6. **Feature flags for every new capability**, so the existing system never breaks. Flags: `NORMALIZER_MODE=dictionary|base|finetuned`, `EXTRACTION_LLM=on|off`, `INDEX_BACKEND=native|pathway`.

## 6. Repository structure

Legend: `=` already exists per README (do not rewrite, extend), `+` new, `~` modify.

```
finbud/
|- vhagar/                                  =
|  |- mcp_server.py                         ~  mount new routers
|  |- bootstrap.py                          ~  load model bundle, seed taxonomy, init DB
|  |- config.py / config.yaml               ~  add ocr.backend, normalizer.*, export.*
|  |- db/                                   +
|  |  |- schema.sql, migrations/            +  SQLite schema + versioned migrations
|  |  |- repo.py                            +  data-access layer
|  |  `- import_legacy.py                   +  import existing concept-memory JSON
|  |- components/
|  |  |- document_processor.py              ~  expose structure (tables, headings, coordinates)
|  |  |- hybrid_index.py                    ~  put behind IndexBackend interface
|  |  |- query_engine.py                    ~  consume concept IDs, not only strings
|  |  |- concept_mapper.py                  ~  becomes taxonomy + alias store backed by SQLite
|  |  |- concept_memory.py                  ~  extended schema (Section 7)
|  |  |- excel_processor.py                 ~  header/table region detection
|  |  |- extraction/                        +
|  |  |  |- base.py, pdf_extractor.py, xlsx_extractor.py, csv_extractor.py
|  |  |  |- docx_extractor.py, json_xml_extractor.py, text_extractor.py
|  |  |  |- llm_extractor.py                +  schema-constrained, quote-verified
|  |  |  |- numbers.py                      +  parsing (lakh/crore, brackets, scale)
|  |  |  |- periods.py                      +  FY/quarter/date normalization
|  |  |  `- locators.py                     +  build/resolve source locators
|  |  |- normalization/                     +
|  |  |  |- dictionary.py                   +  normalized-key alias lookup
|  |  |  |- encoder.py                      +  load bundle, embed, version check
|  |  |  |- concept_index.py                +  exact cosine top-k over prototypes
|  |  |  |- calibrator.py                   +  logistic gate (s1, s1-s2)
|  |  |  |- router.py                       +  override/dictionary/model/conflict logic
|  |  |  `- overrides.py                    +  user override layer + impact analysis
|  |  |- facts/                             +
|  |  |  |- service.py                      +  create/query/review facts, recompute
|  |  |  `- unify.py                        +  pivot + reconciliation for export
|  |  |- qa/                                +
|  |  |  |- planner.py, answerer.py, verifier.py
|  |  `- export/                            +
|  |     `- xlsx_writer.py, csv_writer.py, json_writer.py
|  |- api/                                  +  routers: documents, facts, concepts, mappings, normalize, qa, export, jobs
|  `- models/                               +  versioned bundles (git-ignored, with manifest.json)
|- ml/                                      +  OFFLINE training track (Milestone 2)
|  |- data/ taxonomy/*.jsonl, variants/*.jsonl, negatives/*.jsonl, splits/*.json, DATACARD.md
|  |- scripts/ build_taxonomy.py, ingest_glossaries.py, make_splits.py, augment.py,
|  |            mine_negatives.py, export_review_csv.py, validate_dataset.py
|  |- train/ stage1_mnrl.py, stage2_triplet.py, sampler.py (concept-distinct)
|  |- calibrate/ fit_calibrator.py
|  |- eval/ baselines.py, retrieval_metrics.py, clustering.py, abstention.py,
|  |         cross_jurisdiction.py, bootstrap_ci.py, latency_bench.py, report.py
|  |- configs/ stage1.yaml, stage2.yaml, split.yaml
|  |- runs/ (logs, metrics, manifests per run)
|  `- notebooks/ train_colab.ipynb
|- sample_dataroom/                         +  20 public/synthetic files + gold.jsonl (Section 17)
|- frontend/                                =
|  `- src/
|     |- app/app/review/page.tsx            +  Review UI
|     |- app/app/concepts/page.tsx          +  Concept Map editor
|     |- app/api/facts|concepts|mappings|export|normalize/...   +  proxy routes
|     |- components/review/ (FactsGrid, SourceLink, ConfidenceBadge, ReviewActions, ExportMenu)  +
|     |- components/concepts/ (ConceptTable, AliasEditor, ImpactPreview, ChangeLog)              +
|     |- components/dashboard/artifacts-pane.tsx  ~  deep-link to locator + highlight
|     `- app/api/chat/stream/route.ts       ~  structured-first evidence + citations
|- excel-addin/                             +  Office.js task pane + custom functions (P1)
|- tests/                                   =  add suites listed in Section 17
`- docs/                                    +  SPEC.md (this), DATA_LICENSES.md, MODEL_CARD.md, EVAL_REPORT.md
```

## 7. Data model

### 7.1 SQLite tables (system of record)

| Table | Purpose | Key columns |
| --- | --- | --- |
| `documents` | Uploaded files | doc_id, filename, format, sha256, status, entity, jurisdiction, uploaded_at, page_count |
| `jobs` | Async ingestion | job_id, doc_id, stage, status, error, started_at, finished_at |
| `concepts` | Canonical taxonomy | concept_id, label, definition, parent_id, kind (`tax` \| `fs` \| `cmp`), jurisdiction, created_at |
| `aliases` | All surface forms | alias_id, alias, alias_key, concept_id, source (`glossary` \| `model` \| `user_override`), relation (`equivalent` \| `related` \| `different`), priority, created_at |
| `facts` | Unified table | all fields of Section 4.2 |
| `fact_reviews` | Review audit | fact_id, action, old_concept, new_concept, by, at, note |
| `mapping_log` | Every user edit | log_id, op (`add` \| `edit` \| `delete`), alias, old_concept, new_concept, by, at, reason |
| `concept_links` | Extended concept memory | link_id, term, concept_id, state (`proposed` \| `accepted` \| `rejected`), similarity, confidence, locator, doc_id, taxonomy_version, model_version, created_at |
| `model_registry` | Deployed bundles | model_version, path, base_model, sha256, threshold, calibrator_params, created_at, active |
| `eval_runs` | Stored metrics | run_id, system (S0–S3), metrics_json, split, seed, at |

Rules: `alias_key` = lowercase + Unicode NFKC + collapsed whitespace (the lookup key only; `alias` keeps the original string). `mapping_version` is a monotonically increasing integer bumped on every accepted mapping change.

### 7.2 Taxonomy design (milestone O1: 150 concepts)

- **Three families:** `tax.*` (VAT/GST, sales tax, withholding/TDS, capital gains, corporate income tax, customs duty, excise, stamp duty, payroll tax, tax credit/ITC, tax return, etc.), `fs.*` (revenue/turnover, COGS, gross profit, operating profit/EBIT, EBITDA, PBT, PAT/net income, EPS, total assets, current assets/liabilities, equity, retained earnings, depreciation, amortization, borrowings, cash flow lines), `cmp.*` (invoice, e-invoice, filing, audit, KYC, disclosure, penalty and similar).
- **Granularity rule:** two expressions share a `concept_id` only if they denote the same *functional* concept. Example: VAT (UK/EU) and GST (IN, AU) → one concept `tax.value_added` (multi-stage consumption tax with input credit). US sales tax → separate `tax.sales_tax` (single-stage). Both sit under parent `tax.consumption`. Parents and legally distinct regimes MUST NOT share an ID.
- **Relation labels** on every variant: `equivalent`, `related`, `different`. Only `equivalent` becomes a positive pair.
- **Ambiguous abbreviations** (for example "CT", "ST") require context or the label `abstain`.
- Jurisdictions in scope: US, UK, IN, EU (per Milestone 2). English only.
- UI MUST show the caveat: *"Terminology normalization, not a legal determination."*

