"use client";

import React from "react";
import { ArrowRight } from "lucide-react";

interface ImpactPreviewProps {
  preview: {
    alias: string;
    target_concept: { label: string; concept_id: string };
    total_affected_facts: number;
    affected_document_ids: string[];
    samples: Array<{
      fact_id: string;
      doc_id: string;
      raw_label: string;
      old_concept_label?: string;
      new_concept_label: string;
      value_raw: string;
    }>;
  } | null;
}

export function ImpactPreview({ preview }: ImpactPreviewProps) {
  if (!preview) return null;

  return (
    <div className="rounded-lg border border-hairline bg-raised p-3 text-xs space-y-2">
      <div className="text-secondary">
        <span className="font-medium text-primary">Impact preview: </span>
        <span className="font-mono tabular text-primary font-medium">{preview.total_affected_facts} existing facts</span> will recompute to{" "}
        <span className="font-medium text-primary">&ldquo;{preview.target_concept.label}&rdquo;</span>.
      </div>

      {preview.samples.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-hairline">
          <div className="text-[11px] text-muted">
            Sample affected facts in data room
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
            {preview.samples.map((s) => (
              <div
                key={s.fact_id}
                className="flex items-center justify-between p-1.5 bg-surface rounded border border-hairline"
              >
                <div className="truncate max-w-[160px] text-primary">
                  {s.raw_label} ({s.value_raw})
                </div>
                <div className="flex items-center gap-1.5 text-secondary">
                  <span className="line-through text-muted">
                    {s.old_concept_label || "Unmapped"}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted" />
                  <span className="text-positive font-medium">{s.new_concept_label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
