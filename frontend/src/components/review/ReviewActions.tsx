"use client";

import React, { useState } from "react";
import { Check, X, ArrowRightLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReviewActionsProps {
  factId: string;
  currentState: string;
  concepts: Array<{ concept_id: string; label: string; kind: string }>;
  onReview: (factId: string, action: "accept" | "reject" | "reassign", newConceptId?: string) => Promise<void>;
}

export function ReviewActions({ factId, currentState, concepts, onReview }: ReviewActionsProps) {
  const [loading, setLoading] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState("");

  const handleAction = async (action: "accept" | "reject" | "reassign", newCid?: string) => {
    setLoading(true);
    try {
      await onReview(factId, action, newCid);
      setShowReassign(false);
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Accept button */}
      <button
        disabled={loading || currentState === "user_confirmed"}
        onClick={() => handleAction("accept")}
        className="h-6 px-2 text-xs font-medium text-positive hover:bg-positive/10 rounded-[4px] transition-colors disabled:opacity-30 disabled:hover:bg-transparent inline-flex items-center gap-1"
        title="Confirm canonical translation"
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        <span>Accept</span>
      </button>

      {/* Reject button */}
      <button
        disabled={loading || currentState === "rejected"}
        onClick={() => handleAction("reject")}
        className="h-6 px-2 text-xs font-medium text-negative hover:bg-negative/10 rounded-[4px] transition-colors disabled:opacity-30 disabled:hover:bg-transparent inline-flex items-center gap-1"
        title="Reject this mapping"
      >
        <X className="w-3 h-3" />
        <span>Reject</span>
      </button>

      {/* Reassign dropdown trigger */}
      {!showReassign ? (
        <button
          disabled={loading}
          onClick={() => setShowReassign(true)}
          className="h-6 px-2 text-xs font-medium text-secondary hover:text-primary hover:bg-raised rounded-[4px] transition-colors inline-flex items-center gap-1"
          title="Reassign to another canonical concept"
        >
          <ArrowRightLeft className="w-3 h-3" />
          <span>Reassign</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 bg-surface border border-hairline rounded-[4px] p-0.5 shadow-2xs">
          <select
            value={selectedConcept}
            onChange={(e) => setSelectedConcept(e.target.value)}
            className="text-xs bg-transparent text-primary border-none focus:outline-none max-w-[140px] px-1"
          >
            <option value="">Select concept</option>
            {concepts.map((c) => (
              <option key={c.concept_id} value={c.concept_id}>
                {c.label} ({c.kind})
              </option>
            ))}
          </select>
          <button
            disabled={!selectedConcept || loading}
            onClick={() => handleAction("reassign", selectedConcept)}
            className="h-5 px-1.5 text-xs rounded bg-primary text-canvas font-medium hover:opacity-90 disabled:opacity-30"
          >
            Save
          </button>
          <button
            onClick={() => setShowReassign(false)}
            className="p-0.5 text-muted hover:text-primary"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
