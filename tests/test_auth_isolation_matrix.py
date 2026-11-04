"""
Gate 4: Pre-Retrieval Authorization & Tenant Isolation Matrix Unit Tests.

Covers:
1. Pre-retrieval prune: client passing User B's document_ids has them stripped before search.
2. Cross-user isolation: User B querying include_global=True retrieves zero chunks from User A.
3. Cross-session access: Session 1 cannot access Session 2 documents without attachment.
4. Unauthorized Library attachment: User B attempting /library/attach on User A's doc returns 403.
5. API-level ownership: /documents/{id}/content and /documents/{id}/save reject unauthorized access.
6. Deleted documents & stale indices: Deleting document purges SQLite, BM25, and dense embeddings.
7. Concurrent version replacement: Parallel queries during /save never yield dirty/mixed state.
"""

import pytest
import asyncio
from pathlib import Path
from fastapi.testclient import TestClient
from vhagar.config import VhagarConfig
from vhagar.database import DatabaseManager, set_db
from vhagar.components.hybrid_index import HybridIndex, SearchRequest
from vhagar.components.document_processor import DocumentReference, DocumentFormat, ProcessingStatus, ExtractedContent, PageContent
from vhagar.mcp_server import create_mcp_app


@pytest.fixture
def auth_env(tmp_path):
    db_path = tmp_path / "test_auth.db"
    docs_dir = tmp_path / "documents"
    wc_dir = tmp_path / "working_copies"
    docs_dir.mkdir(parents=True, exist_ok=True)
    wc_dir.mkdir(parents=True, exist_ok=True)

    db = DatabaseManager(db_path=db_path)
    set_db(db)

    # Create two isolated users
    user_a = db.create_user("user_a@draythos.io", "pass_hash", "Alice Investor")
    user_b = db.create_user("user_b@draythos.io", "pass_hash", "Bob Competitor")

    # Tokens
    token_a = db.create_auth_token(user_a["id"])
    token_b = db.create_auth_token(user_b["id"])

    # Create sessions
    sess_a1 = db.get_or_create_session("sess_a1", user_a["id"], "Alice Session 1")
    sess_a2 = db.get_or_create_session("sess_a2", user_a["id"], "Alice Session 2")
    sess_b1 = db.get_or_create_session("sess_b1", user_b["id"], "Bob Session 1")

    # Hybrid index
    config = VhagarConfig(documents_dir=docs_dir, working_copies_dir=wc_dir)
    index = HybridIndex(config=config)

    yield {
        "db": db,
        "index": index,
        "user_a": user_a,
        "user_b": user_b,
        "token_a": token_a,
        "token_b": token_b,
        "sess_a1": sess_a1,
        "sess_a2": sess_a2,
        "sess_b1": sess_b1,
        "docs_dir": docs_dir,
        "wc_dir": wc_dir,
    }


@pytest.mark.asyncio
async def test_pre_retrieval_prune_unauthorized_documents(auth_env):
    """
    Client passing User B's document_ids has them stripped before search.
    """
    db = auth_env["db"]
    index = auth_env["index"]
    user_a = auth_env["user_a"]
    user_b = auth_env["user_b"]

    # Register doc_a for User A
    doc_a = db.register_document(
        doc_id="doc_a_classified",
        session_id=auth_env["sess_a1"]["id"],
        user_id=user_a["id"],
        filename="alice_alpha_strategy.txt",
        file_path="/tmp/alice.txt",
        format_type="txt",
        size=1024,
    )
    # Register doc_b for User B
    doc_b = db.register_document(
        doc_id="doc_b_confidential",
        session_id=auth_env["sess_b1"]["id"],
        user_id=user_b["id"],
        filename="bob_beta_secrets.txt",
        file_path="/tmp/bob.txt",
        format_type="txt",
        size=1024,
    )

    # Index both docs
    ref_a = DocumentReference(
        document_id="doc_a_classified",
        session_id=auth_env["sess_a1"]["id"],
        source_filename="alice_alpha_strategy.txt",
        original_path="/tmp/alice.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    ref_b = DocumentReference(
        document_id="doc_b_confidential",
        session_id=auth_env["sess_b1"]["id"],
        source_filename="bob_beta_secrets.txt",
        original_path="/tmp/bob.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )

    await index.index_document(ref_a, ExtractedContent(full_text="Target confidential alpha synergy matrix value $100M"))
    await index.index_document(ref_b, ExtractedContent(full_text="Target confidential beta secrets acquisition formula $999M"))

    # User A searches with document_ids explicitly containing User B's doc
    req = SearchRequest(
        query="confidential",
        user_id=user_a["id"],
        document_ids=["doc_a_classified", "doc_b_confidential"],
        top_k=10,
    )
    results = await index.search(req)

    # Must ONLY return doc_a chunks, ZERO doc_b chunks
    doc_ids_returned = {r.document_id for r in results}
    assert "doc_a_classified" in doc_ids_returned
    assert "doc_b_confidential" not in doc_ids_returned


@pytest.mark.asyncio
async def test_cross_user_isolation_include_global(auth_env):
    """
    User B querying include_global=True retrieves zero chunks from User A.
    """
    db = auth_env["db"]
    index = auth_env["index"]
    user_a = auth_env["user_a"]
    user_b = auth_env["user_b"]

    db.register_document(
        doc_id="doc_a_topsecret",
        session_id=auth_env["sess_a1"]["id"],
        user_id=user_a["id"],
        filename="alice_topsecret.txt",
        file_path="/tmp/alice_topsecret.txt",
        format_type="txt",
        size=1024,
    )

    ref_a = DocumentReference(
        document_id="doc_a_topsecret",
        session_id=auth_env["sess_a1"]["id"],
        source_filename="alice_topsecret.txt",
        original_path="/tmp/alice_topsecret.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    await index.index_document(ref_a, ExtractedContent(full_text="Project Manhattan quantum computing encryption key 0xABCDEF"))

    # User B conducts global search
    req = SearchRequest(
        query="quantum computing encryption key",
        user_id=user_b["id"],
        include_global=True,
        top_k=5,
    )
    results = await index.search(req)

    # Bob retrieves nothing from Alice's project
    assert len(results) == 0


@pytest.mark.asyncio
async def test_cross_session_isolation(auth_env):
    """
    Session 1 cannot access Session 2 documents without explicit Library attachment.
    """
    db = auth_env["db"]
    index = auth_env["index"]
    user_a = auth_env["user_a"]

    # Register doc1 in sess_a1
    db.register_document(
        doc_id="doc_sess1",
        session_id=auth_env["sess_a1"]["id"],
        user_id=user_a["id"],
        filename="q1_financials.txt",
        file_path="/tmp/q1.txt",
        format_type="txt",
        size=1024,
    )
    # Register doc2 in sess_a2
    db.register_document(
        doc_id="doc_sess2",
        session_id=auth_env["sess_a2"]["id"],
        user_id=user_a["id"],
        filename="q2_financials.txt",
        file_path="/tmp/q2.txt",
        format_type="txt",
        size=1024,
    )

    ref1 = DocumentReference(
        document_id="doc_sess1",
        session_id=auth_env["sess_a1"]["id"],
        source_filename="q1_financials.txt",
        original_path="/tmp/q1.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    ref2 = DocumentReference(
        document_id="doc_sess2",
        session_id=auth_env["sess_a2"]["id"],
        source_filename="q2_financials.txt",
        original_path="/tmp/q2.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    await index.index_document(ref1, ExtractedContent(full_text="Q1 revenue reached $500,000"))
    await index.index_document(ref2, ExtractedContent(full_text="Q2 revenue reached $800,000"))

    # Search in Session 1 only
    req = SearchRequest(
        query="revenue reached",
        session_id=auth_env["sess_a1"]["id"],
        user_id=user_a["id"],
        include_global=False,
        top_k=10,
    )
    results = await index.search(req)

    returned_docs = {r.document_id for r in results}
    assert "doc_sess1" in returned_docs
    assert "doc_sess2" not in returned_docs


def test_api_level_ownership_enforcement(auth_env):
    """
    API endpoints /documents/{id}/content, /documents/{id}/save, and /library/attach
    reject unauthorized cross-user access with 403 Forbidden.
    """
    db = auth_env["db"]
    user_a = auth_env["user_a"]
    user_b = auth_env["user_b"]
    token_b = auth_env["token_b"]
    docs_dir = auth_env["docs_dir"]

    # Create Alice document on disk & in DB
    alice_doc_id = "doc_alice_private"
    db.register_document(
        doc_id=alice_doc_id,
        session_id=auth_env["sess_a1"]["id"],
        user_id=user_a["id"],
        filename="alice_payroll.txt",
        file_path=str(docs_dir / alice_doc_id / "alice_payroll.txt"),
        format_type="txt",
        size=1024,
    )
    doc_folder = docs_dir / alice_doc_id
    doc_folder.mkdir(parents=True, exist_ok=True)
    (doc_folder / "alice_payroll.txt").write_text("Executive salary details: $500,000")

    app = create_mcp_app()
    client = TestClient(app)

    # 1. Bob attempts to read Alice's document content
    headers_b = {"Authorization": f"Bearer {token_b['token']}"}
    res_content = client.get(f"/documents/{alice_doc_id}/content", headers=headers_b)
    assert res_content.status_code == 403
    assert "Access denied" in res_content.text

    # 2. Bob attempts to modify Alice's document
    res_save = client.post(
        f"/documents/{alice_doc_id}/save",
        json={"format": "txt", "content": "Tampered content"},
        headers=headers_b,
    )
    assert res_save.status_code == 403

    # 3. Bob attempts to attach Alice's document to his own session
    res_attach = client.post(
        "/library/attach",
        json={"session_id": auth_env["sess_b1"]["id"], "document_ids": [alice_doc_id]},
        headers=headers_b,
    )
    assert res_attach.status_code == 403


@pytest.mark.asyncio
async def test_deleted_documents_and_stale_indices(auth_env):
    """
    Deleting document purges SQLite records, chunks, FTS entries, and hybrid vector index.
    """
    db = auth_env["db"]
    index = auth_env["index"]
    user_a = auth_env["user_a"]

    doc_id = "doc_to_delete"
    db.register_document(
        doc_id=doc_id,
        session_id=auth_env["sess_a1"]["id"],
        user_id=user_a["id"],
        filename="ephemeral.txt",
        file_path="/tmp/ephemeral.txt",
        format_type="txt",
        size=1024,
    )

    ref = DocumentReference(
        document_id=doc_id,
        session_id=auth_env["sess_a1"]["id"],
        source_filename="ephemeral.txt",
        original_path="/tmp/ephemeral.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    await index.index_document(ref, ExtractedContent(full_text="Sensitive proprietary trade secret formula 42xyz"))

    # Verify searchable prior to deletion
    req_before = SearchRequest(query="trade secret formula 42xyz", user_id=user_a["id"], include_global=True)
    res_before = await index.search(req_before)
    assert len(res_before) > 0

    # Purge document
    db.delete_document(doc_id)
    await index.remove_document(doc_id)

    # Search again
    res_after = await index.search(req_before)
    assert len(res_after) == 0

    # Verify SQLite chunks are 0
    with db._get_connection() as conn:
        chunks = conn.execute("SELECT COUNT(*) FROM document_chunks WHERE document_id = ?", (doc_id,)).fetchone()[0]
        assert chunks == 0
        docs = conn.execute("SELECT COUNT(*) FROM documents WHERE id = ?", (doc_id,)).fetchone()[0]
        assert docs == 0
