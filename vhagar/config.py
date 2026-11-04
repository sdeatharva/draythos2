"""Typed backend configuration model for Vhagar.

All settings are configurable via VHAGAR_-prefixed environment variables.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class VhagarConfig(BaseModel):
    """Central configuration for the Vhagar backend."""

    # --- paths ---
    data_dir: Path = Field(
        default_factory=lambda: Path(os.getenv("VHAGAR_DATA_DIR", "data")),
        description="Root data directory for documents, indexes, and persistence files.",
    )
    working_copy_dir: Path = Field(
        default_factory=lambda: Path(
            os.getenv("VHAGAR_WORKING_COPY_DIR", "data/working_copies")
        ),
        description="Directory for working-copy versions of edited files.",
    )

    # --- auth / security ---
    auth_secret: str = Field(
        default_factory=lambda: os.getenv("VHAGAR_AUTH_SECRET", ""),
        description="Shared secret for API-key authentication.",
    )
    mcp_api_key: str = Field(
        default_factory=lambda: os.getenv("VHAGAR_MCP_API_KEY", ""),
        description="API key for MCP endpoints.",
    )

    # --- retrieval tuning ---
    fuzzy_threshold: float = Field(
        default_factory=lambda: float(os.getenv("VHAGAR_FUZZY_THRESHOLD", "0.75")),
        description="Fuzzy-match similarity threshold for concept mapping.",
    )
    confidence_threshold: float = Field(
        default_factory=lambda: float(
            os.getenv("VHAGAR_CONFIDENCE_THRESHOLD", "0.3")
        ),
        description="Minimum per-page text confidence before OCR kicks in.",
    )
    max_snippet_length: int = Field(
        default_factory=lambda: int(
            os.getenv("VHAGAR_MAX_SNIPPET_LENGTH", "300")
        ),
        description="Maximum snippet length returned in search results.",
    )
    query_timeout_seconds: int = Field(
        default_factory=lambda: int(
            os.getenv("VHAGAR_QUERY_TIMEOUT_SECONDS", "30")
        ),
        description="Timeout in seconds for a single query operation.",
    )

    # --- embedding ---
    embedding_model: str = Field(
        default_factory=lambda: os.getenv(
            "VHAGAR_EMBEDDING_MODEL", "all-MiniLM-L6-v2"
        ),
        description="Sentence-transformer model name for dense embeddings.",
    )

    # --- chunking ---
    chunk_size: int = Field(
        default_factory=lambda: int(os.getenv("VHAGAR_CHUNK_SIZE", "512")),
        description="Default chunk size in characters for text splitting.",
    )
    chunk_overlap: int = Field(
        default_factory=lambda: int(os.getenv("VHAGAR_CHUNK_OVERLAP", "64")),
        description="Overlap between consecutive text chunks.",
    )

    # --- server & network ---
    ui_port: int = Field(
        default_factory=lambda: int(os.getenv("VHAGAR_UI_PORT", "8000")),
        description="Port for the UI service.",
    )
    mcp_port: int = Field(
        default_factory=lambda: int(os.getenv("VHAGAR_MCP_PORT", "8001")),
        description="Port for the MCP service.",
    )
    host: str = Field(
        default_factory=lambda: os.getenv("VHAGAR_HOST", "0.0.0.0"),
        description="Host bind address.",
    )
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000", "*"],
        description="Allowed CORS origins.",
    )

    # --- upload limits ---
    max_upload_size_mb: int = Field(
        default_factory=lambda: int(os.getenv("VHAGAR_MAX_UPLOAD_SIZE_MB", "50")),
        description="Maximum allowed upload file size in megabytes.",
    )
    max_file_size_mb: int = Field(
        default_factory=lambda: int(os.getenv("VHAGAR_MAX_FILE_SIZE_MB", "50")),
        description="Maximum allowed upload file size in megabytes (alias).",
    )
    supported_formats: list[str] = Field(
        default_factory=lambda: ["pdf", "xlsx", "xls", "csv", "docx", "txt", "json", "xml"],
        description="Supported format names.",
    )
    allowed_extensions: list[str] = Field(
        default_factory=lambda: [
            ".pdf", ".xlsx", ".xls", ".csv", ".docx",
            ".txt", ".json", ".xml", ".png", ".jpg", ".jpeg", ".tiff", ".bmp",
        ],
        description="File extensions accepted for upload.",
    )

    # --- observability ---
    log_level: str = Field(
        default_factory=lambda: os.getenv("VHAGAR_LOG_LEVEL", "INFO"),
        description="Structured log level.",
    )
    enable_metrics: bool = Field(
        default_factory=lambda: os.getenv("VHAGAR_ENABLE_METRICS", "true").lower()
        == "true",
        description="Whether Prometheus metrics collection is enabled.",
    )

    # --- concept persistence ---
    concept_mappings_path: Optional[Path] = Field(default=None)
    concept_memory_path: Optional[Path] = Field(default=None)
    documents_dir: Optional[Path] = Field(default=None)
    working_copies_dir: Optional[Path] = Field(default=None)

    def model_post_init(self, __context: object) -> None:
        """Derive default persistence paths after init."""
        if self.concept_mappings_path is None:
            self.concept_mappings_path = self.data_dir / "concept_mappings.json"
        if self.concept_memory_path is None:
            self.concept_memory_path = self.data_dir / "concept_memory.json"
        if self.documents_dir is None:
            self.documents_dir = self.data_dir / "documents"
        if self.working_copies_dir is None:
            self.working_copies_dir = self.working_copy_dir

        # Ensure critical directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.working_copy_dir.mkdir(parents=True, exist_ok=True)
        self.documents_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "documents").mkdir(parents=True, exist_ok=True)


_global_config: Optional[VhagarConfig] = None


def set_config(config: VhagarConfig) -> None:
    """Set the global VhagarConfig singleton."""
    global _global_config
    _global_config = config


def get_config() -> VhagarConfig:
    """Return the global VhagarConfig singleton."""
    global _global_config
    if _global_config is None:
        _global_config = VhagarConfig()
    return _global_config

