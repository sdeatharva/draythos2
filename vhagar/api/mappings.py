"""API router for Mappings, Overrides, and Impact Preview."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from vhagar.db.repo import get_repo
from vhagar.components.normalization.overrides import OverrideManager

router = APIRouter(prefix="/api/mappings", tags=["mappings"])


class MappingCreateRequest(BaseModel):
    alias: str
    concept_id: str
    relation: str = "equivalent"
    by: str = "user"
    reason: Optional[str] = None


class PreviewRequest(BaseModel):
    alias: str
    concept_id: str


@router.get("")
async def get_mappings(concept_id: Optional[str] = Query(None)):
    repo = get_repo()
    aliases = repo.list_aliases(concept_id=concept_id, limit=500)
    return {
        "mappings": aliases,
        "mapping_version": repo.get_mapping_version(),
    }


@router.post("")
async def add_mapping_override(req: MappingCreateRequest):
    repo = get_repo()
    mgr = OverrideManager(repo=repo)
    try:
        res = mgr.apply_override(
            alias=req.alias,
            new_concept_id=req.concept_id,
            relation=req.relation,
            by=req.by,
            reason=req.reason,
        )
        return res
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/impact")
async def get_mapping_impact(alias: str = Query(...), concept_id: str = Query(...)):
    repo = get_repo()
    mgr = OverrideManager(repo=repo)
    try:
        preview = mgr.preview_impact(alias=alias, new_concept_id=concept_id)
        return preview
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/preview")
async def preview_mapping_impact(req: PreviewRequest):
    repo = get_repo()
    mgr = OverrideManager(repo=repo)
    try:
        preview = mgr.preview_impact(alias=req.alias, new_concept_id=req.concept_id)
        return preview
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{alias_id}")
async def delete_mapping(alias_id: str, by: str = Query("user")):
    repo = get_repo()
    deleted = repo.delete_alias(alias_id=alias_id, by=by)
    if not deleted:
        raise HTTPException(404, f"Alias '{alias_id}' not found")
    return {"deleted": alias_id, "mapping_version": repo.get_mapping_version()}


@router.get("/log")
async def get_mapping_log(limit: int = Query(100, ge=1, le=500)):
    repo = get_repo()
    logs = repo.get_mapping_log(limit=limit)
    return {"logs": logs, "mapping_version": repo.get_mapping_version()}


@router.post("/undo/{log_id}")
async def undo_mapping(log_id: int):
    repo = get_repo()
    undone = repo.undo_mapping_log(log_id=log_id)
    if not undone:
        raise HTTPException(404, f"Log entry '{log_id}' not found or could not be reverted")
    return {"undone": log_id, "mapping_version": repo.get_mapping_version()}


