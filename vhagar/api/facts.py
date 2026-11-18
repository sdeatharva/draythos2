"""API router for Facts and Fact Reviews."""

from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel

from vhagar.db.repo import get_repo
from vhagar.components.facts.service import FactsService

router = APIRouter(prefix="/api/facts", tags=["facts"])


class ReviewRequest(BaseModel):
    action: str  # "accept" | "reject" | "reassign"
    new_concept_id: Optional[str] = None
    by: str = "user"
    note: Optional[str] = None


class IngestDocRequest(BaseModel):
    doc_id: str
    file_path: str
    entity: Optional[str] = None
    jurisdiction: str = "GLOBAL"


@router.get("")
async def list_facts(
    doc_id: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    concept_id: Optional[str] = Query(None),
    kind: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    repo = get_repo()
    service = FactsService(repo=repo)
    facts, total = service.list_facts(
        doc_id=doc_id,
        state=state,
        concept_id=concept_id,
        kind=kind,
        search=search,
        limit=limit,
        offset=offset,
    )
    return {"facts": facts, "total": total, "limit": limit, "offset": offset}


@router.get("/{fact_id}")
async def get_fact(fact_id: str):
    repo = get_repo()
    fact = repo.get_fact(fact_id)
    if not fact:
        raise HTTPException(404, f"Fact '{fact_id}' not found")
    return fact


@router.post("/{fact_id}/review")
async def review_fact(fact_id: str, req: ReviewRequest):
    repo = get_repo()
    service = FactsService(repo=repo)
    try:
        updated = service.review_fact(
            fact_id=fact_id,
            action=req.action,
            new_concept_id=req.new_concept_id,
            by=req.by,
            note=req.note,
        )
        return updated
    except KeyError:
        raise HTTPException(404, f"Fact '{fact_id}' not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/ingest")
async def ingest_document_facts(req: IngestDocRequest):
    repo = get_repo()
    service = FactsService(repo=repo)
    try:
        facts = service.ingest_document_facts(
            file_path=req.file_path,
            doc_id=req.doc_id,
            entity=req.entity,
            jurisdiction=req.jurisdiction,
        )
        return {"doc_id": req.doc_id, "facts_extracted": len(facts), "facts": facts}
    except Exception as exc:
        raise HTTPException(500, f"Extraction failed: {str(exc)}")

