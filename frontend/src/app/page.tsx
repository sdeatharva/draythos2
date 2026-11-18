"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  FileText,
  Check,
  Copy,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Lock,
  FileSpreadsheet,
  CheckCircle2,
  Database,
  Layers,
  Scale,
  GitBranch,
  AlertOctagon,
  FileCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp, stagger } from "@/lib/animations";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const capabilities = [
    {
      id: "canvas",
      index: "01",
      domain: "WORKSPACE INTERFACE",
      title: "Native Artifact Canvas",
      summary:
        "Inspect spreadsheets, PDFs, and disclosures in a synchronized side-by-side workbench. Spreadsheets retain their formula graph, cell references, and multi-sheet structure without being flattened into text summaries.",
      specimenType: "canvas",
    },
    {
      id: "provenance",
      index: "02",
      domain: "VERIFICATION & PROVENANCE",
      title: "Evidence Grounding & Citations",
      summary:
        "Every claim and metric is anchored to source files. Click any citation to inspect the verified paragraph, table coordinate, or bounding box overlay.",
      specimenType: "provenance",
    },
    {
      id: "jurisdiction",
      index: "03",
      domain: "MULTI-STANDARD NORMALIZATION",
      title: "Cross-Jurisdiction Comparison",
      summary:
        "Compare financial concepts side-by-side across US GAAP, UK GAAP, Ind AS, and SFRS(I). Review statutory definitions and regional variances with deterministic mappings.",
      specimenType: "jurisdiction",
    },
    {
      id: "ledger",
      index: "04",
      domain: "COMPLIANCE & INTEGRITY",
      title: "Tamper-Evident Audit Ledger",
      summary:
        "Every document ingest, extraction, and maker-checker approval is recorded in a cryptographically chained SHA-256 hash ledger for board-level audits.",
      specimenType: "ledger",
    },
  ];

  const currentCap = capabilities[activeTab];

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://draythos.app/chat/c_8f12a04e");
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const proofSignals = [
    {
      label: "Gold-Set Benchmark",
      sub: "Measured on 50-test multi-format gold evaluation set",
      display: "94.2%",
    },
    {
      label: "Client-Side Isolation",
      sub: "API keys stored locally, session-isolated inference",
      display: "Client BYOK",
    },
    {
      label: "Formula Preservation",
      sub: "Multi-sheet Excel relationships and AST intact",
      display: "AST Native",
    },
    {
      label: "Hash-Chained Ledger",
      sub: "Cryptographic SHA-256 integrity verification",
      display: "SHA-256",
    },
  ];

  const platformTiles = [
    {
      icon: Database,
      title: "Data Room Ingest",
      desc: "Live inventory of all dataroom documents, extraction statuses, and fact yields.",
      href: "/app/dataroom",
      badge: "Dataroom",
    },
    {
      icon: Scale,
      title: "Cross-Jurisdiction Normalization",
      desc: "Side-by-side concept comparison across India (Ind AS), UK GAAP, Singapore, and US GAAP.",
      href: "/app/jurisdictions",
      badge: "Multinational",
    },
    {
      icon: AlertOctagon,
      title: "Exceptions & Conflicts Queue",
      desc: "Dedicated triaging queue for low-confidence abstentions and conflicting period numbers.",
      href: "/app/exceptions",
      badge: "Governance",
    },
    {
      icon: FileCheck,
      title: "Audit Ledger & Hash Chain",
      desc: "Cryptographically verifiable ledger with one-click SHA-256 chain integrity audits.",
      href: "/app/ledger",
      badge: "Board-Ready",
    },
  ];

  const faqs = [
    {
      q: "How does Draythos differ from generic chat-with-PDF tools?",
      a: "Standard LLM tools collapse complex documents into unstructured markdown chunks, breaking formulas and obscuring sources. Draythos operates as an evidence-grounded workbench: spreadsheets retain their AST dependencies, PDFs display native bounding boxes, and claims are linked to verifiable locators.",
    },
    {
      q: "How is the 94.2% precision metric evaluated?",
      a: "Precision is measured against a curated 50-test gold evaluation set consisting of SEC 10-K filings, Indian annual reports (Ind AS), UK statutory accounts, and operational spreadsheets with known ground-truth coordinates.",
    },
    {
      q: "What is Cross-Jurisdiction normalization?",
      a: "Multinational groups encounter terms that mean different things under different accounting standards. Draythos maps regional labels to canonical concepts and renders side-by-side matrices across US GAAP, UK GAAP, Indian Companies Act / Ind AS, and Singapore SFRS(I).",
    },
    {
      q: "What is the Audit Ledger?",
      a: "Every document ingest, extraction, and user review generates an entry in a hash-chained SHA-256 ledger. You can independently verify that the ledger hasn't been tampered with and generate board-ready reports.",
    },
  ];

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-brand-lavender selection:text-ink font-ui antialiased overflow-x-hidden">
      {/* ── 1. Navigation ── */}
      <header className="border-b border-hairline bg-canvas/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="font-display font-medium text-2xl tracking-tight text-ink group-hover:text-forest transition-colors">
              Draythos
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600">
            <Link href="/app/dashboard" className="hover:text-ink transition-colors">
              Overview
            </Link>
            <Link href="/app/dataroom" className="hover:text-ink transition-colors">
              Data Room
            </Link>
            <Link href="/app/jurisdictions" className="hover:text-ink transition-colors">
              Jurisdictions
            </Link>
            <Link href="/app/exceptions" className="hover:text-ink transition-colors">
              Exceptions
            </Link>
            <Link href="/app/review" className="hover:text-ink transition-colors">
              Review Grid
            </Link>
            <Link href="/app/ledger" className="hover:text-ink transition-colors">
              Audit Ledger
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/app/dashboard"
              className="inline-flex items-center gap-2 text-sm font-medium bg-forest text-paper px-6 py-2.5 rounded-full hover:bg-forest-deep transition-all duration-200 shadow-xs"
            >
              <span>Explore Demo Data Room</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. Editorial Hero ── */}
      <section className="relative max-w-5xl mx-auto px-6 sm:px-8 pt-16 sm:pt-24 pb-16 text-center">
        <h1 className="display-hero text-5xl sm:text-6xl md:text-7xl lg:text-[76px] tracking-tight text-ink mb-6 max-w-4xl mx-auto">
          Understand complex files.<br />
          <span className="italic text-forest">Verify every single claim.</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Draythos reconciles spreadsheets, statutory filings, and legal agreements across multinational accounting standards with deterministic evidence grounding and audit trail verification.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Link
            href="/app/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 text-base font-medium bg-forest text-paper px-8 py-3.5 rounded-full hover:bg-forest-deep transition-all duration-200 shadow-xs group"
          >
            <span>Open Demo Data Room</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/app/jurisdictions"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-medium bg-transparent border border-forest text-forest hover:bg-forest/5 px-8 py-3.5 rounded-full transition-all duration-200"
          >
            <span>Compare Jurisdictions (IN / UK / US / SG)</span>
          </Link>
        </div>
      </section>

      {/* ── 3. Specimen Preview Workbench ── */}
      <section id="workbench" className="max-w-6xl mx-auto px-6 sm:px-8 pb-20">
        <div className="rounded-[24px] border border-hairline bg-surface p-2 sm:p-3 shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline bg-neutral-50 rounded-t-[18px] text-xs font-mono text-neutral-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neutral-200" />
              <span className="w-3 h-3 rounded-full bg-neutral-200" />
              <span className="w-3 h-3 rounded-full bg-neutral-200" />
              <span className="ml-2 font-medium text-ink">draythos.app/app/dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-lavender text-ink text-[11px] font-medium font-ui">
                <CheckCircle2 className="w-3 h-3 text-forest" />
                Verified Corpus Grounding
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-12 min-h-[420px] bg-canvas">
            <div className="md:col-span-6 p-6 border-b md:border-b-0 md:border-r border-hairline flex flex-col justify-between bg-surface/50">
              <div className="space-y-4">
                <div className="bg-neutral-50 border border-hairline rounded-2xl p-4 self-end max-w-[90%] ml-auto text-xs text-ink">
                  What was the total FY24 operating variance between actual and projected expense lines?
                </div>

                <div className="bg-surface border border-hairline rounded-2xl p-4 text-xs text-ink space-y-2.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-forest" />
                    <span className="font-ui font-medium text-ink">Grounded Verification</span>
                  </div>
                  <p className="text-neutral-600 leading-relaxed">
                    According to <strong className="text-ink font-semibold">doc_06_acme_pnl_fy24.xlsx</strong> (Sheet: PnL), total actual operating expense was <strong className="text-ink">$180,000</strong> against a projected $165,000, representing a net variance of <strong className="text-forest">+$15,000 (+9.1%)</strong>.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-50 text-[11px] font-mono text-ink border border-hairline">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-forest" />
                      doc_06_acme_pnl_fy24.xlsx • Expenses!C14
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-lavender/60 text-[11px] font-mono text-ink border border-brand-lavender">
                      Deterministic Locator
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-hairline flex items-center justify-between text-xs text-neutral-500">
                <span>Gold evaluation set benchmark: 94.2%</span>
                <span className="font-mono text-forest">50 Ground-Truth Tests</span>
              </div>
            </div>

            <div className="md:col-span-6 p-6 bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-forest" />
                    <span className="font-ui font-medium text-xs text-ink">doc_06_acme_pnl_fy24.xlsx</span>
                    <span className="font-mono text-[10px] bg-neutral-100 px-2 py-0.5 rounded text-neutral-600">
                      AST ACTIVE
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">Sheet: Expenses</span>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-50 border border-hairline mb-3 text-xs font-mono">
                  <span className="font-bold text-forest">fx</span>
                  <span className="text-neutral-400">=</span>
                  <span className="text-ink font-medium">SUM(B14:D14) * (1 + Buffer)</span>
                  <span className="ml-auto text-[10px] text-neutral-500 bg-surface px-1.5 py-0.5 rounded border border-hairline">
                    Cell E14
                  </span>
                </div>

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
                <span>Multi-tab formula dependencies preserved</span>
                <span className="font-mono text-forest font-medium">Zero Hallucinated Metrics</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Proof Strip ── */}
      <section className="border-y border-hairline bg-neutral-50 py-12">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center md:text-left">
            {proofSignals.map((sig, i) => (
              <div key={i}>
                <div className="font-display text-3xl sm:text-4xl text-forest font-medium tabular-nums">
                  {sig.display}
                </div>
                <div className="font-ui font-medium text-sm text-ink mt-1">{sig.label}</div>
                <div className="text-xs text-neutral-600 mt-0.5">{sig.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Platform Capabilities Beyond Chat ── */}
      <section className="max-w-6xl mx-auto px-6 sm:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-mono tracking-widest uppercase text-forest font-semibold">
            PLATFORM MODULES
          </span>
          <h2 className="font-display text-4xl sm:text-5xl tracking-tight text-ink mt-2">
            Engineered for high-stakes audits
          </h2>
          <p className="text-sm sm:text-base text-neutral-600 mt-3 font-normal">
            A comprehensive financial data room. Cross-jurisdiction normalization, exception queues, and SHA-256 audit ledgers.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {platformTiles.map((tile, i) => (
            <Link
              key={i}
              href={tile.href}
              className="group block rounded-2xl border border-hairline bg-surface p-7 shadow-xs hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-forest/8 flex items-center justify-center group-hover:bg-forest/14 transition-colors">
                  <tile.icon className="w-5 h-5 text-forest" />
                </div>
                <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-brand-lavender text-ink border border-brand-lavender/60">
                  {tile.badge}
                </span>
              </div>
              <h3 className="font-display text-xl text-ink font-medium mb-1.5 group-hover:text-forest transition-colors">
                {tile.title}
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed font-normal">
                {tile.desc}
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium text-forest">
                <span>Open module</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 6. FAQ Accordion ── */}
      <section className="max-w-4xl mx-auto px-6 sm:px-8 py-16 border-t border-hairline">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl tracking-tight text-ink">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-hairline bg-surface overflow-hidden shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-ui font-medium text-sm text-ink cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-forest shrink-0 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-neutral-600 leading-relaxed font-normal border-t border-hairline/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 7. Footer ── */}
      <footer className="bg-brand-ink text-brand-paper pt-16 pb-12 border-t border-neutral-800">
        <div className="max-w-6xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-12 border-b border-neutral-800 text-sm">
            <div className="col-span-2 space-y-3">
              <span className="font-display font-medium text-2xl tracking-tight text-brand-paper">
                Draythos
              </span>
              <p className="text-xs text-brand-cream-grey max-w-sm leading-relaxed">
                Evidence-grounded financial document intelligence with formula-safe AST preservation and multi-standard normalization.
              </p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-brand-paper">Platform</div>
              <ul className="space-y-1.5 text-brand-cream-grey">
                <li><Link href="/app/dashboard" className="hover:text-brand-paper">Overview</Link></li>
                <li><Link href="/app/dataroom" className="hover:text-brand-paper">Data Room</Link></li>
                <li><Link href="/app/jurisdictions" className="hover:text-brand-paper">Cross-Jurisdiction</Link></li>
                <li><Link href="/app/exceptions" className="hover:text-brand-paper">Exceptions</Link></li>
              </ul>
            </div>
            <div className="space-y-2 text-xs">
              <div className="font-semibold text-brand-paper">Compliance</div>
              <ul className="space-y-1.5 text-brand-cream-grey">
                <li><Link href="/app/ledger" className="hover:text-brand-paper">Audit Ledger</Link></li>
                <li><Link href="/app/review" className="hover:text-brand-paper">Review Grid</Link></li>
                <li><Link href="/app/concepts" className="hover:text-brand-paper">Concept Map</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; {new Date().getFullYear()} Draythos. Mathematical discipline and editorial warmth.</span>
            <span>Terminology normalization, not a legal determination.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
