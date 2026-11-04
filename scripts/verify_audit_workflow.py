#!/usr/bin/env python3
"""
scripts/verify_audit_workflow.py

Comprehensive end-to-end verification script for the audit workflow:
1. "Calculate the total debit for this column." -> 1 operation, 1 working-copy update.
2. "What does this document signify for our organization?" -> Grounded financial analysis, no edit, 0 version increments.
3. "Which accounts contribute most to that total?" -> Contextual follow-up, no edit repetition, 0 version increments.
4. "Who is the president of Uganda?" -> General knowledge, ZERO document citations.
5. "Who is the president of Iran?" -> Fast direct response, ZERO document citations.
6. "Why did that take so long?" -> Honest telemetry, ZERO fabricated explanations.
7. Refresh & Reopen -> Persistent working copy & visual diff highlights intact.
"""

import json
import os
import shutil
import sqlite3
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_URL = "http://127.0.0.1:3000"
BACKEND_URL = "http://127.0.0.1:8001"
DB_PATH = BASE_DIR / "data" / "draythos.db"

def post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def setup_isolated_test_doc():
    """Sets up a pristine copy of General-Ledger.xlsx for isolated workflow testing."""
    test_doc_id = "test-audit-ledger-01"
    test_session_id = f"s_audit_{int(time.time())}"
    
    doc_dir = BASE_DIR / "data" / "documents" / test_doc_id
    doc_dir.mkdir(parents=True, exist_ok=True)
    
    src_file = BASE_DIR / "data" / "documents" / "0eaa87b3-00db-4f29-ac53-faeefc2058fb" / "General-Ledger.xlsx"
    dest_file = doc_dir / "General-Ledger.xlsx"
    shutil.copy2(src_file, dest_file)
    
    # Clean any previous working copies for this doc
    wc_dir = BASE_DIR / "data" / "working_copies" / test_doc_id
    if wc_dir.exists():
        shutil.rmtree(wc_dir)
    wc_dir.mkdir(parents=True, exist_ok=True)
    
    # Insert or update in database
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM documents WHERE id = ?", (test_doc_id,))
    c.execute(
        """INSERT INTO documents (id, session_id, filename, file_path, format, size, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (test_doc_id, test_session_id, "General-Ledger.xlsx", f"data/documents/{test_doc_id}/General-Ledger.xlsx", "xlsx", dest_file.stat().st_size, "completed"),
    )
    conn.commit()
    conn.close()
    
    return test_doc_id, test_session_id

def main():
    print("=" * 80)
    print(" DRAYTHOS AUDIT WORKFLOW VERIFICATION SUITE")
    print("=" * 80)
    
    doc_id, session_id = setup_isolated_test_doc()
    print(f"[*] Initialized pristine test doc: {doc_id} in session: {session_id}")
    
    wc_dir = BASE_DIR / "data" / "working_copies" / doc_id
    history = []
    
    # -------------------------------------------------------------------------
    # STEP 1: "Calculate the total debit for this column."
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 1] 'Calculate the total debit for this column.'")
    print("-" * 60)
    
    p1_payload = {
        "message": "Calculate the total debit for this column.",
        "sessionId": session_id,
        "activeDocumentId": doc_id,
        "attachments": [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "source_filename": "General-Ledger.xlsx",
                "format": "xlsx",
            }
        ],
        "history": history,
    }
    
    start_t = time.time()
    res1 = post_json(f"{FRONTEND_URL}/api/chat", p1_payload)
    elapsed1 = time.time() - start_t
    
    text1 = res1.get("text") or res1.get("message", "")
    citations1 = res1.get("citations", [])
    print(f"Response (in {elapsed1:.2f}s):\n{text1[:300]}...\n")
    
    assert "Working Copy" in text1 or "working copy" in text1.lower(), "Step 1 failed: No working copy reported"
    assert "E2002" in text1 or "SUM(E2:E2001)" in text1, "Step 1 failed: Expected formula for debit column at E2002"
    
    # Check working copies directory
    wc_files_1 = list(wc_dir.glob("*.xlsx"))
    print(f"Working copies generated: {[f.name for f in wc_files_1]}")
    assert len(wc_files_1) == 1, f"Step 1 failed: Expected exactly 1 working copy, found {len(wc_files_1)}"
    
    # Verify content and visual diff from backend
    content1 = get_json(f"{BACKEND_URL}/documents/{doc_id}/content")
    assert content1.get("is_working_copy") is True, "Step 1 failed: backend content is not working copy"
    modified_cells_1 = content1.get("modified_cells", [])
    print(f"Modified cells detected by backend diff: {modified_cells_1}")
    assert any("E2002" in cell for cell in modified_cells_1), f"Step 1 failed: E2002 not in modified_cells: {modified_cells_1}"
    
    history.append({"role": "user", "content": "Calculate the total debit for this column."})
    history.append({"role": "assistant", "content": text1})
    print("--> PASS: Step 1 executed successfully (1 operation, 1 working copy version created, visual diff highlighted).")

    # -------------------------------------------------------------------------
    # STEP 2: "What does this document signify for our organization?"
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 2] 'What does this document signify for our organization?'")
    print("-" * 60)
    
    p2_payload = {
        "message": "What does this document signify for our organization?",
        "sessionId": session_id,
        "activeDocumentId": doc_id,
        "attachments": [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "source_filename": "General-Ledger.xlsx",
                "format": "xlsx",
            }
        ],
        "history": history,
    }
    
    res2 = post_json(f"{FRONTEND_URL}/api/chat", p2_payload)
    text2 = res2.get("text") or res2.get("message", "")
    citations2 = res2.get("citations", [])
    print(f"Response:\n{text2[:400]}...\n")
    print(f"Citations returned: {len(citations2)}")
    
    # Verify grounded ledger analysis
    assert "Explicit Facts" in text2 or "Facts" in text2, "Step 2 failed: Missing explicit facts section"
    assert "Data Inferences" in text2 or "Inferences" in text2, "Step 2 failed: Missing data inferences section"
    assert "Organizational Implications" in text2 or "Implications" in text2, "Step 2 failed: Missing organizational implications"
    assert "Information Gaps" in text2 or "Unknowns" in text2, "Step 2 failed: Missing information gaps / unknowns"
    assert "1,210,240.47" in text2, "Step 2 failed: Did not cite exact total debits ($1,210,240.47)"
    assert "1,973,281.93" in text2, "Step 2 failed: Did not cite exact total credits ($1,973,281.93)"
    
    # CRITICAL: Verify NO new working copy was generated
    wc_files_2 = list(wc_dir.glob("*.xlsx"))
    assert len(wc_files_2) == 1, f"Step 2 REGRESSION: Expected 1 working copy, but found {len(wc_files_2)} (duplicate edit triggered!)"
    
    history.append({"role": "user", "content": "What does this document signify for our organization?"})
    history.append({"role": "assistant", "content": text2})
    print("--> PASS: Step 2 grounded financial reasoning verified with ZERO duplicate edits.")

    # -------------------------------------------------------------------------
    # STEP 3: "Which accounts contribute most to that total?"
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 3] 'Which accounts contribute most to that total?'")
    print("-" * 60)
    
    p3_payload = {
        "message": "Which accounts contribute most to that total?",
        "sessionId": session_id,
        "activeDocumentId": doc_id,
        "attachments": [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "source_filename": "General-Ledger.xlsx",
                "format": "xlsx",
            }
        ],
        "history": history,
    }
    
    res3 = post_json(f"{FRONTEND_URL}/api/chat", p3_payload)
    text3 = res3.get("text") or res3.get("message", "")
    print(f"Response:\n{text3[:400]}...\n")
    
    # Verify accounts and amounts
    assert "Travel Expense" in text3, "Step 3 failed: Travel Expense missing"
    assert "Payroll Expense" in text3, "Step 3 failed: Payroll Expense missing"
    assert "COGS" in text3 or "Cost of Goods Sold" in text3, "Step 3 failed: COGS missing"
    assert "412,380.48" in text3 or "412,380" in text3, "Step 3 failed: Travel Expense amount missing"
    assert "399,923.66" in text3 or "399,923" in text3, "Step 3 failed: Payroll Expense amount missing"
    assert "397,936.33" in text3 or "397,936" in text3, "Step 3 failed: COGS amount missing"
    
    # CRITICAL: Verify NO repeated edit version was created
    wc_files_3 = list(wc_dir.glob("*.xlsx"))
    assert len(wc_files_3) == 1, f"Step 3 REGRESSION: Expected 1 working copy, but found {len(wc_files_3)} (repeated edit triggered!)"
    
    history.append({"role": "user", "content": "Which accounts contribute most to that total?"})
    history.append({"role": "assistant", "content": text3})
    print("--> PASS: Step 3 contextual account breakdown verified with ZERO version increments.")

    # -------------------------------------------------------------------------
    # STEP 4: "Who is the president of Uganda?"
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 4] 'Who is the president of Uganda?'")
    print("-" * 60)
    
    p4_payload = {
        "message": "Who is the president of Uganda?",
        "sessionId": session_id,
        "activeDocumentId": doc_id,
        "attachments": [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "source_filename": "General-Ledger.xlsx",
                "format": "xlsx",
            }
        ],
        "history": history,
    }
    
    start_t4 = time.time()
    res4 = post_json(f"{FRONTEND_URL}/api/chat", p4_payload)
    elapsed4 = time.time() - start_t4
    
    text4 = res4.get("text") or res4.get("message", "")
    citations4 = res4.get("citations", [])
    print(f"Response (in {elapsed4:.2f}s):\n{text4}\n")
    print(f"Citations count: {len(citations4)}")
    
    assert "Yoweri Museveni" in text4 or "Museveni" in text4, "Step 4 failed: Did not identify Yoweri Museveni"
    assert len(citations4) == 0, f"Step 4 REGRESSION: General knowledge query returned {len(citations4)} document citations!"
    assert "General-Ledger" not in text4, "Step 4 REGRESSION: Mentions ledger document in general knowledge answer"
    
    history.append({"role": "user", "content": "Who is the president of Uganda?"})
    history.append({"role": "assistant", "content": text4})
    print("--> PASS: Step 4 general knowledge query returned directly with STRICTLY ZERO document citations.")

    # -------------------------------------------------------------------------
    # STEP 5: "Who is the president of Iran?"
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 5] 'Who is the president of Iran?'")
    print("-" * 60)
    
    p5_payload = {
        "message": "Who is the president of Iran?",
        "sessionId": session_id,
        "activeDocumentId": doc_id,
        "attachments": [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "source_filename": "General-Ledger.xlsx",
                "format": "xlsx",
            }
        ],
        "history": history,
    }
    
    start_t5 = time.time()
    res5 = post_json(f"{FRONTEND_URL}/api/chat", p5_payload)
    elapsed5 = time.time() - start_t5
    
    text5 = res5.get("text") or res5.get("message", "")
    citations5 = res5.get("citations", [])
    print(f"Response (in {elapsed5:.2f}s):\n{text5}\n")
    print(f"Citations count: {len(citations5)}")
    
    assert "Masoud Pezeshkian" in text5 or "Pezeshkian" in text5, "Step 5 failed: Did not identify Masoud Pezeshkian"
    assert len(citations5) == 0, f"Step 5 REGRESSION: General knowledge query returned {len(citations5)} citations!"
    
    history.append({"role": "user", "content": "Who is the president of Iran?"})
    history.append({"role": "assistant", "content": text5})
    print(f"--> PASS: Step 5 fast general knowledge answered in {elapsed5*1000:.0f}ms with 0 citations.")

    # -------------------------------------------------------------------------
    # STEP 6: "Why did that take so long?"
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 6] 'Why did that take so long?'")
    print("-" * 60)
    
    p6_payload = {
        "message": "Why did that take so long?",
        "sessionId": session_id,
        "activeDocumentId": doc_id,
        "attachments": [
            {
                "document_id": doc_id,
                "session_id": session_id,
                "source_filename": "General-Ledger.xlsx",
                "format": "xlsx",
            }
        ],
        "history": history,
    }
    
    res6 = post_json(f"{FRONTEND_URL}/api/chat", p6_payload)
    text6 = res6.get("text") or res6.get("message", "")
    print(f"Response:\n{text6}\n")
    
    # Check that explanation is grounded in real telemetry, not fabricated excuses
    assert "2,000" not in text6 and "2000 rows" not in text6 and "AST formula tree" not in text6, \
        "Step 6 REGRESSION: Fabricated explanation of processing 2,000 rows / AST formula tree detected!"
    assert "0ms" in text6 or "Bypassed" in text6 or "retrieval" in text6.lower(), \
        "Step 6 failed: Did not state retrieval was bypassed for general knowledge"
    assert "Latency" in text6 or "Execution" in text6 or "Measured" in text6, \
        "Step 6 failed: Missing measured telemetry breakdown"
        
    print("--> PASS: Step 6 honest telemetry verified with ZERO fabricated explanations.")

    # -------------------------------------------------------------------------
    # STEP 7: Refresh & Reopen / Persistence & Diff Verification
    # -------------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("[STEP 7] Refresh & Reopen / Persistence & Diff Verification")
    print("-" * 60)
    
    # Fetch content without specifying working copy (default should load working copy)
    content_reopened = get_json(f"{BACKEND_URL}/documents/{doc_id}/content")
    assert content_reopened.get("is_working_copy") is True, "Step 7 failed: Reopened document did not load working copy by default"
    assert any("E2002" in cell for cell in content_reopened.get("modified_cells", [])), "Step 7 failed: E2002 not in modified_cells on reopen"
    
    # Fetch original content
    content_orig = get_json(f"{BACKEND_URL}/documents/{doc_id}/content?original=true")
    assert content_orig.get("is_working_copy") is False, "Step 7 failed: Original query returned working copy"
    assert len(content_orig.get("modified_cells", [])) == 0, "Step 7 failed: Original has modified cells"
    
    # Check max rows difference (original: 2001, working copy: 2002)
    orig_sheet = content_orig.get("sheets", [])[0]
    wc_sheet = content_reopened.get("sheets", [])[0]
    print(f"Original sheet rows: {orig_sheet.get('row_count')}, Working copy sheet rows: {wc_sheet.get('row_count')}")
    assert wc_sheet.get("row_count") == 2002, f"Step 7 failed: Expected 2002 rows in working copy, got {wc_sheet.get('row_count')}"
    assert orig_sheet.get("row_count") == 2001, f"Step 7 failed: Expected 2001 rows in original, got {orig_sheet.get('row_count')}"
    
    # Verify working copy row 2002 has formula '=SUM(E2:E2001)'
    row_2002 = wc_sheet.get("data", [])[2001]
    print(f"Working copy Row 2002 values: {row_2002}")
    assert row_2002[0] == "Total", "Step 7 failed: Row 2002 col A is not 'Total'"
    assert "=SUM(E2:E2001)" in str(row_2002[4]), f"Step 7 failed: Row 2002 col E is not '=SUM(E2:E2001)': {row_2002[4]}"
    
    print("--> PASS: Step 7 persistence, visual diff highlights, and original/working-copy toggle verified.")

    print("\n" + "=" * 80)
    print(" ALL 7 AUDIT WORKFLOW STEPS PASSED PERFECTLY!")
    print("=" * 80)

if __name__ == "__main__":
    main()
