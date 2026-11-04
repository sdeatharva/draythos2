"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { ChatSession, ChatMessage, DocumentReference, AuthUser, SelectionContext, UploadProgress } from "@/types";
import { useStreamingChat } from "@/hooks/useStreamingChat";
import { StreamingChatMessage } from "./streaming-chat-message";
import { UploadZone } from "./upload-zone";
import { FREE_GEMINI_MODELS, FREE_OPENROUTER_MODELS, HIGH_VOCAB_GREETINGS } from "@/lib/constants";
import {
  Send,
  Paperclip,
  Square,
  Upload,
  X,
  Plus,
  ChevronDown,
  ArrowUp,
  Check,
  Folder,
  CheckSquare,
  Edit3,
  Loader2,
  AlertCircle,
  RotateCw,
} from "lucide-react";

interface ChatPaneProps {
  session: ChatSession | null;
  attachments: DocumentReference[];
  activeDocumentId?: string;
  uploadProgress?: UploadProgress[];
  onUpload: (file: File) => Promise<void>;
  onRetryUpload?: (file: File) => void;
  onDismissUpload?: (file: File) => void;
  onSendMessage?: (content: string) => Promise<string | void>;
  onSelectDocument?: (doc: DocumentReference) => void;
  onOpenLibrary?: () => void;
  onRemoveAttachment?: (docId: string) => void;
  user?: AuthUser | null;
  selectedModel?: string;
  preferredProvider?: string;
  onModelChange?: (modelId: string) => void;
}

export function ChatPane({
  session,
  attachments,
  activeDocumentId,
  uploadProgress = [],
  onUpload,
  onRetryUpload,
  onDismissUpload,
  onSendMessage,
  onSelectDocument,
  onOpenLibrary,
  onRemoveAttachment,
  user,
  selectedModel: propSelectedModel,
  preferredProvider: propPreferredProvider,
  onModelChange,
}: ChatPaneProps) {
  const [inputValue, setInputValue] = useState("");
  const [showUploadZone, setShowUploadZone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Selected files for context referencing (checkboxes)
  const [selectedForContext, setSelectedForContext] = useState<Set<string>>(new Set());
  // Designated target file for document modifications / prompt editing
  const [targetEditDocId, setTargetEditDocId] = useState<string | null>(activeDocumentId || null);

  // Keep selectedForContext and targetEditDocId in sync as attachments change
  useEffect(() => {
    setSelectedForContext((prev) => {
      const next = new Set(prev);
      attachments.forEach((a) => {
        if (!next.has(a.document_id)) next.add(a.document_id);
      });
      return next;
    });

    if (!targetEditDocId && attachments.length > 0) {
      setTargetEditDocId(activeDocumentId || attachments[0].document_id);
    }
  }, [attachments, activeDocumentId, targetEditDocId]);

  useEffect(() => {
    if (activeDocumentId) {
      setTargetEditDocId(activeDocumentId);
    }
  }, [activeDocumentId]);

  // Enriched Active Selection Context Protocol
  const [selectionContext, setSelectionContext] = useState<SelectionContext | null>(null);

  useEffect(() => {
    const handleSelection = (e: any) => {
      if (e.detail) {
        setSelectionContext(e.detail);
      }
    };
    window.addEventListener("draythos:selection-changed", handleSelection);
    return () => window.removeEventListener("draythos:selection-changed", handleSelection);
  }, []);

  const toggleContextRef = (docId: string) => {
    setSelectedForContext((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const [activeModel, setActiveModel] = useState<string>(
    propSelectedModel ||
      (typeof window !== "undefined"
        ? localStorage.getItem("draythos_selected_model") || "gemini-3.8-flash"
        : "gemini-3.8-flash")
  );

  const activeProvider =
    propPreferredProvider ||
    (typeof window !== "undefined"
      ? localStorage.getItem("draythos_preferred_provider") || "gemini"
      : "gemini");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    setMessages,
    sendMessage,
    stopStreaming,
    retryLast,
    isStreaming,
    streamingState,
  } = useStreamingChat(session?.id ?? "default");

  // Sync prop changes to local model state
  useEffect(() => {
    if (propSelectedModel) {
      setActiveModel(propSelectedModel);
    }
  }, [propSelectedModel]);

  // Close model dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    if (modelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [modelDropdownOpen]);

  const loadedSessionIdRef = useRef<string | null>(session?.id || null);

  // Load session messages without obliterating active streaming or locally sent messages
  useEffect(() => {
    if (session?.id !== loadedSessionIdRef.current) {
      loadedSessionIdRef.current = session?.id || null;
      setMessages(session?.messages || []);
    } else if (session?.messages && session.messages.length > 0) {
      setMessages((prev) => {
        // If current local messages are empty, hydrate from session
        if (prev.length === 0) return session.messages;
        // If session from server has more messages (e.g. after refresh), use server messages
        if (session.messages.length > prev.length) return session.messages;
        return prev;
      });
    }
  }, [session?.id, session?.messages, setMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 180) + "px";
    }
  }, [inputValue]);

  // Close attach menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    }
    if (attachMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachMenuOpen]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isStreaming) return;
    const text = inputValue.trim();
    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let createdId: string | void = undefined;
    if (onSendMessage) {
      createdId = await onSendMessage(text);
    }

    const contextAttachments = attachments.filter((a) => selectedForContext.has(a.document_id));
    const effectiveTargetDocId =
      targetEditDocId || activeDocumentId || (attachments.length > 0 ? attachments[0].document_id : undefined);

    const activeSel = selectionContext;
    setSelectionContext(null);
    sendMessage(text, contextAttachments, effectiveTargetDocId, createdId || undefined, activeSel || undefined);
  }, [
    inputValue,
    isStreaming,
    onSendMessage,
    sendMessage,
    attachments,
    selectedForContext,
    targetEditDocId,
    activeDocumentId,
    selectionContext,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      files.forEach((f) => onUpload(f));
    },
    [onUpload]
  );

  const handleSelectModel = (modelId: string) => {
    setActiveModel(modelId);
    if (typeof window !== "undefined") {
      localStorage.setItem("draythos_selected_model", modelId);
    }
    if (onModelChange) {
      onModelChange(modelId);
    }
    setModelDropdownOpen(false);
  };

  // High-vocabulary literary greeting (randomized from 25 curated terms on load/session switch)
  const [greetingWord, setGreetingWord] = useState<string>("Salutations");

  useEffect(() => {
    const chosen = HIGH_VOCAB_GREETINGS[Math.floor(Math.random() * HIGH_VOCAB_GREETINGS.length)];
    setGreetingWord(chosen);
  }, [session?.id]);

  const firstName = user?.name?.split(" ")[0] || "there";

  const availableModels =
    activeProvider === "openrouter" ? FREE_OPENROUTER_MODELS : FREE_GEMINI_MODELS;

  const currentModelObj = availableModels.find((m) => m.id === activeModel);
  const modelDisplayName = currentModelObj
    ? currentModelObj.name
    : activeModel.replace(":free", "");

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 bg-canvas/80 border-2 border-dashed border-clay rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-8 w-8 text-clay mx-auto mb-2" />
            <p className="font-display font-medium text-ink">Drop files here</p>
          </div>
        </div>
      )}

      {/* Hidden Native File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.xlsx,.xls,.csv,.docx,.txt"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
            e.target.value = "";
          }
        }}
      />

      {/* ── Main Chat Area ── */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-3xl mx-auto w-full">
          {/* High-Vocabulary Literary Greeting */}
          <div className="flex flex-col items-center justify-center text-center select-none animate-in fade-in duration-300">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-medium text-ink tracking-tight">
              {greetingWord}, {firstName}
            </h2>
          </div>
        </div>
      ) : (
        /* Conversation Thread */
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {messages.map((msg) => (
            <StreamingChatMessage
              key={msg.id}
              message={msg}
              isStreaming={msg.status === "streaming" && isStreaming}
              onRetry={msg.status === "failed" ? retryLast : undefined}
              onCitationClick={(citation) => {
                const targetDoc = attachments.find(
                  (a) =>
                    a.document_id === citation.document_id ||
                    a.source_filename === (citation.source || citation.source_filename)
                );
                if (targetDoc && onSelectDocument) {
                  onSelectDocument(targetDoc);
                } else if (citation.document_id && onSelectDocument) {
                  const filename = citation.source || citation.source_filename || "Document";
                  const ext = filename.split(".").pop() || "pdf";
                  onSelectDocument({
                    document_id: citation.document_id,
                    source_filename: filename,
                    format: ext as any,
                    processing_status: "completed",
                    session_id: session?.id || "default",
                    media_type: `application/${ext}`,
                  });
                }
              }}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Upload Dropzone (if toggled) */}
      {showUploadZone && (
        <div className="px-4 pb-2">
          <div className="relative">
            <button
              onClick={() => setShowUploadZone(false)}
              className="absolute -top-2 -right-2 z-10 p-1 bg-surface rounded-full border border-hairline shadow-sm hover:bg-oat transition-colors"
              aria-label="Close upload zone"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <UploadZone onUpload={onUpload} />
          </div>
        </div>
      )}

      {/* ── Bottom Section: Prompt Bar ── */}
      <div className="p-4 bg-surface border-t border-hairline/60">
        <div className="max-w-4xl mx-auto">
          {/* Unified Prompt Container: Seamless Generating Banner + Composer */}
          <div className="relative shadow-xs transition-all">
            {/* Generating response line seamlessly mounted on top */}
            {isStreaming && (
              <div className="rounded-t-2xl border-t border-x border-b border-hairline/80 bg-surface/90 dark:bg-oat/25 backdrop-blur-xs px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-clay animate-pulse shrink-0" />
                  <span className="text-xs font-display text-ink font-medium tracking-tight">
                    {streamingState === "retrieving"
                      ? "Retrieving relevant documents…"
                      : "Generating response…"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-display text-cloud-dark hover:text-ink hover:bg-surface border border-hairline/60 transition-colors shadow-2xs"
                  title="Stop generation"
                >
                  <Square className="h-2.5 w-2.5 fill-current text-clay" />
                  <span>Stop</span>
                </button>
              </div>
            )}

            {/* Prompt Composer Box */}
            <div
              className={cn(
                "relative bg-surface p-3 transition-all focus-within:border-clay/60 focus-within:ring-2 focus-within:ring-clay/15",
                isStreaming
                  ? "rounded-b-2xl border-x border-b border-hairline/80 border-t-0"
                  : "rounded-2xl border border-hairline/80"
              )}
            >
            {/* Active Document Uploads & Indexing Progress / Explicit Failure */}
            {uploadProgress && uploadProgress.length > 0 && (
              <div className="mb-2.5 flex flex-col gap-1.5 pb-2 border-b border-hairline/60">
                <div className="flex items-center justify-between text-[11px] font-mono text-cloud-dark px-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Loader2 className="h-3 w-3 text-clay animate-spin" /> Ingestion & Processing ({uploadProgress.length})
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {uploadProgress.map((p, idx) => {
                    const isFailed = p.status === "failed";
                    const isCompleted = p.status === "completed";
                    const stageLabel =
                      p.stage === "parsing"
                        ? "Parsing document layout..."
                        : p.stage === "extracting"
                        ? "Extracting tabular & vector text..."
                        : p.stage === "indexing"
                        ? "Indexing dense & BM25 chunks..."
                        : p.stage === "concepts"
                        ? "Mapping canonical concepts..."
                        : p.stage === "ready" || isCompleted
                        ? "Indexed & Ready"
                        : `Uploading (${p.progress}%)...`;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-display border transition-all",
                          isFailed
                            ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                            : isCompleted
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                            : "bg-clay/5 border-clay/30 text-ink"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isFailed ? (
                            <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                          ) : isCompleted ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Loader2 className="h-3.5 w-3.5 text-clay animate-spin shrink-0" />
                          )}
                          <span className="font-medium truncate max-w-[160px] md:max-w-[240px]">
                            {p.file.name}
                          </span>
                          <span className="text-[10px] text-cloud-dark hidden sm:inline">
                            ({(p.file.size / 1024).toFixed(0)} KB)
                          </span>
                          <span className="text-[11px] font-mono text-ink-soft">
                            · {stageLabel}
                          </span>
                          {isFailed && p.error && (
                            <span className="text-[10px] text-red-600 italic truncate max-w-[200px]">
                              — {p.error}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {isFailed && onRetryUpload && (
                            <button
                              type="button"
                              onClick={() => onRetryUpload(p.file)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-canvas text-[11px] font-medium transition-colors"
                              title="Retry upload"
                            >
                              <RotateCw className="h-3 w-3" />
                              <span>Retry</span>
                            </button>
                          )}
                          {onDismissUpload && (
                            <button
                              type="button"
                              onClick={() => onDismissUpload(p.file)}
                              className="p-1 hover:bg-oat rounded text-cloud-dark hover:text-ink transition-colors"
                              title="Dismiss"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Interactive Document Selection: Context Reference & Edit Target */}
            {attachments.length > 0 && (
              <div className="mb-2.5 flex flex-col gap-1.5 pb-2 border-b border-hairline/60">
                <div className="flex items-center justify-between text-[11px] font-mono text-cloud-dark px-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Paperclip className="h-3 w-3 text-clay" /> Active Documents ({attachments.length})
                  </span>
                  <span className="text-[10px] hidden sm:inline text-cloud-dark">
                    [✓] Include in query • [✏️ Target] File to edit
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {attachments.map((doc) => {
                    const isReferenced = selectedForContext.has(doc.document_id);
                    const isEditTarget = targetEditDocId === doc.document_id;

                    return (
                      <div
                        key={doc.document_id}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-display border transition-all shadow-2xs",
                          isEditTarget
                            ? "bg-clay/10 border-clay/40 text-clay-deep ring-1 ring-clay/20 font-medium"
                            : isReferenced
                            ? "bg-oat/70 border-hairline text-ink"
                            : "bg-surface border-hairline/40 text-cloud-dark opacity-60"
                        )}
                      >
                        {/* Context Checkbox */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleContextRef(doc.document_id);
                          }}
                          className="hover:text-clay transition-colors"
                          title={isReferenced ? "Referenced in query (click to omit)" : "Excluded from query (click to reference)"}
                        >
                          {isReferenced ? (
                            <CheckSquare className="h-3.5 w-3.5 text-clay" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-cloud-dark" />
                          )}
                        </button>

                        {/* Document Name */}
                        <button
                          type="button"
                          onClick={() => onSelectDocument?.(doc)}
                          className="truncate max-w-[130px] md:max-w-[170px] hover:underline cursor-pointer"
                          title={`Open ${doc.source_filename} in Artifact Canvas`}
                        >
                          {doc.source_filename}
                        </button>

                        <span className="text-[9px] uppercase font-mono px-1 rounded bg-surface/80 text-ink-soft border border-hairline/50">
                          {doc.format}
                        </span>

                        {/* Edit Target Badge Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetEditDocId(doc.document_id);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-0.5 transition-colors",
                            isEditTarget
                              ? "bg-clay text-canvas font-semibold shadow-2xs"
                              : "hover:bg-oat text-cloud-dark hover:text-ink border border-hairline/60"
                          )}
                          title={isEditTarget ? "Active Edit Target: Prompts will edit this file" : "Click to designate as Edit Target"}
                        >
                          <Edit3 className="h-2.5 w-2.5" />
                          <span>{isEditTarget ? "Target" : "Set Target"}</span>
                        </button>

                        {/* Remove Attachment */}
                        {onRemoveAttachment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveAttachment(doc.document_id);
                            }}
                            className="hover:text-clay text-cloud-dark p-0.5 rounded transition-colors"
                            title="Remove attachment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Selection Context Chip */}
            {selectionContext && (
              <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-xl bg-clay/10 border border-clay/30 text-xs font-reading text-clay-deep shadow-2xs">
                <span className="font-semibold shrink-0 font-display text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-clay text-canvas">
                  Selection Focus
                </span>
                <span className="truncate flex-1">
                  <strong>{selectionContext.sourceFilename}</strong>
                  {selectionContext.cellRef ? ` [${selectionContext.cellRef}]` : ""}
                  {selectionContext.pageNumber ? ` (p. ${selectionContext.pageNumber})` : ""}
                  {selectionContext.sectionHeading ? ` · ${selectionContext.sectionHeading}: ` : ": "}
                  &ldquo;{selectionContext.selectedText.slice(0, 75)}{selectionContext.selectedText.length > 75 ? "…" : ""}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={() => setSelectionContext(null)}
                  className="hover:text-clay text-cloud-dark p-0.5 rounded transition-colors shrink-0"
                  title="Clear focused selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              rows={1}
              className="w-full resize-none bg-transparent border-0 p-1 text-sm text-ink font-reading placeholder:text-cloud-dark focus:outline-none focus:ring-0 max-h-48 leading-relaxed"
              disabled={isStreaming}
            />

            {/* Bottom Row Controls */}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-hairline/40">
              {/* Left: Attachment Menu (+ Popover) */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen(!attachMenuOpen)}
                  className="w-7 h-7 rounded-lg border border-hairline/70 flex items-center justify-center text-cloud-dark hover:text-ink hover:bg-oat/70 transition-colors"
                  title="Add files from device or library"
                >
                  <Plus className="h-4 w-4" />
                </button>

                {attachMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-1 z-50 bg-surface border border-hairline rounded-xl shadow-xl py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setAttachMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs font-display text-ink-soft hover:bg-oat hover:text-ink transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5 text-clay" />
                      <span>Upload from Device</span>
                    </button>
                    {onOpenLibrary && (
                      <button
                        type="button"
                        onClick={() => {
                          setAttachMenuOpen(false);
                          onOpenLibrary();
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-xs font-display text-ink-soft hover:bg-oat hover:text-ink transition-colors border-t border-hairline/40"
                      >
                        <Folder className="h-3.5 w-3.5 text-clay" />
                        <span>Browse Workspace Library</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right: Model Selection Dropdown + Send/Stop Button */}
              <div className="flex items-center gap-2">
                {/* Direct Model Chooser Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-oat/70 text-xs font-display text-cloud-dark hover:text-ink transition-colors"
                    title="Select model"
                  >
                    <span className="truncate max-w-[160px] md:max-w-[200px]">
                      {modelDisplayName}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  </button>

                  {/* Dropdown Menu listing all available models directly */}
                  {modelDropdownOpen && (
                    <div className="absolute right-0 bottom-full mb-1 z-50 bg-surface border border-hairline rounded-xl shadow-xl py-1 min-w-[240px] max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 border-b border-hairline/60 text-[10px] font-display font-medium text-cloud-dark uppercase tracking-wider">
                        {activeProvider === "openrouter" ? "OpenRouter Models" : "Google Gemini Models"}
                      </div>

                      {availableModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectModel(m.id)}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2 text-left text-xs font-display transition-colors",
                            m.id === activeModel
                              ? "bg-oat text-ink font-semibold"
                              : "text-ink-soft hover:bg-oat/60 hover:text-ink"
                          )}
                        >
                          <span className="truncate mr-2">{m.name}</span>
                          {m.id === activeModel && (
                            <Check className="h-3.5 w-3.5 text-clay shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send / Stop button */}
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stopStreaming}
                    className="w-8 h-8 rounded-full bg-oat hover:bg-hairline text-ink flex items-center justify-center transition-colors"
                    title="Stop generating"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="w-8 h-8 rounded-full bg-clay text-canvas hover:bg-clay-deep disabled:opacity-30 disabled:hover:bg-clay flex items-center justify-center transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                    title="Send message (Enter)"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
