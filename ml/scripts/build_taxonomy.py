"""Script to build canonical taxonomy dataset for offline ML track.

Specification: Section 10.1 & Milestone 2 O1
Outputs ml/data/taxonomy/taxonomy.jsonl with 150 concepts.
"""

from __future__ import annotations

import json
from pathlib import Path
from vhagar.db.seed_taxonomy import CONCEPTS_DATA

OUTPUT_DIR = Path("ml/data/taxonomy")
OUTPUT_FILE = OUTPUT_DIR / "taxonomy.jsonl"


def build_taxonomy():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for c in CONCEPTS_DATA:
            rec = {
                "concept_id": c["concept_id"],
                "label": c["label"],
                "definition": c["definition"],
                "parent_id": c["parent_id"],
                "kind": c["kind"],
                "jurisdiction": c["jurisdiction"],
                "source_ref": f"Taxonomy-v1.0-{c['kind']}",
            }
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1

    print(f"Successfully generated {count} canonical concepts in {OUTPUT_FILE}")


if __name__ == "__main__":
    build_taxonomy()

