"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExceptionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"abstained" | "conflicts">("abstained");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exceptions");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load exceptions queue:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const abstained = data?.abstained || [];
  const conflicts = data?.conflicts || [];

  return (
    <div className="min-h-screen bg-canvas text-ink font-ui antialiased">
      <header className="border-b border-hairline bg-canvas/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display font-medium text-xl text-ink hover:text-forest">
              Draythos
            </Link>
            <span className="text-hairline text-sm">|</span>
            <nav className="flex items-center gap-5 text-sm font-medium text-neutral-600">
              <Link href="/app/dashboard" className="hover:text-ink">Overview</Link>
              <Link href="/app/dataroom" className="hover:text-ink">Data Room</Link>
              <Link href="/app/jurisdictions" className="hover:text-ink">Jurisdictions</Link>
              <span className="text-ink font-semibold">Exceptions</span>
              <Link href="/app/review" className="hover:text-ink">Review Grid</Link>
              <Link href="/app/ledger" className="hover:text-ink">Audit Ledger</Link>
            </nav>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono tracking-widest uppercase text-warning font-semibold">
              TRIAGING QUEUE
            </span>
            <h1 className="font-display text-3xl font-semibold text-ink mt-1">
              Exceptions & Conflicts Queue
            </h1>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              Deterministic governance: items where confidence is below 80% (Abstained), or where multiple documents claim divergent numbers for the same concept and period (Conflicts).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTab("abstained")}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === "abstained"
                  ? "bg-forest text-paper shadow-xs"
                  : "bg-surface border border-hairline text-neutral-600 hover:text-ink"
              }`}
            >
              Abstained Items ({abstained.length})
            </button>
            <button
              onClick={() => setTab("conflicts")}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                tab === "conflicts"
                  ? "bg-forest text-paper shadow-xs"
                  : "bg-surface border border-hairline text-neutral-600 hover:text-ink"
              }`}
            >
              Conflicts Queue ({conflicts.length})
            </button>
          </div>
        </div>

        {tab === "abstained" && (
          <div className="rounded-xl border border-hairline bg-surface overflow-hidden shadow-xs">
            <div className="px-5 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs">
              <span className="font-medium text-ink">Low-Confidence Abstained Extractions</span>
              <span className="text-neutral-500">Requires Maker-Checker Confirmation</span>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50/50 border-b border-hairline text-neutral-500 font-mono text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Raw Surface Label</th>
                  <th className="py-2.5 px-4 font-semibold">Proposed Concept</th>
                  <th className="py-2.5 px-4 font-semibold">Document</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Extracted Value</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Confidence</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {abstained.map((item: any) => (
                  <tr key={item.fact_id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-ink">{item.raw_label}</td>
                    <td className="py-3 px-4 font-mono text-forest">{item.concept_id}</td>
                    <td className="py-3 px-4 text-neutral-500">{item.filename || item.doc_id}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                      {item.value_num ? Number(item.value_num).toLocaleString() : item.value_num} {item.unit}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-warning-soft text-warning border border-warning/30 font-mono font-semibold text-[10px]">
                        {(Number(item.confidence || 0.65) * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href="/app/review"
                        className="text-xs text-forest hover:underline inline-flex items-center gap-0.5"
                      >
                        Resolve →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "conflicts" && (
          <div className="rounded-xl border border-hairline bg-surface overflow-hidden shadow-xs">
            <div className="px-5 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs">
              <span className="font-medium text-ink">Divergent Period Value Conflicts</span>
              <span className="text-neutral-500">Same concept and reporting period with differing values</span>
            </div>

            {conflicts.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-500">
                No active conflicts detected across indexed documents.
              </div>
            ) : (
              <div className="divide-y divide-hairline">
                {conflicts.map((c: any, i: number) => (
                  <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="font-mono text-forest font-semibold">{c.concept_id} • Period: {c.period}</div>
                      <div className="text-neutral-600">Conflict between Source 1 and Source 2</div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="p-2.5 rounded-lg bg-neutral-50 border border-hairline">
                        <div className="text-[10px] text-neutral-400">{c.doc1_id}</div>
                        <div className="font-mono font-bold text-ink">{c.val1?.toLocaleString()}</div>
                      </div>

                      <span className="font-bold text-neutral-400">VS</span>

                      <div className="p-2.5 rounded-lg bg-neutral-50 border border-hairline">
                        <div className="text-[10px] text-neutral-400">{c.doc2_id}</div>
                        <div className="font-mono font-bold text-forest">{c.val2?.toLocaleString()}</div>
                      </div>
                    </div>

                    <Link
                      href="/app/review"
                      className="px-3 py-1.5 rounded-lg bg-forest text-paper text-xs font-medium hover:bg-forest-deep text-center"
                    >
                      Arbitrate Conflict
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
