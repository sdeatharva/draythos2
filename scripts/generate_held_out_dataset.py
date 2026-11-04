"""
Generate Held-Out Financial QA Benchmark Dataset and SEC disclosure fixtures.
Produces:
- tests/fixtures/form_10k_annual_filing_fy24.txt
- tests/fixtures/q4_earnings_call_transcript.txt
- tests/held_out_benchmark/held_out_test_cases.json (175 held-out test cases)
"""

import json
from pathlib import Path

FIXTURES_DIR = Path("tests/fixtures")
BENCHMARK_DIR = Path("tests/held_out_benchmark")
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
BENCHMARK_DIR.mkdir(parents=True, exist_ok=True)

# 1. Generate SEC Form 10-K Filing for FY24
FORM_10K_CONTENT = """UNITED STATES SECURITIES AND EXCHANGE COMMISSION
WASHINGTON, D.C. 20549
FORM 10-K
ANNUAL REPORT PURSUANT TO SECTION 13 OR 15(d) OF THE SECURITIES EXCHANGE ACT OF 1934
FOR THE FISCAL YEAR ENDED DECEMBER 31, 2024
COMMISSION FILE NUMBER: 001-39482
DRAYTHOS TECHNOLOGIES HOLDINGS INC.

PART I. ITEM 1. BUSINESS
Draythos Technologies Holdings Inc. ("Draythos", the "Company", "we", "us", or "our") is a leading provider of intelligent document engineering and cognitive financial systems. 

ITEM 1A. RISK FACTORS
- High dependence on cloud infrastructure providers (AWS, Google Cloud) creates operational risk.
- Foreign exchange currency volatility in EMEA and APAC could adversely impact consolidated net revenue.
- Our senior secured credit facility imposes a maximum net leverage ratio covenant of 3.25x trailing twelve-month Adjusted EBITDA.

PART II. ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS OF FINANCIAL CONDITION AND RESULTS OF OPERATIONS
Fiscal Year 2024 Highlights:
Total consolidated revenue for the year ended December 31, 2024 ("FY24") was $842.6 million, an increase of 18.4% compared to $711.5 million for the year ended December 31, 2023 ("FY23").
North America revenue was $512.4 million in FY24 (representing 60.8% of total revenue) compared to $435.0 million in FY23.
EMEA revenue was $215.2 million in FY24 compared to $186.5 million in FY23.
APAC revenue was $115.0 million in FY24 compared to $90.0 million in FY23.

ITEM 8. CONSOLIDATED FINANCIAL STATEMENTS
CONSOLIDATED STATEMENTS OF OPERATIONS
(In thousands of USD, except per share amounts)
                                                 Year Ended Dec 31, 2024    Year Ended Dec 31, 2023
Revenue:
  Subscription & SaaS revenue                             $ 695,400                  $ 582,300
  Professional services & deployment                        147,200                    129,200
Total Revenue                                             $ 842,600                  $ 711,500

Cost of Revenue:
  Cost of subscription revenue (hosting, compute)           139,080                    122,280
  Cost of professional services                              88,320                     81,400
Total Cost of Revenue                                       227,400                    203,680

Gross Profit                                              $ 615,200                  $ 507,820
Gross Margin Percentage                                       73.0%                      71.4%

Operating Expenses:
  Research and development (R&D)                            218,500                    185,000
  Sales and marketing (S&M)                                 202,200                    178,000
  General and administrative (G&A)                           74,500                     68,200
  Restructuring & facility consolidation                      8,400                          -
Total Operating Expenses                                    503,600                    431,200

Operating Income (GAAP)                                   $ 111,600                  $  76,620
Operating Margin (GAAP)                                       13.2%                      10.8%

Other Income / (Expense):
  Interest expense, net                                     (14,200)                   (16,800)
  Other non-operating income                                  3,100                      1,500
Total Other Expense, net                                    (11,100)                   (15,300)

Income Before Income Taxes                                $ 100,500                  $  61,320
Provision for income taxes (effective rate 21.5%)            21,600                     13,180

Net Income (GAAP)                                         $  78,900                  $  48,140
Net Margin (GAAP)                                              9.4%                       6.8%

NON-GAAP RECONCILIATION: ADJUSTED EBITDA
(In thousands of USD)
                                                 Year Ended Dec 31, 2024    Year Ended Dec 31, 2023
GAAP Net Income                                           $  78,900                  $  48,140
Add back:
  Provision for income taxes                                 21,600                     13,180
  Interest expense, net                                      14,200                     16,800
  Depreciation and amortization                              38,400                     34,200
EBITDA                                                    $ 153,100                  $ 112,320
Adjustments:
  Stock-based compensation expense (SBC)                     42,800                     36,500
  Restructuring & severance charges                           8,400                          -
  Litigation settlement contingency                           4,500                          -
Non-GAAP Adjusted EBITDA                                  $ 208,800                  $ 148,820
Adjusted EBITDA Margin                                        24.8%                      20.9%

NOTE 7. LONG-TERM DEBT AND LIQUIDITY
As of December 31, 2024, our total outstanding debt under the Senior Credit Facility was $325.0 million with an effective floating interest rate of SOFR + 2.75% (blended rate 7.82%).
Cash and cash equivalents totaled $184.2 million as of December 31, 2024, yielding Net Debt of $140.8 million.
Net Debt to Adjusted EBITDA leverage ratio stood at 0.67x as of December 31, 2024, well below the covenant threshold of 3.25x.

NOTE 12. CONTINGENCIES AND COMMITMENTS
Future minimum contractual obligations under non-cancelable cloud hosting agreements:
2025: $45.0 million; 2026: $50.0 million; 2027: $55.0 million; thereafter: $20.0 million.
"""

# 2. Generate Q4 Earnings Call Transcript
EARNINGS_CALL_CONTENT = """DRAYTHOS TECHNOLOGIES HOLDINGS INC.
FOURTH QUARTER AND FULL YEAR 2024 EARNINGS CONFERENCE CALL
JANUARY 28, 2025

PARTICIPANTS:
Marcus Vance - Chief Executive Officer
Elena Rostova - Chief Financial Officer
David Cho - VP of Investor Relations
Sarah Jenkins - Goldman Sachs (Analyst)
Michael Thorne - Morgan Stanley (Analyst)

Elena Rostova - CFO:
Thank you, David, and good afternoon, everyone.
FY24 was an exceptional year for Draythos. Full-year revenue grew 18.4% year-over-year to $842.6 million.
Fourth quarter FY24 revenue alone was $231.4 million, beating the top end of our guidance range by $4.2 million.
Q4 GAAP operating income came in at $34.2 million, and Non-GAAP Adjusted EBITDA for Q4 reached $61.5 million.
Turning to capital expenditures, full-year FY24 CapEx was $29.4 million, primarily directed toward GPU cluster expansion and private cluster hosting pods.
Free cash flow for the full year FY24 was $141.0 million, representing a 16.7% free cash flow margin.

Now turning to FY25 Guidance:
For full year 2025, we expect consolidated revenue to be in the range of $985.0 million to $1,005.0 million, representing year-over-year growth of 17% to 19%.
We expect FY25 Non-GAAP Adjusted EBITDA between $255.0 million and $265.0 million.
We anticipate FY25 Capital Expenditures of approximately $38.0 million to $42.0 million as we expand our EMEA data sovereign nodes.
Effective tax rate for FY25 is projected at 22.0%.

ANALYST QUESTION & ANSWER:
Sarah Jenkins (Goldman Sachs):
Thanks for taking my question. Elena, regarding the $8.4 million restructuring charge in Q4, can you clarify if any further facility consolidation charges will carry into FY25?
Elena Rostova - CFO:
Sarah, the $8.4 million recognized in Q4 completes our North American real estate optimization. We do not anticipate any further facility impairment or restructuring charges in FY25.

Michael Thorne (Morgan Stanley):
Marcus, could you elaborate on customer net retention rates?
Marcus Vance - CEO:
Our dollar-based net expansion rate across enterprise customers ended the year at 122%, compared to 118% in FY23, driven by rapid multi-product adoption.
"""

(FIXTURES_DIR / "form_10k_annual_filing_fy24.txt").write_text(FORM_10K_CONTENT, encoding="utf-8")
(FIXTURES_DIR / "q4_earnings_call_transcript.txt").write_text(EARNINGS_CALL_CONTENT, encoding="utf-8")
print("Wrote SEC Form 10-K and Earnings Call fixtures.")

# 3. Generate 175 Held-Out Questions
# Categories:
# 1. Exact lookups (25)
# 2. Multi-hop calculations (25)
# 3. Reporting-period ambiguity (25)
# 4. Units & scaling (20)
# 5. Conflicting sources (20)
# 6. Formula interpretation (20)
# 7. Missing evidence / unanswerable abstentions (25)
# 8. Statutory / hard negatives (15)

cases = []
cid = 1

# Category 1: Exact lookups (25)
exact_lookups = [
    ("What was Draythos's total consolidated revenue in FY24 according to the 10-K?", "842,600", "$842.6 million or $842,600 thousand", ["842,600", "Total Revenue"]),
    ("What was the GAAP Gross Margin percentage for FY24?", "73.0%", "73.0%", ["73.0%", "Gross Margin Percentage"]),
    ("What was the GAAP Gross Profit in FY23?", "507,820", "$507,820 thousand", ["507,820", "Gross Profit"]),
    ("What was the Research and Development (R&D) expense in FY24?", "218,500", "$218,500 thousand", ["218,500", "Research and development"]),
    ("What was the Sales and Marketing (S&M) expense in FY23?", "178,000", "$178,000 thousand", ["178,000", "Sales and marketing"]),
    ("How much did Draythos spend on restructuring in FY24?", "8,400", "$8,400 thousand ($8.4 million)", ["8,400", "Restructuring"]),
    ("What was Draythos's GAAP Net Income for the year ended December 31, 2024?", "78,900", "$78,900 thousand", ["78,900", "Net Income (GAAP)"]),
    ("What was the Non-GAAP Adjusted EBITDA for FY24?", "208,800", "$208,800 thousand ($208.8 million)", ["208,800", "Non-GAAP Adjusted EBITDA"]),
    ("How much stock-based compensation (SBC) was added back in FY24 Adjusted EBITDA?", "42,800", "$42,800 thousand", ["42,800", "Stock-based compensation"]),
    ("What was the net debt-to-Adjusted EBITDA leverage ratio covenant limit under the credit facility?", "3.25x", "3.25x", ["3.25x", "covenant"]),
    ("What was the actual net debt to Adjusted EBITDA leverage ratio as of December 31, 2024?", "0.67x", "0.67x", ["0.67x", "leverage ratio"]),
    ("What was the total outstanding debt under the Senior Credit Facility at year-end 2024?", "325.0", "$325.0 million", ["325.0", "Senior Credit Facility"]),
    ("What was the cash and cash equivalents balance at December 31, 2024?", "184.2", "$184.2 million", ["184.2", "Cash and cash equivalents"]),
    ("What was North America revenue in FY24 in millions?", "512.4", "$512.4 million", ["512.4", "North America revenue"]),
    ("What was EMEA revenue in FY23 in millions?", "186.5", "$186.5 million", ["186.5", "EMEA revenue"]),
    ("What was APAC revenue in FY24 in millions?", "115.0", "$115.0 million", ["115.0", "APAC revenue"]),
    ("What was fourth quarter FY24 revenue reported on the earnings call?", "231.4", "$231.4 million", ["231.4", "Fourth quarter FY24 revenue"]),
    ("By how much did Q4 FY24 revenue beat the top end of guidance?", "4.2", "$4.2 million", ["4.2", "beating the top end"]),
    ("What was full-year FY24 Free Cash Flow reported on the earnings call?", "141.0", "$141.0 million", ["141.0", "Free cash flow"]),
    ("What was the full-year FY24 CapEx spend?", "29.4", "$29.4 million", ["29.4", "CapEx was $29.4 million"]),
    ("What is the projected revenue range for FY25 provided in guidance?", "985.0 to 1,005.0", "$985.0 million to $1,005.0 million", ["985.0", "1,005.0", "FY25 Guidance"]),
    ("What was the enterprise dollar-based net expansion rate at year-end FY24?", "122%", "122%", ["122%", "dollar-based net expansion rate"]),
    ("What is the contractual cloud hosting commitment for the year 2025?", "45.0", "$45.0 million", ["45.0", "cloud hosting agreements"]),
    ("What is the contractual cloud hosting commitment for the year 2026?", "50.0", "$50.0 million", ["50.0", "2026"]),
    ("Who is the Chief Executive Officer of Draythos?", "Marcus Vance", "Marcus Vance", ["Marcus Vance", "Chief Executive Officer"]),
]
for q, ans, gold, keys in exact_lookups:
    cases.append({
        "id": f"held_out_exact_{cid:03d}",
        "category": "exact_lookup",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": False,
        "units": "Mixed",
    })
    cid += 1

# Category 2: Multi-hop calculations across sheets and SEC filings (25)
multihop = [
    ("What was the year-over-year dollar growth in Non-GAAP Adjusted EBITDA from FY23 to FY24?", "59,980", "$59,980 thousand ($208,800 - $148,820)", ["208,800", "148,820", "Adjusted EBITDA"]),
    ("What was the difference between GAAP Operating Income and Non-GAAP Adjusted EBITDA in FY24?", "97,200", "$97,200 thousand ($208,800 - $111,600)", ["208,800", "111,600", "Operating Income"]),
    ("Calculate the percentage contribution of North America to total FY24 revenue.", "60.8%", "60.8% ($512.4M / $842.6M)", ["512.4", "842.6", "North America"]),
    ("Calculate the percentage contribution of EMEA to total FY24 revenue.", "25.5%", "25.5% ($215.2M / $842.6M)", ["215.2", "842.6", "EMEA revenue"]),
    ("Calculate the percentage contribution of APAC to total FY24 revenue.", "13.6%", "13.6% ($115.0M / $842.6M)", ["115.0", "842.6", "APAC revenue"]),
    ("What is the sum of total contractual cloud hosting commitments from 2025 through 2027?", "150.0", "$150.0 million ($45M + $50M + $55M)", ["45.0", "50.0", "55.0", "commitments"]),
    ("What was the year-over-year increase in Research and Development (R&D) expense from FY23 to FY24?", "33,500", "$33,500 thousand ($218,500 - $185,000)", ["218,500", "185,000", "R&D"]),
    ("What was the Net Debt at December 31, 2024 calculated as Total Debt minus Cash and Equivalents?", "140.8", "$140.8 million ($325.0M - $184.2M)", ["325.0", "184.2", "Net Debt"]),
    ("How much did GAAP Net Income increase in FY24 compared to FY23 in thousands of dollars?", "30,760", "$30,760 thousand ($78,900 - $48,140)", ["78,900", "48,140", "Net Income"]),
    ("What was the total Non-GAAP add-backs to EBITDA (SBC + Restructuring + Litigation) in FY24?", "55,700", "$55,700 thousand ($42,800 + $8,400 + $4,500)", ["42,800", "8,400", "4,500"]),
    ("By how many basis points did the GAAP Gross Margin expand from FY23 to FY24?", "160", "160 bps (73.0% - 71.4% = 1.6% or 160 bps)", ["73.0%", "71.4%", "Gross Margin"]),
    ("By how many basis points did the GAAP Operating Margin expand from FY23 to FY24?", "240", "240 bps (13.2% - 10.8% = 2.4% or 240 bps)", ["13.2%", "10.8%", "Operating Margin"]),
    ("What was the total Cost of Revenue increase from FY23 to FY24 in thousands of dollars?", "23,720", "$23,720 thousand ($227,400 - $203,680)", ["227,400", "203,680", "Cost of Revenue"]),
    ("Calculate the difference between FY24 Free Cash Flow and FY24 GAAP Net Income in millions.", "62.1", "$62.1 million ($141.0M - $78.9M)", ["141.0", "78,900", "Free cash flow"]),
    ("What is the midpoint of the FY25 revenue guidance range?", "995.0", "$995.0 million (($985.0M + $1,005.0M) / 2)", ["985.0", "1,005.0", "FY25 Guidance"]),
    ("What is the midpoint of the FY25 Non-GAAP Adjusted EBITDA guidance range?", "260.0", "$260.0 million (($255.0M + $265.0M) / 2)", ["255.0", "265.0", "Adjusted EBITDA"]),
    ("What is the midpoint of the FY25 CapEx guidance range?", "40.0", "$40.0 million (($38.0M + $42.0M) / 2)", ["38.0", "42.0", "CapEx"]),
    ("Calculate the projected dollar growth at the midpoint of FY25 revenue over FY24 actual revenue.", "152.4", "$152.4 million ($995.0M - $842.6M)", ["995.0", "842.6", "FY25 Guidance"]),
    ("Calculate the difference between FY24 EBITDA ($153,100K) and FY24 Operating Income ($111,600K).", "41,500", "$41,500 thousand ($153,100 - $111,600)", ["153,100", "111,600"]),
    ("What was the expansion in enterprise dollar-based net expansion rate from FY23 to FY24?", "4%", "4 percentage points (122% - 118%)", ["122%", "118%", "net expansion rate"]),
    ("Calculate the total Operating Expenses excluding Restructuring for FY24.", "495,200", "$495,200 thousand ($503,600 - $8,400)", ["503,600", "8,400", "Operating Expenses"]),
    ("What was the ratio of FY24 R&D expense to total revenue?", "25.9%", "25.9% ($218,500 / $842,600)", ["218,500", "842,600", "R&D"]),
    ("What was the ratio of FY24 S&M expense to total revenue?", "24.0%", "24.0% ($202,200 / $842,600)", ["202,200", "842,600", "Sales and marketing"]),
    ("What was the ratio of FY24 G&A expense to total revenue?", "8.8%", "8.8% ($74,500 / $842,600)", ["74,500", "842,600", "General and administrative"]),
    ("What was the total Non-GAAP Adjusted EBITDA expansion in margin percentage from FY23 to FY24?", "3.9%", "3.9% (24.8% - 20.9%)", ["24.8%", "20.9%", "Adjusted EBITDA Margin"]),
]
for q, ans, gold, keys in multihop:
    cases.append({
        "id": f"held_out_multihop_{cid:03d}",
        "category": "multihop_calculation",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": False,
        "units": "Mixed",
    })
    cid += 1

# Category 3: Reporting-period ambiguity (25)
periods = [
    ("What was revenue in Q4?", "231.4", "Disambiguation required: Q4 FY24 revenue was $231.4 million", ["231.4", "Fourth quarter"]),
    ("What was total revenue?", "842,600", "Disambiguation required: FY24 was $842.6M ($842,600K); FY23 was $711.5M ($711,500K)", ["842,600", "711,500", "Total Revenue"]),
    ("What was Net Income?", "78,900", "Disambiguation required: FY24 Net Income was $78,900K; FY23 was $48,140K", ["78,900", "48,140", "Net Income"]),
    ("What was Gross Margin?", "73.0%", "Disambiguation required: FY24 was 73.0%; FY23 was 71.4%", ["73.0%", "71.4%", "Gross Margin"]),
    ("What was Operating Income?", "111,600", "Disambiguation required: FY24 was $111,600K; FY23 was $76,620K; Q4 FY24 was $34.2M", ["111,600", "76,620", "34.2"]),
    ("What was Adjusted EBITDA?", "208,800", "Disambiguation required: FY24 was $208,800K; FY23 was $148,820K; Q4 FY24 was $61.5M", ["208,800", "148,820", "61.5"]),
    ("What was R&D expense?", "218,500", "Disambiguation required: FY24 was $218,500K; FY23 was $185,000K", ["218,500", "185,000", "Research and development"]),
    ("What was S&M expense?", "202,200", "Disambiguation required: FY24 was $202,200K; FY23 was $178,000K", ["202,200", "178,000", "Sales and marketing"]),
    ("What was G&A expense?", "74,500", "Disambiguation required: FY24 was $74,500K; FY23 was $68,200K", ["74,500", "68,200", "General and administrative"]),
    ("What was the effective tax rate?", "21.5%", "Disambiguation required: FY24 actual was 21.5%; FY25 guidance is 22.0%", ["21.5%", "22.0%", "tax rate"]),
    ("What was CapEx?", "29.4", "Disambiguation required: FY24 actual was $29.4M; FY25 projected is $38.0M to $42.0M", ["29.4", "38.0", "42.0", "CapEx"]),
    ("What was the net retention rate?", "122%", "Disambiguation required: FY24 was 122%; FY23 was 118%", ["122%", "118%", "net expansion rate"]),
    ("What was North America revenue?", "512.4", "Disambiguation required: FY24 was $512.4M; FY23 was $435.0M", ["512.4", "435.0", "North America"]),
    ("What was EMEA revenue?", "215.2", "Disambiguation required: FY24 was $215.2M; FY23 was $186.5M", ["215.2", "186.5", "EMEA revenue"]),
    ("What was APAC revenue?", "115.0", "Disambiguation required: FY24 was $115.0M; FY23 was $90.0M", ["115.0", "90.0", "APAC revenue"]),
    ("What was Subscription revenue?", "695,400", "Disambiguation required: FY24 was $695,400K; FY23 was $582,300K", ["695,400", "582,300", "Subscription"]),
    ("What was Professional Services revenue?", "147,200", "Disambiguation required: FY24 was $147,200K; FY23 was $129,200K", ["147,200", "129,200", "Professional services"]),
    ("What was interest expense?", "14,200", "Disambiguation required: FY24 was $14,200K; FY23 was $16,800K", ["14,200", "16,800", "Interest expense"]),
    ("What was stock-based compensation?", "42,800", "Disambiguation required: FY24 was $42,800K; FY23 was $36,500K", ["42,800", "36,500", "Stock-based compensation"]),
    ("What was Depreciation and Amortization?", "38,400", "Disambiguation required: FY24 was $38,400K; FY23 was $34,200K", ["38,400", "34,200", "Depreciation and amortization"]),
    ("What was EBITDA before non-GAAP adjustments?", "153,100", "Disambiguation required: FY24 was $153,100K; FY23 was $112,320K", ["153,100", "112,320", "EBITDA"]),
    ("What was the restructuring charge?", "8,400", "Disambiguation required: FY24 was $8,400K; FY23 was $0; FY25 expected is $0", ["8,400", "Restructuring"]),
    ("What was Free Cash Flow?", "141.0", "Disambiguation required: Full-year FY24 was $141.0M (16.7% margin)", ["141.0", "Free cash flow"]),
    ("What was Cost of Subscription revenue?", "139,080", "Disambiguation required: FY24 was $139,080K; FY23 was $122,280K", ["139,080", "122,280", "Cost of subscription"]),
    ("What was Cost of Professional Services?", "88,320", "Disambiguation required: FY24 was $88,320K; FY23 was $81,400K", ["88,320", "81,400", "Cost of professional services"]),
]
for q, ans, gold, keys in periods:
    cases.append({
        "id": f"held_out_period_{cid:03d}",
        "category": "period_ambiguity",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": True,
        "units": "Mixed",
    })
    cid += 1

# Category 4: Units and scaling (20)
units_scaling = [
    ("State Draythos FY24 revenue in millions of dollars.", "842.6", "$842.6 million", ["842,600", "842.6"]),
    ("State Draythos FY24 revenue in thousands of dollars.", "842,600", "$842,600 thousand", ["842,600"]),
    ("State Draythos FY24 GAAP Net Income in millions of dollars.", "78.9", "$78.9 million ($78,900 thousand)", ["78,900"]),
    ("State Draythos FY24 GAAP Net Income in thousands of dollars.", "78,900", "$78,900 thousand", ["78,900"]),
    ("State Draythos FY24 Non-GAAP Adjusted EBITDA in millions of dollars.", "208.8", "$208.8 million ($208,800 thousand)", ["208,800"]),
    ("State Draythos FY24 Non-GAAP Adjusted EBITDA in thousands of dollars.", "208,800", "$208,800 thousand", ["208,800"]),
    ("What is the FY24 Gross Margin expressed as a basis point figure?", "7300", "7,300 bps (73.0% * 100)", ["73.0%"]),
    ("What is the FY24 Operating Margin expressed as a basis point figure?", "1320", "1,320 bps (13.2% * 100)", ["13.2%"]),
    ("What is the FY24 Net Margin expressed as a percentage?", "9.4%", "9.4%", ["9.4%"]),
    ("What is the FY24 Adjusted EBITDA Margin expressed as a percentage?", "24.8%", "24.8%", ["24.8%"]),
    ("Convert the FY24 restructuring charge of $8,400 thousand into millions of dollars.", "8.4", "$8.4 million", ["8,400"]),
    ("Convert the FY24 stock-based compensation of $42,800 thousand into millions of dollars.", "42.8", "$42.8 million", ["42,800"]),
    ("Convert the FY24 depreciation expense of $38,400 thousand into millions of dollars.", "38.4", "$38.4 million", ["38,400"]),
    ("What was FY24 CapEx in thousands of dollars?", "29,400", "$29,400 thousand ($29.4 million)", ["29.4"]),
    ("What was FY24 Free Cash Flow in thousands of dollars?", "141,000", "$141,000 thousand ($141.0 million)", ["141.0"]),
    ("State the total outstanding debt under the Senior Credit Facility in thousands of dollars.", "325,000", "$325,000 thousand ($325.0 million)", ["325.0"]),
    ("State the cash and cash equivalents balance at year-end 2024 in thousands of dollars.", "184,200", "$184,200 thousand ($184.2 million)", ["184.2"]),
    ("What was the FY24 Net Debt expressed in thousands of dollars?", "140,800", "$140,800 thousand ($140.8 million)", ["140.8"]),
    ("Express the FY25 expected effective tax rate as a decimal.", "0.22", "0.22 (22.0%)", ["22.0%"]),
    ("Express the FY24 effective tax rate as a decimal.", "0.215", "0.215 (21.5%)", ["21.5%"]),
]
for q, ans, gold, keys in units_scaling:
    cases.append({
        "id": f"held_out_units_{cid:03d}",
        "category": "units_and_scaling",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": False,
        "units": "Explicit",
    })
    cid += 1

# Category 5: Conflicting sources / GAAP vs Non-GAAP (20)
conflicts = [
    ("What was Draythos's operating profit for FY24 under GAAP versus Non-GAAP Adjusted EBITDA?", "111,600 vs 208,800", "GAAP Operating Income was $111,600 thousand; Non-GAAP Adjusted EBITDA was $208,800 thousand", ["111,600", "208,800"]),
    ("Compare Draythos's Net Income under GAAP with its Non-GAAP Adjusted EBITDA for FY24.", "78,900 vs 208,800", "GAAP Net Income was $78,900 thousand; Non-GAAP Adjusted EBITDA was $208,800 thousand", ["78,900", "208,800"]),
    ("Does GAAP Operating Income include stock-based compensation and restructuring?", "Yes", "Yes, GAAP operating expenses include $42.8M SBC and $8.4M restructuring; Non-GAAP Adjusted EBITDA adds them back", ["42,800", "8,400", "Operating Expenses"]),
    ("What is the difference between Q4 FY24 revenue announced on the call and full-year FY24 revenue in the 10-K?", "231.4 vs 842.6", "Q4 FY24 was $231.4 million; full year FY24 was $842.6 million", ["231.4", "842.6"]),
    ("What was the GAAP effective tax rate in FY24 versus the projected FY25 tax rate on the earnings call?", "21.5% vs 22.0%", "FY24 was 21.5%; FY25 guidance is 22.0%", ["21.5%", "22.0%"]),
    ("How does FY24 CapEx on the call relate to the PP&E depreciation in the 10-K?", "29.4 vs 38.4", "FY24 CapEx was $29.4 million, whereas FY24 Depreciation & Amortization was $38.4 million", ["29.4", "38,400"]),
    ("What was GAAP operating margin versus Non-GAAP Adjusted EBITDA margin for FY24?", "13.2% vs 24.8%", "GAAP Operating Margin was 13.2%; Adjusted EBITDA Margin was 24.8%", ["13.2%", "24.8%"]),
    ("What was GAAP net margin versus Free Cash Flow margin for FY24?", "9.4% vs 16.7%", "GAAP Net Margin was 9.4%; Free Cash Flow margin was 16.7%", ["9.4%", "16.7%"]),
    ("Does Draythos expect further restructuring expenses in FY25 according to management remarks?", "No", "No, Elena Rostova confirmed the $8.4M in Q4 completed real estate optimization with none in FY25", ["Elena Rostova", "restructuring", "FY25"]),
    ("How does FY24 revenue growth compare between North America and consolidated total?", "17.8% vs 18.4%", "North America grew from $435.0M to $512.4M (17.8%); total revenue grew 18.4%", ["512.4", "435.0", "18.4%"]),
    ("What was APAC revenue growth percentage from FY23 to FY24?", "27.8%", "27.8% ($90.0M to $115.0M)", ["115.0", "90.0"]),
    ("What was EMEA revenue growth percentage from FY23 to FY24?", "15.4%", "15.4% ($186.5M to $215.2M)", ["215.2", "186.5"]),
    ("What interest rate does the credit facility carry versus the blended effective rate?", "SOFR + 2.75% vs 7.82%", "Floating rate is SOFR + 2.75%, resulting in a blended rate of 7.82%", ["SOFR + 2.75%", "7.82%"]),
    ("Compare Net Debt under the senior facility with Cash and Cash Equivalents.", "140.8 vs 184.2", "Net Debt is $140.8 million; Cash is $184.2 million; Gross Debt is $325.0 million", ["140.8", "184.2", "325.0"]),
    ("What was the litigation settlement contingency added back to EBITDA in FY24?", "4,500", "$4,500 thousand", ["4,500", "Litigation settlement"]),
    ("What was the difference between FY23 GAAP Net Income and FY23 Non-GAAP Adjusted EBITDA?", "100,680", "$100,680 thousand ($148,820 - $48,140)", ["148,820", "48,140"]),
    ("What was the total provision for income taxes in FY24 under GAAP?", "21,600", "$21,600 thousand", ["21,600", "Provision for income taxes"]),
    ("Compare FY24 Cost of Subscription with Cost of Professional Services.", "139,080 vs 88,320", "Cost of Subscription was $139,080K; Cost of Professional Services was $88,320K", ["139,080", "88,320"]),
    ("What was the GAAP gross margin for Subscription revenue alone in FY24?", "80.0%", "80.0% (($695,400 - $139,080) / $695,400)", ["695,400", "139,080"]),
    ("What was the GAAP gross margin for Professional Services revenue alone in FY24?", "40.0%", "40.0% (($147,200 - $88,320) / $147,200)", ["147,200", "88,320"]),
]
for q, ans, gold, keys in conflicts:
    cases.append({
        "id": f"held_out_conflict_{cid:03d}",
        "category": "conflicting_sources",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": False,
        "units": "Mixed",
    })
    cid += 1

# Category 6: Formula interpretation & dependency paths in workbooks (20)
formulas = [
    ("In wb1_merged_headers_pnl.xlsx, what formula calculates Total Revenue in cell B6?", "=SUM(B4:B5)", "Formula sums Subscription Revenue (B4) and Services Revenue (B5)", ["wb1", "SUM(B4:B5)"]),
    ("In wb1_merged_headers_pnl.xlsx, what formula calculates Gross Profit in cell B9?", "=B6-B8", "Formula subtracts Cost of Goods Sold (B8) from Total Revenue (B6)", ["wb1", "B6-B8"]),
    ("In wb1_merged_headers_pnl.xlsx, what cells does Operating Income (B15) depend on?", "B9, B14", "Operating Income depends on Gross Profit (B9) and Total Operating Expenses (B14)", ["wb1", "B9", "B14"]),
    ("In wb2_hidden_rows_cols.xlsx, what is contained in the hidden Column C?", "Accumulated Depreciation", "Column C contains Accumulated Depreciation for fixed asset groups", ["wb2", "hidden", "Depreciation"]),
    ("In wb2_hidden_rows_cols.xlsx, what formula calculates Net PP&E in cell D5?", "=B5-C5", "Net PP&E equals Gross Book Value (B5) minus Accumulated Depreciation (C5)", ["wb2", "B5-C5"]),
    ("In wb3_multisheet_cross_ref.xlsx, how does the Executive_Summary sheet calculate Total Operating Income in cell C12?", "=Revenue_Detail!E10-Cost_Center!E18", "Cross-sheet reference linking Total Revenue minus Total Costs", ["wb3", "Revenue_Detail", "Cost_Center"]),
    ("In wb3_multisheet_cross_ref.xlsx, what sheet provides the source data for Professional Services cost?", "Cost_Center", "The Cost_Center worksheet contains detailed department costs", ["wb3", "Cost_Center"]),
    ("In wb3_multisheet_cross_ref.xlsx, what formula aggregates Q1 through Q4 revenue on the Revenue_Detail sheet?", "=SUM(B5:E5)", "Row sum across Q1, Q2, Q3, and Q4 columns", ["wb3", "SUM(B5:E5)"]),
    ("In wb4_styled_financial_ratios.xlsx, what formula evaluates the Current Ratio in cell B8?", "=B4/B5", "Current Assets (B4) divided by Current Liabilities (B5)", ["wb4", "B4/B5", "Current Ratio"]),
    ("In wb4_styled_financial_ratios.xlsx, what formula calculates the Debt to Equity ratio in cell B12?", "=B6/B7", "Total Debt (B6) divided by Shareholders' Equity (B7)", ["wb4", "B6/B7", "Debt to Equity"]),
    ("In wb4_styled_financial_ratios.xlsx, what number format is applied to Gross Margin in cell B15?", "0.0%", "Percentage format with one decimal place", ["wb4", "0.0%"]),
    ("In wb4_styled_financial_ratios.xlsx, what number format is applied to Total Revenue in cell B4?", "$#,##0", "Currency format with comma separators", ["wb4", "$#,##0"]),
    ("In wb5_nontrivial_summary_kpis.xlsx, what formula computes the blended customer churn rate in cell C14?", "=AVERAGE(C6:C12)", "Average of monthly cohort churn rates", ["wb5", "AVERAGE(C6:C12)"]),
    ("In wb5_nontrivial_summary_kpis.xlsx, what information is provided in the footnote at row 20?", "Excludes discontinued operations", "Footnote clarifies that KPI metrics exclude discontinued EMEA retail pilots", ["wb5", "footnote", "discontinued"]),
    ("In wb5_nontrivial_summary_kpis.xlsx, how are the two tables separated on the worksheet?", "Empty spacer rows", "Rows 15 through 17 are empty spacer rows separating Table 1 and Table 2", ["wb5", "spacer rows"]),
    ("If cell D5 has formula =SUM(D2:D4) and D2 is 61000, D3 is 18000, D4 is 9200, what is the evaluated value?", "88,200", "Evaluated sum: 61,000 + 18,000 + 9,200 = 88,200", ["88,200", "SUM(D2:D4)"]),
    ("If cell E2 has formula =SUM(B2:D2) and B2 is 55000, C2 is 52000, D2 is 61000, what is the evaluated value?", "168,000", "Evaluated sum: 55,000 + 52,000 + 61,000 = 168,000", ["168,000"]),
    ("If cell E3 has formula =SUM(B3:D3) and B3 is 12000, C3 is 15000, D3 is 18000, what is the evaluated value?", "45,000", "Evaluated sum: 12,000 + 15,000 + 18,000 = 45,000", ["45,000"]),
    ("If cell E4 has formula =SUM(B4:D4) and B4 is 8000, C4 is 8500, D4 is 9200, what is the evaluated value?", "25,700", "Evaluated sum: 8,000 + 8,500 + 9,200 = 25,700", ["25,700"]),
    ("If cell E5 has formula =SUM(E2:E4) with values 168000, 45000, 25700, what is the evaluated value?", "238,700", "Evaluated sum: 168,000 + 45,000 + 25,700 = 238,700", ["238,700"]),
]
for q, ans, gold, keys in formulas:
    cases.append({
        "id": f"held_out_formula_{cid:03d}",
        "category": "formula_interpretation",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": False,
        "units": "Mixed",
    })
    cid += 1

# Category 7: Missing evidence & unanswerable abstentions (25)
abstentions = [
    ("What was Draythos's total marketing spend in Japan in FY24?", "ABSTAIN", "The 10-K and earnings transcript do not disclose Japan-specific marketing expenses.", []),
    ("What is the name of Draythos's primary bank account manager at Silicon Valley Bank?", "ABSTAIN", "No bank account manager names are present in the disclosures.", []),
    ("How many patents were granted to Draythos by the European Patent Office in 2024?", "ABSTAIN", "The filing does not provide patent grant statistics.", []),
    ("What was the exact price per square foot paid for the consolidated facility in Q4?", "ABSTAIN", "The $8.4M restructuring charge is disclosed, but price per square foot is not provided.", []),
    ("What is the target acquisition price for Project Vulcan mentioned in internal memos?", "ABSTAIN", "Project Vulcan is not mentioned anywhere in the SEC disclosures.", []),
    ("What was the average tenure of Draythos software engineers in 2024?", "ABSTAIN", "Employee tenure metrics are omitted from the annual report.", []),
    ("What was Draythos's electricity consumption in kilowatt hours for data centers in 2024?", "ABSTAIN", "Utility consumption metrics are not included in the financial statements.", []),
    ("What discount rate was applied to customer multi-year contracts in Latin America?", "ABSTAIN", "No Latin America contract discount rates are disclosed.", []),
    ("What was the CEO Marcus Vance's personal bonus payout for FY24?", "ABSTAIN", "Executive compensation tables are deferred to the proxy statement and not in Form 10-K Item 8.", []),
    ("How many customer support tickets were resolved in EMEA during Q3 FY24?", "ABSTAIN", "Operational ticket metrics are not disclosed.", []),
    ("What is the projected revenue guidance for fiscal year 2028?", "ABSTAIN", "Guidance is only provided through fiscal year 2025.", []),
    ("What were the total legal expenses paid to external counsel Wachtell Lipton in 2024?", "ABSTAIN", "Specific law firm fee breakdowns are not disclosed.", []),
    ("What is the average CPU utilization percentage of Draythos's cloud clusters?", "ABSTAIN", "Technical cluster hardware telemetry is not disclosed.", []),
    ("What was the advertising cost on LinkedIn vs Google Search in FY24?", "ABSTAIN", "Channel-level advertising expenditures are not broken out.", []),
    ("How many shares of common stock did Elena Rostova sell in August 2024?", "ABSTAIN", "Insider Form 4 transactions are not provided in the 10-K financial statements.", []),
    ("What was the scrap salvage value of decommissioned servers in Q2 2024?", "ABSTAIN", "Salvage recovery figures are not disclosed.", []),
    ("What was the employee headcount in the Sydney office as of December 31, 2024?", "ABSTAIN", "City-level headcount is not disclosed.", []),
    ("What is Draythos's corporate jet lease expense for FY24?", "ABSTAIN", "No corporate jet expenses are mentioned in the documents.", []),
    ("What was the revenue generated specifically from federal government defense contracts in FY24?", "ABSTAIN", "Defense revenue is not broken out as a reporting segment.", []),
    ("What is the forecasted foreign exchange rate between EUR and USD assumed in FY25 guidance?", "ABSTAIN", "Specific macroeconomic FX model inputs are not disclosed.", []),
    ("What was the inventory shrinkage rate for physical hardware devices in 2024?", "ABSTAIN", "Draythos is a software/SaaS business without physical retail inventory shrinkage.", []),
    ("What was the total dollar refund issued to customers under SLA breaches in Q1 FY24?", "ABSTAIN", "SLA refund figures are not disclosed in the filings.", []),
    ("What was the cost of catering for the annual shareholder meeting in 2024?", "ABSTAIN", "Administrative meeting catering costs are omitted.", []),
    ("What is the interest coverage ratio covenant threshold under the 2026 revolving credit facility?", "ABSTAIN", "The filing specifies a net leverage covenant of 3.25x, not an interest coverage covenant.", []),
    ("What was the total volume of water recycled at corporate headquarters in FY24?", "ABSTAIN", "Environmental water metrics are not present in the financial report.", []),
]
for q, ans, gold, keys in abstentions:
    cases.append({
        "id": f"held_out_abstain_{cid:03d}",
        "category": "missing_evidence_abstention",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": True,
        "is_ambiguous": False,
        "units": "None",
    })
    cid += 1

# Category 8: Statutory mapping & hard negatives (15)
statutory = [
    ("Under Note 7, does the Senior Credit Facility floating interest rate use LIBOR or SOFR?", "SOFR", "The filing explicitly specifies SOFR + 2.75% (LIBOR is retired)", ["SOFR + 2.75%", "Senior Credit Facility"]),
    ("Under Note 12, what is the contractual commitment for cloud hosting in the year 2027?", "55.0", "$55.0 million", ["55.0", "2027"]),
    ("Under Note 12, what are total cloud commitments due thereafter following 2027?", "20.0", "$20.0 million", ["20.0", "thereafter"]),
    ("Under Note 7, what would cause an event of default regarding net leverage?", "Exceeding 3.25x", "Net leverage ratio exceeding 3.25x trailing twelve-month Adjusted EBITDA", ["3.25x", "covenant"]),
    ("Under Item 1A, what are the primary cloud infrastructure providers listed as an operational risk?", "AWS, Google Cloud", "Amazon Web Services (AWS) and Google Cloud", ["AWS", "Google Cloud", "Risk Factors"]),
    ("In the GAAP P&L, is interest expense categorized under Operating Expenses or Other Expense?", "Other Expense", "Interest expense is categorized under Other Income / (Expense), net, below Operating Income", ["Other Income / (Expense)", "Interest expense"]),
    ("In the Non-GAAP reconciliation, is litigation settlement contingency added back or deducted?", "Added back", "It is added back ($4,500 thousand add-back to EBITDA)", ["4,500", "Litigation settlement"]),
    ("In the Non-GAAP reconciliation, is interest expense added back or deducted from Net Income?", "Added back", "Interest expense of $14,200 thousand is added back to arrive at EBITDA", ["14,200", "Add back"]),
    ("In the Non-GAAP reconciliation, is the provision for income taxes added back or deducted from Net Income?", "Added back", "Tax provision of $21,600 thousand is added back to arrive at EBITDA", ["21,600", "Provision for income taxes"]),
    ("What was the non-operating other income recognized in FY24?", "3,100", "$3,100 thousand", ["3,100", "Other non-operating income"]),
    ("What was the non-operating other income recognized in FY23?", "1,500", "$1,500 thousand", ["1,500", "Other non-operating income"]),
    ("What was the effective tax rate in FY23 under GAAP?", "21.5%", "21.5% ($13,180 / $61,320)", ["13,180", "61,320"]),
    ("What was the Net Debt in FY24?", "140.8", "$140.8 million ($325.0M debt - $184.2M cash)", ["140.8", "Net Debt"]),
    ("Does Draythos report any discontinued operations in the FY24 Statement of Operations?", "No", "No discontinued operations line item is reported in the 10-K statement of operations", ["Statement of Operations", "Restructuring"]),
    ("What accounting framework governs the primary financial statements in Item 8?", "US GAAP", "United States Generally Accepted Accounting Principles (GAAP)", ["GAAP", "CONSOLIDATED STATEMENTS"]),
]
for q, ans, gold, keys in statutory:
    cases.append({
        "id": f"held_out_statutory_{cid:03d}",
        "category": "statutory_hard_negatives",
        "question": q,
        "expected_answer": ans,
        "gold_explanation": gold,
        "required_evidence_chunk_keys": keys,
        "is_abstention": False,
        "is_ambiguous": False,
        "units": "Mixed",
    })
    cid += 1

out_path = BENCHMARK_DIR / "held_out_test_cases.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump({"total_cases": len(cases), "cases": cases}, f, indent=2)

print(f"Successfully generated {len(cases)} held-out financial benchmark cases in {out_path}!")

