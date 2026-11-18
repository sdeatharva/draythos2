"use client";

import React, { useState } from "react";
import { Search, Trash2 } from "lucide-react";

interface ConceptTableProps {
  mappings: Array<{
    alias_id: string;
    alias: string;
    alias_key: string;
    concept_id: string;
    concept_label: string;
    source: string;
    relation: string;
    priority: number;
    created_at: string;
  }>;
  onDeleteMapping: (aliasId: string) => Promise<void>;
}

export function ConceptTable({ mappings, onDeleteMapping }: ConceptTableProps) {
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");

  const filtered = mappings.filter((m) => {
    const matchesText =
      m.alias.toLowerCase().includes(filter.toLowerCase()) ||
      m.concept_label.toLowerCase().includes(filter.toLowerCase()) ||
      m.concept_id.toLowerCase().includes(filter.toLowerCase());

    const matchesSource =
      sourceFilter === "all" ? true : m.source === sourceFilter;

    return matchesText && matchesSource;
  });

  return (
    <div className="bg-surface border border-hairline rounded-lg p-4 space-y-3 shadow-2xs">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <h3 className="text-sm font-medium text-primary">
            Active synonym catalog ({filtered.length})
          </h3>
          <div className="flex items-center gap-1 bg-raised border border-hairline rounded p-0.5 text-xs">
            <button
              onClick={() => setSourceFilter("all")}
              className={`px-2 py-0.5 rounded transition-colors ${
                sourceFilter === "all"
                  ? "bg-surface text-primary font-medium shadow-2xs"
                  : "text-secondary hover:text-primary"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSourceFilter("user_override")}
              className={`px-2 py-0.5 rounded transition-colors ${
                sourceFilter === "user_override"
                  ? "bg-surface text-accent font-medium shadow-2xs"
                  : "text-secondary hover:text-primary"
              }`}
            >
              User overrides
            </button>
          </div>
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search synonyms"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs h-8 pl-8 pr-2.5 bg-surface border border-hairline rounded-md text-primary placeholder:text-muted focus:outline-none focus:border-secondary w-full"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-hairline">
        <table className="w-full text-left text-xs text-secondary">
          <thead className="bg-raised text-secondary font-normal border-b border-hairline text-xs">
            <tr>
              <th className="py-2.5 px-3 font-normal">Surface synonym</th>
              <th className="py-2.5 px-3 font-normal">Canonical target</th>
              <th className="py-2.5 px-3 font-normal">Relation</th>
              <th className="py-2.5 px-3 font-normal">Source and priority</th>
              <th className="py-2.5 px-3 text-right font-normal">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {filtered.map((m) => (
              <tr key={m.alias_id} className="hover:bg-raised/50 transition-colors">
                <td className="py-2.5 px-3 font-medium text-primary">
                  {m.alias}
                  {m.source === "user_override" && (
                    <span className="ml-2 text-[10px] font-mono px-1 py-0.5 bg-accent/10 border border-accent/20 text-accent rounded-[4px]">
                      Override
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-medium text-primary">
                    {m.concept_label}
                  </div>
                  <div className="text-[11px] font-mono text-muted">{m.concept_id}</div>
                </td>
                <td className="py-2.5 px-3">
                  <span
                    className={`inline-block text-[11px] px-1.5 py-0.5 rounded-[4px] font-mono border ${
                      m.relation === "equivalent"
                        ? "bg-positive/10 text-positive border-positive/20"
                        : m.relation === "different"
                        ? "bg-negative/10 text-negative border-negative/20"
                        : "bg-raised text-secondary border-hairline"
                    }`}
                  >
                    {m.relation}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-secondary font-mono text-xs tabular">
                  <span>{m.source}</span>
                  <span className="text-muted ml-1.5">(p:{m.priority})</span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  {m.source === "user_override" ? (
                    <button
                      onClick={() => onDeleteMapping(m.alias_id)}
                      className="p-1 rounded text-muted hover:text-negative hover:bg-negative/10 transition-colors"
                      title="Delete override and restore baseline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-muted text-[11px]">System baseline</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
