"""API router for Canonical Concepts and Taxonomy."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from vhagar.db.repo import get_repo
from vhagar.db.seed_taxonomy import CAVEAT

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


@router.get("")
async def list_concepts(kind: Optional[str] = Query(None)):
    repo = get_repo()
    concepts = repo.list_concepts(kind=kind)
    return {
        "concepts": concepts,
        "total": len(concepts),
        "caveat": CAVEAT,
        "taxonomy_version": "tax-1.0.0",
    }


@router.get("/tree")
async def get_concept_tree():
    repo = get_repo()
    tree = repo.get_concept_tree()
    return {"tree": tree, "caveat": CAVEAT}


@router.get("/{concept_id}")
async def get_concept(concept_id: str):
    repo = get_repo()
    concept = repo.get_concept(concept_id)
    if not concept:
        raise HTTPException(404, f"Concept '{concept_id}' not found")
    aliases = repo.list_aliases(concept_id=concept_id)
    return {**concept, "aliases": aliases, "caveat": CAVEAT}


@router.get("/{concept_id}/aliases")
async def get_concept_aliases(concept_id: str):
    repo = get_repo()
    concept = repo.get_concept(concept_id)
    if not concept:
        raise HTTPException(404, f"Concept '{concept_id}' not found")
    aliases = repo.list_aliases(concept_id=concept_id)
    return {"concept_id": concept_id, "aliases": aliases}

