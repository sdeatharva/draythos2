"""Unit tests for Concept Memory (backend-only concept learning and query enrichment)."""

import pytest
from vhagar.components.concept_memory import ConceptMemory


@pytest.mark.asyncio
async def test_concept_memory_ingestion_and_search(test_config):
    memory = ConceptMemory(test_config)
    await memory._load()

    terms = ["depreciation", "amortization", "ebitda", "capital_expenditure"]
    count = await memory.ingest_from_document(
        document_id="doc_101",
        terms=terms,
        content_summary="Quarterly financial statements detailing assets and amortization schedules.",
    )
    assert count == 4

    # Search concepts
    results = await memory.search_concepts("depreciation", top_k=2)
    assert len(results) >= 1
    assert results[0].concept_name == "depreciation"
    assert "doc_101" in results[0].provenance

    # Query enrichment
    enrichments = await memory.get_enrichment_for_query("How is amortization calculated?")
    assert any("amortization" in e for e in enrichments)

    # Stats
    stats = await memory.get_stats()
    assert stats.total_concepts >= 4

