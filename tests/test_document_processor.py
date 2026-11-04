"""Unit tests for Document Processor (detection, extraction, hash, corruption handling)."""

import pytest
from pathlib import Path
from vhagar.components.document_processor import (
    DocumentProcessor,
    DocumentFormat,
    ProcessingStatus,
)


@pytest.mark.asyncio
async def test_detect_format(test_config, sample_csv, sample_txt, sample_json):
    processor = DocumentProcessor(test_config)

    assert await processor.detect_format(sample_csv) == DocumentFormat.CSV
    assert await processor.detect_format(sample_txt) == DocumentFormat.TXT
    assert await processor.detect_format(sample_json) == DocumentFormat.JSON


@pytest.mark.asyncio
async def test_extract_csv_and_text(test_config, sample_csv, sample_txt):
    processor = DocumentProcessor(test_config)

    csv_content = await processor.extract_content(sample_csv, DocumentFormat.CSV)
    assert csv_content.processing_status == ProcessingStatus.COMPLETED
    assert "Revenue" in csv_content.full_text
    assert len(csv_content.terms) > 0

    txt_content = await processor.extract_content(sample_txt, DocumentFormat.TXT)
    assert txt_content.processing_status == ProcessingStatus.COMPLETED
    assert "Draythos" in txt_content.full_text
    assert "vat" in [t.lower() for t in txt_content.terms]


@pytest.mark.asyncio
async def test_process_document_immutability(test_config, sample_txt):
    processor = DocumentProcessor(test_config)

    original_bytes = sample_txt.read_bytes()
    doc_ref = await processor.process_document(
        file_path=sample_txt,
        session_id="session_alpha",
        document_id="doc_alpha",
    )

    assert doc_ref.document_id == "doc_alpha"
    assert doc_ref.session_id == "session_alpha"
    assert doc_ref.processing_status == ProcessingStatus.COMPLETED
    assert doc_ref.file_hash != ""

    # Invariant: Original file must remain untouched
    assert sample_txt.read_bytes() == original_bytes


@pytest.mark.asyncio
async def test_corrupt_file_handling(test_config, corrupt_file):
    processor = DocumentProcessor(test_config)

    doc_ref = await processor.process_document(
        file_path=corrupt_file,
        session_id="session_err",
    )
    # Failed extraction must not crash the server and must flag status
    assert doc_ref.processing_status in (ProcessingStatus.FAILED, ProcessingStatus.PARTIALLY_COMPLETED)

