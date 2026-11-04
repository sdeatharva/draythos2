"""Unit tests for Excel Processor (atomic edits, working copy validation, download correctness)."""

import pytest
from pathlib import Path
from vhagar.components.excel_processor import ExcelProcessor, CellEdit


@pytest.mark.asyncio
async def test_excel_processor_save_working_copy_and_validate(test_config, temp_dir):
    import openpyxl

    # Create a test workbook
    wb_path = temp_dir / "budget.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Q1_Budget"
    ws["A1"] = "Category"
    ws["B1"] = "Amount"
    ws["A2"] = "Marketing"
    ws["B2"] = 10000
    ws["A3"] = "Total"
    ws["B3"] = "=SUM(B2:B2)"
    wb.save(str(wb_path))
    wb.close()

    processor = ExcelProcessor(test_config)

    # 1. Parse workbook
    info, content = await processor.parse_workbook(wb_path)
    assert info.total_sheets == 1
    assert info.sheets[0].name == "Q1_Budget"
    assert info.sheets[0].has_formulas is True

    # 2. Apply cell edits
    edits = [
        CellEdit(
            sheet_name="Q1_Budget",
            cell_ref="B2",
            old_value=10000,
            new_value=15000,
            value_type="number",
        )
    ]

    version = await processor.save_working_copy(
        document_id="doc_excel_1",
        source_path=wb_path,
        edits=edits,
    )

    assert version.version_id != ""
    assert version.edit_count == 1
    assert Path(version.path).exists()

    # 3. Invariant: Original file must remain immutable
    wb_orig = openpyxl.load_workbook(str(wb_path), data_only=True)
    assert wb_orig["Q1_Budget"]["B2"].value == 10000
    wb_orig.close()

    # 4. Invariant: Working copy must contain the updated validated value
    wb_wc = openpyxl.load_workbook(str(version.path), data_only=True)
    assert wb_wc["Q1_Budget"]["B2"].value == 15000
    wb_wc.close()

    # 5. Fetch latest version
    latest = await processor.get_latest_version("doc_excel_1")
    assert latest is not None
    assert latest.version_id == version.version_id

