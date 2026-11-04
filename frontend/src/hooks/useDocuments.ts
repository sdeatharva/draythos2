"use client";

import { useState, useCallback } from "react";
import type { DocumentReference, UploadProgress } from "@/types";

interface UseDocumentsReturn {
  documents: DocumentReference[];
  upload: (file: File, sessionId: string, userId?: string) => Promise<DocumentReference>;
  removeDocument: (documentId: string) => void;
  dismissUploadProgress: (file: File) => void;
  getContent: (documentId: string) => Promise<any>;
  downloadDocument: (documentId: string, filename: string) => Promise<void>;
  saveDocument: (documentId: string, edits: any, format: string) => Promise<any>;
  isUploading: boolean;
  uploadProgress: UploadProgress[];
}

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentReference[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);

  const dismissUploadProgress = useCallback((file: File) => {
    setUploadProgress((prev) => prev.filter((p) => p.file !== file));
  }, []);

  const upload = useCallback(
    async (fileInput: File, sessionId: string, userId?: string): Promise<DocumentReference> => {
      const file = Array.isArray(fileInput) ? (fileInput as any)[0] : fileInput;
      setIsUploading(true);

      const progress: UploadProgress = {
        file,
        progress: 15,
        status: "uploading",
        stage: "uploading",
      };
      setUploadProgress((prev) => [...prev.filter((p) => p.file !== file), progress]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", sessionId);
        if (userId) formData.append("userId", userId);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          const errorMsg = errData?.error || (await response.text().catch(() => "Upload failed"));
          throw new Error(errorMsg);
        }

        const data = await response.json();
        const docRef: DocumentReference = {
          document_id: data.document_id,
          session_id: data.session_id || sessionId,
          source_filename: data.source_filename || data.filename || file.name,
          media_type: data.media_type || "application/octet-stream",
          processing_status: data.processing_status || "completed",
          format: data.format || "unknown",
          created_at: data.created_at || new Date().toISOString(),
        };

        // If backend returned a job_id, track indexing status
        if (data.job_id) {
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.file === file
                ? { ...p, progress: 60, status: "processing" as const, stage: data.stage || "indexing", documentRef: docRef }
                : p
            )
          );

          // Poll job status until complete
          let attempts = 0;
          let jobDone = false;
          while (attempts < 15 && !jobDone) {
            await new Promise((r) => setTimeout(r, 600));
            attempts++;
            try {
              const jobRes = await fetch(`/api/upload/jobs/${encodeURIComponent(data.job_id)}`);
              if (jobRes.ok) {
                const jobData = await jobRes.json();
                if (jobData.status === "completed") {
                  jobDone = true;
                  setUploadProgress((prev) =>
                    prev.map((p) =>
                      p.file === file
                        ? { ...p, progress: 100, status: "completed" as const, stage: "ready", documentRef: docRef }
                        : p
                    )
                  );
                } else if (jobData.status === "failed") {
                  throw new Error(jobData.error_message || "Ingestion job failed");
                } else {
                  setUploadProgress((prev) =>
                    prev.map((p) =>
                      p.file === file
                        ? { ...p, progress: Math.min(85, 60 + attempts * 3), status: "processing" as const, stage: jobData.stage || "indexing" }
                        : p
                    )
                  );
                }
              }
            } catch (pollErr: any) {
              if (pollErr.message?.includes("failed")) throw pollErr;
            }
          }
        }

        setDocuments((prev) => [...prev, docRef]);
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.file === file
              ? { ...p, progress: 100, status: "completed" as const, stage: "ready", documentRef: docRef }
              : p
          )
        );

        return docRef;
      } catch (err: any) {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.file === file
              ? { ...p, status: "failed" as const, stage: "failed", error: err.message || "Upload failed" }
              : p
          )
        );
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const removeDocument = useCallback((documentId: string) => {
    setDocuments((prev) => prev.filter((d) => d.document_id !== documentId));
  }, []);

  const getContent = useCallback(async (documentId: string) => {
    const response = await fetch(`/api/documents/${documentId}/content`);
    if (!response.ok) throw new Error("Failed to fetch content");
    return response.json();
  }, []);

  const downloadDocument = useCallback(
    async (documentId: string, filename: string) => {
      const response = await fetch(
        `/api/documents/${documentId}/file?download=true`
      );
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    []
  );

  const saveDocument = useCallback(
    async (documentId: string, edits: any, format: string) => {
      const response = await fetch(`/api/documents/${documentId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits, format }),
      });
      if (!response.ok) throw new Error("Save failed");
      return response.json();
    },
    []
  );

  return {
    documents,
    upload,
    removeDocument,
    dismissUploadProgress,
    getContent,
    downloadDocument,
    saveDocument,
    isUploading,
    uploadProgress,
  };
}

