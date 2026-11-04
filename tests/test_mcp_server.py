"""Integration tests for Vhagar MCP server (upload, content, file, save, download, search)."""

import io
import pytest
from fastapi.testclient import TestClient

from vhagar.bootstrap import bootstrap
from vhagar.mcp_server import create_mcp_app


@pytest.fixture
def mcp_client(test_config, event_loop):
    event_loop.run_until_complete(bootstrap(test_config))
    app = create_mcp_app()
    return TestClient(app)


def test_mcp_health(mcp_client):
    res = mcp_client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_upload_and_retrieve_content(mcp_client):
    csv_bytes = b"Product,Units,Price\nWidget A,100,25.50\nWidget B,200,15.00"
    res = mcp_client.post(
        "/upload",
        files={"file": ("inventory.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"session_id": "session_test_1"},
    )
    assert res.status_code == 200
    data = res.json()
    doc_id = data["document_id"]
    assert doc_id != ""
    assert data["format"] == "csv"

    # Get document content
    content_res = mcp_client.get(f"/documents/{doc_id}/content")
    assert content_res.status_code == 200
    c_data = content_res.json()
    assert "Widget A" in c_data["text"]

    # Preview file
    file_res = mcp_client.get(f"/documents/{doc_id}/file")
    assert file_res.status_code == 200
    assert b"Widget B" in file_res.content

    # Save working copy with updated content
    updated_text = "Product,Units,Price\nWidget A,150,25.50\nWidget B,200,15.00"
    save_res = mcp_client.post(
        f"/documents/{doc_id}/save",
        json={"content": updated_text, "format": "csv"},
    )
    assert save_res.status_code == 200
    assert save_res.json()["success"] is True

    # Download must serve the updated working copy, NOT the stale original!
    download_res = mcp_client.get(f"/documents/{doc_id}/download")
    assert download_res.status_code == 200
    assert b"150,25.50" in download_res.content


def test_search_endpoint(mcp_client):
    # Upload document to search
    txt_bytes = b"Financial audit rules require quarterly balance verification for all accounts."
    up_res = mcp_client.post(
        "/upload",
        files={"file": ("audit_rules.txt", io.BytesIO(txt_bytes), "text/plain")},
        data={"session_id": "session_search"},
    )
    doc_id = up_res.json()["document_id"]

    # Search with attached document
    search_res = mcp_client.post(
        "/search",
        json={
            "query": "quarterly balance verification",
            "session_id": "session_search",
            "document_ids": [doc_id],
        },
    )
    assert search_res.status_code == 200
    s_data = search_res.json()
    assert len(s_data["citations"]) > 0
    assert s_data["citations"][0]["document_id"] == doc_id


def test_ingestion_job_lifecycle(mcp_client):
    csv_bytes = b"Account,Debit,Credit\nCash,5000,0\nRevenue,0,5000"
    up_res = mcp_client.post(
        "/upload",
        files={"file": ("trial_balance.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"session_id": "session_job_test"},
    )
    assert up_res.status_code == 200
    data = up_res.json()
    job_id = data.get("job_id")
    assert job_id is not None
    assert job_id.startswith("job_")

    # Verify job status endpoint
    job_res = mcp_client.get(f"/upload/jobs/{job_id}")
    assert job_res.status_code == 200
    job_data = job_res.json()
    assert job_data["status"] == "completed"
    assert job_data["stage"] == "ready"
    assert job_data["document_id"] == data["document_id"]

    # Verify list jobs endpoint
    jobs_list_res = mcp_client.get("/upload/jobs")
    assert jobs_list_res.status_code == 200
    assert isinstance(jobs_list_res.json(), list)


def test_working_copy_auto_reindexing_and_search(mcp_client):
    """Verify that editing a document generates an isolated working copy,

    immediately reindexes it into the hybrid search index, and leaves the original file immutable.
    """
    csv_bytes = b"Category,Amount\nConsulting,45000\nMarketing,20000"
    up_res = mcp_client.post(
        "/upload",
        files={"file": ("operating_expenses.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"session_id": "session_reindex_test"},
    )
    assert up_res.status_code == 200
    doc_id = up_res.json()["document_id"]

    # Search for term not yet in document
    initial_search = mcp_client.post(
        "/search",
        json={
            "query": "Cybersecurity Advisory compliance",
            "session_id": "session_reindex_test",
            "document_ids": [doc_id],
        },
    )
    assert initial_search.status_code == 200
    # The term should NOT appear anywhere in the initial document's context
    assert "Cybersecurity Advisory" not in initial_search.json()["context"]

    # Save edit modifying the document into a working copy
    updated_csv = "Category,Amount\nConsulting,45000\nCybersecurity Advisory compliance,95000"
    save_res = mcp_client.post(
        f"/documents/{doc_id}/save",
        json={"content": updated_csv, "format": "csv"},
    )
    assert save_res.status_code == 200
    save_data = save_res.json()
    assert save_data["success"] is True

    # Search again for the newly edited term - MUST find it in the reindexed working copy!
    post_edit_search = mcp_client.post(
        "/search",
        json={
            "query": "Cybersecurity Advisory compliance",
            "session_id": "session_reindex_test",
            "document_ids": [doc_id],
        },
    )
    assert post_edit_search.status_code == 200
    pe_data = post_edit_search.json()
    assert len(pe_data["citations"]) > 0
    assert "Cybersecurity Advisory" in pe_data["context"]

    # Original file verification: verify the original file is still 100% immutable
    orig_file_res = mcp_client.get(f"/documents/{doc_id}/file?original=true")
    assert orig_file_res.status_code == 200
    assert b"Marketing,20000" in orig_file_res.content
    assert b"Cybersecurity Advisory" not in orig_file_res.content


