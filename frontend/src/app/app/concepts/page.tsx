"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ShieldCheck, GitBranch } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AliasEditor } from "@/components/concepts/AliasEditor";
import { ConceptTable } from "@/components/concepts/ConceptTable";
import { ChangeLog } from "@/components/concepts/ChangeLog";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay, ease: "easeOut" as any },
  }),
};

export default function ConceptMapPage() {
  const [concepts, setConcepts] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [mappingVersion, setMappingVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [prevVersion, setPrevVersion] = useState<number>(1);
  const [versionBumped, setVersionBumped] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, mRes, lRes] = await Promise.all([
        fetch("/api/concepts"),
        fetch("/api/mappings"),
        fetch("/api/mappings/log"),
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setConcepts(cData.concepts || []);
      }
      if (mRes.ok) {
        const mData = await mRes.json();
        setMappings(mData.mappings || []);
        if (mData.mapping_version) {
          setPrevVersion(mappingVersion);
          setMappingVersion(mData.mapping_version);
          if (mData.mapping_version > mappingVersion) {
            setVersionBumped(true);
            setTimeout(() => setVersionBumped(false), 1200);
          }
        }
      }
      if (lRes.ok) {
        const lData = await lRes.json();
        setLogs(lData.logs || []);
      }
    } catch (err) {
      console.error("Failed to load concept mapping data:", err);
    } finally {
      setLoading(false);
    }
  }, [mappingVersion]);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteMapping = async (aliasId: string) => {
    try {
      const res = await fetch(`/api/mappings/${aliasId}`, { method: "DELETE" });
      if (res.ok) {
        await loadAll();
      }
    } catch (err) {
      console.error("Delete mapping failed:", err);
    }
  };

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
                href="/app/review"
                className="text-xs text-forest hover:underline transition-colors"
              >
                Translation review →
              </Link>
            </div>

            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
                Concept map and synonym editor
              </h1>
              <motion.span
                key={mappingVersion}
                initial={{ scale: versionBumped ? 1.3 : 1, backgroundColor: versionBumped ? "var(--color-forest)" : undefined }}
                animate={{ scale: 1, backgroundColor: "transparent" }}
                transition={{ duration: 0.5 }}
                className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-oat border border-hairline text-ink tabular-nums flex items-center gap-1"
              >
                <GitBranch className="w-3 h-3 text-forest" />
                v{mappingVersion}
              </motion.span>
            </div>
            <p className="text-xs text-ink-soft mt-1 max-w-2xl font-normal">
              Modify synonyms and financial concept alignments with live impact preview. Changes increment the monotonic mapping version and immediately recompute existing facts across your data room.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            className="h-8 px-3 text-xs self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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
            Taxonomy: 150 concepts (tax, fs, cmp)
          </span>
        </motion.div>

        {/* Summary Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: "Canonical Concepts", value: concepts.length, sub: "In taxonomy" },
            { label: "Synonym Mappings", value: mappings.length, sub: "Active aliases" },
            { label: "Mapping Version", value: `v${mappingVersion}`, sub: "Monotonic" },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl bg-surface border border-hairline p-4 shadow-xs text-center">
              <div className="font-mono text-xl font-bold text-forest tabular-nums">{stat.value}</div>
              <div className="text-xs font-medium text-ink mt-0.5">{stat.label}</div>
              <div className="text-[11px] text-cloud-dark">{stat.sub}</div>
            </div>
          ))}
        </motion.div>

        {/* Editor Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <AliasEditor concepts={concepts} onMappingAdded={loadAll} />
        </motion.div>

        {/* Catalog Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.28 }}
        >
          <ConceptTable mappings={mappings} onDeleteMapping={handleDeleteMapping} />
        </motion.div>

        {/* Audit Change Log */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
        >
          <ChangeLog logs={logs} />
        </motion.div>
      </div>
    </div>
  );
}
