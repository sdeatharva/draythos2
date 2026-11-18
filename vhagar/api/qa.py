"""API router for Structured-First Q&A."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from vhagar.db.repo import get_repo
from vhagar.components.normalization.dictionary import DictionaryNormalizer
from vhagar.components.normalization.router import NormalizerRouter
from vhagar.components.facts.service import FactsService
from vhagar.components.qa.planner import QAPlanner
from vhagar.components.qa.answerer import QAAnswerer, QAPlanResponse
from vhagar.components.qa.verifier import QAVerifier, VerificationResult

router = APIRouter(prefix="/api/qa", tags=["qa"])


class PlanRequest(BaseModel):
    question: str
    entity_hint: Optional[str] = None
    attached_doc_ids: List[str] = Field(default_factory=list)
    supporting_chunks: List[Dict[str, Any]] = Field(default_factory=list)


class VerifyRequest(BaseModel):
    answer: str
    plan_response: QAPlanResponse


@router.post("/plan", response_model=QAPlanResponse)
async def generate_qa_plan(req: PlanRequest):
    repo = get_repo()
    dict_norm = DictionaryNormalizer(repo=repo)
    normalizer_router = NormalizerRouter(dictionary=dict_norm)
    planner = QAPlanner(router=normalizer_router)
    facts_service = FactsService(repo=repo, normalizer_router=normalizer_router)
    answerer = QAAnswerer(facts_service=facts_service)

    plan = planner.plan(
        question=req.question,
        entity_hint=req.entity_hint,
        attached_doc_ids=req.attached_doc_ids,
    )
    plan_resp = answerer.execute_plan(
        plan=plan,
        attached_doc_ids=req.attached_doc_ids,
        supporting_chunks=req.supporting_chunks,
    )
    return plan_resp


@router.post("/verify", response_model=VerificationResult)
async def verify_qa_answer(req: VerifyRequest):
    verifier = QAVerifier()
    result = verifier.verify_answer(req.answer, req.plan_response)
    return result

