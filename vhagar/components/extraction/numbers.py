"""Financial number, scale, and currency parsing.

Handles:
- Indian numbering system (e.g., "1,23,45,000" -> 12345000)
- Parentheses as negative numbers (e.g., "(1,234.50)" -> -1234.50)
- Currency symbols and codes: $, ₹, €, £, INR, USD, EUR, GBP, Rs.
- Suffix scales: k, M, B, Lakh, Lac, Crore, Cr
- Heading/table scale notes: "in Millions", "in Lakhs", "in Crores", "(₹ in Cr)"
- Percentages: "18%", "18.5 %"
"""

from __future__ import annotations

import re
from typing import Optional, Tuple

CURRENCY_MAP = {
    "$": "USD",
    "₹": "INR",
    "rs": "INR",
    "rs.": "INR",
    "inr": "INR",
    "€": "EUR",
    "eur": "EUR",
    "£": "GBP",
    "gbp": "GBP",
    "jpy": "JPY",
    "¥": "JPY",
}

SCALE_KEYWORDS = {
    "crore": 10_000_000.0,
    "crores": 10_000_000.0,
    "cr": 10_000_000.0,
    "cr.": 10_000_000.0,
    "lakh": 100_000.0,
    "lakhs": 100_000.0,
    "lac": 100_000.0,
    "lacs": 100_000.0,
    "million": 1_000_000.0,
    "millions": 1_000_000.0,
    "mn": 1_000_000.0,
    "billion": 1_000_000_000.0,
    "billions": 1_000_000_000.0,
    "bn": 1_000_000_000.0,
    "thousand": 1_000.0,
    "thousands": 1_000.0,
    "k": 1_000.0,
    "m": 1_000_000.0,
    "b": 1_000_000_000.0,
}


def detect_context_scale_and_unit(header_or_context: str) -> tuple[float, Optional[str]]:
    """Detect scale factor and currency unit from context headers like '(₹ in Lakhs)'."""
    if not header_or_context:
        return 1.0, None

    ctx = header_or_context.lower()
    unit = None
    scale = 1.0

    # Currency match
    for sym, code in CURRENCY_MAP.items():
        if sym in ctx:
            unit = code
            break

    # Scale match
    for word, mult in SCALE_KEYWORDS.items():
        pattern = r"\b" + re.escape(word) + r"\b"
        if re.search(pattern, ctx):
            scale = mult
            break

    return scale, unit


def parse_financial_number(
    raw_str: Any,
    default_scale: float = 1.0,
    default_unit: Optional[str] = None,
) -> Tuple[Optional[float], Optional[str], float]:
    """Parse raw financial string into numeric value, unit, and scale multiplier."""
    if raw_str is None:
        return None, default_unit, default_scale

    s = str(raw_str).strip()
    if not s or s in ("-", "—", "N/A", "NA", "nil", "Nil", "NIL", "none"):
        return 0.0 if s in ("-", "—", "nil", "Nil") else None, default_unit, default_scale

    unit = default_unit
    scale = default_scale

    # Check percentage
    if "%" in s:
        unit = "%"
        s = s.replace("%", "").strip()

    # Detect currency in raw string
    for sym, code in CURRENCY_MAP.items():
        if sym in s.lower():
            unit = code
            # Strip symbol
            pattern = re.compile(re.escape(sym), re.IGNORECASE)
            s = pattern.sub("", s).strip()
            break

    # Detect negative by brackets e.g. (1,234) or minus sign
    is_negative = False
    if s.startswith("(") and s.endswith(")"):
        is_negative = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        is_negative = True
        s = s[1:].strip()

    # Detect suffix scale (e.g. 45.2 Cr, 10M, 50k)
    s_lower = s.lower()
    for word, mult in SCALE_KEYWORDS.items():
        if s_lower.endswith(word):
            scale = mult
            s = s[: -len(word)].strip()
            break

    # Remove all standard formatting commas (handles 1,23,45,000 and 1,234,567.89)
    cleaned = s.replace(",", "").strip()

    try:
        val = float(cleaned)
        if is_negative:
            val = -val
        return val, unit, scale
    except ValueError:
        return None, unit, scale

