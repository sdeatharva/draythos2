"use client";

import React from "react";
import { ConfidenceBadge } from "@/components/review/ConfidenceBadge";
import { SourceLink } from "@/components/review/SourceLink";
import { ReviewActions } from "@/components/review/ReviewActions";

interface Fact {
  fact_id: string;
  doc_id: string;
  entity?: string;
  jurisdiction?: string;
  raw_label: string;
  concept_id?: string;
  concept_label?: string;
  match_method: string;
  similarity: number;
  confidence: number;
  state: string;
  value_raw: string;
  value_num?: number;
  unit?: string;
  scale: number;
  period?: { label?: string; start?: string; end?: string; type?: string };
  locator: any;
  created_at: string;
}

interface FactsGridProps {
  facts: Fact[];
  concepts: Array<{ concept_id: string; label: string; kind: string }>;
  onReview: (factId: string, action: "accept" | "reject" | "reassign", newConceptId?: string) => Promise<void>;
  loading?: boolean;
}

export function FactsGrid({ facts, concepts, onReview, loading }: FactsGridProps) {
  if (loading) {
    return (
      <div className="w-full py-16 text-center text-muted text-xs">
        Loading canonical facts...
      </div>
    );
  }

  if (facts.length === 0) {
    return (
      <div className="w-full py-16 text-center bg-surface border border-hairline rounded-lg p-8">
        <div className="font-normal text-sm text-primary">No facts found</div>
        <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
          Upload documents into the workspace or adjust your filters above to review translated fields.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-hairline bg-surface shadow-2xs">
      <table className="w-full text-left text-xs text-secondary">
        <thead className="bg-raised text-secondary font-normal border-b border-hairline text-xs">
          <tr>
            <th className="py-2.5 px-3.5 font-normal">Original raw label</th>
            <th className="py-2.5 px-3.5 font-normal">Canonical concept</th>
            <th className="py-2.5 px-3.5 font-normal">Extracted value</th>
            <th className="py-2.5 px-3.5 font-normal">Period</th>
            <th className="py-2.5 px-3.5 font-normal">Confidence / method</th>
            <th className="py-2.5 px-3.5 font-normal">Source locator</th>
            <th className="py-2.5 px-3.5 text-right font-normal">Review action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {facts.map((fact) => {
            const formattedVal =
              fact.value_num !== null && fact.value_num !== undefined
                ? fact.value_num.toLocaleString(undefined, { maximumFractionDigits: 2 })
                : fact.value_raw;

            return (
              <tr
                key={fact.fact_id}
                className="hover:bg-raised/50 transition-colors"
              >
                {/* Raw Label */}
                <td className="py-2.5 px-3.5 font-medium text-primary">
                  <div className="truncate max-w-[200px]" title={fact.raw_label}>
                    {fact.raw_label}
                  </div>
                  {fact.entity && (
                    <div className="text-[11px] text-muted font-normal">{fact.entity}</div>
                  )}
                </td>

                {/* Canonical Concept */}
                <td className="py-2.5 px-3.5">
                  <div className="font-medium text-primary">
                    {fact.concept_label || (
                      <span className="text-muted">Unmapped</span>
                    )}
                  </div>
                  {fact.concept_id && (
                    <div className="text-[11px] text-muted font-mono">{fact.concept_id}</div>
                  )}
                </td>

                {/* Value */}
                <td className="py-2.5 px-3.5 font-mono text-primary tabular">
                  <span>{formattedVal}</span>
                  {fact.unit && (
                    <span className="ml-1 text-[11px] text-muted font-sans">{fact.unit}</span>
                  )}
                </td>

                {/* Period */}
                <td className="py-2.5 px-3.5 text-secondary">
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-raised border border-hairline text-xs font-mono tabular">
                    {fact.period?.label || "Current"}
                  </span>
                </td>

                {/* Confidence & Method */}
                <td className="py-2.5 px-3.5">
                  <div className="flex items-center gap-1.5">
                    <ConfidenceBadge confidence={fact.confidence} state={fact.state} />
                    <span
                      className="text-[10px] text-muted font-mono px-1 py-0.5 bg-raised border border-hairline rounded-[4px]"
                      title={`Matched via: ${fact.match_method}`}
                    >
                      {fact.match_method}
                    </span>
                  </div>
                </td>

                {/* Source Locator */}
                <td className="py-2.5 px-3.5">
                  <SourceLink locator={fact.locator} />
                </td>

                {/* Actions */}
                <td className="py-2.5 px-3.5 text-right">
                  <ReviewActions
                    factId={fact.fact_id}
                    currentState={fact.state}
                    concepts={concepts}
                    onReview={onReview}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
