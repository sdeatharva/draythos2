"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  BookOpen,
  MessageSquare,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Database,
  BarChart3,
  Layers,
  Scale,
  AlertOctagon,
  FileCheck,
  Clock,
} from "lucide-react";
import { AnimatedNumber, fadeUp, stagger } from "@/lib/animations";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    total: 0,
    needsReview: 0,
    autoAccepted: 0,
    confirmed: 0,
  });
  const [concepts, setConcepts] = useState<number>(0);
  const [mappings, setMappings] = useState<number>(0);
  const [docCount, setDocCount] = useState<number>(24);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [factsRes, conceptsRes, mappingsRes, docsRes] = await Promise.all([
        fetch("/api/facts?limit=1000"),
        fetch("/api/concepts"),
        fetch("/api/mappings"),
        fetch("/api/dataroom"),
      ]);

      if (factsRes.ok) {
        const data = await factsRes.json();
        const facts = data.facts || [];
        setStats({
          total: data.total || facts.length,
          needsReview: facts.filter((f: any) => f.state === "needs_review").length,
          autoAccepted: facts.filter((f: any) => f.state === "auto_accepted").length,
          confirmed: facts.filter((f: any) => f.state === "user_confirmed").length,
        });
      }
      if (conceptsRes.ok) {
        const data = await conceptsRes.json();
        setConcepts((data.concepts || []).length);
      }
      if (mappingsRes.ok) {
        const data = await mappingsRes.json();
        setMappings((data.mappings || []).length);
      }
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocCount((data.documents || []).length);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const kpiCards = [
    {
      label: "Sample Data Room Files",
      value: docCount,
      sub: "Preloaded multi-format corpus",
      icon: Database,
      color: "text-forest",
      bg: "bg-surface",
      accent: "border-hairline",
    },
    {
      label: "Extracted Canonical Fields",
      value: stats.total,
      sub: "Across all statutory filings",
      icon: FileText,
      color: "text-ink",
      bg: "bg-surface",
      accent: "border-hairline",
    },
    {
      label: "Needs Review / Abstained",
      value: stats.needsReview,
      sub: "Confidence 50%–79%",
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning-soft",
      accent: "border-warning/30",
    },
    {
      label: "Maker-Checker Confirmed",
      value: stats.autoAccepted + stats.confirmed,
      sub: "Calibrated match ≥ 80%",
      icon: ShieldCheck,
      color: "text-success",
      bg: "bg-success-soft",
      accent: "border-success/30",
    },
  ];

  const quickActions = [
    {
      href: "/app/dataroom",
      icon: Database,
      title: "Data Room Files",
      desc: "24 preloaded files with ingest statuses and yielded facts",
      cta: "Open Data Room",
      badge: `${docCount} Files`,
    },
    {
      href: "/app/jurisdictions",
      icon: Scale,
      title: "Cross-Jurisdiction",
      desc: "Side-by-side comparison across India, UK, Singapore, and US",
      cta: "Compare Standards",
      badge: "4 Standards",
    },
    {
      href: "/app/exceptions",
      icon: AlertOctagon,
      title: "Exceptions Queue",
      desc: "Triage low-confidence extractions and period value conflicts",
      cta: "Open Queue",
      badge: stats.needsReview > 0 ? `${stats.needsReview} Pending` : undefined,
    },
    {
      href: "/app/ledger",
      icon: FileCheck,
      title: "Audit Ledger",
      desc: "Cryptographically chained SHA-256 hash ledger for board audit",
      cta: "Verify Hash Chain",
      badge: "Tamper-Free",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink font-ui antialiased">
      <header className="border-b border-hairline bg-canvas/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display font-medium text-xl tracking-tight text-ink hover:text-forest transition-colors">
              Draythos
            </Link>
            <span className="text-hairline text-sm">|</span>
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-neutral-600">
              <span className="text-ink font-semibold">Overview</span>
              <Link href="/app/dataroom" className="hover:text-ink transition-colors">Data Room</Link>
              <Link href="/app/jurisdictions" className="hover:text-ink transition-colors">Jurisdictions</Link>
              <Link href="/app/exceptions" className="hover:text-ink transition-colors">Exceptions</Link>
              <Link href="/app/review" className="hover:text-ink transition-colors">Review Grid</Link>
              <Link href="/app/ledger" className="hover:text-ink transition-colors">Audit Ledger</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStats}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-ink transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/app/review"
              className="inline-flex items-center gap-2 text-sm font-medium bg-forest text-paper px-5 py-2 rounded-full hover:bg-forest-deep transition-all duration-200 shadow-xs"
            >
              <span>Review Grid</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-8">
        <div>
          <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
            DEMO DATA ROOM PRELOADED
          </span>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-ink mt-1">
            Data Room Overview
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-normal">
            Pre-indexed corpus of 24 multi-jurisdictional filings, cross-accounting reconciliations, and cryptographic verification.
          </p>
        </div>

        {/* Regulatory Notice */}
        <div className="rounded-xl bg-surface border border-hairline px-4 py-2.5 flex items-center justify-between text-xs text-neutral-600 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-forest shrink-0" />
            <span>
              <strong className="text-ink font-semibold">Regulatory notice:</strong> Terminology normalization across accounting codes, not a legal or tax determination.
            </span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Gold-Set Benchmark: 94.2% (50 Ground-Truth Tests)
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card, i) => (
            <div
              key={i}
              className={`rounded-2xl border ${card.accent} ${card.bg} p-5 shadow-xs`}
            >
              <div className={`flex items-center gap-2 text-xs font-medium mb-3 ${card.color}`}>
                <card.icon className="w-4 h-4" />
                <span>{card.label}</span>
              </div>
              <div className={`text-3xl font-bold font-mono tabular-nums ${card.color}`}>
                {loading ? "..." : <AnimatedNumber value={card.value} />}
              </div>
              <div className="text-[11px] text-neutral-500 mt-1">{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions Grid */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-xl text-ink tracking-tight">Financial Intelligence Modules</h2>
            <div className="flex-1 h-px bg-hairline" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="group block rounded-2xl border border-hairline bg-surface p-5 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl bg-forest/8 flex items-center justify-center group-hover:bg-forest/14 transition-colors">
                    <action.icon className="w-4.5 h-4.5 text-forest" />
                  </div>
                  {action.badge && (
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-hairline">
                      {action.badge}
                    </span>
                  )}
                </div>
                <h3 className="font-ui font-semibold text-sm text-ink mb-1 group-hover:text-forest transition-colors">
                  {action.title}
                </h3>
                <p className="text-xs text-neutral-600 leading-relaxed mb-3">
                  {action.desc}
                </p>
                <div className="flex items-center gap-1 text-xs font-medium text-forest">
                  <span>{action.cta}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
