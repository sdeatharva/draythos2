"""Pivot and unification of canonical financial facts across documents."""

from __future__ import annotations

from typing import Any, Dict, List
import structlog

from vhagar.db.repo import get_repo
from vhagar.components.extraction.locators import format_locator_display

logger = structlog.get_logger(__name__)


def build_unified_financial_matrix(
    repo=None,
    doc_id: str | None = None,
    accepted_only: bool = False,
) -> Dict[str, Any]:
    """Consolidate facts into a unified concept x period matrix."""
    r = repo or get_repo()
    facts, _ = r.list_facts(doc_id=doc_id, limit=2000)

    if accepted_only:
        facts = [f for f in facts if f["state"] in ("auto_accepted", "user_confirmed")]

    # Collect unique periods
    periods = []
    seen_periods = set()
    for f in facts:
        p_label = f.get("period", {}).get("label") or "Current"
        if p_label not in seen_periods:
            seen_periods.add(p_label)
            periods.append(p_label)

    # Sort periods (e.g. FY2022, FY2023, FY2024)
    periods.sort()

    # Group by concept_id
    concepts_map = {c["concept_id"]: c for c in r.list_concepts()}
    matrix_rows: Dict[str, Dict[str, Any]] = {}

    for f in facts:
        cid = f.get("concept_id") or "unmapped"
        concept_info = concepts_map.get(cid, {
            "label": f.get("raw_label") or "Unmapped",
            "kind": "fs",
            "parent_id": None,
        })

        if cid not in matrix_rows:
            matrix_rows[cid] = {
                "concept_id": cid,
                "concept_label": concept_info["label"],
                "kind": concept_info.get("kind", "fs"),
                "values_by_period": {},
                "locators_by_period": {},
                "raw_labels_by_period": {},
            }

        p_label = f.get("period", {}).get("label") or "Current"
        val = f.get("value_num") if f.get("value_num") is not None else f.get("value_raw")
        matrix_rows[cid]["values_by_period"][p_label] = val
        matrix_rows[cid]["locators_by_period"][p_label] = format_locator_display(f.get("locator", {}))
        matrix_rows[cid]["raw_labels_by_period"][p_label] = f.get("raw_label")

    return {
        "periods": periods,
        "rows": list(matrix_rows.values()),
        "total_facts": len(facts),
    }

