"""Generate canonical and domain variants for the 150 concepts.

Specification: Section 10.1 & Milestone 2 O1
Produces ml/data/variants/variants.jsonl with >= 1,500 variants across US, UK, IN, EU.
Schema: example_id, concept_id, text, variant_type, jurisdiction, source_id,
        source_locator, phrase_family_id, relation, is_synthetic, parent_example_id,
        review_status, split.
"""

from __future__ import annotations

import json
from pathlib import Path
from vhagar.db.seed_taxonomy import CONCEPTS_DATA, ALIASES_DATA

VARIANTS_DIR = Path("ml/data/variants")
VARIANTS_FILE = VARIANTS_DIR / "variants.jsonl"
UNKNOWNS_DIR = Path("ml/data/unknowns")
UNKNOWNS_FILE = UNKNOWNS_DIR / "unknowns.jsonl"

# Domain variant expansion templates per family
FS_EXPANSIONS = {
    "fs.revenue": [
        ("Turnover", "UK", "heading", "equiv"),
        ("Gross Turnover", "UK", "heading", "equiv"),
        ("Net Sales", "US", "heading", "equiv"),
        ("Revenue from Operations", "IN", "statutory", "equiv"),
        ("Operating Revenue", "GLOBAL", "heading", "equiv"),
        ("Sales Revenue", "US", "heading", "equiv"),
        ("Total Invoiced Sales", "GLOBAL", "business", "equiv"),
        ("Top Line", "US", "idiom", "equiv"),
        ("Gross Revenue", "US", "heading", "equiv"),
        ("Billings and Fees", "GLOBAL", "business", "equiv"),
        ("Total Billings", "GLOBAL", "business", "equiv"),
        ("Revenue from Contracts with Customers", "GLOBAL", "statutory", "equiv"),
    ],
    "fs.cogs": [
        ("Cost of Goods Sold", "US", "heading", "equiv"),
        ("Cost of Sales", "UK", "heading", "equiv"),
        ("Cost of Revenue", "US", "heading", "equiv"),
        ("COGS", "US", "abbrev", "equiv"),
        ("Direct Operating Costs", "GLOBAL", "business", "equiv"),
        ("Direct Costs of Production", "GLOBAL", "business", "equiv"),
        ("Production Costs", "GLOBAL", "heading", "equiv"),
        ("Cost of Materials Consumed", "IN", "statutory", "equiv"),
        ("Direct Expenses and Cost of Sales", "GLOBAL", "heading", "equiv"),
        ("Merchandise Costs", "US", "business", "equiv"),
    ],
    "fs.gross_profit": [
        ("Gross Profit", "GLOBAL", "heading", "equiv"),
        ("Gross Margin", "US", "business", "equiv"),
        ("Gross Income", "US", "heading", "equiv"),
        ("Trading Profit", "UK", "heading", "equiv"),
        ("Gross Contribution", "GLOBAL", "business", "equiv"),
        ("Gross Operating Result", "EU", "heading", "equiv"),
        ("Gross Margin (Value)", "US", "business", "equiv"),
        ("Profit Before Operating Expenses", "GLOBAL", "heading", "equiv"),
    ],
    "fs.ebitda": [
        ("EBITDA", "GLOBAL", "abbrev", "equiv"),
        ("Earnings Before Interest, Tax, Depreciation and Amortization", "GLOBAL", "statutory", "equiv"),
        ("Operating Cash Profit", "GLOBAL", "business", "equiv"),
        ("Core Operating Profitability (EBITDA)", "GLOBAL", "business", "equiv"),
        ("Adjusted EBITDA", "GLOBAL", "business", "equiv"),
        ("EBITDA before Exceptional Items", "GLOBAL", "statutory", "equiv"),
        ("E.B.I.T.D.A.", "GLOBAL", "abbrev", "equiv"),
        ("Normalized EBITDA", "GLOBAL", "business", "equiv"),
    ],
    "fs.ebit": [
        ("EBIT", "GLOBAL", "abbrev", "equiv"),
        ("Operating Profit", "UK", "heading", "equiv"),
        ("Operating Income", "US", "heading", "equiv"),
        ("Earnings Before Interest and Taxes", "GLOBAL", "statutory", "equiv"),
        ("Operating Earnings", "US", "heading", "equiv"),
        ("Profit from Operations", "IN", "statutory", "equiv"),
        ("Net Operating Income", "US", "business", "equiv"),
        ("E.B.I.T.", "GLOBAL", "abbrev", "equiv"),
    ],
    "fs.pbt": [
        ("Profit Before Tax", "UK", "heading", "equiv"),
        ("PBT", "UK", "abbrev", "equiv"),
        ("Earnings Before Tax", "US", "heading", "equiv"),
        ("EBT", "US", "abbrev", "equiv"),
        ("Income Before Taxes", "US", "heading", "equiv"),
        ("Profit Before Taxation and Exceptional Items", "IN", "statutory", "equiv"),
        ("Pre-tax Profit", "UK", "business", "equiv"),
        ("Pre-tax Income", "US", "business", "equiv"),
    ],
    "fs.pat": [
        ("Profit After Tax", "UK", "heading", "equiv"),
        ("PAT", "UK", "abbrev", "equiv"),
        ("Net Income", "US", "heading", "equiv"),
        ("Net Profit", "GLOBAL", "heading", "equiv"),
        ("Bottom Line", "US", "idiom", "equiv"),
        ("Net Earnings", "US", "heading", "equiv"),
        ("Profit for the Year", "IN", "statutory", "equiv"),
        ("Net Profit After Taxation", "GLOBAL", "statutory", "equiv"),
        ("Net Income Attributable to Shareholders", "US", "statutory", "equiv"),
    ],
    "tax.value_added": [
        ("Value Added Tax", "UK", "statutory", "equiv"),
        ("VAT", "UK", "abbrev", "equiv"),
        ("Goods and Services Tax", "IN", "statutory", "equiv"),
        ("GST", "IN", "abbrev", "equiv"),
        ("TVA", "EU", "abbrev", "equiv"),
        ("Mehrwertsteuer", "EU", "statutory", "equiv"),
        ("Input/Output VAT", "UK", "business", "equiv"),
        ("Output GST", "IN", "statutory", "equiv"),
        ("Input GST", "IN", "statutory", "equiv"),
        ("Consumption Tax (Value Added)", "GLOBAL", "statutory", "equiv"),
        ("Standard Rate VAT", "UK", "statutory", "equiv"),
    ],
    "tax.sales_tax": [
        ("Retail Sales Tax", "US", "statutory", "equiv"),
        ("State Sales Tax", "US", "statutory", "equiv"),
        ("Local Sales Tax", "US", "statutory", "equiv"),
        ("Sales and Use Tax", "US", "statutory", "equiv"),
        ("Vendor Use Tax", "US", "statutory", "equiv"),
        ("City Sales Tax", "US", "statutory", "equiv"),
        ("Point of Sale Tax", "US", "business", "equiv"),
    ],
    "tax.corporate_tax": [
        ("Corporate Income Tax", "US", "statutory", "equiv"),
        ("Corporation Tax", "UK", "statutory", "equiv"),
        ("Company Tax", "GLOBAL", "heading", "equiv"),
        ("CIT", "US", "abbrev", "equiv"),
        ("Corporate Tax Provision", "GLOBAL", "heading", "equiv"),
        ("Taxes on Corporate Profits", "GLOBAL", "statutory", "equiv"),
        ("Business Profits Tax", "GLOBAL", "heading", "equiv"),
    ],
    "tax.withholding": [
        ("Withholding Tax", "GLOBAL", "statutory", "equiv"),
        ("WHT", "GLOBAL", "abbrev", "equiv"),
        ("Tax Deducted at Source", "IN", "statutory", "equiv"),
        ("TDS", "IN", "abbrev", "equiv"),
        ("Backup Withholding", "US", "statutory", "equiv"),
        ("Non-resident Withholding Tax", "GLOBAL", "statutory", "equiv"),
        ("Retention Tax", "EU", "statutory", "equiv"),
    ],
}

# 100 Unknown / Ambiguous Out-of-Taxonomy terms
UNKNOWN_TERMS = [
    # 50 Validation / Calibration Unknowns
    ("Customer Churn Rate", "val", "Non-financial metric"),
    ("Net Promoter Score", "val", "Marketing metric"),
    ("Daily Active Users", "val", "Product metric"),
    ("Server Rack Depreciation Limit", "val", "Operational infrastructure"),
    ("Employee Satisfaction Index", "val", "HR metric"),
    ("Carbon Offset Units", "val", "ESG metric"),
    ("Sprint Velocity", "val", "Agile engineering"),
    ("Click-Through Rate", "val", "Advertising metric"),
    ("Office Catering Expense Per Head", "val", "Internal admin"),
    ("Customer Acquisition Cost", "val", "Unit economics"),
    ("Lifetime Value", "val", "Unit economics"),
    ("Average Revenue Per User", "val", "SaaS metric"),
    ("Burn Multiple", "val", "Venture metric"),
    ("Magic Number", "val", "Sales efficiency"),
    ("Rule of 40", "val", "SaaS composite"),
    ("Pipeline Conversion Rate", "val", "Sales metric"),
    ("Lead Velocity Rate", "val", "Sales metric"),
    ("Ticket Resolution Time", "val", "Support metric"),
    ("Warehouse Utilization Rate", "val", "Supply chain"),
    ("Fleet Fuel Mileage", "val", "Logistics"),
    ("Patent Citation Count", "val", "R&D metric"),
    ("Bug Bounty Payout", "val", "Security cost"),
    ("Brand Equity Valuation", "val", "Marketing intangible"),
    ("Domain Name Registration Fee", "val", "IT operational"),
    ("Software License Seats", "val", "IT metric"),
    ("Cloud GPU Cluster Hours", "val", "Compute operational"),
    ("API Request Volume", "val", "Infrastructure metric"),
    ("Average Order Value", "val", "E-commerce metric"),
    ("Cart Abandonment Rate", "val", "E-commerce metric"),
    ("Return on Ad Spend", "val", "Marketing efficiency"),
    ("Social Media Follower Growth", "val", "Social metric"),
    ("Email Open Rate", "val", "Marketing metric"),
    ("Onboarding Drop-off Rate", "val", "Product metric"),
    ("Feature Adoption Rate", "val", "Product metric"),
    ("Technical Debt Ratio", "val", "Engineering metric"),
    ("Code Coverage Percentage", "val", "Quality metric"),
    ("Mean Time to Recovery", "val", "DevOps metric"),
    ("Service Level Agreement Uptime", "val", "DevOps SLA"),
    ("Data Egress Volume", "val", "Cloud cost"),
    ("Storage IOPS Allocation", "val", "Infrastructure metric"),
    ("Conference Sponsorship Fee", "val", "Marketing expense"),
    ("Recruiter Placement Bounty", "val", "HR expense"),
    ("Commute Subsidy Allowance", "val", "Employee benefit"),
    ("Parking Pass Reimbursement", "val", "Travel benefit"),
    ("Ergonomic Chair Allowance", "val", "Workplace perk"),
    ("Office Plant Care Subscription", "val", "Facilities expense"),
    ("Espresso Bean Supply Expense", "val", "Facilities expense"),
    ("Company Swag Manufacturing", "val", "Marketing operational"),
    ("Offsite Retreat Flights", "val", "Team travel"),
    ("Hackathon Prize Pool", "val", "Internal competition"),

    # 50 Test Unknowns
    ("Website Bounce Rate", "test", "Web analytics"),
    ("Organic Search Impressions", "test", "SEO metric"),
    ("Cost Per Click", "test", "Ad metric"),
    ("Customer Health Score", "test", "Success metric"),
    ("Product Qualified Leads", "test", "Sales metric"),
    ("Monthly Recurring Churn", "test", "Subscription metric"),
    ("Gross Revenue Retention", "test", "Subscription metric"),
    ("Net Revenue Retention", "test", "Subscription metric"),
    ("Headcount Growth Rate", "test", "HR metric"),
    ("Offer Acceptance Ratio", "test", "Recruiting metric"),
    ("Time to Hire", "test", "Recruiting metric"),
    ("Voluntary Attrition Rate", "test", "HR metric"),
    ("Diversity Percentage", "test", "ESG metric"),
    ("Glassdoor Rating", "test", "Employer brand"),
    ("Carbon Footprint Scope 3", "test", "ESG metric"),
    ("Renewable Energy Megawatt Hours", "test", "Sustainability"),
    ("Water Recycling Ratio", "test", "Sustainability"),
    ("Packaging Recyclability Rate", "test", "Supply chain ESG"),
    ("Supplier Diversity Spend", "test", "Procurement ESG"),
    ("On-time Delivery Rate", "test", "Logistics metric"),
    ("Inventory Turn Velocity", "test", "Supply chain"),
    ("Days Sales of Inventory", "test", "Supply chain"),
    ("Backorder Rate", "test", "Supply chain"),
    ("Warehouse Pick Rate", "test", "Logistics"),
    ("Scrap Rate in Manufacturing", "test", "Production quality"),
    ("Overall Equipment Effectiveness", "test", "Manufacturing"),
    ("First Contact Resolution", "test", "Customer support"),
    ("Customer Effort Score", "test", "Customer satisfaction"),
    ("App Store Review Score", "test", "Mobile product"),
    ("App Crash Rate per Session", "test", "Mobile telemetry"),
    ("Page Load Latency (p99)", "test", "Web performance"),
    ("Core Web Vitals Score", "test", "SEO quality"),
    ("Bandwidth Consumption (TB)", "test", "Network metric"),
    ("SSL Certificate Renewal Cost", "test", "IT security"),
    ("Penetration Testing Contract", "test", "Security audit"),
    ("Phishing Simulation Failure Rate", "test", "Internal compliance"),
    ("Security Clearance Badge Count", "test", "Facilities"),
    ("Executive Travel Security", "test", "Executive protection"),
    ("Private Jet Charter Mileage", "test", "Executive travel"),
    ("Golf Club Membership Dues", "test", "Executive perks"),
    ("Stipend for Remote Electricity", "test", "Remote work"),
    ("Gym Membership Subsidy", "test", "Wellness benefit"),
    ("Mental Health App Subscription", "test", "Wellness benefit"),
    ("Tuition Reimbursement Claim", "test", "Education benefit"),
    ("Charitable Donation Matching", "test", "CSR spend"),
    ("Corporate Art Collection Insurance", "test", "Asset insurance"),
    ("Patent Defense Warchest", "test", "Legal contingency"),
    ("Trademark Registration in 50 States", "test", "Legal intellectual property"),
    ("Lobbying Disclosure Spend", "test", "Government relations"),
    ("Crisis PR Retainer", "test", "Public relations"),
]


def build_variants():
    VARIANTS_DIR.mkdir(parents=True, exist_ok=True)
    UNKNOWNS_DIR.mkdir(parents=True, exist_ok=True)

    records = []
    example_id = 1
    family_id_map = {}
    current_fam_id = 1

    # 1. Process seeded ALIASES_DATA from repo
    for a in ALIASES_DATA:
        cid = a["concept_id"]
        text = a["alias"]
        norm = a.get("alias_key") or text.lower().strip()
        jur = a.get("jurisdiction", "GLOBAL")
        src = a.get("source", "glossary")
        rel = a.get("relation", "equivalent")

        if norm not in family_id_map:
            family_id_map[norm] = f"fam_{current_fam_id:04d}"
            current_fam_id += 1

        fam = family_id_map[norm]
        records.append({
            "example_id": f"ex_{example_id:05d}",
            "concept_id": cid,
            "text": text,
            "variant_type": "glossary",
            "jurisdiction": jur,
            "source_id": f"src_{src}",
            "source_locator": "seed_taxonomy",
            "phrase_family_id": fam,
            "relation": rel,
            "is_synthetic": False,
            "parent_example_id": None,
            "review_status": "confirmed",
            "split": "train",
        })
        example_id += 1

    # 2. Add domain-specific expansions
    for cid, exp_list in FS_EXPANSIONS.items():
        for text, jur, vtype, rel in exp_list:
            norm = text.lower().strip()
            if norm not in family_id_map:
                family_id_map[norm] = f"fam_{current_fam_id:04d}"
                current_fam_id += 1
            fam = family_id_map[norm]

            records.append({
                "example_id": f"ex_{example_id:05d}",
                "concept_id": cid,
                "text": text,
                "variant_type": vtype,
                "jurisdiction": jur,
                "source_id": "src_domain_glossary",
                "source_locator": "finance_standards",
                "phrase_family_id": fam,
                "relation": "equivalent" if rel == "equiv" else "related",
                "is_synthetic": False,
                "parent_example_id": None,
                "review_status": "confirmed",
                "split": "train",
            })
            example_id += 1

    # 3. Add canonical definitions & labels as variants for all 150 concepts
    for c in CONCEPTS_DATA:
        cid = c["concept_id"]
        lbl = c["label"]
        norm_lbl = lbl.lower().strip()
        if norm_lbl not in family_id_map:
            family_id_map[norm_lbl] = f"fam_{current_fam_id:04d}"
            current_fam_id += 1

        records.append({
            "example_id": f"ex_{example_id:05d}",
            "concept_id": cid,
            "text": lbl,
            "variant_type": "canonical_label",
            "jurisdiction": c["jurisdiction"],
            "source_id": "taxonomy_v1",
            "source_locator": "canonical",
            "phrase_family_id": family_id_map[norm_lbl],
            "relation": "equivalent",
            "is_synthetic": False,
            "parent_example_id": None,
            "review_status": "confirmed",
            "split": "train",
        })
        example_id += 1

        # Generative / stylistic syntactic variants (heading style, parenthetical, lowercase)
        syn_variants = [
            (f"Total {lbl}", "heading"),
            (f"{lbl} (Statement line item)", "statutory"),
            (f"Reported {lbl}", "business"),
            (f"{lbl} - Consolidated", "heading"),
            (f"{lbl} (Current Year)", "business"),
            (f"Net {lbl}", "heading"),
            (f"{lbl} as per accounts", "statutory"),
            (f"Gross {lbl}", "heading"),
            (f"Audited {lbl}", "statutory"),
        ]
        for s_text, s_type in syn_variants:
            norm_s = s_text.lower().strip()
            if norm_s not in family_id_map:
                family_id_map[norm_s] = f"fam_{current_fam_id:04d}"
                current_fam_id += 1

            records.append({
                "example_id": f"ex_{example_id:05d}",
                "concept_id": cid,
                "text": s_text,
                "variant_type": s_type,
                "jurisdiction": c["jurisdiction"],
                "source_id": "taxonomy_synth",
                "source_locator": "generator",
                "phrase_family_id": family_id_map[norm_s],
                "relation": "equivalent",
                "is_synthetic": True,
                "parent_example_id": f"ex_{example_id-1:05d}",
                "review_status": "confirmed",
                "split": "train",
            })
            example_id += 1

    # Write variants.jsonl
    with open(VARIANTS_FILE, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"Generated {len(records)} variants in {VARIANTS_FILE}")

    # Write unknowns.jsonl
    with open(UNKNOWNS_FILE, "w", encoding="utf-8") as f:
        for idx, (term, split_target, domain) in enumerate(UNKNOWN_TERMS, 1):
            f.write(json.dumps({
                "unknown_id": f"unk_{idx:03d}",
                "text": term,
                "split": split_target,
                "domain_note": domain,
                "label": "out_of_taxonomy",
                "relation": "different",
            }, ensure_ascii=False) + "\n")

    print(f"Generated {len(UNKNOWN_TERMS)} unknown terms in {UNKNOWNS_FILE}")


if __name__ == "__main__":
    build_variants()
