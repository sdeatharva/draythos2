"use client";

import { useState, useEffect } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FREE_GEMINI_MODELS, FREE_OPENROUTER_MODELS } from "@/lib/constants";
import { Key, Save, CheckCircle2, ExternalLink } from "lucide-react";

interface KeysDialogProps {
  open: boolean;
  onClose: () => void;
  openRouterKey: string;
  geminiKey: string;
  selectedModel?: string;
  preferredProvider?: string;
  onSaveKeys: (keys: { openRouter?: string; gemini?: string }) => void;
  onSavePreferences?: (prefs: {
    selectedModel?: string;
    preferredProvider?: string;
  }) => void;
}

export function KeysDialog({
  open,
  onClose,
  openRouterKey,
  geminiKey,
  selectedModel = "gemini-3.8-flash",
  preferredProvider = "gemini",
  onSaveKeys,
  onSavePreferences,
}: KeysDialogProps) {
  const [localProvider, setLocalProvider] = useState(preferredProvider || "gemini");
  const [localModel, setLocalModel] = useState(selectedModel || "gemini-3.8-flash");
  const [localGemKey, setLocalGemKey] = useState(geminiKey || "");
  const [localOrKey, setLocalOrKey] = useState(openRouterKey || "");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setLocalProvider(preferredProvider || "gemini");
  }, [preferredProvider]);

  useEffect(() => {
    setLocalModel(selectedModel || (localProvider === "gemini" ? "gemini-3.8-flash" : "nvidia/nemotron-3.5-super-vl:free"));
  }, [selectedModel, localProvider]);

  useEffect(() => {
    setLocalGemKey(geminiKey || "");
  }, [geminiKey]);

  useEffect(() => {
    setLocalOrKey(openRouterKey || "");
  }, [openRouterKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSaveKeys({
      gemini: localGemKey.trim(),
      openRouter: localOrKey.trim(),
    });

    if (onSavePreferences) {
      onSavePreferences({
        preferredProvider: localProvider,
        selectedModel: localModel,
      });
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <Dialog open={open} onClose={onClose} title="API Keys & Model Provider">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Provider Selection (Two clean options) */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setLocalProvider("gemini");
              setLocalModel("gemini-3.8-flash");
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              localProvider === "gemini"
                ? "border-clay bg-surface ring-1 ring-clay shadow-xs"
                : "border-hairline bg-surface hover:bg-oat/50 text-cloud-dark"
            }`}
          >
            <div className="font-display font-medium text-xs text-ink mb-0.5">
              Google Gemini
            </div>
            <p className="text-[11px] text-cloud-dark font-reading">
              Google AI Studio's Free APIs
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setLocalProvider("openrouter");
              setLocalModel("nvidia/nemotron-3.5-super-vl:free");
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              localProvider === "openrouter"
                ? "border-clay bg-surface ring-1 ring-clay shadow-xs"
                : "border-hairline bg-surface hover:bg-oat/50 text-cloud-dark"
            }`}
          >
            <div className="font-display font-medium text-xs text-ink mb-0.5">
              Open Router
            </div>
            <p className="text-[11px] text-cloud-dark font-reading">
              Free Models Catalog
            </p>
          </button>
        </div>

        {/* Model Dropdown */}
        {localProvider === "gemini" ? (
          <div>
            <label className="block text-xs font-display font-medium text-ink mb-1.5">
              Model Selection
            </label>
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="w-full text-xs font-display p-2.5 rounded-lg border border-hairline bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-clay"
            >
              {FREE_GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-display font-medium text-ink mb-1.5">
              Model Selection
            </label>
            <select
              value={localModel}
              onChange={(e) => setLocalModel(e.target.value)}
              className="w-full text-xs font-display p-2.5 rounded-lg border border-hairline bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-clay"
            >
              {FREE_OPENROUTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* API Key Input */}
        {localProvider === "gemini" ? (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-display font-medium text-ink">
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-display text-clay hover:underline inline-flex items-center gap-1"
              >
                Get API key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              type="password"
              placeholder="Enter your Gemini API key"
              value={localGemKey}
              onChange={(e) => setLocalGemKey(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-display font-medium text-ink">
                OpenRouter API Key
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-display text-clay hover:underline inline-flex items-center gap-1"
              >
                Get API key <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              type="password"
              placeholder="Enter your OpenRouter API key"
              value={localOrKey}
              onChange={(e) => setLocalOrKey(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
        )}

        {savedSuccess && (
          <div className="flex items-center gap-2 p-2 bg-oat rounded-lg text-xs font-display text-ink border border-hairline">
            <CheckCircle2 className="h-4 w-4 text-clay" />
            Keys and model configuration saved.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-hairline">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" iconLeft={<Save className="h-3.5 w-3.5" />}>
            Save Keys
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

