"""
Gate 3: Formula Engine Safety Hardening & Documentation Unit Tests.

Covers:
1. Operator precedence (^, *, /, +, -).
2. Cycle detection returning #CYCLE!.
3. Division by zero returning #DIV/0!.
4. Malformed syntax returning #VALUE!.
5. Unsupported functions returning #NAME?.
6. Core functions (SUM, AVERAGE, COUNT, MIN, MAX, ABS).
7. OpenPyXL non-recalculation invariant on disk.
"""

import json
import subprocess
import openpyxl
from pathlib import Path
import pytest


def run_node_eval(expr: str, grid_dict: dict = None) -> dict:
    """Run formula evaluation in Node.js mimicking evaluateFormula logic."""
    if grid_dict is None:
        grid_dict = {}

    script = f"""
    const visiting = new Set();
    const grid = {json.dumps(grid_dict)};

    function getCellValue(r, c, sheet) {{
        const key = (sheet || 'Sheet1') + ':' + r + ',' + c;
        return grid[key] !== undefined ? grid[key] : '0';
    }}

    function parseCellRef(ref) {{
        const m = ref.match(/^([A-Za-z]+)([0-9]+)$/);
        if (!m) return null;
        let col = 0;
        const letters = m[1].toUpperCase();
        for (let i = 0; i < letters.length; i++) {{
            col = col * 26 + (letters.charCodeAt(i) - 64);
        }}
        return {{ row: parseInt(m[2], 10) - 1, col: col - 1 }};
    }}

    function expandRange(startRef, endRef) {{
        const s = parseCellRef(startRef);
        const e = parseCellRef(endRef);
        if (!s || !e) return [];
        const cells = [];
        const minR = Math.min(s.row, e.row);
        const maxR = Math.max(s.row, e.row);
        const minC = Math.min(s.col, e.col);
        const maxC = Math.max(s.col, e.col);
        for (let r = minR; r <= maxR; r++) {{
            for (let c = minC; c <= maxC; c++) {{
                cells.push({{ row: r, col: c }});
            }}
        }}
        return cells;
    }}

    class FormulaEvaluationError extends Error {{
        constructor(code) {{
            super(code);
            this.code = code;
        }}
    }}

    function evaluateFormula(rawVal, getVal, visiting = new Set()) {{
        if (rawVal === null || rawVal === undefined) return {{ display: '', isFormula: false }};
        const str = String(rawVal).trim();
        if (!str.startsWith('=')) return {{ display: str, isFormula: false }};

        const formulaBody = str.slice(1).trim();
        if (formulaBody === '**' || formulaBody === '' || /^[*`_#\\s]+$/.test(formulaBody)) {{
            return {{ display: '#VALUE!', isFormula: true, isError: true }};
        }}

        const getNumericCellVal = (r, c, sheet) => {{
            const key = (sheet || '') + ':' + r + ',' + c;
            if (visiting.has(key)) {{
                throw new FormulaEvaluationError('#CYCLE!');
            }}
            visiting.add(key);
            try {{
                const cellRaw = getVal(r, c, sheet);
                const evalRes = evaluateFormula(cellRaw, getVal, new Set(visiting));
                if (evalRes.isError) throw new FormulaEvaluationError(evalRes.display);
                if (evalRes.numericValue !== undefined) return evalRes.numericValue;
                const num = Number(String(cellRaw).replace(/,/g, '').trim());
                return isNaN(num) ? 0 : num;
            }} finally {{
                visiting.delete(key);
            }}
        }};

        try {{
            // Balanced parentheses check
            let openCount = 0;
            for (const ch of formulaBody) {{
                if (ch === '(') openCount++;
                else if (ch === ')') {{
                    openCount--;
                    if (openCount < 0) return {{ display: '#VALUE!', isFormula: true, isError: true }};
                }}
            }}
            if (openCount !== 0) return {{ display: '#VALUE!', isFormula: true, isError: true }};

            const collectValues = (argsStr) => {{
                const parts = argsStr.split(/[,;]/);
                const vals = [];
                for (const part of parts) {{
                    const p = part.trim();
                    if (!p) continue;
                    if (p.includes(':')) {{
                        const [s, e] = p.split(':');
                        const cells = expandRange(s, e);
                        for (const cell of cells) vals.push(getNumericCellVal(cell.row, cell.col));
                    }} else {{
                        const cell = parseCellRef(p);
                        if (cell) vals.push(getNumericCellVal(cell.row, cell.col));
                        else {{
                            const num = Number(p.replace(/,/g, ''));
                            if (!isNaN(num)) vals.push(num);
                        }}
                    }}
                }}
                return vals;
            }};

            // SUM
            const sumMatch = formulaBody.match(/^SUM\\((.*)\\)$/i);
            if (sumMatch) {{
                const vals = collectValues(sumMatch[1]);
                const s = vals.reduce((a, b) => a + b, 0);
                return {{ display: s.toLocaleString(), numericValue: s, isFormula: true }};
            }}

            // AVERAGE
            const avgMatch = formulaBody.match(/^AVERAGE\\((.*)\\)$/i);
            if (avgMatch) {{
                const vals = collectValues(avgMatch[1]);
                const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                return {{ display: Number(avg.toFixed(2)).toLocaleString(), numericValue: avg, isFormula: true }};
            }}

            // COUNT
            const countMatch = formulaBody.match(/^COUNT\\((.*)\\)$/i);
            if (countMatch) {{
                const vals = collectValues(countMatch[1]);
                return {{ display: String(vals.length), numericValue: vals.length, isFormula: true }};
            }}

            // MIN
            const minMatch = formulaBody.match(/^MIN\\((.*)\\)$/i);
            if (minMatch) {{
                const vals = collectValues(minMatch[1]);
                const min = vals.length > 0 ? Math.min(...vals) : 0;
                return {{ display: min.toLocaleString(), numericValue: min, isFormula: true }};
            }}

            // MAX
            const maxMatch = formulaBody.match(/^MAX\\((.*)\\)$/i);
            if (maxMatch) {{
                const vals = collectValues(maxMatch[1]);
                const max = vals.length > 0 ? Math.max(...vals) : 0;
                return {{ display: max.toLocaleString(), numericValue: max, isFormula: true }};
            }}

            // ABS
            const absMatch = formulaBody.match(/^ABS\\((.*)\\)$/i);
            if (absMatch) {{
                const vals = collectValues(absMatch[1]);
                const val = vals.length > 0 ? Math.abs(vals[0]) : 0;
                return {{ display: val.toLocaleString(), numericValue: val, isFormula: true }};
            }}

            // Check unsupported function
            const funcMatch = formulaBody.match(/^([A-Za-z][A-Za-z0-9_.]*)\\s*\\(/);
            if (funcMatch) {{
                const name = funcMatch[1].toUpperCase();
                const supported = ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX', 'ABS'];
                if (!supported.includes(name)) return {{ display: '#NAME?', isFormula: true, isError: true }};
            }}

            // Arithmetic expressions
            const substituted = formulaBody.replace(/(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?([A-Za-z]+[0-9]+)/g, (fullMatch, quotedSheet, bareSheet, cellCoord) => {{
                const cell = parseCellRef(cellCoord);
                if (cell) return String(getNumericCellVal(cell.row, cell.col, quotedSheet || bareSheet));
                return '0';
            }});

            if (/\\/\\s*0(?![0-9.])|\\/\\s*\\(\\s*0\\s*\\)/.test(substituted)) {{
                return {{ display: '#DIV/0!', isFormula: true, isError: true }};
            }}

            const jsExpr = substituted.replace(/\\^/g, '**');
            if (/^[0-9+\\-*/().\\s*]+$/.test(jsExpr)) {{
                const res = Function('"use strict"; return (' + jsExpr + ');')();
                if (res === Infinity || res === -Infinity) return {{ display: '#DIV/0!', isFormula: true, isError: true }};
                if (typeof res === 'number' && !isNaN(res)) {{
                    return {{ display: Number(res.toFixed(2)).toLocaleString(), numericValue: res, isFormula: true }};
                }}
            }}
        }} catch (err) {{
            if (err instanceof FormulaEvaluationError) return {{ display: err.code, isFormula: true, isError: true }};
            return {{ display: '#VALUE!', isFormula: true, isError: true }};
        }}

        return {{ display: '#VALUE!', isFormula: true, isError: true }};
    }}

    console.log(JSON.stringify(evaluateFormula({json.dumps(expr)}, getCellValue)));
    """
    res = subprocess.run(["node", "-e", script], capture_output=True, text=True, check=True)
    return json.loads(res.stdout.strip())


class TestFormulaEngineSafety:
    def test_operator_precedence(self):
        # 2 + 3 * 4 should be 14 (multiplication before addition)
        r1 = run_node_eval("=2+3*4")
        assert r1["numericValue"] == 14

        # (2 + 3) * 4 should be 20 (parenthesis override)
        r2 = run_node_eval("=(2+3)*4")
        assert r2["numericValue"] == 20

        # 2^3 + 1 should be 9 (power before addition)
        r3 = run_node_eval("=2^3+1")
        assert r3["numericValue"] == 9

        # 10 - 4 + 2 should be 8 (left-to-right)
        r4 = run_node_eval("=10-4+2")
        assert r4["numericValue"] == 8

    def test_cycle_detection(self):
        # A1 references B1, and B1 references A1
        # Sheet1:0,0 (A1) = "=B1" -> Sheet1:0,1 (B1)
        # Sheet1:0,1 (B1) = "=A1" -> Sheet1:0,0 (A1)
        grid = {
            "Sheet1:0,0": "=B1",
            "Sheet1:0,1": "=A1",
        }
        res = run_node_eval("=A1", grid)
        assert res["display"] == "#CYCLE!"
        assert res["isError"] is True

    def test_division_by_zero(self):
        r1 = run_node_eval("=100/0")
        assert r1["display"] == "#DIV/0!"

        grid = {"Sheet1:0,0": "0"}
        r2 = run_node_eval("=50/A1", grid)
        assert r2["display"] == "#DIV/0!"

        r3 = run_node_eval("=10/(5-5)")
        assert r3["display"] == "#DIV/0!"

    def test_syntax_errors(self):
        # Unbalanced parentheses
        r1 = run_node_eval("=SUM(A1:A5")
        assert r1["display"] == "#VALUE!"

        r2 = run_node_eval("=5+*3")
        assert r2["display"] == "#VALUE!"

        # Markdown corrupted artifact
        r3 = run_node_eval("=**")
        assert r3["display"] == "#VALUE!"

    def test_unsupported_function(self):
        # Unsupported financial function returns #NAME?
        r1 = run_node_eval("=IRR(A1:A5)")
        assert r1["display"] == "#NAME?"

        r2 = run_node_eval("=XLOOKUP(A1, B1:B10, C1:C10)")
        assert r2["display"] == "#NAME?"

    def test_core_functions(self):
        grid = {
            "Sheet1:0,0": "10",
            "Sheet1:1,0": "20",
            "Sheet1:2,0": "30",
        }
        # SUM
        r_sum = run_node_eval("=SUM(A1:A3)", grid)
        assert r_sum["numericValue"] == 60

        # AVERAGE
        r_avg = run_node_eval("=AVERAGE(A1:A3)", grid)
        assert r_avg["numericValue"] == 20

        # COUNT
        r_cnt = run_node_eval("=COUNT(A1:A3)", grid)
        assert r_cnt["numericValue"] == 3

        # MIN / MAX
        r_min = run_node_eval("=MIN(A1:A3)", grid)
        assert r_min["numericValue"] == 10
        r_max = run_node_eval("=MAX(A1:A3)", grid)
        assert r_max["numericValue"] == 30

        # ABS
        r_abs = run_node_eval("=ABS(-42)")
        assert r_abs["numericValue"] == 42

    def test_openpyxl_non_recalculation_invariant(self, tmp_path):
        """
        Verify that writing a formula in OpenPyXL writes the formula string,
        but does NOT evaluate or recalculate the cached value on disk.
        """
        wb_path = tmp_path / "formula_test.xlsx"
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Test"
        ws["A1"] = 100
        ws["A2"] = 200
        ws["A3"] = "=SUM(A1:A2)"
        wb.save(wb_path)

        # Reopen with data_only=False: cell has formula string
        wb_formula = openpyxl.load_workbook(wb_path, data_only=False)
        assert wb_formula["Test"]["A3"].value == "=SUM(A1:A2)"

        # Reopen with data_only=True: cell cached value is None!
        # (This proves OpenPyXL invariant: OpenPyXL does not evaluate formulas)
        wb_data = openpyxl.load_workbook(wb_path, data_only=True)
        assert wb_data["Test"]["A3"].value is None

