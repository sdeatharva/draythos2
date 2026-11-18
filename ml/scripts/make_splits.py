"""Grouped split generation for Draythos ML Track.

Specification: Section 10.1 & Milestone 2 O1
Enforces zero group leakage by partitioning connected phrase_family_id groups.
Produces:
1. ml/data/splits/split_main.json: ~70% train, ~15% val (model_selection + calibration), ~15% test
2. ml/data/splits/split_cross_jur.json: Held-out jurisdiction (withholding IN)
"""

from __future__ import annotations

import json
import random
from collections import defaultdict
from pathlib import Path

VARIANTS_FILE = Path("ml/data/variants/variants.jsonl")
SPLITS_DIR = Path("ml/data/splits")
MAIN_SPLIT_FILE = SPLITS_DIR / "split_main.json"
CROSS_JUR_FILE = SPLITS_DIR / "split_cross_jur.json"


def make_splits(seed: int = 42):
    random.seed(seed)
    SPLITS_DIR.mkdir(parents=True, exist_ok=True)

    if not VARIANTS_FILE.exists():
        raise FileNotFoundError(f"Missing {VARIANTS_FILE}. Run build_variants.py first.")

    # 1. Load variants and group by phrase_family_id
    records = []
    family_members = defaultdict(list)

    with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                records.append(r)
                family_members[r["phrase_family_id"]].append(r["example_id"])

    families = list(family_members.keys())
    random.shuffle(families)

    total_records = len(records)
    target_train = int(total_records * 0.70)
    target_val = int(total_records * 0.15)

    train_fam, val_fam, test_fam = [], [], []
    train_count = 0
    val_count = 0

    for fam in families:
        fam_size = len(family_members[fam])
        if train_count + fam_size <= target_train:
            train_fam.append(fam)
            train_count += fam_size
        elif val_count + fam_size <= target_val:
            val_fam.append(fam)
            val_count += fam_size
        else:
            test_fam.append(fam)

    # Sub-partition validation into model_selection (60%) and calibration (40%)
    random.shuffle(val_fam)
    val_select_fam = []
    val_calib_fam = []
    val_sel_target = int(len(val_fam) * 0.60)

    for idx, fam in enumerate(val_fam):
        if idx < val_sel_target:
            val_select_fam.append(fam)
        else:
            val_calib_fam.append(fam)

    train_ids = [ex for fam in train_fam for ex in family_members[fam]]
    val_select_ids = [ex for fam in val_select_fam for ex in family_members[fam]]
    val_calib_ids = [ex for fam in val_calib_fam for ex in family_members[fam]]
    test_ids = [ex for fam in test_fam for ex in family_members[fam]]

    split_main = {
        "seed": seed,
        "total_examples": total_records,
        "train": train_ids,
        "val_model_selection": val_select_ids,
        "val_calibration": val_calib_ids,
        "test": test_ids,
        "family_partitions": {
            "train_families": train_fam,
            "val_select_families": val_select_fam,
            "val_calib_families": val_calib_fam,
            "test_families": test_fam,
        },
    }

    with open(MAIN_SPLIT_FILE, "w", encoding="utf-8") as f:
        json.dump(split_main, f, indent=2)

    print(
        f"Main Split created: {len(train_ids)} train, {len(val_select_ids)} val_sel, "
        f"{len(val_calib_ids)} val_calib, {len(test_ids)} test. Zero group leakage guaranteed."
    )

    # 2. Cross-Jurisdiction Split: Withhold IN (India / CBIC) entirely
    in_examples = [r["example_id"] for r in records if r["jurisdiction"] == "IN"]
    non_in_records = [r for r in records if r["jurisdiction"] != "IN"]

    # Partition non-IN records into train / val
    non_in_families = list(set(r["phrase_family_id"] for r in non_in_records))
    random.shuffle(non_in_families)
    split_pt = int(len(non_in_families) * 0.85)
    cj_train_fams = set(non_in_families[:split_pt])
    cj_val_fams = set(non_in_families[split_pt:])

    cj_train_ids = [r["example_id"] for r in non_in_records if r["phrase_family_id"] in cj_train_fams]
    cj_val_ids = [r["example_id"] for r in non_in_records if r["phrase_family_id"] in cj_val_fams]

    split_cross_jur = {
        "withheld_jurisdiction": "IN",
        "train": cj_train_ids,
        "val": cj_val_ids,
        "test_withheld_jurisdiction": in_examples,
        "description": "Training and validation omit jurisdiction IN; test evaluates zero-shot transfer onto IN concepts.",
    }

    with open(CROSS_JUR_FILE, "w", encoding="utf-8") as f:
        json.dump(split_cross_jur, f, indent=2)

    print(
        f"Cross-Jurisdiction Split created: {len(cj_train_ids)} train, {len(cj_val_ids)} val, "
        f"{len(in_examples)} test (Held-out IN)."
    )


if __name__ == "__main__":
    make_splits()

