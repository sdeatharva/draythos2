import type { ChatSession, ChatMessage } from "@/types";
import { generateId } from "./utils";

const STORAGE_KEY = "draythos-chat-sessions";

function readStore(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getAllSessions(): ChatSession[] {
  return readStore().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getSession(id: string): ChatSession | null {
  return readStore().find((s) => s.id === id) ?? null;
}

export function createSession(): ChatSession {
  const session: ChatSession = {
    id: generateId(),
    title: "New chat",
    messages: [],
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const sessions = readStore();
  sessions.unshift(session);
  writeStore(sessions);
  return session;
}

export function deleteSession(id: string): void {
  writeStore(readStore().filter((s) => s.id !== id));
}

export function renameSession(id: string, title: string): void {
  const sessions = readStore();
  const session = sessions.find((s) => s.id === id);
  if (session) {
    session.title = title;
    session.updatedAt = new Date().toISOString();
    writeStore(sessions);
  }
}

export function addMessage(sessionId: string, message: ChatMessage): void {
  const sessions = readStore();
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    // Auto-title from first user message
    if (
      session.title === "New chat" &&
      message.role === "user" &&
      session.messages.filter((m) => m.role === "user").length === 1
    ) {
      session.title = generateTitle([message]);
    }
    writeStore(sessions);
  }
}

export function updateMessage(
  sessionId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): void {
  const sessions = readStore();
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    const msg = session.messages.find((m) => m.id === messageId);
    if (msg) {
      Object.assign(msg, updates);
      session.updatedAt = new Date().toISOString();
      writeStore(sessions);
    }
  }
}

export function addAttachment(sessionId: string, doc: any): void {
  const sessions = readStore();
  const session = sessions.find((s) => s.id === sessionId);
  if (session) {
    if (!session.attachments) session.attachments = [];
    if (!session.attachments.some((a: any) => (a.document_id || a.id) === (doc.document_id || doc.id))) {
      session.attachments.push(doc);
      session.updatedAt = new Date().toISOString();
      writeStore(sessions);
    }
  }
}

export function generateTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim();
  if (text.length <= 50) return text;
  return text.slice(0, 47) + "…";
}

export function exportSession(id: string): string {
  const session = getSession(id);
  if (!session) throw new Error(`Session ${id} not found`);
  return JSON.stringify(session, null, 2);
}

export function importSession(json: string): ChatSession {
  const session: ChatSession = JSON.parse(json);
  if (!session.id || !session.messages) {
    throw new Error("Invalid session format");
  }
  const sessions = readStore();
  // Ensure unique ID
  session.id = generateId();
  sessions.unshift(session);
  writeStore(sessions);
  return session;
}

