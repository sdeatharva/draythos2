"""Central MCP API server for Vhagar – document upload, content, file serving, search."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, AsyncGenerator

from fastapi import FastAPI, File, UploadFile, Form, Request, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import structlog

from vhagar.config import get_config
from vhagar.bootstrap import bootstrap, get_registry
from vhagar.database import get_db
from vhagar.api import (
    facts_router,
    concepts_router,
    mappings_router,
    normalize_router,
    export_router,
    qa_router,
)

logger = structlog.get_logger(__name__)

MIME_MAP = {
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml",
}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """MCP server lifespan: bootstrap components on startup."""
    config = get_config()
    await bootstrap(config)
    logger.info("vhagar_mcp_ready")
    yield
    logger.info("vhagar_mcp_shutdown")


def create_mcp_app() -> FastAPI:
    """Build the MCP document-service FastAPI app."""
    config = get_config()

    app = FastAPI(title="Draythos Vhagar MCP", version="0.1.0", lifespan=lifespan)

    # Mount translation spine routers (Facts, Concepts, Mappings, Normalize, Export)
    app.include_router(facts_router)
    app.include_router(concepts_router)
    app.include_router(mappings_router)
    app.include_router(normalize_router)
    app.include_router(export_router)
    app.include_router(qa_router)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        corr_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = corr_id
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = corr_id
        return response

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        if request.url.path in (
            "/health",
            "/docs",
            "/openapi.json",
            "/auth/login",
            "/auth/register",
            "/auth/verify",
            "/auth/verify-email",
            "/auth/resend-code",
        ):
            return await call_next(request)
        api_key = request.headers.get("X-API-Key", "")
        auth_header = request.headers.get("Authorization", "")
        # Allow dev or validate key / bearer token
        if config.mcp_api_key not in ("change-me-in-production", "draythos-key-alpha"):
            if api_key and api_key != config.mcp_api_key and not auth_header.startswith("Bearer "):
                return JSONResponse({"detail": "Invalid authentication credentials"}, status_code=401)
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        return response

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/auth/register")
    async def register(credentials: dict = Body(...)):
        email = (credentials.get("email") or credentials.get("username", "")).strip().lower()
        password = credentials.get("password", "")
        name = credentials.get("name", "").strip() or email.split("@")[0].capitalize()
        role = credentials.get("role", "Analyst")

        if not email or not password:
            raise HTTPException(400, "Email and password are required")
        if "@" not in email or "." not in email:
            raise HTTPException(400, "Invalid email address format")
        if len(password) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")

        db = get_db()
        try:
            user = db.create_user(email=email, password=password, name=name, role=role)
            return {
                "verification_required": True,
                "email": user["email"],
                "name": user["name"],
                "code": user.get("verification_code"),
                "message": f"Verification code sent to {email}. Please enter the code to activate your workspace.",
            }
        except Exception as exc:
            err_msg = str(exc)
            if "UNIQUE constraint failed" in err_msg or "already exists" in err_msg:
                raise HTTPException(409, "An account with this email address already exists. Please log in.")
            raise HTTPException(400, f"Registration failed: {err_msg}")

    @app.post("/auth/verify-email")
    async def verify_email(data: dict = Body(...)):
        email = (data.get("email") or "").strip().lower()
        code = str(data.get("code") or "").strip()

        if not email or not code:
            raise HTTPException(400, "Email and verification code are required")

        db = get_db()
        auth = db.verify_email_code(email=email, code=code)
        if not auth:
            raise HTTPException(400, "Invalid or expired verification code")

        return auth

    @app.post("/auth/resend-code")
    async def resend_code(data: dict = Body(...)):
        email = (data.get("email") or "").strip().lower()
        if not email:
            raise HTTPException(400, "Email is required")

        db = get_db()
        code = db.resend_verification_code(email)
        if not code:
            raise HTTPException(404, "No account found with this email address")

        return {
            "success": True,
            "code": code,
            "message": f"A new verification code has been generated for {email}.",
        }

    @app.post("/auth/login")
    async def login(credentials: dict = Body(...)):
        email = (credentials.get("email") or credentials.get("username", "")).strip().lower()
        password = credentials.get("password", "")

        if not email or not password:
            raise HTTPException(400, "Email and password are required")

        db = get_db()
        auth = db.authenticate_user(email=email, password=password)

        if auth and auth.get("error") == "email_not_verified":
            return JSONResponse(
                {
                    "error": "email_not_verified",
                    "email": auth["email"],
                    "code": auth.get("verification_code"),
                    "detail": "Email is not verified. Please enter the verification code sent to your email.",
                },
                status_code=403,
            )

        if not auth:
            raise HTTPException(401, "Invalid email or password")

        return auth

    @app.post("/auth/google")
    async def google_auth(payload: dict = Body(...)):
        email = (payload.get("email") or "").strip().lower()
        name = (payload.get("name") or "").strip()
        google_id = (payload.get("google_id") or "").strip()

        if not email:
            raise HTTPException(400, "Google email is required")

        db = get_db()
        auth = db.authenticate_or_create_google_user(email=email, name=name, google_id=google_id)
        return auth

    @app.get("/auth/verify")
    async def verify_auth(request: Request):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        if not token:
            token = request.headers.get("X-Auth-Token", "")

        db = get_db()
        if token:
            user = db.verify_token(token)
            if user:
                return {"authenticated": True, "user": user}

        return {"authenticated": False}

    # ── Sessions API ──────────────────────────────────────────────────────────

    @app.get("/sessions")
    async def get_sessions(user_id: str = Query("usr_default")):
        db = get_db()
        sessions = db.list_user_sessions(user_id)
        return sessions

    @app.post("/sessions")
    async def create_session(data: dict = Body(...)):
        session_id = data.get("id") or f"c_{uuid.uuid4().hex[:8]}"
        user_id = data.get("user_id") or "usr_default"
        title = data.get("title") or "New chat"
        db = get_db()
        sess = db.get_or_create_session(session_id, user_id, title)
        return sess

    @app.get("/sessions/{session_id}")
    async def get_session(session_id: str):
        db = get_db()
        sess = db.get_session_details(session_id)
        if not sess:
            # Auto-create if requested
            sess = db.get_or_create_session(session_id, "usr_default", "New chat")
            sess["messages"] = []
            sess["attachments"] = []
        return sess

    @app.patch("/sessions/{session_id}")
    async def update_session(session_id: str, data: dict = Body(...)):
        title = data.get("title", "")
        if title:
            get_db().update_session_title(session_id, title)
        return {"success": True}

    @app.delete("/sessions/{session_id}")
    async def delete_session(session_id: str):
        get_db().delete_session(session_id)
        return {"success": True}

    @app.post("/sessions/{session_id}/messages")
    async def add_session_message(session_id: str, data: dict = Body(...)):
        role = data.get("role", "user")
        content = data.get("content", "")
        citations = data.get("citations", [])
        db = get_db()
        msg = db.add_message(session_id, role, content, citations)
        if role == "user" and content:
            try:
                with db._get_connection() as conn:
                    cur = conn.execute("SELECT title FROM sessions WHERE id = ?", (session_id,))
                    srow = cur.fetchone()
                    if srow and srow["title"] in ("New chat", "Untitled", "", "New conversation"):
                        clean_title = content.strip().split("\n")[0][:42].strip()
                        if clean_title:
                            db.update_session_title(session_id, clean_title)
            except Exception:
                pass
        return msg

    # ── User Keys API ─────────────────────────────────────────────────────────

    @app.get("/user/keys")
    async def get_keys(user_id: str = Query("usr_default")):
        return get_db().get_user_keys(user_id)

    @app.post("/user/keys")
    async def save_keys(data: dict = Body(...)):
        user_id = data.get("user_id", "usr_default")
        openrouter_key = data.get("openrouter_key", "")
        gemini_key = data.get("gemini_key", "")
        get_db().save_user_keys(user_id, openrouter_key, gemini_key)
        return {"success": True}

    @app.get("/user/preferences")
    async def get_user_preferences(user_id: str = Query("usr_default")):
        db = get_db()
        memories = db.get_user_memories(user_id)
        with db._get_connection() as conn:
            cur = conn.execute(
                "SELECT custom_instructions, selected_model, preferred_provider FROM users WHERE id = ?",
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                return {
                    "custom_instructions": row["custom_instructions"] or "",
                    "selected_model": row["selected_model"] or "gemini-3.8-flash",
                    "preferred_provider": row["preferred_provider"] or "gemini",
                    "memories": memories,
                }
        return {
            "custom_instructions": "",
            "selected_model": "gemini-3.8-flash",
            "preferred_provider": "gemini",
            "memories": memories,
        }

    @app.post("/user/preferences")
    async def save_user_preferences(data: dict = Body(...)):
        user_id = data.get("user_id", "usr_default")
        custom_instructions = data.get("custom_instructions")
        selected_model = data.get("selected_model")
        preferred_provider = data.get("preferred_provider")
        db = get_db()
        db.update_user_preferences(
            user_id,
            custom_instructions=custom_instructions,
            selected_model=selected_model,
            preferred_provider=preferred_provider,
        )
        return {"success": True}

    @app.post("/user/memories")
    async def add_memory(data: dict = Body(...)):
        user_id = data.get("user_id", "usr_default")
        fact = (data.get("fact") or "").strip()
        category = data.get("category", "general")
        if not fact:
            raise HTTPException(400, "fact is required")
        db = get_db()
        mem = db.add_user_memory(user_id, fact, category)
        return mem

    @app.delete("/user/memories/{memory_id}")
    async def delete_memory(memory_id: str, user_id: str = Query("usr_default")):
        db = get_db()
        deleted = db.delete_user_memory(user_id, memory_id)
        return {"success": deleted}

    @app.post("/upload")
    async def upload_document(
        request: Request,
        file: UploadFile = File(...),
        session_id: str = Form("default"),
        user_id: Optional[str] = Form(None),
        folder_id: Optional[str] = Form(None),
    ):
        registry = get_registry()
        corr_id = str(uuid.uuid4())

        if not registry.document_processor:
            raise HTTPException(503, "Document processor not ready")
        if not registry.security:
            raise HTTPException(503, "Security manager not ready")

        # Validate file
        if not registry.security.validate_file_type(file.filename or ""):
            raise HTTPException(
                400,
                f"Unsupported file type: {file.filename}. Supported: {', '.join(config.supported_formats)}",
            )

        # Read and save file
        content = await file.read()
        if not registry.security.validate_file_size(len(content)):
            raise HTTPException(400, f"File too large. Max: {config.max_upload_size_mb}MB")

        safe_name = registry.security.sanitize_filename(file.filename or "upload")
        doc_id = str(uuid.uuid4())
        dest_dir = config.documents_dir / doc_id
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / safe_name

        with open(dest_path, "wb") as f:
            f.write(content)

        logger.info("file_uploaded", document_id=doc_id, filename=safe_name, size=len(content), correlation_id=corr_id)

        # Register session ownership
        registry.security.register_document_session(doc_id, session_id)

        # Track persistent background ingestion job
        db = get_db()
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        actual_user_id = user_id
        if token:
            u = db.verify_token(token)
            if u:
                actual_user_id = u["id"]
        if not actual_user_id:
            actual_user_id = "usr_default"

        fmt_val = safe_name.split(".")[-1].lower() if "." in safe_name else "bin"
        job_id = db.create_ingestion_job(
            document_id=doc_id,
            user_id=actual_user_id,
            file_path=str(dest_path),
            filename=safe_name,
            format_type=fmt_val,
            total_chunks=1,
        )
        db.update_ingestion_job(job_id, status="processing", stage="parsing")

        # Process document
        try:
            doc_ref = await registry.document_processor.process_document(
                file_path=dest_path, session_id=session_id, document_id=doc_id
            )

            # Index the document
            if registry.hybrid_index:
                db.update_ingestion_job(job_id, status="processing", stage="extracting")
                extracted = await registry.document_processor.extract_content(
                    dest_path, doc_ref.format
                )
                db.update_ingestion_job(job_id, status="processing", stage="indexing", total_chunks=len(extracted.pages) or 1)
                await registry.hybrid_index.index_document(doc_ref, extracted)

                # Update concept layers
                db.update_ingestion_job(job_id, status="processing", stage="concepts")
                if registry.concept_mapper and extracted.terms:
                    await registry.concept_mapper.update_from_document(extracted.terms)
                if registry.concept_memory and extracted.terms:
                    summary = extracted.full_text[:500] if extracted.full_text else ""
                    await registry.concept_memory.ingest_from_document(doc_id, extracted.terms, summary)

            # Extract canonical facts with precise source locators (Section 4.1 & 4.2)
            if registry.facts_service:
                try:
                    db.update_ingestion_job(job_id, status="processing", stage="facts")
                    registry.facts_service.ingest_document_facts(
                        file_path=dest_path,
                        doc_id=doc_ref.document_id,
                        entity=safe_name.rsplit(".", 1)[0],
                        jurisdiction="GLOBAL",
                    )
                except Exception as fact_err:
                    logger.warning("facts_ingestion_warning", doc_id=doc_id, error=str(fact_err))

            if registry.observability:
                registry.observability.record_upload(doc_ref.format.value, "success", 0.0)

            # Register document in persistent database for session
            try:
                db.register_document(
                    doc_id=doc_ref.document_id,
                    session_id=session_id,
                    user_id=actual_user_id,
                    filename=doc_ref.source_filename,
                    file_path=str(dest_path),
                    format_type=doc_ref.format.value,
                    size=len(content),
                )
                if folder_id:
                    db.move_library_document(doc_ref.document_id, folder_id)
            except Exception as db_err:
                logger.warning("db_register_document_failed", error=str(db_err))

            db.update_ingestion_job(
                job_id,
                status="completed",
                stage="ready",
                processed_chunks=len(extracted.pages) if 'extracted' in locals() and extracted else 1,
            )

            return JSONResponse({
                "job_id": job_id,
                "document_id": doc_ref.document_id,
                "session_id": doc_ref.session_id,
                "source_filename": doc_ref.source_filename,
                "filename": doc_ref.source_filename,
                "format": doc_ref.format.value,
                "processing_status": doc_ref.processing_status.value,
                "media_type": doc_ref.media_type,
                "created_at": doc_ref.created_at.isoformat(),
            })
        except Exception as exc:
            db.update_ingestion_job(job_id, status="failed", stage="failed", error_message=str(exc))
            logger.error("processing_failed", document_id=doc_id, error=str(exc), correlation_id=corr_id)
            if registry.observability:
                registry.observability.record_upload("unknown", "failed", 0.0)
            raise HTTPException(500, f"Document processing failed: {str(exc)}")

    @app.get("/upload/jobs/{job_id}")
    async def get_job_status(job_id: str):
        """Get status of an ingestion job."""
        job = get_db().get_ingestion_job(job_id)
        if not job:
            raise HTTPException(404, f"Ingestion job {job_id} not found")
        return job

    @app.get("/upload/jobs")
    async def list_jobs(user_id: str = "usr_default"):
        """List active/recent ingestion jobs."""
        return get_db().get_active_ingestion_jobs(user_id=user_id)

    @app.get("/documents/{document_id}/content")
    async def get_document_content(document_id: str, request: Request):
        registry = get_registry()
        if not registry.document_processor:
            raise HTTPException(503, "Document processor not ready")

        # Verify tenant authorization if token or user_id provided
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        user_id = request.query_params.get("user_id")
        if token:
            user = get_db().verify_token(token)
            if user:
                user_id = user["id"]
        if user_id:
            user_docs = set(get_db().get_user_document_ids(user_id))
            if document_id not in user_docs:
                raise HTTPException(403, f"Access denied to document {document_id}")

        # Find the document file
        doc_dir = config.documents_dir / document_id
        if not doc_dir.exists():
            raise HTTPException(404, f"Document {document_id} not found")

        files = list(doc_dir.iterdir())
        if not files:
            raise HTTPException(404, f"No files in document {document_id}")

        orig_file = files[0]

        # Use latest working copy if available (unless original requested)
        file_path = None
        original_param = request.query_params.get("original", "").lower() in ("true", "1")
        requested_version = request.query_params.get("version", "latest")
        if requested_version != "original" and not original_param:
            wc_dir = config.working_copies_dir / document_id
            if wc_dir.exists():
                wc_files = sorted(
                    [p for p in wc_dir.iterdir() if not p.name.startswith(".")],
                    key=lambda p: p.stat().st_mtime,
                    reverse=True,
                )
                if wc_files:
                    file_path = wc_files[0]
        if not file_path:
            file_path = orig_file

        fmt = await registry.document_processor.detect_format(file_path)
        content = await registry.document_processor.extract_content(file_path, fmt)

        sheets = []
        if fmt.value in ("xlsx", "xls") and registry.excel_processor:
            try:
                import openpyxl
                wb = openpyxl.load_workbook(str(file_path), data_only=True)
                sheet_names = list(wb.sheetnames)
                wb.close()

                for sname in sheet_names:
                    grid = await registry.excel_processor.get_sheet_data(file_path, sname)
                    sheets.append({
                        "name": sname,
                        "data": grid,
                        "row_count": len(grid),
                        "col_count": max((len(r) for r in grid), default=0),
                    })
            except Exception as e_err:
                logger.warning("excel_sheets_extract_failed", error=str(e_err))
        elif fmt.value == "csv":
            try:
                import csv
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    reader = csv.reader(f)
                    rows = [list(r) for r in reader]
                sheets.append({
                    "name": "Sheet1",
                    "data": rows,
                    "row_count": len(rows),
                    "col_count": max((len(r) for r in rows), default=0),
                })
            except Exception as c_err:
                logger.warning("csv_sheets_extract_failed", error=str(c_err))

        modified_cells = []
        is_working_copy = (file_path != orig_file)
        if is_working_copy and fmt.value in ("xlsx", "xls") and registry.excel_processor:
            try:
                for s in sheets:
                    sname = s["name"]
                    orig_grid = await registry.excel_processor.get_sheet_data(orig_file, sname)
                    wc_grid = s.get("data", [])
                    for r_idx in range(len(wc_grid)):
                        wc_row = wc_grid[r_idx]
                        orig_row = orig_grid[r_idx] if r_idx < len(orig_grid) else []
                        for c_idx in range(len(wc_row)):
                            wc_val = wc_row[c_idx]
                            orig_val = orig_row[c_idx] if c_idx < len(orig_row) else ""
                            if str(wc_val).strip() != str(orig_val).strip():
                                col_str = ""
                                temp = c_idx
                                while temp >= 0:
                                    col_str = chr(65 + (temp % 26)) + col_str
                                    temp = (temp // 26) - 1
                                cell_coord = f"{col_str}{r_idx + 1}"
                                modified_cells.append(f"{sname}!{cell_coord}")
            except Exception as diff_err:
                logger.warning("modified_cells_diff_failed", error=str(diff_err))
        elif is_working_copy and fmt.value == "csv":
            try:
                import csv
                orig_rows = []
                with open(orig_file, "r", encoding="utf-8", errors="replace") as f:
                    orig_rows = list(csv.reader(f))
                if sheets and sheets[0].get("data"):
                    wc_grid = sheets[0]["data"]
                    for r_idx in range(len(wc_grid)):
                        wc_row = wc_grid[r_idx]
                        orig_row = orig_rows[r_idx] if r_idx < len(orig_rows) else []
                        for c_idx in range(len(wc_row)):
                            wc_val = wc_row[c_idx]
                            orig_val = orig_row[c_idx] if c_idx < len(orig_row) else ""
                            if str(wc_val).strip() != str(orig_val).strip():
                                col_str = ""
                                temp = c_idx
                                while temp >= 0:
                                    col_str = chr(65 + (temp % 26)) + col_str
                                    temp = (temp // 26) - 1
                                cell_coord = f"{col_str}{r_idx + 1}"
                                modified_cells.append(f"Sheet1!{cell_coord}")
            except Exception as c_diff_err:
                logger.warning("csv_modified_cells_diff_failed", error=str(c_diff_err))

        return {
            "document_id": document_id,
            "filename": orig_file.name,
            "working_copy_filename": file_path.name if is_working_copy else None,
            "is_working_copy": is_working_copy,
            "version": file_path.stem.split("_v")[-1] if "_v" in file_path.stem else "v1",
            "format": fmt.value,
            "text": content.full_text,
            "pages": [{"page_number": p.page_number, "text": p.text, "confidence": p.confidence} for p in content.pages],
            "metadata": content.metadata,
            "total_pages": content.total_pages,
            "sheets": sheets if sheets else None,
            "modified_cells": modified_cells,
        }

    async def _serve_document_file(
        document_id: str,
        download: bool = False,
        original: bool = False,
        version: Optional[str] = None,
    ):
        """Serve the document file (original if original=True, or specific version, else latest working copy if exists, else original)."""
        file_path = None
        doc_dir = config.documents_dir / document_id
        if not doc_dir.exists():
            raise HTTPException(404, f"Document {document_id} not found")

        orig_files = list(doc_dir.iterdir())
        if not orig_files:
            raise HTTPException(404, "No files found")
        orig_file = orig_files[0]

        if original:
            file_path = orig_file
        else:
            wc_dir = config.working_copies_dir / document_id
            if wc_dir.exists():
                if version:
                    matches = [p for p in wc_dir.iterdir() if f"_v{version}" in p.name]
                    if matches:
                        file_path = matches[0]
                if not file_path:
                    wc_files = sorted(
                        [p for p in wc_dir.iterdir() if not p.name.startswith(".tmp_")],
                        key=lambda p: p.stat().st_mtime,
                        reverse=True,
                    )
                    if wc_files:
                        file_path = wc_files[0]
            if not file_path:
                file_path = orig_file

        mime_type = MIME_MAP.get(file_path.suffix.lower(), "application/octet-stream")
        disposition = "attachment" if download else "inline"

        return FileResponse(
            path=file_path,
            filename=file_path.name if download else None,
            media_type=mime_type,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Content-Disposition": f'{disposition}; filename="{file_path.name}"',
                "X-Frame-Options": "SAMEORIGIN",
            },
        )

    @app.get("/documents/{document_id}/file")
    async def get_document_file(
        document_id: str,
        request: Request,
        download: bool = Query(False),
        original: bool = Query(False),
        version: Optional[str] = Query(None),
    ):
        # Verify tenant authorization if token or user_id provided
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        user_id = request.query_params.get("user_id")
        if token:
            user = get_db().verify_token(token)
            if user:
                user_id = user["id"]
        if user_id:
            user_docs = set(get_db().get_user_document_ids(user_id))
            if document_id not in user_docs:
                raise HTTPException(403, f"Access denied to file for document {document_id}")

        return await _serve_document_file(
            document_id=document_id,
            download=download,
            original=original,
            version=version,
        )

    async def _reindex_working_copy(
        document_id: str,
        wc_path: Path,
        version_id: str,
        format_type: str,
    ):
        """Immediately re-index newly created working copy into hybrid retrieval index."""
        registry = get_registry()
        if not registry.document_processor or not registry.hybrid_index:
            return
        try:
            from vhagar.components.document_processor import DocumentReference, DocumentFormat, ProcessingStatus
            fmt_str = format_type.lower()
            fmt = DocumentFormat(fmt_str) if fmt_str in [f.value for f in DocumentFormat] else DocumentFormat.UNKNOWN
            doc_ref = DocumentReference(
                document_id=document_id,
                session_id="working_copy",
                source_filename=wc_path.name,
                original_path=str(wc_path),
                format=fmt,
                processing_status=ProcessingStatus.COMPLETED,
            )
            extracted = await registry.document_processor.extract_content(wc_path, fmt)
            await registry.hybrid_index.index_document(doc_ref, extracted)
            logger.info("working_copy_auto_reindexed", document_id=document_id, version=version_id)
        except Exception as e:
            logger.warning("working_copy_reindex_failed", error=str(e), document_id=document_id)

    @app.post("/documents/{document_id}/save")
    async def save_document(document_id: str, request: Request):
        """Save edits to a working copy."""
        registry = get_registry()
        body = await request.json()

        # Verify tenant authorization if token or user_id provided
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        user_id = body.get("user_id") or request.query_params.get("user_id")
        if token:
            user = get_db().verify_token(token)
            if user:
                user_id = user["id"]
        if user_id:
            user_docs = set(get_db().get_user_document_ids(user_id))
            if document_id not in user_docs:
                raise HTTPException(403, f"Access denied to modify document {document_id}")

        doc_dir = config.documents_dir / document_id
        if not doc_dir.exists():
            raise HTTPException(404, f"Document {document_id} not found")

        files = list(doc_dir.iterdir())
        if not files:
            raise HTTPException(404, "No source file found")

        source_path = files[0]
        edits = body.get("edits", [])
        format_type = body.get("format", "")

        if format_type in ("xlsx", "xls") and registry.excel_processor:
            from vhagar.components.excel_processor import CellEdit

            cell_edits = [
                CellEdit(
                    sheet_name=e.get("sheet_name", "Sheet1"),
                    cell_ref=e.get("cell_ref", "A1"),
                    old_value=e.get("old_value"),
                    new_value=e.get("new_value") or e.get("value"),
                    value_type=e.get("value_type", "string"),
                )
                for e in edits
            ]
            result = await registry.excel_processor.save_working_copy(document_id, source_path, cell_edits)
            await _reindex_working_copy(document_id, Path(result.path), result.version_id, "xlsx")
            return {
                "success": True,
                "version": result.version_id,
                "working_copy_path": str(result.path),
                "edits_applied": len(result.edits_applied),
            }
        elif format_type == "csv":
            import csv
            import re

            wc_dir = config.working_copies_dir / document_id
            wc_dir.mkdir(parents=True, exist_ok=True)
            existing_wcs = sorted(wc_dir.glob("*.csv"), key=lambda p: p.stat().st_mtime, reverse=True)
            base_file = existing_wcs[0] if existing_wcs else source_path

            version_id = str(uuid.uuid4())[:8]
            wc_path = wc_dir / f"{source_path.stem}_v{version_id}.csv"

            text_content = body.get("content")
            if text_content and isinstance(text_content, str):
                with open(wc_path, "w", encoding="utf-8") as f:
                    f.write(text_content)
                await _reindex_working_copy(document_id, wc_path, version_id, "csv")
                return {
                    "success": True,
                    "version": version_id,
                    "working_copy_path": str(wc_path),
                    "edits_applied": 1,
                }

            rows = []
            if base_file.exists():
                with open(base_file, "r", encoding="utf-8") as f:
                    reader = csv.reader(f)
                    rows = [list(r) for r in reader]

            edits_list = edits if isinstance(edits, list) else [edits] if isinstance(edits, dict) else []
            for e in edits_list:
                if not isinstance(e, dict):
                    continue
                r_idx = e.get("row")
                c_idx = e.get("col")
                if (r_idx is None or c_idx is None) and "cell_ref" in e:
                    m = re.match(r"^([A-Za-z]+)(\d+)$", str(e["cell_ref"]).strip())
                    if m:
                        col_str, row_str = m.groups()
                        r_idx = int(row_str) - 1
                        c = 0
                        for char in col_str.upper():
                            c = c * 26 + (ord(char) - ord('A') + 1)
                        c_idx = c - 1

                val = str(e.get("value") if e.get("value") is not None else e.get("new_value", ""))
                if r_idx is not None and c_idx is not None and r_idx >= 0 and c_idx >= 0:
                    while len(rows) <= r_idx:
                        rows.append([])
                    while len(rows[r_idx]) <= c_idx:
                        rows[r_idx].append("")
                    rows[r_idx][c_idx] = val

            with open(wc_path, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerows(rows)

            await _reindex_working_copy(document_id, wc_path, version_id, "csv")
            return {
                "success": True,
                "version": version_id,
                "working_copy_path": str(wc_path),
                "edits_applied": len(edits_list),
            }
        elif format_type == "pdf":
            # Extracted text and a rendered preview cannot be safely round-tripped
            # into the uploaded PDF. Never present a regenerated approximation as
            # an edit of the original. Annotation support requires a separately
            # validated overlay format and is deliberately not enabled here.
            raise HTTPException(
                status_code=409,
                detail="PDF files are preview-only. Download the original; native PDF editing and annotations are not available.",
            )
            wc_dir = config.working_copies_dir / document_id
            wc_dir.mkdir(parents=True, exist_ok=True)
            version_id = str(uuid.uuid4())[:8]
            wc_path = wc_dir / f"{source_path.stem}_v{version_id}.pdf"

            text_content = body.get("content") or (edits if isinstance(edits, str) else "")
            added_text = body.get("added_text") or body.get("amendment")

            # Check if source is a valid existing PDF to preserve original structure
            is_valid_orig_pdf = False
            reader = None
            if source_path.suffix.lower() == ".pdf" and source_path.exists():
                try:
                    import pypdf
                    reader = pypdf.PdfReader(str(source_path))
                    if len(reader.pages) > 0:
                        is_valid_orig_pdf = True
                except Exception:
                    is_valid_orig_pdf = False

            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
                from reportlab.lib import colors
                import io
                import pypdf

                # If original PDF has pages, preserve all original pages via pypdf
                if is_valid_orig_pdf and reader:
                    writer = pypdf.PdfWriter()
                    for p in reader.pages:
                        writer.add_page(p)

                    # Only append an amendment page if added_text is provided and not removing
                    if added_text and not body.get("remove_amendments", False):
                        # Build amendment page in memory
                        buf = io.BytesIO()
                        doc = SimpleDocTemplate(
                            buf,
                            pagesize=letter,
                            rightMargin=54,
                            leftMargin=54,
                            topMargin=54,
                            bottomMargin=54,
                        )
                        styles = getSampleStyleSheet()
                        title_style = ParagraphStyle(
                            "AmendTitle",
                            parent=styles["Heading2"],
                            fontSize=13,
                            leading=17,
                            textColor=colors.HexColor("#141413"),
                            spaceAfter=8,
                        )
                        body_style = ParagraphStyle(
                            "AmendBody",
                            parent=styles["Normal"],
                            fontSize=10,
                            leading=14,
                            textColor=colors.HexColor("#2E2E2C"),
                            spaceAfter=6,
                        )

                        story = [
                            Paragraph(f"<b>Document Addendum / Amendments (v{version_id})</b>", title_style),
                            Spacer(1, 4),
                        ]

                        for p in added_text.split("\n\n"):
                            clean_p = (
                                p.strip()
                                .replace("&", "&amp;")
                                .replace("<", "&lt;")
                                .replace(">", "&gt;")
                                .replace("\n", "<br/>")
                            )
                            if clean_p:
                                story.append(Paragraph(clean_p, body_style))
                                story.append(Spacer(1, 4))

                        doc.build(story)
                        buf.seek(0)
                        amend_reader = pypdf.PdfReader(buf)
                        for ap in amend_reader.pages:
                            writer.add_page(ap)

                    with open(wc_path, "wb") as f_out:
                        writer.write(f_out)
                else:
                    # Full generation for text-only conversion
                    doc = SimpleDocTemplate(
                        str(wc_path),
                        pagesize=letter,
                        rightMargin=54,
                        leftMargin=54,
                        topMargin=54,
                        bottomMargin=54,
                    )
                    styles = getSampleStyleSheet()
                    title_style = ParagraphStyle(
                        "DocTitle",
                        parent=styles["Heading1"],
                        fontSize=15,
                        leading=19,
                        textColor=colors.HexColor("#141413"),
                        spaceAfter=10,
                    )
                    body_style = ParagraphStyle(
                        "DocBody",
                        parent=styles["Normal"],
                        fontSize=10,
                        leading=14,
                        textColor=colors.HexColor("#2E2E2C"),
                        spaceAfter=6,
                    )

                    story = [
                        Paragraph(f"<b>{source_path.stem}</b> — Working Copy v{version_id}", title_style),
                        Spacer(1, 8),
                    ]
                    paragraphs = text_content.split("\n\n") if text_content else ["No content provided."]
                    for p in paragraphs:
                        clean_p = (
                            p.strip()
                            .replace("&", "&amp;")
                            .replace("<", "&lt;")
                            .replace(">", "&gt;")
                            .replace("\n", "<br/>")
                        )
                        if clean_p:
                            story.append(Paragraph(clean_p, body_style))
                            story.append(Spacer(1, 4))

                    doc.build(story)
            except Exception as pdf_err:
                logger.error("pdf_working_copy_failed", error=str(pdf_err))
                with open(wc_path, "wb") as f:
                    f.write(text_content.encode("utf-8"))

            await _reindex_working_copy(document_id, wc_path, version_id, "pdf")
            return {
                "success": True,
                "version": version_id,
                "working_copy_path": str(wc_path),
                "edits_applied": 1,
            }
        elif format_type == "docx":
            # python-docx cannot demonstrate preservation of every DOCX
            # structure we accept (comments, tracked changes, and complex
            # drawing relationships in particular). Do not create a flattened
            # replacement until the round-trip capability matrix is validated.
            raise HTTPException(
                status_code=409,
                detail="DOCX editing is temporarily unavailable because round-trip preservation has not been validated. Download the original instead.",
            )
            import docx

            wc_dir = config.working_copies_dir / document_id
            wc_dir.mkdir(parents=True, exist_ok=True)
            version_id = str(uuid.uuid4())[:8]
            wc_path = wc_dir / f"{source_path.stem}_v{version_id}.docx"

            text_content = body.get("content") or (edits if isinstance(edits, str) else "")
            doc = docx.Document()
            doc.add_heading(f"{source_path.stem} — Working Copy v{version_id}", level=1)
            for p in text_content.split("\n\n"):
                if p.strip():
                    doc.add_paragraph(p.strip())
            doc.save(str(wc_path))

            await _reindex_working_copy(document_id, wc_path, version_id, "docx")
            return {
                "success": True,
                "version": version_id,
                "working_copy_path": str(wc_path),
                "edits_applied": 1,
            }
        else:
            # For text-like formats or DOCX string edits, save content directly
            text_content = body.get("content") or (edits if isinstance(edits, str) else "")
            if not text_content and isinstance(edits, list) and edits and isinstance(edits[0], str):
                text_content = "\n".join(edits)
            if not text_content:
                raise HTTPException(400, "No content or edits provided")

            wc_dir = config.working_copies_dir / document_id
            wc_dir.mkdir(parents=True, exist_ok=True)
            version_id = str(uuid.uuid4())[:8]
            wc_path = wc_dir / f"{source_path.stem}_v{version_id}{source_path.suffix}"

            with open(wc_path, "w", encoding="utf-8") as f:
                f.write(text_content)

            await _reindex_working_copy(document_id, wc_path, version_id, "txt")
            return {
                "success": True,
                "version": version_id,
                "working_copy_path": str(wc_path),
                "path": str(wc_path),
            }

    @app.post("/documents/{document_id}/revert")
    async def revert_document(document_id: str, request: Request):
        """Discard every validated working copy and restore the immutable source."""
        doc_dir = config.documents_dir / document_id
        if not doc_dir.exists():
            raise HTTPException(404, f"Document {document_id} not found")
        originals = [p for p in doc_dir.iterdir() if p.is_file()]
        if not originals:
            raise HTTPException(404, "No source file found")

        wc_dir = config.working_copies_dir / document_id
        removed_versions = 0
        if wc_dir.exists():
            for candidate in wc_dir.iterdir():
                if candidate.is_file():
                    candidate.unlink()
                    removed_versions += 1
            # Only remove the document-specific, now-empty directory.
            wc_dir.rmdir()

        registry = get_registry()
        original = originals[0]
        if registry.document_processor and registry.hybrid_index:
            await _reindex_working_copy(document_id, original, "original", original.suffix.lstrip("."))

        logger.info("working_copies_reverted", document_id=document_id, removed_versions=removed_versions)
        return {"success": True, "document_id": document_id, "removed_versions": removed_versions, "version": "original"}

    @app.get("/documents/{document_id}/download")
    async def download_document(document_id: str):
        """Download the latest validated working copy or original."""
        return await _serve_document_file(document_id, download=True)

    @app.post("/search")
    async def search_documents(request: Request):
        registry = get_registry()
        if not registry.query_engine:
            raise HTTPException(503, "Query engine not available")

        body = await request.json()
        query = body.get("query", "")
        session_id = body.get("session_id", "")
        document_ids = body.get("document_ids")
        top_k = body.get("top_k", 10)
        include_global = body.get("include_global", False)

        if not query:
            raise HTTPException(400, "query is required")

        result = await registry.query_engine.query(
            question=query,
            session_id=session_id,
            document_ids=document_ids,
            include_global=include_global,
        )

        return {
            "context": result.answer_context,
            "citations": [c.__dict__ if hasattr(c, '__dict__') else c for c in result.citations],
            "sources_used": result.sources_used,
            "expanded_terms": result.expanded_query.expanded_terms if result.expanded_query else [],
            "synonyms_used": result.expanded_query.synonyms_used if result.expanded_query else [],
        }

    @app.get("/library")
    async def get_library_endpoint(user_id: str = "usr_default"):
        return get_db().get_user_library(user_id)

    @app.post("/library/folders")
    async def create_folder_endpoint(request: Request):
        body = await request.json()
        name = body.get("name", "").strip()
        user_id = body.get("user_id", "usr_default")
        if not name:
            raise HTTPException(400, "Folder name is required")
        return get_db().create_library_folder(user_id, name)

    @app.delete("/library/folders/{folder_id}")
    async def delete_folder_endpoint(folder_id: str):
        get_db().delete_library_folder(folder_id)
        return {"success": True}

    @app.delete("/library/documents/{doc_id}")
    async def delete_library_doc_endpoint(doc_id: str):
        get_db().delete_library_document(doc_id)
        return {"success": True}

    @app.patch("/library/documents/{doc_id}")
    async def update_library_doc_endpoint(doc_id: str, request: Request):
        body = await request.json()
        folder_id = body.get("folder_id")
        get_db().move_library_document(doc_id, folder_id)
        return {"success": True}

    @app.post("/library/attach")
    async def attach_library_endpoint(request: Request):
        body = await request.json()
        session_id = body.get("session_id")
        document_ids = body.get("document_ids", [])
        if not session_id or not document_ids:
            raise HTTPException(400, "session_id and document_ids are required")

        # Verify tenant authorization if token or user_id provided
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        user_id = body.get("user_id")
        if token:
            user = get_db().verify_token(token)
            if user:
                user_id = user["id"]
        if user_id:
            user_docs = set(get_db().get_user_document_ids(user_id))
            unauthorized = [doc_id for doc_id in document_ids if doc_id not in user_docs]
            if unauthorized:
                raise HTTPException(403, f"Access denied to attach documents: {unauthorized}")

        attached = get_db().attach_library_documents_to_session(session_id, document_ids)
        return {"success": True, "attached": attached}

    @app.delete("/documents/{document_id}")
    async def delete_document_endpoint(document_id: str, request: Request):
        db = get_db()
        registry = get_registry()
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header.startswith("Bearer ") else ""
        user_id = request.query_params.get("user_id")
        if token:
            user = db.verify_token(token)
            if user:
                user_id = user["id"]
        if user_id:
            user_docs = set(db.get_user_document_ids(user_id))
            if document_id not in user_docs:
                raise HTTPException(403, f"Access denied to delete document {document_id}")

        db.delete_document(document_id)
        if registry.hybrid_index:
            await registry.hybrid_index.remove_document(document_id)
        return {"status": "deleted", "document_id": document_id}

    @app.get("/stats")
    async def get_stats():
        registry = get_registry()
        stats = {"documents_dir_exists": config.documents_dir.exists()}

        if registry.hybrid_index:
            stats["index"] = await registry.hybrid_index.get_stats()
        if registry.concept_mapper:
            mappings = await registry.concept_mapper.get_all_mappings()
            stats["concept_mappings"] = len(mappings)
        if registry.concept_memory:
            mem_stats = await registry.concept_memory.get_stats()
            stats["concept_memory"] = mem_stats.__dict__ if hasattr(mem_stats, '__dict__') else mem_stats

        return stats

    return app

