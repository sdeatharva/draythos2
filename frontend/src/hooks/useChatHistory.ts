"use client";

import { useState, useCallback, useEffect } from "react";
import type { ChatSession, ChatMessage } from "@/types";
import * as history from "@/lib/chatHistory";

interface UseChatHistoryReturn {
  sessions: ChatSession[];
  activeSession: ChatSession | null;
  createSession: () => ChatSession;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  switchSession: (id: string) => void;
  addMessage: (message: ChatMessage) => void;
  addAttachment: (sessionId: string, doc: any) => void;
  getSession: (id: string) => ChatSession | null;
}

export function useChatHistory(): UseChatHistoryReturn {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Load sessions on mount
  useEffect(() => {
    const loaded = history.getAllSessions();
    setSessions(loaded);
    if (loaded.length > 0) {
      setActiveSessionId(loaded[0].id);
    }
  }, []);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ?? null;

  const createSession = useCallback(() => {
    const session = history.createSession();
    setSessions(history.getAllSessions());
    setActiveSessionId(session.id);
    return session;
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      history.deleteSession(id);
      const updated = history.getAllSessions();
      setSessions(updated);
      if (activeSessionId === id) {
        setActiveSessionId(updated.length > 0 ? updated[0].id : null);
      }
    },
    [activeSessionId]
  );

  const renameSession = useCallback((id: string, title: string) => {
    history.renameSession(id, title);
    setSessions(history.getAllSessions());
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const addMessage = useCallback(
    (message: ChatMessage) => {
      if (!activeSessionId) return;
      history.addMessage(activeSessionId, message);
      setSessions(history.getAllSessions());
    },
    [activeSessionId]
  );

  const addAttachment = useCallback(
    (sessionId: string, doc: any) => {
      history.addAttachment(sessionId, doc);
      setSessions(history.getAllSessions());
    },
    []
  );

  const getSession = useCallback(
    (id: string) => history.getSession(id),
    []
  );

  return {
    sessions,
    activeSession,
    createSession,
    deleteSession,
    renameSession,
    switchSession,
    addMessage,
    addAttachment,
    getSession,
  };
}

