"""Import legacy JSON files (concept_mappings.json, concept_memory.json) into SQLite.

Implements reconciliation ruling (Section 3):
"SQLite is the system of record for taxonomy, aliases, facts, links, audit.
 Import existing JSON on first run. Keep JSON export. Extend schema to union.
 Migrate old records with state=legacy."
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

import structlog

from vhagar.db.repo import get_repo
from vhagar.db.seed_taxonomy import normalize_key

logger = structlog.get_logger(__name__)


def import_legacy_files(data_dir: Path | str = "data") -> dict[str, int]:
    """Import legacy mappings and memory into the SQLite system of record."""
    data_path = Path(data_dir)
    repo = get_repo()
    counts = {"mappings_imported": 0, "memories_imported": 0}

    # 1. Import concept_mappings.json
    mappings_file = data_path / "concept_mappings.json"
    if mappings_file.exists():
        try:
            with open(mappings_file, "r", encoding="utf-8") as f:
                mappings = json.load(f)
            
            with repo.get_connection() as conn:
                cur = conn.cursor()
                for key, val in mappings.items():
                    canonical = val.get("canonical", key)
                    category = val.get("category", "fs")
                    concept_id = val.get("concept_id") or f"{category}.{normalize_key(canonical).replace(' ', '_')}"
                    
                    # Ensure concept exists
                    cur.execute(
                        """
                        INSERT OR IGNORE INTO concepts (concept_id, label, definition, parent_id, kind, jurisdiction)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (concept_id, canonical, val.get("description") or f"Legacy concept: {canonical}", None, category, "GLOBAL"),
                    )

                    # Import canonical self-alias
                    cur.execute(
                        """
                        INSERT OR IGNORE INTO aliases (alias_id, alias, alias_key, concept_id, source, relation, priority)
                        VALUES (?, ?, ?, ?, 'glossary', 'equivalent', 100)
                        """,
                        (f"al_leg_{uuid.uuid4().hex[:10]}", canonical, normalize_key(canonical), concept_id),
                    )
                    counts["mappings_imported"] += 1

                    # Import synonyms
                    for syn in val.get("synonyms", []):
                        cur.execute(
                            """
                            INSERT OR IGNORE INTO aliases (alias_id, alias, alias_key, concept_id, source, relation, priority)
                            VALUES (?, ?, ?, ?, 'glossary', 'equivalent', 95)
                            """,
                            (f"al_leg_{uuid.uuid4().hex[:10]}", syn, normalize_key(syn), concept_id),
                        )
                        counts["mappings_imported"] += 1

                conn.commit()
            logger.info("legacy_mappings_imported", count=counts["mappings_imported"])
        except Exception as exc:
            logger.warning("legacy_mappings_import_failed", error=str(exc))

    # 2. Import concept_memory.json (Migrate old records with state='legacy')
    memory_file = data_path / "concept_memory.json"
    if memory_file.exists():
        try:
            with open(memory_file, "r", encoding="utf-8") as f:
                memories = json.load(f)

            with repo.get_connection() as conn:
                cur = conn.cursor()
                for key, val in memories.items():
                    term = val.get("concept_name", key)
                    link_id = f"cl_leg_{uuid.uuid4().hex[:10]}"
                    doc_id = val.get("provenance", "")
                    cur.execute(
                        """
                        INSERT OR IGNORE INTO concept_links (
                            link_id, term, concept_id, state, similarity,
                            confidence, doc_id, taxonomy_version, model_version
                        ) VALUES (?, ?, ?, 'legacy', 0.8, 0.8, ?, 'tax-legacy', 'enc-legacy')
                        """,
                        (link_id, term, val.get("concept_id"), doc_id),
                    )
                    counts["memories_imported"] += 1
                conn.commit()
            logger.info("legacy_memory_imported", count=counts["memories_imported"])
        except Exception as exc:
            logger.warning("legacy_memory_import_failed", error=str(exc))

    return counts

