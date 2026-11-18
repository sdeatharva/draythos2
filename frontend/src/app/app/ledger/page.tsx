"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileCheck,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Hash,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LedgerPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit?limit=100");
      if (res.ok) {
        const json = await res.json();
        setEntries(json.entries || []);
      }
    } catch (err) {
      console.error("Failed to load audit ledger:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/audit?verify=true");
      if (res.ok) {
        const result = await res.json();
        setVerificationResult(result);
      }
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

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
              <Link href="/app/exceptions" className="hover:text-ink">Exceptions</Link>
              <Link href="/app/review" className="hover:text-ink">Review Grid</Link>
              <span className="text-ink font-semibold">Audit Ledger</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyChain}
              disabled={verifying}
              className="h-8 text-xs border-forest text-forest hover:bg-forest/5"
            >
              <ShieldCheck className={`w-3.5 h-3.5 mr-1.5 ${verifying ? "animate-spin" : ""}`} />
              {verifying ? "Verifying..." : "Verify Hash Chain"}
            </Button>
            <Button variant="outline" size="sm" onClick={loadLedger} className="h-8 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
              TAMPER-EVIDENT GOVERNANCE
            </span>
            <h1 className="font-display text-3xl font-semibold text-ink mt-1">
              Cryptographic Audit Ledger
            </h1>
            <p className="text-xs text-neutral-600 mt-1 max-w-2xl">
              Every document ingest, extraction, and maker-checker approval is chained into an immutable SHA-256 hash log for board committees and statutory audits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/export/xlsx"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-forest text-paper hover:bg-forest-deep shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Board-Ready Export
            </a>
          </div>
        </div>

        {/* Verification Status Banner */}
        {verificationResult && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs shadow-xs ${
              verificationResult.verified
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {verificationResult.verified ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              <div>
                <div className="font-semibold text-sm">
                  {verificationResult.verified
                    ? "Cryptographic Hash Chain Verified (100% Intact)"
                    : "Hash Chain Verification Failed"}
                </div>
                <div className="text-[11px] opacity-80">
                  {verificationResult.total_entries} consecutive block hashes checked using {verificationResult.algorithm}.
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-bold uppercase">
              {verificationResult.verified ? "TAMPER-FREE" : "VIOLATION"}
            </span>
          </div>
        )}

        {/* Ledger Entries Table */}
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden shadow-xs">
          <div className="px-5 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">Ledger Blocks (Chronological Order)</span>
            <span className="font-mono text-[11px] text-neutral-500">Algorithm: SHA-256</span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-hairline text-neutral-500 font-mono text-[11px]">
                <th className="py-2.5 px-4 font-semibold">Block #</th>
                <th className="py-2.5 px-4 font-semibold">Event Type</th>
                <th className="py-2.5 px-4 font-semibold">Entity / Target</th>
                <th className="py-2.5 px-4 font-semibold">Previous Hash</th>
                <th className="py-2.5 px-4 font-semibold">Block Hash</th>
                <th className="py-2.5 px-4 font-semibold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline font-mono text-[11px]">
              {entries.map((e) => (
                <tr key={e.entry_id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-forest">#{e.entry_id}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-semibold">
                      {e.event_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-ink font-ui font-medium">{e.entity_id}</td>
                  <td className="py-3 px-4 text-neutral-400 truncate max-w-[120px]">
                    {e.prev_hash.substring(0, 16)}...
                  </td>
                  <td className="py-3 px-4 text-forest font-bold truncate max-w-[140px]">
                    {e.current_hash.substring(0, 16)}...
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400 font-ui text-xs">
                    {new Date(e.created_at).toLocaleTimeString()}
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
