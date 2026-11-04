"""Startup validation checks for Vhagar."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import List

import structlog

logger = structlog.get_logger(__name__)

CRITICAL_PACKAGES = [
    "fastapi",
    "uvicorn",
    "pydantic",
    "pypdf",
    "pdfplumber",
    "docx",
    "openpyxl",
    "numpy",
    "httpx",
    "yaml",
    "prometheus_client",
    "structlog",
]


def validate_python_version() -> list[str]:
    """Check Python >= 3.10."""
    warnings: list[str] = []
    if sys.version_info < (3, 10):
        warnings.append(f"Python 3.10+ required, found {sys.version}")
    return warnings


def validate_dependencies() -> list[str]:
    """Check critical imports are available."""
    warnings: list[str] = []
    for pkg in CRITICAL_PACKAGES:
        try:
            importlib.import_module(pkg)
        except ImportError:
            warnings.append(f"Missing dependency: {pkg}")
    return warnings


def validate_directories(data_dir: Path = Path("data")) -> list[str]:
    """Ensure runtime directories exist, create them if not."""
    warnings: list[str] = []
    dirs = [
        data_dir / "documents",
        data_dir / "index_overflow",
        data_dir / "working_copies",
        Path("logs"),
    ]
    for d in dirs:
        if not d.exists():
            try:
                d.mkdir(parents=True, exist_ok=True)
                logger.info("created_directory", path=str(d))
            except OSError as exc:
                warnings.append(f"Cannot create {d}: {exc}")
    return warnings


def validate_config() -> list[str]:
    """Validate configuration completeness."""
    warnings: list[str] = []
    from vhagar.config import get_config

    cfg = get_config()
    if cfg.auth_secret == "change-me-in-production":
        warnings.append("VHAGAR_AUTH_SECRET is still the default value")
    if cfg.mcp_api_key == "change-me-in-production":
        warnings.append("VHAGAR_MCP_API_KEY is still the default value")
    return warnings


def run_all_checks() -> list[str]:
    """Run every validation check and return combined warnings."""
    all_warnings: list[str] = []
    for check in [validate_python_version, validate_dependencies, validate_directories, validate_config]:
        try:
            all_warnings.extend(check())
        except Exception as exc:
            all_warnings.append(f"Check {check.__name__} failed: {exc}")

    for w in all_warnings:
        logger.warning("startup_check", warning=w)

    if not all_warnings:
        logger.info("startup_checks_passed")

    return all_warnings

