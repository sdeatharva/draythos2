"""Multi-tab consolidated Excel workbook writer.

Specification: Section 14.1
Sheets:
- Summary: export time, filters, versions, counts by state, caveat
- Unified: pivot table with rows = canonical concept, cols = period / entity, numeric values
- Facts: all extracted facts with precise locators and links
- Mappings: raw label -> concept, method, confidence, state
- NeedsReview: abstained, conflict, and needs_review items
- Sources: documents registered in the system
- Concepts: snapshot of canonical taxonomy
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.comments import Comment

from vhagar.components.extraction.locators import format_locator_display
from vhagar.components.facts.unify import build_unified_financial_matrix
from vhagar.db.repo import get_repo
from vhagar.db.seed_taxonomy import CAVEAT


def generate_consolidated_workbook(
    output_path: Path | str,
    repo=None,
    doc_id: Optional[str] = None,
    facts: Optional[List[Dict[str, Any]]] = None,
    concepts: Optional[List[Dict[str, Any]]] = None,
    mapping_version: int = 1,
) -> Path:
    """Generate professional 7-tab canonical Excel workbook adhering to Section 14.1."""
    r = repo or get_repo()
    wb = openpyxl.Workbook()

    # Styling presets
    header_fill = PatternFill(start_color="141413", end_color="141413", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=11, bold=True)
    regular_font = Font(name="Calibri", size=11)
    thin_border = Border(
        left=Side(style="thin", color="D1CFC5"),
        right=Side(style="thin", color="D1CFC5"),
        top=Side(style="thin", color="D1CFC5"),
        bottom=Side(style="thin", color="D1CFC5"),
    )

    if facts is None:
        facts, _ = r.list_facts(doc_id=doc_id, limit=5000)
    if concepts is None:
        concepts = r.list_concepts()

    # -------------------------------------------------------------
    # 1. Summary Sheet
    # -------------------------------------------------------------
    ws_summary = wb.active
    ws_summary.title = "Summary"
    ws_summary.cell(row=1, column=1, value="Draythos Finance Concept Translator — Export Summary").font = Font(name="Calibri", size=14, bold=True)
    ws_summary.cell(row=2, column=1, value=f"Caveat: {CAVEAT}").font = Font(name="Calibri", size=9, italic=True, color="5E5D59")

    # Counts by state
    state_counts: Dict[str, int] = {}
    for f in facts:
        st = f.get("state", "unknown")
        state_counts[st] = state_counts.get(st, 0) + 1

    summary_items = [
        ("Export Timestamp (UTC)", datetime.now(timezone.utc).isoformat()),
        ("Taxonomy Version", "tax-1.0.0"),
        ("Model Version", "enc-1.0.0"),
        ("Active Mapping Version", str(mapping_version or r.get_mapping_version())),
        ("Total Verified Facts", len(facts)),
        ("Auto Accepted Facts", state_counts.get("auto_accepted", 0)),
        ("Needs Review Facts", state_counts.get("needs_review", 0)),
        ("Abstained Items", state_counts.get("abstained", 0)),
        ("Discrepancies / Conflicts", state_counts.get("conflict", 0)),
    ]
    for idx, (k, v) in enumerate(summary_items, start=4):
        ws_summary.cell(row=idx, column=1, value=k).font = bold_font
        ws_summary.cell(row=idx, column=2, value=v).font = regular_font

    # -------------------------------------------------------------
    # 2. Unified Matrix Sheet (Pivot: rows=concept, cols=period)
    # -------------------------------------------------------------
    ws_unified = wb.create_sheet(title="Unified")
    matrix = build_unified_financial_matrix(repo=r, doc_id=doc_id)
    periods = matrix.get("periods", [])

    ws_unified.cell(row=1, column=1, value="Canonical Financial Statement (Consolidated)").font = Font(name="Calibri", size=13, bold=True)
    col_names = ["Canonical Concept", "Category"] + periods
    for col_idx, col_name in enumerate(col_names, start=1):
        c = ws_unified.cell(row=3, column=col_idx, value=col_name)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center" if col_idx > 2 else "left")

    curr_row = 4
    for row_data in matrix.get("rows", []):
        c1 = ws_unified.cell(row=curr_row, column=1, value=row_data.get("concept_label", ""))
        c1.font = bold_font
        c1.border = thin_border

        c2 = ws_unified.cell(row=curr_row, column=2, value=row_data.get("kind", "").upper())
        c2.font = regular_font
        c2.border = thin_border
        c2.alignment = Alignment(horizontal="center")

        for p_idx, p in enumerate(periods, start=3):
            val = row_data.get("values_by_period", {}).get(p)
            c = ws_unified.cell(row=curr_row, column=p_idx, value=val if val is not None else "—")
            c.font = regular_font
            c.border = thin_border
            if isinstance(val, (int, float)):
                c.number_format = "#,##0.00"
                c.alignment = Alignment(horizontal="right")
                c.comment = Comment(f"Period: {p}\nCanonical: {row_data.get('concept_id')}", "Draythos")
            else:
                c.alignment = Alignment(horizontal="center")
        curr_row += 1

    # -------------------------------------------------------------
    # 3. Facts Sheet (Audit Trail)
    # -------------------------------------------------------------
    ws_facts = wb.create_sheet(title="Facts")
    facts_headers = [
        "Fact ID", "Document", "Entity", "Period", "Original Raw Label",
        "Canonical Concept", "Extracted Value", "Numeric Value", "Unit",
        "Confidence", "Review State", "Match Method", "Source Locator"
    ]
    for col_idx, h in enumerate(facts_headers, start=1):
        c = ws_facts.cell(row=1, column=col_idx, value=h)
        c.fill = header_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center")

    for r_idx, f in enumerate(facts, start=2):
        row_values = [
            f.get("fact_id", ""),
            f.get("doc_id", ""),
            f.get("entity", "") or "Acme Corp",
            f.get("period", {}).get("label", "") if isinstance(f.get("period"), dict) else str(f.get("period", "")),
            f.get("raw_label", ""),
            f.get("concept_label", "") or "Unmapped",
            f.get("value_raw", ""),
            f.get("value_num", ""),
            f.get("unit", "") or "",
            f"{int(float(f.get('confidence', 0.0)) * 100)}%",
            f.get("state", ""),
            f.get("match_method", ""),
            format_locator_display(f.get("locator", {})),
        ]
        for col_idx, val in enumerate(row_values, start=1):
            cell = ws_facts.cell(row=r_idx, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            if col_idx == 8 and isinstance(val, (int, float)):
                cell.number_format = "#,##0.00"

    # -------------------------------------------------------------
    # 4. Mappings Sheet
    # -------------------------------------------------------------
    ws_map = wb.create_sheet(title="Mappings")
    map_headers = ["Original Surface Label", "Canonical Concept ID", "Concept Label", "Method", "Confidence", "State"]
    for col_idx, h in enumerate(map_headers, start=1):
        c = ws_map.cell(row=1, column=col_idx, value=h)
        c.fill = header_fill
        c.font = header_font

    seen_labels = set()
    m_row = 2
    for f in facts:
        lbl = f.get("raw_label", "")
        if lbl and lbl not in seen_labels:
            seen_labels.add(lbl)
            ws_map.cell(row=m_row, column=1, value=lbl)
            ws_map.cell(row=m_row, column=2, value=f.get("concept_id", ""))
            ws_map.cell(row=m_row, column=3, value=f.get("concept_label", ""))
            ws_map.cell(row=m_row, column=4, value=f.get("match_method", ""))
            ws_map.cell(row=m_row, column=5, value=f"{int(float(f.get('confidence', 0.0))*100)}%")
            ws_map.cell(row=m_row, column=6, value=f.get("state", ""))
            m_row += 1

    # -------------------------------------------------------------
    # 5. NeedsReview Sheet
    # -------------------------------------------------------------
    ws_review = wb.create_sheet(title="NeedsReview")
    for col_idx, h in enumerate(facts_headers, start=1):
        c = ws_review.cell(row=1, column=col_idx, value=h)
        c.fill = header_fill
        c.font = header_font

    rev_row = 2
    for f in facts:
        if f.get("state") in ("needs_review", "abstained", "conflict"):
            row_vals = [
                f.get("fact_id", ""), f.get("doc_id", ""), f.get("entity", ""),
                f.get("period", {}).get("label", "") if isinstance(f.get("period"), dict) else str(f.get("period", "")),
                f.get("raw_label", ""), f.get("concept_label", ""), f.get("value_raw", ""),
                f.get("value_num", ""), f.get("unit", ""),
                f"{int(float(f.get('confidence', 0.0)) * 100)}%",
                f.get("state", ""), f.get("match_method", ""),
                format_locator_display(f.get("locator", {})),
            ]
            for col_idx, val in enumerate(row_vals, start=1):
                cell = ws_review.cell(row=rev_row, column=col_idx, value=val)
                cell.font = regular_font
                cell.border = thin_border
            rev_row += 1

    # -------------------------------------------------------------
    # 6. Sources Sheet
    # -------------------------------------------------------------
    ws_sources = wb.create_sheet(title="Sources")
    src_headers = ["Document ID", "Format", "Entity", "Jurisdiction", "Status"]
    for col_idx, h in enumerate(src_headers, start=1):
        c = ws_sources.cell(row=1, column=col_idx, value=h)
        c.fill = header_fill
        c.font = header_font

    doc_ids = set(f.get("doc_id") for f in facts if f.get("doc_id"))
    for s_idx, d_id in enumerate(sorted(doc_ids), start=2):
        ws_sources.cell(row=s_idx, column=1, value=d_id)
        ws_sources.cell(row=s_idx, column=2, value=Path(d_id).suffix)
        ws_sources.cell(row=s_idx, column=3, value="Acme Corp")
        ws_sources.cell(row=s_idx, column=4, value="GLOBAL")
        ws_sources.cell(row=s_idx, column=5, value="Ingested")

    # -------------------------------------------------------------
    # 7. Concepts Sheet
    # -------------------------------------------------------------
    ws_concepts = wb.create_sheet(title="Concepts")
    con_headers = ["Concept ID", "Label", "Kind", "Parent ID", "Jurisdiction", "Definition"]
    for col_idx, h in enumerate(con_headers, start=1):
        c = ws_concepts.cell(row=1, column=col_idx, value=h)
        c.fill = header_fill
        c.font = header_font

    for c_idx, con in enumerate(concepts, start=2):
        ws_concepts.cell(row=c_idx, column=1, value=con.get("concept_id", ""))
        ws_concepts.cell(row=c_idx, column=2, value=con.get("label", ""))
        ws_concepts.cell(row=c_idx, column=3, value=con.get("kind", ""))
        ws_concepts.cell(row=c_idx, column=4, value=con.get("parent_id", "") or "")
        ws_concepts.cell(row=c_idx, column=5, value=con.get("jurisdiction", ""))
        ws_concepts.cell(row=c_idx, column=6, value=con.get("definition", ""))

    # Auto-adjust column widths
    for ws in (ws_summary, ws_unified, ws_facts, ws_map, ws_review, ws_sources, ws_concepts):
        for col in ws.columns:
            max_len = max(len(str(cell.value or "")) for cell in col)
            col_letter = get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    wb.save(str(out))
    return out


# Alias matching section 14 & test suite
write_unified_workbook = generate_consolidated_workbook
