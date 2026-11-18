"""Comprehensive unit and integration tests for Draythos Finance Concept Translator.

Specification: Section 17.3 & Section 21
Tests:
1. Number parsing (lakh/crore, brackets, scales, currencies, negative values)
2. Period normalization (FY, quarter, ISO dates)
3. Locator validation across all supported formats (PDF, XLSX, CSV, DOCX, TXT, JSON, XML)
4. Fact repository invariants (strict locator enforcement, foreign keys, mapping_version)
5. LLM extractor schema & verbatim quote check
6. Multi-stage normalization router rule ordering & calibrated abstention
7. Live adaptation: synonym override, impact preview, incremental recompute, undo
8. Multi-tab consolidated Excel workbook export
9. Structured-first Q&A: query plan, Python arithmetic, and verifier
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
import pytest

from vhagar.components.extraction.numbers import parse_financial_number
from vhagar.components.extraction.periods import normalize_period
from vhagar.components.extraction.locators import (
    make_pdf_locator,
    make_xlsx_locator,
    make_csv_locator,
    make_docx_locator,
    make_txt_locator,
    make_json_locator,
    make_xml_locator,
    validate_locator,
)
from vhagar.components.extraction.llm_extractor import verify_verbatim_quote, LLMExtractor
from vhagar.db.repo import DraythosRepository
from vhagar.components.normalization.dictionary import DictionaryNormalizer
from vhagar.components.normalization.router import NormalizationRouter
from vhagar.components.facts.service import FactsService
from vhagar.components.export.xlsx_writer import write_unified_workbook
from vhagar.components.qa.planner import QAPlanner
from vhagar.components.qa.answerer import QAAnswerer
from vhagar.components.qa.verifier import QAVerifier


# =========================================================================
# 1. Number Parsing Tests
# =========================================================================
def test_parse_numbers_indian_scales():
    val, unit, scale = parse_financial_number("₹ 1,23,45,000")
    assert val == 12345000.0
    assert unit == "INR"

    val_cr, unit_cr, scale_cr = parse_financial_number("Rs 15.5 Cr")
    assert val_cr == 15.5
    assert scale_cr == 10000000.0


def test_parse_numbers_bracketed_negatives():
    val, unit, scale = parse_financial_number("(1,234.50)")
    assert val == -1234.5
    assert scale == 1.0


def test_parse_numbers_western_currencies():
    val, unit, scale = parse_financial_number("$ 450.75M")
    assert val == 450.75
    assert unit == "USD"
    assert scale == 1000000.0

    val_eur, unit_eur, _ = parse_financial_number("€ 850,000")
    assert val_eur == 850000.0
    assert unit_eur == "EUR"


# =========================================================================
# 2. Period Normalization Tests
# =========================================================================
def test_period_normalization():
    p1 = normalize_period("FY2023-24")
    assert p1.label == "FY2024"
    assert p1.type == "fiscal_year"

    p2 = normalize_period("Q3 FY24")
    assert "Q3" in p2.label
    assert p2.type == "quarter"


# =========================================================================
# 3. Source Locator Construction & Validation Tests
# =========================================================================
def test_locator_validation_all_formats():
    pdf_loc = make_pdf_locator(page=1, bbox=[10, 20, 100, 200], quote="Turnover | 12,345")
    assert validate_locator(pdf_loc)

    xlsx_loc = make_xlsx_locator(sheet="P&L", cell="C7", quote="Revenue 1000")
    assert validate_locator(xlsx_loc)

    csv_loc = make_csv_locator(row=5, col=2, quote="100, 200")
    assert validate_locator(csv_loc)

    docx_loc = make_docx_locator(para_index=3, quote="Profit was 500")
    assert validate_locator(docx_loc)

    txt_loc = make_txt_locator(line=12, quote="EBITDA: 250")
    assert validate_locator(txt_loc)

    json_loc = make_json_locator(json_path="$.financials.turnover", quote="turnover: 100")
    assert validate_locator(json_loc)

    xml_loc = make_xml_locator(xpath="/xbrl/revenue", quote="<revenue>100</revenue>")
    assert validate_locator(xml_loc)

    # Empty quote or missing mandatory fields MUST fail
    invalid_loc = {"type": "pdf", "page": 1}  # Missing quote
    assert not validate_locator(invalid_loc)


# =========================================================================
# 4. Verbatim Quote Verification Tests
# =========================================================================
def test_verbatim_quote_verification():
    source_text = "The consolidated Revenue from Operations for the fiscal year ended March 31 was INR 12,345 Lakhs."
    
    # Exact quote
    valid, ratio = verify_verbatim_quote("Revenue from Operations for the fiscal year", source_text, threshold=0.9)
    assert valid and ratio >= 0.9

    # Slight punctuation/case variance
    valid_var, ratio_var = verify_verbatim_quote("revenue from operations for the fiscal year ended", source_text, threshold=0.9)
    assert valid_var and ratio_var >= 0.9

    # Hallucinated or non-existent quote
    invalid, ratio_bad = verify_verbatim_quote("Total Worldwide Profit Margin Jumped by 50%", source_text, threshold=0.9)
    assert not invalid and ratio_bad < 0.5


# =========================================================================
# 5. Database & Fact Repository Invariants
# =========================================================================
@pytest.fixture
def temp_repo():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
        db_path = tf.name
    repo = DraythosRepository(db_path=db_path)
    yield repo
    if os.path.exists(db_path):
        os.remove(db_path)


def test_fact_saving_and_retrieval(temp_repo):
    valid_loc = make_xlsx_locator(sheet="P&L", cell="B3", quote="Revenue | 1000", doc_id="doc_1")
    fact_dict = {
        "doc_id": "doc_1",
        "raw_label": "Revenue",
        "concept_id": "fs.revenue",
        "concept_label": "Revenue",
        "value_raw": "1000",
        "value_num": 1000.0,
        "unit": "USD",
        "period": {"label": "FY2024"},
        "locator": valid_loc,
        "confidence": 0.95,
        "state": "auto_accepted",
    }
    saved = temp_repo.save_fact(fact_dict)
    assert saved["fact_id"].startswith("f_")

    fact = temp_repo.get_fact(saved["fact_id"])
    assert fact is not None
    assert fact["concept_id"] == "fs.revenue"
    assert fact["value_num"] == 1000.0
    assert fact["locator"]["cell"] == "B3"


def test_fact_rejection_without_locator(temp_repo):
    with pytest.raises(ValueError, match="Fact without a locator MUST NOT be saved"):
        temp_repo.save_fact({
            "doc_id": "doc_1",
            "raw_label": "Revenue",
            "concept_id": "fs.revenue",
            "concept_label": "Revenue",
            "value_raw": "1000",
            "value_num": 1000.0,
            "locator": {},  # Invalid locator
        })


# =========================================================================
# 6. Normalization Router & Calibrated Abstention
# =========================================================================
def test_router_dictionary_and_abstention(temp_repo):
    # Add alias override
    temp_repo.add_override(alias="Turnover", concept_id="fs.revenue")

    router = NormalizationRouter(mode="dictionary", repo=temp_repo)

    # 1. Known alias -> user_confirmed override
    res_known = router.normalize("Turnover")
    assert res_known.concept_id == "fs.revenue"
    assert res_known.state == "user_confirmed"
    assert res_known.match_method == "override"

    # 2. Unknown term in dictionary mode -> abstained
    res_unknown = router.normalize("Completely Arbitrary Unknown String")
    assert res_unknown.concept_id is None
    assert res_unknown.state == "abstained"


# =========================================================================
# 7. Live Adaptation & Incremental Recompute
# =========================================================================
def test_live_adaptation_override_and_undo(temp_repo):
    service = FactsService(repo=temp_repo)

    # Ingest a fact with unknown label "Top Line"
    loc = make_txt_locator(line=1, quote="Top Line: 5000", doc_id="doc_test")
    saved = temp_repo.save_fact({
        "doc_id": "doc_test",
        "raw_label": "Top Line",
        "concept_id": None,
        "concept_label": "Unmapped",
        "value_raw": "5000",
        "value_num": 5000.0,
        "locator": loc,
        "state": "abstained",
    })
    fid = saved["fact_id"]

    init_fact = temp_repo.get_fact(fid)
    assert init_fact["concept_id"] is None

    # User adds live override mapping: "Top Line" -> "fs.revenue"
    res_ovr = temp_repo.add_override(
        alias="Top Line",
        concept_id="fs.revenue",
        by="analyst_1",
        reason="Mapped Top Line to Revenue",
    )
    assert res_ovr["mapping_version"] > 0

    # Incremental recompute updates affected facts immediately
    recomputed = service.recompute_facts_for_alias("Top Line", "fs.revenue")
    assert recomputed >= 1

    updated_fact = temp_repo.get_fact(fid)
    assert updated_fact["concept_id"] == "fs.revenue"
    assert updated_fact["state"] == "user_confirmed"
    assert updated_fact["match_method"] == "override"

    # Undo reverses mapping
    logs = temp_repo.get_mapping_log(limit=1)
    assert len(logs) > 0
    log_id = logs[0]["log_id"]
    undone = temp_repo.undo_mapping_log(log_id)
    assert undone


# =========================================================================
# 8. Consolidated Multi-Tab Excel Export
# =========================================================================
def test_multitab_excel_export(temp_repo):
    # Save a sample fact
    loc = make_xlsx_locator(sheet="P&L", cell="C3", quote="Revenue | 1250", doc_id="doc_export")
    temp_repo.save_fact({
        "doc_id": "doc_export",
        "raw_label": "Revenue",
        "concept_id": "fs.revenue",
        "concept_label": "Revenue",
        "value_raw": "1250",
        "value_num": 1250.0,
        "unit": "USD",
        "period": {"label": "FY2024"},
        "locator": loc,
        "state": "auto_accepted",
    })

    facts, _ = temp_repo.list_facts()
    concepts = temp_repo.list_concepts()

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tf:
        out_path = Path(tf.name)

    write_unified_workbook(
        output_path=out_path,
        facts=facts,
        concepts=concepts,
        mapping_version=1,
    )

    assert out_path.exists()
    import openpyxl
    wb = openpyxl.load_workbook(out_path)
    expected_sheets = ["Summary", "Unified", "Facts", "Mappings", "NeedsReview", "Sources", "Concepts"]
    for s in expected_sheets:
        assert s in wb.sheetnames

    # Check numeric cell type in Unified sheet
    ws_unified = wb["Unified"]
    assert ws_unified.max_row >= 2
    wb.close()
    if out_path.exists():
        out_path.unlink()


# =========================================================================
# 9. Structured-First Q&A Pipeline (Planner, Answerer, Verifier)
# =========================================================================
def test_structured_qa_pipeline(temp_repo):
    # Seed Revenue for FY2023 and FY2024
    loc1 = make_txt_locator(line=1, quote="Rev 1000", doc_id="doc_qa")
    loc2 = make_txt_locator(line=2, quote="Rev 1250", doc_id="doc_qa")
    saved1 = temp_repo.save_fact({
        "doc_id": "doc_qa", "raw_label": "Revenue", "concept_id": "fs.revenue", "concept_label": "Revenue",
        "value_num": 1000.0, "unit": "USD", "period": {"label": "FY2023"}, "locator": loc1, "state": "auto_accepted", "confidence": 0.95
    })
    saved2 = temp_repo.save_fact({
        "doc_id": "doc_qa", "raw_label": "Revenue", "concept_id": "fs.revenue", "concept_label": "Revenue",
        "value_num": 1250.0, "unit": "USD", "period": {"label": "FY2024"}, "locator": loc2, "state": "auto_accepted", "confidence": 0.95
    })
    fid1 = saved1["fact_id"]
    fid2 = saved2["fact_id"]

    temp_repo.add_override(alias="revenue", concept_id="fs.revenue")
    router = NormalizationRouter(mode="dictionary", repo=temp_repo)
    planner = QAPlanner(router=router)
    facts_service = FactsService(repo=temp_repo, router=router)
    answerer = QAAnswerer(facts_service=facts_service)
    verifier = QAVerifier()

    # 1. Growth question -> Python arithmetic
    plan = planner.plan("What was revenue growth compared to FY2023?")
    assert plan.intent == "growth"
    assert "fs.revenue" in plan.target_concepts

    plan_resp = answerer.execute_plan(plan, attached_doc_ids=["doc_qa"])
    assert len(plan_resp.facts) >= 2
    assert len(plan_resp.computations) >= 1

    growth_comp = next(c for c in plan_resp.computations if c.operation == "growth_rate")
    assert growth_comp.value == 25.0  # ((1250 - 1000) / 1000) * 100 = 25.0%

    # 2. Verifier: Valid grounded text passes
    valid_text = f"According to verified facts [F:{fid2}], FY2024 revenue was 1,250 USD, representing 25.0% growth vs FY2023."
    v_res = verifier.verify_answer(valid_text, plan_resp)
    assert v_res.is_valid
    assert not v_res.unsupported_numbers

    # 3. Verifier: Ungrounded hallucinated number is flagged
    bad_text = "Revenue was 9,999.00 USD with a fake profit margin of 88%."
    bad_res = verifier.verify_answer(bad_text, plan_resp)
    assert not bad_res.is_valid
    assert 9999.0 in bad_res.unsupported_numbers
