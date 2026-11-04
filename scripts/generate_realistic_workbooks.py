"""Generates 5 realistic financial workbooks with challenging layouts:
1. Merged cell headers and tiered P&L structure
2. Hidden rows and hidden columns
3. Multi-sheet cross-workbook references
4. Complex cell styles (currency, percentage, borders, fills)
5. Nontrivial KPI blocks with spacer rows and footnotes
"""

from pathlib import Path
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def create_workbook_1_merged_headers(output_path: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Consolidated_PnL"

    # Title block with merged cells
    ws.merge_cells("A1:E1")
    title_cell = ws["A1"]
    title_cell.value = "ACME ENTERPRISE CORP - CONSOLIDATED STATEMENT OF OPERATIONS"
    title_cell.font = Font(name="Calibri", size=13, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    title_cell.alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("B2:C2")
    ws["B2"] = "FY2024 Actuals"
    ws["B2"].font = Font(bold=True)
    ws["B2"].alignment = Alignment(horizontal="center")

    ws.merge_cells("D2:E2")
    ws["D2"] = "FY2025 Forecast"
    ws["D2"].font = Font(bold=True)
    ws["D2"].alignment = Alignment(horizontal="center")

    headers = ["Line Item", "Q1 Act", "Q2 Act", "Q3 Fcst", "Q4 Fcst"]
    ws.append(headers)
    for col in range(1, 6):
        cell = ws.cell(row=3, column=col)
        cell.font = Font(bold=True)
        cell.fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
        cell.alignment = Alignment(horizontal="left" if col == 1 else "right")

    # Data Rows
    data = [
        ["Subscription Software", 45000, 48000, 52000, 56000],
        ["Professional Services", 15000, 16500, 17000, 18500],
        ["Hardware & Appliances", 8000, 7500, 9000, 9500],
    ]
    for row in data:
        ws.append(row)

    # Total Revenue with formula
    ws.append(["Total Revenue", "=SUM(B4:B6)", "=SUM(C4:C6)", "=SUM(D4:D6)", "=SUM(E4:E6)"])
    rev_row = 7
    for col in range(1, 6):
        cell = ws.cell(row=rev_row, column=col)
        cell.font = Font(bold=True)
        cell.border = Border(top=Side(style="thin"), bottom=Side(style="thin"))

    # OPEX
    ws.append(["Research & Development", 18000, 19000, 20500, 21000])
    ws.append(["Sales & Marketing", 22000, 23500, 24000, 25500])
    ws.append(["General & Administrative", 9000, 9200, 9500, 9800])
    ws.append(["Total Operating Expenses", "=SUM(B8:B10)", "=SUM(C8:C10)", "=SUM(D8:D10)", "=SUM(E8:E10)"])
    opex_row = 11
    for col in range(1, 6):
        cell = ws.cell(row=opex_row, column=col)
        cell.font = Font(bold=True)
        cell.border = Border(top=Side(style="thin"), bottom=Side(style="thin"))

    # Operating Income
    ws.append(["Operating Income", "=B7-B11", "=C7-C11", "=D7-D11", "=E7-E11"])
    oi_row = 12
    for col in range(1, 6):
        cell = ws.cell(row=oi_row, column=col)
        cell.font = Font(bold=True, color="1F4E78")
        cell.border = Border(bottom=Side(style="double"))

    # Set column widths
    ws.column_dimensions["A"].width = 30
    for col_letter in ["B", "C", "D", "E"]:
        ws.column_dimensions[col_letter].width = 16

    wb.save(output_path)


def create_workbook_2_hidden_rows_cols(output_path: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Detailed_Ledger"

    ws.append(["Account Code", "Account Description", "Intercompany Elimination", "Domestic Division", "International Division", "Total Consolidated"])
    for col in range(1, 7):
        ws.cell(row=1, column=col).font = Font(bold=True)

    rows = [
        ["4010", "Enterprise SaaS Licenses", -5000, 75000, 45000, "=SUM(C2:E2)"],
        ["4020", "Cloud Hosting Revenue", -2000, 28000, 14000, "=SUM(C3:E3)"],
        ["5010", "Hosting Infrastructure Cost", 2000, -12000, -6000, "=SUM(C4:E4)"],
        ["5020", "Direct Support Labor", 0, -18000, -9000, "=SUM(C5:E5)"],
        ["6010", "Depreciation - Servers (Hidden Detail)", 0, -4500, -2200, "=SUM(C6:E6)"],
        ["6020", "Depreciation - Software (Hidden Detail)", 0, -3200, -1500, "=SUM(C7:E7)"],
        ["7000", "Net Operating Margin", "=SUM(C2:C7)", "=SUM(D2:D7)", "=SUM(E2:E7)", "=SUM(F2:F5)+F6+F7"],
    ]
    for r in rows:
        ws.append(r)

    # Hide Column C (Intercompany Elimination)
    ws.column_dimensions["C"].hidden = True

    # Hide Rows 6 and 7 (Depreciation Details)
    ws.row_dimensions[6].hidden = True
    ws.row_dimensions[7].hidden = True

    ws.column_dimensions["A"].width = 15
    ws.column_dimensions["B"].width = 32
    ws.column_dimensions["D"].width = 20
    ws.column_dimensions["E"].width = 22
    ws.column_dimensions["F"].width = 20

    wb.save(output_path)


def create_workbook_3_multisheet_cross_ref(output_path: Path):
    wb = openpyxl.Workbook()

    # Sheet 1: Revenue
    ws_rev = wb.active
    ws_rev.title = "Revenue_Detail"
    ws_rev.append(["Segment", "Q1", "Q2", "Q3", "Q4", "Full_Year"])
    ws_rev.append(["Enterprise", 85000, 92000, 99000, 108000, "=SUM(B2:E2)"])
    ws_rev.append(["Mid-Market", 34000, 36500, 39000, 42000, "=SUM(B3:E3)"])
    ws_rev.append(["SMB", 18000, 19200, 20100, 21500, "=SUM(B4:E4)"])
    ws_rev.append(["Total Revenue", "=SUM(B2:B4)", "=SUM(C2:C4)", "=SUM(D2:D4)", "=SUM(E2:E4)", "=SUM(F2:F4)"])

    # Sheet 2: OPEX
    ws_opex = wb.create_sheet(title="Cost_Center")
    ws_opex.append(["Cost Center", "Q1", "Q2", "Q3", "Q4", "Full_Year"])
    ws_opex.append(["Engineering & Product", 42000, 44000, 47000, 50000, "=SUM(B2:E2)"])
    ws_opex.append(["Customer Success & Sales", 38000, 40000, 43000, 46000, "=SUM(B3:E3)"])
    ws_opex.append(["G&A and Compliance", 15000, 15500, 16000, 16800, "=SUM(B4:E4)"])
    ws_opex.append(["Total Expenses", "=SUM(B2:B4)", "=SUM(C2:C4)", "=SUM(D2:D4)", "=SUM(E2:E4)", "=SUM(F2:F4)"])

    # Sheet 3: Executive Summary (cross-referencing Sheet 1 & Sheet 2)
    ws_sum = wb.create_sheet(title="Executive_Summary")
    ws_sum.append(["KPI / Metric", "Q1", "Q2", "Q3", "Q4", "Full_Year"])
    ws_sum.append(["Gross Revenue", "=Revenue_Detail!B5", "=Revenue_Detail!C5", "=Revenue_Detail!D5", "=Revenue_Detail!E5", "=Revenue_Detail!F5"])
    ws_sum.append(["Total Operating Costs", "=Cost_Center!B5", "=Cost_Center!C5", "=Cost_Center!D5", "=Cost_Center!E5", "=Cost_Center!F5"])
    ws_sum.append(["Net Operating Margin", "=B2-B3", "=C2-C3", "=D2-D3", "=E2-E3", "=F2-F3"])
    ws_sum.append(["Operating Margin %", "=B4/B2", "=C4/C2", "=D4/D2", "=E4/E2", "=F4/F2"])

    wb.save(output_path)


def create_workbook_4_styled_financial_ratios(output_path: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Financial_Ratios"

    ws.append(["Metric Name", "Historical FY23", "Actual FY24", "Target FY25", "Variance %", "Status"])
    for col in range(1, 7):
        cell = ws.cell(row=1, column=col)
        cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="203764", end_color="203764", fill_type="solid")
        cell.alignment = Alignment(horizontal="center")

    rows = [
        ["Total Revenue ($M)", 125000000, 148500000, 175000000, "=(C2-B2)/B2", "On Track"],
        ["Gross Margin %", 0.725, 0.748, 0.760, "=(C3-B3)/B3", "Exceeded"],
        ["EBITDA Margin %", 0.182, 0.214, 0.235, "=(C4-B4)/B4", "On Track"],
        ["Current Ratio", 1.85, 2.12, 2.00, "=(C5-B5)/B5", "Healthy"],
        ["Debt-to-Equity Ratio", 0.65, 0.52, 0.45, "=(C6-B6)/B6", "De-leveraging"],
        ["Return on Equity (ROE)", 0.142, 0.168, 0.180, "=(C7-B7)/B7", "Strong"],
    ]

    for r_idx, r_data in enumerate(rows, start=2):
        ws.append(r_data)
        # Apply number formats
        if r_idx == 2:
            # Currency format
            ws[f"B{r_idx}"].number_format = "$#,##0"
            ws[f"C{r_idx}"].number_format = "$#,##0"
            ws[f"D{r_idx}"].number_format = "$#,##0"
        elif r_idx in [3, 4, 7]:
            # Percentage format
            ws[f"B{r_idx}"].number_format = "0.0%"
            ws[f"C{r_idx}"].number_format = "0.0%"
            ws[f"D{r_idx}"].number_format = "0.0%"
        else:
            # Decimal ratio format
            ws[f"B{r_idx}"].number_format = "0.00"
            ws[f"C{r_idx}"].number_format = "0.00"
            ws[f"D{r_idx}"].number_format = "0.00"

        ws[f"E{r_idx}"].number_format = "0.0%"

    ws.column_dimensions["A"].width = 28
    for c in ["B", "C", "D", "E", "F"]:
        ws.column_dimensions[c].width = 18

    wb.save(output_path)


def create_workbook_5_nontrivial_summary_kpis(output_path: Path):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "SaaS_Unit_Economics"

    # Header block 1: Growth Metrics
    ws["A1"] = "SECTION 1: ARR & COHORT VELOCITY"
    ws["A1"].font = Font(bold=True, size=11, color="1F4E78")
    ws.append(["Metric", "Jan Act", "Feb Act", "Mar Act", "Q1 Velocity"])
    for col in range(1, 5):
        ws.cell(row=2, column=col).font = Font(bold=True)

    ws.append(["Beginning ARR ($K)", 24000, 24650, 25400, 24000])
    ws.append(["New Logo ARR ($K)", 850, 920, 1100, "=SUM(B4:D4)"])
    ws.append(["Expansion ARR ($K)", 420, 480, 560, "=SUM(B5:D5)"])
    ws.append(["Churn & Contraction ($K)", -620, -650, -580, "=SUM(B6:D6)"])
    ws.append(["Ending ARR ($K)", "=B3+B4+B5+B6", "=C3+C4+C5+C6", "=D3+D4+D5+D6", "=D7"])

    # Empty spacer rows
    ws.append([])
    ws.append([])

    # Header block 2: Efficiency Ratios
    start_r = 10
    ws[f"A{start_r}"] = "SECTION 2: GO-TO-MARKET EFFICIENCY & CAC"
    ws[f"A{start_r}"].font = Font(bold=True, size=11, color="1F4E78")
    ws.append(["Ratio Name", "Benchmark", "Current Performance", "Target Variance"])
    ws.append(["Magic Number", 0.75, 1.15, "=C11-B11"])
    ws.append(["CAC Payback (Months)", 18.0, 13.5, "=B12-C12"])
    ws.append(["LTV / CAC Ratio", 3.0, 4.6, "=C13/B13"])
    ws.append(["Rule of 40 (Growth + FCF %)", 0.40, 0.48, "=C14-B14"])

    # Disconnected footnotes at row 20
    ws["A20"] = "FOOTNOTE 1: Net Retention Rate (NRR) is calculated excluding contracted commitments under trial."
    ws["A20"].font = Font(italic=True, size=9, color="595959")
    ws["A21"] = "FOOTNOTE 2: Free Cash Flow (FCF) margin includes capital lease amortization under IFRS 16."
    ws["A21"].font = Font(italic=True, size=9, color="595959")

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 22
    ws.column_dimensions["D"].width = 18

    wb.save(output_path)


if __name__ == "__main__":
    out_dir = Path("tests/workbooks")
    out_dir.mkdir(parents=True, exist_ok=True)
    create_workbook_1_merged_headers(out_dir / "wb1_merged_headers_pnl.xlsx")
    create_workbook_2_hidden_rows_cols(out_dir / "wb2_hidden_rows_cols.xlsx")
    create_workbook_3_multisheet_cross_ref(out_dir / "wb3_multisheet_cross_ref.xlsx")
    create_workbook_4_styled_financial_ratios(out_dir / "wb4_styled_financial_ratios.xlsx")
    create_workbook_5_nontrivial_summary_kpis(out_dir / "wb5_nontrivial_summary_kpis.xlsx")
    print("Generated 5 realistic workbooks in tests/workbooks/")

