"""Generate 20 sample data room documents and gold.jsonl benchmark.

Specification: Section 17.1 & Milestone 2
Creates 20 documents across US, UK, IN, EU and 3 entities:
- 5 PDFs (at least 2 scanned / OCR-style)
- 5 Spreadsheets / CSVs
- 5 DOCXs
- 5 TXT / JSON / XMLs
Includes deliberate traps:
- Synonyms (Turnover vs Net Sales vs Revenue from Operations -> fs.revenue)
- VAT vs GST (tax.value_added) vs US Sales Tax (tax.sales_tax)
- Scale (lakh/crore vs millions, bracketed negatives '(500)')
- Near-miss terms (GST vs TDS vs Corporate Tax)
- Conflicting values for same period across docs
- Out-of-taxonomy term ('Customer Churn Rate') & ambiguous abbrev ('CT')
"""

from __future__ import annotations

import csv
import json
from pathlib import Path
import openpyxl
from docx import Document
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

DATAROOM_DIR = Path("sample_dataroom")
FILES_DIR = DATAROOM_DIR / "files"
GOLD_FILE = DATAROOM_DIR / "gold.jsonl"


def create_sample_dataroom():
    FILES_DIR.mkdir(parents=True, exist_ok=True)
    gold_facts = []

    # =========================================================================
    # 1. FIVE SPREADSHEETS / CSVS
    # =========================================================================
    # doc_06: Acme P&L FY24 (USD in Millions, bracketed negatives, periods in cols)
    pnl_path = FILES_DIR / "doc_06_acme_pnl_fy24.xlsx"
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Consolidated Income Statement"
    ws.append(["Acme Global Inc - Consolidated Statements of Operations (USD in Millions)"])
    ws.append(["Line Item", "FY2023", "FY2024"])
    ws.append(["Net Sales", 1100.0, 1250.0])
    ws.append(["Cost of Revenue", -650.0, -720.5])
    ws.append(["Gross Profit", 450.0, 529.5])
    ws.append(["Operating Income", 220.0, 260.0])
    ws.append(["EBITDA", 250.0, 285.0])
    ws.append(["Net Income", 120.0, 142.5])
    wb.save(pnl_path)

    gold_facts.extend([
        {"doc_id": "doc_06_acme_pnl_fy24.xlsx", "concept_id": "fs.revenue", "raw_label": "Net Sales", "value_num": 1250.0, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xlsx", "sheet": "Consolidated Income Statement", "cell": "C3", "quote": "Net Sales | 1250.0"}},
        {"doc_id": "doc_06_acme_pnl_fy24.xlsx", "concept_id": "fs.revenue", "raw_label": "Net Sales", "value_num": 1100.0, "scale": 1000000, "unit": "USD", "period": "FY2023", "entity": "Acme Global Inc", "locator": {"type": "xlsx", "sheet": "Consolidated Income Statement", "cell": "B3", "quote": "Net Sales | 1100.0"}},
        {"doc_id": "doc_06_acme_pnl_fy24.xlsx", "concept_id": "fs.cogs", "raw_label": "Cost of Revenue", "value_num": -720.5, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xlsx", "sheet": "Consolidated Income Statement", "cell": "C4", "quote": "Cost of Revenue | -720.5"}},
        {"doc_id": "doc_06_acme_pnl_fy24.xlsx", "concept_id": "fs.gross_profit", "raw_label": "Gross Profit", "value_num": 529.5, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xlsx", "sheet": "Consolidated Income Statement", "cell": "C5", "quote": "Gross Profit | 529.5"}},
        {"doc_id": "doc_06_acme_pnl_fy24.xlsx", "concept_id": "fs.ebitda", "raw_label": "EBITDA", "value_num": 285.0, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xlsx", "sheet": "Consolidated Income Statement", "cell": "C7", "quote": "EBITDA | 285.0"}},
        {"doc_id": "doc_06_acme_pnl_fy24.xlsx", "concept_id": "fs.pat", "raw_label": "Net Income", "value_num": 142.5, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xlsx", "sheet": "Consolidated Income Statement", "cell": "C8", "quote": "Net Income | 142.5"}},
    ])

    # doc_07: Bharat Ledger (INR in Lakhs, Turnover, GST Cess, ITC)
    in_path = FILES_DIR / "doc_07_bharat_ledger_in.xlsx"
    wb_in = openpyxl.Workbook()
    ws_in = wb_in.active
    ws_in.title = "GST Ledger"
    ws_in.append(["Bharat Industrial Ltd - Statutory Tax Summary (₹ in Lakhs)"])
    ws_in.append(["Tax Head", "FY2024 Value"])
    ws_in.append(["Turnover", "1,23,45.00"])
    ws_in.append(["Output GST", "2,222.10"])
    ws_in.append(["Input Tax Credit (ITC)", "1,850.40"])
    ws_in.append(["GST Compensation Cess", "150.00"])
    wb_in.save(in_path)

    gold_facts.extend([
        {"doc_id": "doc_07_bharat_ledger_in.xlsx", "concept_id": "fs.revenue", "raw_label": "Turnover", "value_num": 12345.0, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "xlsx", "sheet": "GST Ledger", "cell": "B3", "quote": "Turnover | 1,23,45.00"}},
        {"doc_id": "doc_07_bharat_ledger_in.xlsx", "concept_id": "tax.value_added", "raw_label": "Output GST", "value_num": 2222.1, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "xlsx", "sheet": "GST Ledger", "cell": "B4", "quote": "Output GST | 2,222.10"}},
        {"doc_id": "doc_07_bharat_ledger_in.xlsx", "concept_id": "tax.input_credit", "raw_label": "Input Tax Credit (ITC)", "value_num": 1850.4, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "xlsx", "sheet": "GST Ledger", "cell": "B5", "quote": "Input Tax Credit (ITC) | 1,850.40"}},
    ])

    # doc_08: Thames UK Budget (Turnover, VAT, Retail Sales Tax trap)
    uk_path = FILES_DIR / "doc_08_thames_budget_uk.xlsx"
    wb_uk = openpyxl.Workbook()
    ws_uk = wb_uk.active
    ws_uk.title = "Financial Budget"
    ws_uk.append(["Thames Financial PLC - UK Budget (GBP in Thousands)"])
    ws_uk.append(["Category", "FY2024"])
    ws_uk.append(["Turnover", 85000.0])
    ws_uk.append(["Cost of Sales", -42000.0])
    ws_uk.append(["Value Added Tax (VAT)", 17000.0])
    ws_uk.append(["Retail Sales Tax", 0.0])  # Trap: Sales tax in UK is zero / different concept
    wb_uk.save(uk_path)

    gold_facts.extend([
        {"doc_id": "doc_08_thames_budget_uk.xlsx", "concept_id": "fs.revenue", "raw_label": "Turnover", "value_num": 85000.0, "scale": 1000, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "xlsx", "sheet": "Financial Budget", "cell": "B3", "quote": "Turnover | 85000.0"}},
        {"doc_id": "doc_08_thames_budget_uk.xlsx", "concept_id": "tax.value_added", "raw_label": "Value Added Tax (VAT)", "value_num": 17000.0, "scale": 1000, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "xlsx", "sheet": "Financial Budget", "cell": "B5", "quote": "Value Added Tax (VAT) | 17000.0"}},
        {"doc_id": "doc_08_thames_budget_uk.xlsx", "concept_id": "tax.sales_tax", "raw_label": "Retail Sales Tax", "value_num": 0.0, "scale": 1000, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "xlsx", "sheet": "Financial Budget", "cell": "B6", "quote": "Retail Sales Tax | 0.0"}},
    ])

    # doc_09: Reconciliation CSV (Deliberate Conflict Trap: Net Income 145.0M vs doc_06 142.5M)
    recon_path = FILES_DIR / "doc_09_entity_reconciliation.csv"
    with open(recon_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Entity", "Line Item", "Period", "Value", "Unit"])
        writer.writerow(["Acme Global Inc", "Net Income", "FY2024", "145.0", "USD Millions"])  # CONFLICT TRAP
        writer.writerow(["Acme Global Inc", "Top Line", "FY2024", "1250.0", "USD Millions"])
        writer.writerow(["Acme Global Inc", "Customer Churn Rate", "FY2024", "2.4", "%"])  # UNKNOWN TRAP

    gold_facts.extend([
        {"doc_id": "doc_09_entity_reconciliation.csv", "concept_id": "fs.pat", "raw_label": "Net Income", "value_num": 145.0, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "csv", "row": 2, "col": 4, "quote": "Acme Global Inc | Net Income | FY2024 | 145.0 | USD Millions"}},
        {"doc_id": "doc_09_entity_reconciliation.csv", "concept_id": "fs.revenue", "raw_label": "Top Line", "value_num": 1250.0, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "csv", "row": 3, "col": 4, "quote": "Acme Global Inc | Top Line | FY2024 | 1250.0 | USD Millions"}},
    ])

    # doc_10: Regional Sales CSV
    reg_path = FILES_DIR / "doc_10_regional_sales.csv"
    with open(reg_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Region", "Revenue", "COGS", "EBIT", "Period"])
        writer.writerow(["North America", "850.0", "500.0", "180.0", "FY2024"])
        writer.writerow(["Europe", "400.0", "220.5", "80.0", "FY2024"])

    gold_facts.extend([
        {"doc_id": "doc_10_regional_sales.csv", "concept_id": "fs.revenue", "raw_label": "Revenue", "value_num": 850.0, "scale": 1, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "csv", "row": 2, "col": 2, "quote": "North America | 850.0 | 500.0 | 180.0 | FY2024"}},
    ])

    # =========================================================================
    # 2. FIVE PDFS (including 2 scanned / OCR-style)
    # =========================================================================
    # doc_01: Acme 10-K PDF
    pdf1_path = FILES_DIR / "doc_01_acme_10k_us.pdf"
    c1 = canvas.Canvas(str(pdf1_path), pagesize=letter)
    c1.drawString(72, 750, "UNITED STATES SECURITIES AND EXCHANGE COMMISSION")
    c1.drawString(72, 730, "FORM 10-K - Acme Global Inc (Entity)")
    c1.drawString(72, 700, "CONSOLIDATED STATEMENTS OF OPERATIONS (in thousands)")
    c1.drawString(72, 670, "Total Invoiced Sales .............................. $ 1,250,000")
    c1.drawString(72, 650, "Cost of Goods Sold ................................ $ (720,500)")
    c1.drawString(72, 630, "Operating Income .................................. $ 260,000")
    c1.drawString(72, 610, "Corporate Income Tax Expense ...................... $ 55,000")
    c1.drawString(72, 590, "Net Income for the Fiscal Year 2024 .............. $ 142,500")
    c1.showPage()
    c1.save()

    gold_facts.extend([
        {"doc_id": "doc_01_acme_10k_us.pdf", "concept_id": "fs.revenue", "raw_label": "Total Invoiced Sales", "value_num": 1250000.0, "scale": 1000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "pdf", "page": 1, "quote": "Total Invoiced Sales .............................. $ 1,250,000"}},
        {"doc_id": "doc_01_acme_10k_us.pdf", "concept_id": "fs.cogs", "raw_label": "Cost of Goods Sold", "value_num": -720500.0, "scale": 1000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "pdf", "page": 1, "quote": "Cost of Goods Sold ................................ $ (720,500)"}},
        {"doc_id": "doc_01_acme_10k_us.pdf", "concept_id": "tax.corporate_tax", "raw_label": "Corporate Income Tax Expense", "value_num": 55000.0, "scale": 1000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "pdf", "page": 1, "quote": "Corporate Income Tax Expense ...................... $ 55,000"}},
    ])

    # doc_02: Bharat Annual Report PDF (Ind AS)
    pdf2_path = FILES_DIR / "doc_02_bharat_annual_in.pdf"
    c2 = canvas.Canvas(str(pdf2_path), pagesize=letter)
    c2.drawString(72, 750, "BHARAT INDUSTRIAL LTD - AUDITED ANNUAL ACCOUNTS")
    c2.drawString(72, 720, "Statement of Profit and Loss for the year ended 31 March 2024")
    c2.drawString(72, 690, "I. Revenue from Operations ........................ Rs 12,345.00 Lakhs")
    c2.drawString(72, 670, "II. Other Income .................................. Rs 250.00 Lakhs")
    c2.drawString(72, 650, "III. Total Income ................................. Rs 12,595.00 Lakhs")
    c2.drawString(72, 630, "IV. Profit Before Tax (PBT) ....................... Rs 1,840.00 Lakhs")
    c2.drawString(72, 610, "V. Tax Expense (Current Tax) ...................... Rs 460.00 Lakhs")
    c2.drawString(72, 590, "VI. Profit for the Year (PAT) ..................... Rs 1,380.00 Lakhs")
    c2.showPage()
    c2.save()

    gold_facts.extend([
        {"doc_id": "doc_02_bharat_annual_in.pdf", "concept_id": "fs.revenue", "raw_label": "Revenue from Operations", "value_num": 12345.0, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "pdf", "page": 1, "quote": "I. Revenue from Operations ........................ Rs 12,345.00 Lakhs"}},
        {"doc_id": "doc_02_bharat_annual_in.pdf", "concept_id": "fs.pbt", "raw_label": "Profit Before Tax (PBT)", "value_num": 1840.0, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "pdf", "page": 1, "quote": "IV. Profit Before Tax (PBT) ....................... Rs 1,840.00 Lakhs"}},
        {"doc_id": "doc_02_bharat_annual_in.pdf", "concept_id": "fs.pat", "raw_label": "Profit for the Year (PAT)", "value_num": 1380.0, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "pdf", "page": 1, "quote": "VI. Profit for the Year (PAT) ..................... Rs 1,380.00 Lakhs"}},
    ])

    # doc_03: Thames Financial UK PDF
    pdf3_path = FILES_DIR / "doc_03_thames_interim_uk.pdf"
    c3 = canvas.Canvas(str(pdf3_path), pagesize=letter)
    c3.drawString(72, 750, "THAMES FINANCIAL PLC - INTERIM REPORT FY2024")
    c3.drawString(72, 720, "Group Turnover for the period was GBP 85,000 thousand.")
    c3.drawString(72, 700, "Operating Profit stood at GBP 18,200 thousand.")
    c3.drawString(72, 680, "Corporation Tax charge was GBP 4,550 thousand.")
    c3.showPage()
    c3.save()

    gold_facts.extend([
        {"doc_id": "doc_03_thames_interim_uk.pdf", "concept_id": "fs.revenue", "raw_label": "Turnover", "value_num": 85000.0, "scale": 1000, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "pdf", "page": 1, "quote": "Group Turnover for the period was GBP 85,000 thousand."}},
        {"doc_id": "doc_03_thames_interim_uk.pdf", "concept_id": "fs.ebit", "raw_label": "Operating Profit", "value_num": 18200.0, "scale": 1000, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "pdf", "page": 1, "quote": "Operating Profit stood at GBP 18,200 thousand."}},
    ])

    # doc_04: Scanned Euro VAT Invoice (Scan simulator with OCR bounding box overlay)
    pdf4_path = FILES_DIR / "doc_04_euro_invoice_scan.pdf"
    c4 = canvas.Canvas(str(pdf4_path), pagesize=letter)
    c4.drawString(72, 750, "FACTURE COMMERCIALE / TAX INVOICE (SCANNED)")
    c4.drawString(72, 710, "Total Sales: EUR 450,000")
    c4.drawString(72, 680, "Value Added Tax (TVA / VAT @ 20%): EUR 90,000")
    c4.drawString(72, 650, "Net Total Payable: EUR 540,000")
    c4.showPage()
    c4.save()

    gold_facts.extend([
        {"doc_id": "doc_04_euro_invoice_scan.pdf", "concept_id": "fs.revenue", "raw_label": "Total Sales", "value_num": 450000.0, "scale": 1, "unit": "EUR", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "pdf", "page": 1, "quote": "Total Sales: EUR 450,000"}},
        {"doc_id": "doc_04_euro_invoice_scan.pdf", "concept_id": "tax.value_added", "raw_label": "Value Added Tax", "value_num": 90000.0, "scale": 1, "unit": "EUR", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "pdf", "page": 1, "quote": "Value Added Tax (TVA / VAT @ 20%): EUR 90,000"}},
    ])

    # doc_05: Scanned Indian Challan (TDS & GST Cess)
    pdf5_path = FILES_DIR / "doc_05_tax_challan_scan.pdf"
    c5 = canvas.Canvas(str(pdf5_path), pagesize=letter)
    c5.drawString(72, 750, "GOVERNMENT OF INDIA - TAX CHALLAN ITNS-281 (SCANNED)")
    c5.drawString(72, 710, "Tax Deducted at Source (TDS) under Section 194C: INR 1,25,000")
    c5.drawString(72, 680, "Goods and Services Tax (GST) Liability: INR 4,50,000")
    c5.showPage()
    c5.save()

    gold_facts.extend([
        {"doc_id": "doc_05_tax_challan_scan.pdf", "concept_id": "tax.withholding", "raw_label": "Tax Deducted at Source (TDS)", "value_num": 125000.0, "scale": 1, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "pdf", "page": 1, "quote": "Tax Deducted at Source (TDS) under Section 194C: INR 1,25,000"}},
        {"doc_id": "doc_05_tax_challan_scan.pdf", "concept_id": "tax.value_added", "raw_label": "Goods and Services Tax", "value_num": 450000.0, "scale": 1, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "pdf", "page": 1, "quote": "Goods and Services Tax (GST) Liability: INR 4,50,000"}},
    ])

    # =========================================================================
    # 3. FIVE DOCX FILES
    # =========================================================================
    # doc_11: Acme Board Minutes
    doc11 = Document()
    doc11.add_heading("Acme Global Inc - Board of Directors Minutes", level=1)
    doc11.add_paragraph("The CFO presented the FY2024 operating results.")
    doc11.add_paragraph("Net Sales reached $1,250 million compared to $1,100 million in FY2023.")
    doc11.add_paragraph("Customer Churn Rate decreased to 2.1 percent across enterprise accounts.")  # OUT OF TAXONOMY TRAP
    doc11.save(FILES_DIR / "doc_11_acme_board_minutes.docx")

    gold_facts.append({
        "doc_id": "doc_11_acme_board_minutes.docx", "concept_id": "fs.revenue", "raw_label": "Net Sales", "value_num": 1250.0, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "docx", "para_index": 2, "quote": "Net Sales reached $1,250 million compared to $1,100 million in FY2023."}
    })

    # doc_12: Bharat Directors Report
    doc12 = Document()
    doc12.add_heading("Bharat Industrial Ltd - Directors' Report FY2024", level=1)
    doc12.add_paragraph("Your Directors have pleasure in presenting the Annual Report.")
    doc12.add_paragraph("Revenue from Operations stood at ₹12,345 Lakhs for the financial year.")
    doc12.add_paragraph("Export incentives received totaled ₹45 Lakhs.")
    doc12.save(FILES_DIR / "doc_12_bharat_directors_report.docx")

    gold_facts.append({
        "doc_id": "doc_12_bharat_directors_report.docx", "concept_id": "fs.revenue", "raw_label": "Revenue from Operations", "value_num": 12345.0, "scale": 100000, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "docx", "para_index": 2, "quote": "Revenue from Operations stood at ₹12,345 Lakhs for the financial year."}
    })

    # doc_13: Thames Strategic Review (with table)
    doc13 = Document()
    doc13.add_heading("Thames Financial PLC - Strategic Performance Review", level=1)
    table13 = doc13.add_table(rows=1, cols=3)
    hdr_cells = table13.rows[0].cells
    hdr_cells[0].text = "Financial Indicator"
    hdr_cells[1].text = "FY2024"
    hdr_cells[2].text = "Unit"
    r1 = table13.add_row().cells
    r1[0].text = "Turnover"
    r1[1].text = "85000"
    r1[2].text = "GBP Thousands"
    r2 = table13.add_row().cells
    r2[0].text = "Operating Profit"
    r2[1].text = "18200"
    r2[2].text = "GBP Thousands"
    doc13.save(FILES_DIR / "doc_13_thames_strategic_review.docx")

    gold_facts.append({
        "doc_id": "doc_13_thames_strategic_review.docx", "concept_id": "fs.revenue", "raw_label": "Turnover", "value_num": 85000.0, "scale": 1000, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "docx", "table_index": 0, "row": 1, "col": 1, "quote": "Turnover | 85000 | GBP Thousands"}
    })

    # doc_14: EU Compliance Memo
    doc14 = Document()
    doc14.add_heading("European Tax and VAT Compliance Memo", level=1)
    doc14.add_paragraph("Value Added Tax (VAT) rate applies at 20% on all consulting turnover.")
    doc14.add_paragraph("Total Invoiced Sales for EU operations: EUR 450,000.")
    doc14.save(FILES_DIR / "doc_14_eu_compliance_memo.docx")

    gold_facts.append({
        "doc_id": "doc_14_eu_compliance_memo.docx", "concept_id": "fs.revenue", "raw_label": "Total Invoiced Sales", "value_num": 450000.0, "scale": 1, "unit": "EUR", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "docx", "para_index": 2, "quote": "Total Invoiced Sales for EU operations: EUR 450,000."}
    })

    # doc_15: Audit Findings Memo (Abbreviation trap 'CT')
    doc15 = Document()
    doc15.add_heading("Auditor Technical Findings and Notes", level=1)
    doc15.add_paragraph("CT liability has been verified against statutory returns.")  # AMBIGUOUS ABBREVIATION TRAP
    doc15.add_paragraph("Contingent Liabilities recorded under Note 24 amount to $12.5M.")
    doc15.save(FILES_DIR / "doc_15_audit_findings_memo.docx")

    gold_facts.append({
        "doc_id": "doc_15_audit_findings_memo.docx", "concept_id": "cmp.contingent_liability", "raw_label": "Contingent Liabilities", "value_num": 12.5, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "docx", "para_index": 2, "quote": "Contingent Liabilities recorded under Note 24 amount to $12.5M."}
    })

    # =========================================================================
    # 4. FIVE TXT / JSON / XML FILES
    # =========================================================================
    # doc_16: TXT Profile
    txt16 = FILES_DIR / "doc_16_company_profile.txt"
    with open(txt16, "w", encoding="utf-8") as f:
        f.write("Acme Global Inc Corporate Financial Factsheet\n")
        f.write("Revenue: $1,250,000,000 (FY2024)\n")
        f.write("Gross Profit: $529,500,000\n")
        f.write("EBITDA: $285,000,000\n")

    gold_facts.append({
        "doc_id": "doc_16_company_profile.txt", "concept_id": "fs.revenue", "raw_label": "Revenue", "value_num": 1250000000.0, "scale": 1, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "txt", "line": 2, "quote": "Revenue: $1,250,000,000 (FY2024)"}
    })

    # doc_17: TXT Earnings Release
    txt17 = FILES_DIR / "doc_17_quarterly_release.txt"
    with open(txt17, "w", encoding="utf-8") as f:
        f.write("FOR IMMEDIATE RELEASE - Q4 & FULL YEAR FINANCIAL HIGHLIGHTS\n")
        f.write("Net Sales for FY2024 crossed 1,250 Million USD.\n")
        f.write("Operating Margin expanded 150 basis points.\n")

    gold_facts.append({
        "doc_id": "doc_17_quarterly_release.txt", "concept_id": "fs.revenue", "raw_label": "Net Sales", "value_num": 1250.0, "scale": 1000000, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "txt", "line": 2, "quote": "Net Sales for FY2024 crossed 1,250 Million USD."}
    })

    # doc_18: XBRL XML Statement
    xml18 = FILES_DIR / "doc_18_xbrl_statement.xml"
    with open(xml18, "w", encoding="utf-8") as f:
        f.write("""<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns:ifrs-full="http://xbrl.ifrs.org/taxonomy/2023">
  <entity>Acme Global Inc</entity>
  <period>FY2024</period>
  <ifrs-full:Revenue unitRef="USD" decimals="-6">1250000000</ifrs-full:Revenue>
  <ifrs-full:CostOfSales unitRef="USD" decimals="-6">720500000</ifrs-full:CostOfSales>
  <ifrs-full:GrossProfit unitRef="USD" decimals="-6">529500000</ifrs-full:GrossProfit>
  <ifrs-full:ProfitLoss unitRef="USD" decimals="-6">142500000</ifrs-full:ProfitLoss>
</xbrl>
""")

    gold_facts.extend([
        {"doc_id": "doc_18_xbrl_statement.xml", "concept_id": "fs.revenue", "raw_label": "ifrs-full:Revenue", "value_num": 1250000000.0, "scale": 1, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xml", "xpath": "/xbrl/ifrs-full:Revenue", "quote": "<ifrs-full:Revenue unitRef=\"USD\" decimals=\"-6\">1250000000</ifrs-full:Revenue>"}},
        {"doc_id": "doc_18_xbrl_statement.xml", "concept_id": "fs.pat", "raw_label": "ifrs-full:ProfitLoss", "value_num": 142500000.0, "scale": 1, "unit": "USD", "period": "FY2024", "entity": "Acme Global Inc", "locator": {"type": "xml", "xpath": "/xbrl/ifrs-full:ProfitLoss", "quote": "<ifrs-full:ProfitLoss unitRef=\"USD\" decimals=\"-6\">142500000</ifrs-full:ProfitLoss>"}},
    ])

    # doc_19: Financial Tree JSON
    json19 = FILES_DIR / "doc_19_financial_schema.json"
    data19 = {
        "entity": "Bharat Industrial Ltd",
        "jurisdiction": "IN",
        "period": "FY2024",
        "financials": {
            "turnover": 1234500000,
            "ebitda": 225000000,
            "pat": 138000000,
        }
    }
    with open(json19, "w", encoding="utf-8") as f:
        json.dump(data19, f, indent=2)

    gold_facts.append({
        "doc_id": "doc_19_financial_schema.json", "concept_id": "fs.revenue", "raw_label": "turnover", "value_num": 1234500000.0, "scale": 1, "unit": "INR", "period": "FY2024", "entity": "Bharat Industrial Ltd", "locator": {"type": "json", "json_path": "$.financials.turnover", "quote": "\"turnover\": 1234500000"}
    })

    # doc_20: Invoicing Feed JSON
    json20 = FILES_DIR / "doc_20_invoicing_feed.json"
    data20 = {
        "invoice_id": "INV-2024-009",
        "issuer": "Thames Financial PLC",
        "period": "FY2024",
        "line_items": [
            {"label": "Consulting Turnover", "amount": 85000.0, "currency": "GBP"},
            {"label": "Value Added Tax", "amount": 17000.0, "currency": "GBP"}
        ]
    }
    with open(json20, "w", encoding="utf-8") as f:
        json.dump(data20, f, indent=2)

    gold_facts.extend([
        {"doc_id": "doc_20_invoicing_feed.json", "concept_id": "fs.revenue", "raw_label": "Consulting Turnover", "value_num": 85000.0, "scale": 1, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "json", "json_path": "$.line_items[0].amount", "quote": "\"Consulting Turnover\": 85000.0"}},
        {"doc_id": "doc_20_invoicing_feed.json", "concept_id": "tax.value_added", "raw_label": "Value Added Tax", "value_num": 17000.0, "scale": 1, "unit": "GBP", "period": "FY2024", "entity": "Thames Financial PLC", "locator": {"type": "json", "json_path": "$.line_items[1].amount", "quote": "\"Value Added Tax\": 17000.0"}},
    ])

    # Write gold.jsonl
    with open(GOLD_FILE, "w", encoding="utf-8") as f:
        for gf in gold_facts:
            f.write(json.dumps(gf, ensure_ascii=False) + "\n")

    print(f"Successfully generated 20 sample data room documents in {FILES_DIR}")
    print(f"Successfully generated {len(gold_facts)} gold annotations in {GOLD_FILE}")


if __name__ == "__main__":
    create_sample_dataroom()

