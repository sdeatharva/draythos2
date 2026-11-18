"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  FileText,
  Check,
  Copy,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Lock,
  Sparkles,
  FileSpreadsheet,
  CheckCircle2,
  ExternalLink,
  Database,
  Layers,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { motion, useInView, AnimatePresence } from "framer-motion";

/* ─── Animation helpers ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: "easeOut" as any },
  }),
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 1800,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const raf = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const targetHref = isAuthenticated ? "/app/dashboard" : "/login";

  const capabilities = [
    {
      id: "canvas",
      index: "01",
      domain: "WORKSPACE INTERFACE",
      title: "Native Artifact Canvas",
      summary:
        "Inspect and manipulate spreadsheets, PDFs, and contracts in a synchronized side-by-side workbench. Draythos never degrades documents into flattened markdown summaries—spreadsheets retain their underlying formula graph, cell relationships, and multi-sheet structure.",
      specimenType: "canvas",
    },
    {
      id: "provenance",
      index: "02",
      domain: "VERIFICATION & PROVENANCE",
      title: "Evidence Grounding & Citations",
      summary:
        "Every factual claim and synthesized metric is anchored to verified source passages. One click on any citation pill highlights the exact paragraph, table coordinate, or bounding box in the original document preview, eliminating hallucinations.",
      specimenType: "provenance",
    },
    {
      id: "sessions",
      index: "03",
      domain: "STATE & RETRIEVAL GRAPH",
      title: "Persistent, URL-Addressable Sessions",
      summary:
        "Every document exploration branch receives a permanent, shareable URL. Draythos stores your complete conversation branch, indexed document attachments, and active working copy revisions in a clean, local SQLite database.",
      specimenType: "sessions",
    },
    {
      id: "security",
      index: "04",
      domain: "SECURITY & KEY ISOLATION",
      title: "Cryptographic Key Isolation",
      summary:
        "Bring your own free-tier API keys from Google Gemini or OpenRouter. Draythos stores your credentials client-side with AES-256-GCM encryption, enforcing strict TLS 1.3 session isolation with no multi-tenant vector leakage or telemetry logging.",
      specimenType: "security",
    },
  ];

  const personas = [
    {
      role: "Financial Analysts & M&A Teams",
      description:
        "Reconcile variance across 10-K filings, operating models, and dataroom spreadsheets without losing cell references or formula dependencies.",
      badge: "Financial Models",
      points: [
        "Formula AST preserved across multi-tab XLSX files",
        "Cell-coordinate citations (e.g. Expenses!C14)",
        "Instant consolidation across historical periods",
      ],
    },
    {
      role: "Legal & Regulatory Auditors",
      description:
        "Verify warranties, covenants, and disclosure statements with clickable verbatim paragraph bounding boxes.",
      badge: "Compliance",
      points: [
        "Bounding-box overlays on native PDF viewports",
        "Direct export to verified audit trails",
        "Deterministic citations with zero synthetic drift",
      ],
    },
    {
      role: "Strategy & Executive Leadership",
      description:
        "Review critical company datasets and confidential reports with zero telemetry and client-side credential encryption.",
      badge: "Governance",
      points: [
        "Client BYOK architecture (Gemini & OpenRouter)",
        "Zero multi-tenant vector sharing or training leaks",
        "Permanent, URL-addressable SQLite session state",
      ],
    },
  ];

  const faqs = [
    {
      q: "How does Draythos differ from standard chat-with-PDF tools?",
      a: "Standard LLM wrappers flatten your documents into unverified markdown chunks, corrupting complex table relationships and dropping formulas. Draythos operates as a synchronized dual-pane workbench: spreadsheets retain their AST formula dependencies, PDFs render natively with bounding-box highlights, and every factual statement is anchored to verified source locators.",
    },
    {
      q: "Where are my API keys and documents stored?",
      a: "Draythos uses a client-isolated architecture. Your API keys are encrypted client-side using AES-256-GCM and transmitted only within authenticated session requests directly to your chosen provider. Your documents, extracted facts, and session histories are stored in a local SQLite database on your machine.",
    },
    {
      q: "Can I edit spreadsheets directly inside the workspace?",
      a: "Yes. Draythos creates a formula-safe working copy for every spreadsheet in your data room. You can inspect cell dependencies, adjust assumptions, review recomputed variances, and export consolidated .xlsx workbooks anytime.",
    },
    {
      q: "Does Draythos support financial concept mapping and synonym normalization?",
      a: "Yes. Draythos includes a built-in Concept Map & Synonym Editor with monotonic versioning. You can map surface terms (e.g., 'Topline', 'Turnover', 'Revenue') to canonical taxonomy concepts and see real-time impact previews across all data room files.",
    },
  ];

  const currentCap = capabilities[activeTab];

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://draythos.app/chat/c_8f12a04e");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  /* Proof strip stats — static labels with animated counters */
  const proofSignals = [
    {
      label: "Grounding Accuracy",
      sub: "Every claim linked to page, bbox, or cell",
      display: "100%",
      isStatic: true,
    },
    {
      label: "Client Key Isolation",
      sub: "Encrypted cookie vault, zero server telemetry",
      display: "AES-256",
      isStatic: true,
    },
    {
      label: "Formula Preservation",
      sub: "Multi-sheet Excel relationships stay intact",
      display: "AST Native",
      isStatic: true,
    },
    {
      label: "Sub-Second Locators",
      sub: "Local SQLite WAL vector state",
      display: "< 250ms",
      isStatic: true,
    },
  ];

  /* Product platform tiles for dashboard section */
  const platformTiles = [
    {
      icon: Database,
      title: "Fact Intelligence Hub",
      desc: "Review, accept, and export extracted financial facts from every document in your data room.",
      href: "/app/review",
      badge: "Live",
    },
    {
      icon: BookOpen,
      title: "Concept Taxonomy Editor",
      desc: "Map surface terms to canonical concepts. Live impact preview across all data room files.",
      href: "/app/concepts",
      badge: "Live",
    },
    {
      icon: BarChart3,
      title: "Synchronized Workbench",
      desc: "Dual-pane chat + artifact workspace with formula-safe spreadsheet editing and PDF citations.",
      href: "/chat",
      badge: "Live",
    },
    {
      icon: Layers,
      title: "Session Data Room",
      desc: "Every analysis session is URL-addressable, persistent, and recoverable with full document context.",
      href: "/chat",
      badge: "Included",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-brand-lavender selection:text-ink font-ui antialiased overflow-x-hidden">
      {/* ── 1. Navigation ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as any }}
        className="border-b border-hairline bg-canvas/90 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="font-display font-medium text-2xl tracking-tight text-ink group-hover:text-forest transition-colors">
              Draythos
            </span>
            <span className="text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full bg-brand-lavender text-ink font-semibold border border-brand-lavender/60">
              v1.0
            </span>
          </Link>

          {/* Center Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
            <a href="#workbench" className="hover:text-ink transition-colors">
              Workbench
            </a>
            <a href="#capabilities" className="hover:text-ink transition-colors">
              Capabilities
            </a>
            <a href="#platform" className="hover:text-ink transition-colors">
              Platform
            </a>
            <Link href="/app/review" className="hover:text-ink transition-colors">
              Review Grid
            </Link>
            <Link href="/app/concepts" className="hover:text-ink transition-colors">
              Synonym Catalog
            </Link>
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/app/dashboard"
                className="text-sm font-medium text-neutral-600 hover:text-ink transition-colors px-2"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-600 hover:text-ink transition-colors px-2"
              >
                Sign In
              </Link>
            )}
            <Link
              href={targetHref}
              className="inline-flex items-center gap-2 text-sm font-medium bg-forest text-paper px-6 py-2.5 rounded-full hover:bg-forest-deep hover:-translate-y-px active:scale-[0.98] transition-all duration-200 shadow-xs"
            >
              <span>Launch Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── 2. Hero ── */}
      <section className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-16 sm:pt-20 pb-16 text-center overflow-hidden">
        {/* Atmospheric glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <motion.div
            className="hero-glow"
            animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.07, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" as any }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-lavender text-ink text-xs font-medium border border-brand-lavender/80 shadow-xs mb-6"
        >
          <Sparkles className="w-3.5 h-3.5 text-forest" />
          <span>GROUNDED DOCUMENT INTELLIGENCE</span>
        </motion.div>

        {/* Mascot */}
        <motion.div
          className="mb-4 flex justify-center"
          initial={{ opacity: 0, scale: 0.9, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" as any }}
        >
          <motion.img
            src="/mascot.png"
            alt="Draythos Dragon Mascot"
            className="w-48 sm:w-56 md:w-64 h-auto object-contain drop-shadow-xs select-none will-change-transform"
            animate={{ y: [0, -10, -5, 0], rotate: [-0.5, 0.5, -0.3, -0.5] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="display-hero text-5xl sm:text-6xl md:text-7xl lg:text-[76px] tracking-tight text-ink mb-6 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" as any }}
        >
          Understand complex files.<br />
          <span className="italic text-forest">Verify every single claim.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" as any }}
        >
          Draythos transforms multi-sheet spreadsheets, SEC filings, and legal agreements into an evidence-grounded dual-pane workbench. Edit formula-safe working copies and inspect source citations with zero synthetic drift.
        </motion.p>

        {/* CTA Pair */}
        <motion.div
          className="flex flex-col sm:flex-row items-center gap-4 justify-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" as any }}
        >
          <Link
            href={targetHref}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 text-base font-medium bg-forest text-paper px-8 py-3.5 rounded-full hover:bg-forest-deep hover:-translate-y-px active:scale-[0.98] transition-all duration-200 shadow-xs group"
          >
            <span>{isAuthenticated ? "Enter Workspace" : "Launch Free Studio"}</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <a
            href="#workbench"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium bg-transparent border border-forest text-forest hover:bg-forest/5 px-8 py-3.5 rounded-full active:scale-[0.98] transition-all duration-200"
          >
            <span>See Live Specimen</span>
            <ChevronDown className="h-4 w-4" />
          </a>
        </motion.div>
      </section>

      {/* ── 3. Product Demonstration: Synchronized Dual-Pane Workbench ── */}
      <section id="workbench" className="max-w-6xl mx-auto px-6 sm:px-8 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: "easeOut" as any }}
          className="rounded-[28px] border border-hairline bg-surface p-2 sm:p-3 shadow-md overflow-hidden"
        >
          {/* Mock Browser Titlebar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline bg-neutral-50 rounded-t-[20px] text-xs font-mono text-neutral-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neutral-200" />
              <span className="w-3 h-3 rounded-full bg-neutral-200" />
              <span className="w-3 h-3 rounded-full bg-neutral-200" />
              <span className="ml-2 font-medium text-ink">draythos.app/chat/c_8f12a04e</span>
            </div>
            <div className="flex items-center gap-2">
              <motion.span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-lavender text-ink text-[11px] font-medium font-ui"
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <CheckCircle2 className="w-3 h-3 text-forest" />
                Evidence Grounded
              </motion.span>
            </div>
          </div>

          {/* Workbench Frame */}
          <div className="grid md:grid-cols-12 min-h-[460px] bg-canvas">
            {/* Left: Chat Pane */}
            <div className="md:col-span-6 p-6 border-b md:border-b-0 md:border-r border-hairline flex flex-col justify-between bg-surface/50">
              <div className="space-y-4">
                <div className="bg-neutral-50 border border-hairline rounded-2xl p-4 self-end max-w-[90%] ml-auto text-xs text-ink">
                  What was the total Q1 operating variance between actual and projected expense lines?
                </div>

                <div className="bg-surface border border-hairline rounded-2xl p-4 text-xs text-ink space-y-2.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-forest animate-pulse" />
                    <span className="font-ui font-medium text-ink">Grounded Verification</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    According to <strong className="text-ink font-semibold">Q1_Budget.xlsx</strong> (Sheet: Expenses), total actual operating expense was <strong className="text-ink">$180,000</strong> against a projected $165,000, representing a net variance of <strong className="text-forest">+$15,000 (+9.1%)</strong> driven primarily by cloud infrastructure renewals.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-50 text-[11px] font-mono text-ink border border-hairline">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-forest" />
                      Q1_Budget.xlsx • Expenses!C14
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-lavender/60 text-[11px] font-mono text-ink border border-brand-lavender">
                      100% Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="mt-6 pt-4 border-t border-hairline flex items-center gap-2">
                <div className="flex-1 h-11 bg-surface border border-hairline rounded-full px-4 flex items-center text-xs text-neutral-400 font-ui">
                  Ask questions across your data room…
                </div>
                <div className="h-11 w-11 rounded-full bg-forest text-paper flex items-center justify-center cursor-pointer hover:bg-forest-deep transition-colors shrink-0 shadow-xs">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Right: Spreadsheet Preview */}
            <div className="md:col-span-6 p-6 bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-forest" />
                    <span className="font-ui font-medium text-xs text-ink">Q1_Budget.xlsx</span>
                    <span className="font-mono text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">
                      FORMULA-SAFE
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">Sheet: Expenses</span>
                </div>

                {/* Formula Bar */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-50 border border-hairline mb-3 text-xs font-mono">
                  <span className="font-bold text-forest">fx</span>
                  <span className="text-neutral-400">=</span>
                  <span className="text-ink font-medium">SUM(B14:D14) * (1 + Buffer)</span>
                  <span className="ml-auto text-[10px] text-neutral-500 bg-surface px-1.5 py-0.5 rounded border border-hairline">
                    Cell E14
                  </span>
                </div>

                {/* Table */}
                <div className="border border-hairline rounded-xl overflow-hidden text-xs font-mono bg-canvas">
                  <div className="grid grid-cols-4 bg-neutral-100 p-2.5 font-semibold border-b border-hairline text-neutral-600">
                    <span>Line Item</span>
                    <span>Actual</span>
                    <span>Budget</span>
                    <span className="text-right">Variance</span>
                  </div>
                  <div className="grid grid-cols-4 p-2.5 border-b border-hairline/60">
                    <span className="font-medium text-ink">Engineering</span>
                    <span>$100,000</span>
                    <span>$95,000</span>
                    <span className="text-right text-success font-medium">+5.2%</span>
                  </div>
                  <div className="grid grid-cols-4 p-2.5 border-b border-hairline/60 bg-brand-lavender/15">
                    <span className="font-medium text-forest">Operations</span>
                    <span className="font-medium text-forest">$50,000</span>
                    <span>$45,000</span>
                    <span className="text-right text-forest font-semibold">+11.1%</span>
                  </div>
                  <div className="grid grid-cols-4 p-2.5 font-semibold bg-neutral-50">
                    <span className="text-ink">Total Opex</span>
                    <span>$180,000</span>
                    <span>$165,000</span>
                    <span className="text-right text-forest">+9.1%</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between text-[11px] text-neutral-500 font-ui border-t border-hairline mt-4">
                <span>Working copy revision v1.2</span>
                <span className="font-mono text-forest font-medium">AST Dependencies Preserved</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── 4. Proof Strip (animated counters) ── */}
      <section className="border-y border-hairline bg-neutral-50 py-12">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center md:text-left"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            {proofSignals.map((sig, i) => (
              <motion.div key={i} variants={fadeUp} custom={i * 0.05}>
                <div className="font-display text-3xl sm:text-4xl text-forest font-medium tabular-nums">
                  {sig.display}
                </div>
                <div className="font-ui font-medium text-sm text-ink mt-1">{sig.label}</div>
                <div className="text-xs text-neutral-600 mt-0.5">{sig.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 5. Architectural Capabilities ── */}
      <section id="capabilities" className="max-w-6xl mx-auto px-6 sm:px-8 py-24">
        <motion.div
          className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-hairline pb-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" as any }}
        >
          <div>
            <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
              SYSTEM ARCHITECTURE
            </span>
            <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-ink mt-2">
              Engineered for high-stakes document work
            </h2>
          </div>
          <p className="text-sm sm:text-base text-neutral-600 max-w-md leading-relaxed">
            Built with mathematical discipline and editorial warmth. Strict evidence grounding, isolated session state, and formula-safe working copies.
          </p>
        </motion.div>

        <motion.div
          className="rounded-[28px] border border-hairline bg-surface overflow-hidden shadow-sm"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" as any }}
        >
          <div className="grid lg:grid-cols-12 min-h-[460px]">
            {/* Left: Interactive Selector */}
            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-hairline p-4 sm:p-6 flex flex-col justify-between bg-neutral-50/70">
              <div className="space-y-2">
                <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
                  Architectural Pillars
                </div>

                {capabilities.map((cap, idx) => {
                  const isSelected = activeTab === idx;
                  return (
                    <button
                      key={cap.id}
                      onClick={() => setActiveTab(idx)}
                      onMouseEnter={() => setActiveTab(idx)}
                      className={`w-full text-left p-4 rounded-2xl transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-surface border-hairline shadow-xs ring-1 ring-forest/30"
                          : "bg-transparent border-transparent hover:bg-neutral-100 text-neutral-600 hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
                              isSelected ? "bg-forest text-paper" : "bg-neutral-200 text-neutral-600"
                            }`}
                          >
                            {cap.index}
                          </span>
                          <span
                            className={`font-ui text-sm font-semibold transition-colors ${
                              isSelected ? "text-ink" : "text-neutral-600"
                            }`}
                          >
                            {cap.title}
                          </span>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isSelected ? "text-forest translate-x-0.5" : "text-neutral-400 opacity-50"
                          }`}
                        />
                      </div>

                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            key="desc"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" as any }}
                            className="overflow-hidden"
                          >
                            <p className="text-xs text-neutral-600 leading-relaxed font-normal mt-3 pl-8">
                              {cap.summary}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Specimen Stage */}
            <div className="lg:col-span-7 p-6 sm:p-8 bg-canvas flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCap.specimenType}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.3, ease: "easeOut" as any }}
                >
                  {/* SPECIMEN 01: Native Artifact Canvas */}
                  {currentCap.specimenType === "canvas" && (
                    <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
                      <div className="px-4 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs font-mono text-neutral-600">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-forest" />
                          <span className="font-medium text-ink">FY25_Operating_Model.xlsx</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-brand-lavender text-ink font-medium">
                          Formula Graph Active
                        </span>
                      </div>
                      <div className="p-3 border-b border-hairline bg-canvas flex items-center gap-2 text-xs font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-forest/10 text-forest font-bold text-[11px]">fx</span>
                        <span className="text-neutral-400">=</span>
                        <span className="text-ink font-medium">SUM(B2:D2) * (1 + Growth_Buffer)</span>
                        <span className="ml-auto text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-hairline">Cell E2</span>
                      </div>
                      <div className="p-4 bg-surface overflow-x-auto text-xs font-mono">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-hairline text-[11px] text-neutral-500 bg-neutral-50">
                              <th className="py-2 px-3 font-semibold">Cost Center</th>
                              <th className="py-2 px-3 font-semibold">Q1 Act.</th>
                              <th className="py-2 px-3 font-semibold">Q2 Proj.</th>
                              <th className="py-2 px-3 font-semibold text-right">Variance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline text-ink">
                            <tr className="hover:bg-neutral-50 transition-colors">
                              <td className="py-2 px-3 font-medium">Core Engineering</td>
                              <td className="py-2 px-3 tabular-nums">$340,000</td>
                              <td className="py-2 px-3 tabular-nums">$385,000</td>
                              <td className="py-2 px-3 tabular-nums text-right text-success font-semibold">+13.2%</td>
                            </tr>
                            <tr className="bg-brand-lavender/15 ring-1 ring-inset ring-brand-lavender/40">
                              <td className="py-2 px-3 font-medium text-forest">Infrastructure & Cloud</td>
                              <td className="py-2 px-3 tabular-nums font-semibold text-forest">$115,000</td>
                              <td className="py-2 px-3 tabular-nums font-semibold text-forest">$128,000</td>
                              <td className="py-2 px-3 tabular-nums text-right text-forest font-semibold">+11.3%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SPECIMEN 02: Provenance Inspector */}
                  {currentCap.specimenType === "provenance" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
                        <div className="px-4 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs font-mono text-neutral-600">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-forest" />
                            <span className="font-medium text-ink">Provenance Inspector • SEC_10-K_2025.pdf</span>
                          </div>
                          <span className="text-[11px] font-mono text-neutral-500">Page 18, Paragraph 3</span>
                        </div>
                        <div className="p-4 bg-surface space-y-3">
                          <div className="p-4 rounded-xl bg-canvas border border-hairline font-serif text-sm text-ink leading-relaxed">
                            &ldquo;Net cash generated from operating activities totaled{" "}
                            <mark className="bg-brand-lavender text-ink font-semibold px-2 py-0.5 rounded border border-brand-lavender/80 not-italic">
                              $4,281 million
                            </mark>{" "}
                            for the fiscal year ended December 31, representing a 34% increase driven by enterprise renewals.&rdquo;
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-hairline bg-neutral-50 text-xs text-neutral-600 space-y-1">
                        <div className="font-medium text-ink flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-forest" />
                          Grounded Claim Locator
                        </div>
                        <p>Operating Cash Flow = $4.28B (SEC 10-K, Page 18, Paragraph 3 • Bounding Box verified)</p>
                      </div>
                    </div>
                  )}

                  {/* SPECIMEN 03: Persistent URL Sessions */}
                  {currentCap.specimenType === "sessions" && (
                    <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
                      <div className="px-4 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs font-mono text-neutral-600">
                        <span className="font-medium text-ink">Session Graph State</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-forest text-paper text-[10px] font-semibold">
                          SQLite WAL Active
                        </span>
                      </div>
                      <div className="p-4 bg-surface border-b border-hairline space-y-3">
                        <div className="flex items-center gap-2 bg-canvas border border-hairline rounded-full px-4 py-2 text-xs font-mono">
                          <span className="text-neutral-500">URL:</span>
                          <span className="flex-1 text-ink truncate font-medium">https://draythos.app/chat/c_8f12a04e</span>
                          <button
                            onClick={handleCopyLink}
                            className="px-3 py-1 bg-surface hover:bg-neutral-100 rounded-full text-xs text-ink font-medium border border-hairline transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            {copiedLink ? (
                              <><Check className="h-3 w-3 text-success" />Copied!</>
                            ) : (
                              <><Copy className="h-3 w-3" />Copy Link</>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-4 bg-surface space-y-2 text-xs font-mono">
                        <div className="text-[11px] uppercase tracking-wider text-neutral-500">Data Room Attachment Tree</div>
                        <div className="p-3.5 rounded-xl bg-canvas border border-hairline space-y-1.5 text-ink">
                          <div className="text-ink font-medium">Session: Due Diligence Analysis (c_8f12a04e)</div>
                          <div className="pl-4 text-[11px] text-neutral-600 space-y-1 border-l border-hairline ml-1">
                            <div>├── 10-K_Report_2025.pdf (18 pages indexed)</div>
                            <div>├── Q1_Operating_Model.xlsx (Formula AST active)</div>
                            <div className="text-forest font-medium">└── Working Copy v1.2 (Saved 2m ago)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SPECIMEN 04: Security */}
                  {currentCap.specimenType === "security" && (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
                        <div className="px-4 py-3 border-b border-hairline bg-neutral-50 flex items-center justify-between text-xs font-mono text-neutral-600">
                          <span className="font-medium text-ink">Client BYOK Security Enclave</span>
                          <span className="text-[11px] text-forest font-medium">AES-256-GCM</span>
                        </div>
                        <div className="p-4 bg-surface space-y-3 text-xs font-mono">
                          <div className="p-3.5 rounded-xl bg-canvas border border-hairline flex items-center justify-between">
                            <div>
                              <div className="text-ink font-semibold">Google Gemini Key</div>
                              <div className="text-[11px] text-neutral-500">Encrypted Client Cookie Vault</div>
                            </div>
                            <span className="text-forest font-semibold text-xs flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-forest animate-pulse" />
                              Isolated
                            </span>
                          </div>
                          <div className="p-3.5 rounded-xl bg-canvas border border-hairline flex items-center justify-between">
                            <div>
                              <div className="text-ink font-semibold">OpenRouter Key</div>
                              <div className="text-[11px] text-neutral-500">Zero Multi-Tenant Global Sharing</div>
                            </div>
                            <span className="text-forest font-semibold text-xs flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-forest animate-pulse" />
                              Isolated
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-hairline bg-neutral-50 text-xs text-neutral-600 space-y-1">
                        <div className="font-medium text-ink flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-forest" />
                          Zero Telemetry Guarantee
                        </div>
                        <p>Credentials never touch persistent database tables or multi-tenant vector indexes. All inference runs across per-session TLS 1.3 channels.</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── 6. Platform Overview (new section — chatbot is a part, not the whole) ── */}
      <section id="platform" className="border-t border-hairline bg-neutral-50/60 py-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" as any }}
          >
            <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
              INTELLIGENCE PLATFORM
            </span>
            <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-ink mt-2">
              More than a chatbot.<br />
              <span className="italic text-forest">A complete data room.</span>
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mt-3 font-normal">
              The workspace is your command center. Fact extraction, concept taxonomy, structured review, and citation-grounded Q&A — all in one platform.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 gap-5"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            {platformTiles.map((tile, i) => (
              <motion.div key={i} variants={fadeUp} custom={i * 0.08}>
                <Link
                  href={tile.href}
                  className="group block rounded-3xl border border-hairline bg-surface p-7 shadow-xs hover:-translate-y-1 hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-2xl bg-forest/8 flex items-center justify-center group-hover:bg-forest/14 transition-colors">
                      <tile.icon className="w-5 h-5 text-forest" />
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-brand-lavender text-ink border border-brand-lavender/60">
                      {tile.badge}
                    </span>
                  </div>
                  <h3 className="font-display text-xl text-ink font-medium mb-2 group-hover:text-forest transition-colors">
                    {tile.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed font-normal">
                    {tile.desc}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-xs font-medium text-forest opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 7. Audience & Workflows ── */}
      <section id="workflows" className="border-t border-hairline py-24">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, ease: "easeOut" as any }}
          >
            <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
              BUILT FOR YOUR ROLE
            </span>
            <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-ink mt-2">
              Context-tailored document analysis
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mt-3 font-normal">
              Whether conducting M&A due diligence, legal disclosure audit, or financial modeling, Draythos meets your workflow requirements.
            </p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
          >
            {personas.map((p, idx) => (
              <motion.div
                key={idx}
                variants={fadeUp}
                custom={idx * 0.1}
                className="rounded-3xl border border-hairline bg-surface p-7 shadow-xs flex flex-col justify-between hover:-translate-y-1 transition-transform duration-300"
              >
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-brand-lavender text-ink text-xs font-medium mb-4">
                    {p.badge}
                  </span>
                  <h3 className="font-display text-2xl text-ink font-semibold mb-3">{p.role}</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed mb-6 font-normal">{p.description}</p>
                </div>
                <div className="space-y-2.5 pt-4 border-t border-hairline text-xs text-neutral-600 font-ui">
                  {p.points.map((pt, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-forest shrink-0 mt-0.5" />
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 8. FAQ ── */}
      <section className="max-w-4xl mx-auto px-6 sm:px-8 py-24">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: "easeOut" as any }}
        >
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-ink">
            Frequently Asked Questions
          </h2>
          <p className="text-neutral-600 text-sm sm:text-base mt-2">
            Answers to common questions about citations, security, and document formats.
          </p>
        </motion.div>

        <motion.div
          className="space-y-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
        >
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <motion.div
                key={idx}
                variants={fadeUp}
                custom={idx * 0.07}
                className="rounded-2xl border border-hairline bg-surface overflow-hidden shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 font-ui font-medium text-base text-ink cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <span>{faq.q}</span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" as any }}
                  >
                    <ChevronDown className="w-5 h-5 text-forest shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeOut" as any }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-1 text-sm text-neutral-600 leading-relaxed font-normal border-t border-hairline/50">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ── 9. Conversion CTA ── */}
      <section className="border-t border-hairline bg-brand-paper py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" as any }}
          >
            <h2 className="display-hero text-4xl sm:text-5xl lg:text-6xl text-ink mb-4">
              Ready to review with evidence?
            </h2>
            <p className="text-base sm:text-lg text-neutral-600 mb-8 max-w-xl mx-auto font-normal">
              Launch the Draythos studio and experience document intelligence grounded in verifiable citations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={targetHref}
                className="inline-flex items-center gap-2.5 text-base font-medium bg-forest text-paper px-8 py-3.5 rounded-full hover:bg-forest-deep hover:-translate-y-px active:scale-[0.98] transition-all duration-200 shadow-xs group"
              >
                <span>{isAuthenticated ? "Enter Workspace" : "Launch Free Studio"}</span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/app/review"
                className="inline-flex items-center gap-2 text-base font-medium border border-forest text-forest hover:bg-forest/5 px-8 py-3.5 rounded-full active:scale-[0.98] transition-all duration-200"
              >
                <span>Explore Review Grid</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 10. Footer ── */}
      <footer className="bg-brand-ink text-brand-paper pt-20 pb-16 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 pb-16 border-b border-neutral-800">
            {/* Col 1 & 2: Brand */}
            <div className="col-span-2 space-y-4">
              <span className="font-display font-medium text-3xl tracking-tight text-brand-paper">
                Draythos
              </span>
              <p className="text-sm text-brand-cream-grey max-w-sm leading-relaxed font-normal">
                Evidence-grounded document intelligence for high-stakes business decisions. Synchronized dual-pane workbenches with formula-safe AST preservation.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <span className="px-3 py-1 rounded-full bg-neutral-800 text-brand-cream-grey text-xs font-mono">
                  AES-256 Encrypted
                </span>
                <span className="px-3 py-1 rounded-full bg-neutral-800 text-brand-cream-grey text-xs font-mono">
                  SQLite Local WAL
                </span>
              </div>
            </div>

            {/* Col 3: Product */}
            <div className="space-y-3 text-sm">
              <div className="font-medium text-brand-paper">Product</div>
              <ul className="space-y-2 text-brand-cream-grey">
                <li>
                  <Link href="/app/dashboard" className="hover:text-brand-paper transition-colors">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/chat" className="hover:text-brand-paper transition-colors">
                    Studio Workspace
                  </Link>
                </li>
                <li>
                  <a href="#workbench" className="hover:text-brand-paper transition-colors">
                    Artifact Canvas
                  </a>
                </li>
                <li>
                  <Link href="/app/review" className="hover:text-brand-paper transition-colors">
                    Fact Review Grid
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Taxonomy */}
            <div className="space-y-3 text-sm">
              <div className="font-medium text-brand-paper">Taxonomy</div>
              <ul className="space-y-2 text-brand-cream-grey">
                <li>
                  <Link href="/app/concepts" className="hover:text-brand-paper transition-colors">
                    Synonym Catalog
                  </Link>
                </li>
                <li>
                  <Link href="/app/review" className="hover:text-brand-paper transition-colors">
                    Export Workbooks
                  </Link>
                </li>
                <li>
                  <span className="text-neutral-500">Excel Add-in</span>
                </li>
              </ul>
            </div>

            {/* Col 5: Security */}
            <div className="space-y-3 text-sm">
              <div className="font-medium text-brand-paper">Security & Trust</div>
              <ul className="space-y-2 text-brand-cream-grey">
                <li><span className="text-brand-cream-grey">BYOK Isolation</span></li>
                <li><span className="text-brand-cream-grey">Zero Multi-Tenant Logs</span></li>
                <li><span className="text-brand-cream-grey">TLS 1.3 Channels</span></li>
              </ul>
            </div>
          </div>

          {/* Footer bottom */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
            <div>
              &copy; {new Date().getFullYear()} Draythos. Engineered with mathematical discipline and editorial warmth.
            </div>
            <div className="flex items-center gap-6">
              <span>Privacy & Security</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
