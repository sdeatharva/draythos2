"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  FileText,
  Check,
  Copy,
  ChevronRight,
} from "lucide-react";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  const targetHref = isAuthenticated ? "/chat" : "/login";

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

  const currentCap = capabilities[activeTab];

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://draythos.app/chat/c_8f12a04e");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-manilla selection:text-ink">
      {/* Navigation */}
      <nav className="border-b border-hairline bg-canvas/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-lg tracking-tight text-ink">Draythos</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                href="/chat"
                className="font-display text-sm font-medium text-ink-soft hover:text-ink transition-colors"
              >
                Workspace
              </Link>
            ) : (
              <Link
                href="/login"
                className="font-display text-sm font-medium text-ink-soft hover:text-ink transition-colors"
              >
                Sign In
              </Link>
            )}
            <Link
              href={targetHref}
              className="font-display text-sm font-medium bg-clay text-canvas px-4 py-2 rounded-full hover:bg-clay-deep transition-colors shadow-xs flex items-center gap-1.5"
            >
              Open Workspace
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 pt-10 sm:pt-12 pb-16 text-center">
        {/* Dragon Mascot (Enlarged visual presence with tight zero-padding crop & text brought close) */}
        <div className="mb-2 sm:mb-3 flex justify-center">
          <img
            src="/mascot.png"
            alt="Draythos Dragon Mascot"
            className="w-56 sm:w-64 md:w-72 lg:w-80 h-auto object-contain drop-shadow-sm select-none"
          />
        </div>

        <h1 className="font-display font-semibold text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.06] mb-6 text-ink">
          Understand complex files.<br />
          <span className="text-clay">Verify every claim.</span>
        </h1>

        <p className="font-reading text-lg sm:text-xl text-ink-soft max-w-2xl mx-auto mb-10 leading-relaxed">
          Draythos brings your PDFs, financial spreadsheets, and documents into a dual-pane workspace. Inspect source citations in real time, edit working copies cell by cell, and get model reasoning grounded strictly in evidence.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Link
            href={targetHref}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-display font-medium text-sm bg-clay text-canvas px-7 py-3.5 rounded-full hover:bg-clay-deep transition-all shadow-sm group"
          >
            {isAuthenticated ? "Open Workspace" : "Launch Workspace"}
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href={targetHref}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-display font-medium text-sm bg-surface border border-hairline text-ink px-7 py-3.5 rounded-full hover:bg-oat transition-colors"
          >
            {isAuthenticated ? "Go to Chat" : "Sign In"}
          </Link>
        </div>
      </section>

      {/* Visual Product Mockup */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-hairline bg-surface p-2 shadow-sm overflow-hidden">
          {/* Mock Browser Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-hairline bg-oat/50 rounded-t-xl text-xs font-mono text-cloud-dark">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
              <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
              <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
            </div>
            <span>draythos.app/chat/c_8f12a04e</span>
            <div className="w-10" />
          </div>

          {/* Workspace Mock Content */}
          <div className="grid md:grid-cols-12 min-h-[380px] bg-canvas">
            {/* Mock Chat Pane */}
            <div className="md:col-span-6 p-6 border-r border-hairline flex flex-col justify-between">
              <div className="space-y-4">
                <div className="bg-oat/70 rounded-2xl p-4 self-end max-w-[85%] ml-auto text-xs font-reading text-ink">
                  What were the total Q1 operating expenses in the uploaded balance sheet?
                </div>
                <div className="bg-surface border border-hairline rounded-2xl p-4 text-xs font-reading text-ink space-y-2">
                  <p className="font-display font-medium text-ink">Operating Expenses Breakdown</p>
                  <p className="text-ink-soft">
                    According to <strong className="text-ink font-semibold">Q1_Budget.xlsx</strong> (Sheet: Expenses), total operating expenses were <strong>$180,000</strong>.
                  </p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-oat text-[11px] font-mono text-ink-soft border border-hairline">
                    <FileText className="h-3 w-3 text-clay" />
                    Q1_Budget.xlsx • Row 14, Col C
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-hairline flex items-center gap-2">
                <div className="flex-1 h-9 bg-surface border border-hairline rounded-lg px-3 flex items-center text-xs text-cloud-dark font-reading">
                  Ask about your documents…
                </div>
                <div className="h-9 w-9 rounded-lg bg-clay text-canvas flex items-center justify-center">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Mock Artifact Canvas */}
            <div className="md:col-span-6 p-6 bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-clay" />
                    <span className="font-display font-medium text-xs text-ink">Q1_Budget.xlsx</span>
                    <span className="font-mono text-[10px] bg-oat px-1.5 py-0.5 rounded text-ink-soft">XLSX</span>
                  </div>
                  <span className="text-[11px] font-mono text-cloud-dark">Formula-safe Working Copy</span>
                </div>

                <div className="border border-hairline rounded-lg overflow-hidden text-[11px] font-mono bg-canvas">
                  <div className="grid grid-cols-4 bg-oat/80 p-2 font-semibold border-b border-hairline">
                    <span>Category</span>
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                  </div>
                  <div className="grid grid-cols-4 p-2 border-b border-hairline/60">
                    <span>Engineering</span>
                    <span>$100,000</span>
                    <span>$120,000</span>
                    <span>$130,000</span>
                  </div>
                  <div className="grid grid-cols-4 p-2 border-b border-hairline/60 bg-clay/5">
                    <span>Operations</span>
                    <span>$50,000</span>
                    <span>$55,000</span>
                    <span>$60,000</span>
                  </div>
                  <div className="grid grid-cols-4 p-2 font-semibold">
                    <span>Total Opex</span>
                    <span>$150,000</span>
                    <span>$175,000</span>
                    <span>$190,000</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-cloud-dark font-reading text-center mt-4">
                Interactive editable spreadsheet canvas — preserves underlying formulas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architectural Capabilities Showcase (Unified Master-Detail Architectural Stage) */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        {/* Section Heading */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <h2 className="font-display font-semibold text-3xl md:text-4xl tracking-tight text-ink">
              Engineered for high-stakes document work
            </h2>
          </div>
          <p className="font-reading text-sm text-ink-soft max-w-md">
            Built with mathematical discipline and editorial warmth. Strict evidence grounding, isolated session state, and formula-safe working copies.
          </p>
        </div>

        {/* Unified Architectural Console (Master-Detail Specimen Workbench) */}
        <div className="rounded-2xl border border-hairline bg-surface/40 backdrop-blur-sm overflow-hidden shadow-xs">
          <div className="grid lg:grid-cols-12 min-h-[440px]">
            {/* Left Column: Interactive Architectural Pillar Selector (5 cols) */}
            <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-hairline p-4 sm:p-5 flex flex-col justify-between bg-surface/30">
              <div className="space-y-1.5">
                <div className="px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-cloud-dark">
                  Architectural Pillars
                </div>

                {capabilities.map((cap, idx) => {
                  const isSelected = activeTab === idx;
                  return (
                    <button
                      key={cap.id}
                      onClick={() => setActiveTab(idx)}
                      onMouseEnter={() => setActiveTab(idx)}
                      className={`w-full text-left p-3.5 rounded-xl transition-all cursor-pointer border ${
                        isSelected
                          ? "bg-surface border-hairline shadow-xs ring-1 ring-clay/30"
                          : "bg-transparent border-transparent hover:bg-oat/50 text-ink-soft hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`font-mono text-xs font-semibold px-2 py-0.5 rounded transition-colors ${
                              isSelected
                                ? "bg-clay text-canvas"
                                : "bg-oat text-cloud-dark"
                            }`}
                          >
                            {cap.index}
                          </span>
                          <span
                            className={`font-display text-sm font-semibold transition-colors ${
                              isSelected ? "text-ink" : "text-ink-soft"
                            }`}
                          >
                            {cap.title}
                          </span>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isSelected ? "text-clay translate-x-0.5" : "text-cloud-dark opacity-40"
                          }`}
                        />
                      </div>

                      {/* Expanded description inside selected pillar (Specs pills removed as requested) */}
                      {isSelected && (
                        <div className="mt-3 pl-8 animate-in fade-in duration-200">
                          <p className="font-reading text-xs text-ink-soft leading-relaxed">
                            {cap.summary}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: High-Fidelity Living Specimen Stage (7 cols) */}
            <div className="lg:col-span-7 p-5 sm:p-7 bg-canvas/40 flex flex-col justify-center">
              {/* SPECIMEN 01: Artifact Canvas Live View */}
              {currentCap.specimenType === "canvas" && (
                <div className="rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden animate-in fade-in duration-200">
                  {/* Window Titlebar */}
                  <div className="px-4 py-2.5 border-b border-hairline bg-oat/50 flex items-center justify-between text-xs font-mono text-cloud-dark">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                        <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                        <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                      </div>
                      <span className="font-medium text-ink">
                        FY25_Operating_Model.xlsx
                      </span>
                    </div>
                  </div>

                  {/* Formula bar */}
                  <div className="p-3 border-b border-hairline/80 bg-canvas/60 flex items-center gap-2 text-xs font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-clay/10 text-clay font-bold text-[11px]">fx</span>
                    <span className="text-cloud-dark">=</span>
                    <span className="text-ink font-medium">SUM(B2:D2) * (1 + Growth_Buffer)</span>
                    <span className="ml-auto text-[10px] text-cloud-dark bg-oat px-1.5 py-0.5 rounded border border-hairline">
                      Cell E2
                    </span>
                  </div>

                  {/* Table Grid */}
                  <div className="p-3 bg-surface overflow-x-auto text-xs font-mono">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-hairline text-[11px] text-cloud-dark bg-oat/40">
                          <th className="py-2 px-3 font-semibold">Cost Center</th>
                          <th className="py-2 px-3 font-semibold">Q1 Act.</th>
                          <th className="py-2 px-3 font-semibold">Q2 Proj.</th>
                          <th className="py-2 px-3 font-semibold">Q3 Proj.</th>
                          <th className="py-2 px-3 font-semibold text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline/60 text-ink">
                        <tr className="hover:bg-oat/30 transition-colors">
                          <td className="py-2 px-3 font-medium">Core Engineering</td>
                          <td className="py-2 px-3 tabular-nums">$340,000</td>
                          <td className="py-2 px-3 tabular-nums">$385,000</td>
                          <td className="py-2 px-3 tabular-nums">$410,000</td>
                          <td className="py-2 px-3 tabular-nums text-right text-emerald-600 dark:text-emerald-400 font-semibold">+13.2%</td>
                        </tr>
                        <tr className="bg-clay/5 ring-1 ring-inset ring-clay/20">
                          <td className="py-2 px-3 font-medium">
                            Infrastructure & Cloud
                          </td>
                          <td className="py-2 px-3 tabular-nums">$115,000</td>
                          <td className="py-2 px-3 tabular-nums font-semibold text-clay">$128,000</td>
                          <td className="py-2 px-3 tabular-nums">$135,000</td>
                          <td className="py-2 px-3 tabular-nums text-right text-clay font-semibold">+11.3%</td>
                        </tr>
                        <tr className="hover:bg-oat/30 transition-colors">
                          <td className="py-2 px-3 font-medium">Research & QA</td>
                          <td className="py-2 px-3 tabular-nums">$92,000</td>
                          <td className="py-2 px-3 tabular-nums">$94,500</td>
                          <td className="py-2 px-3 tabular-nums">$98,000</td>
                          <td className="py-2 px-3 tabular-nums text-right text-emerald-600 dark:text-emerald-400 font-semibold">+2.7%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Sheet tabs footer */}
                  <div className="px-3 py-2 border-t border-hairline bg-oat/40 flex items-center justify-between text-[11px] font-mono text-cloud-dark">
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded bg-surface border border-hairline text-ink font-semibold">Expenses</span>
                      <span className="px-2 py-0.5 rounded hover:bg-surface text-cloud-dark">Revenue</span>
                      <span className="px-2 py-0.5 rounded hover:bg-surface text-cloud-dark">Headcount</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIMEN 02: Evidence Grounding Live View */}
              {currentCap.specimenType === "provenance" && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden">
                    {/* Inspector Header */}
                    <div className="px-4 py-2.5 border-b border-hairline bg-oat/50 flex items-center justify-between text-xs font-mono text-cloud-dark">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                          <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                          <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                        </div>
                        <span className="font-medium text-ink">
                          Provenance Inspector • SEC_10-K_2025.pdf
                        </span>
                      </div>
                    </div>

                    {/* Document Excerpt */}
                    <div className="p-4 bg-surface space-y-3">
                      <div className="text-[11px] font-mono text-cloud-dark">
                        <span>Page 18, Paragraph 3</span>
                      </div>

                      <div className="p-3.5 rounded-lg bg-canvas border border-hairline font-reading text-xs sm:text-sm text-ink leading-relaxed">
                        &ldquo;Net cash generated from operating activities totaled{" "}
                        <mark className="bg-clay/20 text-ink font-semibold px-1.5 py-0.5 rounded border border-clay/30 not-italic">
                          $4,281 million
                        </mark>{" "}
                        for the fiscal year ended December 31, representing a 34% increase driven by enterprise renewals and platform gross margin expansion.&rdquo;
                      </div>
                    </div>
                  </div>

                  {/* Attached Section Outside Existing Box, No Background Color */}
                  <div className="p-3.5 rounded-xl border border-hairline bg-transparent text-[11px] font-reading text-ink-soft space-y-1">
                    <div className="font-medium text-ink">
                      Grounded Claim
                    </div>
                    <p>
                      Operating Cash Flow = $4.28B (SEC 10-K, Page 18, Paragraph 3)
                    </p>
                  </div>
                </div>
              )}

              {/* SPECIMEN 03: Persistent URL Sessions Live View (Icons removed) */}
              {currentCap.specimenType === "sessions" && (
                <div className="rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden animate-in fade-in duration-200">
                  {/* Inspector Header */}
                  <div className="px-4 py-2.5 border-b border-hairline bg-oat/50 flex items-center justify-between text-xs font-mono text-cloud-dark">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                        <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                        <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                      </div>
                      <span className="font-medium text-ink">
                        Session Graph State
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-oat text-ink-soft text-[10px] font-semibold border border-hairline">
                      SQLite WAL
                    </span>
                  </div>

                  {/* Permalink Bar */}
                  <div className="p-3.5 bg-surface border-b border-hairline space-y-2">
                    <div className="flex items-center gap-2 bg-canvas border border-hairline rounded-lg px-3 py-1.5 text-xs font-mono">
                      <span className="text-cloud-dark select-none">Permalink:</span>
                      <span className="flex-1 text-ink truncate font-medium">https://draythos.app/chat/c_8f12a04e</span>
                      <button
                        onClick={handleCopyLink}
                        className="px-2.5 py-1 bg-surface hover:bg-oat rounded text-[11px] text-ink font-display border border-hairline transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Session Tree (No icons) */}
                  <div className="p-4 bg-surface space-y-2 text-xs font-mono">
                    <div className="text-[11px] uppercase tracking-wider text-cloud-dark">Session Architecture Graph</div>
                    <div className="p-3 rounded-lg bg-canvas border border-hairline space-y-2 text-ink">
                      <div className="text-ink font-medium">
                        Session: Due Diligence Analysis (c_8f12a04e)
                      </div>
                      <div className="pl-4 text-[11px] text-ink-soft space-y-1.5 border-l border-hairline/80 ml-1">
                        <div>├── 10-K_Report_2025.pdf (18 pages indexed)</div>
                        <div>├── Q1_Operating_Model.xlsx (Formula AST active)</div>
                        <div className="text-clay font-medium">└── Working Copy v1.2 (Saved 2m ago)</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIMEN 04: Cryptographic Key Isolation Live View */}
              {currentCap.specimenType === "security" && (
                <div className="space-y-3 animate-in fade-in duration-200">
                  <div className="rounded-xl border border-hairline bg-surface shadow-xs overflow-hidden">
                    {/* Inspector Header */}
                    <div className="px-4 py-2.5 border-b border-hairline bg-oat/50 flex items-center justify-between text-xs font-mono text-cloud-dark">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                          <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                          <span className="w-2.5 h-2.5 rounded-full bg-hairline" />
                        </div>
                        <span className="font-medium text-ink">
                          Client BYOK Security Enclave
                        </span>
                      </div>
                    </div>

                    {/* Keys Grid */}
                    <div className="p-4 bg-surface space-y-3 text-xs font-mono">
                      <div className="p-3 rounded-lg bg-canvas border border-hairline flex items-center justify-between">
                        <div>
                          <div className="text-ink font-semibold">Google Gemini Key</div>
                          <div className="text-[10px] text-cloud-dark">Encrypted Client Cookie Vault</div>
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Connected
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-canvas border border-hairline flex items-center justify-between">
                        <div>
                          <div className="text-ink font-semibold">OpenRouter Key</div>
                          <div className="text-[10px] text-cloud-dark">Zero Multi-Tenant Global Sharing</div>
                        </div>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Connected
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attached Section Outside Existing Box, No Background Color */}
                  <div className="p-3.5 rounded-xl border border-hairline bg-transparent text-[11px] font-reading text-ink-soft space-y-1">
                    <div className="font-medium text-ink">
                      Zero Credential Leakage Guarantee
                    </div>
                    <p>
                      Credentials are never stored in server logs or shared across vector databases. All LLM calls execute within strict per-session TLS 1.3 boundaries.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="border-t border-hairline bg-surface/60 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display font-semibold text-3xl tracking-tight text-ink mb-4">
            Ready to review your documents?
          </h2>
          <p className="font-reading text-base text-ink-soft mb-8">
            Experience document intelligence grounded in real evidence.
          </p>
          <Link
            href={targetHref}
            className="inline-flex items-center gap-2 font-display font-medium text-sm bg-clay text-canvas px-8 py-3.5 rounded-full hover:bg-clay-deep transition-all shadow-sm"
          >
            Enter Workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline bg-canvas">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between text-xs font-display text-cloud-dark">
          <span>Draythos</span>
          <span>Design by Prashant Kumar</span>
        </div>
      </footer>
    </div>
  );
}
