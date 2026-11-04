"""Pytest fixtures for Draythos Vhagar tests."""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from vhagar.config import VhagarConfig
from vhagar.bootstrap import bootstrap
from vhagar.mcp_server import create_mcp_app
from vhagar.ui.app import create_app


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def temp_dir():
    """Temporary directory for test files."""
    tmp = tempfile.mkdtemp(prefix="vhagar_test_")
    yield Path(tmp)
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def test_config(temp_dir):
    """Test configuration using temporary directories."""
    return VhagarConfig(
        auth_secret="test-secret-key-12345",
        mcp_api_key="test-mcp-key-12345",
        data_dir=temp_dir / "data",
        logs_dir=temp_dir / "logs",
        fuzzy_threshold=0.6,
        confidence_threshold=0.4,
        max_upload_size_mb=10,
    )


@pytest.fixture
def sample_csv(temp_dir):
    """Create a sample CSV fixture."""
    path = temp_dir / "sample.csv"
    path.write_text(
        "Quarter,Revenue,Expenses,Net Profit\n"
        "Q1,150000,90000,60000\n"
        "Q2,175000,95000,80000\n"
        "Q3,160000,92000,68000\n"
        "Q4,190000,100000,90000\n"
    )
    return path


@pytest.fixture
def sample_txt(temp_dir):
    """Create a sample TXT fixture."""
    path = temp_dir / "sample.txt"
    path.write_text(
        "Draythos Document Intelligence Workspace.\n"
        "Section 1: Tax Compliance & Sales Tax.\n"
        "All corporate entities must calculate Value Added Tax (VAT) and Goods and Services Tax (GST) quarterly.\n"
        "Section 2: Auditing standards require complete reconciliation.\n"
    )
    return path


@pytest.fixture
def sample_json(temp_dir):
    """Create a sample JSON fixture."""
    path = temp_dir / "sample.json"
    path.write_text(
        '{"company": "Acme Corp", "fiscal_year": 2026, "revenue": 675000, "status": "Audited"}'
    )
    return path


@pytest.fixture
def corrupt_file(temp_dir):
    """Create a corrupt file fixture."""
    path = temp_dir / "corrupted.pdf"
    path.write_bytes(b"NOT A REAL PDF FILE 12345 CORRUPTED HEADER")
    return path

