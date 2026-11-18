"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  FileSpreadsheet,
  Layers,
  Database,
  Search,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DataRoomPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dataroom");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error("Failed to load dataroom:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.filename?.toLowerCase().includes(search.toLowerCase()) ||
      doc.entity?.toLowerCase().includes(search.toLowerCase()) ||
      doc.jurisdiction?.toLowerCase().includes(search.toLowerCase());
    const matchesFormat =
      formatFilter === "all" || doc.format?.toLowerCase() === formatFilter;
    return matchesSearch && matchesFormat;
  });

  const totalFactsYielded = documents.reduce(
    (acc, d) => acc + (Number(d.fact_count) || 0),
    0
  );

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
              <span className="text-ink font-semibold">Data Room</span>
              <Link href="/app/jurisdictions" className="hover:text-ink">Jurisdictions</Link>
              <Link href="/app/exceptions" className="hover:text-ink">Exceptions</Link>
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
            <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
              INGESTION INVENTORY
            </span>
            <h1 className="font-display text-3xl font-semibold text-ink mt-1">
              Sample Data Room Files
            </h1>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              24 pre-indexed data room files spanning SEC 10-K filings, Indian annual reports (Ind AS), UK accounts, Excel models, and compliance memorandums.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-forest">{totalFactsYielded}</div>
              <div className="text-[11px] text-neutral-500">Total Facts Yielded</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-hairline rounded-xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {["all", "pdf", "xlsx", "docx", "csv"].map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormatFilter(fmt)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors uppercase ${
                  formatFilter === fmt
                    ? "bg-forest text-paper"
                    : "text-neutral-600 hover:text-ink hover:bg-neutral-100"
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search files, entities, jurisdictions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs bg-neutral-50 border border-hairline rounded-lg w-full focus:outline-none focus:border-forest"
            />
          </div>
        </div>

        {/* Documents Table */}
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-hairline text-neutral-500 font-mono text-[11px]">
                <th className="py-3 px-4 font-semibold">Document Name</th>
                <th className="py-3 px-4 font-semibold">Entity</th>
                <th className="py-3 px-4 font-semibold">Jurisdiction</th>
                <th className="py-3 px-4 font-semibold">Ingest Status</th>
                <th className="py-3 px-4 font-semibold text-right">Facts Yielded</th>
                <th className="py-3 px-4 font-semibold text-right">Verified</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredDocs.map((doc) => (
                <tr key={doc.doc_id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {doc.format === "xlsx" || doc.format === "csv" ? (
                        <FileSpreadsheet className="w-4 h-4 text-forest shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-forest shrink-0" />
                      )}
                      <div>
                        <div className="font-medium text-ink">{doc.filename}</div>
                        <div className="text-[10px] font-mono text-neutral-400 truncate max-w-xs">
                          {doc.sha256?.substring(0, 16)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-ink">{doc.entity || "Acme Corp"}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-hairline text-[10px] font-mono font-semibold text-neutral-700">
                      {doc.jurisdiction || "US"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Indexed
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-ink">
                    {doc.fact_count}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                    {doc.verified_count || 0}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href="/app/review"
                      className="text-xs text-forest hover:underline inline-flex items-center gap-0.5"
                    >
                      Review facts →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
