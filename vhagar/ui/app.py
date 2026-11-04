"""FastAPI UI application factory for Vhagar."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
import structlog

from vhagar.config import get_config
from vhagar.bootstrap import bootstrap, get_registry
from vhagar.startup_validation import run_all_checks

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: bootstrap components on startup."""
    warnings = run_all_checks()
    if warnings:
        logger.warning("startup_warnings", count=len(warnings))

    config = get_config()
    await bootstrap(config)
    logger.info("vhagar_ui_ready")
    yield
    logger.info("vhagar_ui_shutdown")


def create_app() -> FastAPI:
    """Build and return the FastAPI UI application."""
    config = get_config()

    app = FastAPI(
        title="Draythos Vhagar UI",
        version="0.1.0",
        description="Document intelligence backend – UI and review surface",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    @app.get("/health")
    async def health_check():
        registry = get_registry()
        return {
            "status": "healthy",
            "components": {
                "document_processor": registry.document_processor is not None,
                "hybrid_index": registry.hybrid_index is not None,
                "concept_mapper": registry.concept_mapper is not None,
                "concept_memory": registry.concept_memory is not None,
                "excel_processor": registry.excel_processor is not None,
                "query_engine": registry.query_engine is not None,
                "observability": registry.observability is not None,
                "security": registry.security is not None,
            },
        }

    @app.get("/metrics")
    async def metrics():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/api/search")
    async def search(
        q: str = Query(..., min_length=1),
        session_id: str | None = Query(None),
        top_k: int = Query(10, ge=1, le=100),
    ):
        registry = get_registry()
        if not registry.query_engine:
            raise HTTPException(503, "Query engine not available")

        result = await registry.query_engine.query(
            question=q,
            session_id=session_id or "",
            document_ids=None,
            include_global=True,
        )
        return {
            "results": [c.__dict__ if hasattr(c, '__dict__') else c for c in result.citations],
            "sources_used": result.sources_used,
            "expanded_query": result.expanded_query.__dict__ if result.expanded_query else None,
        }

    @app.get("/api/mappings")
    async def get_mappings():
        registry = get_registry()
        if not registry.concept_mapper:
            raise HTTPException(503, "Concept mapper not available")
        mappings = await registry.concept_mapper.get_all_mappings()
        return {"mappings": [m.model_dump() for m in mappings]}

    @app.post("/api/mappings")
    async def add_mapping(
        data: dict = Body(...),
    ):
        registry = get_registry()
        if not registry.concept_mapper:
            raise HTTPException(503, "Concept mapper not available")

        canonical = data.get("canonical", "")
        synonyms = data.get("synonyms", [])
        category = data.get("category")

        if not canonical:
            raise HTTPException(400, "canonical is required")

        mapping = await registry.concept_mapper.add_mapping(
            canonical=canonical, synonyms=synonyms, category=category
        )
        return {"mapping": mapping.model_dump()}

    @app.delete("/api/mappings/{synonym}")
    async def delete_mapping(synonym: str):
        registry = get_registry()
        if not registry.concept_mapper:
            raise HTTPException(503, "Concept mapper not available")

        removed = await registry.concept_mapper.remove_synonym(synonym)
        if not removed:
            raise HTTPException(404, f"Synonym '{synonym}' not found")
        return {"removed": synonym}

    @app.get("/api/mappings/stream")
    async def stream_mappings():
        """SSE stream of mapping updates (placeholder for live updates)."""
        from fastapi.responses import StreamingResponse

        async def event_generator():
            registry = get_registry()
            if registry.concept_mapper:
                mappings = await registry.concept_mapper.get_all_mappings()
                for m in mappings:
                    yield f"data: {m.model_dump_json()}\n\n"
            yield "event: done\ndata: {}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    @app.get("/api/export")
    async def export_data():
        registry = get_registry()
        result = {}
        if registry.concept_mapper:
            mappings = await registry.concept_mapper.get_all_mappings()
            result["mappings"] = [m.model_dump() for m in mappings]
        if registry.hybrid_index:
            result["index_stats"] = await registry.hybrid_index.get_stats()
        return result

    return app

