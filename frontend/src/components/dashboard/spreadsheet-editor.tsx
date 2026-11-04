"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import type { CellEdit } from "@/types";
import { Table, Check, AlertCircle, Plus, Save, Circle, Columns, Rows } from "lucide-react";

interface SpreadsheetEditorProps {
  workbookData?: {
    sheets?: {
      name: string;
      data?: any[][];
      row_count?: number;
      col_count?: number;
    }[];
    text?: string;
  } | null;
  activeSheet?: string;
  onSheetChange?: (sheetName: string) => void;
  onCellEdit?: (edit: CellEdit) => void;
  onSaveEdits?: () => void;
  editedCells?: Record<string, any>;
  readOnly?: boolean;
}

function parseCellRef(ref: string): { sheet?: string; row: number; col: number } | null {
  const clean = ref.trim();
  let sheet: string | undefined;
  let cellPart = clean;

  if (clean.includes("!")) {
    const splitIdx = clean.indexOf("!");
    sheet = clean.slice(0, splitIdx).replace(/^['"]|['"]$/g, "");
    cellPart = clean.slice(splitIdx + 1);
  }

  const match = cellPart.toUpperCase().match(/^([A-Z]+)([0-9]+)$/);
  if (!match) return null;
  const colStr = match[1];
  const rowNum = parseInt(match[2], 10) - 1;
  let colNum = 0;
  for (let i = 0; i < colStr.length; i++) {
    colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
  }
  return { sheet, row: rowNum, col: colNum - 1 };
}

function expandRange(startRef: string, endRef: string): Array<{ sheet?: string; row: number; col: number }> {
  const start = parseCellRef(startRef);
  const end = parseCellRef(endRef);
  if (!start || !end) return [];
  const sheet = start.sheet || end.sheet;
  const minRow = Math.min(start.row, end.row);
  const maxRow = Math.max(start.row, end.row);
  const minCol = Math.min(start.col, end.col);
  const maxCol = Math.max(start.col, end.col);
  const cells: Array<{ sheet?: string; row: number; col: number }> = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push({ sheet, row: r, col: c });
    }
  }
  return cells;
}

export class FormulaEvaluationError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export function evaluateFormula(
  rawVal: any,
  getVal: (r: number, c: number, sheet?: string) => any,
  visiting: Set<string> = new Set()
): { display: string; numericValue?: number; isFormula: boolean; isError?: boolean } {
  if (rawVal === null || rawVal === undefined) {
    return { display: "", isFormula: false };
  }
  const str = String(rawVal).trim();
  if (str === "") {
    return { display: "", isFormula: false };
  }

  // Not a formula
  if (!str.startsWith("=")) {
    // If it's a numeric string with at least 4 digits, format with commas for display
    const num = Number(str.replace(/,/g, ""));
    if (!isNaN(num) && str !== "" && !str.includes("%") && !str.startsWith("+")) {
      return { display: num.toLocaleString(), numericValue: num, isFormula: false };
    }
    return { display: str, isFormula: false };
  }

  // Formula evaluation
  const formulaBody = str.slice(1).trim();

  // Guard against corrupted formulas (e.g. =** or =)
  if (formulaBody === "**" || formulaBody === "" || /^[*`_#\s]+$/.test(formulaBody)) {
    return { display: "#VALUE!", isFormula: true, isError: true };
  }

  const getNumericCellVal = (r: number, c: number, sheet?: string): number => {
    const key = `${sheet || ""}:${r},${c}`;
    if (visiting.has(key)) {
      throw new FormulaEvaluationError("#CYCLE!", `Circular reference detected at ${key}`);
    }
    visiting.add(key);
    try {
      const cellRaw = getVal(r, c, sheet);
      const evalRes = evaluateFormula(cellRaw, getVal, new Set(visiting));
      if (evalRes.isError) {
        throw new FormulaEvaluationError(evalRes.display, `Nested cell error: ${evalRes.display}`);
      }
      if (evalRes.numericValue !== undefined) return evalRes.numericValue;
      const num = Number(String(cellRaw).replace(/,/g, "").trim());
      return isNaN(num) ? 0 : num;
    } finally {
      visiting.delete(key);
    }
  };

  try {
    // Check balanced parentheses
    let openCount = 0;
    for (const ch of formulaBody) {
      if (ch === "(") openCount++;
      else if (ch === ")") {
        openCount--;
        if (openCount < 0) return { display: "#VALUE!", isFormula: true, isError: true };
      }
    }
    if (openCount !== 0) {
      return { display: "#VALUE!", isFormula: true, isError: true };
    }

    // Helper: collect numbers from range/args
    const collectValues = (argsStr: string): number[] => {
      const parts = argsStr.split(/[,;]/);
      const vals: number[] = [];
      for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        if (p.includes(":")) {
          const [startRef, endRef] = p.split(":");
          const cells = expandRange(startRef, endRef);
          for (const cell of cells) {
            vals.push(getNumericCellVal(cell.row, cell.col, cell.sheet));
          }
        } else {
          const cell = parseCellRef(p);
          if (cell) {
            vals.push(getNumericCellVal(cell.row, cell.col, cell.sheet));
          } else {
            const num = Number(p.replace(/,/g, ""));
            if (!isNaN(num)) vals.push(num);
          }
        }
      }
      return vals;
    };

    // 1. SUM formula: =SUM(B2:D2), =SUM(Revenue_Q1!D2:D4), etc.
    const sumMatch = formulaBody.match(/^SUM\((.*)\)$/i);
    if (sumMatch) {
      const vals = collectValues(sumMatch[1]);
      const sum = vals.reduce((a, b) => a + b, 0);
      return { display: sum.toLocaleString(), numericValue: sum, isFormula: true };
    }

    // 2. AVERAGE formula
    const avgMatch = formulaBody.match(/^AVERAGE\((.*)\)$/i);
    if (avgMatch) {
      const vals = collectValues(avgMatch[1]);
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { display: Number(avg.toFixed(2)).toLocaleString(), numericValue: avg, isFormula: true };
    }

    // 3. COUNT formula
    const countMatch = formulaBody.match(/^COUNT\((.*)\)$/i);
    if (countMatch) {
      const vals = collectValues(countMatch[1]);
      return { display: String(vals.length), numericValue: vals.length, isFormula: true };
    }

    // 4. MIN formula
    const minMatch = formulaBody.match(/^MIN\((.*)\)$/i);
    if (minMatch) {
      const vals = collectValues(minMatch[1]);
      const min = vals.length > 0 ? Math.min(...vals) : 0;
      return { display: min.toLocaleString(), numericValue: min, isFormula: true };
    }

    // 5. MAX formula
    const maxMatch = formulaBody.match(/^MAX\((.*)\)$/i);
    if (maxMatch) {
      const vals = collectValues(maxMatch[1]);
      const max = vals.length > 0 ? Math.max(...vals) : 0;
      return { display: max.toLocaleString(), numericValue: max, isFormula: true };
    }

    // 6. ABS formula
    const absMatch = formulaBody.match(/^ABS\((.*)\)$/i);
    if (absMatch) {
      const vals = collectValues(absMatch[1]);
      const val = vals.length > 0 ? Math.abs(vals[0]) : 0;
      return { display: val.toLocaleString(), numericValue: val, isFormula: true };
    }

    // Check for unsupported functions: e.g. =UNKNOWN(...) or =IRR(...)
    const funcMatch = formulaBody.match(/^([A-Za-z][A-Za-z0-9_.]*)\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1].toUpperCase();
      const supported = ["SUM", "AVERAGE", "COUNT", "MIN", "MAX", "ABS"];
      if (!supported.includes(funcName)) {
        return { display: "#NAME?", isFormula: true, isError: true };
      }
    }

    // 7. Arithmetic expressions e.g. =B2+C2 or =(Sheet2!B2*1.1)/C5 or =A1^2
    const substituted = formulaBody.replace(/(?:(?:'([^']+)'|([A-Za-z0-9_]+))!)?([A-Za-z]+[0-9]+)/g, (fullMatch, quotedSheet, bareSheet, cellCoord) => {
      const sheetName = quotedSheet || bareSheet;
      const cell = parseCellRef(cellCoord);
      if (cell) {
        return String(getNumericCellVal(cell.row, cell.col, sheetName));
      }
      return "0";
    });

    // Check for division by zero syntactically: / 0 or / (0)
    if (/\/\s*0(?![0-9.])|\/\s*\(\s*0\s*\)/.test(substituted)) {
      return { display: "#DIV/0!", isFormula: true, isError: true };
    }

    // Convert power ^ to **
    const jsExpr = substituted.replace(/\^/g, "**");

    if (/^[0-9+\-*/().\s*]+$/.test(jsExpr)) {
      const result = Function(`"use strict"; return (${jsExpr});`)();
      if (result === Infinity || result === -Infinity) {
        return { display: "#DIV/0!", isFormula: true, isError: true };
      }
      if (typeof result === "number" && !isNaN(result)) {
        return {
          display: Number(result.toFixed(2)).toLocaleString(),
          numericValue: result,
          isFormula: true,
        };
      }
      if (isNaN(result)) {
        return { display: "#VALUE!", isFormula: true, isError: true };
      }
    }
  } catch (err: any) {
    if (err instanceof FormulaEvaluationError) {
      return { display: err.code, isFormula: true, isError: true };
    }
    return { display: "#VALUE!", isFormula: true, isError: true };
  }

  return { display: str, isFormula: true };
}

export function SpreadsheetEditor({
  workbookData,
  activeSheet: externalActiveSheet,
  onSheetChange,
  onCellEdit,
  onSaveEdits,
  editedCells = {},
  readOnly = false,
}: SpreadsheetEditorProps) {
  // Parse or extract sheets
  const sheets = useMemo(() => {
    if (workbookData?.sheets && workbookData.sheets.length > 0) {
      return workbookData.sheets;
    }
    // If workbookData only has text, parse it into pseudo-sheet rows
    if (workbookData?.text) {
      const parts = workbookData.text.split(/Sheet:\s+/).filter(Boolean);
      if (parts.length > 1) {
        return parts.map((part) => {
          const lines = part.split("\n").filter((l) => l.trim());
          const sheetName = lines[0]?.trim() || "Sheet";
          const dataRows = lines.slice(1);
          const delimiter = dataRows[0]?.includes("\t") ? "\t" : dataRows[0]?.includes("|") ? "|" : ",";
          const grid = dataRows.map((r) =>
            r.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
          );
          return { name: sheetName, data: grid, row_count: grid.length, col_count: grid[0]?.length || 0 };
        });
      }

      const allLines = workbookData.text.split("\n").filter((r) => r.trim());
      const firstLine = allLines[0] || "";
      const isSheetHeader = firstLine.startsWith("Sheet:");
      const sheetName = isSheetHeader ? firstLine.replace(/^Sheet:\s*/, "").trim() : "Sheet1";
      const dataRows = isSheetHeader ? allLines.slice(1) : allLines;
      const delimiter = dataRows[0]?.includes("\t") ? "\t" : dataRows[0]?.includes("|") ? "|" : ",";
      const grid = dataRows.map((r) =>
        r.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ""))
      );
      return [{ name: sheetName, data: grid, row_count: grid.length, col_count: grid[0]?.length || 0 }];
    }
    // Fallback sample sheet
    return [
      {
        name: "Summary",
        data: [
          ["Account / Category", "Q1 Actual", "Q2 Actual", "Q3 Forecast", "Q4 Forecast"],
          ["Revenue (Product A)", "125000", "138000", "145000", "160000"],
          ["Revenue (Services)", "45000", "52000", "48000", "55000"],
          ["Operating Expenses", "82000", "89000", "91000", "94000"],
          ["Operating Margin", "88000", "101000", "102000", "121000"],
        ],
      },
      {
        name: "Tax Breakdown",
        data: [
          ["Jurisdiction", "Gross Taxable", "Applicable Rate", "Net VAT/GST"],
          ["Domestic - Central", "170000", "18.0%", "30600"],
          ["Domestic - State", "170000", "9.0%", "15300"],
          ["Export - Zero Rated", "35000", "0.0%", "0"],
        ],
      },
    ];
  }, [workbookData]);

  const [currentSheetName, setCurrentSheetName] = useState<string>(
    externalActiveSheet || sheets[0]?.name || "Sheet1"
  );
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({
    row: 0,
    col: 0,
  });
  const [selectionRange, setSelectionRange] = useState<{
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null>(null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [localEdits, setLocalEdits] = useState<Record<string, any>>({});
  const [extraRows, setExtraRows] = useState(0);
  const [extraCols, setExtraCols] = useState(0);

  // Column and Row Resizing state
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const resizingRef = useRef<{
    type: "col" | "row";
    index: number;
    startPos: number;
    startDim: number;
  } | null>(null);

  const activeSheetData = useMemo(() => {
    const s = sheets.find((item) => item.name === currentSheetName) || sheets[0];
    return s?.data || [["(Empty Sheet)"]];
  }, [sheets, currentSheetName]);

  const numRows = Math.max(activeSheetData.length + extraRows, 12);
  const numCols = Math.max(
    activeSheetData.reduce((max, row) => Math.max(max, row?.length || 0), 0) + extraCols,
    8
  );

  // Auto-calculate column widths on initial load so content is never truncated with '...'
  useEffect(() => {
    if (!activeSheetData || activeSheetData.length === 0) return;
    const initialWidths: Record<number, number> = {};
    for (let c = 0; c < numCols; c++) {
      let maxLen = 8;
      for (let r = 0; r < Math.min(activeSheetData.length, 30); r++) {
        const val = String(activeSheetData[r]?.[c] || "");
        if (val.length > maxLen) maxLen = val.length;
      }
      initialWidths[c] = Math.max(c === 0 ? 170 : 120, Math.min(380, maxLen * 9 + 28));
    }
    setColWidths((prev) => ({ ...initialWidths, ...prev }));
  }, [currentSheetName, activeSheetData, numCols]);

  const handleColResizeStart = (e: React.MouseEvent, c: number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = colWidths[c] || (c === 0 ? 170 : 120);
    resizingRef.current = {
      type: "col",
      index: c,
      startPos: e.clientX,
      startDim: currentWidth,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientX - resizingRef.current.startPos;
      const newWidth = Math.max(60, Math.min(600, resizingRef.current.startDim + delta));
      setColWidths((prev) => ({ ...prev, [c]: newWidth }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleColAutoFit = (c: number) => {
    let maxLen = 8;
    for (let r = 0; r < activeSheetData.length; r++) {
      const val = String(activeSheetData[r]?.[c] || "");
      if (val.length > maxLen) maxLen = val.length;
    }
    const autoWidth = Math.max(80, Math.min(500, maxLen * 9 + 28));
    setColWidths((prev) => ({ ...prev, [c]: autoWidth }));
  };

  const handleRowResizeStart = (e: React.MouseEvent, r: number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentHeight = rowHeights[r] || 28;
    resizingRef.current = {
      type: "row",
      index: r,
      startPos: e.clientY,
      startDim: currentHeight,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = moveEvent.clientY - resizingRef.current.startPos;
      const newHeight = Math.max(22, Math.min(200, resizingRef.current.startDim + delta));
      setRowHeights((prev) => ({ ...prev, [r]: newHeight }));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    if (externalActiveSheet) setCurrentSheetName(externalActiveSheet);
  }, [externalActiveSheet]);

  const getColHeader = (colIndex: number) => {
    let result = "";
    let temp = colIndex;
    while (temp >= 0) {
      result = String.fromCharCode(65 + (temp % 26)) + result;
      temp = Math.floor(temp / 26) - 1;
    }
    return result;
  };

  const getCellRef = (row: number, col: number) => `${getColHeader(col)}${row + 1}`;

  const getCellValue = (row: number, col: number, sheet?: string) => {
    const sName = sheet || currentSheetName;
    const ref = `${sName}!${getCellRef(row, col)}`;
    if (ref in localEdits) return localEdits[ref];
    if (ref in editedCells && typeof editedCells[ref] !== "boolean") return editedCells[ref];
    if (sName === currentSheetName) {
      return activeSheetData[row]?.[col] ?? "";
    }
    const otherSheet = sheets.find((s) => s.name.toLowerCase() === sName.toLowerCase());
    return otherSheet?.data?.[row]?.[col] ?? "";
  };

  const isMultiCellRange = Boolean(
    selectionRange &&
      (selectionRange.start.row !== selectionRange.end.row ||
        selectionRange.start.col !== selectionRange.end.col)
  );

  const rangeRefStr = useMemo(() => {
    if (!selectionRange) return "";
    const minR = Math.min(selectionRange.start.row, selectionRange.end.row);
    const maxR = Math.max(selectionRange.start.row, selectionRange.end.row);
    const minC = Math.min(selectionRange.start.col, selectionRange.end.col);
    const maxC = Math.max(selectionRange.start.col, selectionRange.end.col);
    if (minR === maxR && minC === maxC) return getCellRef(minR, minC);
    return `${getCellRef(minR, minC)}:${getCellRef(maxR, maxC)}`;
  }, [selectionRange]);

  const selectedRef = rangeRefStr || (selectedCell ? getCellRef(selectedCell.row, selectedCell.col) : "A1");
  const selectedVal = selectedCell ? getCellValue(selectedCell.row, selectedCell.col) : "";

  const commitEdit = (nextCell?: { row: number; col: number }) => {
    if (!selectedCell || readOnly) return;
    const ref = `${currentSheetName}!${getCellRef(selectedCell.row, selectedCell.col)}`;
    const oldVal = getCellValue(selectedCell.row, selectedCell.col);

    if (editValue !== String(oldVal)) {
      setLocalEdits((prev) => ({ ...prev, [ref]: editValue }));
      if (onCellEdit) {
        onCellEdit({
          sheet_name: currentSheetName,
          cell_ref: getCellRef(selectedCell.row, selectedCell.col),
          old_value: oldVal,
          new_value: editValue,
          value_type: isNaN(Number(editValue)) ? "string" : "number",
        });
      }
    }
    setIsEditing(false);
    if (nextCell) {
      setSelectedCell(nextCell);
      setSelectionRange({ start: nextCell, end: nextCell });
    }
  };

  const handleCellMouseDown = (row: number, col: number) => {
    if (isEditing) commitEdit();
    setSelectedCell({ row, col });
    setSelectionRange({ start: { row, col }, end: { row, col } });
    setIsSelectingRange(true);
    setIsEditing(false);
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isSelectingRange) {
      setSelectionRange((prev) => (prev ? { ...prev, end: { row, col } } : null));
    }
  };

  const handleCellMouseUp = () => {
    if (isSelectingRange) {
      setIsSelectingRange(false);
      if (selectionRange && typeof window !== "undefined") {
        const minR = Math.min(selectionRange.start.row, selectionRange.end.row);
        const maxR = Math.max(selectionRange.start.row, selectionRange.end.row);
        const minC = Math.min(selectionRange.start.col, selectionRange.end.col);
        const maxC = Math.max(selectionRange.start.col, selectionRange.end.col);
        const isMulti = minR !== maxR || minC !== maxC;
        const cellRef = isMulti
          ? `${getCellRef(minR, minC)}:${getCellRef(maxR, maxC)}`
          : getCellRef(minR, minC);
        const colHeader = activeSheetData[0]?.[minC] || getColHeader(minC);
        const rowLabel = activeSheetData[minR]?.[0] || `Row ${minR + 1}`;
        const val = getCellValue(minR, minC);
        window.dispatchEvent(
          new CustomEvent("draythos:selection-changed", {
            detail: {
              documentId: "active-spreadsheet",
              sourceFilename: `${currentSheetName}`,
              cellRef: `${currentSheetName}!${cellRef}`,
              sheetName: currentSheetName,
              sectionHeading: isMulti ? `Range ${cellRef}` : `${rowLabel} · ${colHeader}`,
              selectedText: isMulti
                ? `Range ${cellRef} (${(maxR - minR + 1) * (maxC - minC + 1)} cells)`
                : String(val || "(Empty Cell)"),
            },
          })
        );
      }
    }
  };

  useEffect(() => {
    const onGlobalMouseUp = () => {
      if (isSelectingRange) {
        setIsSelectingRange(false);
      }
    };
    window.addEventListener("mouseup", onGlobalMouseUp);
    return () => window.removeEventListener("mouseup", onGlobalMouseUp);
  }, [isSelectingRange]);

  const handleCellDoubleClick = (row: number, col: number) => {
    if (readOnly) return;
    setSelectedCell({ row, col });
    setSelectionRange({ start: { row, col }, end: { row, col } });
    setEditValue(String(getCellValue(row, col)));
    setIsEditing(true);
  };

  // Keyboard navigation, clipboard copy/paste & direct typing into selected cell
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || isEditing) return;

      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        const cellVal = getCellValue(selectedCell.row, selectedCell.col);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(String(cellVal));
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        if (navigator.clipboard && !readOnly) {
          navigator.clipboard.readText().then((clipText) => {
            if (clipText !== undefined && clipText !== null) {
              const ref = `${currentSheetName}!${getCellRef(selectedCell.row, selectedCell.col)}`;
              setLocalEdits((prev) => ({ ...prev, [ref]: clipText }));
              if (onCellEdit) {
                onCellEdit({
                  sheet_name: currentSheetName,
                  cell_ref: getCellRef(selectedCell.row, selectedCell.col),
                  old_value: getCellValue(selectedCell.row, selectedCell.col),
                  new_value: clipText,
                  value_type: isNaN(Number(clipText)) ? "string" : "number",
                });
              }
            }
          });
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = { row: Math.min(numRows - 1, selectedCell.row + 1), col: selectedCell.col };
        setSelectedCell(next);
        setSelectionRange({ start: next, end: next });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const next = { row: Math.max(0, selectedCell.row - 1), col: selectedCell.col };
        setSelectedCell(next);
        setSelectionRange({ start: next, end: next });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = { row: selectedCell.row, col: Math.min(numCols - 1, selectedCell.col + 1) };
        setSelectedCell(next);
        setSelectionRange({ start: next, end: next });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = { row: selectedCell.row, col: Math.max(0, selectedCell.col - 1) };
        setSelectedCell(next);
        setSelectionRange({ start: next, end: next });
      } else if (e.key === "Tab") {
        e.preventDefault();
        const nextCol = e.shiftKey ? Math.max(0, selectedCell.col - 1) : Math.min(numCols - 1, selectedCell.col + 1);
        const next = { row: selectedCell.row, col: nextCol };
        setSelectedCell(next);
        setSelectionRange({ start: next, end: next });
      } else if (e.key === "Enter" || e.key === "F2") {
        e.preventDefault();
        setEditValue(String(getCellValue(selectedCell.row, selectedCell.col)));
        setIsEditing(true);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const ref = `${currentSheetName}!${getCellRef(selectedCell.row, selectedCell.col)}`;
        setLocalEdits((prev) => ({ ...prev, [ref]: "" }));
        if (onCellEdit) {
          onCellEdit({
            sheet_name: currentSheetName,
            cell_ref: getCellRef(selectedCell.row, selectedCell.col),
            old_value: getCellValue(selectedCell.row, selectedCell.col),
            new_value: "",
            value_type: "string",
          });
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // User typed a character directly on a selected cell!
        e.preventDefault();
        setEditValue(e.key);
        setIsEditing(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell, isEditing, numRows, numCols, currentSheetName]);

  const totalEditsCount = Object.keys(localEdits).length + Object.keys(editedCells).length;

  return (
    <div className="flex flex-col h-full bg-canvas select-none font-display text-xs">
      {/* ── Formula Bar & Quick Edit Tools ── */}
      <div className="flex items-center gap-2 border-b border-hairline bg-surface px-3 py-1.5 shrink-0 flex-wrap">
        <span className="font-mono text-xs font-semibold text-text-muted min-w-[3.5rem] bg-oat/50 px-2 py-1 rounded text-center border border-hairline">
          {selectedRef || "A1"}
        </span>
        <span className="text-cloud-dark font-mono font-bold">fx</span>
        <div className="flex-1 min-w-[180px] relative">
          <input
            type="text"
            readOnly={readOnly}
            value={isEditing ? editValue : String(selectedVal)}
            onChange={(e) => {
              if (!isEditing) setIsEditing(true);
              setEditValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setIsEditing(false);
            }}
            placeholder="Cell formula or value..."
            className="w-full h-7 rounded border border-hairline/60 bg-canvas px-2 font-mono text-xs text-ink outline-none focus:border-ink"
          />
        </div>

        {/* Quick actions: Add Row, Add Column, Save Edits */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setExtraRows((r) => r + 1)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-oat/60 hover:bg-oat text-[11px] font-display text-ink border border-hairline transition-colors"
            title="Add a new row"
          >
            <Plus className="h-3 w-3 text-clay" /> Row
          </button>
          <button
            type="button"
            onClick={() => setExtraCols((c) => c + 1)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-oat/60 hover:bg-oat text-[11px] font-display text-ink border border-hairline transition-colors"
            title="Add a new column"
          >
            <Plus className="h-3 w-3 text-clay" /> Col
          </button>

          {totalEditsCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-clay bg-clay/10 px-2 py-0.5 rounded-full border border-clay/20">
              <Circle className="h-2 w-2 fill-clay" /> {totalEditsCount} edited
            </span>
          )}

          {onSaveEdits && (
            <button
              type="button"
              onClick={onSaveEdits}
              disabled={totalEditsCount === 0}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded text-xs font-display font-medium transition-colors shadow-2xs",
                totalEditsCount > 0
                  ? "bg-clay text-canvas hover:opacity-90"
                  : "bg-oat/40 text-text-muted cursor-not-allowed"
              )}
              title="Save spreadsheet changes to working copy"
            >
              <Save className="h-3.5 w-3.5" /> Save
            </button>
          )}
        </div>
      </div>

      {/* ── Spreadsheet Grid ── */}
      <div className="flex-1 overflow-auto bg-surface relative">
        <table className="border-collapse table-fixed">
          <thead>
            <tr className="bg-oat/40 sticky top-0 z-10 border-b border-hairline">
              <th className="w-12 h-7 border-r border-hairline bg-oat/60 font-mono text-[11px] text-text-muted text-center font-normal select-none">
                #
              </th>
              {Array.from({ length: numCols }).map((_, c) => {
                const colW = colWidths[c] || 140;
                return (
                  <th
                    key={c}
                    style={{ width: colW, minWidth: colW, maxWidth: colW }}
                    className="relative h-7 px-2 border-r border-hairline font-mono text-[11px] text-text-muted text-center font-normal select-none truncate"
                  >
                    <span>{getColHeader(c)}</span>
                    {/* Draggable column resize handle with high-visibility grab zone */}
                    <div
                      onMouseDown={(e) => handleColResizeStart(e, c)}
                      onDoubleClick={() => handleColAutoFit(c)}
                      className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-clay/40 active:bg-clay transition-colors z-20 group"
                      title="Drag to resize column, double-click to auto-fit"
                    >
                      <div className="w-[1px] h-full bg-hairline/80 mx-auto group-hover:bg-clay" />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numRows }).map((_, r) => {
              const rowH = rowHeights[r] || 28;
              return (
                <tr key={r} className="border-b border-hairline/50 hover:bg-oat/10">
                  {/* Row Number Header with vertical resize handle */}
                  <td
                    style={{ height: rowH }}
                    className="relative w-12 border-r border-hairline bg-oat/30 font-mono text-[10px] text-text-muted text-center font-normal select-none"
                  >
                    <span>{r + 1}</span>
                    {/* Draggable row resize handle with high-visibility grab zone */}
                    <div
                      onMouseDown={(e) => handleRowResizeStart(e, r)}
                      className="absolute left-0 right-0 bottom-0 h-2.5 cursor-row-resize hover:bg-clay/40 active:bg-clay transition-colors z-20 group"
                      title="Drag to resize row"
                    >
                      <div className="w-full h-[1px] bg-hairline/80 my-auto group-hover:bg-clay" />
                    </div>
                  </td>

                  {/* Cell Columns */}
                  {Array.from({ length: numCols }).map((_, c) => {
                    const colW = colWidths[c] || 140;
                    const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                    const inRange = Boolean(
                      selectionRange &&
                        r >= Math.min(selectionRange.start.row, selectionRange.end.row) &&
                        r <= Math.max(selectionRange.start.row, selectionRange.end.row) &&
                        c >= Math.min(selectionRange.start.col, selectionRange.end.col) &&
                        c <= Math.max(selectionRange.start.col, selectionRange.end.col)
                    );
                    const cellRef = `${currentSheetName}!${getCellRef(r, c)}`;
                    const isEdited = cellRef in localEdits || cellRef in editedCells;
                    const val = getCellValue(r, c);
                    const evalResult = evaluateFormula(val, getCellValue);

                    return (
                      <td
                        key={c}
                        style={{ width: colW, minWidth: colW, maxWidth: colW, height: rowH }}
                        title={
                          (isEdited ? "[Working Copy Modified] " : "") +
                          (evalResult.isFormula
                            ? `${getCellRef(r, c)}: ${String(val)} = ${evalResult.display}`
                            : String(val))
                        }
                        onMouseDown={() => handleCellMouseDown(r, c)}
                        onMouseEnter={() => handleCellMouseEnter(r, c)}
                        onMouseUp={handleCellMouseUp}
                        onDoubleClick={() => handleCellDoubleClick(r, c)}
                        className={cn(
                          "px-2 border-r border-hairline/50 truncate font-mono text-xs cursor-cell transition-colors",
                          isSelected && "outline outline-2 outline-ink z-10 bg-oat/20",
                          inRange && !isSelected && "bg-oat/50 border border-clay/30",
                          isEdited && "border-l-[3px] border-l-clay bg-clay/10 text-clay-deep font-semibold shadow-2xs",
                          evalResult.isFormula && "font-medium"
                        )}
                      >
                        {isSelected && isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const nextRow = e.shiftKey ? Math.max(0, r - 1) : Math.min(numRows - 1, r + 1);
                                commitEdit({ row: nextRow, col: c });
                              } else if (e.key === "Tab") {
                                e.preventDefault();
                                const nextCol = e.shiftKey ? Math.max(0, c - 1) : Math.min(numCols - 1, c + 1);
                                commitEdit({ row: r, col: nextCol });
                              } else if (e.key === "Escape") {
                                setIsEditing(false);
                              }
                            }}
                            className="w-full h-full p-0 bg-transparent outline-none font-mono text-xs text-ink"
                          />
                        ) : (
                          evalResult.display
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Sheet Tabs Footer ── */}
      <div className="flex items-center gap-1 border-t border-hairline bg-oat/30 px-2 py-1 shrink-0 overflow-x-auto">
        <span className="flex items-center gap-1 text-[11px] text-text-muted mr-2 pl-1 font-medium">
          <Table className="h-3.5 w-3.5" /> Sheets:
        </span>
        {sheets.map((s) => (
          <button
            key={s.name}
            onClick={() => {
              setCurrentSheetName(s.name);
              if (onSheetChange) onSheetChange(s.name);
            }}
            className={cn(
              "px-3 py-1 rounded-[var(--radius-control)] text-xs font-medium transition-colors",
              currentSheetName === s.name
                ? "bg-surface text-ink border border-hairline shadow-xs font-semibold"
                : "text-ink-soft hover:bg-surface/60"
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

