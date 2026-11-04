"""End-to-End tests for the persistent Workspace Library.
Verifies folder creation, moving documents, attaching across chats without re-uploading,
and chat deletion without deleting Library documents.
"""

import io
import pytest
from fastapi.testclient import TestClient
from vhagar.database import DatabaseManager
from vhagar.mcp_server import create_mcp_app
from vhagar.bootstrap import bootstrap


@pytest.fixture
def library_client(test_config, event_loop):
    event_loop.run_until_complete(bootstrap(test_config))
    app = create_mcp_app()
    return TestClient(app)


def test_library_lifecycle_and_cross_chat_reuse(library_client, test_config):
    # 1. Upload document into Chat Session A
    csv_bytes = b"Line,Cost\nCloud,5000\nNetwork,2000"
    res1 = library_client.post(
        "/upload",
        files={"file": ("infra_costs.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"session_id": "session_alpha"},
    )
    assert res1.status_code == 200
    doc_id = res1.json()["document_id"]

    # 2. Verify document automatically exists in Workspace Library
    lib_res = library_client.get("/library?user_id=usr_default")
    assert lib_res.status_code == 200
    lib_data = lib_res.json()
    assert any(d["document_id"] == doc_id for d in lib_data["documents"]), "Uploaded document must exist in Workspace Library"

    # 3. Create a folder in Library
    fld_res = library_client.post(
        "/library/folders",
        json={"name": "Q1 Financials", "user_id": "usr_default"},
    )
    assert fld_res.status_code == 200
    fld_id = fld_res.json()["id"]

    # 4. Move document into the folder
    move_res = library_client.patch(
        f"/library/documents/{doc_id}",
        json={"folder_id": fld_id},
    )
    assert move_res.status_code == 200

    # Verify moved document has updated folder_id
    lib_after_move = library_client.get("/library?user_id=usr_default").json()
    target_doc = next(d for d in lib_after_move["documents"] if d["document_id"] == doc_id)
    assert target_doc["folder_id"] == fld_id
    assert target_doc["folder_name"] == "Q1 Financials"

    # 5. Reuse document in a BRAND NEW Chat Session B without uploading again!
    attach_res = library_client.post(
        "/library/attach",
        json={"session_id": "session_beta", "document_ids": [doc_id]},
    )
    assert attach_res.status_code == 200
    assert len(attach_res.json()["attached"]) == 1
    assert attach_res.json()["attached"][0]["document_id"] == doc_id

    # 6. Delete Chat Session A: Document in Library must NOT be deleted!
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    db.delete_session("session_alpha")

    lib_after_session_delete = library_client.get("/library?user_id=usr_default").json()
    assert any(d["document_id"] == doc_id for d in lib_after_session_delete["documents"]), "Deleting a chat session must NOT delete Library documents!"

    # 7. Delete document from Library
    del_res = library_client.delete(f"/library/documents/{doc_id}")
    assert del_res.status_code == 200

    lib_final = library_client.get("/library?user_id=usr_default").json()
    assert not any(d["document_id"] == doc_id for d in lib_final["documents"])

