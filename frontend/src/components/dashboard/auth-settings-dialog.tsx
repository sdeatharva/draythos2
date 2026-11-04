"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/types";
import { Sliders, User, LogOut, Save, CheckCircle2, Trash2, Plus } from "lucide-react";

interface AuthSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  customInstructions?: string;
  memories?: any[];
  onSavePreferences?: (prefs: {
    customInstructions?: string;
  }) => void;
  onAddMemory?: (fact: string, category?: string) => void;
  onDeleteMemory?: (id: string) => void;
  onLogout: () => void;
}

export function AuthSettingsDialog({
  open,
  onClose,
  user,
  customInstructions = "",
  memories = [],
  onSavePreferences,
  onAddMemory,
  onDeleteMemory,
  onLogout,
}: AuthSettingsDialogProps) {
  const [tab, setTab] = useState<"workspace" | "account">("workspace");
  const [localPrompt, setLocalPrompt] = useState(customInstructions || "");
  const [newMemoryText, setNewMemoryText] = useState("");
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(new Set());
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setLocalPrompt(customInstructions || "");
  }, [customInstructions]);

  const handleSavePrompt = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSavePreferences) {
      onSavePreferences({
        customInstructions: localPrompt.trim(),
      });
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleAddFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryText.trim() || !onAddMemory) return;
    onAddMemory(newMemoryText.trim(), "preference");
    setNewMemoryText("");
  };

  const toggleSelectMemory = (id: string) => {
    setSelectedMemoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (!onDeleteMemory) return;
    selectedMemoryIds.forEach((id) => {
      onDeleteMemory(id);
    });
    setSelectedMemoryIds(new Set());
  };

  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      {/* Two Clean Tabs: Workspace Settings and Account */}
      <div className="flex border-b border-hairline mb-5 -mx-6 px-6">
        <button
          onClick={() => setTab("workspace")}
          className={`pb-2.5 px-3 text-xs font-display font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "workspace"
              ? "border-clay text-ink"
              : "border-transparent text-cloud-dark hover:text-ink"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Workspace Settings
        </button>
        <button
          onClick={() => setTab("account")}
          className={`pb-2.5 px-3 text-xs font-display font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "account"
              ? "border-clay text-ink"
              : "border-transparent text-cloud-dark hover:text-ink"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          Account
        </button>
      </div>

      {/* ── Tab: Workspace Settings ── */}
      {tab === "workspace" && (
        <div className="space-y-6">
          {/* Section 1: System Prompt */}
          <form onSubmit={handleSavePrompt} className="space-y-2.5">
            <div>
              <h3 className="text-xs font-display font-semibold text-ink">
                System Prompt
              </h3>
              <p className="text-[11px] font-reading text-cloud-dark mt-0.5 leading-relaxed">
                Define custom prompt instructions that apply to all chats to guide model behavior for your account.
              </p>
            </div>

            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="e.g. Provide a concise glossary at the end of each response, and highlight key metrics."
              rows={4}
              className="w-full text-xs font-reading p-3 rounded-xl border border-hairline bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-clay resize-none placeholder:text-cloud-dark"
            />

            <div className="flex items-center justify-between pt-1">
              {savedSuccess ? (
                <span className="flex items-center gap-1.5 text-xs text-clay font-display">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              ) : <div />}
              <Button variant="primary" size="sm" type="submit" iconLeft={<Save className="h-3.5 w-3.5" />}>
                Save System Prompt
              </Button>
            </div>
          </form>

          {/* Section 2: Workspace Memory */}
          <div className="pt-4 border-t border-hairline space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-display font-semibold text-ink">
                  Workspace Memory
                </h3>
                <p className="text-[11px] font-reading text-cloud-dark mt-0.5">
                  Key details and preferences remembered by the workspace.
                </p>
              </div>

              {selectedMemoryIds.size > 0 && onDeleteMemory && (
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  className="text-xs font-display text-clay-deep hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Selected ({selectedMemoryIds.size})
                </button>
              )}
            </div>

            {/* Add Fact Form */}
            <form onSubmit={handleAddFact} className="flex gap-2">
              <Input
                type="text"
                placeholder="Add a fact (e.g. Preferred reporting currency is USD)..."
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                className="text-xs"
              />
              <Button variant="secondary" size="sm" type="submit" iconLeft={<Plus className="h-3.5 w-3.5" />}>
                Add Fact
              </Button>
            </form>

            {/* List of facts */}
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {memories.length === 0 ? (
                <p className="text-xs text-cloud-dark font-reading py-2 text-center">
                  No remembered facts yet.
                </p>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-hairline bg-surface text-xs font-reading"
                  >
                    <label className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={selectedMemoryIds.has(m.id)}
                        onChange={() => toggleSelectMemory(m.id)}
                        className="rounded border-hairline text-clay focus:ring-0"
                      />
                      <span className="text-ink truncate">{m.fact}</span>
                    </label>

                    {onDeleteMemory && (
                      <button
                        type="button"
                        onClick={() => onDeleteMemory(m.id)}
                        className="p-1 text-cloud-dark hover:text-clay-deep transition-colors ml-2 shrink-0"
                        title="Delete fact"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Account ── */}
      {tab === "account" && (
        <div className="space-y-4">
          <div className="p-4 bg-oat/50 rounded-xl border border-hairline space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-clay text-canvas flex items-center justify-center font-display font-semibold text-sm shadow-xs">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-medium text-sm text-ink truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-cloud-dark truncate">{user?.email || "user@example.com"}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-hairline/60 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-cloud-dark block text-[10px] uppercase font-display">Role</span>
                <span className="text-ink font-medium">{user?.role || "Member"}</span>
              </div>
              <div>
                <span className="text-cloud-dark block text-[10px] uppercase font-display">Status</span>
                <span className="text-emerald-600 font-medium">Verified</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-hairline">
            <Button variant="destructive" size="sm" onClick={onLogout} iconLeft={<LogOut className="h-3.5 w-3.5" />}>
              Sign Out
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
