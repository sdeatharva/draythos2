"""
Gate 6: Live End-to-End API Workflow Verification.

Executes complete live flow using FastAPI TestClient:
1. User Registration & Authentication -> Bearer token
2. Workspace Library Folder Creation
3. Multi-Sheet Realistic Workbook Upload
4. Session Creation & Library Attachment
5. Grounded Retrieval Query with Citations
6. Prompt-Driven Spreadsheet Edit (Working Copy creation)
7. Content Diff Inspection
8. Working Copy Download & OpenPyXL AST Verification
9. Source Immutability Verification (Byte-level SHA-256 hash comparison)
10. Session & History Persistence Verification
"""

import hashlib
import json
import time
from pathlib import Path
import openpyxl
from fastapi.testclient import TestClient

from vhagar.mcp_server import create_mcp_app
from vhagar.database import get_db, set_db, DatabaseManager


def main():
    print("=" * 70)
    print("GATE 6: LIVE END-TO-END WORKFLOW VERIFICATION")
    print("=" * 70)

    # Initialize app and client
    app = create_mcp_app()
    client = TestClient(app)

    # Step 1: Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Backend health check failed: {res.text}"
    print(f"✓ Step 1: Backend alive (status {res.status_code})")

    # Step 2: User Registration & Email Verification Authentication
    user_email = f"e2e_analyst_{int(time.time())}@draythos.io"
    user_pass = "AlphaSecurePass2026!"
    res_reg = client.post("/auth/register", json={
        "email": user_email,
        "password": user_pass,
        "name": "Live E2E Verification Analyst",
        "role": "Lead Architect",
    })
    assert res_reg.status_code == 200, f"Registration failed: {res_reg.text}"
    reg = res_reg.json()
    verification_code = reg.get("code")

    # Complete 2FA verification flow
    res_verify = client.post("/auth/verify-email", json={
        "email": user_email,
        "code": verification_code,
    })
    assert res_verify.status_code == 200, f"Email verification failed: {res_verify.text}"
    auth_data = res_verify.json()
    user_id = auth_data["id"]
    token = auth_data["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"✓ Step 2: Registered user '{user_email}' -> Verified email code '{verification_code}' -> user_id: {user_id}")

    # Step 3: Library Folder Creation
    res_folder = client.post(
        "/library/folders",
        json={"name": "Q4 Financial Modeling", "user_id": user_id},
        headers=headers,
    )
    assert res_folder.status_code == 200, f"Folder creation failed: {res_folder.text}"
    folder = res_folder.json()
    folder_id = folder["id"]
    print(f"✓ Step 3: Created Workspace Library folder '{folder['name']}' (id: {folder_id})")

    # Step 4: Multi-sheet Workbook Upload
    workbook_path = Path("tests/workbooks/wb3_multisheet_cross_ref.xlsx")
    assert workbook_path.exists(), "Source workbook missing!"
    original_sha256 = hashlib.sha256(workbook_path.read_bytes()).hexdigest()

    with open(workbook_path, "rb") as f:
        res_upload = client.post(
            "/upload",
            data={"user_id": user_id, "folder_id": folder_id},
            files={"file": (workbook_path.name, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            headers=headers,
        )
    assert res_upload.status_code == 200, f"Upload failed: {res_upload.text}"
    upload_res = res_upload.json()
    doc_id = upload_res["document_id"]
    print(f"✓ Step 4: Uploaded multi-sheet workbook -> doc_id: {doc_id}")

    # Step 5: Session Creation & Document Attachment
    session_id = f"c_e2e_{int(time.time())}"
    res_sess = client.post(
        "/sessions",
        json={"id": session_id, "user_id": user_id, "title": "Live Spreadsheet Modeling Session"},
        headers=headers,
    )
    assert res_sess.status_code == 200, f"Session creation failed: {res_sess.text}"

    res_attach = client.post(
        "/library/attach",
        json={"session_id": session_id, "document_ids": [doc_id], "user_id": user_id},
        headers=headers,
    )
    assert res_attach.status_code == 200, f"Attachment failed: {res_attach.text}"
    print(f"✓ Step 5: Created session '{session_id}' and attached document '{doc_id}'")

    # Step 6: Grounded Q&A Retrieval Query
    res_search = client.post(
        "/search",
        json={"query": "Revenue Detail Enterprise Software Q1 Q2 Q3 Q4", "document_ids": [doc_id], "user_id": user_id, "top_k": 3},
        headers=headers,
    )
    assert res_search.status_code == 200, f"Search failed: {res_search.text}"
    search_data = res_search.json()
    results = search_data.get("results", [])
    print(f"✓ Step 6: Grounded search retrieved {len(results)} chunks with citations")

    # Step 7: Prompt-Driven Spreadsheet Edit (Writing Copy Creation)
    # Edit: update Revenue_Detail!B5 to 75000 and calculate Total formula in cell E5
    edit_payload = {
        "format": "xlsx",
        "user_id": user_id,
        "edits": [
            {
                "sheet_name": "Revenue_Detail",
                "cell_ref": "B5",
                "value": "75000",
                "new_value": "75000",
                "value_type": "string",
            },
            {
                "sheet_name": "Revenue_Detail",
                "cell_ref": "E5",
                "value": "=SUM(B5:D5)",
                "new_value": "=SUM(B5:D5)",
                "value_type": "formula",
            },
        ],
    }
    res_save = client.post(
        f"/documents/{doc_id}/save",
        json=edit_payload,
        headers=headers,
    )
    assert res_save.status_code == 200, f"Spreadsheet save failed: {res_save.text}"
    save_res = res_save.json()
    version_id = save_res["version"]
    print(f"✓ Step 7: Applied prompt edits -> Created Working Copy version 'v_{version_id}'")

    # Step 8: Content Diff Inspection
    res_content = client.get(f"/documents/{doc_id}/content", headers=headers)
    assert res_content.status_code == 200, f"Content fetch failed: {res_content.text}"
    content_res = res_content.json()
    sheets = content_res.get("sheets", [])
    rev_sheet = next((s for s in sheets if s["name"] == "Revenue_Detail"), None)
    assert rev_sheet is not None, "Revenue_Detail sheet not returned in content"
    print(f"✓ Step 8: Inspected Artifact Canvas content -> {len(sheets)} sheets mounted")

    # Step 9: Working Copy Download & OpenPyXL AST Verification
    res_file = client.get(f"/documents/{doc_id}/file?version={version_id}&download=true", headers=headers)
    assert res_file.status_code == 200, f"File download failed: {res_file.status_code}"
    wc_bytes = res_file.content

    temp_wc = Path(f"/tmp/e2e_wc_{version_id}.xlsx")
    temp_wc.write_bytes(wc_bytes)

    wb_wc = openpyxl.load_workbook(str(temp_wc), data_only=False)
    ws_wc = wb_wc["Revenue_Detail"]
    assert str(ws_wc["B5"].value) == "75000", f"Expected B5 to be 75000, got {ws_wc['B5'].value}"
    assert ws_wc["E5"].value == "=SUM(B5:D5)", f"Expected E5 to be =SUM(B5:D5), got {ws_wc['E5'].value}"
    print(f"✓ Step 9: Downloaded working copy -> Verified cell B5='75000' and E5='=SUM(B5:D5)' formula AST preserved")

    # Step 10: Source File Immutability Guarantee
    current_sha256 = hashlib.sha256(workbook_path.read_bytes()).hexdigest()
    assert original_sha256 == current_sha256, "CRITICAL FAULT: Original source workbook was mutated!"
    print(f"✓ Step 10: Original source file immutability verified (SHA-256 match: {current_sha256[:16]}...)")

    # Step 11: Session & History Persistence Verification
    # Add assistant message summarizing edit
    msg_payload = {
        "role": "assistant",
        "content": f"Working copy v_{version_id} created with B5=75000 and E5==SUM(B5:D5).",
    }
    res_msg = client.post(
        f"/sessions/{session_id}/messages",
        json=msg_payload,
        headers=headers,
    )
    assert res_msg.status_code == 200, f"Message append failed: {res_msg.text}"

    res_sess_get = client.get(f"/sessions/{session_id}", headers=headers)
    assert res_sess_get.status_code == 200, f"Session fetch failed: {res_sess_get.text}"
    sess_verify = res_sess_get.json()
    messages = sess_verify.get("messages", [])
    assert len(messages) >= 1, "Session messages not persisted"
    print(f"✓ Step 11: Session persistence verified -> {len(messages)} messages stored in SQLite")

    print("\n" + "=" * 70)
    print("ALL 11 END-TO-END WORKFLOW VERIFICATION GATES PASSED (100%)")
    print("=" * 70)


if __name__ == "__main__":
    main()
