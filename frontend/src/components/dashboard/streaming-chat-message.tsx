"use client";

import React, { useState, useMemo } from "react";
import { Copy, Check, RotateCcw, AlertTriangle } from "lucide-react";

/* ──────────────────────────── types ──────────────────────────── */

export interface Citation {
  id?: number | string;
  source?: string;
  source_filename?: string;
  page?: number;
  page_number?: number;
  excerpt?: string;
  text_excerpt?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date | string | number;
  citations?: any[];
  status?: "streaming" | "complete" | "completed" | "error" | "failed" | "cancelled" | "sending" | "pending";
  errorMessage?: string;
}

export interface StreamingChatMessageProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: ((messageId: string) => void) | (() => void);
  onCitationClick?: (citation: any) => void;
}

/* ──────────────────────────── markdown helpers ──────────────────────────── */

interface TextNode {
  type: "text" | "bold" | "italic" | "code" | "citation" | "link";
  content: string;
  citationId?: number;
  href?: string;
}

interface BlockNode {
  type: "paragraph" | "heading" | "code-block" | "list" | "list-item" | "hr" | "table";
  level?: number; // heading level 1-6
  language?: string;
  content?: string;
  children?: BlockNode[];
  inlineNodes?: TextNode[];
  ordered?: boolean;
  headers?: TextNode[][];
  rows?: TextNode[][][];
}

function parseInline(text: string): TextNode[] {
  const nodes: TextNode[] = [];
  // Regex: **bold**, *italic*, `code`, [n] citations, [text](url) links
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)|(\[(\d+)\])|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      nodes.push({ type: "bold", content: match[2] });
    } else if (match[3]) {
      nodes.push({ type: "italic", content: match[4] });
    } else if (match[5]) {
      nodes.push({ type: "code", content: match[6] });
    } else if (match[7]) {
      nodes.push({
        type: "citation",
        content: match[8],
        citationId: parseInt(match[8], 10),
      });
    } else if (match[9]) {
      nodes.push({ type: "link", content: match[10], href: match[11] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", content: text.slice(lastIndex) });
  }

  return nodes.length === 0 ? [{ type: "text", content: text }] : nodes;
}

function parseBlocks(raw: string): BlockNode[] {
  const lines = raw.split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // code blocks
    if (line.trimStart().startsWith("```")) {
      const language = line.trimStart().slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: "code-block",
        language,
        content: codeLines.join("\n"),
      });
      i++; // skip closing ```
      continue;
    }

    // headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        inlineNodes: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const items: BlockNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push({
          type: "list-item",
          inlineNodes: parseInline(lines[i].replace(/^\s*[-*+]\s/, "")),
        });
        i++;
      }
      blocks.push({ type: "list", ordered: false, children: items });
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const items: BlockNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push({
          type: "list-item",
          inlineNodes: parseInline(lines[i].replace(/^\s*\d+\.\s/, "")),
        });
        i++;
      }
      blocks.push({ type: "list", ordered: true, children: items });
      continue;
    }

    // table
    if (
      line.trim().startsWith("|") &&
      line.trim().endsWith("|") &&
      i + 1 < lines.length &&
      /^\s*\|?\s*[-:]+[-| :]*\|\s*$/.test(lines[i + 1])
    ) {
      const headerCols = line
        .split("|")
        .slice(1, -1)
        .map((c) => parseInline(c.trim()));
      i += 2; // skip header and separator
      const tableRows: TextNode[][][] = [];
      while (
        i < lines.length &&
        lines[i].trim().startsWith("|") &&
        lines[i].trim().endsWith("|")
      ) {
        const rowCols = lines[i]
          .split("|")
          .slice(1, -1)
          .map((c) => parseInline(c.trim()));
        tableRows.push(rowCols);
        i++;
      }
      blocks.push({
        type: "table",
        headers: headerCols,
        rows: tableRows,
      });
      continue;
    }

    // empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph: accumulate contiguous non-empty, non-special lines
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trimStart().startsWith("```") &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*[-*+]\s/.test(lines[i]) &&
      !/^\s*\d+\.\s/.test(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({
      type: "paragraph",
      inlineNodes: parseInline(paraLines.join(" ")),
    });
  }

  return blocks;
}

/* ──────────────────────────── inline renderer ──────────────────────────── */

function InlineContent({
  nodes,
  onCitationClick,
  citations,
}: {
  nodes: TextNode[];
  onCitationClick?: (c: Citation) => void;
  citations?: Citation[];
}) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "bold":
            return (
              <strong key={i} className="font-semibold">
                {n.content}
              </strong>
            );
          case "italic":
            return (
              <em key={i} className="italic">
                {n.content}
              </em>
            );
          case "code":
            return (
              <code
                key={i}
                className="rounded bg-oat px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
              >
                {n.content}
              </code>
            );
          case "citation": {
            const cit = citations?.find((c) => c.id === n.citationId);
            return (
              <button
                key={i}
                onClick={() => cit && onCitationClick?.(cit)}
                className="mx-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded bg-manilla px-1 font-mono text-[0.7em] font-semibold text-clay-deep transition-colors hover:bg-oat"
                title={cit?.source ?? `Citation ${n.citationId}`}
              >
                {n.content}
              </button>
            );
          }
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-clay-deep underline decoration-clay-deep/40 hover:decoration-clay-deep"
              >
                {n.content}
              </a>
            );
          default:
            return <span key={i}>{n.content}</span>;
        }
      })}
    </>
  );
}

/* ──────────────────────────── block renderer ──────────────────────────── */

function BlockContent({
  blocks,
  onCitationClick,
  citations,
}: {
  blocks: BlockNode[];
  onCitationClick?: (c: Citation) => void;
  citations?: Citation[];
}) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading": {
            const Tag = (`h${b.level ?? 3}`) as React.ElementType;
            const sizeClass =
              b.level === 1
                ? "text-xl"
                : b.level === 2
                  ? "text-lg"
                  : "text-base";
            return (
              <Tag
                key={i}
                className={`${sizeClass} mt-4 mb-2 font-display font-semibold text-ink`}
              >
                <InlineContent
                  nodes={b.inlineNodes ?? []}
                  onCitationClick={onCitationClick}
                  citations={citations}
                />
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={i} className="mb-2 font-reading leading-relaxed text-ink">
                <InlineContent
                  nodes={b.inlineNodes ?? []}
                  onCitationClick={onCitationClick}
                  citations={citations}
                />
              </p>
            );
          case "code-block":
            return (
              <pre
                key={i}
                className="my-3 overflow-x-auto rounded-control bg-oat p-4 font-mono text-sm leading-relaxed text-ink"
              >
                {b.language && (
                  <span className="mb-2 block text-xs text-text-muted">
                    {b.language}
                  </span>
                )}
                <code>{b.content}</code>
              </pre>
            );
          case "list": {
            const ListTag = b.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={i}
                className={`mb-2 pl-6 font-reading leading-relaxed text-ink ${b.ordered ? "list-decimal" : "list-disc"}`}
              >
                {b.children?.map((li, j) => (
                  <li key={j} className="mb-1">
                    <InlineContent
                      nodes={li.inlineNodes ?? []}
                      onCitationClick={onCitationClick}
                      citations={citations}
                    />
                  </li>
                ))}
              </ListTag>
            );
          }
          case "hr":
            return <hr key={i} className="my-4 border-hairline" />;
          case "table": {
            return (
              <div key={i} className="my-3 overflow-x-auto rounded-lg border border-hairline/80 shadow-xs bg-surface">
                <table className="w-full text-left text-xs text-ink border-collapse">
                  {b.headers && b.headers.length > 0 && (
                    <thead className="bg-oat/80 border-b border-hairline font-display font-semibold text-text-muted uppercase tracking-wider">
                      <tr>
                        {b.headers.map((h, colIdx) => (
                          <th key={colIdx} className="px-3.5 py-2.5 border-r border-hairline/60 last:border-r-0">
                            <InlineContent nodes={h} onCitationClick={onCitationClick} citations={citations} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody className="divide-y divide-hairline/50">
                    {b.rows?.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-oat/30 transition-colors">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-3.5 py-2.5 border-r border-hairline/60 last:border-r-0 font-reading">
                            <InlineContent nodes={cell} onCitationClick={onCitationClick} citations={citations} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
}

/* ──────────────────────────── streaming dots ──────────────────────────── */

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Loading">
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cloud-dark"
          style={{ animationDelay: `${n * 200}ms` }}
        />
      ))}
    </span>
  );
}

/* ──────────────────────────── main component ──────────────────────────── */

export function StreamingChatMessage({
  message,
  isStreaming = false,
  onRetry,
  onCitationClick,
}: StreamingChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState(false);

  const isUser = message.role === "user";
  const isError = message.status === "error";

  const blocks = useMemo(() => parseBlocks(message.content), [message.content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const formattedTime = useMemo(() => {
    const raw = message.timestamp;
    const d = raw instanceof Date ? raw : new Date(raw || Date.now());
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [message.timestamp]);

  return (
    <div
      className={`group flex ${isUser ? "justify-end" : "justify-start"}`}
      data-message-id={message.id}
    >
      <div
        className={`
          relative max-w-[85%] lg:max-w-[70%]
          ${
            isUser
              ? "rounded-card bg-surface px-4 py-3"
              : "px-1 py-2"
          }
        `}
      >
        {/* Message content */}
        {isError ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-clay-deep" />
            <div>
              <p className="font-reading text-sm text-clay-deep">
                {message.errorMessage ?? "Something went wrong."}
              </p>
              {onRetry && (
                <button
                  onClick={() => onRetry(message.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-control bg-surface px-3 py-1.5 font-display text-xs font-medium text-ink transition-colors hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={isUser ? "font-reading text-sm text-ink" : ""}>
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>
            ) : (
              <div className="text-sm">
                <BlockContent
                  blocks={blocks}
                  onCitationClick={onCitationClick}
                  citations={message.citations}
                />
              </div>
            )}
          </div>
        )}

        {/* Streaming indicator */}
        {isStreaming && !isError && <StreamingDots />}

        {/* Citations panel */}
        {!isUser &&
          message.citations &&
          message.citations.length > 0 &&
          !isStreaming && (
            <div className="mt-3 border-t border-hairline pt-2">
              <button
                onClick={() => setExpandedCitations((p) => !p)}
                className="mb-1.5 font-display text-xs font-medium text-text-muted hover:text-ink"
              >
                {expandedCitations ? "Hide" : "Show"} {message.citations.length}{" "}
                source{message.citations.length > 1 ? "s" : ""}
              </button>
              {expandedCitations && (
                <div className="flex flex-col gap-2">
                  {message.citations.map((c, index) => {
                    const citId = c.id ?? index + 1;
                    const citSource = c.source || c.source_filename || c.filename || c.documentTitle || (c.document_id ? `Document (${c.document_id.slice(0, 8)})` : `Document #${citId}`);
                    const citPage = c.page ?? c.page_number;
                    const citSheet = c.sheet_name || c.sheet;
                    const citExcerpt = c.excerpt || c.text_excerpt || c.text || "";
                    return (
                      <button
                        key={c.id || c.document_id || index}
                        onClick={() => onCitationClick?.(c)}
                        className="flex flex-col gap-1 rounded-lg bg-surface border border-hairline px-3 py-2 text-left transition-colors hover:bg-oat shadow-xs"
                      >
                        <span className="flex items-center gap-2">
                          <span className="flex h-4 min-w-[1.2rem] items-center justify-center rounded bg-clay/20 px-1 font-mono text-[0.65rem] font-bold text-clay-deep">
                            {citId}
                          </span>
                          <span className="truncate font-display text-xs font-semibold text-ink">
                            {citSource}
                          </span>
                          {citPage !== undefined && (
                            <span className="shrink-0 font-mono text-[0.65rem] text-text-muted">
                              p.{citPage}
                            </span>
                          )}
                          {citSheet && (
                            <span className="shrink-0 font-mono text-[0.65rem] text-text-muted">
                              [{citSheet}]
                            </span>
                          )}
                        </span>
                        {citExcerpt && (
                          <span className="line-clamp-2 font-reading text-xs leading-snug text-ink-soft">
                            {citExcerpt}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        {/* Footer: timestamp + actions */}
        <div
          className={`mt-1.5 flex items-center gap-2 ${isUser ? "justify-end" : "justify-start"}`}
        >
          <span className="font-mono text-[0.65rem] text-text-muted">
            {formattedTime}
          </span>

          {/* Copy – visible on hover */}
          {!isStreaming && !isError && (
            <button
              onClick={handleCopy}
              className="rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-oat focus:opacity-100 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="h-3 w-3 text-clay" />
              ) : (
                <Copy className="h-3 w-3 text-text-muted" />
              )}
            </button>
          )}

          {/* Retry for failed assistant messages */}
          {isError && !isUser && onRetry && (
            <button
              onClick={() => onRetry(message.id)}
              className="rounded p-0.5 hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
              aria-label="Retry"
            >
              <RotateCcw className="h-3 w-3 text-clay-deep" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default StreamingChatMessage;
