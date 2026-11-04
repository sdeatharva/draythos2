#!/usr/bin/env python3
"""
Verification Script: Model Configuration, Provider Transparency, and Preference Persistence

Verifies:
1. Exact model catalog definitions (Gemini 3.x series, OpenRouter Nemotron/Dots/Xing series)
2. Database defaults (gemini-3.8-flash)
3. User preference persistence across refresh and relogin
4. Chat non-streaming API: exact model forwarding, provider diagnostics, real error reporting (no synthetic text)
5. Chat SSE streaming API: exact model forwarding, provider diagnostics, real error events (no synthetic text)
6. Zero arbitrary model substitutions throughout the entire request pipeline
"""

import sys
import json
import urllib.request
import urllib.error
import sqlite3
import time

FRONTEND_BASE = "http://127.0.0.1:3000"
VHAGAR_BASE = "http://127.0.0.1:8001"

passed_checks = []
failed_checks = []

def record(name: str, passed: bool, details: str = ""):
    if passed:
        passed_checks.append(name)
        print(f"  [PASS] {name} {details}")
    else:
        failed_checks.append(name)
        print(f"  [FAIL] {name} {details}")

print("=" * 70)
print("DRAYTHOS MODEL INTEGRITY & PROVIDER DIAGNOSTICS VERIFICATION")
print("=" * 70)

# -------------------------------------------------------------
# 1. Model Catalog & Constants Verification
# -------------------------------------------------------------
print("\n--- 1. Model Catalog & Constants Verification ---")
with open("frontend/src/lib/constants.ts", "r") as f:
    constants_content = f.read()

expected_gemini = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]
expected_openrouter = [
    "nvidia/nemotron-3.5-super-vl:free",
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "dots-studio/dots-3-note-preview:free",
    "xingchen-agi/xing4.0-29b-a4b:free",
    "nvidia/nemotron-3.5-lightning:free",
]

all_gemini_present = all(m in constants_content for m in expected_gemini)
record("Gemini Free Models Catalog (exact 5 models)", all_gemini_present)

all_or_present = all(m in constants_content for m in expected_openrouter)
record("OpenRouter Free Models Catalog (exact 5 models)", all_or_present)

default_gemini = 'DEFAULT_MODEL = "gemini-3.8-flash"' in constants_content
record("Default Gemini Model is gemini-3.8-flash", default_gemini)

default_or = 'DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free"' in constants_content
record("Default OpenRouter Model is nvidia/nemotron-3.5-super-vl:free", default_or)

fallback_gemini = 'FALLBACK_MODEL = "gemini-3.6-flash"' in constants_content
record("Fallback Gemini Model is gemini-3.6-flash", fallback_gemini)

# -------------------------------------------------------------
# 2. Database & Backend Preferences Defaults
# -------------------------------------------------------------
print("\n--- 2. Database & Backend Preferences Defaults ---")
DB_PATH = "data/draythos.db"
conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Check default user row
cur.execute("SELECT selected_model, preferred_provider FROM users WHERE id = 'usr_default'")
user_row = cur.fetchone()
if user_row:
    db_model = user_row["selected_model"]
    db_provider = user_row["preferred_provider"]
    record("Database usr_default selected_model is gemini-3.8-flash", db_model == "gemini-3.8-flash", f"(got {db_model})")
    record("Database usr_default preferred_provider is gemini", db_provider == "gemini", f"(got {db_provider})")
else:
    record("Database usr_default found", False)

# Check Vhagar API /user/preferences endpoint
try:
    req = urllib.request.Request(f"{VHAGAR_BASE}/user/preferences?user_id=usr_default")
    with urllib.request.urlopen(req, timeout=5) as res:
        pref_data = json.loads(res.read().decode())
        record("Vhagar /user/preferences endpoint returns selected_model", pref_data.get("selected_model") == "gemini-3.8-flash", f"(got {pref_data.get('selected_model')})")
except Exception as e:
    record("Vhagar /user/preferences endpoint reachable", False, str(e))

# -------------------------------------------------------------
# 3. Model Preference Mutation & Relogin Persistence
# -------------------------------------------------------------
print("\n--- 3. Preference Mutation & Relogin Persistence ---")
test_models = [
    "gemini-3.7-flash",
    "nvidia/nemotron-3.5-super-vl:free",
    "gemini-3.8-flash",
]

for test_model in test_models:
    # Update preference via Next.js API
    update_payload = {
        "user_id": "usr_default",
        "selected_model": test_model,
        "preferred_provider": "openrouter" if "nemotron" in test_model else "gemini",
        "custom_instructions": "Ensure zero hallucination.",
    }
    req = urllib.request.Request(
        f"{FRONTEND_BASE}/api/user/preferences",
        data=json.dumps(update_payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=5) as res:
        update_res = json.loads(res.read().decode())
        record(f"Saved preference model to {test_model}", update_res.get("success") is True or update_res.get("status") == "success")

    # Fetch preference from API to verify persistence
    get_req = urllib.request.Request(f"{FRONTEND_BASE}/api/user/preferences?user_id=usr_default")
    with urllib.request.urlopen(get_req, timeout=5) as res:
        fetched = json.loads(res.read().decode())
        record(f"Fetched persisted preference matches {test_model}", fetched.get("selected_model") == test_model, f"(got {fetched.get('selected_model')})")

    # Verify directly in SQLite DB with fresh query
    with sqlite3.connect(DB_PATH) as fresh_conn:
        fresh_cur = fresh_conn.cursor()
        fresh_cur.execute("SELECT selected_model FROM users WHERE id = 'usr_default'")
        db_val = fresh_cur.fetchone()[0]
    record(f"SQLite DB users row reflects {test_model}", db_val == test_model, f"(got {db_val})")

# -------------------------------------------------------------
# 4. Non-Streaming Chat API: Exact Model Routing & Error Reporting
# -------------------------------------------------------------
print("\n--- 4. Non-Streaming Chat API: Exact Model Routing & Error Reporting ---")

# Test Gemini with exact model gemini-3.8-flash
gemini_chat_payload = {
    "message": "Verify model configuration",
    "sessionId": "ses_model_test_1",
    "user_id": "usr_default",
    "preferred_provider": "gemini",
    "selected_model": "gemini-3.8-flash",
    "geminiKey": "AIzaSy_TEST_INVALID_KEY_FOR_DIAGNOSTICS",
    "history": []
}

req = urllib.request.Request(
    f"{FRONTEND_BASE}/api/chat",
    data=json.dumps(gemini_chat_payload).encode(),
    headers={"Content-Type": "application/json", "X-Correlation-ID": "test-gemini-routing"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        chat_res = json.loads(res.read().decode())
        provider_used = chat_res.get("provider", "")
        finish_reason = chat_res.get("finishReason", "")
        message = chat_res.get("message", "")
        
        record("Gemini provider reported as gemini/gemini-3.8-flash", provider_used == "gemini/gemini-3.8-flash", f"(got {provider_used})")
        record("Gemini finishReason reported as error", finish_reason == "error", f"(got {finish_reason})")
        record("Gemini transparent error displayed (no synthetic mask)", "Google Gemini Error (gemini-3.8-flash)" in message, f"(sample: {message[:100]}...)")
except Exception as e:
    record("Gemini non-streaming test completed", False, str(e))

# Test OpenRouter with exact model nvidia/nemotron-3.5-super-vl:free
or_chat_payload = {
    "message": "Verify openrouter model configuration",
    "sessionId": "ses_model_test_2",
    "user_id": "usr_default",
    "preferred_provider": "openrouter",
    "selected_model": "nvidia/nemotron-3.5-super-vl:free",
    "openRouterKey": "sk-or-v1-TEST_INVALID_KEY_FOR_DIAGNOSTICS",
    "history": []
}

req = urllib.request.Request(
    f"{FRONTEND_BASE}/api/chat",
    data=json.dumps(or_chat_payload).encode(),
    headers={"Content-Type": "application/json", "X-Correlation-ID": "test-or-routing"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        chat_res = json.loads(res.read().decode())
        provider_used = chat_res.get("provider", "")
        finish_reason = chat_res.get("finishReason", "")
        message = chat_res.get("message", "")
        
        record("OpenRouter provider reported as openrouter/nvidia/nemotron-3.5-super-vl:free", provider_used == "openrouter/nvidia/nemotron-3.5-super-vl:free", f"(got {provider_used})")
        record("OpenRouter finishReason reported as error", finish_reason == "error", f"(got {finish_reason})")
        record("OpenRouter transparent error displayed (no synthetic mask)", "OpenRouter Connection Error (nvidia/nemotron-3.5-super-vl:free)" in message, f"(sample: {message[:100]}...)")
except Exception as e:
    record("OpenRouter non-streaming test completed", False, str(e))

# -------------------------------------------------------------
# 5. Streaming Chat API: Exact Model Routing & SSE Events
# -------------------------------------------------------------
print("\n--- 5. Streaming Chat API: Exact Model Routing & SSE Events ---")

# Test Gemini streaming
req = urllib.request.Request(
    f"{FRONTEND_BASE}/api/chat/stream",
    data=json.dumps(gemini_chat_payload).encode(),
    headers={"Content-Type": "application/json", "X-Correlation-ID": "test-gemini-stream"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        raw_stream = res.read().decode()
        record("Gemini stream returned SSE events", "event: status" in raw_stream and "event: complete" in raw_stream)
        record("Gemini stream delta contains exact model error notice", "Google Gemini Error (gemini-3.8-flash)" in raw_stream)
        record("Gemini stream complete event reports provider gemini/gemini-3.8-flash", '"provider":"gemini/gemini-3.8-flash"' in raw_stream)
except Exception as e:
    record("Gemini streaming test completed", False, str(e))

# Test OpenRouter streaming
req = urllib.request.Request(
    f"{FRONTEND_BASE}/api/chat/stream",
    data=json.dumps(or_chat_payload).encode(),
    headers={"Content-Type": "application/json", "X-Correlation-ID": "test-or-stream"},
    method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=10) as res:
        raw_stream = res.read().decode()
        record("OpenRouter stream returned SSE events", "event: status" in raw_stream and "event: complete" in raw_stream)
        record("OpenRouter stream delta contains exact model error notice", "OpenRouter Connection Error (nvidia/nemotron-3.5-super-vl:free)" in raw_stream)
        record("OpenRouter stream complete event reports provider openrouter/nvidia/nemotron-3.5-super-vl:free", '"provider":"openrouter/nvidia/nemotron-3.5-super-vl:free"' in raw_stream)
except Exception as e:
    record("OpenRouter streaming test completed", False, str(e))

# -------------------------------------------------------------
# 6. Verification Summary
# -------------------------------------------------------------
print("\n" + "=" * 70)
print(f"VERIFICATION RESULTS: {len(passed_checks)} Passed, {len(failed_checks)} Failed")
print("=" * 70)

if failed_checks:
    print("FAILED CHECKS:")
    for f in failed_checks:
        print(f"  - {f}")
    sys.exit(1)
else:
    print("ALL MODEL CONFIGURATION & PROVIDER TESTS PASSED!")
    sys.exit(0)
