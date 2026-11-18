"""Evaluation of Calibrated Abstention Gate.

Specification: Section 10.5 & Milestone 2 O4
Metrics:
- Accepted Precision (target >= 95%)
- Known Coverage (target >= 70%)
- Accepted-Correct Recall
- Unknown False-Accept Rate (evaluated on 50 test unknown terms)
- Precision-Coverage curve
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence, Tuple
import numpy as np


def evaluate_abstention(
    known_predictions: List[Dict[str, Any]],
    unknown_predictions: List[Dict[str, Any]],
    threshold: float,
) -> Dict[str, Any]:
    """Evaluate abstention performance on frozen test data including unknowns."""
    # Known predictions: {text, true_concept, pred_concept, prob}
    # Unknown predictions: {text, prob}

    total_known = len(known_predictions)
    total_unknown = len(unknown_predictions)

    known_accepted = [p for p in known_predictions if p["prob"] >= threshold]
    known_abstained = [p for p in known_predictions if p["prob"] < threshold]

    # Accepted true positives (correct concept) and false positives (wrong concept)
    tp = sum(1 for p in known_accepted if p["pred_concept"] == p["true_concept"])
    fp_known = sum(1 for p in known_accepted if p["pred_concept"] != p["true_concept"])

    # Unknown false accepts (any accepted unknown counts as an error)
    unknown_accepted = [p for p in unknown_predictions if p["prob"] >= threshold]
    fp_unknown = len(unknown_accepted)

    total_accepted = len(known_accepted) + fp_unknown
    accepted_precision = float(tp / total_accepted) if total_accepted > 0 else 1.0
    known_coverage = float(len(known_accepted) / total_known) if total_known > 0 else 0.0
    accepted_correct_recall = float(tp / total_known) if total_known > 0 else 0.0
    unknown_false_accept_rate = float(fp_unknown / total_unknown) if total_unknown > 0 else 0.0

    # Build precision-coverage curve across thresholds [0.50 to 0.98]
    curve = []
    for tau in np.linspace(0.50, 0.98, 25):
        k_acc = [p for p in known_predictions if p["prob"] >= tau]
        u_acc = [p for p in unknown_predictions if p["prob"] >= tau]
        c_tp = sum(1 for p in k_acc if p["pred_concept"] == p["true_concept"])
        tot_acc = len(k_acc) + len(u_acc)
        prec = float(c_tp / tot_acc) if tot_acc > 0 else 1.0
        cov = float(len(k_acc) / total_known) if total_known > 0 else 0.0
        curve.append({
            "threshold": round(float(tau), 3),
            "precision": round(prec, 4),
            "coverage": round(cov, 4),
            "accepted_count": tot_acc,
        })

    return {
        "threshold": round(threshold, 3),
        "total_known_test": total_known,
        "total_unknown_test": total_unknown,
        "accepted_known": len(known_accepted),
        "abstained_known": len(known_abstained),
        "unknown_falsely_accepted": fp_unknown,
        "accepted_precision": round(accepted_precision, 4),
        "known_coverage": round(known_coverage, 4),
        "accepted_correct_recall": round(accepted_correct_recall, 4),
        "unknown_false_accept_rate": round(unknown_false_accept_rate, 4),
        "precision_coverage_curve": curve,
    }

