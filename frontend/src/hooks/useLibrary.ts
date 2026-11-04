"use client";

import { useState, useCallback, useEffect } from "react";
import type { DocumentReference } from "@/types";

export interface LibraryFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface LibraryDocument {
  id: string;
  document_id: string;
  folder_id: string | null;
  folder_name: string;
  filename: string;
  format: string;
  size: number;
  created_at: string;
}

export function useLibrary(userId: string = "usr_default") {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  const fetchLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/library?user_id=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.warn("Failed to fetch library:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const createFolder = useCallback(
    async (name: string) => {
      try {
        const res = await fetch("/api/library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, name }),
        });
        if (res.ok) {
          await fetchLibrary();
        }
      } catch (err) {
        console.error("Create folder error:", err);
      }
    },
    [userId, fetchLibrary]
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      try {
        const res = await fetch(`/api/library/folders/${encodeURIComponent(folderId)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          await fetchLibrary();
        }
      } catch (err) {
        console.error("Delete folder error:", err);
      }
    },
    [fetchLibrary]
  );

  const uploadBulk = useCallback(
    async (files: File[], folderId?: string) => {
      if (files.length === 0) return;
      setIsUploading(true);
      setUploadProgress({ current: 0, total: files.length });

      const uploadedRefs: DocumentReference[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length });
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", "workspace_library");

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });
          if (res.ok) {
            const data = await res.json();
            uploadedRefs.push({
              document_id: data.document_id,
              session_id: "workspace_library",
              source_filename: data.source_filename || file.name,
              media_type: data.media_type || "application/octet-stream",
              processing_status: "completed",
              format: data.format || file.name.split(".").pop() || "unknown",
            });
          }
        } catch (err) {
          console.error(`Failed to upload ${file.name}:`, err);
        }
      }

      setIsUploading(false);
      setUploadProgress(null);
      await fetchLibrary();
      return uploadedRefs;
    },
    [fetchLibrary]
  );

  const attachToSession = useCallback(
    async (sessionId: string, documentIds: string[]): Promise<DocumentReference[]> => {
      try {
        const res = await fetch("/api/library/attach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, document_ids: documentIds }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.attached || [];
        }
      } catch (err) {
        console.error("Attach to session error:", err);
      }
      return [];
    },
    []
  );

  return {
    folders,
    documents,
    isLoading,
    isUploading,
    uploadProgress,
    createFolder,
    deleteFolder,
    uploadBulk,
    attachToSession,
    refreshLibrary: fetchLibrary,
  };
}

