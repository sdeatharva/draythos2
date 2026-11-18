"""JSON export for canonical facts and metadata."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from vhagar.db.repo import get_repo
from vhagar.db.seed_taxonomy import CAVEAT


def export_facts_to_json(output_path: Path | str, repo=None, doc_id: Optional[str] = None) -> Path:
    r = repo or get_repo()
    facts, total = r.list_facts(doc_id=doc_id, limit=5000)

    payload = {
        "export_metadata": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "total_facts": total,
            "mapping_version": r.get_mapping_version(),
            "taxonomy_version": "tax-1.0.0",
            "model_version": "enc-1.0.0",
            "caveat": CAVEAT,
        },
        "facts": facts,
    }

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, default=str)

    return out

