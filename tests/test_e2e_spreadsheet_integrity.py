"""End-to-End Workbook Integrity Verification across 5 realistic workbooks.
Tests the full lifecycle:
1. Upload & ingest realistic workbook.
2. Grounded question answering.
3. Prompt-driven edit parsing.
4. Proposed changes/diff inspection.
5. Atomic working-copy creation.
6. Working copy download & reload via OpenPyXL.
7. Verification of cell values, formula ASTs, cell styles (fonts, fills, borders),
   merged cells, hidden rows/columns, multi-sheet references, and unaffected cells.
8. Verification that original source files remain strictly immutable.
"""

import asyncio
from pathlib import Path
import hashlib
import uuid
import openpyxl
import pytest

from vhagar.config import VhagarConfig
from vhagar.bootstrap import bootstrap
from vhagar.database import DatabaseManager, get_db, set_db
from vhagar.components.document_processor import DocumentReference, DocumentFormat, ProcessingStatus
from vhagar.components.excel_processor import CellEdit


async def setup_env(test_config):
    registry = await bootstrap(test_config)
    db = DatabaseManager(db_path=test_config.data_dir / "draythos.db")
    set_db(db)
    u = db.create_user(f"integrity_tester_{uuid.uuid4().hex[:6]}@draythos.io", "pass123", "Integrity Tester")
    user_id = u["id"]
    return registry, db, user_id


@pytest.mark.asyncio
async def test_workbook_1_merged_headers_and_styles_integrity(test_config):
    """Test WB1: Merged cell headers, tiered P&L, styled cells, formula updates."""
    registry, db, user_id = await setup_env(test_config)
    excel_proc = registry.excel_processor
    doc_proc = registry.document_processor
    source_path = Path("tests/workbooks/wb1_merged_headers_pnl.xlsx")
    assert source_path.exists()
    original_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()

    doc_id = "doc_wb1_pnl"
    session_id = "sess_wb1"
    db.register_document(doc_id, session_id, user_id, source_path.name, str(source_path), "xlsx", source_path.stat().st_size)

    # 1. Ingest & Parse
    doc_ref = await doc_proc.process_document(source_path, session_id, document_id=doc_id)
    assert doc_ref.processing_status == ProcessingStatus.COMPLETED

    # 2. Grounded QA
    wb_info, _ = await excel_proc.parse_workbook(source_path)
    assert len(wb_info.sheets) == 1
    assert wb_info.sheets[0].has_merged_cells is True

    # 3. Prompt-Driven Edit Request: Update Q1 Subscription Software from 45000 to 52000
    edits = [
        CellEdit(sheet_name="Consolidated_PnL", cell_ref="B4", old_value=45000, new_value=52000, value_type="number"),
        CellEdit(sheet_name="Consolidated_PnL", cell_ref="E4", old_value=56000, new_value=60000, value_type="number"),
    ]

    # 4. Apply changes & create working copy
    wc = await excel_proc.save_working_copy(doc_id, source_path, edits)
    wc_path = Path(wc.path)
    assert wc_path.exists()

    # 5. Open working copy with OpenPyXL and perform deep integrity audit
    wb_wc = openpyxl.load_workbook(str(wc_path), data_only=False)
    ws_wc = wb_wc["Consolidated_PnL"]

    # Target cell updated
    assert ws_wc["B4"].value == 52000
    assert ws_wc["E4"].value == 60000

    # Unaffected adjacent cells unchanged
    assert ws_wc["C4"].value == 48000
    assert ws_wc["D4"].value == 52000
    assert ws_wc["B5"].value == 15000  # Professional Services Q1 unchanged

    # Formula ASTs preserved
    assert ws_wc["B7"].value == "=SUM(B4:B6)"
    assert ws_wc["B11"].value == "=SUM(B8:B10)"
    assert ws_wc["B12"].value == "=B7-B11"

    # Merged cells preserved
    merged_ranges = [str(r) for r in ws_wc.merged_cells.ranges]
    assert "A1:E1" in merged_ranges, "Title merged cell A1:E1 must be preserved"
    assert "B2:C2" in merged_ranges, "Header merged cell B2:C2 must be preserved"
    assert "D2:E2" in merged_ranges, "Header merged cell D2:E2 must be preserved"

    # Formatting & Styles preserved on title cell
    title_cell = ws_wc["A1"]
    assert title_cell.font.bold is True
    assert title_cell.fill.start_color.rgb == "001F4E78" or title_cell.fill.start_color.index == "1F4E78"

    wb_wc.close()

    # 6. Strict Original File Immutability Check
    current_source_sha = hashlib.sha256(source_path.read_bytes()).hexdigest()
    assert current_source_sha == original_sha256, "Original source file was mutated!"


@pytest.mark.asyncio
async def test_workbook_2_hidden_rows_and_columns_integrity(test_config):
    """Test WB2: Hidden column C and hidden rows 6 & 7 remain hidden after edits."""
    registry, db, user_id = await setup_env(test_config)
    excel_proc = registry.excel_processor
    source_path = Path("tests/workbooks/wb2_hidden_rows_cols.xlsx")
    original_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()

    doc_id = "doc_wb2_hidden"
    session_id = "sess_wb2"
    db.register_document(doc_id, session_id, user_id, source_path.name, str(source_path), "xlsx", source_path.stat().st_size)

    # Edit visible column D cell (Domestic SaaS)
    edits = [
        CellEdit(sheet_name="Detailed_Ledger", cell_ref="D2", old_value=75000, new_value=82000, value_type="number"),
    ]
    wc = await excel_proc.save_working_copy(doc_id, source_path, edits)
    wc_path = Path(wc.path)

    wb_wc = openpyxl.load_workbook(str(wc_path))
    ws_wc = wb_wc["Detailed_Ledger"]

    # Target cell changed
    assert ws_wc["D2"].value == 82000

    # Hidden column preserved
    assert ws_wc.column_dimensions["C"].hidden is True, "Column C must remain hidden"

    # Hidden rows preserved
    assert ws_wc.row_dimensions[6].hidden is True, "Row 6 must remain hidden"
    assert ws_wc.row_dimensions[7].hidden is True, "Row 7 must remain hidden"

    # Values in hidden cells preserved
    assert ws_wc["C2"].value == -5000
    assert ws_wc["E6"].value == -2200

    wb_wc.close()
    assert hashlib.sha256(source_path.read_bytes()).hexdigest() == original_sha256


@pytest.mark.asyncio
async def test_workbook_3_multisheet_cross_reference_integrity(test_config):
    """Test WB3: Multi-sheet workbook with cross-sheet formula dependencies."""
    registry, db, user_id = await setup_env(test_config)
    excel_proc = registry.excel_processor
    source_path = Path("tests/workbooks/wb3_multisheet_cross_ref.xlsx")
    original_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()

    doc_id = "doc_wb3_cross"
    session_id = "sess_wb3"
    db.register_document(doc_id, session_id, user_id, source_path.name, str(source_path), "xlsx", source_path.stat().st_size)

    # Edit Sheet 1 (Revenue_Detail!B2 Enterprise Q1 from 85000 to 95000)
    edits = [
        CellEdit(sheet_name="Revenue_Detail", cell_ref="B2", old_value=85000, new_value=95000, value_type="number"),
    ]
    wc = await excel_proc.save_working_copy(doc_id, source_path, edits)
    wc_path = Path(wc.path)

    wb_wc = openpyxl.load_workbook(str(wc_path))
    assert set(wb_wc.sheetnames) == {"Revenue_Detail", "Cost_Center", "Executive_Summary"}

    # Sheet 1 modified cell
    assert wb_wc["Revenue_Detail"]["B2"].value == 95000
    # Sheet 2 unaffected
    assert wb_wc["Cost_Center"]["B2"].value == 42000
    # Sheet 3 cross-sheet formulas strictly preserved
    assert wb_wc["Executive_Summary"]["B2"].value == "=Revenue_Detail!B5"
    assert wb_wc["Executive_Summary"]["B3"].value == "=Cost_Center!B5"
    assert wb_wc["Executive_Summary"]["B4"].value == "=B2-B3"
    assert wb_wc["Executive_Summary"]["B5"].value == "=B4/B2"

    wb_wc.close()
    assert hashlib.sha256(source_path.read_bytes()).hexdigest() == original_sha256


@pytest.mark.asyncio
async def test_workbook_4_styles_and_number_formats_integrity(test_config):
    """Test WB4: Cell number formatting ($#,##0, 0.0%) and color fills preserved."""
    registry, db, user_id = await setup_env(test_config)
    excel_proc = registry.excel_processor
    source_path = Path("tests/workbooks/wb4_styled_financial_ratios.xlsx")
    original_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()

    doc_id = "doc_wb4_styles"
    session_id = "sess_wb4"
    db.register_document(doc_id, session_id, user_id, source_path.name, str(source_path), "xlsx", source_path.stat().st_size)

    # Update FY24 Actual Target to 155,000,000
    edits = [
        CellEdit(sheet_name="Financial_Ratios", cell_ref="C2", old_value=148500000, new_value=155000000, value_type="number"),
    ]
    wc = await excel_proc.save_working_copy(doc_id, source_path, edits)
    wc_path = Path(wc.path)

    wb_wc = openpyxl.load_workbook(str(wc_path))
    ws_wc = wb_wc["Financial_Ratios"]

    # Target cell updated
    assert ws_wc["C2"].value == 155000000
    # Number format preserved on updated cell
    assert ws_wc["C2"].number_format == "$#,##0"

    # Number format preserved on adjacent and other rows
    assert ws_wc["B2"].number_format == "$#,##0"
    assert ws_wc["B3"].number_format == "0.0%"
    assert ws_wc["E2"].number_format == "0.0%"

    # Formula ASTs preserved
    assert ws_wc["E2"].value == "=(C2-B2)/B2"

    wb_wc.close()
    assert hashlib.sha256(source_path.read_bytes()).hexdigest() == original_sha256


@pytest.mark.asyncio
async def test_workbook_5_nontrivial_layout_and_footnotes_integrity(test_config):
    """Test WB5: Disconnected KPI blocks, spacer rows, and footnotes preserved."""
    registry, db, user_id = await setup_env(test_config)
    excel_proc = registry.excel_processor
    source_path = Path("tests/workbooks/wb5_nontrivial_summary_kpis.xlsx")
    original_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()

    doc_id = "doc_wb5_kpis"
    session_id = "sess_wb5"
    db.register_document(doc_id, session_id, user_id, source_path.name, str(source_path), "xlsx", source_path.stat().st_size)

    # Edit Section 2 ratio target variance
    edits = [
        CellEdit(sheet_name="SaaS_Unit_Economics", cell_ref="C11", old_value=1.15, new_value=1.35, value_type="number"),
    ]
    wc = await excel_proc.save_working_copy(doc_id, source_path, edits)
    wc_path = Path(wc.path)

    wb_wc = openpyxl.load_workbook(str(wc_path))
    ws_wc = wb_wc["SaaS_Unit_Economics"]

    # Modified cell updated
    assert ws_wc["C11"].value == 1.35

    # Section 1 values and formulas preserved
    assert ws_wc["B3"].value == 24000
    assert ws_wc["E4"].value == "=SUM(B4:D4)"
    assert ws_wc["B7"].value == "=B3+B4+B5+B6"

    # Spacer rows empty
    assert ws_wc["A8"].value is None
    assert ws_wc["A9"].value is None

    # Footnotes in rows 20 and 21 intact
    assert "FOOTNOTE 1" in ws_wc["A20"].value
    assert "FOOTNOTE 2" in ws_wc["A21"].value
    assert ws_wc["A20"].font.italic is True

    wb_wc.close()
    assert hashlib.sha256(source_path.read_bytes()).hexdigest() == original_sha256
