-- Draythos Master Database Schema
-- System of record for canonical taxonomy, aliases, facts, reviews, audit logs, and versioning.

PRAGMA foreign_keys = ON;

-- 1. Documents registry
CREATE TABLE IF NOT EXISTS documents (
    doc_id TEXT PRIMARY KEY,
    id TEXT,
    filename TEXT NOT NULL,
    format TEXT NOT NULL,
    sha256 TEXT,
    status TEXT DEFAULT 'completed', -- 'queued', 'processing', 'completed', 'failed'
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

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id);

-- 2. Processing Jobs
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'parsing', 'extracting', 'normalizing', 'completed', 'failed'
    status TEXT NOT NULL DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
    error TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    FOREIGN KEY(doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_doc_id ON jobs(doc_id);

-- 3. Canonical Concepts Taxonomy (O1: 150 concepts across tax, fs, cmp)
CREATE TABLE IF NOT EXISTS concepts (
    concept_id TEXT PRIMARY KEY, -- e.g. 'fs.revenue', 'tax.value_added'
    label TEXT NOT NULL, -- e.g. 'Revenue', 'Value Added Tax'
    definition TEXT NOT NULL,
    parent_id TEXT, -- e.g. 'fs.income_statement', 'tax.consumption'
    kind TEXT NOT NULL, -- 'tax' | 'fs' | 'cmp'
    jurisdiction TEXT DEFAULT 'GLOBAL', -- 'GLOBAL' | 'IN' | 'US' | 'UK' | 'EU'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_id) REFERENCES concepts(concept_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_concepts_kind ON concepts(kind);
CREATE INDEX IF NOT EXISTS idx_concepts_parent ON concepts(parent_id);

-- 4. Aliases and Surface Forms
CREATE TABLE IF NOT EXISTS aliases (
    alias_id TEXT PRIMARY KEY,
    alias TEXT NOT NULL, -- original surface text
    alias_key TEXT NOT NULL, -- lowercase + Unicode NFKC + collapsed whitespace
    concept_id TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'glossary', -- 'glossary' | 'model' | 'user_override'
    relation TEXT NOT NULL DEFAULT 'equivalent', -- 'equivalent' | 'related' | 'different'
    priority INTEGER DEFAULT 100, -- higher priority wins (overrides = 1000)
    jurisdiction TEXT DEFAULT 'GLOBAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(concept_id) REFERENCES concepts(concept_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aliases_key ON aliases(alias_key);
CREATE INDEX IF NOT EXISTS idx_aliases_concept ON aliases(concept_id);
CREATE INDEX IF NOT EXISTS idx_aliases_priority ON aliases(priority DESC);

-- 5. Unified Facts Store (Section 4.2)
-- A fact without a locator MUST NOT be saved.
CREATE TABLE IF NOT EXISTS facts (
    fact_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    entity TEXT,
    jurisdiction TEXT,
    raw_label TEXT NOT NULL,
    label_key TEXT NOT NULL,
    context_heading TEXT,
    concept_id TEXT,
    concept_label TEXT,
    parent_id TEXT,
    match_method TEXT NOT NULL, -- 'override' | 'dictionary' | 'model' | 'llm_assist' | 'manual'
    similarity REAL DEFAULT 0.0,
    confidence REAL DEFAULT 0.0,
    state TEXT NOT NULL, -- 'auto_accepted' | 'needs_review' | 'abstained' | 'conflict' | 'user_confirmed' | 'rejected'
    candidates TEXT DEFAULT '[]', -- JSON: [{"concept_id": ..., "score": ...}]
    value_raw TEXT NOT NULL,
    value_num REAL,
    unit TEXT,
    scale REAL DEFAULT 1.0,
    period TEXT DEFAULT '{}', -- JSON: {"label": "FY2024", "start": "...", "end": "...", "type": "..."}
    locator TEXT NOT NULL, -- JSON: MUST NOT BE NULL OR EMPTY
    extraction_method TEXT NOT NULL, -- 'native_table' | 'native_text' | 'ocr' | 'llm_vision' | 'llm_text' | 'xbrl'
    extraction_confidence REAL DEFAULT 1.0,
    taxonomy_version TEXT DEFAULT 'tax-1.0.0',
    model_version TEXT DEFAULT 'enc-1.0.0',
    mapping_version INTEGER DEFAULT 1,
    reviewed_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE,
    FOREIGN KEY(concept_id) REFERENCES concepts(concept_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_facts_doc ON facts(doc_id);
CREATE INDEX IF NOT EXISTS idx_facts_concept ON facts(concept_id);
CREATE INDEX IF NOT EXISTS idx_facts_state ON facts(state);
CREATE INDEX IF NOT EXISTS idx_facts_label_key ON facts(label_key);
CREATE INDEX IF NOT EXISTS idx_facts_mapping_ver ON facts(mapping_version);

-- 6. Fact Review Audit Log
CREATE TABLE IF NOT EXISTS fact_reviews (
    review_id TEXT PRIMARY KEY,
    fact_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'accept' | 'reject' | 'reassign'
    old_concept TEXT,
    new_concept TEXT,
    by TEXT DEFAULT 'user',
    note TEXT,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fact_id) REFERENCES facts(fact_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fact_reviews_fact ON fact_reviews(fact_id);

-- 7. Mapping Log (User Override Audit Trail)
CREATE TABLE IF NOT EXISTS mapping_log (
    log_id TEXT PRIMARY KEY,
    mapping_version INTEGER NOT NULL,
    op TEXT NOT NULL, -- 'add' | 'edit' | 'delete'
    alias TEXT NOT NULL,
    alias_key TEXT NOT NULL,
    old_concept TEXT,
    new_concept TEXT,
    by TEXT DEFAULT 'user',
    reason TEXT,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mapping_log_version ON mapping_log(mapping_version);

-- 8. Extended Concept Links (Bridge with legacy Concept Memory)
CREATE TABLE IF NOT EXISTS concept_links (
    link_id TEXT PRIMARY KEY,
    term TEXT NOT NULL,
    concept_id TEXT,
    state TEXT NOT NULL DEFAULT 'proposed', -- 'proposed' | 'accepted' | 'rejected' | 'legacy'
    similarity REAL DEFAULT 0.0,
    confidence REAL DEFAULT 0.0,
    locator TEXT,
    doc_id TEXT,
    taxonomy_version TEXT DEFAULT 'tax-1.0.0',
    model_version TEXT DEFAULT 'enc-1.0.0',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_concept_links_term ON concept_links(term);

-- 9. Model Registry
CREATE TABLE IF NOT EXISTS model_registry (
    model_version TEXT PRIMARY KEY,
    path TEXT,
    base_model TEXT NOT NULL,
    sha256 TEXT,
    threshold REAL DEFAULT 0.75,
    calibrator_params TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active INTEGER DEFAULT 0
);

-- 10. Evaluation Runs
CREATE TABLE IF NOT EXISTS eval_runs (
    run_id TEXT PRIMARY KEY,
    system TEXT NOT NULL, -- 'S0', 'S1', 'S2', 'S3'
    metrics_json TEXT NOT NULL,
    split TEXT,
    seed INTEGER,
    at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. System Metadata (Single row per key, e.g. 'current_mapping_version')
CREATE TABLE IF NOT EXISTS system_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

