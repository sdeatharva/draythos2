#!/usr/bin/env python3
"""
Comprehensive P0 Verification Suite for Draythos
Verifies fixes for:
- P0.1: Document Upload Flow, Ingestion Status & Job Polling
- P0.2: Session Creation, Message Persistence & Hydration across Refresh
- P0.3 & P0.4: Normal Chat routing without canned document onboarding intercept
- P0.5: Persistent Workspace Library & Working Copy vs Original Source toggle
"""

import urllib.request
import urllib.error
import json
import uuid
import sys
import os

BASE_URL = "http://127.0.0.1:3000"
VHAGAR_URL = "http://127.0.0.1:8001"

passed_tests = []
failed_tests = []

def test(name):
    def decorator(fn):
        def wrapper():
            print(f"\n[RUNNING] {name}...")
            try:
                fn()
                print(f"[PASS] {name}")
                passed_tests.append(name)
            except Exception as e:
                print(f"[FAIL] {name}: {e}")
                failed_tests.append((name, str(e)))
        return wrapper
    return decorator

# ── Test 1: P0.3 / P0.4 General Knowledge Query (No Canned Intercept) ────────
@test("P0.3 / P0.4: General Knowledge Query - Uganda & Israel Prime Ministers")
def test_general_knowledge():
    payload = json.dumps({
        "message": "Who is the Prime Minister of Uganda? And Prime Minister of Israel?",
        "sessionId": f"sess_{uuid.uuid4().hex[:8]}",
        "attachments": []
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        msg = data.get("message", "")
        provider = data.get("provider", "")

        # Must NOT return canned document onboarding message
        assert "Attach a PDF, spreadsheet (XLSX/CSV)" not in msg, "Failed: Canned onboarding returned!"
        assert "The document will open in the artifact canvas on the right" not in msg

        # Must mention Robinah Nabbanja and Benjamin Netanyahu
        assert "Robinah Nabbanja" in msg, f"Expected Robinah Nabbanja in response, got: {msg[:200]}"
        assert "Benjamin Netanyahu" in msg, f"Expected Benjamin Netanyahu in response, got: {msg[:200]}"
        print(f"  Provider: {provider}")
        print(f"  Response snippet: {msg[:160]}...")

# ── Test 2: P0.3 Conversational Greeting (No Canned Intercept) ────────────────
@test("P0.3: Conversational Greeting - Hello / Greetings")
def test_conversational_greeting():
    payload = json.dumps({
        "message": "Hello, how can you help me today?",
        "sessionId": f"sess_{uuid.uuid4().hex[:8]}",
        "attachments": []
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        msg = data.get("message", "")

        assert "Attach a PDF, spreadsheet (XLSX/CSV)" not in msg
        assert "Draythos" in msg
        print(f"  Greeting response snippet: {msg[:140]}...")

# ── Test 3: P0.1 Document Upload Flow & Ingestion Job Polling ─────────────────
uploaded_doc_id = None
uploaded_job_id = None

@test("P0.1: Document Upload & Real-time Ingestion Job Status")
def test_document_upload():
    global uploaded_doc_id, uploaded_job_id
    boundary = "----WebKitFormBoundary" + uuid.uuid4().hex
    filename = "Financial_Q1_2026.csv"
    file_content = b"Account,Q1 Budget,Q1 Actual,Variance\nRevenue,500000,520000,20000\nCOGS,200000,195000,-5000\nOperating Exp,150000,160000,10000\nNet Income,150000,165000,15000\n"

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="sessionId"\r\n\r\n'
        f"test_session_p01\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="userId"\r\n\r\n'
        f"usr_test_verification\r\n"
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
    ).encode("utf-8") + file_content + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/api/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        uploaded_doc_id = data.get("document_id")
        uploaded_job_id = data.get("job_id")
        assert uploaded_doc_id, "Missing document_id in upload response"
        print(f"  Uploaded Document ID: {uploaded_doc_id}")
        print(f"  Job ID: {uploaded_job_id}")

    # Verify job status endpoint
    if uploaded_job_id:
        req_job = urllib.request.Request(f"{BASE_URL}/api/upload/jobs/{uploaded_job_id}")
        with urllib.request.urlopen(req_job, timeout=10) as resp:
            assert resp.status == 200
            job_data = json.loads(resp.read().decode())
            assert job_data.get("status") in ("completed", "processing", "queued")
            print(f"  Job Status: {job_data.get('status')}, Stage: {job_data.get('stage')}")

# ── Test 4: P0.2 Session Creation, Message Persistence & Hydration ───────────
test_session_id = f"c_{uuid.uuid4().hex[:10]}"

@test("P0.2: Session Creation, User Message & Assistant Message Persistence")
def test_session_lifecycle():
    # 1. Create session
    sess_payload = json.dumps({
        "id": test_session_id,
        "user_id": "usr_test_verification",
        "title": "Q1 Financial Audit"
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/api/sessions",
        data=sess_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200

    # 2. Add user message
    user_msg_payload = json.dumps({
        "role": "user",
        "content": "What is our Q1 Actual Revenue?"
    }).encode("utf-8")
    req_u = urllib.request.Request(
        f"{BASE_URL}/api/sessions/{test_session_id}/messages",
        data=user_msg_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_u, timeout=10) as resp:
        assert resp.status == 200

    # 3. Add assistant message with citation
    asst_msg_payload = json.dumps({
        "role": "assistant",
        "content": "According to Financial_Q1_2026.csv, Q1 Actual Revenue is $520,000.",
        "citations": [{
            "document_id": uploaded_doc_id or "doc_1",
            "source_filename": "Financial_Q1_2026.csv",
            "text_excerpt": "Revenue,500000,520000,20000"
        }]
    }).encode("utf-8")
    req_a = urllib.request.Request(
        f"{BASE_URL}/api/sessions/{test_session_id}/messages",
        data=asst_msg_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_a, timeout=10) as resp:
        assert resp.status == 200

    # 4. Hydrate session (simulating page refresh)
    req_get = urllib.request.Request(f"{BASE_URL}/api/sessions/{test_session_id}")
    with urllib.request.urlopen(req_get, timeout=10) as resp:
        assert resp.status == 200
        hydrated = json.loads(resp.read().decode())
        msgs = hydrated.get("messages", [])
        assert len(msgs) == 2, f"Expected 2 persisted messages, got {len(msgs)}"
        assert msgs[0]["role"] == "user"
        assert msgs[0]["content"] == "What is our Q1 Actual Revenue?"
        assert msgs[1]["role"] == "assistant"
        assert "$520,000" in msgs[1]["content"]
        assert len(msgs[1]["citations"]) == 1
        print(f"  Successfully hydrated {len(msgs)} messages across refresh simulation!")

# ── Test 5: P0.5 Workspace Library & Immutability / Working Copy Toggle ──────
@test("P0.5: Workspace Library Ingestion & Original vs Working Copy Immutability")
def test_library_and_working_copies():
    # 1. Verify document is in user library
    req_lib = urllib.request.Request(f"{BASE_URL}/api/library?user_id=usr_test_verification")
    with urllib.request.urlopen(req_lib, timeout=10) as resp:
        assert resp.status == 200
        lib_data = json.loads(resp.read().decode())
        docs = lib_data.get("documents", [])
        matching = [d for d in docs if d.get("document_id") == uploaded_doc_id]
        assert len(matching) > 0, "Uploaded document not found in Workspace Library!"
        print(f"  Found document in Library: {matching[0]['filename']}")

    # 2. Fetch original content
    req_orig = urllib.request.Request(f"{BASE_URL}/api/documents/{uploaded_doc_id}/content?version=original")
    with urllib.request.urlopen(req_orig, timeout=10) as resp:
        assert resp.status == 200
        orig_data = json.loads(resp.read().decode())
        orig_text = orig_data.get("text", "")
        assert "520000" in orig_text

    # 3. Create a working copy edit
    edit_payload = json.dumps({
        "format": "csv",
        "edits": [{"row": 1, "col": 2, "value": "599999"}]
    }).encode("utf-8")
    req_save = urllib.request.Request(
        f"{BASE_URL}/api/documents/{uploaded_doc_id}/save",
        data=edit_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_save, timeout=10) as resp:
        assert resp.status == 200
        save_data = json.loads(resp.read().decode())
        print(f"  Working copy version created: {save_data.get('version')}")

    # 4. Verify working copy returns edited value 599999
    req_wc = urllib.request.Request(f"{BASE_URL}/api/documents/{uploaded_doc_id}/content")
    with urllib.request.urlopen(req_wc, timeout=10) as resp:
        assert resp.status == 200
        wc_data = json.loads(resp.read().decode())
        wc_text = wc_data.get("text", "")
        assert "599999" in wc_text, f"Working copy missing edited value: {wc_text}"

    # 5. Verify Original Source is STRICTLY IMMUTABLE (still has 520000, NOT 599999)
    req_orig_again = urllib.request.Request(f"{BASE_URL}/api/documents/{uploaded_doc_id}/content?version=original")
    with urllib.request.urlopen(req_orig_again, timeout=10) as resp:
        assert resp.status == 200
        orig_data_again = json.loads(resp.read().decode())
        orig_text_again = orig_data_again.get("text", "")
        assert "520000" in orig_text_again, "Original source was modified!"
        assert "599999" not in orig_text_again, "Original source contaminated with working copy edit!"
        print("  Original Source strictly immutable: verified 520000 preserved, 599999 absent.")

    # 6. Test Attach from Library to Session
    attach_payload = json.dumps({
        "user_id": "usr_test_verification",
        "session_id": test_session_id,
        "document_ids": [uploaded_doc_id]
    }).encode("utf-8")
    req_attach = urllib.request.Request(
        f"{BASE_URL}/api/library/attach",
        data=attach_payload,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_attach, timeout=10) as resp:
        assert resp.status == 200
        attach_data = json.loads(resp.read().decode())
        assert attach_data.get("success") is True
        print("  Successfully attached library document to active session!")

def main():
    print("==================================================")
    print("Starting Draythos Comprehensive P0 Verification")
    print("==================================================")

    test_general_knowledge()
    test_conversational_greeting()
    test_document_upload()
    test_session_lifecycle()
    test_library_and_working_copies()

    print("\n==================================================")
    print(f"VERIFICATION SUMMARY: {len(passed_tests)} Passed, {len(failed_tests)} Failed")
    print("==================================================")
    for p in passed_tests:
        print(f"  ✓ {p}")
    for f, err in failed_tests:
        print(f"  ✗ {f}: {err}")

    if failed_tests:
        sys.exit(1)
    else:
        print("\nALL P0 TESTS PASSED CLEANLY!")
        sys.exit(0)

if __name__ == "__main__":
    main()

