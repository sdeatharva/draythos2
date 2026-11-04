"use client";

import { useState, useCallback, useEffect } from "react";
import type { ChatSession, DocumentTab, WorkspaceState } from "@/types";

const PREFERENCES_KEY = "draythos-workspace-prefs";

interface UseWorkspaceReturn {
  state: WorkspaceState;
  setActiveSession: (session: ChatSession | null) => void;
  addTab: (tab: DocumentTab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string | null) => void;
  toggleSidebar: () => void;
  setViewMode: (mode: "split" | "chat" | "artifacts") => void;
}

function loadPreferences(): Partial<WorkspaceState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePreferences(state: WorkspaceState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({
      sidebarOpen: state.sidebarOpen,
      viewMode: state.viewMode,
    })
  );
}

export function useWorkspace(): UseWorkspaceReturn {
  const [state, setState] = useState<WorkspaceState>(() => {
    const prefs = loadPreferences();
    return {
      activeSession: null,
      activeTabs: [],
      activeTabId: null,
      sidebarOpen: prefs.sidebarOpen ?? true,
      viewMode: prefs.viewMode ?? "split",
    };
  });

  // Responsive view mode switching
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setState((prev) => ({ ...prev, viewMode: "chat" }));
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Persist preferences
  useEffect(() => {
    savePreferences(state);
  }, [state.sidebarOpen, state.viewMode]);

  const setActiveSession = useCallback((session: ChatSession | null) => {
    setState((prev) => ({ ...prev, activeSession: session }));
  }, []);

  const addTab = useCallback((tab: DocumentTab) => {
    setState((prev) => {
      const exists = prev.activeTabs.find((t) => t.id === tab.id);
      if (exists) {
        return {
          ...prev,
          activeTabId: tab.id,
          activeTabs: prev.activeTabs.map((t) => ({
            ...t,
            isActive: t.id === tab.id,
          })),
        };
      }
      return {
        ...prev,
        activeTabId: tab.id,
        activeTabs: [
          ...prev.activeTabs.map((t) => ({ ...t, isActive: false })),
          { ...tab, isActive: true },
        ],
      };
    });
  }, []);

  const removeTab = useCallback((tabId: string) => {
    setState((prev) => {
      const newTabs = prev.activeTabs.filter((t) => t.id !== tabId);
      let newActiveId = prev.activeTabId;
      if (prev.activeTabId === tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return {
        ...prev,
        activeTabs: newTabs.map((t) => ({
          ...t,
          isActive: t.id === newActiveId,
        })),
        activeTabId: newActiveId,
      };
    });
  }, []);

  const setActiveTab = useCallback((tabId: string | null) => {
    setState((prev) => ({
      ...prev,
      activeTabId: tabId,
      activeTabs: prev.activeTabs.map((t) => ({
        ...t,
        isActive: t.id === tabId,
      })),
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  }, []);

  const setViewMode = useCallback(
    (mode: "split" | "chat" | "artifacts") => {
      setState((prev) => ({ ...prev, viewMode: mode }));
    },
    []
  );

  return {
    state,
    setActiveSession,
    addTab,
    removeTab,
    setActiveTab,
    toggleSidebar,
    setViewMode,
  };
}

