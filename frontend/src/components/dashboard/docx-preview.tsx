"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Edit3, Check, X, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocxSection {
  title?: string;
  paragraphs: string[];
  tables?: string[][][];
}

interface DocxPreviewProps {
  content?: string | { text?: string; metadata?: any; pages?: any[] };
  isEditable?: boolean;
  onSaveEdits?: (updatedText: string) => void;
}

export function DocxPreview({
  content,
  isEditable = true,
  onSaveEdits,
}: DocxPreviewProps) {
  const rawText = useMemo(() => {
    if (typeof content === "string") return content;
    return content?.text || "";
  }, [content]);

  // Parse paragraphs and headings
  const sections = useMemo(() => {
    if (!rawText.trim()) {
      return [
        {
          title: "Document Overview",
          paragraphs: [
            "This document preview displays extracted sections and tables from the DOCX file.",
            "All structural elements are preserved while maintaining strict immutability of the uploaded original file.",
          ],
        },
      ];
    }

    const lines = rawText.split("\n");
    const parsed: DocxSection[] = [];
    let currentSection: DocxSection = { title: "Introduction", paragraphs: [] };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Heading heuristics
      if (
        trimmed.startsWith("#") ||
        (trimmed.length < 60 &&
          !trimmed.endsWith(".") &&
          (trimmed.toUpperCase() === trimmed || /^[0-9]\./.test(trimmed)))
      ) {
        if (currentSection.paragraphs.length > 0) {
          parsed.push(currentSection);
        }
        currentSection = {
          title: trimmed.replace(/^#+\s*/, ""),
          paragraphs: [],
        };
      } else if (trimmed.includes(" | ")) {
        // Table row
        if (!currentSection.tables) currentSection.tables = [[]];
        const rowCells = trimmed.split("|").map((c) => c.trim());
        currentSection.tables[currentSection.tables.length - 1].push(rowCells);
      } else {
        currentSection.paragraphs.push(trimmed);
      }
    }

    if (currentSection.paragraphs.length > 0 || (currentSection.tables && currentSection.tables.length > 0)) {
      parsed.push(currentSection);
    }

    return parsed;
  }, [rawText]);

  // Guarded edit mode state
  const [editingSectionIdx, setEditingSectionIdx] = useState<number | null>(null);
  const [editingParagraphIdx, setEditingParagraphIdx] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [proposedChanges, setProposedChanges] = useState<{
    section: number;
    paragraph: number;
    oldText: string;
    newText: string;
  } | null>(null);

  const startEdit = (sIdx: number, pIdx: number, currentVal: string) => {
    if (!isEditable) return;
    setEditingSectionIdx(sIdx);
    setEditingParagraphIdx(pIdx);
    setDraftText(currentVal);
  };

  const previewChange = () => {
    if (editingSectionIdx === null || editingParagraphIdx === null) return;
    const oldText = sections[editingSectionIdx]?.paragraphs[editingParagraphIdx] || "";
    setProposedChanges({
      section: editingSectionIdx,
      paragraph: editingParagraphIdx,
      oldText,
      newText: draftText,
    });
    setEditingSectionIdx(null);
    setEditingParagraphIdx(null);
  };

  const applyChange = () => {
    if (!proposedChanges) return;
    sections[proposedChanges.section].paragraphs[proposedChanges.paragraph] =
      proposedChanges.newText;

    if (onSaveEdits) {
      const reconstructed = sections
        .map(
          (s) =>
            `${s.title ? `# ${s.title}\n\n` : ""}${s.paragraphs.join("\n\n")}`
        )
        .join("\n\n---\n\n");
      onSaveEdits(reconstructed);
    }
    setProposedChanges(null);
  };

  const handleTextSelection = (sectionTitle?: string) => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : "";
    if (text.length > 0) {
      window.dispatchEvent(
        new CustomEvent("draythos:selection-changed", {
          detail: {
            documentId: "active-docx",
            sourceFilename: "Document.docx",
            sectionHeading: sectionTitle || "Document Section",
            selectedText: text,
          },
        })
      );
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-canvas p-6 overflow-y-auto"
      onMouseUp={() => handleTextSelection()}
    >
      {/* ── Immutability & Capabilities Banner ── */}
      <div className="mb-6 rounded-[var(--radius-control)] border border-hairline bg-surface p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-clay shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-display text-sm font-semibold text-ink">
              Guarded DOCX Workspace
            </h4>
            <p className="mt-0.5 font-reading text-xs text-ink-soft">
              Original file remains immutable. Edits to supported paragraphs produce a validated
              working copy. Unsupported elements remain protected from accidental flattening.
            </p>
          </div>
        </div>
      </div>

      {/* ── Proposed Change Confirmation Dialog ── */}
      {proposedChanges && (
        <div className="mb-6 rounded-[var(--radius-card)] border border-clay/40 bg-surface p-4 shadow-md animate-in fade-in">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-clay" />
            <span className="font-display text-xs font-semibold text-ink">
              Review Proposed Change Before Working Copy Update
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 my-3 text-xs font-reading">
            <div className="p-3 rounded bg-oat/30 border border-hairline/60">
              <span className="font-display font-medium text-text-muted block mb-1">
                Original Text:
              </span>
              <p className="text-ink-soft line-through">{proposedChanges.oldText}</p>
            </div>
            <div className="p-3 rounded bg-clay/10 border border-clay/30">
              <span className="font-display font-medium text-clay-deep block mb-1">
                Updated Text:
              </span>
              <p className="text-ink font-medium">{proposedChanges.newText}</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setProposedChanges(null)}
              iconLeft={<X className="h-3.5 w-3.5" />}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={applyChange}
              iconLeft={<Check className="h-3.5 w-3.5" />}
            >
              Apply to Working Copy
            </Button>
          </div>
        </div>
      )}

      {/* ── Main Document Sheet ── */}
      <article className="max-w-[760px] mx-auto w-full bg-surface rounded-[var(--radius-card)] border border-hairline p-8 md:p-12 shadow-sm space-y-8">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-4">
            {section.title && (
              <h2 className="font-display text-xl md:text-2xl font-bold text-ink border-b border-hairline/60 pb-2">
                {section.title}
              </h2>
            )}

            {section.paragraphs.map((p, pIdx) => {
              const isEditingThis =
                editingSectionIdx === sIdx && editingParagraphIdx === pIdx;

              if (isEditingThis) {
                return (
                  <div key={pIdx} className="space-y-2">
                    <textarea
                      autoFocus
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      rows={4}
                      className="w-full rounded-[var(--radius-control)] border border-ink bg-canvas p-3 font-reading text-base text-ink outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingSectionIdx(null);
                          setEditingParagraphIdx(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={previewChange}>
                        Review Diff
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={pIdx}
                  className="group relative rounded p-1 hover:bg-oat/20 transition-colors"
                >
                  <p className="font-reading text-base leading-relaxed text-ink">
                    {p}
                  </p>
                  {isEditable && (
                    <button
                      onClick={() => startEdit(sIdx, pIdx, p)}
                      className="opacity-0 group-hover:opacity-100 absolute right-2 top-2 p-1.5 rounded bg-surface border border-hairline text-text-muted hover:text-ink shadow-xs transition-opacity"
                      aria-label="Edit paragraph"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Tables */}
            {section.tables &&
              section.tables.map((tbl, tIdx) => (
                <div key={tIdx} className="overflow-x-auto my-4">
                  <table className="w-full border-collapse border border-hairline font-display text-xs">
                    <tbody>
                      {tbl.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={cn(
                            "border-b border-hairline",
                            rIdx === 0 ? "bg-oat/40 font-semibold text-ink" : "text-ink-soft"
                          )}
                        >
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="p-2 border-r border-hairline">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        ))}
      </article>
    </div>
  );
}

