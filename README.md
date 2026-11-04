# Draythos

Document intelligence workspace for mixed-format business files, concept-aware retrieval, artifact-first review, and model-assisted reasoning.

![Draythos Logo](./frontend/public/logow.png)

## Status

`Draythos` is an active alpha-stage monorepo centered around two product surfaces:

- `Vhagar`: the Python backend and indexing engine
- `Eyrie`: the Next.js workspace UI

The repository already contains a real ingestion pipeline, search stack, concept mapping layer, hidden concept memory, document serving, artifact canvas, streaming chat, and spreadsheet-oriented edit/download workflows. It is also still evolving quickly, so the README aims to describe the codebase as it exists today rather than pretending every surface is fully finished.

---

## Table of Contents

1. [What Draythos Is](#what-draythos-is)
2. [The Problem It Solves](#the-problem-it-solves)
3. [Core Product Ideas](#core-product-ideas)
4. [Repository Map](#repository-map)
5. [Monorepo Tooling](#monorepo-tooling)
6. [Architecture Overview](#architecture-overview)
7. [Backend Architecture](#backend-architecture)
8. [Frontend Architecture](#frontend-architecture)
9. [Document Lifecycle](#document-lifecycle)
10. [Retrieval and Answering Lifecycle](#retrieval-and-answering-lifecycle)
11. [Concept Mapping Dictionary](#concept-mapping-dictionary)
12. [Hidden Concept Memory](#hidden-concept-memory)
13. [Unified Excel Processor](#unified-excel-processor)
14. [Artifact Canvas](#artifact-canvas)
15. [Chat Sessions and Attachments](#chat-sessions-and-attachments)
16. [Model and Provider Strategy](#model-and-provider-strategy)
17. [Supported Formats](#supported-formats)
18. [Storage Layout](#storage-layout)
19. [Environment Variables](#environment-variables)
20. [Local Development Setup](#local-development-setup)
21. [How to Run the System](#how-to-run-the-system)
22. [Key Routes and Endpoints](#key-routes-and-endpoints)
23. [Testing Strategy](#testing-strategy)
24. [Observability and Monitoring](#observability-and-monitoring)
25. [Security and Privacy Notes](#security-and-privacy-notes)
26. [Current Strengths](#current-strengths)
27. [Known Limitations](#known-limitations)
28. [Troubleshooting](#troubleshooting)
29. [Typical Use Cases](#typical-use-cases)
30. [Extension Points](#extension-points)
31. [Contribution Notes](#contribution-notes)
32. [Glossary](#glossary)

---

## What Draythos Is

Draythos is not just a chatbot wrapped around uploaded files. It is trying to be a workspace where:

- documents remain first-class artifacts
- files can be previewed and worked with in context
- answers are grounded in attached and indexed evidence
- concepts can be normalized across different terms
- retrieval can benefit from hidden knowledge accumulation without exposing private raw text
- the system can recover when plain extraction is weak by using a model layer on top of RAG

At the highest level:

- `Vhagar` handles ingestion, indexing, retrieval, concept understanding, file serving, and working-copy management
- `Eyrie` handles the user experience around chat, uploads, docked sessions, artifact viewing, and streamed responses

---

## The Problem It Solves

Financial, tax, business, and compliance documents rarely use consistent wording.

The same concept can appear as:

- `GST`
- `VAT`
- `sales tax`
- a local jurisdiction-specific alias
- a spreadsheet column name
- a PDF heading
- a table cell
- a paragraph in a DOCX report

In real data rooms, information is fragmented across:

- PDFs
- spreadsheets
- DOCX files
- CSV exports
- text reports
- structured JSON or XML files
- scanned or image-heavy documents

Humans waste time translating one wording into another, checking multiple files manually, and trying to remember where an answer came from. Draythos tries to reduce that pain by combining:

- extraction
- OCR fallback
- hybrid retrieval
- synonym expansion
- hidden concept memory
- artifact-centric review
- model-assisted reasoning

---

## Core Product Ideas

Several ideas define the system.

### 1. Retrieval first, not retrieval only

The platform uses indexing and search for grounding, but does not stop there. A language model can synthesize and explain, especially when the user asks broad or relational questions.

### 2. Attached documents should dominate context

If the user uploads and attaches files to a chat, those files should drive the answer before any global corpus.

### 3. Concepts matter more than exact strings

The system should understand that multiple phrases may point to the same idea. This is where the concept mapping dictionary becomes essential.

### 4. Files should stay files

Documents should not immediately collapse into meaningless snippets. The artifact canvas exists so users can open, review, and work with the file itself.

### 5. Hidden concept learning should improve the backend

Document uploads can enrich a backend-only concept memory layer so future retrieval becomes more intelligent without exposing private source material directly.

### 6. Mixed-format workflows should feel unified

PDFs, spreadsheets, DOCX files, and structured exports should all be usable inside one workspace rather than feeling like separate products.

---

## Repository Map

High-level repository layout:

```text
finbud/
|- .agent/                      # Agent-related local metadata
|- .agents/                     # Skills, plugins, and local agent assets
|- apps/                        # Workspace app folders in the monorepo
|- data/                        # Uploaded docs, indexes, persisted state
|- examples/                    # Example assets or support material
|- frontend/                    # Eyrie Next.js application
|- logs/                        # Runtime logs
|- next-app/                    # Additional app workspace
|- tests/                       # Python test suite
|- tools/                       # Support tools/scripts
|- vhagar/                      # Backend package
|- README.md
|- requirements.txt
|- run_mcp.py
|- setup.py
|- start.bat
|- start.sh
`- turbo.json
```

Important project files:

- `README.md`
  - this document
- `requirements.txt`
  - backend Python dependencies
- `setup.py`
  - Python package metadata for `vhagar`
- `package.json`
  - root workspace scripts powered by Turbo
- `turbo.json`
  - monorepo task graph
- `start.bat`
  - Windows helper to launch Vhagar
- `start.sh`
  - Linux/macOS helper to launch Vhagar
- `run_mcp.py`
  - MCP-related runner
- `STREAMING_INTEGRATION_SUMMARY.md`
  - supplemental repo document related to streaming integration
- `implementation_plan.md`
  - internal planning artifact

---

## Monorepo Tooling

The repo uses a mix of Python packaging and Node/Turbo workspace tooling.

### Python side

- packaged as `vhagar`
- installable via `setup.py`
- requirements managed in `requirements.txt`

### Node side

- root `package.json` defines Turbo scripts
- `frontend/` contains the main Next.js workspace application
- root scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`

### Turbo

The root `turbo.json` declares:

- `build`
- `lint`
- `dev`

This means the repository is set up to support monorepo-style orchestration as the project grows.

---

## Architecture Overview

The system can be understood as a layered workspace stack:

```text
User
  -> Eyrie Frontend
      -> Next.js API routes / orchestration layer
          -> Vhagar backend
              -> document processor
              -> hybrid index
              -> concept mapper
              -> concept memory
              -> working-copy manager
              -> file/document store
              -> provider-backed reasoning layer
```

### Architectural split

`Eyrie` is primarily responsible for:

- interaction
- layout
- session persistence
- uploading
- streaming display
- artifact preview shell
- provider orchestration for streamed chat

`Vhagar` is primarily responsible for:

- parsing
- OCR
- indexing
- search
- synonym expansion
- concept-memory ingestion
- content retrieval
- file delivery
- working-copy persistence

### Architectural intent

The split is useful because it keeps:

- frontend concerns in the UI layer
- retrieval and document mechanics in the backend
- model orchestration close to the interaction layer where chat state lives

---

## Backend Architecture

The backend lives under [`vhagar/`](./vhagar).

### Main modules

- [`vhagar/mcp_server.py`](./vhagar/mcp_server.py)
  - central backend API orchestration layer
  - handles upload, search, document content, file delivery, save/update flows
- [`vhagar/components/document_processor.py`](./vhagar/components/document_processor.py)
  - format detection
  - native extraction
  - OCR fallback
  - term extraction
  - parsed-content shaping
- [`vhagar/components/hybrid_index.py`](./vhagar/components/hybrid_index.py)
  - dense + lexical retrieval
  - indexing updates
  - snippet generation
  - result scoring
- [`vhagar/components/query_engine.py`](./vhagar/components/query_engine.py)
  - query expansion
  - concept-informed retrieval shaping
  - explanation generation
- [`vhagar/components/concept_mapper.py`](./vhagar/components/concept_mapper.py)
  - canonical concept and synonym relationships
- [`vhagar/components/concept_memory.py`](./vhagar/components/concept_memory.py)
  - persistent backend-only concept memory
- [`vhagar/components/excel_processor.py`](./vhagar/components/excel_processor.py)
  - spreadsheet parsing and workbook helper logic
- [`vhagar/components/observability.py`](./vhagar/components/observability.py)
  - logging and metrics middleware support
- [`vhagar/components/security.py`](./vhagar/components/security.py)
  - security-related helpers
- [`vhagar/bootstrap.py`](./vhagar/bootstrap.py)
  - component bootstrapping and seed setup
- [`vhagar/server_runners.py`](./vhagar/server_runners.py)
  - server launch helpers
- [`vhagar/startup_validation.py`](./vhagar/startup_validation.py)
  - startup checks for dependencies and configuration
- [`vhagar/ui/app.py`](./vhagar/ui/app.py)
  - FastAPI app factory and legacy review/mapping API surface
- [`vhagar/config.py`](./vhagar/config.py)
  - typed backend configuration model
- [`vhagar/config.yaml`](./vhagar/config.yaml)
  - YAML-configured settings surface

### Backend responsibilities

The backend is doing several jobs at once:

- intake service for uploaded documents
- parser and normalizer
- retrieval engine
- concept dictionary maintainer
- hidden knowledge ingester
- file-serving layer
- spreadsheet working-copy persistence layer
- observability and metrics surface

### Why this backend is central

Almost every product promise depends on backend correctness:

- a file must be extracted correctly
- retrieval must surface the right evidence
- snippets must not break validation
- concept memory must stay hidden but useful
- downloads must serve working copies, not stale originals

---

## Frontend Architecture

The main user-facing application lives under [`frontend/`](./frontend).

### Frontend stack

- Next.js `16.2.3`
- React `19.2.4`
- TypeScript
- Tailwind CSS `v4`
- Framer Motion
- Lucide icons

### Key frontend modules

- [`frontend/src/app/app/dashboard/page.tsx`](./frontend/src/app/app/dashboard/page.tsx)
  - main workspace composition
  - chat + dock + artifact canvas orchestration
  - active document state
  - attachment handling
- [`frontend/src/components/dashboard/artifacts-pane.tsx`](./frontend/src/components/dashboard/artifacts-pane.tsx)
  - artifact canvas UI
  - tabbed document workspace
  - preview/edit shell
  - save/download controls
- [`frontend/src/components/dashboard/streaming-chat-message.tsx`](./frontend/src/components/dashboard/streaming-chat-message.tsx)
  - assistant message rendering
  - headings, lists, paragraph formatting
- [`frontend/src/components/eyrie/liquid-dock.tsx`](./frontend/src/components/eyrie/liquid-dock.tsx)
  - session list
  - search view
  - rename/delete chat actions
- [`frontend/src/hooks/useStreamingChat.ts`](./frontend/src/hooks/useStreamingChat.ts)
  - SSE streaming hook
- [`frontend/src/hooks/useChatHistory.ts`](./frontend/src/hooks/useChatHistory.ts)
  - client chat history management
- [`frontend/src/lib/chatHistory.ts`](./frontend/src/lib/chatHistory.ts)
  - local history persistence, naming, lifecycle
- [`frontend/src/app/api/chat/stream/route.ts`](./frontend/src/app/api/chat/stream/route.ts)
  - primary streamed chat orchestration
  - retrieval layering
  - provider selection
  - direct PDF-reading layer
- [`frontend/src/app/api/upload/route.ts`](./frontend/src/app/api/upload/route.ts)
  - upload proxy
- [`frontend/src/app/api/documents/[documentId]/content/route.ts`](./frontend/src/app/api/documents/[documentId]/content/route.ts)
  - content proxy
- [`frontend/src/app/api/documents/[documentId]/file/route.ts`](./frontend/src/app/api/documents/[documentId]/file/route.ts)
  - file proxy
  - inline preview vs download handling

### Frontend responsibilities

The frontend is not a thin skin. It makes meaningful product decisions about:

- which document is active
- which attachments are present
- how the model is prompted
- how responses are formatted
- how session history is restored
- how the artifact canvas behaves when multiple files are attached

---

## Document Lifecycle

This is the most important operational flow in the product.

### Step 1: Upload

- the user uploads a file from the prompt box
- the frontend submits it to `/api/upload`
- the upload proxy forwards it to Vhagar

### Step 2: Persist

- the backend stores the file in `data/documents/`
- metadata is assigned
- a document identifier is returned when the file becomes a usable document

### Step 3: Detect format

The document processor determines whether the file is:

- PDF
- spreadsheet
- DOCX
- CSV
- JSON
- XML
- plain text
- image-like or unsupported/weakly supported

### Step 4: Extract content

Depending on the format, the processor attempts:

- native extraction
- parser-specific extraction
- OCR fallback for image-heavy documents

### Step 5: Build searchable representation

The backend extracts:

- text
- structured sections
- sheet content
- candidate terms
- concept-like phrases
- embeddings
- lexical content for BM25-like retrieval

### Step 6: Index

The document is added to the hybrid index so it can participate in:

- attached-document retrieval
- global retrieval
- snippet generation
- source-backed answers

### Step 7: Update concept layers

Upload-time processing can feed:

- the concept mapping dictionary
- the hidden concept memory store

### Step 8: Open in the workspace

The frontend opens the uploaded document in the artifact canvas when possible, so the file becomes part of the active chat workspace instead of disappearing into a hidden index.

---

## Retrieval and Answering Lifecycle

The main streamed route in [`frontend/src/app/api/chat/stream/route.ts`](./frontend/src/app/api/chat/stream/route.ts) is the brain of the interactive answer flow.

### Priority order

When attached documents exist, the intended answer order is:

1. attached docs
2. global index
3. model knowledge

This matters because the worst product failure is when the user uploads a file and the system answers from unrelated sample material.

### Evidence buckets

The route can assemble multiple evidence types:

- attached-document search results
- attached-document extracted content
- active artifact document context
- direct PDF-reading notes for attached PDFs
- global indexed search results
- internal permission for model knowledge fallback

### Final synthesis

The route then builds a final prompt that attempts to:

- stay grounded in attached docs first
- supplement from global index only when needed
- use model knowledge carefully
- produce cleaner, more structured answers than raw text blocks

### Why the route is complex

The route has to balance:

- attachment context
- retrieval quality
- provider availability
- file type
- streaming behavior
- edit-vs-answer intent
- direct PDF-reading fallback

---

## Concept Mapping Dictionary

The concept mapping dictionary is one of the core differentiators in the project.

### What it is

It is a backend semantic layer that links:

- synonyms
- aliases
- canonical concepts
- related phrases

### Why it matters

Exact keyword search is not enough in domains where the same concept has many names. The dictionary helps bridge that gap.

### What it improves

- query expansion
- retrieval recall
- answer consistency
- cross-document normalization
- user effort, because users do not need to guess the exact phrase used in the source

### How it is updated

During document processing, extracted terms can be:

- matched to existing concepts
- promoted into uploaded canonical concepts
- stored as synonyms or related variants

### Example value

If a user asks about one wording of a concept, the backend can still search for related variants that exist in the indexed material.

### Why it is more than a synonym list

The dictionary is effectively part of the retrieval brain. It helps the system reason about meanings rather than only raw surface strings.

---

## Hidden Concept Memory

Concept memory is distinct from the concept mapping dictionary.

### What it stores

Concept memory stores distilled concept-level knowledge such as:

- concept names
- keywords
- brief meanings
- context
- provenance
- occurrence counts

### What it does not do

It is not meant to be:

- a direct user-facing knowledge base
- a public document browser
- a raw dump of uploaded private text

### Why it exists

It lets the backend improve over time by remembering concept-level patterns extracted from documents.

### Product principle

Users should benefit from this memory indirectly through better answers, query expansion, and stronger conceptual matching, without being able to browse hidden concept records as if they were uploaded source files.

### Storage

The store persists to backend data state under `data/`, including a concept-memory JSON persistence file in current flows.

---

## Unified Excel Processor

The unified Excel processor is one of the strongest practical paths in the current system.

### Why it matters

Spreadsheets are not just attachments in Draythos. They are intended to behave like structured, queryable, previewable workspace artifacts.

### What it supports

- workbook parsing
- sheet extraction
- sheet-oriented preview in the artifact canvas
- chat questions grounded in sheet content
- workbook-based working-copy updates
- downloadable updated spreadsheet artifacts

### Why it is called unified

It connects several previously separate concerns into one pipeline:

- ingestion
- preview
- chat understanding
- edit interpretation
- workbook rewrite
- file download

### Why it is important strategically

Among editable formats in the current platform, spreadsheets are the most mature path toward real file updates rather than simple text extraction.

---

## Artifact Canvas

The artifact canvas is the workspace surface for documents.

### Intent

It exists so uploaded material feels like an open document environment rather than a search-results list.

### Current behaviors

- attached documents can open directly in the canvas
- multiple attached docs can appear as tabs
- one tab can be active while others remain available
- PDF preview can render inline
- spreadsheets can render structured preview views
- save and download actions live alongside the preview shell

### Why this matters

Without the artifact canvas, uploaded files would feel abstract and disconnected. With it, the chat and the actual document can coexist in one workspace.

### Design goal

The canvas should always feel like a real working surface:

- readable
- responsive
- artifact-first
- less snippet-driven
- less dependent on the user re-uploading context repeatedly

---

## Chat Sessions and Attachments

The chat model in the product is session-oriented.

### Session behavior

Each chat session maintains:

- messages
- a session title
- attachments
- document workspace state
- active artifact selection

### Session naming

Sessions begin as a generic chat but are intended to receive an automatically summarized title derived from the conversation.

### Attachment behavior

When several documents are attached:

- all attached docs should be available as evidence
- the active artifact tab is still especially important context
- the user should not have to mention "this document" perfectly for the system to stay grounded

### Why session isolation matters

One of the biggest correctness problems in document QA systems is context leakage. This product is deliberately moving toward stronger isolation between:

- attached local workspace docs
- global indexed data
- hidden concept memory
- model-only inference

---

## Model and Provider Strategy

The current streamed chat route uses a provider strategy rather than depending on a single model path.

### Final chat synthesis

The main streamed route currently prefers:

- OpenRouter first
- default model: `openai/gpt-5.4`
- Gemini as a fallback path when configured

### Direct attached-document reading

For direct PDF-reading support:

- OpenRouter is attempted first
- Gemini is used as fallback

### Why provider layering exists

It improves:

- robustness
- availability
- quality for final synthesis
- quality for multimodal PDF interpretation

### Important nuance

The project still has an older non-stream chat route with older defaults, but the streamed route is the primary modern product path.

---

## Supported Formats

Formats the system is designed to work with include:

- `.pdf`
- `.xlsx`
- `.xls`
- `.csv`
- `.docx`
- `.txt`
- `.json`
- `.xml`
- image fixtures in tests

### Practical support level

#### Stronger today

- PDF preview
- PDF extraction with OCR fallback
- attached-document retrieval
- concept mapping
- hidden concept-memory ingestion
- spreadsheet preview and workbook-oriented flows

#### Partial or evolving

- DOCX native-feeling editing
- layout-faithful PDF editing
- universal multimodal support for every format

---

## Storage Layout

The `data/` directory is operationally important.

Common storage areas include:

- `data/documents/`
  - uploaded source files
- `data/index_overflow/`
  - overflow/index-related runtime data
- concept-memory persistence files
- working-copy files for edited/saved artifacts

### Storage concerns

The system has to balance:

- preserving original uploads
- creating derived working copies
- maintaining index consistency
- serving the correct updated file on download
- avoiding stale browser caching

### Why working copies matter

If the system edits or transforms a file, the download flow should point at the working copy rather than blindly returning the original upload.

---

## Environment Variables

### Backend configuration

The Python config layer in [`vhagar/config.py`](./vhagar/config.py) supports `VHAGAR_`-prefixed environment configuration.

Useful backend variables include:

- `VHAGAR_AUTH_SECRET`
- `VHAGAR_MCP_API_KEY`
- `VHAGAR_FUZZY_THRESHOLD`
- `VHAGAR_CONFIDENCE_THRESHOLD`
- `VHAGAR_MAX_SNIPPET_LENGTH`
- `VHAGAR_QUERY_TIMEOUT_SECONDS`

### Frontend-to-backend routing

- `VHAGAR_API_URL`
  - used by frontend API routes
  - default commonly points to `http://localhost:8001`

### Model provider variables

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
  - current streamed-route default: `openai/gpt-5.4`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
  - current streamed-route default: `gemini-3-pro-preview`
- `GEMINI_DOCUMENT_MODEL`

### Example frontend `.env.local`

```env
VHAGAR_API_URL=http://localhost:8001
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openai/gpt-5.4
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-3-pro-preview
GEMINI_DOCUMENT_MODEL=gemini-3-pro-preview
```

### Example backend shell configuration

```env
VHAGAR_AUTH_SECRET=replace_me
VHAGAR_MCP_API_KEY=replace_me_too
```

---

## Local Development Setup

### Prerequisites

- Python `3.10+` is the safest target because `setup.py` declares `>=3.10`
- Node.js `18+`
- npm
- a virtual environment
- optional provider keys for model-backed features

### 1. Clone the repo

```powershell
git clone <repo-url>
cd finbud
```

### 2. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 5. Create runtime directories if needed

Windows:

```powershell
mkdir data\documents -Force
mkdir data\index_overflow -Force
mkdir logs -Force
```

macOS/Linux:

```bash
mkdir -p data/documents data/index_overflow logs
```

---

## How to Run the System

There are several ways to run the project depending on your environment.

### Option 1: Startup helper

Windows:

```powershell
start.bat
```

Linux/macOS:

```bash
./start.sh
```

These scripts:

- verify Python
- create directories
- install dependencies if missing
- start Vhagar

### Option 2: Direct backend, single-process mode

Recommended on Windows:

```powershell
python -m vhagar --single-process
```

This starts:

- UI backend on `http://localhost:8000`
- metrics on `http://localhost:8000/metrics`

It does not start the MCP server in this mode.

### Option 3: Direct backend, multi-process mode

```powershell
python -m vhagar
```

Default ports:

- UI server: `8000`
- MCP server: `8001`

Optional overrides:

```powershell
python -m vhagar --ui-port 8000 --mcp-port 8001 --host 0.0.0.0
```

### Option 4: Frontend dev server

```powershell
cd frontend
npm run dev
```

This usually serves:

- `http://localhost:3000`

In that mode the frontend proxies to `VHAGAR_API_URL`.

### Practical recommended local setup

1. start the backend
2. start the frontend dev server
3. configure `VHAGAR_API_URL=http://localhost:8001`
4. open the frontend in the browser

---

## Key Routes and Endpoints

### Frontend API routes

- `frontend/src/app/api/upload/route.ts`
  - upload proxy
- `frontend/src/app/api/chat/stream/route.ts`
  - main streamed chat logic
- `frontend/src/app/api/documents/[documentId]/content/route.ts`
  - content proxy
- `frontend/src/app/api/documents/[documentId]/file/route.ts`
  - file proxy
- `frontend/src/app/api/documents/stats/route.ts`
  - stats proxy

### Backend API surface

The FastAPI app in [`vhagar/ui/app.py`](./vhagar/ui/app.py) also exposes review-style endpoints such as:

- `GET /api/search`
- `GET /api/mappings`
- `POST /api/mappings`
- `DELETE /api/mappings/{synonym}`
- `GET /api/mappings/stream`
- `GET /api/export`

### Product-important backend capabilities

The backend also powers flows like:

- upload
- index
- session-aware retrieval
- content fetch
- file fetch
- working-copy save
- mapping updates
- concept-memory ingestion

---

## Testing Strategy

The repository contains a substantial Python test suite under [`tests/`](./tests).

### Test coverage areas visible in the repo

- concept mapper
- data model properties
- document processor
- hybrid index
- integration and end-to-end flows
- MCP server
- observability
- query engine
- review UI
- security
- text utilities
- property-based tests for multiple subsystems

### Example test files

- [`tests/test_concept_mapper.py`](./tests/test_concept_mapper.py)
- [`tests/test_document_processor.py`](./tests/test_document_processor.py)
- [`tests/test_hybrid_index.py`](./tests/test_hybrid_index.py)
- [`tests/test_mcp_server.py`](./tests/test_mcp_server.py)
- [`tests/test_query_engine.py`](./tests/test_query_engine.py)
- [`tests/test_security.py`](./tests/test_security.py)
- [`tests/test_integration_e2e.py`](./tests/test_integration_e2e.py)

### Test fixtures

Fixtures under `tests/fixtures/` include sample:

- CSV
- DOCX
- JSON
- PNG
- TXT
- XLSX
- XML
- corrupted documents for failure-path testing

### Common verification commands

Frontend type-check:

```powershell
cd frontend
cmd /c npm.cmd exec tsc -- --noEmit
```

Frontend lint:

```powershell
cd frontend
npm run lint
```

Python tests:

```bash
pytest tests/ -v --cov=vhagar
```

Quick backend compile sanity check:

```powershell
python -m py_compile vhagar\mcp_server.py
python -m py_compile vhagar\components\document_processor.py
python -m py_compile vhagar\components\hybrid_index.py
python -m py_compile vhagar\components\query_engine.py
```

---

## Observability and Monitoring

The repository includes observability support and a dedicated monitoring document:

- [`vhagar/MONITORING.md`](./vhagar/MONITORING.md)
- [`grafana_dashboard.json`](./grafana_dashboard.json)
- [`vhagar/grafana_dashboard.json`](./vhagar/grafana_dashboard.json)

### Metrics

Vhagar exposes Prometheus metrics at `/metrics`.

Documented monitoring areas include:

- query totals
- query latency
- documents indexed by format
- indexing latency
- mapping updates
- system memory usage

### Logging

The backend uses structured logging with correlation IDs to make tracing easier across requests.

### Why observability matters here

This is a document pipeline product. Failures can happen in:

- upload
- OCR
- parsing
- snippet construction
- retrieval
- provider calls
- working-copy saves
- download serving

Good telemetry is essential for debugging those layers.

---

## Security and Privacy Notes

The repository includes security-oriented code and tests:

- [`vhagar/components/security.py`](./vhagar/components/security.py)
- [`tests/test_security.py`](./tests/test_security.py)
- [`tests/test_security_comprehensive.py`](./tests/test_security_comprehensive.py)

### Security principles visible in the codebase

- backend auth-related configuration uses secrets and API keys
- security headers are added by the FastAPI app
- session-vs-global document behavior is treated as an important correctness boundary
- concept memory is designed as backend-only
- document serving distinguishes preview and explicit download

### Privacy principle

Raw uploaded document text should not simply become a globally browseable knowledge base. The system is built around keeping:

- attached docs session-relevant
- hidden concept memory indirect
- direct file access explicit

### Practical advice

For real deployments:

- use strong secrets
- isolate storage
- protect provider keys
- audit document retention policies
- verify cross-session isolation

---

## Current Strengths

The codebase already does several valuable things well.

- hybrid retrieval across indexed content
- session-aware attached document handling
- hidden concept-memory ingestion
- concept mapping support
- artifact canvas document preview
- multi-document tabbed artifact workspace
- streamed answers with better formatting than raw text blocks
- OpenRouter-first streamed chat synthesis
- supplemental direct PDF-reading layer on top of RAG
- spreadsheet-oriented artifact workflows

---

## Known Limitations

The project is ambitious, but some areas are still in motion.

- PDF editing is not the same as a native desktop PDF editor
- DOCX round-tripping and editing is still less mature than spreadsheet flows
- spreadsheet edit/download flows remain a critical stabilization surface
- the system contains both newer and older chat route layers
- provider quality can vary depending on file type and question style
- OCR-heavy PDFs can be slow
- the artifact experience is strong conceptually but still evolving visually and behaviorally

---

## Troubleshooting

### Upload succeeds but the artifact does not open

Check:

- backend upload response payload
- canonical document ID vs nested document payload
- `/api/documents/{id}/content`
- backend logs

### PDF parsing is weak

Make sure these dependencies are installed:

- `pypdf`
- `pdfplumber`
- `rapidocr_onnxruntime`

Remember:

- scanned PDFs are slower
- image-heavy PDFs may need OCR and direct multimodal reading support

### DOCX parsing fails

Make sure:

- `python-docx` is installed

### Answers are shallow

Check:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `GEMINI_API_KEY`
- attachment presence in the chat
- whether the question is going through the streamed route

### Direct PDF-reading does not seem active

Check:

- a provider key is configured
- the file is attached
- the question is asked through the streamed route
- the file is actually a PDF

### Download returns the wrong file

Check:

- whether a working copy was written
- whether the backend has been restarted after file-serving changes
- whether the file version changed
- whether browser cache is interfering

### SearchResult snippet validation errors

If you see validation around:

- `snippet must contain at least one matched term`

Then verify:

- the running backend is using the latest code
- the backend process has been restarted after snippet-repair changes

---

## Typical Use Cases

This project is especially suited to workflows like:

- mixed-format financial data rooms
- tax and compliance reference review
- cross-document concept reconciliation
- spreadsheet-driven planning or review
- internal knowledge work where the same concept appears under many names
- exploratory Q&A across uploaded business files

---

## Extension Points

The repository has multiple natural extension surfaces.

### Backend extension points

- add new parsers in `document_processor.py`
- add richer structured extraction for PDFs and DOCX
- improve workbook edit primitives
- expand concept-memory ranking strategies
- add new export formats

### Frontend extension points

- improve artifact canvas editing UX
- add richer table rendering
- improve citation presentation
- add more provider controls
- add workspace-level document collections and saved views

### Retrieval extension points

- improve ranking heuristics
- add stronger session-aware retrieval scoring
- tune concept expansion
- surface more transparent explanation layers

---

## Contribution Notes

If you are extending the project, a good operating mindset is:

1. keep attached-document behavior trustworthy
2. keep files as first-class workspace artifacts
3. keep concept memory hidden but useful
4. keep retrieval grounded before making answers more clever
5. treat download correctness as a product-critical path
6. verify both backend and frontend whenever touching document workflows

### Good first validation flow for changes

After making changes, try this:

1. upload a PDF
2. open it in the artifact canvas
3. ask what the file is about
4. upload a spreadsheet
5. preview the spreadsheet
6. ask a grounded spreadsheet question
7. perform a spreadsheet edit
8. download the file and verify the change
9. test a new chat with no attachments
10. verify global retrieval still works

---

## Glossary

### Draythos

The overall product/repository identity that combines the backend and workspace UI.

### Vhagar

The backend service and intelligence layer responsible for ingestion, indexing, retrieval, concept layers, and file/document APIs.

### Eyrie

The Next.js workspace UI where users chat, upload files, browse sessions, and open artifacts.

### Artifact Canvas

The document workspace pane where attached files are previewed, switched, saved, and downloaded.

### Attached Documents

Files explicitly part of the current chat context. These should be higher priority than the global corpus when answering.

### Global Index

The broader indexed backend corpus used when the answer cannot be fully satisfied from the current attached documents.

### Concept Mapping Dictionary

The canonical concept and synonym layer that helps normalize multiple names for the same idea.

### Hidden Concept Memory

A backend-only persistent concept store that improves retrieval and understanding without being directly exposed as a user-facing corpus.

### Working Copy

A derived or updated version of a document that should be used for current preview/download after an edit or save flow.

### Direct PDF Reading

A model-assisted attached-document layer used to interpret PDFs more intelligently when extraction alone is weak, especially for image-heavy or visually structured files.

---

## Final Notes

The most useful way to understand this repository is as a layered document workspace:

- ingestion gives the system raw material
- retrieval gives it grounding
- concept mapping gives it semantic flexibility
- concept memory gives it backend learning
- the artifact canvas gives users a real file surface
- the model layer gives it stronger explanation and reasoning

If those layers stay aligned, Draythos becomes much more than a file chatbot. It becomes a workspace for turning messy document collections into structured, explainable answers and artifact-driven workflows.

