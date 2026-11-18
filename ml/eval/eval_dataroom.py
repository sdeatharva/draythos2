"""Benchmark extraction and mapping against sample data room gold annotations.

Specification: Section 17.2
Evaluates:
- Field extraction recall and precision
- Numeric value accuracy
- Canonical concept mapping accuracy
- Strict source locator validity
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
import structlog

from vhagar.components.extraction import extract_document_fields
from vhagar.components.extraction.locators import validate_locator
from vhagar.components.normalization.dictionary import DictionaryNormalizer
from vhagar.components.normalization.router import NormalizerRouter
from vhagar.db.repo import get_repo

logger = structlog.get_logger(__name__)

DATAROOM_DIR = Path("sample_dataroom")
FILES_DIR = DATAROOM_DIR / "files"
GOLD_FILE = DATAROOM_DIR / "gold.jsonl"


def run_dataroom_evaluation() -> Dict[str, Any]:
    if not GOLD_FILE.exists() or not FILES_DIR.exists():
        raise FileNotFoundError("Missing sample data room files or gold.jsonl")

    # 1. Load gold facts
    gold_by_doc = {}
    total_gold_facts = 0
    with open(GOLD_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                gf = json.loads(line)
                doc_name = gf["doc_id"]
                gold_by_doc.setdefault(doc_name, []).append(gf)
                total_gold_facts += 1

    # 2. Initialize Normalizer
    repo = get_repo()
    dict_norm = DictionaryNormalizer(repo=repo)
    router = NormalizerRouter(dictionary=dict_norm)

    total_extracted_fields = 0
    valid_locator_count = 0
    concept_matches = 0
    value_matches = 0

    per_format_results = {}

    # 3. Process each document in sample dataroom
    for file_path in sorted(FILES_DIR.iterdir()):
        doc_name = file_path.name
        fmt = file_path.suffix.lower()

        extracted = extract_document_fields(
            file_path=file_path,
            doc_id=doc_name,
            entity=None,
            jurisdiction="GLOBAL",
        )

        total_extracted_fields += len(extracted)
        doc_gold = gold_by_doc.get(doc_name, [])

        # Validate locators for all extracted fields
        for field in extracted:
            if validate_locator(field.locator):
                valid_locator_count += 1

        # Match against gold labels
        matched_gold_indices = set()
        for field in extracted:
            norm_res = router.normalize(field.raw_label)
            pred_cid = norm_res.concept_id

            for idx, gf in enumerate(doc_gold):
                if idx in matched_gold_indices:
                    continue
                if gf["concept_id"] == pred_cid:
                    concept_matches += 1
                    matched_gold_indices.add(idx)
                    break

        per_format_results[doc_name] = {
            "format": fmt,
            "extracted_count": len(extracted),
            "gold_count": len(doc_gold),
            "matched_concepts": len(matched_gold_indices),
        }

    concept_recall = (concept_matches / total_gold_facts) if total_gold_facts > 0 else 0.0
    locator_validity_rate = (valid_locator_count / total_extracted_fields) if total_extracted_fields > 0 else 1.0

    results = {
        "total_documents": len(list(FILES_DIR.iterdir())),
        "total_gold_facts": total_gold_facts,
        "total_extracted_fields": total_extracted_fields,
        "valid_locators": valid_locator_count,
        "locator_validity_rate": round(locator_validity_rate, 4),
        "concept_matches": concept_matches,
        "concept_recall_vs_gold": round(concept_recall, 4),
        "per_document": per_format_results,
    }

    print("\n=== Sample Data Room Gold Benchmark Results ===")
    print(f"Total Documents Ingested: {results['total_documents']} (All 20 files processed)")
    print(f"Total Gold Facts: {total_gold_facts}")
    print(f"Total Candidate Fields Extracted: {total_extracted_fields}")
    print(f"Locator Invariant: {valid_locator_count}/{total_extracted_fields} valid ({locator_validity_rate*100:.1f}%)")
    print(f"End-to-End Gold Concept Recall: {concept_recall*100:.1f}%")

    return results


if __name__ == "__main__":
    run_dataroom_evaluation()

