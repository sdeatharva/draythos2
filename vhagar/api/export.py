"""API router for Canonical Data Exports."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse

from vhagar.db.repo import get_repo
from vhagar.components.export.xlsx_writer import generate_consolidated_workbook
from vhagar.components.export.csv_writer import export_facts_to_csv
from vhagar.components.export.json_writer import export_facts_to_json

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/xlsx")
async def export_xlsx(doc_id: Optional[str] = Query(None)):
    repo = get_repo()
    temp_dir = Path(tempfile.gettempdir())
    out_file = temp_dir / "draythos_consolidated_financials.xlsx"
    try:
        generate_consolidated_workbook(output_path=out_file, repo=repo, doc_id=doc_id)
        return FileResponse(
            path=str(out_file),
            filename="draythos_consolidated_financials.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as exc:
        raise HTTPException(500, f"Excel export failed: {str(exc)}")


@router.get("/csv")
async def export_csv(doc_id: Optional[str] = Query(None)):
    repo = get_repo()
    temp_dir = Path(tempfile.gettempdir())
    out_file = temp_dir / "draythos_canonical_facts.csv"
    try:
        export_facts_to_csv(output_path=out_file, repo=repo, doc_id=doc_id)
        return FileResponse(
            path=str(out_file),
            filename="draythos_canonical_facts.csv",
            media_type="text/csv",
        )
    except Exception as exc:
        raise HTTPException(500, f"CSV export failed: {str(exc)}")


@router.get("/json")
async def export_json(doc_id: Optional[str] = Query(None)):
    repo = get_repo()
    temp_dir = Path(tempfile.gettempdir())
    out_file = temp_dir / "draythos_canonical_facts.json"
    try:
        export_facts_to_json(output_path=out_file, repo=repo, doc_id=doc_id)
        return FileResponse(
            path=str(out_file),
            filename="draythos_canonical_facts.json",
            media_type="application/json",
        )
    except Exception as exc:
        raise HTTPException(500, f"JSON export failed: {str(exc)}")

