"""CSV export of canonical facts and source citations."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Optional

from vhagar.db.repo import get_repo
from vhagar.components.extraction.locators import format_locator_display


def export_facts_to_csv(output_path: Path | str, repo=None, doc_id: Optional[str] = None) -> Path:
    r = repo or get_repo()
    facts, _ = r.list_facts(doc_id=doc_id, limit=5000)

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)

    headers = [
        "fact_id",
        "doc_id",
        "entity",
        "jurisdiction",
        "period",
        "raw_label",
        "canonical_concept_id",
        "canonical_concept_label",
        "value_raw",
        "value_num",
        "unit",
        "scale",
        "confidence",
        "state",
        "match_method",
        "locator",
    ]

    with open(out, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for fact in facts:
            writer.writerow([
                fact["fact_id"],
                fact.get("doc_id", ""),
                fact.get("entity", ""),
                fact.get("jurisdiction", "GLOBAL"),
                fact.get("period", {}).get("label", ""),
                fact.get("raw_label", ""),
                fact.get("concept_id", ""),
                fact.get("concept_label", ""),
                fact.get("value_raw", ""),
                fact.get("value_num", ""),
                fact.get("unit", ""),
                fact.get("scale", 1.0),
                fact.get("confidence", 0.0),
                fact.get("state", ""),
                fact.get("match_method", ""),
                format_locator_display(fact.get("locator", {})),
            ])

    return out

