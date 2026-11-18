"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useDocuments } from "@/hooks/useDocuments";
import { LiquidDock } from "@/components/eyrie/liquid-dock";
import { ChatPane } from "@/components/dashboard/chat-pane";
import { ArtifactsPane } from "@/components/dashboard/artifacts-pane";
import { AuthSettingsDialog } from "@/components/dashboard/auth-settings-dialog";
import { KeysDialog } from "@/components/dashboard/keys-dialog";
import { LibraryDialog } from "@/components/dashboard/library-dialog";
import { BouncingDots } from "@/components/ui/bouncing-dots";
import type { ChatSession, ChatMessage, DocumentReference, DocumentTab } from "@/types";
import { cn } from "@/lib/utils";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  Plus,
  Loader2,
  FolderOpen,
  Folder,
  Sun,
  Moon,
  Settings,
  Key,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatWorkspaceProps {
  initialSessionId?: string;
}

export function ChatWorkspace({ initialSessionId }: ChatWorkspaceProps) {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const {
    user,
    openRouterKey,
    geminiKey,
    customInstructions,
    selectedModel,
    preferredProvider,
    memories,
    isAuthenticated,
    isLoading: isAuthLoading,
    logout,
    updateApiKeys,
    updatePreferences,
    addMemory,
    deleteMemory,
  } = useAuth();

  // Sessions state: maintain current active session ID in state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId || null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // Sync state if initialSessionId prop updates
  useEffect(() => {
    if (initialSessionId) {
      setCurrentSessionId(initialSessionId);
    }
  }, [initialSessionId]);

  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [artifactSidebarOpen, setArtifactSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  // Workspace & Documents
  const {
    state: workspace,
    addTab,
    removeTab,
    setActiveTab,
    setViewMode,
  } = useWorkspace();

  const {
    documents,
    upload,
    getContent,
    downloadDocument,
    saveDocument,
    uploadProgress,
    dismissUploadProgress,
  } = useDocuments();

  // 1. Auth Guard: if not authenticated, purge stale cookies and redirect to /login
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      if (typeof window !== "undefined") {
        window.location.href = "/api/auth/logout";
      }
    }
  }, [isAuthLoading, isAuthenticated]);

  // 2. Fetch Sessions List for User
  const refreshSessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/sessions?user_id=${encodeURIComponent(user.id)}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.warn("Failed to fetch sessions:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      refreshSessions();
    }
  }, [user?.id, refreshSessions]);

  // 3. Load or Hydrate Active Session
  useEffect(() => {
    if (!initialSessionId) {
      // Clean blank state for `/chat`
      setActiveSession(null);
      setIsLoadingSession(false);
      return;
    }

    let isMounted = true;
    setIsLoadingSession(true);

    fetch(`/api/sessions/${encodeURIComponent(initialSessionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Session not found");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const session: ChatSession = {
          id: data.id || initialSessionId,
          title: data.title || "New chat",
          messages: data.messages || [],
          attachments: data.attachments || [],
          createdAt: data.created_at || new Date().toISOString(),
          updatedAt: data.updated_at || new Date().toISOString(),
        };
        setActiveSession(session);

        // If session has attachments, register them in workspace tabs
        if (session.attachments && session.attachments.length > 0) {
          session.attachments.forEach((doc: any) => {
            addTab({
              id: doc.document_id || doc.id,
              documentRef: {
                document_id: doc.document_id || doc.id,
                session_id: session.id,
                media_type: doc.media_type || "application/octet-stream",
                source_filename: doc.source_filename || doc.filename || "document",
                processing_status: (doc.processing_status || "completed") as any,
                format: (doc.format || "unknown") as any,
              },
              state: "ready",
              isActive: true,
              hasUnsavedChanges: false,
              label: doc.source_filename || doc.filename || "document",
            });
          });
          // Auto-open artifact sidebar when documents exist
          setArtifactSidebarOpen(true);
        }
      })
      .catch((err) => {
        console.warn("Could not load session:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialSessionId, addTab]);

  // 4. Session Action Handlers
  const handleSelectSession = useCallback(
    (id: string) => {
      setCurrentSessionId(id);
      router.push(`/chat/${id}`);
    },
    [router]
  );

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setActiveSession(null);
    router.push("/chat");
  }, [router]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (currentSessionId === id || initialSessionId === id) {
          setCurrentSessionId(null);
          setActiveSession(null);
          router.push("/chat");
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [currentSessionId, initialSessionId, router]
  );

  const handleRenameSession = useCallback(
    async (id: string, title: string) => {
      try {
        await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        });
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, title } : s))
        );
        if (activeSession && activeSession.id === id) {
          setActiveSession((prev) => (prev ? { ...prev, title } : null));
        }
      } catch (err) {
        console.error("Failed to rename session:", err);
      }
    },
    [activeSession]
  );

  const effectiveSession: ChatSession = activeSession || {
    id: currentSessionId || initialSessionId || "new",
    title: "New chat",
    messages: [],
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const attachedDocs = [
    ...effectiveSession.attachments,
    ...documents.filter(
      (d) => !effectiveSession.attachments.some((a) => a.document_id === d.document_id)
    ),
  ];

  // 5. Handle Upload (Reuses active session or creates one cleanly)
  const handleUpload = useCallback(
    async (fileInput: File) => {
      const file = Array.isArray(fileInput) ? fileInput[0] : fileInput;
      if (!file) return;

      let targetSessionId = currentSessionId || activeSession?.id || initialSessionId;

      // If at `/chat` without a session, create one first
      if (!targetSessionId || targetSessionId === "new") {
        targetSessionId = "c_" + Math.random().toString(36).substring(2, 10);
        setCurrentSessionId(targetSessionId);
        try {
          await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: targetSessionId,
              user_id: user?.id || "usr_default",
              title: file.name,
            }),
          });
          refreshSessions();
        } catch (err) {
          console.error("Session creation error:", err);
        }
      }

      try {
        const docRef = await upload(file, targetSessionId, user?.id || "usr_default");
        // Add tab and immediately open artifact sidebar
        addTab({
          id: docRef.document_id,
          documentRef: docRef,
          state: docRef.processing_status === "completed" ? "ready" : "processing",
          isActive: true,
          hasUnsavedChanges: false,
          label: docRef.source_filename || docRef.filename || file.name,
        });
        setActiveTab(docRef.document_id);
        setArtifactSidebarOpen(true);

        // Update active session attachments
        setActiveSession((prev) => {
          if (!prev) {
            return {
              id: targetSessionId!,
              title: file.name,
              messages: [],
              attachments: [docRef],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          }
          return {
            ...prev,
            attachments: [...prev.attachments, docRef],
          };
        });

        // Push URL if not already on this session
        if (typeof window !== "undefined" && !window.location.pathname.includes(targetSessionId)) {
          window.history.pushState(null, "", `/chat/${targetSessionId}`);
          refreshSessions();
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    },
    [currentSessionId, activeSession?.id, initialSessionId, user?.id, upload, addTab, refreshSessions]
  );

  // 5b. Handle Message Send -> Reuses active session or creates one
  const handleSendMessage = useCallback(
    async (content: string): Promise<string | void> => {
      let targetSessionId = currentSessionId || activeSession?.id || initialSessionId;

      if (!targetSessionId || targetSessionId === "new") {
        targetSessionId = "c_" + Math.random().toString(36).substring(2, 10);
        setCurrentSessionId(targetSessionId);
        const titleText = content.slice(0, 36) || "New chat";

        const initialMsg: ChatMessage = {
          id: "m_" + Math.random().toString(36).substring(2, 10),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
          status: "completed",
        };

        setActiveSession({
          id: targetSessionId,
          title: titleText,
          messages: [initialMsg],
          attachments: attachedDocs,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        setSessions((prev) => [
          {
            id: targetSessionId!,
            user_id: user?.id || "usr_default",
            title: titleText,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 1,
            doc_count: attachedDocs.length,
          } as any,
          ...prev.filter((s) => s.id !== targetSessionId),
        ]);

        try {
          await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: targetSessionId,
              user_id: user?.id || "usr_default",
              title: titleText,
            }),
          });
          refreshSessions();
        } catch (err) {
          console.error("Session creation error:", err);
        }

        if (typeof window !== "undefined") {
          window.history.pushState(null, "", `/chat/${targetSessionId}`);
        }
        return targetSessionId;
      }
      return targetSessionId;
    },
    [currentSessionId, activeSession?.id, initialSessionId, user?.id, refreshSessions, attachedDocs]
  );

  // 6. Handle Document Edits / Save
  const handleSave = useCallback(
    async (documentId: string, edits: any, format: string) => {
      return await saveDocument(documentId, edits, format);
    },
    [saveDocument]
  );

  const handleDownload = useCallback(
    async (documentId: string, filename: string, source: "original" | "working" = "working") => {
      await downloadDocument(documentId, filename, source);
    },
    [downloadDocument]
  );

  const handleRevertChanges = useCallback(async (documentId: string) => {
    const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/revert`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Could not revert the working copy");
    window.dispatchEvent(new CustomEvent("draythos:document-updated", {
      detail: { documentId, version: "original" },
    }));
  }, []);

  const handleSelectDocument = useCallback(
    (doc: DocumentReference) => {
      addTab({
        id: doc.document_id,
        documentRef: doc,
        state: doc.processing_status === "completed" ? "ready" : "processing",
        isActive: true,
        hasUnsavedChanges: false,
        label: doc.source_filename || doc.filename || "Document",
      });
      setActiveTab(doc.document_id);
      setArtifactSidebarOpen(true);
    },
    [addTab, setActiveTab]
  );

  const handleAttachFromLibrary = useCallback(
    (docs: DocumentReference[]) => {
      docs.forEach((doc) => {
        addTab({
          id: doc.document_id,
          documentRef: doc,
          state: "ready",
          isActive: true,
          hasUnsavedChanges: false,
          label: doc.source_filename || doc.filename || "Document",
        });
      });

      if (docs.length > 0) {
        setActiveTab(docs[0].document_id);
        setArtifactSidebarOpen(true);
      }

      setActiveSession((prev) => {
        if (!prev) return null;
        const existingIds = new Set(prev.attachments.map((a) => a.document_id));
        const newAttachments = docs.filter((d) => !existingIds.has(d.document_id));
        return {
          ...prev,
          attachments: [...prev.attachments, ...newAttachments],
        };
      });
    },
    [addTab, setActiveTab]
  );

  const handleRemoveAttachment = useCallback(
    (docId: string) => {
      removeTab(docId);
      setActiveSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          attachments: prev.attachments.filter((a) => a.document_id !== docId),
        };
      });
    },
    [removeTab]
  );

  const toggleArtifacts = useCallback(() => {
    if (!artifactSidebarOpen && workspace.activeTabs.length === 0 && attachedDocs.length > 0) {
      handleSelectDocument(attachedDocs[0]);
      return;
    }
    setArtifactSidebarOpen(!artifactSidebarOpen);
  }, [artifactSidebarOpen, workspace.activeTabs.length, attachedDocs, handleSelectDocument]);

  if (isAuthLoading || !isAuthenticated) {
    return (
      <BouncingDots
        fullScreen
        size="lg"
        label="Entering Draythos workspace…"
      />
    );
  }

  return (
    <div className="flex h-screen bg-canvas p-2.5 gap-2.5 overflow-hidden selection:bg-manilla selection:text-ink">
      {/* ── Left Sidebar (Rounded from all sides in both full and collapsed modes) ── */}
      {sidebarCollapsed ? (
        <aside className="w-14 h-full rounded-2xl border border-hairline bg-surface flex flex-col items-center py-3.5 justify-between shrink-0 select-none z-20 overflow-hidden shadow-xs">
          {/* Top Controls */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-2 rounded-xl text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
            <button
              onClick={handleNewSession}
              className="p-2 rounded-xl text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
              title="New chat"
              aria-label="New chat"
            >
              <Plus className="h-4 w-4 text-clay" />
            </button>
            <button
              onClick={() => setLibraryOpen(true)}
              className="p-2 rounded-xl text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
              title="Workspace Document Library"
              aria-label="Document Library"
            >
              <Folder className="h-4 w-4 text-clay" />
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4 text-clay" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setKeysOpen(true)}
              className="p-2 rounded-xl text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
              title="API Keys"
              aria-label="API Keys"
            >
              <Key className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-7 h-7 rounded-full bg-clay text-canvas flex items-center justify-center font-display font-medium text-xs shadow-xs hover:opacity-90 transition-opacity"
              title={user?.email || "Account"}
            >
              {user?.name?.[0]?.toUpperCase() || "A"}
            </button>
          </div>
        </aside>
      ) : (
        <aside className="w-72 h-full rounded-2xl border border-hairline bg-surface shadow-xs transition-all duration-200 shrink-0 z-20 overflow-hidden flex flex-col">
          <LiquidDock
            sessions={sessions}
            activeSessionId={currentSessionId || initialSessionId || null}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            isCollapsed={false}
            onToggleCollapse={() => setSidebarCollapsed(true)}
            user={user}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenKeys={() => setKeysOpen(true)}
            onOpenLibrary={() => setLibraryOpen(true)}
            onLogout={logout}
            isDark={isDark}
            onToggleTheme={toggleTheme}
          />
        </aside>
      )}

      {/* ── Main Workspace Area (Rounded from all sides) ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden">
        {/* Top Workspace Header Bar */}
        <header className="h-13 border-b border-hairline bg-surface/80 backdrop-blur-sm px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display font-medium text-sm text-ink truncate">
              {activeSession ? activeSession.title : "New conversation"}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Artifact Canvas Button */}
            <Button
              variant={artifactSidebarOpen ? "secondary" : "ghost"}
              size="sm"
              onClick={toggleArtifacts}
              className="font-display text-xs flex items-center gap-1.5"
              title={artifactSidebarOpen ? "Collapse Artifact Canvas" : "Open Artifact Canvas"}
            >
              <FileText className="h-3.5 w-3.5 text-clay" />
              <span>Artifacts</span>
              {workspace.activeTabs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-clay/15 text-clay text-[10px] font-mono">
                  {workspace.activeTabs.length}
                </span>
              )}
              {artifactSidebarOpen ? (
                <PanelRightClose className="h-3.5 w-3.5 text-cloud-dark ml-1" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5 text-cloud-dark ml-1" />
              )}
            </Button>
          </div>
        </header>

        {/* Content Body: Chat Pane & Optional Artifacts Pane */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {/* Chat Pane */}
          <section
            className={cn(
              "flex flex-col min-w-0 h-full transition-all duration-200",
              artifactSidebarOpen
                ? "w-full md:w-1/2 lg:w-[46%] border-r border-hairline"
                : "w-full max-w-4xl mx-auto"
            )}
          >
            {isLoadingSession ? (
              <div className="flex-1 flex items-center justify-center">
                <BouncingDots size="md" label="Loading conversation…" />
              </div>
            ) : (
              <ChatPane
                session={effectiveSession}
                attachments={attachedDocs}
                activeDocumentId={workspace.activeTabId || undefined}
                uploadProgress={uploadProgress}
                onUpload={handleUpload}
                onRetryUpload={handleUpload}
                onDismissUpload={dismissUploadProgress}
                onSendMessage={handleSendMessage}
                onSelectDocument={handleSelectDocument}
                onOpenLibrary={() => setLibraryOpen(true)}
                onRemoveAttachment={handleRemoveAttachment}
                user={user}
                selectedModel={selectedModel}
                preferredProvider={preferredProvider}
                onModelChange={(modelId) => updatePreferences({ selectedModel: modelId })}
                onRevertChanges={handleRevertChanges}
              />
            )}
          </section>

          {/* Artifacts Canvas (Toggleable Right Sidebar) */}
          {artifactSidebarOpen && (
            <section className="hidden md:flex flex-col flex-1 min-w-0 h-full bg-canvas animate-in fade-in duration-150">
              <ArtifactsPane
                tabs={workspace.activeTabs}
                activeTabId={workspace.activeTabId}
                onTabSelect={(id) => setActiveTab(id)}
                onTabClose={(id) => {
                  removeTab(id);
                  if (workspace.activeTabs.length <= 1) {
                    setArtifactSidebarOpen(false);
                  }
                }}
                onSave={handleSave}
                onDownload={handleDownload}
                getContent={getContent}
                availableDocuments={attachedDocs}
                onOpenDocument={handleSelectDocument}
              />
            </section>
          )}
        </div>
      </div>

      {/* Keys Dialog */}
      <KeysDialog
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        openRouterKey={openRouterKey}
        geminiKey={geminiKey}
        selectedModel={selectedModel}
        preferredProvider={preferredProvider}
        onSaveKeys={updateApiKeys}
        onSavePreferences={updatePreferences}
      />

      {/* Workspace Document Library Dialog */}
      <LibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        userId={user?.id || "usr_default"}
        sessionId={currentSessionId || activeSession?.id}
        onAttachToSession={handleAttachFromLibrary}
      />

      {/* Workspace Settings Dialog */}
      <AuthSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        customInstructions={customInstructions}
        memories={memories}
        onSavePreferences={updatePreferences}
        onAddMemory={addMemory}
        onDeleteMemory={deleteMemory}
        onLogout={logout}
      />
    </div>
  );
}

