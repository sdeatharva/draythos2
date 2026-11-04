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


if __name__ == "__main__":
    unittest.main()

