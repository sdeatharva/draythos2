"""Server launch helpers for Vhagar."""

from __future__ import annotations

import multiprocessing
import uvicorn
import structlog

logger = structlog.get_logger(__name__)


def run_ui_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the FastAPI UI server."""
    logger.info("starting_ui_server", host=host, port=port)
    uvicorn.run(
        "vhagar.ui.app:create_app",
        factory=True,
        host=host,
        port=port,
        log_level="info",
    )


def run_mcp_server(host: str = "0.0.0.0", port: int = 8001):
    """Run the MCP API server."""
    logger.info("starting_mcp_server", host=host, port=port)
    uvicorn.run(
        "vhagar.mcp_server:create_mcp_app",
        factory=True,
        host=host,
        port=port,
        log_level="info",
    )


def run_all(host: str = "0.0.0.0", ui_port: int = 8000, mcp_port: int = 8001):
    """Run both servers in separate processes."""
    logger.info("starting_all_servers", host=host, ui_port=ui_port, mcp_port=mcp_port)

    ui_process = multiprocessing.Process(target=run_ui_server, args=(host, ui_port), daemon=True)
    mcp_process = multiprocessing.Process(target=run_mcp_server, args=(host, mcp_port), daemon=True)

    ui_process.start()
    mcp_process.start()

    try:
        ui_process.join()
        mcp_process.join()
    except KeyboardInterrupt:
        logger.info("shutting_down")
        ui_process.terminate()
        mcp_process.terminate()
        ui_process.join(timeout=5)
        mcp_process.join(timeout=5)


def run_single_process(host: str = "0.0.0.0", port: int = 8000):
    """Run combined app in single process."""
    logger.info("starting_single_process", host=host, port=port)

    from vhagar.ui.app import create_app
    from vhagar.mcp_server import create_mcp_app
    from fastapi import FastAPI

    root = FastAPI(title="Draythos Vhagar (combined)")
    ui_app = create_app()
    mcp_app = create_mcp_app()

    root.mount("/mcp", mcp_app)
    root.mount("/", ui_app)

    uvicorn.run(root, host=host, port=port, log_level="info")

