"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FactsGrid } from "@/components/review/FactsGrid";
import { ExportMenu } from "@/components/review/ExportMenu";

function AnimatedNumber({ value, duration = 900 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
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

function MetricSkeleton() {
  return (
    <div className="bg-surface border border-hairline rounded-xl p-4 shadow-xs space-y-2">
      <div className="h-3 w-24 rounded animate-shimmer" />
      <div className="h-7 w-12 rounded animate-shimmer" />
      <div className="h-2.5 w-20 rounded animate-shimmer" />
    </div>
  );
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as any } },
};

export default function ReviewPage() {
  const [facts, setFacts] = useState<any[]>([]);
  const [concepts, setConcepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const conceptsRes = await fetch("/api/concepts");
      if (conceptsRes.ok) {
        const cData = await conceptsRes.json();
        setConcepts(cData.concepts || []);
      }

      const params = new URLSearchParams();
      if (stateFilter !== "all") params.append("state", stateFilter);
      if (kindFilter !== "all") params.append("kind", kindFilter);
      if (search.trim()) params.append("search", search.trim());
      params.append("limit", "200");

      const factsRes = await fetch(`/api/facts?${params.toString()}`);
      if (factsRes.ok) {
        const fData = await factsRes.json();
        setFacts(fData.facts || []);
        setTotal(fData.total || 0);
      }
    } catch (err) {
      console.error("Failed to load review facts:", err);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, kindFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async (
    factId: string,
    action: "accept" | "reject" | "reassign",
    newConceptId?: string
  ) => {
    try {
      const res = await fetch(`/api/facts/${factId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          new_concept_id: newConceptId,
          by: "analyst",
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setFacts((prev) =>
          prev.map((f) => (f.fact_id === factId ? updated : f))
        );
      }
    } catch (err) {
      console.error("Review action error:", err);
    }
  };

  const needsReviewCount = facts.filter((f) => f.state === "needs_review").length;
  const autoAcceptedCount = facts.filter((f) => f.state === "auto_accepted").length;
  const confirmedCount = facts.filter((f) => f.state === "user_confirmed").length;
  const resolvedPct = total > 0
    ? Math.round(((autoAcceptedCount + confirmedCount) / total) * 100)
    : 0;

  const metricCards = [
    {
      label: "Total extracted fields",
      value: total,
      sub: "Across data room files",
      icon: TrendingUp,
      valueClass: "text-ink",
      iconClass: "text-neutral-600",
    },
    {
      label: "Needs review",
      value: needsReviewCount,
      sub: "Confidence 50%–79%",
      icon: AlertTriangle,
      valueClass: "text-warning",
      iconClass: "text-warning",
    },
    {
      label: "Auto-accepted",
      value: autoAcceptedCount,
      sub: "Calibrated score ≥ 80%",
      icon: CheckCircle2,
      valueClass: "text-success",
      iconClass: "text-success",
    },
    {
      label: "User confirmed",
      value: confirmedCount,
      sub: "Human approved",
      icon: ShieldCheck,
      valueClass: "text-ink",
      iconClass: "text-neutral-600",
    },
  ];

  const statusTabs = [
    { id: "all", label: "All status" },
    { id: "needs_review", label: "Needs review" },
    { id: "auto_accepted", label: "Auto-accepted" },
    { id: "user_confirmed", label: "Confirmed" },
    { id: "rejected", label: "Rejected" },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink font-ui antialiased">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8 space-y-6">
        {/* Navigation & Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" as any }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/app/dashboard"
                className="inline-flex items-center text-xs text-ink-soft hover:text-ink transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to dashboard
              </Link>
              <span className="text-cloud-dark">·</span>
              <Link
                href="/app/concepts"
                className="text-xs text-forest hover:underline transition-colors"
              >
                Concept map editor →
              </Link>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
              Field translation review
            </h1>
            <p className="text-xs text-ink-soft mt-1 max-w-2xl font-normal">
              Inspect candidate financial fields across data room files, verify canonical concept mappings, and export consolidated workbooks with exact source citations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-8 px-3 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ExportMenu />
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

        {/* Metric Cards */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3.5"
          initial="hidden"
          animate="visible"
          variants={stagger}
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
            : metricCards.map((card, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="bg-surface border border-hairline rounded-xl p-4 shadow-xs"
                >
                  <div className={`text-xs font-medium flex items-center gap-1.5 mb-2 ${card.iconClass}`}>
                    <card.icon className="w-3.5 h-3.5" />
                    <span className="text-ink-soft">{card.label}</span>
                  </div>
                  <div className={`text-2xl font-bold font-mono tabular-nums ${card.valueClass}`}>
                    <AnimatedNumber value={card.value} />
                  </div>
                  <div className="text-[11px] text-cloud-dark mt-0.5">{card.sub}</div>
                </motion.div>
              ))}
        </motion.div>

        {/* Progress Bar */}
        <AnimatePresence>
          {total > 0 && !loading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-xl bg-surface border border-hairline px-4 py-3 shadow-xs overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="text-ink-soft">Review progress</span>
                <span className="font-mono font-semibold text-forest">{resolvedPct}% complete</span>
              </div>
              <div className="h-1.5 bg-hairline rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-forest rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${resolvedPct}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: "easeOut" as any }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters Bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-surface border border-hairline rounded-xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStateFilter(tab.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  stateFilter === tab.id
                    ? "bg-forest text-paper shadow-xs"
                    : "text-ink-soft hover:text-ink hover:bg-oat/50"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <span className="text-hairline hidden md:inline px-1">|</span>

            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="h-8 text-xs bg-oat border border-hairline rounded-lg px-2.5 text-ink focus:outline-none focus:border-forest/50 transition-colors"
            >
              <option value="all">All families</option>
              <option value="fs">Financials (fs.*)</option>
              <option value="tax">Taxation (tax.*)</option>
              <option value="cmp">Compliance (cmp.*)</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cloud-dark" />
            <input
              type="text"
              placeholder="Search labels, values…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-2.5 text-xs bg-oat border border-hairline rounded-lg text-ink placeholder:text-cloud-dark focus:outline-none focus:border-forest/50 w-full transition-colors"
            />
          </div>
        </motion.div>

        {/* Facts Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <FactsGrid
            facts={facts}
            concepts={concepts}
            onReview={handleReview}
            loading={loading}
          />
        </motion.div>
      </div>
    </div>
  );
}
