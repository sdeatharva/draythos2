"""Exact source locator construction and validation.

Section 4.2:
"Every extracted field MUST be stored in this shape.
 A fact without a locator MUST NOT be saved."

Locator formats:
- PDF: page, bbox [x0, y0, x1, y1], quote
- XLSX / XLS: sheet, cell (or range), quote
- CSV: row, col, quote
- DOCX: para_index or (table_index, row, col), quote
- JSON: json_path, quote
- XML: xpath, quote
- TXT: line, char_start, char_end, quote
"""

from __future__ import annotations
from typing import Any


def make_pdf_locator(page: int, bbox: list[float] | tuple[float, float, float, float] | None = None, quote: str = "", doc_id: str = "") -> dict[str, Any]:
    return {
        "type": "pdf",
        "doc_id": doc_id,
        "page": int(page),
        "bbox": list(bbox) if bbox else [0.0, 0.0, 0.0, 0.0],
        "quote": quote.strip(),
    }


def make_xlsx_locator(sheet: str, cell: str, quote: str = "", doc_id: str = "") -> dict[str, Any]:
    return {
        "type": "xlsx",
        "doc_id": doc_id,
        "sheet": sheet,
        "cell": cell,
        "quote": quote.strip(),
    }


def make_csv_locator(row: int, col: int, quote: str = "", doc_id: str = "") -> dict[str, Any]:
    return {
        "type": "csv",
        "doc_id": doc_id,
        "row": int(row),
        "col": int(col),
        "quote": quote.strip(),
    }


def make_docx_locator(
    quote: str = "",
    para_index: int | None = None,
    table_index: int | None = None,
    row: int | None = None,
    col: int | None = None,
    doc_id: str = "",
) -> dict[str, Any]:
    loc: dict[str, Any] = {
        "type": "docx",
        "doc_id": doc_id,
        "quote": quote.strip(),
    }
    if table_index is not None and row is not None and col is not None:
        loc["table_index"] = int(table_index)
        loc["row"] = int(row)
        loc["col"] = int(col)
    else:
        loc["para_index"] = int(para_index or 0)
    return loc


def make_txt_locator(line: int, char_start: int = 0, char_end: int = 0, quote: str = "", doc_id: str = "") -> dict[str, Any]:
    return {
        "type": "txt",
        "doc_id": doc_id,
        "line": int(line),
        "char_start": int(char_start),
        "char_end": int(char_end),
        "quote": quote.strip(),
    }


def make_json_locator(json_path: str, quote: str = "", doc_id: str = "") -> dict[str, Any]:
    return {
        "type": "json",
        "doc_id": doc_id,
        "json_path": json_path,
        "quote": quote.strip(),
    }


def make_xml_locator(xpath: str, quote: str = "", doc_id: str = "") -> dict[str, Any]:
    return {
        "type": "xml",
        "doc_id": doc_id,
        "xpath": xpath,
        "quote": quote.strip(),
    }


def validate_locator(locator: Any) -> bool:
    """Validate that locator satisfies Section 4.2 requirements.
    Every format MUST carry a non-empty quote or valid coordinate reference.
    """
    if not isinstance(locator, dict):
        return False
    loc_type = locator.get("type")
    if not loc_type:
        return False

    # Section 4.2 requires a non-empty quote for ground-truth verification
    if not locator.get("quote"):
        return False

    if loc_type == "pdf":
        return "page" in locator
    elif loc_type in ("xlsx", "xls"):
        return "sheet" in locator and ("cell" in locator or "range" in locator)
    elif loc_type == "csv":
        return "row" in locator and "col" in locator
    elif loc_type == "docx":
        return "para_index" in locator or ("table_index" in locator and "row" in locator)
    elif loc_type == "txt":
        return "line" in locator
    elif loc_type == "json":
        return "json_path" in locator
    elif loc_type == "xml":
        return "xpath" in locator
    return False


def format_locator_display(loc: dict[str, Any]) -> str:
    """Format locator into human-readable reference for UI badges and Excel exports."""
    if not loc or not isinstance(loc, dict):
        return "Unknown location"

    t = loc.get("type", "")
    if t in ("xlsx", "xls"):
        sheet = loc.get("sheet", "Sheet1")
        cell = loc.get("cell") or loc.get("range", "")
        return f"{sheet}!{cell}"
    elif t == "pdf":
        page = loc.get("page", 1)
        return f"Page {page}"
    elif t == "csv":
        return f"Row {loc.get('row', 1)}, Col {loc.get('col', 1)}"
    elif t == "docx":
        if "table_index" in loc:
            return f"Table {loc.get('table_index')}, R{loc.get('row')}C{loc.get('col')}"
        return f"Paragraph {loc.get('para_index', 0)}"
    elif t == "txt":
        return f"Line {loc.get('line', 1)}"
    elif t == "json":
        return str(loc.get("json_path", ""))
    elif t == "xml":
        return str(loc.get("xpath", ""))
    return f"{t.upper()} locator"

