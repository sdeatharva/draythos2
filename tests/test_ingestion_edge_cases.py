"""Verification tests for ingestion failure modes, crash recovery, atomic claiming, and search isolation."""

import io
import time
import pytest
from vhagar.database import DatabaseManager, get_db


def test_atomic_job_claiming(test_config):
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    doc_id = "doc_atomic_01"
    job_id = db.create_ingestion_job(document_id=doc_id, user_id="usr_default", filename="test.pdf")

    # Worker 1 claims job
    claimed1 = db.claim_next_ingestion_job(user_id="usr_default")
    assert claimed1 is not None
    assert claimed1["id"] == job_id
    assert claimed1["status"] == "processing"
    assert claimed1["attempts"] == 1

    # Worker 2 attempts to claim at the same time: must receive None (already claimed)
    claimed2 = db.claim_next_ingestion_job(user_id="usr_default")
    assert claimed2 is None


def test_search_isolation_unindexed_documents_not_searchable(test_config):
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    doc_id = "doc_secret_finance"
    job_id = db.create_ingestion_job(document_id=doc_id, user_id="usr_default", filename="secret.pdf")
    db.update_ingestion_job(job_id, status="processing", stage="indexing")

    # Insert chunk while job is still processing
    db.save_document_chunks(
        document_id=doc_id,
        version_id="v1",
        chunks=[{
            "chunk_id": "chk_secret_1",
            "document_id": doc_id,
            "text": "Confidential EBITDA target for Q4 is forty million dollars.",
            "source_filename": "secret.pdf",
            "embedding": [0.1] * 384,
        }]
    )

    # Document must NOT be searchable while job is in 'processing' status
    fts_results = db.search_chunks_fts("EBITDA target forty million")
    doc_ids_found = [r["document_id"] for r in fts_results]
    assert doc_id not in doc_ids_found, "Partially indexed document leaked into search results before completion!"

    emb_results = db.get_all_chunk_embeddings()
    emb_doc_ids = [d_id for _, d_id, _ in emb_results]
    assert doc_id not in emb_doc_ids, "Unfinished document embeddings leaked into vector index!"

    # Complete the job
    db.update_ingestion_job(job_id, status="completed", stage="ready")

    # Now it MUST be searchable
    fts_after = db.search_chunks_fts("EBITDA target")
    assert any(r["document_id"] == doc_id for r in fts_after), "Completed document must be searchable"


def test_idempotent_retries_no_duplicate_chunks(test_config):
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    doc_id = "doc_idempotent_01"

    # Simulate crashed first attempt
    db.save_document_chunks(
        document_id=doc_id,
        version_id="v1",
        chunks=[
            {"chunk_id": "c1", "document_id": doc_id, "text": "Auditing balance sheet item 1"},
            {"chunk_id": "c2", "document_id": doc_id, "text": "Auditing balance sheet item 2"},
        ]
    )

    # Retry the job (e.g. after crash)
    db.save_document_chunks(
        document_id=doc_id,
        version_id="v1",
        chunks=[
            {"chunk_id": "c1", "document_id": doc_id, "text": "Auditing balance sheet item 1"},
            {"chunk_id": "c2", "document_id": doc_id, "text": "Auditing balance sheet item 2"},
        ]
    )

    # Verify no duplicates exist in document_chunks or chunks_fts
    with db._get_connection() as conn:
        cur = conn.execute("SELECT COUNT(*) FROM document_chunks WHERE document_id = ?", (doc_id,))
        count = cur.fetchone()[0]
        assert count == 2, f"Expected exactly 2 chunks after idempotent retry, found {count}"

        cur2 = conn.execute("SELECT COUNT(*) FROM chunks_fts WHERE document_id = ?", (doc_id,))
        fts_count = cur2.fetchone()[0]
        assert fts_count == 2, f"Expected exactly 2 FTS rows, found {fts_count}"


def test_startup_crash_recovery(test_config):
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    doc_id = "doc_crashed_run"
    job_id = db.create_ingestion_job(document_id=doc_id, user_id="usr_default", filename="crash.pdf")
    db.update_ingestion_job(job_id, status="processing", stage="embedding")

    # Simulate process death and reboot by instantiating new DatabaseManager
    new_db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    recovered_job = new_db.get_ingestion_job(job_id)

    assert recovered_job is not None
    assert recovered_job["status"] == "queued", "Abandoned processing job must be reclaimed to queued"
    assert recovered_job["attempts"] >= 1, "Attempt counter must increment on crash recovery"


def test_job_cancellation_and_cleanup(test_config):
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    doc_id = "doc_cancel_me"
    job_id = db.create_ingestion_job(document_id=doc_id, user_id="usr_default", filename="cancel.pdf")
    db.save_document_chunks(
        document_id=doc_id,
        version_id="v1",
        chunks=[{"chunk_id": "c_cancel_1", "document_id": doc_id, "text": "Do not index this"}]
    )

    success = db.cancel_ingestion_job(job_id, reason="User cancelled file upload")
    assert success is True

    job = db.get_ingestion_job(job_id)
    assert job["status"] == "cancelled"
    assert "User cancelled" in job["error_message"]

    # Verify chunks cleaned up
    with db._get_connection() as conn:
        cur = conn.execute("SELECT COUNT(*) FROM document_chunks WHERE document_id = ?", (doc_id,))
        assert cur.fetchone()[0] == 0
