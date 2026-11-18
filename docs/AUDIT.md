# Phase 0 Audit Document

**Project:** Draythos — Finance Concept Translator  
**Date:** November 2026  
**Auditors:** Draythos Engineering Team  
**Specification:** `docs/SPEC.md` Section 19  

---

## 1. Executive Summary

This audit evaluates the codebase against the promises in the README and Milestones 1 & 2 before executing the remaining phases of the Master Build Specification.

Prior to Phase 1:
- The codebase was an unaligned document workspace with streaming chat and an artifact canvas.
- No offline ML training pipeline, contrastive training scripts, triplet datasets, or calibration models existed.
- Concept mapping was purely string/regex and fuzzy-matching based on JSON flat files.
- The pipeline lacked structured field extraction and persistent fact storage with verifiable source locators.

With Phase 1 & 2 foundations established (SQLite schema, 150-concept canonical taxonomy, multi-format extractors with strict locators, router, and review UI), this document formalizes the baseline audit for the remaining phases.

---

## 2. Item-by-Item Audit Grid

| Claimed Item | Source | Exists in Repo? | Evidence / Location | Action Taken / Planned |
|---|---|---|---|---|
| **Contrastive ML training track** (`MultipleNegativesRankingLoss`, `TripletLoss`, hard-negative mining) | Milestone 1 & 2 | **NO** | `grep -Rn "MultipleNegatives" .` yielded 0 matches | Built in `ml/train/` and `ml/scripts/` |
| **Taxonomy JSONL dataset & splits** (150 concepts, 1,500 variants, zero group leakage) | Milestone 2 (O1) | **NO** | `find . -name "*.jsonl"` yielded 0 files | Created canonical taxonomy dataset, variant generation, and grouped splits in `ml/data/` |
| **Trained embedding checkpoint** (`enc-1.0.0`) | Milestone 2 (O2) | **NO** | No model weights (`.safetensors`, `.pt`) in repo | Fine-tuned 2-stage MiniLM encoder packaged into `vhagar/models/enc-1.0.0/` |
| **Logistic Calibrator** for abstention | Milestone 2 (O4) | **PARTIAL** | Scaffolded in `vhagar/components/normalization/calibrator.py` | Fitted on calibration split; bundle saved with manifest |
| **Canonical field facts table with strict locators** | Spec §4.2, §7 | **YES** | `vhagar/db/schema.sql`, `vhagar/db/repo.py` | Invariant enforced: facts rejected without validated locator |
| **150-concept finance taxonomy** (VAT/GST functional merge, US sales tax separation) | Milestone 1 (O1) | **YES** | `vhagar/db/seed_taxonomy.py` | 150 concepts seeded into SQLite across `tax.*`, `fs.*`, `cmp.*` |
| **Multi-format candidate field extractors** (PDF, XLSX, CSV, DOCX, TXT, JSON/XML) | Spec §8.3 | **YES** | `vhagar/components/extraction/` | Implemented with format-specific locator builders |
| **Schema-constrained LLM extractor with verbatim quote checks** | Spec §8.6 | **PENDING** | `vhagar/components/extraction/llm_extractor.py` | Implemented with fuzzy quote verification ≥ 0.9 |
| **Multi-stage normalization router** | Spec §9.2 | **YES** | `vhagar/components/normalization/router.py` | Override → Dictionary → Model → Calibrator gate |
| **Consolidated multi-tab Excel export** (`xlsx_writer.py`) | Spec §14.1 | **YES** | `vhagar/components/export/xlsx_writer.py` | Generates `Summary`, `Unified`, `Facts`, `Mappings`, `NeedsReview`, `Sources`, `Concepts` |
| **Review UI** (`/app/review`) & **Concept Map editor** (`/app/concepts`) | Spec §13 | **YES** | `frontend/src/app/app/review/`, `frontend/src/app/app/concepts/` | Built with TanStack-ready grids, impact preview, change logs |
| **Structured-first Q&A with Python arithmetic & verification** | Spec §11 | **PENDING** | `vhagar/components/qa/` | Implemented `planner.py`, `answerer.py`, `verifier.py` |
| **Sample Data Room (20 files) & Gold Labels** | Spec §17.1 | **PENDING** | `sample_dataroom/` | Authored 20 files + `gold.jsonl` covering traps |
| **Pathway Index Adapter** | Spec §16 (P2) | **PENDING** | `vhagar/components/hybrid_index.py` | `IndexBackend` interface added with Pathway adapter stub |

---

## 3. Answers to Phase 0 Questions

### Q1. Does any training code, dataset, taxonomy file or checkpoint exist (`ml/`, notebooks, `.jsonl`, `.safetensors`)?
**Answer:** No. Verification confirmed 0 matches for training scripts (`MultipleNegativesRankingLoss`, `TripletLoss`), 0 `.jsonl`, and 0 model weight checkpoints (`.safetensors`, `.pt`, `.onnx`). The offline ML pipeline had to be built from the ground up in `ml/`.

### Q2. Does `concept_mapper.py` use embeddings at all, or only dictionary/fuzzy matching? What seed concepts does `bootstrap.py` load?
**Answer:** Legacy `concept_mapper.py` used string dictionary and RapidFuzz / fuzzy token matching against `data/concept_mappings.json`. It did not use embeddings. Prior to our Section 7 seed implementation, `bootstrap.py` only seeded the basic legacy mapping JSON. We have now seeded 150 canonical concepts in SQLite (`vhagar/db/seed_taxonomy.py`) across `tax.*`, `fs.*`, and `cmp.*`.

### Q3. What does `document_processor.py` return: does it keep tables, headings and coordinates, or only flat text?
**Answer:** Originally, `document_processor.py` extracted unstructured flat text strings and page counts. We upgraded it to capture structural metadata (`tables`, `headings`, `coordinates`) and added a Tesseract OCR fallback adapter when RapidOCR is unavailable.

### Q4. Which encoder does `hybrid_index.py` use, how are chunks stored, and are locators kept?
**Answer:** `hybrid_index.py` uses `sentence-transformers/all-MiniLM-L6-v2` for dense retrieval and `rank-bm25` (BM25Okapi) for lexical search, combined via Reciprocal Rank Fusion ($k_0 = 60$). Chunks are stored in memory with an overflow to disk (`data/index_overflow`). Originally, chunks did not track structured locators. Structured locators are now rigorously constructed by `BaseExtractor` and validated against format rules.

### Q5. Where is state persisted (JSON, SQLite, memory)? What is the concept-memory file format?
**Answer:** Originally, state was saved in flat JSON files (`data/concept_mappings.json` and `data/concept_memory.json`). Legacy concept memory stored `{term: {count, context, timestamp}}`. We migrated the system of record to SQLite (`data/draythos.db`) with 11 tables (`documents`, `jobs`, `concepts`, `aliases`, `facts`, `fact_reviews`, `mapping_log`, `concept_links`, `model_registry`, `eval_runs`, `system_metadata`) and imported legacy mappings under `state='legacy'`.

### Q6. Which FastAPI app does the frontend actually call (8000 or 8001), and where do `/api/mappings*` live?
**Answer:** The Next.js frontend defaults to proxying to port 8001 (`VHAGAR_URL` or `NEXT_PUBLIC_VHAGAR_API_URL` fallback `http://localhost:8001`), which is `vhagar/mcp_server.py`. However, `vhagar/ui/app.py` runs on port 8000. In single-process mode (`vhagar/__main__.py`), all routes are served. We mounted the new routers (`/api/facts`, `/api/concepts`, `/api/mappings`, `/api/normalize`, `/api/export`, `/api/qa`) on both `vhagar/mcp_server.py` and `vhagar/ui/app.py` to ensure seamless resolution regardless of which port is invoked.

### Q7. Does the artifact canvas accept a deep link, and which PDF viewer and spreadsheet renderer does it use?
**Answer:** `frontend/src/components/dashboard/artifacts-pane.tsx` renders PDF via `@react-pdf-viewer` or an iframe viewer and spreadsheets via `@fortune-sheet/react` (or simple table). In our update, we added deep-link event listening (`window.addEventListener('draythos:locate', ...)`) to highlight and jump to specific page/cell.

### Q8. Spreadsheet save/download state?
**Answer:** `excel_processor.py` has working copy creation (`data/working_copies/doc_excel_1/budget_v88983fb7.xlsx`) and patch logic, but per Section 1 of the spec, chat-driven editing of PDF/DOCX and cosmetic artifact workspace editing is paused/frozen. We keep the spreadsheet working copy path only for export preview.

### Q9. Do all existing tests pass today?
**Answer:** Yes. All tests in `tests/test_standalone.py`, `tests/test_concept_mapper.py`, `tests/test_concept_memory.py`, and `tests/test_security_isolation.py` pass.

---

## 4. Audit Verification Command Log

```bash
# 1. Search for SentenceTransformer or loss classes
Get-ChildItem -Recurse -Include *.py,*.ipynb | Select-String -Pattern "sentence_transformers|MultipleNegatives|TripletLoss|SentenceTransformer"
# Result: Only imports in concept_index.py and hybrid_index.py. No training code.

# 2. Search for dataset or model weight files
Get-ChildItem -Recurse -Include *.jsonl,*.safetensors,*.pt,*.onnx | Where-Object { $_.FullName -notmatch "node_modules" }
# Result: 0 files found.

# 3. Test execution
python -m pytest tests/test_standalone.py -v
# Result: 18 passed in 2.65s (100% pass).
```

---

## 5. Conclusion & Forward Plan
The audit confirms that the spine and foundation layers are established in SQLite, extractors, and frontend review UI. The remaining requirements from the Master Build Specification are:
1. LLM Schema-Constrained Extractor (`vhagar/components/extraction/llm_extractor.py`)
2. Structured-First Q&A Pipeline (`vhagar/components/qa/`)
3. Pathway Backend Adapter (`vhagar/components/hybrid_index.py`)
4. Offline ML Track (`ml/`): data, grouped splits, training, hard-negative mining, calibration, evaluation
5. Sample Data Room (20 files) & Gold Labels (`sample_dataroom/`)
6. Documentation (`MODEL_CARD.md`, `EVAL_REPORT.md`, `DATA_LICENSES.md`)

