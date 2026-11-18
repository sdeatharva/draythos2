"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Scale,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Globe,
  FileText,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CrossJurisdictionPage() {
  const [data, setData] = useState<any>(null);
  const [selectedConcept, setSelectedConcept] = useState("fs.revenue");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (concept: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cross-jurisdiction?concept=${encodeURIComponent(concept)}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load cross jurisdiction comparison:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(selectedConcept);
  }, [loadData, selectedConcept]);

  const jurisdictions = [
    { code: "IN", name: "India", standard: "Ind AS 115 / Companies Act", currency: "INR" },
    { code: "UK", name: "United Kingdom", standard: "UK GAAP / FRS 102", currency: "GBP" },
    { code: "SG", name: "Singapore", standard: "SFRS(I) 15 / ACRA", currency: "SGD" },
    { code: "US", name: "United States", standard: "US GAAP / ASC 606", currency: "USD" },
  ];

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
              <span className="text-ink font-semibold">Jurisdictions</span>
              <Link href="/app/exceptions" className="hover:text-ink">Exceptions</Link>
              <Link href="/app/review" className="hover:text-ink">Review Grid</Link>
              <Link href="/app/ledger" className="hover:text-ink">Audit Ledger</Link>
            </nav>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadData(selectedConcept)} className="h-8 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
              MULTINATIONAL HARMONIZATION
            </span>
            <h1 className="font-display text-3xl font-semibold text-ink mt-1">
              Cross-Jurisdiction Comparison
            </h1>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              Inspect how one canonical financial concept maps and calculates across statutory accounting standards: India (Ind AS), United Kingdom (UK GAAP), Singapore (SFRS), and United States (US GAAP).
            </p>
          </div>

          {/* Concept selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-neutral-600">Select Concept:</label>
            <select
              value={selectedConcept}
              onChange={(e) => setSelectedConcept(e.target.value)}
              className="text-xs font-mono bg-neutral-50 border border-hairline rounded-lg px-3 py-1.5 text-ink focus:outline-none focus:border-forest"
            >
              <option value="fs.revenue">fs.revenue (Topline / Turnover)</option>
              <option value="fs.opex">fs.opex (Operating Expenses)</option>
              <option value="fs.operating_income">fs.operating_income (EBIT)</option>
              <option value="fs.net_income">fs.net_income (Profit After Tax)</option>
              <option value="tax.corporate_tax">tax.corporate_tax (Corporation Tax)</option>
            </select>
          </div>
        </div>

        {/* Regulatory Banner */}
        <div className="rounded-xl bg-surface border border-hairline px-4 py-3 flex items-center justify-between text-xs text-neutral-600 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-forest shrink-0" />
            <span>
              <strong className="text-ink font-semibold">Standard Harmonization:</strong> Terminology normalization across accounting codes, not a legal or tax determination.
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Active Concept: {data?.selectedConcept || selectedConcept}
          </span>
        </div>

        {/* 4-Column Grid: IN, UK, SG, US */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {jurisdictions.map((jur) => {
            const facts = data?.comparison?.[jur.code] || [];
            return (
              <div
                key={jur.code}
                className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-hairline mb-3">
                    <div>
                      <span className="font-display font-semibold text-lg text-ink">
                        {jur.name}
                      </span>
                      <div className="text-[10px] font-mono text-forest uppercase font-semibold">
                        {jur.standard}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 font-mono text-xs font-bold text-ink">
                      {jur.code}
                    </span>
                  </div>

                  {facts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-400">
                      No extracted fact for {selectedConcept} in {jur.name}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {facts.map((fact: any) => (
                        <div
                          key={fact.fact_id}
                          className="p-3 rounded-xl bg-neutral-50/70 border border-hairline space-y-1.5 text-xs"
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-ink">{fact.raw_label}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {(Number(fact.confidence || 0.9) * 100).toFixed(0)}% Match
                            </span>
                          </div>

                          <div className="text-xl font-bold font-mono text-forest">
                            {fact.value_num ? fact.value_num.toLocaleString() : "N/A"}{" "}
                            <span className="text-xs font-normal text-neutral-500 font-ui">
                              {fact.unit || jur.currency}
                            </span>
                          </div>

                          <div className="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-hairline">
                            <span className="truncate max-w-[140px]">{fact.filename || fact.doc_id}</span>
                            <span className="font-mono text-neutral-400">{fact.period || "FY24"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-hairline text-[11px] text-neutral-400 flex items-center justify-between">
                  <span>Reporting Base: {jur.currency}</span>
                  <Link href="/app/review" className="text-forest hover:underline">
                    Inspect locators →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
