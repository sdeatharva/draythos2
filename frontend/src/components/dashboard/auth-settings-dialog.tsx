"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/types";
import {
  Sliders,
  User,
  LogOut,
  Save,
  CheckCircle2,
  Trash2,
  Plus,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";

interface AuthSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  customInstructions?: string;
  memories?: any[];
  openRouterKey?: string;
  geminiKey?: string;
  onSavePreferences?: (prefs: {
    customInstructions?: string;
    openRouterKey?: string;
    geminiKey?: string;
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
  openRouterKey = "",
  geminiKey = "",
  onSavePreferences,
  onAddMemory,
  onDeleteMemory,
  onLogout,
}: AuthSettingsDialogProps) {
  const [tab, setTab] = useState<"workspace" | "keys" | "account">("workspace");
  const [localPrompt, setLocalPrompt] = useState(customInstructions || "");
  const [localOrKey, setLocalOrKey] = useState(openRouterKey || "");
  const [localGemKey, setLocalGemKey] = useState(geminiKey || "");
  const [showOrKey, setShowOrKey] = useState(false);
  const [showGemKey, setShowGemKey] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [selectedMemoryIds, setSelectedMemoryIds] = useState<Set<string>>(new Set());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSavePreferences) {
      onSavePreferences({
        customInstructions: localPrompt.trim(),
        openRouterKey: localOrKey.trim(),
        geminiKey: localGemKey.trim(),
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

  return (
    <Dialog open={open} onClose={onClose} title="Settings">
      <div className="flex border-b border-hairline mb-5 -mx-6 px-6">
        <button
          onClick={() => setTab("workspace")}
          className={`pb-2.5 px-3 text-xs font-display font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "workspace"
              ? "border-forest text-ink"
              : "border-transparent text-cloud-dark hover:text-ink"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" />
          Workspace
        </button>
        <button
          onClick={() => setTab("keys")}
          className={`pb-2.5 px-3 text-xs font-display font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "keys"
              ? "border-forest text-ink"
              : "border-transparent text-cloud-dark hover:text-ink"
          }`}
        >
          <Key className="h-3.5 w-3.5" />
          API Keys (BYOK)
        </button>
        <button
          onClick={() => setTab("account")}
          className={`pb-2.5 px-3 text-xs font-display font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === "account"
              ? "border-forest text-ink"
              : "border-transparent text-cloud-dark hover:text-ink"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          Account
        </button>
      </div>

      {tab === "workspace" && (
        <div className="space-y-6">
          <form onSubmit={handleSaveWorkspace} className="space-y-2.5">
            <div>
              <h3 className="text-xs font-display font-semibold text-ink">System Instructions</h3>
              <p className="text-[11px] font-reading text-cloud-dark mt-0.5">
                Custom prompt applied to models for accounting context and reporting requirements.
              </p>
            </div>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="e.g. Highlight discrepancies in footnote references..."
              rows={4}
              className="w-full text-xs p-3 rounded-xl border border-hairline bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-forest resize-none"
            />
            <div className="flex justify-between items-center">
              {savedSuccess ? (
                <span className="flex items-center gap-1 text-xs text-forest">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              ) : <div />}
              <Button variant="primary" size="sm" type="submit" iconLeft={<Save className="h-3.5 w-3.5" />}>
                Save Instructions
              </Button>
            </div>
          </form>
        </div>
      )}

      {tab === "keys" && (
        <form onSubmit={handleSaveWorkspace} className="space-y-5">
          <div className="rounded-xl p-3 bg-neutral-50 border border-hairline text-xs text-neutral-600">
            <strong>Client-Side Isolation:</strong> API keys are saved locally in encrypted storage and never transmitted to multi-tenant servers.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink block">Google Gemini API Key</label>
            <div className="relative">
              <Input
                type={showGemKey ? "text" : "password"}
                placeholder="AIzaSy..."
                value={localGemKey}
                onChange={(e) => setLocalGemKey(e.target.value)}
                className="pr-10 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowGemKey(!showGemKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink"
              >
                {showGemKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ink block">OpenRouter API Key</label>
            <div className="relative">
              <Input
                type={showOrKey ? "text" : "password"}
                placeholder="sk-or-v1-..."
                value={localOrKey}
                onChange={(e) => setLocalOrKey(e.target.value)}
                className="pr-10 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowOrKey(!showOrKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-ink"
              >
                {showOrKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            {savedSuccess ? (
              <span className="flex items-center gap-1 text-xs text-forest">
                <CheckCircle2 className="w-3.5 h-3.5" /> Keys Saved
              </span>
            ) : <div />}
            <Button variant="primary" size="sm" type="submit" iconLeft={<Save className="h-3.5 w-3.5" />}>
              Save Keys
            </Button>
          </div>
        </form>
      )}

      {tab === "account" && (
        <div className="space-y-4">
          <div className="p-4 bg-neutral-50 rounded-xl border border-hairline space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-forest text-paper flex items-center justify-center font-display font-semibold text-sm">
                {user?.name?.[0]?.toUpperCase() || "D"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-medium text-sm text-ink truncate">{user?.name || "Demo Analyst"}</p>
                <p className="text-xs text-cloud-dark truncate">{user?.email || "demo@draythos.app"}</p>
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
