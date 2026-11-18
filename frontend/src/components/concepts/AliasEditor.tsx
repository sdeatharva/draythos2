"use client";

import React, { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImpactPreview } from "@/components/concepts/ImpactPreview";

interface AliasEditorProps {
  concepts: Array<{ concept_id: string; label: string; kind: string }>;
  onMappingAdded: () => void;
}

export function AliasEditor({ concepts, onMappingAdded }: AliasEditorProps) {
  const [alias, setAlias] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [relation, setRelation] = useState("equivalent");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCheckImpact = async () => {
    if (!alias.trim() || !conceptId) return;
    setPreviewing(true);
    try {
      const res = await fetch("/api/mappings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: alias.trim(), concept_id: conceptId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alias.trim() || !conceptId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alias: alias.trim(),
          concept_id: conceptId,
          relation,
          reason: reason.trim() || "User manual override",
        }),
      });

      if (res.ok) {
        setAlias("");
        setConceptId("");
        setReason("");
        setPreview(null);
        onMappingAdded();
      }
    } catch (err) {
      console.error("Save mapping failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-hairline rounded-lg p-4 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-primary">
          Add or override synonym mapping
        </h3>
        <span className="text-xs font-mono text-muted tabular">
          Live recompute
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-secondary mb-1">
            Surface word or synonym
          </label>
          <input
            type="text"
            placeholder="e.g. GST, Turnover, Topline"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            onBlur={handleCheckImpact}
            className="w-full text-xs h-8 bg-surface border border-hairline rounded-md px-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-secondary"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1">
            Canonical concept
          </label>
          <select
            value={conceptId}
            onChange={(e) => setConceptId(e.target.value)}
            className="w-full text-xs h-8 bg-surface border border-hairline rounded-md px-2 text-primary focus:outline-none focus:border-secondary"
            required
          >
            <option value="">Select canonical target</option>
            {concepts.map((c) => (
              <option key={c.concept_id} value={c.concept_id}>
                {c.label} ({c.kind})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-secondary mb-1">
            Equivalence policy
          </label>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className="w-full text-xs h-8 bg-surface border border-hairline rounded-md px-2 text-primary focus:outline-none focus:border-secondary"
          >
            <option value="equivalent">Equivalent (positive pair)</option>
            <option value="related">Related (broader / narrower)</option>
            <option value="different">Different (distinct regime)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-secondary mb-1">
          Audit note (optional)
        </label>
        <input
          type="text"
          placeholder="e.g. UK filing term mapped to IFRS revenue"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full text-xs h-8 bg-surface border border-hairline rounded-md px-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-secondary"
        />
      </div>

      {preview && <ImpactPreview preview={preview} />}

      <div className="flex items-center justify-end gap-2 pt-1">
        {alias.trim() && conceptId && !preview && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCheckImpact}
            disabled={previewing}
            className="h-8 text-xs"
          >
            {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Preview impact
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting || !alias.trim() || !conceptId}
          className="h-8 text-xs"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <Plus className="w-3.5 h-3.5 mr-1" />
          )}
          Save and recompute
        </Button>
      </div>
    </form>
  );
}
