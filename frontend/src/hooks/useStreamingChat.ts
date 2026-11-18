"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, Citation, DocumentReference, StreamEventType, SelectionContext } from "@/types";
import { generateId } from "@/lib/utils";

export type StreamingState =
  | "idle"
  | "retrieving"
  | "generating"
  | "completed"
  | "failed"
  | "cancelled";

interface UseStreamingChatReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendMessage: (
    content: string,
    attachments?: DocumentReference[],
    activeDocumentId?: string,
    overrideSessionId?: string,
    selectionContext?: SelectionContext,
    contextScope?: "chat" | "folder" | "organization"
  ) => Promise<void>;
  stopStreaming: () => void;
  retryLast: () => void;
  isStreaming: boolean;
  streamingState: StreamingState;
  error: string | null;
}

export function useStreamingChat(sessionId: string): UseStreamingChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingState, setStreamingState] = useState<StreamingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestRef = useRef<{
    content: string;
    attachments?: DocumentReference[];
    activeDocumentId?: string;
    selectionContext?: SelectionContext;
    contextScope?: "chat" | "folder" | "organization";
  } | null>(null);

  // Failsafe: never leave UI stuck in generating state
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sendMessage = useCallback(
    async (
      content: string,
      attachments?: DocumentReference[],
      activeDocumentId?: string,
      overrideSessionId?: string,
      selectionContext?: SelectionContext,
      contextScope: "chat" | "folder" | "organization" = "chat"
    ) => {
      const activeSid = overrideSessionId || sessionId;
      // Save for retry
      lastRequestRef.current = { content, attachments, activeDocumentId, selectionContext, contextScope };

      // Create user message
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        attachments,
        status: "completed",
      };

      // Create placeholder assistant message
      const assistantId = generateId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        citations: [],
        status: "streaming",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreamingState("retrieving");
      setError(null);

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Failsafe timeout: 120 seconds max
      timeoutRef.current = setTimeout(() => {
        abortController.abort();
        setStreamingState("failed");
        setError("Request timed out");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, status: "failed" as const }
              : m
          )
        );
      }, 120000);

      try {
        const openRouterKey = typeof window !== "undefined" ? localStorage.getItem("draythos_openrouter_key") || undefined : undefined;
        const geminiKey = typeof window !== "undefined" ? localStorage.getItem("draythos_gemini_key") || undefined : undefined;
        const custom_instructions = typeof window !== "undefined" ? localStorage.getItem("draythos_custom_instructions") || undefined : undefined;
        const selected_model = typeof window !== "undefined" ? localStorage.getItem("draythos_selected_model") || undefined : undefined;
        const preferred_provider = typeof window !== "undefined" ? localStorage.getItem("draythos_preferred_provider") || undefined : undefined;
        const savedUser = typeof window !== "undefined" ? localStorage.getItem("draythos_auth_user") : null;
        const user_id = savedUser ? JSON.parse(savedUser).id : undefined;

        // Persist user message to SQLite session
        if (activeSid && activeSid !== "default" && activeSid !== "new") {
          fetch(`/api/sessions/${activeSid}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "user", content }),
          }).catch(() => {});
        }

        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            sessionId: activeSid,
            attachments: attachments ?? [],
            activeDocumentId,
            selectionContext,
            context_scope: contextScope,
            include_global: contextScope === "organization",
            history,
            openRouterKey,
            geminiKey,
            custom_instructions,
            selected_model,
            preferred_provider,
            user_id,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "Unknown error");
          throw new Error(`Chat failed (${response.status}): ${errText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        const allCitations: Citation[] = [];
        let receivedComplete = false;

        let currentEvent = "delta";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
              continue;
            }

            if (!line.startsWith("data: ")) continue;
            const rawData = line.slice(6).trim();
            if (!rawData) continue;

            let eventType = currentEvent;
            let payload: any = rawData;

            try {
              const parsed = JSON.parse(rawData);
              if (parsed && typeof parsed === "object" && parsed.type) {
                eventType = parsed.type;
                payload = parsed.data;
              } else {
                payload = parsed;
              }
            } catch {
              payload = rawData;
            }

            if (eventType === "status") {
              if (payload === "retrieving") setStreamingState("retrieving");
              else if (payload === "generating") setStreamingState("generating");
            } else if (eventType === "delta") {
              const textChunk = typeof payload === "string" ? payload : String(payload || "");
              fullContent += textChunk;
              setStreamingState("generating");
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullContent } : m
                )
              );
            } else if (eventType === "citation") {
              if (payload) {
                allCitations.push(payload);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, citations: [...allCitations] }
                      : m
                  )
                );
              }
            } else if (eventType === "complete") {
              receivedComplete = true;
              setStreamingState("completed");
              if (typeof window !== "undefined" && payload && (payload.workingCopyVersion || payload.documentId)) {
                window.dispatchEvent(
                  new CustomEvent("draythos:document-updated", {
                    detail: {
                      documentId: payload.documentId,
                      version: payload.workingCopyVersion,
                    },
                  })
                );
              }
              if (activeSid && activeSid !== "default" && activeSid !== "new") {
                fetch(`/api/sessions/${activeSid}/messages`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    role: "assistant",
                    content: fullContent,
                    citations: allCitations,
                  }),
                }).catch(() => {});
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        status: "completed" as const,
                        content: fullContent,
                        citations: allCitations,
                      }
                    : m
                )
              );
            } else if (eventType === "error") {
              throw new Error(
                typeof payload === "string" ? payload : payload?.message || "Stream error"
              );
            } else if (eventType === "cancelled") {
              receivedComplete = true;
              setStreamingState("cancelled");
              setMessages((prev) => prev.map((m) =>
                m.id === assistantId ? { ...m, status: "cancelled" as const } : m
              ));
            }
          }
        }

        // If we get here without a complete event, mark as completed
        if (!receivedComplete) {
          setStreamingState("completed");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, status: "completed" as const }
                : m
            )
          );
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          setStreamingState("cancelled");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, status: "cancelled" as const }
                : m
            )
          );
        } else {
          setStreamingState("failed");
          setError(err.message ?? "Unknown error");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, status: "failed" as const, content: m.content || err.message }
                : m
            )
          );
        }
      } finally {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        abortRef.current = null;
      }
    },
    [sessionId, messages, streamingState]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retryLast = useCallback(() => {
    if (!lastRequestRef.current) return;
    // Remove the last assistant (failed) message
    setMessages((prev) => {
      const newMsgs = [...prev];
      while (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === "assistant") {
        newMsgs.pop();
      }
      // Also remove the user message we're retrying
      if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === "user") {
        newMsgs.pop();
      }
      return newMsgs;
    });
    const { content, attachments, activeDocumentId, selectionContext, contextScope } = lastRequestRef.current;
    sendMessage(content, attachments, activeDocumentId, undefined, selectionContext, contextScope);
  }, [sendMessage]);

  return {
    messages,
    setMessages,
    sendMessage,
    stopStreaming,
    retryLast,
    isStreaming: streamingState === "retrieving" || streamingState === "generating",
    streamingState,
    error,
  };
}

