"use client";

import React, { useState } from "react";
import { ConfidenceBadge } from "@/components/review/ConfidenceBadge";
import { SourceLink } from "@/components/review/SourceLink";
import { ReviewActions } from "@/components/review/ReviewActions";
import { HelpCircle, X, ShieldCheck, CheckCircle2, FileText, ChevronRight } from "lucide-react";

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
  period?: any;
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
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<any>(null);
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  const openExplainDrawer = async (factId: string) => {
    setSelectedFactId(factId);
    setLoadingDrawer(true);
    try {
      const res = await fetch(`/api/facts/explain?fact_id=${encodeURIComponent(factId)}`);
      if (res.ok) {
        const json = await res.json();
        setDrawerData(json);
      }
    } catch (err) {
      console.error("Failed to load explanation:", err);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const closeDrawer = () => {
    setSelectedFactId(null);
    setDrawerData(null);
  };

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
          Adjust your filters above to review translated fields.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface shadow-xs">
        <table className="w-full text-left text-xs text-secondary">
          <thead className="bg-neutral-50 text-neutral-600 font-normal border-b border-hairline text-xs font-mono text-[11px]">
            <tr>
              <th className="py-3 px-3.5 font-semibold">Original raw label</th>
              <th className="py-3 px-3.5 font-semibold">Canonical concept</th>
              <th className="py-3 px-3.5 font-semibold">Extracted value</th>
              <th className="py-3 px-3.5 font-semibold">Period</th>
              <th className="py-3 px-3.5 font-semibold">Confidence / method</th>
              <th className="py-3 px-3.5 font-semibold">Source locator</th>
              <th className="py-3 px-3.5 text-right font-semibold">Review / Ledger Explain</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {facts.map((fact) => {
              const formattedVal =
                fact.value_num !== null && fact.value_num !== undefined
                  ? fact.value_num.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : fact.value_raw;

              const periodLabel =
                typeof fact.period === "object"
                  ? fact.period?.label || "Current"
                  : fact.period || "Current";

              return (
                <tr
                  key={fact.fact_id}
                  className="hover:bg-neutral-50/50 transition-colors"
                >
                  {/* Raw Label */}
                  <td className="py-3 px-3.5 font-medium text-ink">
                    <div className="truncate max-w-[200px]" title={fact.raw_label}>
                      {fact.raw_label}
                    </div>
                    {fact.entity && (
                      <div className="text-[11px] text-neutral-400 font-normal">{fact.entity}</div>
                    )}
                  </td>

                  {/* Canonical Concept */}
                  <td className="py-3 px-3.5">
                    <div className="font-medium text-forest font-mono">
                      {fact.concept_id || fact.concept_label || (
                        <span className="text-neutral-400">Unmapped</span>
                      )}
                    </div>
                  </td>

                  {/* Value */}
                  <td className="py-3 px-3.5 font-mono text-ink tabular font-semibold">
                    <span>{formattedVal}</span>
                    {fact.unit && (
                      <span className="ml-1 text-[11px] text-neutral-500 font-ui font-normal">{fact.unit}</span>
                    )}
                  </td>

                  {/* Period */}
                  <td className="py-3 px-3.5 text-secondary">
                    <span className="px-2 py-0.5 rounded bg-neutral-100 border border-hairline text-xs font-mono tabular">
                      {periodLabel}
                    </span>
                  </td>

                  {/* Confidence & Method */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-1.5">
                      <ConfidenceBadge confidence={fact.confidence} state={fact.state} />
                      <span
                        className="text-[10px] text-neutral-500 font-mono px-1 py-0.5 bg-neutral-100 border border-hairline rounded"
                        title={`Matched via: ${fact.match_method}`}
                      >
                        {fact.match_method}
                      </span>
                    </div>
                  </td>

                  {/* Source Locator */}
                  <td className="py-3 px-3.5">
                    <SourceLink locator={fact.locator} />
                  </td>

                  {/* Actions & Contextual Ask */}
                  <td className="py-3 px-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openExplainDrawer(fact.fact_id)}
                        className="px-2 py-1 rounded bg-neutral-100 hover:bg-forest/10 hover:text-forest text-[11px] font-medium border border-hairline flex items-center gap-1 transition-colors"
                        title="Why was this mapped here? (Grounding ledger explanation)"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-forest" />
                        <span>Why mapped?</span>
                      </button>

                      <ReviewActions
                        factId={fact.fact_id}
                        currentState={fact.state}
                        concepts={concepts}
                        onReview={onReview}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Contextual Ask / Grounding Drawer ── */}
      {selectedFactId && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-surface border-l border-hairline shadow-2xl z-50 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-hairline mb-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-forest" />
                <h3 className="font-display font-semibold text-lg text-ink">
                  Grounding & Mapping Ledger
                </h3>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-ink transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDrawer ? (
              <div className="py-20 text-center text-xs text-neutral-500">
                Retrieving verifiable ledger trail...
              </div>
            ) : drawerData ? (
              <div className="space-y-5 text-xs">
                {/* Question query */}
                <div className="p-3.5 rounded-xl bg-forest/5 border border-forest/20 text-ink">
                  <div className="text-[11px] font-mono text-forest uppercase font-semibold">
                    Question Answered from Ledger
                  </div>
                  <div className="font-medium text-sm mt-0.5">
                    &ldquo;Why was &apos;{drawerData.raw_label}&apos; mapped to &apos;{drawerData.assigned_concept}&apos;?&rdquo;
                  </div>
                </div>

                {/* Deterministic Explanation */}
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-ink uppercase text-[11px] font-mono">
                    Deterministic Mapping Rule
                  </h4>
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-hairline text-neutral-700 leading-relaxed font-normal">
                    {drawerData.mapping_rule}
                  </div>
                </div>

                {/* Canonical Concept Details */}
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-ink uppercase text-[11px] font-mono">
                    Target Concept Definition
                  </h4>
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-hairline space-y-1 text-neutral-700">
                    <div className="font-bold text-forest font-mono">{drawerData.assigned_concept}</div>
                    <div className="text-ink font-medium">{drawerData.concept_title}</div>
                    <div className="text-neutral-500">{drawerData.concept_definition}</div>
                  </div>
                </div>

                {/* Provenance & Citation */}
                <div className="space-y-1.5">
                  <h4 className="font-semibold text-ink uppercase text-[11px] font-mono">
                    Source Provenance & Hash
                  </h4>
                  <div className="p-3.5 rounded-xl bg-neutral-50 border border-hairline space-y-1 text-[11px] font-mono">
                    <div>Document: {drawerData.provenance?.document}</div>
                    <div className="text-neutral-400 truncate">SHA-256: {drawerData.provenance?.document_hash}</div>
                    <div>Period: {drawerData.provenance?.period}</div>
                    <div>Extracted Value: {drawerData.provenance?.value} {drawerData.provenance?.unit}</div>
                  </div>
                </div>

                {/* Audit Trail */}
                {drawerData.audit_trail && drawerData.audit_trail.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-ink uppercase text-[11px] font-mono">
                      Audit Ledger Block Signatures
                    </h4>
                    <div className="p-3 rounded-xl bg-neutral-50 border border-hairline space-y-2">
                      {drawerData.audit_trail.map((t: any) => (
                        <div key={t.entry_id} className="flex justify-between items-center text-[10px] font-mono">
                          <span className="font-bold text-forest">Block #{t.entry_id} ({t.event})</span>
                          <span className="text-neutral-400">{t.hash}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-neutral-500">
                Failed to retrieve explanation for this item.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-hairline mt-6 flex justify-between items-center text-xs text-neutral-400">
            <span>Verified Grounding</span>
            <button
              onClick={closeDrawer}
              className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-ink font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
