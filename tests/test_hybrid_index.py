"""Unit tests for Hybrid Index (dense + BM25 retrieval, RRF ranking, session filtering)."""

import pytest
from vhagar.components.hybrid_index import HybridIndex, SearchRequest
from vhagar.components.document_processor import (
    DocumentReference,
    ExtractedContent,
    PageContent,
    DocumentFormat,
    ProcessingStatus,
)


@pytest.mark.asyncio
async def test_index_and_search_retrieval(test_config):
    index = HybridIndex(test_config)

    doc_ref_1 = DocumentReference(
        document_id="doc_1",
        session_id="session_finance",
        source_filename="income_statement.txt",
        original_path="/tmp/income.txt",
        processing_status=ProcessingStatus.COMPLETED,
        format=DocumentFormat.TXT,
    )
    content_1 = ExtractedContent(
        pages=[PageContent(page_number=1, text="Total quarterly gross profit amounted to $450,000 with a 30% margin.")],
        full_text="Total quarterly gross profit amounted to $450,000 with a 30% margin.",
        total_pages=1,
    )

    doc_ref_2 = DocumentReference(
        document_id="doc_2",
        session_id="session_tax",
        source_filename="tax_rules.txt",
        original_path="/tmp/tax.txt",
        processing_status=ProcessingStatus.COMPLETED,
        format=DocumentFormat.TXT,
    )
    content_2 = ExtractedContent(
        pages=[PageContent(page_number=1, text="The statutory corporate income tax rate is 21% for the current tax year.")],
        full_text="The statutory corporate income tax rate is 21% for the current tax year.",
        total_pages=1,
    )

    await index.index_document(doc_ref_1, content_1)
    await index.index_document(doc_ref_2, content_2)

    stats = await index.get_stats()
    assert stats["total_documents"] == 2
    assert stats["total_chunks"] >= 2

    # Search with document filter
    req = SearchRequest(
        query="gross profit margin",
        document_ids=["doc_1"],
        top_k=5,
    )
    results = await index.search(req)
    assert len(results) > 0
    assert results[0].document_id == "doc_1"
    assert "profit" in results[0].text.lower()

    # Invariant: session isolation via document filter
    assert not any(r.document_id == "doc_2" for r in results)


@pytest.mark.asyncio
async def test_remove_document(test_config):
    index = HybridIndex(test_config)

    doc_ref = DocumentReference(
        document_id="doc_temp",
        session_id="s1",
        source_filename="temp.txt",
        original_path="/tmp/temp.txt",
        format=DocumentFormat.TXT,
    )
    content = ExtractedContent(
        pages=[PageContent(page_number=1, text="Temporary chunk content")],
        full_text="Temporary chunk content",
        total_pages=1,
    )
    await index.index_document(doc_ref, content)
    assert (await index.get_stats())["total_documents"] == 1

    await index.remove_document("doc_temp")
    assert (await index.get_stats())["total_documents"] == 0

