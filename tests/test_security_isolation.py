"""Tests for security, session isolation, filename sanitization, and access boundaries."""

import pytest
from vhagar.components.security import SecurityManager


def test_sanitize_filename(test_config):
    sec = SecurityManager(test_config)

    # Path traversal attack
    assert "../../../etc/passwd" not in sec.sanitize_filename("../../../etc/passwd")
    assert sec.sanitize_filename("valid_report_2026.pdf") == "valid_report_2026.pdf"
    assert not sec.sanitize_filename("..\\..\\windows\\system32").startswith("..")


def test_file_type_and_size_validation(test_config):
    sec = SecurityManager(test_config)

    assert sec.validate_file_type("financials.xlsx") is True
    assert sec.validate_file_type("memo.docx") is True
    assert sec.validate_file_type("statement.pdf") is True
    assert sec.validate_file_type("malicious.exe") is False
    assert sec.validate_file_type("script.sh") is False

    max_bytes = test_config.max_upload_size_mb * 1024 * 1024
    assert sec.validate_file_size(1000) is True
    assert sec.validate_file_size(max_bytes + 1) is False


def test_cross_session_document_isolation(test_config):
    sec = SecurityManager(test_config)

    # Register document for Session Alpha (User A)
    sec.register_document_session(
        document_id="doc_private_alpha",
        session_id="session_alpha_123",
    )

    # Register document for Session Beta (User B)
    sec.register_document_session(
        document_id="doc_private_beta",
        session_id="session_beta_456",
    )

    # Invariant: Session Alpha must have access to doc_private_alpha
    assert sec.validate_session_access("session_alpha_123", "doc_private_alpha") is True

    # Invariant: Session Beta must NOT have access to doc_private_alpha
    assert sec.validate_session_access("session_beta_456", "doc_private_alpha") is False

    # Invariant: Session Alpha must NOT have access to doc_private_beta
    assert sec.validate_session_access("session_alpha_123", "doc_private_beta") is False


def test_secret_hashing_and_verification(test_config):
    sec = SecurityManager(test_config)

    secret = "SuperSecretAuthKey999"
    hashed = sec.hash_secret(secret)

    assert sec.verify_secret(secret, hashed) is True
    assert sec.verify_secret("WrongSecret", hashed) is False


@pytest.mark.asyncio
async def test_cross_user_retrieval_isolation_negative(test_config):
    """Negative test verifying tenant/user isolation:

    User B querying with include_global=True or passing User A's document IDs
    must NEVER retrieve User A's private chunks.
    """
    from vhagar.bootstrap import bootstrap
    from vhagar.components.document_processor import DocumentReference, ExtractedContent, PageContent, DocumentFormat, ProcessingStatus
    from vhagar.components.hybrid_index import SearchRequest
    from vhagar.database import get_db

    registry = await bootstrap(test_config)
    db = get_db()
    index = registry.hybrid_index

    import uuid
    rand_suffix = uuid.uuid4().hex[:6]
    u_a = db.create_user(f"tenant_alpha_{rand_suffix}@draythos.io", "pass123", "User Alpha")
    u_b = db.create_user(f"tenant_beta_{rand_suffix}@draythos.io", "pass123", "User Beta")
    user_a = u_a["id"]
    user_b = u_b["id"]

    # Ingest private document for User A
    doc_a_ref = DocumentReference(
        document_id="doc_payroll_alpha",
        session_id="session_alpha",
        source_filename="payroll_confidential.txt",
        original_path="payroll_confidential.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    doc_a_ref.user_id = user_a
    content_a = ExtractedContent(
        pages=[PageContent(page_number=1, text="Executive Base Salary for Alice: 195000 USD. Secret bonus: 45000.", confidence=1.0)],
        full_text="Executive Base Salary for Alice: 195000 USD. Secret bonus: 45000.",
        format=DocumentFormat.TXT,
        total_pages=1,
        processing_status=ProcessingStatus.COMPLETED,
    )
    # Register in DB under user_a
    db.register_document("doc_payroll_alpha", "session_alpha", user_a, "payroll_confidential.txt", "payroll_confidential.txt", "txt", 100)
    db.save_document_chunks(
        document_id="doc_payroll_alpha",
        version_id="v1",
        chunks=[{"chunk_id": "chunk_alpha_1", "document_id": "doc_payroll_alpha", "text": content_a.full_text, "source_filename": "payroll_confidential.txt"}],
        user_id=user_a,
    )
    await index.index_document(doc_a_ref, content_a)

    # Ingest public document for User B
    doc_b_ref = DocumentReference(
        document_id="doc_marketing_beta",
        session_id="session_beta",
        user_id=user_b,
        source_filename="marketing_q1.txt",
        original_path="marketing_q1.txt",
        format=DocumentFormat.TXT,
        processing_status=ProcessingStatus.COMPLETED,
    )
    content_b = ExtractedContent(
        pages=[PageContent(page_number=1, text="Q1 Advertising Campaign spend was 35000 USD across search channels.", confidence=1.0)],
        full_text="Q1 Advertising Campaign spend was 35000 USD across search channels.",
        format=DocumentFormat.TXT,
        total_pages=1,
        processing_status=ProcessingStatus.COMPLETED,
    )
    db.register_document("doc_marketing_beta", "session_beta", user_b, "marketing_q1.txt", "marketing_q1.txt", "txt", 100)
    db.save_document_chunks(
        document_id="doc_marketing_beta",
        version_id="v1",
        chunks=[{"chunk_id": "chunk_beta_1", "document_id": "doc_marketing_beta", "text": content_b.full_text, "source_filename": "marketing_q1.txt"}],
        user_id=user_b,
    )
    await index.index_document(doc_b_ref, content_b)

    # Case 1: User B runs global search across the workspace
    # Invariant: User B must NEVER see User A's confidential payroll data
    user_b_global_req = SearchRequest(
        query="Executive Base Salary Alice",
        session_id="session_beta",
        user_id=user_b,
        include_global=True,
    )
    res_b = await index.search(user_b_global_req)
    retrieved_texts = [r.text for r in res_b]
    assert not any("195000" in t for t in retrieved_texts), "Security breach: User B retrieved User A's private payroll!"
    assert not any(r.document_id == "doc_payroll_alpha" for r in res_b)

    # Case 2: User B explicitly tries to exploit/pass User A's document_id
    # Invariant: HybridIndex must reject/strip User A's doc_id because it does not belong to User B
    user_b_exploit_req = SearchRequest(
        query="Executive Base Salary",
        session_id="session_beta",
        user_id=user_b,
        document_ids=["doc_payroll_alpha"],
    )
    res_exploit = await index.search(user_b_exploit_req)
    assert len(res_exploit) == 0, "Security breach: User B accessed User A's document by specifying document_id!"


