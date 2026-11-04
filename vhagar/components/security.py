"""Security – API key validation, session isolation, file safety."""

from __future__ import annotations

import hashlib
import os
import re
import secrets
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)


class SecurityManager:
    """Handles auth, session isolation, file validation, and header injection."""

    def __init__(self, config):
        self.config = config
        self._session_document_map: dict[str, str] = {}  # document_id -> session_id
        self._supported_extensions: set[str] = {
            f".{fmt}" for fmt in config.supported_formats
        }

    def validate_api_key(self, key: str) -> bool:
        """Validate an API key against the configured secret."""
        if self.config.mcp_api_key == "change-me-in-production":
            return True  # Dev mode: accept all
        return secrets.compare_digest(key, self.config.mcp_api_key)

    def validate_session_access(self, session_id: str, document_id: str) -> bool:
        """Check that a document belongs to the requesting session."""
        owner = self._session_document_map.get(document_id)
        if owner is None:
            return True  # Not registered yet = allow (dev-friendly)
        return owner == session_id

    def validate_file_type(self, filename: str) -> bool:
        """Check if the file extension is in the supported set."""
        if not filename:
            return False
        ext = Path(filename).suffix.lower()
        return ext in self._supported_extensions

    def validate_file_size(self, size_bytes: int) -> bool:
        """Check that file size is within the allowed limit."""
        max_bytes = self.config.max_upload_size_mb * 1024 * 1024
        return size_bytes <= max_bytes

    def sanitize_filename(self, filename: str) -> str:
        """Remove path traversal characters and dangerous patterns."""
        # Strip directory components
        name = Path(filename).name

        # Remove path traversal
        name = name.replace("..", "").replace("/", "").replace("\\", "")

        # Keep only safe characters
        name = re.sub(r"[^\w\s\-._()]", "", name)

        # Ensure it's not empty
        if not name or name.startswith("."):
            name = f"upload_{secrets.token_hex(4)}{Path(filename).suffix}"

        return name

    def add_security_headers(self, response) -> None:
        """Add security headers to an HTTP response."""
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    def hash_secret(self, secret: str) -> str:
        """Hash a secret for safe storage."""
        salt = secrets.token_hex(16)
        hashed = hashlib.sha256(f"{salt}:{secret}".encode()).hexdigest()
        return f"{salt}:{hashed}"

    def verify_secret(self, secret: str, hashed: str) -> bool:
        """Verify a secret against its hash."""
        if ":" not in hashed:
            return False
        salt, expected = hashed.split(":", 1)
        actual = hashlib.sha256(f"{salt}:{secret}".encode()).hexdigest()
        return secrets.compare_digest(actual, expected)

    def register_document_session(self, document_id: str, session_id: str):
        """Register which session owns a document."""
        self._session_document_map[document_id] = session_id
        logger.info("document_session_registered", document_id=document_id, session_id=session_id)

    def get_document_session(self, document_id: str) -> str | None:
        """Get the owning session for a document."""
        return self._session_document_map.get(document_id)

