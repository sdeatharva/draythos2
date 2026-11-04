"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { ChatSession, AuthUser } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import {
  Plus,
  Search,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  PanelLeftClose,
  FileText,
  Sliders,
  Key,
  Settings,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Paperclip,
  Folder,
} from "lucide-react";

interface LiquidDockProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  user?: AuthUser | null;
  onOpenSettings?: () => void;
  onOpenKeys?: () => void;
  onOpenLibrary?: () => void;
  onLogout?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export function LiquidDock({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  isCollapsed,
  onToggleCollapse,
  user,
  onOpenSettings,
  onOpenKeys,
  onOpenLibrary,
  onLogout,
  isDark = true,
  onToggleTheme,
}: LiquidDockProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close profile popup on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setProfilePopupOpen(false);
      }
    }
    if (profilePopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profilePopupOpen]);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRename = useCallback(() => {
    if (renameId && renameValue.trim()) {
      onRenameSession(renameId, renameValue.trim());
      setRenameId(null);
      setRenameValue("");
    }
  }, [renameId, renameValue, onRenameSession]);

  const handleDelete = useCallback(() => {
    if (deleteConfirmId) {
      onDeleteSession(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, onDeleteSession]);

  const displayName = user?.name?.split(" ")[0] || "User";

  return (
    <div className="flex flex-col h-full bg-surface select-none relative">
      {/* ── 1. Top Header: Brand & Collapse ── */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-base text-ink tracking-tight">
            Draythos
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-cloud-dark hover:text-ink hover:bg-oat/60 transition-colors"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* ── 2. New Chat & Library Buttons ── */}
      <div className="px-3 py-2 space-y-1.5">
        <button
          onClick={onNewSession}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-hairline/70 bg-surface hover:bg-oat/60 text-ink font-display text-sm font-medium transition-colors shadow-xs"
        >
          <Plus className="h-4 w-4 text-clay" />
          <span>New chat</span>
        </button>
        {onOpenLibrary && (
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-xl border border-hairline/50 bg-oat/30 hover:bg-oat/70 text-ink-soft hover:text-ink font-display text-xs font-medium transition-colors shadow-xs"
            title="Open Workspace Document Library"
          >
            <Folder className="h-3.5 w-3.5 text-clay" />
            <span>Document Library</span>
          </button>
        )}
      </div>

      {/* ── 3. Quick Action Navigation ── */}
      <div className="px-3 py-1 space-y-0.5">
        <div className="relative">
          <input
            type="text"
            placeholder="Search sessions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-hairline/60 bg-transparent text-xs font-reading text-ink placeholder:text-cloud-dark focus:outline-none focus:border-clay/50 transition-colors"
          />
          <Search className="h-3.5 w-3.5 text-cloud-dark absolute left-2.5 top-2" />
        </div>
      </div>

      {/* ── 4. Chats Section Header ── */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-display font-medium text-cloud-dark uppercase tracking-wider flex items-center gap-1">
          Recent chats <ChevronDown className="h-3 w-3" />
        </span>
        <span className="text-[10px] font-mono text-cloud-dark">
          {filteredSessions.length}
        </span>
      </div>

      {/* ── 5. Session List ── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {filteredSessions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="h-6 w-6 text-cloud-dark mx-auto mb-2 opacity-50" />
            <p className="text-xs text-cloud-dark font-reading">
              {searchQuery ? "No matching chats" : "Start a new conversation"}
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div key={session.id} className="relative group">
              <button
                onClick={() => onSelectSession(session.id)}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between gap-2 text-xs font-reading",
                  session.id === activeSessionId
                    ? "bg-oat text-ink font-medium"
                    : "text-ink-soft hover:bg-oat/50 hover:text-ink"
                )}
              >
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="text-cloud-dark text-[10px] shrink-0">•</span>
                  <span className="truncate">{session.title}</span>
                </div>

                {/* Session Actions Menu Trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(menuOpen === session.id ? null : session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-hairline/60 transition-opacity shrink-0"
                  aria-label="Session options"
                >
                  <MoreHorizontal className="h-3 w-3 text-cloud-dark" />
                </button>
              </button>

              {/* Context Menu */}
              {menuOpen === session.id && (
                <div className="absolute right-2 top-full z-30 bg-surface border border-hairline rounded-xl shadow-lg py-1 min-w-[130px] animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setRenameId(session.id);
                      setRenameValue(session.title);
                      setMenuOpen(null);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink hover:bg-oat/60 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Rename
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmId(session.id);
                      setMenuOpen(null);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-clay-deep hover:bg-clay-deep/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── 6. Bottom User Pill & Popover Menu ── */}
      <div className="p-2 border-t border-hairline" ref={popupRef}>
        {/* Profile Popover Menu */}
        {profilePopupOpen && (
          <div className="absolute bottom-16 left-3 right-3 z-40 bg-surface border border-hairline rounded-2xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header: User Email */}
            <div className="px-3.5 py-2 border-b border-hairline/70">
              <p className="text-xs font-reading text-ink font-medium truncate">
                {user?.email || "user@draythos.app"}
              </p>
            </div>

            {/* Menu Actions */}
            <div className="p-1 space-y-0.5">
              <button
                onClick={() => {
                  setProfilePopupOpen(false);
                  onOpenKeys?.();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-display text-ink hover:bg-oat/60 rounded-xl transition-colors"
              >
                <Key className="h-3.5 w-3.5 text-cloud-dark" />
                <span>Keys</span>
              </button>

              {onToggleTheme && (
                <button
                  onClick={() => {
                    onToggleTheme();
                  }}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-display text-ink hover:bg-oat/60 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? (
                      <Sun className="h-3.5 w-3.5 text-clay" />
                    ) : (
                      <Moon className="h-3.5 w-3.5 text-cloud-dark" />
                    )}
                    <span>Appearance</span>
                  </div>
                  <span className="text-[11px] text-cloud-dark">
                    {isDark ? "Dark" : "Light"}
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setProfilePopupOpen(false);
                  onOpenSettings?.();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-display text-ink hover:bg-oat/60 rounded-xl transition-colors"
              >
                <Settings className="h-3.5 w-3.5 text-cloud-dark" />
                <span>Settings</span>
              </button>
            </div>

            <div className="my-1 border-t border-hairline/60" />

            <div className="p-1">
              <button
                onClick={() => {
                  setProfilePopupOpen(false);
                  if (onLogout) {
                    onLogout();
                  } else if (typeof window !== "undefined") {
                    localStorage.removeItem("draythos_auth_token");
                    localStorage.removeItem("draythos_auth_user");
                    document.cookie = "draythos_auth=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                    document.cookie = "draythos_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
                    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                      window.location.href = "/login";
                    });
                  }
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-display text-clay-deep hover:bg-clay-deep/10 rounded-xl transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Pill Button */}
        <button
          onClick={() => setProfilePopupOpen(!profilePopupOpen)}
          className={cn(
            "flex items-center justify-between w-full p-2 rounded-xl transition-colors text-left",
            profilePopupOpen ? "bg-oat" : "hover:bg-oat/60"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-clay text-canvas flex items-center justify-center font-display font-medium text-xs shrink-0 shadow-xs">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-display font-medium text-ink truncate flex items-center gap-1">
                {displayName}
                <ChevronDown className="h-3 w-3 text-cloud-dark" />
              </p>
            </div>
          </div>

          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-1 rounded text-cloud-dark hover:text-ink transition-colors shrink-0 cursor-pointer"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </span>
        </button>
      </div>

      {/* ── Dialogs ── */}
      <Dialog
        open={renameId !== null}
        onClose={() => setRenameId(null)}
        title="Rename chat"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" size="sm" onClick={() => setRenameId(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleRename}>
            Rename
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete chat"
        description="Permanently delete this chat session and its history?"
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirmId(null)}
          >
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
