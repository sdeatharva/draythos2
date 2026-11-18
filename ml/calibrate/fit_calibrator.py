"""Fit logistic regression calibrator on reserved calibration partition.

Specification: Section 9.4 & Milestone 2 Objective O4
Features: s1 (top cosine similarity) and (s1 - s2) (top margin)
Threshold: tau chosen as lowest value achieving >= 95% accepted precision on calibration data.
Includes 50 validation-unknown terms (accepted unknown = precision error).
"""

from __future__ import annotations

import json
from pathlib import Path
import numpy as np
from sklearn.linear_model import LogisticRegression

TAXONOMY_FILE = Path("ml/data/taxonomy/taxonomy.jsonl")
VARIANTS_FILE = Path("ml/data/variants/variants.jsonl")
SPLIT_FILE = Path("ml/data/splits/split_main.json")
UNKNOWNS_FILE = Path("ml/data/unknowns/unknowns.jsonl")
OUTPUT_DIR = Path("ml/runs/calibrator")


def fit_calibrator(model=None, target_precision: float = 0.95):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load taxonomy prototypes
    concepts = []
    prototypes = []
    with open(TAXONOMY_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                c = json.loads(line)
                concepts.append(c["concept_id"])
                prototypes.append(f"{c['label']}. {c['definition']}")

    # Embed prototypes
    if model is None:
        from sentence_transformers import SentenceTransformer
        # Check if stage2 checkpoint exists, else stage1, else base
        for candidate in ["ml/runs/stage2_checkpoint", "ml/runs/stage1_checkpoint", "all-MiniLM-L6-v2"]:
            try:
                model = SentenceTransformer(candidate)
                print(f"Loaded embedding model: {candidate}")
                break
            except Exception:
                continue

    proto_vecs = model.encode(prototypes, normalize_embeddings=True, show_progress_bar=False)

    # 2. Load calibration split items
    with open(SPLIT_FILE, "r", encoding="utf-8") as f:
        split = json.load(f)
    calib_ids = set(split["val_calibration"])

    known_calib_items = []
    with open(VARIANTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                r = json.loads(line)
                if r["example_id"] in calib_ids and r.get("relation") == "equivalent":
                    known_calib_items.append((r["text"], r["concept_id"]))

    # 3. Load 50 validation unknowns
    unknown_calib_items = []
    with open(UNKNOWNS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                u = json.loads(line)
                if u.get("split") == "val":
                    unknown_calib_items.append((u["text"], "out_of_taxonomy"))

    print(
        f"Calibration set: {len(known_calib_items)} known terms, "
        f"{len(unknown_calib_items)} validation unknown terms."
    )

    # 4. Extract features (s1, s1 - s2) and true labels (1 if top-1 correct known, 0 if incorrect or unknown)
    all_texts = [t for t, _ in known_calib_items] + [t for t, _ in unknown_calib_items]
    true_labels = [c for _, c in known_calib_items] + [c for _, c in unknown_calib_items]

    text_vecs = model.encode(all_texts, normalize_embeddings=True, show_progress_bar=False)
    sims = np.dot(text_vecs, proto_vecs.T)  # (N, num_concepts)

    X = []
    y = []

    for i in range(len(all_texts)):
        row = sims[i]
        top_indices = np.argsort(row)[::-1]
        s1 = float(row[top_indices[0]])
        s2 = float(row[top_indices[1]])
        margin = s1 - s2

        pred_concept = concepts[top_indices[0]]
        true_concept = true_labels[i]

        # Binary label: 1 if prediction matches true concept; 0 if wrong or unknown
        is_correct = 1 if pred_concept == true_concept else 0

        X.append([s1, margin])
        y.append(is_correct)

    X = np.array(X)
    y = np.array(y)

    # 5. Fit Logistic Regression
    clf = LogisticRegression(C=1.0, random_state=42)
    clf.fit(X, y)

    probs = clf.predict_proba(X)[:, 1]

    # 6. Find threshold tau for >= target_precision (0.95)
    best_tau = 0.5
    best_precision = 0.0
    best_coverage = 0.0

    thresholds = np.linspace(0.40, 0.99, 100)
    for tau in thresholds:
        accepted_mask = probs >= tau
        num_accepted = int(np.sum(accepted_mask))
        if num_accepted == 0:
            continue
        precision = float(np.sum(y[accepted_mask]) / num_accepted)
        coverage = float(num_accepted / len(known_calib_items))  # Coverage over known terms

        if precision >= target_precision:
            best_tau = float(tau)
            best_precision = precision
            best_coverage = coverage
            break

    print(
        f"Calibrator Fitted:\n"
        f"  Coefficients: {clf.coef_[0].tolist()}, Intercept: {clf.intercept_[0]:.4f}\n"
        f"  Selected Tau: {best_tau:.3f}\n"
        f"  Accepted Precision on Calib: {best_precision*100:.1f}%\n"
        f"  Known Coverage: {best_coverage*100:.1f}%"
    )

    # 7. Save calibrator.json & threshold.json
    calib_meta = {
        "features": ["s1", "s1_minus_s2"],
        "coefficients": clf.coef_[0].tolist(),
        "intercept": float(clf.intercept_[0]),
        "calibration_samples": len(X),
        "target_precision": target_precision,
    }
    with open(OUTPUT_DIR / "calibrator.json", "w", encoding="utf-8") as f:
        json.dump(calib_meta, f, indent=2)

    thresh_meta = {
        "threshold": best_tau,
        "accepted_precision": best_precision,
        "known_coverage": best_coverage,
    }
    with open(OUTPUT_DIR / "threshold.json", "w", encoding="utf-8") as f:
        json.dump(thresh_meta, f, indent=2)

    return clf, best_tau, proto_vecs, concepts


if __name__ == "__main__":
    fit_calibrator()

