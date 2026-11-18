"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  TrendingUp,
  Clock,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay, ease: "easeOut" as any },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const start = performance.now();
    const raf = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [value, duration]);
  return <span>{display}</span>;
}

interface FactStats {
  total: number;
  needsReview: number;
  autoAccepted: number;
  confirmed: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<FactStats>({
    total: 0,
    needsReview: 0,
    autoAccepted: 0,
    confirmed: 0,
  });
  const [concepts, setConcepts] = useState<number>(0);
  const [mappings, setMappings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [factsRes, conceptsRes, mappingsRes] = await Promise.all([
        fetch("/api/facts?limit=1000"),
        fetch("/api/concepts"),
        fetch("/api/mappings"),
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
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const kpiCards = [
    {
      label: "Total Extracted Fields",
      value: stats.total,
      sub: "Across all data room files",
      icon: Database,
      color: "text-ink",
      bg: "bg-surface",
      accent: "border-hairline",
    },
    {
      label: "Needs Review",
      value: stats.needsReview,
      sub: "Confidence 50%–79%",
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning-soft",
      accent: "border-warning/30",
    },
    {
      label: "Auto-Accepted",
      value: stats.autoAccepted,
      sub: "Calibrated score ≥ 80%",
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success-soft",
      accent: "border-success/30",
    },
    {
      label: "User Confirmed",
      value: stats.confirmed,
      sub: "Human-approved facts",
      icon: ShieldCheck,
      color: "text-forest",
      bg: "bg-surface",
      accent: "border-hairline",
    },
  ];

  const quickActions = [
    {
      href: "/app/review",
      icon: FileText,
      title: "Review Facts",
      desc: "Inspect and confirm extracted financial fields",
      cta: "Open Review Grid",
      badge: stats.needsReview > 0 ? `${stats.needsReview} pending` : undefined,
      badgeColor: "bg-warning-soft text-warning border-warning/30",
    },
    {
      href: "/app/concepts",
      icon: BookOpen,
      title: "Concept Taxonomy",
      desc: "Edit synonyms and financial concept alignments",
      cta: "Open Synonym Editor",
      badge: mappings > 0 ? `${mappings} mappings` : undefined,
      badgeColor: "bg-brand-lavender text-ink border-brand-lavender/60",
    },
    {
      href: "/chat",
      icon: MessageSquare,
      title: "Data Room Chat",
      desc: "Ask questions grounded in your uploaded documents",
      cta: "Open Workspace",
      badge: undefined,
      badgeColor: "",
    },
    {
      href: "/app/review",
      icon: FileSpreadsheet,
      title: "Export Workbooks",
      desc: "Download consolidated Excel with verified citations",
      cta: "Go to Export",
      badge: undefined,
      badgeColor: "",
    },
  ];

  const platformModules = [
    {
      icon: BarChart3,
      title: "Fact Intelligence",
      desc: `${stats.total} extracted fields · ${stats.needsReview} pending review`,
      href: "/app/review",
      status: stats.needsReview > 0 ? "action" : "healthy",
    },
    {
      icon: Layers,
      title: "Concept Taxonomy",
      desc: `${concepts} canonical concepts · ${mappings} synonym mappings`,
      href: "/app/concepts",
      status: "healthy",
    },
    {
      icon: MessageSquare,
      title: "Studio Workspace",
      desc: "Citation-grounded Q&A and dual-pane workbench",
      href: "/chat",
      status: "healthy",
    },
    {
      icon: TrendingUp,
      title: "Review Progress",
      desc: stats.total > 0
        ? `${Math.round(((stats.autoAccepted + stats.confirmed) / stats.total) * 100)}% complete`
        : "No facts loaded yet",
      href: "/app/review",
      status: "info",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink font-ui antialiased">
      {/* Top Nav */}
      <header className="border-b border-hairline bg-canvas/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-display font-medium text-xl tracking-tight text-ink hover:text-forest transition-colors">
              Draythos
            </Link>
            <span className="text-hairline text-sm">|</span>
            <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-neutral-600">
              <span className="text-ink font-semibold">Dashboard</span>
              <Link href="/app/review" className="hover:text-ink transition-colors">Review Grid</Link>
              <Link href="/app/concepts" className="hover:text-ink transition-colors">Concepts</Link>
              <Link href="/chat" className="hover:text-ink transition-colors">Workspace</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadStats}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-ink transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-100 border border-transparent hover:border-hairline"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 text-sm font-medium bg-forest text-paper px-5 py-2 rounded-full hover:bg-forest-deep hover:-translate-y-px active:scale-[0.98] transition-all duration-200 shadow-xs"
            >
              <span>Open Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-8">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" as any }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
                INTELLIGENCE HUB
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-ink">
              Data Room Overview
            </h1>
            <p className="text-sm text-neutral-600 mt-1 font-normal">
              Monitor extracted facts, review pending fields, and manage your financial concept taxonomy.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Refreshed {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </motion.div>

        {/* Regulatory Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-xl bg-surface border border-hairline px-4 py-2.5 flex items-center justify-between text-xs text-ink-soft shadow-xs"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-forest shrink-0" />
            <span>
              <strong className="text-ink font-semibold">Regulatory notice:</strong>{" "}
              Terminology normalization, not a legal determination.
            </span>
          </div>
          <span className="text-[11px] font-mono text-cloud-dark tabular hidden sm:block">
            Taxonomy: tax-1.0.0 | Model: enc-1.0.0
          </span>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {kpiCards.map((card, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              custom={i * 0.05}
              className={`rounded-2xl border ${card.accent} ${card.bg} p-5 shadow-xs`}
            >
              <div className={`flex items-center gap-2 text-xs font-medium mb-3 ${card.color}`}>
                <card.icon className="w-4 h-4" />
                <span>{card.label}</span>
              </div>
              <div className={`text-3xl font-bold font-mono tabular-nums ${card.color}`}>
                {loading ? (
                  <div className="h-8 w-16 rounded-lg animate-shimmer" />
                ) : (
                  <AnimatedNumber value={card.value} />
                )}
              </div>
              <div className="text-[11px] text-cloud-dark mt-1">{card.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" as any }}
        >
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-xl text-ink tracking-tight">Quick Actions</h2>
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
                    <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${action.badgeColor}`}>
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
        </motion.section>

        {/* Platform Status */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" as any }}
        >
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-xl text-ink tracking-tight">Platform Modules</h2>
            <div className="flex-1 h-px bg-hairline" />
          </div>
          <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
            {platformModules.map((mod, i) => (
              <Link
                key={i}
                href={mod.href}
                className={`group flex items-center gap-4 px-5 py-4 hover:bg-oat transition-colors ${
                  i < platformModules.length - 1 ? "border-b border-hairline" : ""
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-forest/8 flex items-center justify-center shrink-0 group-hover:bg-forest/14 transition-colors">
                  <mod.icon className="w-4.5 h-4.5 text-forest" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-ui font-semibold text-sm text-ink group-hover:text-forest transition-colors">
                    {mod.title}
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5 truncate">{mod.desc}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {mod.status === "action" && (
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-warning-soft text-warning border border-warning/30">
                      Action needed
                    </span>
                  )}
                  {mod.status === "healthy" && (
                    <span className="w-2 h-2 rounded-full bg-success" />
                  )}
                  {mod.status === "info" && (
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-brand-lavender text-ink border border-brand-lavender/60">
                      Progress
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-forest transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

        {/* Review Progress Bar */}
        {stats.total > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" as any }}
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 className="font-display text-xl text-ink tracking-tight">Review Progress</h2>
              <div className="flex-1 h-px bg-hairline" />
            </div>
            <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3 text-xs">
                <span className="font-medium text-ink">
                  {stats.autoAccepted + stats.confirmed} of {stats.total} fields resolved
                </span>
                <span className="font-mono font-semibold text-forest">
                  {Math.round(((stats.autoAccepted + stats.confirmed) / stats.total) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-hairline rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-forest rounded-full"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((stats.autoAccepted + stats.confirmed) / stats.total) * 100}%`,
                  }}
                  transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" as any }}
                />
              </div>
              <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success" />
                  {stats.autoAccepted} auto-accepted
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-forest" />
                  {stats.confirmed} confirmed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  {stats.needsReview} pending
                </span>
              </div>
            </div>
          </motion.section>
        )}
      </main>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}
