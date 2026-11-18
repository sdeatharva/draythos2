"""Standalone unit test suite using Python standard library (unittest)."""

import asyncio
import os
import shutil
import tempfile
import unittest
from pathlib import Path

from vhagar.config import VhagarConfig
from vhagar.components.concept_mapper import ConceptMapper
from vhagar.components.concept_memory import ConceptMemory
from vhagar.components.security import SecurityManager


class TestVhagarComponents(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="vhagar_test_")
        self.config = VhagarConfig(
            auth_secret="test-secret-key-12345",
            mcp_api_key="test-mcp-key-12345",
            data_dir=Path(self.temp_dir) / "data",
            logs_dir=Path(self.temp_dir) / "logs",
            fuzzy_threshold=0.6,
        )

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_security_manager(self):
        sec = SecurityManager(self.config)

        # File validation
        self.assertTrue(sec.validate_file_type("balance_sheet.xlsx"))
        self.assertTrue(sec.validate_file_type("report.pdf"))
        self.assertFalse(sec.validate_file_type("payload.exe"))

        # Sanitization
        safe = sec.sanitize_filename("../../../etc/passwd")
        self.assertNotIn("..", safe)
        self.assertNotIn("/", safe)

        # Session isolation
        sec.register_document_session("doc_1", "session_user1")
        sec.register_document_session("doc_2", "session_user2")

        self.assertTrue(sec.validate_session_access("session_user1", "doc_1"))
        self.assertFalse(sec.validate_session_access("session_user2", "doc_1"))
        self.assertFalse(sec.validate_session_access("session_user1", "doc_2"))

        # Secret hashing
        hashed = sec.hash_secret("MySecretPassword")
        self.assertTrue(sec.verify_secret("MySecretPassword", hashed))
        self.assertFalse(sec.verify_secret("WrongPassword", hashed))

    def test_concept_mapper(self):
        mapper = ConceptMapper(self.config)

        async def run_mapper():
            await mapper.add_mapping(
                canonical="VAT",
                synonyms=["Value Added Tax", "GST", "Sales Tax"],
                category="tax",
            )
            canon = await mapper.get_canonical("gst")
            self.assertEqual(canon, "VAT")

            expanded = await mapper.expand_term("GST")
            self.assertIn("VAT", expanded)
            self.assertIn("GST", expanded)
            self.assertIn("Sales Tax", expanded)

            # Fuzzy match
            canon_fuzzy = await mapper.get_canonical("SalesTax")
            self.assertIsNotNone(canon_fuzzy)

        asyncio.run(run_mapper())

    def test_concept_memory(self):
        memory = ConceptMemory(self.config)

        async def run_memory():
            count = await memory.ingest_from_document(
                document_id="doc_abc",
                terms=["ebitda", "revenue", "cashflow"],
                content_summary="Operating income metrics summary",
            )
            self.assertEqual(count, 3)

            rec = await memory.get_concept("ebitda")
            self.assertIsNotNone(rec)
            self.assertEqual(rec.concept_name, "ebitda")
            self.assertIn("doc_abc", rec.provenance)

            stats = await memory.get_stats()
            self.assertEqual(stats.total_concepts, 3)

        asyncio.run(run_memory())

    def test_taxonomy_and_functional_equivalence(self):
        """Verify Section 7.2 taxonomy rules: VAT & GST equivalent, Sales Tax distinct."""
        from vhagar.db.repo import DraythosRepository
        db_file = Path(self.temp_dir) / "test_draythos.db"
        repo = DraythosRepository(db_path=db_file)

        vat_match = repo.get_alias_match("VAT")
        gst_match = repo.get_alias_match("GST")
        turnover_match = repo.get_alias_match("Turnover")
        sales_tax_match = repo.get_alias_match("Sales Tax")

        self.assertIsNotNone(vat_match)
        self.assertIsNotNone(gst_match)
        self.assertEqual(vat_match["concept_id"], "tax.value_added")
        self.assertEqual(gst_match["concept_id"], "tax.value_added")
        self.assertEqual(vat_match["concept_id"], gst_match["concept_id"])  # Functional equivalence!

        self.assertIsNotNone(turnover_match)
        self.assertEqual(turnover_match["concept_id"], "fs.revenue")

        self.assertIsNotNone(sales_tax_match)
        self.assertEqual(sales_tax_match["concept_id"], "tax.sales_tax")
        self.assertEqual(sales_tax_match["relation"], "different")

    def test_fact_locator_hard_requirement(self):
        """Verify Section 4.2: A fact without a locator MUST NOT be saved."""
        from vhagar.db.repo import DraythosRepository
        db_file = Path(self.temp_dir) / "test_facts.db"
        repo = DraythosRepository(db_path=db_file)

        # Fact without locator MUST fail
        with self.assertRaises(ValueError):
            repo.save_fact({
                "doc_id": "d1",
                "raw_label": "Revenue",
                "value_raw": "1000",
                "locator": {},  # Invalid empty locator
            })

        # Fact with valid locator succeeds
        valid_fact = repo.save_fact({
            "doc_id": "d1",
            "raw_label": "Revenue",
            "value_raw": "1000",
            "value_num": 1000.0,
            "locator": {"type": "xlsx", "sheet": "P&L", "cell": "C5", "quote": "Revenue | 1000"},
        })
        self.assertIsNotNone(valid_fact)
        self.assertEqual(valid_fact["doc_id"], "d1")

    def test_number_and_period_parsing(self):
        """Verify Indian number formats (lakh/crore), brackets, and FY periods."""
        from vhagar.components.extraction.numbers import parse_financial_number
        from vhagar.components.extraction.periods import parse_period

        # Indian commas: 1,23,45,000 -> 12345000
        val, unit, scale = parse_financial_number("1,23,45,000")
        self.assertEqual(val, 12345000.0)

        # Negative in brackets: (1,234.50) -> -1234.5
        val_neg, _, _ = parse_financial_number("(1,234.50)")
        self.assertEqual(val_neg, -1234.50)

        # Currency and Crore suffix: ₹ 50 Cr -> 50 with scale 10000000
        val_cr, unit_cr, scale_cr = parse_financial_number("₹ 50 Cr")
        self.assertEqual(val_cr, 50.0)
        self.assertEqual(unit_cr, "INR")
        self.assertEqual(scale_cr, 10_000_000.0)

        # Period FY2023-24 -> FY2024
        p = parse_period("FY 2023-24", jurisdiction="IN")
        self.assertEqual(p["label"], "FY2024")
        self.assertEqual(p["start"], "2023-04-01")
        self.assertEqual(p["end"], "2024-03-31")

    def test_facts_service_and_review_workflow(self):
        """Verify review transition: auto_accepted -> user_confirmed or rejected."""
        from vhagar.db.repo import DraythosRepository
        from vhagar.components.facts.service import FactsService

        db_file = Path(self.temp_dir) / "test_review.db"
        repo = DraythosRepository(db_path=db_file)
        service = FactsService(repo=repo)

        # Create fact
        fact = repo.save_fact({
            "doc_id": "doc_test_1",
            "raw_label": "Turnover",
            "value_raw": "10,00,000",
            "value_num": 1000000.0,
            "concept_id": "fs.revenue",
            "concept_label": "Revenue",
            "state": "auto_accepted",
            "locator": {"type": "xlsx", "sheet": "P&L", "cell": "B2", "quote": "Turnover | 10,00,000"},
        })

        # User review: Accept
        accepted = service.review_fact(fact["fact_id"], action="accept", by="auditor_jane")
        self.assertEqual(accepted["state"], "user_confirmed")
        self.assertEqual(accepted["reviewed_by"], "auditor_jane")

        # User review: Reassign to another concept
        reassigned = service.review_fact(
            fact["fact_id"],
            action="reassign",
            new_concept_id="fs.ebitda",
            by="auditor_jane",
            note="Item was mislabeled in source",
        )
        self.assertEqual(reassigned["concept_id"], "fs.ebitda")
        self.assertEqual(reassigned["concept_label"], "EBITDA")

    def test_user_override_and_impact_preview(self):
        """Verify live edit: user override bumps version and recomputes matching facts."""
        from vhagar.db.repo import DraythosRepository
        from vhagar.components.normalization.overrides import OverrideManager

        db_file = Path(self.temp_dir) / "test_override.db"
        repo = DraythosRepository(db_path=db_file)
        mgr = OverrideManager(repo=repo)

        # Populate a fact with label 'Topline Sales'
        repo.save_fact({
            "doc_id": "doc_sales",
            "raw_label": "Topline Sales",
            "value_raw": "5,00,000",
            "value_num": 500000.0,
            "concept_id": "fs.revenue",
            "locator": {"type": "csv", "row": 3, "col": 2, "quote": "Topline Sales | 5,00,000"},
        })

        # Preview override
        preview = mgr.preview_impact("Topline Sales", "fs.total_revenue")
        self.assertEqual(preview["total_affected_facts"], 1)

        # Apply override
        res = mgr.apply_override("Topline Sales", "fs.total_revenue", by="analyst")
        self.assertEqual(res["updated_facts_count"], 1)
        self.assertGreaterEqual(res["mapping_version"], 2)

        # Check recomputed fact
        facts = repo.get_facts_by_label_key("topline sales")
        self.assertEqual(len(facts), 1)
        self.assertEqual(facts[0]["concept_id"], "fs.total_revenue")
        self.assertEqual(facts[0]["match_method"], "override")
        self.assertEqual(facts[0]["state"], "user_confirmed")

    def test_consolidated_excel_export(self):
        """Verify Excel canonical export generates multi-tab workbook with audit trail."""
        from vhagar.db.repo import DraythosRepository
        from vhagar.components.export.xlsx_writer import generate_consolidated_workbook

        db_file = Path(self.temp_dir) / "test_export.db"
        repo = DraythosRepository(db_path=db_file)

        repo.save_fact({
            "doc_id": "doc_fin_1",
            "entity": "Beta Corp",
            "raw_label": "Turnover",
            "concept_id": "fs.revenue",
            "concept_label": "Revenue",
            "value_raw": "10000",
            "value_num": 10000.0,
            "period": {"label": "FY2024", "type": "fiscal_year"},
            "locator": {"type": "xlsx", "sheet": "Income", "cell": "B4", "quote": "Turnover 10000"},
        })

        out_path = Path(self.temp_dir) / "unified_output.xlsx"
        generate_consolidated_workbook(output_path=out_path, repo=repo)
        self.assertTrue(out_path.exists())
        self.assertGreater(out_path.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()

