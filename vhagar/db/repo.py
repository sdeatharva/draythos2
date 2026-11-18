"""Data access repository for Draythos.

SQLite is the system of record for taxonomy, aliases, facts, reviews,
audit logs, and versioning.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator, Optional

import structlog

from vhagar.db.seed_taxonomy import CONCEPTS_DATA, ALIASES_DATA, normalize_key, CAVEAT

logger = structlog.get_logger(__name__)

DEFAULT_DB_PATH = Path("data/draythos.db")
SCHEMA_PATH = Path(__file__).parent / "schema.sql"


class DraythosRepository:
    """Thread-safe SQLite repository with WAL mode and foreign key enforcement."""

    def __init__(self, db_path: Path = DEFAULT_DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Create tables from schema.sql and seed baseline taxonomy."""
        with self.get_connection() as conn:
            if SCHEMA_PATH.exists():
                schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
                conn.executescript(schema_sql)

            # Harmonize documents table columns
            doc_cols = [c[1] for c in conn.execute("PRAGMA table_info(documents);").fetchall()]
            if "id" not in doc_cols and "doc_id" in doc_cols:
                conn.execute("ALTER TABLE documents ADD COLUMN id TEXT;")
                conn.execute("UPDATE documents SET id = doc_id WHERE id IS NULL;")
            if "doc_id" not in doc_cols and "id" in doc_cols:
                conn.execute("ALTER TABLE documents ADD COLUMN doc_id TEXT;")
                conn.execute("UPDATE documents SET doc_id = id WHERE doc_id IS NULL;")
            if "created_at" not in doc_cols:
                conn.execute("ALTER TABLE documents ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
                if "uploaded_at" in doc_cols:
                    conn.execute("UPDATE documents SET created_at = uploaded_at WHERE created_at IS NULL;")
            if "uploaded_at" not in doc_cols:
                conn.execute("ALTER TABLE documents ADD COLUMN uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;")
                if "created_at" in doc_cols:
                    conn.execute("UPDATE documents SET uploaded_at = created_at WHERE uploaded_at IS NULL;")
            if "size" not in doc_cols:
                conn.execute("ALTER TABLE documents ADD COLUMN size INTEGER DEFAULT 0;")
            
            # Ensure metadata has mapping version
            cur = conn.cursor()
            cur.execute("SELECT value FROM system_metadata WHERE key = 'current_mapping_version'")
            row = cur.fetchone()
            if not row:
                cur.execute(
                    "INSERT INTO system_metadata (key, value) VALUES ('current_mapping_version', '1')"
                )
                conn.commit()

        # Seed initial canonical taxonomy
        self.seed_baseline_taxonomy()

    # -------------------------------------------------------------
    # Versioning & Metadata
    # -------------------------------------------------------------
    def get_mapping_version(self) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM system_metadata WHERE key = 'current_mapping_version'")
            row = cur.fetchone()
            return int(row["value"]) if row else 1

    def bump_mapping_version(
        self,
        op: str,
        alias: str,
        old_concept: str | None = None,
        new_concept: str | None = None,
        by: str = "user",
        reason: str | None = None,
    ) -> int:
        """Monotonically bump mapping version and record in mapping_log."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM system_metadata WHERE key = 'current_mapping_version'")
            row = cur.fetchone()
            curr_ver = int(row["value"]) if row else 1
            new_ver = curr_ver + 1

            cur.execute(
                "UPDATE system_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'current_mapping_version'",
                (str(new_ver),),
            )

            log_id = f"ml_{uuid.uuid4().hex[:12]}"
            cur.execute(
                """
                INSERT INTO mapping_log (log_id, mapping_version, op, alias, alias_key, old_concept, new_concept, by, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (log_id, new_ver, op, alias, normalize_key(alias), old_concept, new_concept, by, reason),
            )
            conn.commit()
            logger.info("mapping_version_bumped", version=new_ver, op=op, alias=alias)
            return new_ver

    # -------------------------------------------------------------
    # Taxonomy & Concepts
    # -------------------------------------------------------------
    def seed_baseline_taxonomy(self) -> int:
        """Seed taxonomy concepts and default aliases if not yet present."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) as cnt FROM concepts")
            if cur.fetchone()["cnt"] > 0:
                return 0  # Already seeded

            logger.info("seeding_canonical_taxonomy", concepts=len(CONCEPTS_DATA), aliases=len(ALIASES_DATA))
            cur.execute("PRAGMA foreign_keys = OFF;")
            try:
                for item in CONCEPTS_DATA:
                    cur.execute(
                        """
                        INSERT OR IGNORE INTO concepts (concept_id, label, definition, parent_id, kind, jurisdiction)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            item["concept_id"],
                            item["label"],
                            item["definition"],
                            item["parent_id"],
                            item["kind"],
                            item.get("jurisdiction", "GLOBAL"),
                        ),
                    )

                for a in ALIASES_DATA:
                    alias_id = f"al_{uuid.uuid4().hex[:12]}"
                    key = normalize_key(a["alias"])
                    cur.execute(
                        """
                        INSERT OR IGNORE INTO aliases (alias_id, alias, alias_key, concept_id, source, relation, priority, jurisdiction)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            alias_id,
                            a["alias"],
                            key,
                            a["concept_id"],
                            "glossary",
                            a.get("relation", "equivalent"),
                            a.get("priority", 100),
                            a.get("jurisdiction", "GLOBAL"),
                        ),
                    )
            finally:
                cur.execute("PRAGMA foreign_keys = ON;")
            conn.commit()
            return len(CONCEPTS_DATA)

    def get_concept(self, concept_id: str) -> dict[str, Any] | None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM concepts WHERE concept_id = ?", (concept_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_concepts(self, kind: str | None = None) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if kind:
                cur.execute("SELECT * FROM concepts WHERE kind = ? ORDER BY concept_id", (kind,))
            else:
                cur.execute("SELECT * FROM concepts ORDER BY kind, concept_id")
            return [dict(row) for row in cur.fetchall()]

    def get_concept_tree(self) -> list[dict[str, Any]]:
        concepts = self.list_concepts()
        by_id = {c["concept_id"]: {**c, "children": []} for c in concepts}
        root_nodes = []
        for c in concepts:
            cid = c["concept_id"]
            pid = c["parent_id"]
            if pid and pid in by_id:
                by_id[pid]["children"].append(by_id[cid])
            else:
                root_nodes.append(by_id[cid])
        return root_nodes

    # -------------------------------------------------------------
    # Aliases & Overrides
    # -------------------------------------------------------------
    def get_alias_match(self, raw_label: str) -> dict[str, Any] | None:
        """Find the highest-priority alias match for a raw label key."""
        key = normalize_key(raw_label)
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT a.*, c.label as concept_label, c.parent_id, c.kind
                FROM aliases a
                JOIN concepts c ON a.concept_id = c.concept_id
                WHERE a.alias_key = ?
                ORDER BY a.priority DESC, a.created_at DESC
                LIMIT 1
                """,
                (key,),
            )
            row = cur.fetchone()
            return dict(row) if row else None

    def list_aliases(self, concept_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if concept_id:
                cur.execute(
                    """
                    SELECT a.*, c.label as concept_label
                    FROM aliases a
                    JOIN concepts c ON a.concept_id = c.concept_id
                    WHERE a.concept_id = ?
                    ORDER BY a.priority DESC, a.alias
                    LIMIT ?
                    """,
                    (concept_id, limit),
                )
            else:
                cur.execute(
                    """
                    SELECT a.*, c.label as concept_label
                    FROM aliases a
                    JOIN concepts c ON a.concept_id = c.concept_id
                    ORDER BY a.source = 'user_override' DESC, a.priority DESC, a.alias
                    LIMIT ?
                    """,
                    (limit,),
                )
            return [dict(row) for row in cur.fetchall()]

    def add_override(
        self,
        alias: str,
        concept_id: str,
        relation: str = "equivalent",
        by: str = "user",
        reason: str | None = None,
    ) -> dict[str, Any]:
        """Add or update a user override synonym, bumping mapping_version."""
        key = normalize_key(alias)
        old_match = self.get_alias_match(alias)
        old_cid = old_match["concept_id"] if old_match else None

        alias_id = f"al_ovr_{uuid.uuid4().hex[:10]}"
        with self.get_connection() as conn:
            cur = conn.cursor()
            # Remove any previous override on the same key
            cur.execute("DELETE FROM aliases WHERE alias_key = ? AND source = 'user_override'", (key,))
            cur.execute(
                """
                INSERT INTO aliases (alias_id, alias, alias_key, concept_id, source, relation, priority, jurisdiction)
                VALUES (?, ?, ?, ?, 'user_override', ?, 1000, 'GLOBAL')
                """,
                (alias_id, alias, key, concept_id, relation),
            )
            conn.commit()

        # Bump version and audit log
        new_ver = self.bump_mapping_version(
            op="edit" if old_cid else "add",
            alias=alias,
            old_concept=old_cid,
            new_concept=concept_id,
            by=by,
            reason=reason or f"User override mapping for '{alias}'",
        )

        return {
            "alias_id": alias_id,
            "alias": alias,
            "alias_key": key,
            "concept_id": concept_id,
            "source": "user_override",
            "relation": relation,
            "mapping_version": new_ver,
        }

    def delete_alias(self, alias_id: str, by: str = "user") -> bool:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM aliases WHERE alias_id = ?", (alias_id,))
            row = cur.fetchone()
            if not row:
                return False
            alias_data = dict(row)
            cur.execute("DELETE FROM aliases WHERE alias_id = ?", (alias_id,))
            conn.commit()

        self.bump_mapping_version(
            op="delete",
            alias=alias_data["alias"],
            old_concept=alias_data["concept_id"],
            new_concept=None,
            by=by,
            reason="Deleted alias mapping",
        )
        return True

    def get_mapping_log(self, limit: int = 100) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM mapping_log ORDER BY mapping_version DESC LIMIT ?", (limit,))
            return [dict(row) for row in cur.fetchall()]

    def undo_mapping_log(self, log_id: int, by: str = "user") -> bool:
        """Section 12: Reverse a mapping log operation and bump mapping_version."""
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM mapping_log WHERE log_id = ?", (log_id,))
            row = cur.fetchone()
            if not row:
                return False

            log_entry = dict(row)
            op = log_entry["op"]
            alias = log_entry["alias"]
            old_cid = log_entry["old_concept"]
            new_cid = log_entry["new_concept"]
            key = normalize_key(alias)

            if op == "add":
                # Revert an add: delete the alias override
                cur.execute("DELETE FROM aliases WHERE alias_key = ? AND source = 'user_override'", (key,))
            elif op == "edit":
                # Revert an edit: restore old_concept
                if old_cid:
                    cur.execute(
                        "UPDATE aliases SET concept_id = ? WHERE alias_key = ? AND source = 'user_override'",
                        (old_cid, key),
                    )
                else:
                    cur.execute("DELETE FROM aliases WHERE alias_key = ? AND source = 'user_override'", (key,))
            elif op == "delete":
                # Revert a delete: re-insert the alias
                alias_id = f"al_und_{uuid.uuid4().hex[:10]}"
                cur.execute(
                    """
                    INSERT INTO aliases (alias_id, alias, alias_key, concept_id, source, relation, priority, jurisdiction)
                    VALUES (?, ?, ?, ?, 'user_override', 'equivalent', 1000, 'GLOBAL')
                    """,
                    (alias_id, alias, key, old_cid),
                )
            conn.commit()

        # Bump version with undo entry
        self.bump_mapping_version(
            op="undo",
            alias=alias,
            old_concept=new_cid,
            new_concept=old_cid,
            by=by,
            reason=f"Reverted mapping operation from log_id {log_id}",
        )
        return True

    # -------------------------------------------------------------
    # Facts Store (Section 4.2)
    # -------------------------------------------------------------
    def save_fact(self, fact: dict[str, Any]) -> dict[str, Any]:
        """Save an extracted fact.

        MUST REQUIRE A VALID LOCATOR.
        A fact without a locator MUST NOT be saved (Hard requirement).
        """
        locator = fact.get("locator")
        if not locator or not isinstance(locator, dict) or not locator.get("type"):
            raise ValueError(f"Hard Requirement Violation: Fact without a locator MUST NOT be saved. Received: {locator}")

        fact_id = fact.get("fact_id") or f"f_{uuid.uuid4().hex}"
        doc_id = fact["doc_id"]
        raw_label = fact["raw_label"]
        label_key = normalize_key(raw_label)
        mapping_version = fact.get("mapping_version") or self.get_mapping_version()

        candidates_json = json.dumps(fact.get("candidates", []))
        period_json = json.dumps(fact.get("period", {}))
        locator_json = json.dumps(locator)

        with self.get_connection() as conn:
            cur = conn.cursor()
            # Ensure document exists to satisfy foreign key constraint
            cur.execute(
                """
                INSERT OR IGNORE INTO documents (doc_id, filename, format, status)
                VALUES (?, ?, 'unknown', 'completed')
                """,
                (doc_id, doc_id),
            )
            cur.execute(
                """
                INSERT OR REPLACE INTO facts (
                    fact_id, doc_id, entity, jurisdiction, raw_label, label_key,
                    context_heading, concept_id, concept_label, parent_id,
                    match_method, similarity, confidence, state, candidates,
                    value_raw, value_num, unit, scale, period, locator,
                    extraction_method, extraction_confidence, taxonomy_version,
                    model_version, mapping_version, reviewed_by, created_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?
                )
                """,
                (
                    fact_id,
                    doc_id,
                    fact.get("entity"),
                    fact.get("jurisdiction", "GLOBAL"),
                    raw_label,
                    label_key,
                    fact.get("context_heading"),
                    fact.get("concept_id"),
                    fact.get("concept_label"),
                    fact.get("parent_id"),
                    fact.get("match_method", "dictionary"),
                    float(fact.get("similarity", 0.0)),
                    float(fact.get("confidence", 0.0)),
                    fact.get("state", "needs_review"),
                    candidates_json,
                    str(fact.get("value_raw", "")),
                    fact.get("value_num"),
                    fact.get("unit"),
                    float(fact.get("scale", 1.0)),
                    period_json,
                    locator_json,
                    fact.get("extraction_method", "native_table"),
                    float(fact.get("extraction_confidence", 1.0)),
                    fact.get("taxonomy_version", "tax-1.0.0"),
                    fact.get("model_version", "enc-1.0.0"),
                    mapping_version,
                    fact.get("reviewed_by"),
                    fact.get("created_at") or datetime.now(timezone.utc).isoformat(),
                ),
            )
            conn.commit()

        return self.get_fact(fact_id)  # type: ignore

    def save_facts_batch(self, facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        saved = []
        for f in facts:
            saved.append(self.save_fact(f))
        return saved

    def get_fact(self, fact_id: str) -> dict[str, Any] | None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM facts WHERE fact_id = ?", (fact_id,))
            row = cur.fetchone()
            if not row:
                return None
            return self._parse_fact_row(dict(row))

    def list_facts(
        self,
        doc_id: str | None = None,
        state: str | None = None,
        concept_id: str | None = None,
        kind: str | None = None,
        search: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """List facts with flexible filtering and total count."""
        where_clauses = []
        params: list[Any] = []

        if doc_id:
            where_clauses.append("f.doc_id = ?")
            params.append(doc_id)
        if state and state != "all":
            where_clauses.append("f.state = ?")
            params.append(state)
        if concept_id:
            where_clauses.append("f.concept_id = ?")
            params.append(concept_id)
        if kind:
            where_clauses.append("c.kind = ?")
            params.append(kind)
        if search:
            where_clauses.append(
                "(f.raw_label LIKE ? OR f.concept_label LIKE ? OR f.value_raw LIKE ?)"
            )
            pat = f"%{search}%"
            params.extend([pat, pat, pat])

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        with self.get_connection() as conn:
            cur = conn.cursor()
            # Count total
            count_query = f"""
                SELECT COUNT(*) as total
                FROM facts f
                LEFT JOIN concepts c ON f.concept_id = c.concept_id
                {where_sql}
            """
            cur.execute(count_query, params)
            total = cur.fetchone()["total"]

            # Query items
            data_query = f"""
                SELECT f.*, c.kind as concept_kind
                FROM facts f
                LEFT JOIN concepts c ON f.concept_id = c.concept_id
                {where_sql}
                ORDER BY f.created_at DESC
                LIMIT ? OFFSET ?
            """
            cur.execute(data_query, params + [limit, offset])
            rows = [self._parse_fact_row(dict(r)) for r in cur.fetchall()]

            return rows, total

    def review_fact(
        self,
        fact_id: str,
        action: str,  # 'accept' | 'reject' | 'reassign'
        new_concept_id: str | None = None,
        by: str = "user",
        note: str | None = None,
    ) -> dict[str, Any]:
        """User review action on a fact (accept, reject, or reassign)."""
        fact = self.get_fact(fact_id)
        if not fact:
            raise KeyError(f"Fact '{fact_id}' not found")

        old_concept = fact.get("concept_id")
        new_state = fact["state"]
        concept_label = fact.get("concept_label")
        parent_id = fact.get("parent_id")

        if action == "accept":
            new_state = "user_confirmed"
        elif action == "reject":
            new_state = "rejected"
        elif action == "reassign":
            if not new_concept_id:
                raise ValueError("new_concept_id required for reassign action")
            concept = self.get_concept(new_concept_id)
            if not concept:
                raise ValueError(f"Concept '{new_concept_id}' not found")
            new_state = "user_confirmed"
            old_concept = fact.get("concept_id")
            concept_label = concept["label"]
            parent_id = concept["parent_id"]

        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE facts
                SET state = ?, concept_id = ?, concept_label = ?, parent_id = ?,
                    reviewed_by = ?, match_method = CASE WHEN ? = 'reassign' THEN 'manual' ELSE match_method END
                WHERE fact_id = ?
                """,
                (
                    new_state,
                    new_concept_id if action == "reassign" else old_concept,
                    concept_label,
                    parent_id,
                    by,
                    action,
                    fact_id,
                ),
            )

            # Record review audit log
            review_id = f"fr_{uuid.uuid4().hex[:12]}"
            cur.execute(
                """
                INSERT INTO fact_reviews (review_id, fact_id, action, old_concept, new_concept, by, note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    review_id,
                    fact_id,
                    action,
                    old_concept,
                    new_concept_id if action == "reassign" else old_concept,
                    by,
                    note,
                ),
            )
            conn.commit()

        logger.info("fact_reviewed", fact_id=fact_id, action=action, new_state=new_state)
        return self.get_fact(fact_id)  # type: ignore

    def get_facts_by_label_key(self, label_key: str) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM facts WHERE label_key = ?", (label_key,))
            return [self._parse_fact_row(dict(r)) for r in cur.fetchall()]

    def count_facts_affected_by_alias(self, alias_key: str) -> int:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) as cnt FROM facts WHERE label_key = ?", (alias_key,))
            return cur.fetchone()["cnt"]

    # -------------------------------------------------------------
    # Documents & Jobs
    # -------------------------------------------------------------
    def register_document(
        self,
        doc_id: str,
        filename: str,
        format_name: str,
        file_path: str,
        sha256: str | None = None,
        entity: str | None = None,
        jurisdiction: str = "GLOBAL",
        page_count: int = 1,
        session_id: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                INSERT OR REPLACE INTO documents (
                    doc_id, id, filename, format, sha256, status, entity,
                    jurisdiction, page_count, file_path, session_id, user_id,
                    uploaded_at, created_at
                ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """,
                (
                    doc_id,
                    doc_id,
                    filename,
                    format_name,
                    sha256,
                    entity,
                    jurisdiction,
                    page_count,
                    file_path,
                    session_id,
                    user_id,
                ),
            )
            conn.commit()
            cur.execute("SELECT * FROM documents WHERE doc_id = ?", (doc_id,))
            return dict(cur.fetchone())

    def get_document(self, doc_id: str) -> dict[str, Any] | None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM documents WHERE doc_id = ?", (doc_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def list_documents(self, session_id: str | None = None) -> list[dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if session_id:
                cur.execute("SELECT * FROM documents WHERE session_id = ? ORDER BY uploaded_at DESC", (session_id,))
            else:
                cur.execute("SELECT * FROM documents ORDER BY uploaded_at DESC")
            return [dict(r) for r in cur.fetchall()]

    # -------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------
    def _parse_fact_row(self, row: dict[str, Any]) -> dict[str, Any]:
        """Parse serialized JSON fields in a facts row."""
        try:
            row["candidates"] = json.loads(row.get("candidates") or "[]")
        except Exception:
            row["candidates"] = []
        try:
            row["period"] = json.loads(row.get("period") or "{}")
        except Exception:
            row["period"] = {}
        try:
            row["locator"] = json.loads(row.get("locator") or "{}")
        except Exception:
            row["locator"] = {}
        return row


# Global singleton helper
_repo_instance: DraythosRepository | None = None


def get_repo(db_path: Path | None = None) -> DraythosRepository:
    global _repo_instance
    if _repo_instance is None or (db_path and _repo_instance.db_path != db_path):
        _repo_instance = DraythosRepository(db_path or DEFAULT_DB_PATH)
    return _repo_instance
