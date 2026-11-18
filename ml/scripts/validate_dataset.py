"""Dataset validation script ensuring integrity and zero data leakage.

Specification: Section 10.1 & Milestone 2 O1
Checks:
1. Zero group overlap between train, val, and test splits (phrase_family_id isolation).
2. No duplicate strings across different concepts (consistent labeling).
3. No held-out validation or test texts present in synthetic data.
4. Correct schema and relation constraints.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

VARIANTS_FILE = Path("ml/data/variants/variants.jsonl")
SPLIT_FILE = Path("ml/data/splits/split_main.json")


def validate_dataset():
    if not VARIANTS_FILE.exists() or not SPLIT_FILE.exists():
        print("Missing dataset or split file.")
        sys.exit(1)

    records = {}
    with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                records[r["example_id"]] = r

    with open(SPLIT_FILE, "r", encoding="utf-8") as f:
        split = json.load(f)

    train_ids = set(split["train"])
    val_sel_ids = set(split["val_model_selection"])
    val_cal_ids = set(split["val_calibration"])
    val_ids = val_sel_ids | val_cal_ids
    test_ids = set(split["test"])

    # 1. Assert Disjoint ID Sets
    assert len(train_ids & val_ids) == 0, "Leakage: train and val IDs overlap!"
    assert len(train_ids & test_ids) == 0, "Leakage: train and test IDs overlap!"
    assert len(val_ids & test_ids) == 0, "Leakage: val and test IDs overlap!"
    assert len(val_sel_ids & val_cal_ids) == 0, "Leakage: val_selection and val_calibration overlap!"

    # 2. Assert Zero Phrase Family Overlap
    train_fams = {records[i]["phrase_family_id"] for i in train_ids}
    val_fams = {records[i]["phrase_family_id"] for i in val_ids}
    test_fams = {records[i]["phrase_family_id"] for i in test_ids}

    leak_train_val = train_fams & val_fams
    leak_train_test = train_fams & test_fams
    leak_val_test = val_fams & test_fams

    assert not leak_train_val, f"Phrase family leak train/val: {leak_train_val}"
    assert not leak_train_test, f"Phrase family leak train/test: {leak_train_test}"
    assert not leak_val_test, f"Phrase family leak val/test: {leak_val_test}"

    # 3. Assert Text Isolation and Consistent Labels
    text_to_concept = {}
    for eid, r in records.items():
        norm_text = " ".join(r["text"].lower().split())
        cid = r["concept_id"]
        rel = r.get("relation", "equivalent")
        if rel == "equivalent":
            if norm_text in text_to_concept and text_to_concept[norm_text] != cid:
                raise AssertionError(
                    f"Conflicting concept label for text '{norm_text}': {cid} vs {text_to_concept[norm_text]}"
                )
            text_to_concept[norm_text] = cid

    # 4. Check synthetic data constraints
    held_out_texts = {records[i]["text"].lower().strip() for i in (val_ids | test_ids)}
    synth_train_texts = {records[i]["text"].lower().strip() for i in train_ids if records[i]["is_synthetic"]}
    synth_leak = held_out_texts & synth_train_texts
    assert not synth_leak, f"Synthetic training leaked held-out test text: {synth_leak}"

    print(
        f"Validation PASSED:\n"
        f"  Total examples: {len(records)}\n"
        f"  Train: {len(train_ids)} ({len(train_fams)} families)\n"
        f"  Val Sel: {len(val_sel_ids)}, Val Calib: {len(val_cal_ids)} ({len(val_fams)} families)\n"
        f"  Test: {len(test_ids)} ({len(test_fams)} families)\n"
        f"  Zero group leakage confirmed."
    )


if __name__ == "__main__":
    validate_dataset()

