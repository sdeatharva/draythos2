"""Q&A Answerer (structured-first).

Specification: Section 11
1. Query facts by concept, period, entity, and document scope.
2. Code-based arithmetic in Python: sums, differences, ratios, YoY growth. The LLM never computes arithmetic.
3. Conflict detection: conflicting values for the same concept & period are surfaced explicitly with sources.
4. Synthesizes structured answer or evidence block for generation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
import structlog
from pydantic import BaseModel, Field

from vhagar.components.facts.service import FactsService
from vhagar.components.qa.planner import QAPlan

logger = structlog.get_logger(__name__)


class ComputedResult(BaseModel):
    operation: str
    value: float
    unit: str
    formula: str
    referenced_fact_ids: List[str] = Field(default_factory=list)


class FactEvidence(BaseModel):
    fact_id: str
    doc_id: str
    raw_label: str
    concept_id: str
    concept_label: str
    value_num: Optional[float] = None
    unit: str = ""
    period_label: str = ""
    locator: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.0
    state: str = ""
    is_attached: bool = True


class ConflictEvidence(BaseModel):
    concept_id: str
    period_label: str
    values: List[Dict[str, Any]]
    message: str


class QAPlanResponse(BaseModel):
    plan: QAPlan
    facts: List[FactEvidence] = Field(default_factory=list)
    computations: List[ComputedResult] = Field(default_factory=list)
    conflicts: List[ConflictEvidence] = Field(default_factory=list)
    supporting_chunks: List[Dict[str, Any]] = Field(default_factory=list)
    formatted_context: str = ""
    direct_answer: Optional[str] = None


class QAAnswerer:
    """Retrieves verified facts, computes values in Python, and detects conflicts."""

    def __init__(self, facts_service: FactsService):
        self.facts_service = facts_service

    def execute_plan(
        self,
        plan: QAPlan,
        attached_doc_ids: Optional[List[str]] = None,
        supporting_chunks: Optional[List[Dict[str, Any]]] = None,
    ) -> QAPlanResponse:
        attached_set = set(attached_doc_ids or [])
        facts_list: List[FactEvidence] = []
        conflicts: List[ConflictEvidence] = []
        computations: List[ComputedResult] = []

        # 1. Query Facts
        all_facts = []
        if plan.target_concepts:
            for cid in plan.target_concepts:
                retrieved = self.facts_service.query_facts(concept_id=cid, limit=50)
                all_facts.extend(retrieved)
        else:
            all_facts = self.facts_service.query_facts(limit=50)

        # Filter by periods if specified (unless growth/comparison query where multiple periods are compared)
        if plan.target_periods and plan.intent not in ("growth", "comparison"):
            all_facts = [
                f for f in all_facts
                if (f.get("period") or {}).get("label") in plan.target_periods
            ]

        # Prioritize attached documents
        def sort_key(f: Dict[str, Any]) -> tuple:
            is_att = 1 if f.get("doc_id") in attached_set else 0
            conf = f.get("confidence", 0.0)
            return (is_att, conf)

        all_facts.sort(key=sort_key, reverse=True)

        for f in all_facts:
            p_label = (f.get("period") or {}).get("label", "N/A")
            facts_list.append(
                FactEvidence(
                    fact_id=f.get("fact_id", ""),
                    doc_id=f.get("doc_id", ""),
                    raw_label=f.get("raw_label", ""),
                    concept_id=f.get("concept_id", ""),
                    concept_label=f.get("concept_label", ""),
                    value_num=f.get("value_num"),
                    unit=f.get("unit", ""),
                    period_label=p_label,
                    locator=f.get("locator", {}),
                    confidence=f.get("confidence", 0.0),
                    state=f.get("state", ""),
                    is_attached=f.get("doc_id") in attached_set if attached_set else True,
                )
            )

        # 2. Conflict Detection: same concept + same period with different values
        by_concept_period: Dict[tuple[str, str], List[FactEvidence]] = {}
        for fe in facts_list:
            if fe.value_num is not None:
                key = (fe.concept_id, fe.period_label)
                by_concept_period.setdefault(key, []).append(fe)

        for (cid, plabel), fe_group in by_concept_period.items():
            unique_vals = set(fe.value_num for fe in fe_group if fe.value_num is not None)
            if len(unique_vals) > 1:
                conflicts.append(
                    ConflictEvidence(
                        concept_id=cid,
                        period_label=plabel,
                        values=[
                            {"fact_id": fe.fact_id, "doc_id": fe.doc_id, "value": fe.value_num, "locator": fe.locator}
                            for fe in fe_group
                        ],
                        message=f"Conflict detected for {cid} ({plabel}): multiple distinct values reported.",
                    )
                )

        # 3. Python Arithmetic Computation (LLM never does arithmetic)
        if plan.intent == "growth" and len(facts_list) >= 2:
            # Sort chronologically by period if possible
            numeric_facts = [fe for fe in facts_list if fe.value_num is not None]
            if len(numeric_facts) >= 2:
                f_old = numeric_facts[-1]
                f_new = numeric_facts[0]
                if f_old.unit == f_new.unit and f_old.value_num != 0:
                    diff = f_new.value_num - f_old.value_num
                    growth_pct = (diff / abs(f_old.value_num)) * 100.0
                    computations.append(
                        ComputedResult(
                            operation="growth_rate",
                            value=round(growth_pct, 2),
                            unit="percent",
                            formula=f"(({f_new.value_num} - {f_old.value_num}) / {f_old.value_num}) * 100",
                            referenced_fact_ids=[f_new.fact_id, f_old.fact_id],
                        )
                    )
                    computations.append(
                        ComputedResult(
                            operation="difference",
                            value=round(diff, 2),
                            unit=f_new.unit,
                            formula=f"{f_new.value_num} - {f_old.value_num}",
                            referenced_fact_ids=[f_new.fact_id, f_old.fact_id],
                        )
                    )

        elif plan.intent == "aggregation" and facts_list:
            # Check for currency matching
            units = set(fe.unit for fe in facts_list if fe.value_num is not None)
            if len(units) == 1:
                total_val = sum(fe.value_num for fe in facts_list if fe.value_num is not None)
                common_unit = next(iter(units))
                computations.append(
                    ComputedResult(
                        operation="sum",
                        value=round(total_val, 2),
                        unit=common_unit,
                        formula=" + ".join(str(fe.value_num) for fe in facts_list if fe.value_num is not None),
                        referenced_fact_ids=[fe.fact_id for fe in facts_list if fe.value_num is not None],
                    )
                )

        # 4. Format Structured Evidence Context
        lines: List[str] = [
            "### [Verified Canonical Facts from Data Room]",
            "Use ONLY these verified facts for values and numbers. Every number cited MUST reference [F:fact_id].",
        ]
        if facts_list:
            for fe in facts_list:
                loc_str = str(fe.locator)
                scope = "Attached Doc" if fe.is_attached else "Global Room"
                lines.append(
                    f"- [F:{fe.fact_id}] {fe.concept_label} ({fe.concept_id}) | Wording: '{fe.raw_label}' | "
                    f"Value: {fe.value_num} {fe.unit} | Period: {fe.period_label} | Scope: {scope} | Locator: {loc_str}"
                )
        else:
            lines.append("No matching verified facts found in system of record.")

        if computations:
            lines.append("\n### [Code-Computed Arithmetic (Python)]")
            lines.append("These values were strictly computed in code. DO NOT recompute them:")
            for comp in computations:
                lines.append(
                    f"- {comp.operation.upper()}: {comp.value} {comp.unit} (Formula: {comp.formula}) "
                    f"[Ref: {', '.join(comp.referenced_fact_ids)}]"
                )

        if conflicts:
            lines.append("\n### [Discrepancies / Conflicts]")
            for c in conflicts:
                lines.append(f"- WARNING: {c.message}")

        if supporting_chunks:
            lines.append("\n### [Retrieved Document Excerpts]")
            for i, chunk in enumerate(supporting_chunks, 1):
                cid = chunk.get("chunk_id", f"c_{i}")
                lines.append(f"[{cid}] {chunk.get('text', '')}")

        formatted_context = "\n".join(lines)

        # 5. Direct Answer Formulation (for instant deterministic response if lookup is exact)
        direct_ans: Optional[str] = None
        if len(facts_list) == 1 and not computations and not conflicts:
            fe = facts_list[0]
            direct_ans = (
                f"According to verified fact `[F:{fe.fact_id}]`, {fe.concept_label} for {fe.period_label} "
                f"is **{fe.value_num:,.2f} {fe.unit}** (reported in document as *\"{fe.raw_label}\"*)."
            )

        return QAPlanResponse(
            plan=plan,
            facts=facts_list,
            computations=computations,
            conflicts=conflicts,
            supporting_chunks=supporting_chunks or [],
            formatted_context=formatted_context,
            direct_answer=direct_ans,
        )
