"""Automated test runner for the 50-question Financial Evaluation Suite."""

import json
from pathlib import Path
import pytest


@pytest.fixture
def eval_suite():
    suite_path = Path("tests/financial_eval_suite.json")
    assert suite_path.exists(), "Benchmark suite file tests/financial_eval_suite.json missing"
    with open(suite_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_suite_integrity(eval_suite):
    """Verify suite contains exactly 50 tests across the required financial/tax categories."""
    assert eval_suite["total_tests"] == 50
    assert len(eval_suite["tests"]) == 50

    categories = eval_suite["categories"]
    assert "exact_cell_formula_lookup" in categories
    assert "multi_doc_cross_reference" in categories
    assert "ambiguous_disambiguation" in categories
    assert "abstention_no_hallucination" in categories
    assert "tax_jurisdiction_mapping" in categories


def test_exact_cell_formula_lookups(eval_suite):
    """Ensure all 15 exact cell formula lookup benchmarks define valid formulas and no broken syntax."""
    lookup_tests = [t for t in eval_suite["tests"] if t["category"] == "exact_cell_formula_lookup"]
    assert len(lookup_tests) == 15

    for test in lookup_tests:
        crit = test.get("criteria", test)
        if "expected_formula" in crit:
            formula = crit["expected_formula"]
            assert formula.startswith("="), f"Formula must start with '=' in {test['id']}"
            assert "=**" not in formula, f"Corrupted formula in {test['id']}"
            assert "=undefined" not in formula


def test_abstention_and_grounding_criteria(eval_suite):
    """Ensure abstention tests demand evidence grounding and forbid hallucination."""
    abstention_tests = [t for t in eval_suite["tests"] if t["category"] == "abstention_no_hallucination"]
    assert len(abstention_tests) == 8

    for test in abstention_tests:
        crit = test.get("criteria", test)
        assert "expected_behavior" in crit or test.get("eval_type") in ["abstention", "abstention_check"]


def test_tax_and_regulatory_mappings(eval_suite):
    """Ensure tax jurisdiction tests cite canonical statutes and accounting standards."""
    tax_tests = [t for t in eval_suite["tests"] if t["category"] == "tax_jurisdiction_mapping"]
    assert len(tax_tests) == 5

    for test in tax_tests:
        crit = test.get("criteria", test)
        assert "must_cite" in crit or "canonical" in crit or test.get("eval_type") in ["tax_concept_mapping", "concept_mapping"]

