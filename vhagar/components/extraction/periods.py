"""Financial period normalization (Fiscal Years, Quarters, Dates).

Produces canonical period metadata dict:
{
    "label": "FY2024",
    "start": "2023-04-01",
    "end": "2024-03-31",
    "type": "fiscal_year"
}
"""

from __future__ import annotations

import re
from typing import Any, Dict


def parse_period(header_or_label: str, jurisdiction: str = "IN") -> Dict[str, Any]:
    """Parse period string into structured representation."""
    if not header_or_label:
        return {"label": "Unknown", "start": None, "end": None, "type": "unspecified"}

    text = header_or_label.strip()

    # Match FY format e.g., FY24, FY2024, FY 2023-24, 2023-24, FY 2023 - 2024
    fy_match = re.search(r"(?:FY|F\.Y\.)?\s*(\d{4})\s*[-/]\s*(\d{2,4})", text, re.IGNORECASE)
    if fy_match:
        start_year = int(fy_match.group(1))
        end_str = fy_match.group(2)
        end_year = int(end_str) if len(end_str) == 4 else int(str(start_year)[:2] + end_str)
        
        # In India / UK, FY starts April 1
        if jurisdiction in ("IN", "UK"):
            return {
                "label": f"FY{end_year}",
                "start": f"{start_year}-04-01",
                "end": f"{end_year}-03-31",
                "type": "fiscal_year",
            }
        else:
            return {
                "label": f"FY{end_year}",
                "start": f"{start_year}-01-01",
                "end": f"{start_year}-12-31",
                "type": "fiscal_year",
            }

    # Match Quarters first: Q1 FY24, Q2 2024, 3Q24
    q_match = re.search(r"(?:Q([1-4])|([1-4])Q)\s*(?:FY)?\s*(\d{2,4})?", text, re.IGNORECASE)
    if q_match:
        q_num = q_match.group(1) or q_match.group(2)
        y_group = q_match.group(3)
        year = 2024
        if y_group:
            y_val = int(y_group)
            year = y_val if y_val > 1000 else 2000 + y_val

        # Quarterly date approximations
        quarter_months = {
            "1": ("04-01", "06-30") if jurisdiction in ("IN", "UK") else ("01-01", "03-31"),
            "2": ("07-01", "09-30") if jurisdiction in ("IN", "UK") else ("04-01", "06-30"),
            "3": ("10-01", "12-31") if jurisdiction in ("IN", "UK") else ("07-01", "09-30"),
            "4": ("01-01", "03-31") if jurisdiction in ("IN", "UK") else ("10-01", "12-31"),
        }
        start_m, end_m = quarter_months.get(q_num, ("01-01", "03-31"))
        return {
            "label": f"Q{q_num} {year}",
            "start": f"{year}-{start_m}",
            "end": f"{year}-{end_m}",
            "type": "quarter",
        }

    # Match single year FY24, FY2024
    fy_single = re.search(r"(?:FY|F\.Y\.)\s*(\d{2,4})", text, re.IGNORECASE)
    if fy_single:
        y_val = int(fy_single.group(1))
        year = y_val if y_val > 1000 else 2000 + y_val
        if jurisdiction in ("IN", "UK"):
            return {
                "label": f"FY{year}",
                "start": f"{year - 1}-04-01",
                "end": f"{year}-03-31",
                "type": "fiscal_year",
            }
        else:
            return {
                "label": f"FY{year}",
                "start": f"{year}-01-01",
                "end": f"{year}-12-31",
                "type": "fiscal_year",
            }

    # Match calendar 4-digit year: 2023, 2024
    cy_match = re.search(r"\b(20\d{2}|19\d{2})\b", text)
    if cy_match:
        year = int(cy_match.group(1))
        return {
            "label": f"CY{year}",
            "start": f"{year}-01-01",
            "end": f"{year}-12-31",
            "type": "calendar_year",
        }

    # Fallback as general text
    return {
        "label": text[:30],
        "start": None,
        "end": None,
        "type": "unspecified",
    }


class PeriodResult(dict):
    """Period result supporting both dot and dictionary access."""
    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError:
            return None

    def __setattr__(self, name: str, value: Any) -> None:
        self[name] = value


def normalize_period(header_or_label: str, jurisdiction: str = "IN") -> PeriodResult:
    """Wrapper around parse_period supporting dot-notation."""
    res = parse_period(header_or_label, jurisdiction=jurisdiction)
    return PeriodResult(res)


