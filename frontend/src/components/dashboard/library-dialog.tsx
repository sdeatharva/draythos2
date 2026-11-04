"use client";

import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLibrary, type LibraryFolder, type LibraryDocument } from "@/hooks/useLibrary";
import type { DocumentReference } from "@/types";
import {
  Folder,
  FolderPlus,
  FileText,
  Upload,
  Check,
  Trash2,
  X,
  Search,
  Plus,
  Loader2,
  CheckSquare,
  Square,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LibraryDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  sessionId?: string;
  onAttachToSession?: (docs: DocumentReference[]) => void;
}

export function LibraryDialog({
  open,
  onClose,
  userId = "usr_default",
  sessionId,
  onAttachToSession,
}: LibraryDialogProps) {
  const {
    folders,
    documents,
    isLoading,
    isUploading,
    uploadProgress,
    createFolder,
    deleteFolder,
    uploadBulk,
    attachToSession,
    refreshLibrary,
  } = useLibrary(userId);

  const [selectedFolderId, setSelectedFolderId] = useState<string | "all">("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesFolder =
        selectedFolderId === "all" ||
        (selectedFolderId === "root" && !doc.folder_id) ||
        doc.folder_id === selectedFolderId;
      const matchesSearch =
        !searchQuery || doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFolder && matchesSearch;
    });
  }, [documents, selectedFolderId, searchQuery]);

  if (!open) return null;

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocIds.size === filteredDocs.length && filteredDocs.length > 0) {
      setSelectedDocIds(new Set());
    } else {
      setSelectedDocIds(new Set(filteredDocs.map((d) => d.document_id)));
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).slice(0, 30);
      const targetFolder = selectedFolderId !== "all" ? selectedFolderId : undefined;
      await uploadBulk(files, targetFolder);
      e.target.value = "";
    }
  };

  const handleAttach = async () => {
    if (!sessionId || selectedDocIds.size === 0) return;
    const docIds = Array.from(selectedDocIds);
    const attached = await attachToSession(sessionId, docIds);
    if (onAttachToSession) {
      onAttachToSession(attached);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl h-[640px] bg-surface rounded-2xl border border-hairline shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between bg-canvas/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-clay/10 text-clay border border-clay/20">
              <Folder className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-base text-ink">
                Workspace Document Library
              </h2>
              <p className="font-reading text-xs text-cloud-dark">
                Organize folders and reference files across any conversation without re-uploading.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-cloud-dark hover:text-ink hover:bg-oat transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Sidebar: Folders */}
          <div className="w-64 border-r border-hairline bg-canvas/30 flex flex-col p-3 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cloud-dark font-semibold">
                Folders
              </span>
              <button
                onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                className="text-xs font-display text-clay hover:underline flex items-center gap-1"
                title="Create Folder"
              >
                <Plus className="h-3 w-3" /> New
              </button>
            </div>

            {/* Folder creation form */}
            {isCreatingFolder && (
              <form onSubmit={handleCreateFolder} className="mb-2 flex gap-1">
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="h-7 text-xs"
                  autoFocus
                />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs">
                  Add
                </Button>
              </form>
            )}

            {/* Folder Items */}
            <div className="flex-1 overflow-y-auto space-y-1">
              <button
                onClick={() => setSelectedFolderId("all")}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-display transition-colors text-left",
                  selectedFolderId === "all"
                    ? "bg-clay/15 text-clay-deep font-semibold"
                    : "text-ink-soft hover:bg-oat"
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">All Documents</span>
                </div>
                <span className="text-[10px] font-mono text-cloud-dark">
                  {documents.length}
                </span>
              </button>

              {folders.map((f) => {
                const count = documents.filter((d) => d.folder_id === f.id).length;
                return (
                  <div key={f.id} className="group flex items-center justify-between">
                    <button
                      onClick={() => setSelectedFolderId(f.id)}
                      className={cn(
                        "flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-display transition-colors text-left truncate mr-1",
                        selectedFolderId === f.id
                          ? "bg-clay/15 text-clay-deep font-semibold"
                          : "text-ink-soft hover:bg-oat"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="h-3.5 w-3.5 shrink-0 text-clay" />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-cloud-dark">{count}</span>
                    </button>
                    <button
                      onClick={() => deleteFolder(f.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-cloud-dark hover:text-clay-deep rounded transition-opacity"
                      title="Delete Folder"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Main Pane: Files & Bulk Upload */}
          <div className="flex-1 flex flex-col min-w-0 bg-surface">
            {/* Action Bar */}
            <div className="p-3 border-b border-hairline flex items-center justify-between gap-3 bg-canvas/10 shrink-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cloud-dark" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.txt"
                  onChange={handleBulkUpload}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-8 text-xs font-display flex items-center gap-1.5"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-clay" />
                      <span>
                        {uploadProgress
                          ? `Uploading (${uploadProgress.current}/${uploadProgress.total})…`
                          : "Uploading…"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5 text-clay" />
                      <span>Upload Files (up to 30)</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredDocs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-cloud-dark">
                  <FileText className="h-10 w-10 mb-2 opacity-30" />
                  <p className="font-display text-sm font-medium text-ink mb-1">
                    No documents found
                  </p>
                  <p className="font-reading text-xs max-w-xs">
                    Upload spreadsheets, PDFs, or Word documents to store them in your workspace library.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono text-cloud-dark border-b border-hairline/60">
                    <button
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 hover:text-ink transition-colors font-medium"
                    >
                      {selectedDocIds.size === filteredDocs.length && filteredDocs.length > 0 ? (
                        <CheckSquare className="h-3.5 w-3.5 text-clay" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                      <span>Select All ({filteredDocs.length})</span>
                    </button>
                    <span>Format / Size</span>
                  </div>

                  {filteredDocs.map((doc) => {
                    const isSelected = selectedDocIds.has(doc.document_id);
                    const isSpreadsheet = ["xlsx", "xls", "csv"].includes(doc.format.toLowerCase());

                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleSelectDoc(doc.document_id)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl border border-hairline/60 cursor-pointer transition-colors",
                          isSelected
                            ? "bg-clay/10 border-clay/30"
                            : "bg-surface hover:bg-oat/50"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            className="text-cloud-dark hover:text-ink transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-clay" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <div className="p-1.5 rounded-lg bg-oat/60 text-clay shrink-0">
                            {isSpreadsheet ? (
                              <FileSpreadsheet className="h-4 w-4" />
                            ) : (
                              <FileText className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-xs font-medium text-ink truncate">
                              {doc.filename}
                            </p>
                            <p className="font-mono text-[10px] text-cloud-dark">
                              {doc.folder_name} • {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-oat text-ink-soft border border-hairline">
                            {doc.format}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-hairline bg-canvas/40 flex items-center justify-between shrink-0">
          <span className="text-xs font-reading text-cloud-dark">
            {selectedDocIds.size} of {filteredDocs.length} document{filteredDocs.length === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            {sessionId && (
              <Button
                size="sm"
                onClick={handleAttach}
                disabled={selectedDocIds.size === 0}
                className="text-xs font-display flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Attach to Current Chat ({selectedDocIds.size})</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
