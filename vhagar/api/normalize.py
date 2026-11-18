"""API router for on-the-fly concept normalization."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from vhagar.db.repo import get_repo
from vhagar.components.normalization.router import NormalizationRouter

router = APIRouter(prefix="/api/normalize", tags=["normalize"])


class NormalizeRequest(BaseModel):
    text: str


@router.post("")
async def normalize_text(req: NormalizeRequest):
    if not req.text.strip():
        raise HTTPException(400, "text cannot be empty")

    repo = get_repo()
    router_inst = NormalizationRouter(repo=repo)
    result = router_inst.normalize(req.text)
    return {"raw_text": req.text, "result": result}

