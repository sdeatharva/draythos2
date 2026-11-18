"""Export variant and negative pairs to CSV for team review.

Specification: Section 10.1
Both team members review all test positives and ambiguous/high-risk pairs independently.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

VARIANTS_FILE = Path("ml/data/variants/variants.jsonl")
NEGATIVES_FILE = Path("ml/data/negatives/negatives.jsonl")
OUTPUT_CSV = Path("ml/data/review_dataset.csv")


def export_review_csv():
    rows = []

    if VARIANTS_FILE.exists():
        with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    r = json.loads(line)
                    rows.append({
                        "type": "variant",
                        "id": r["example_id"],
                        "concept_id": r["concept_id"],
                        "text": r["text"],
                        "jurisdiction": r["jurisdiction"],
                        "relation": r.get("relation", "equivalent"),
                        "review_status": r.get("review_status", "pending"),
                        "notes": r.get("source_id", ""),
                    })

    if NEGATIVES_FILE.exists():
        with open(NEGATIVES_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    t = json.loads(line)
                    rows.append({
                        "type": "triplet",
                        "id": t["triplet_id"],
                        "concept_id": f"{t['anchor_concept']} vs {t['negative_concept']}",
                        "text": f"Anchor: '{t['anchor_text']}' | Neg: '{t['negative_text']}'",
                        "jurisdiction": "N/A",
                        "relation": "different",
                        "review_status": t.get("review_status", "pending"),
                        "notes": t.get("difficulty", ""),
                    })

    if rows:
        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"Exported {len(rows)} review items to {OUTPUT_CSV}")


if __name__ == "__main__":
    export_review_csv()

