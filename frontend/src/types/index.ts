/**
 * Draythos Eyrie — Unified TypeScript type definitions.
 * Mapped to the Draythos Product Specification and Design Tokens.
 */

// ─── Document Formats & States ────────────────────────────────────────────────

export type DocumentFormat =
  | 'pdf'
  | 'xlsx'
  | 'xls'
  | 'csv'
  | 'docx'
  | 'txt'
  | 'json'
  | 'xml'
  | 'image'
  | 'unknown';

export type ProcessingStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled';

export type DocumentTabState =
  | 'queued'
  | 'processing'
  | 'ready'
  | 'unsupported'
  | 'failed'
  | 'edited';

export interface DocumentReference {
  document_id: string;
  session_id: string;
  media_type: string;
  source_filename: string;
  original_path?: string;
  working_copy_path?: string;
  processing_status: ProcessingStatus;
  format: DocumentFormat;
  created_at?: string;
  updated_at?: string;
  file_hash?: string;
  size?: number;
  // Compatibility aliases
  id?: string;
  filename?: string;
}

export interface DocumentTab {
  id: string;
  documentRef: DocumentReference;
  state: DocumentTabState;
  isActive: boolean;
  hasUnsavedChanges: boolean;
  label: string;
}

export interface DocumentContent {
  document_id: string;
  filename: string;
  format: DocumentFormat;
  text: string;
  pages?: { page_number: number; text: string; confidence?: number }[];
  metadata?: Record<string, unknown>;
  total_pages?: number;
}

export interface DocumentStats {
  totalDocuments: number;
  totalChunks: number;
  indexSize: number;
  lastUpdated: number;
}

// ─── Citations & Grounding ───────────────────────────────────────────────────

export interface Citation {
  document_id: string;
  source_filename: string;
  page_number?: number;
  sheet_name?: string;
  section?: string;
  text_excerpt: string;
  score?: number;
  // Compatibility aliases
  documentId?: string;
  documentTitle?: string;
  pageNumber?: number;
  chunkIndex?: number;
  text?: string;
  id?: number | string;
  source?: string;
  excerpt?: string;
}

// ─── Chat & Sessions ─────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'system';

export type MessageStatus =
  | 'sending'
  | 'streaming'
  | 'completed'
  | 'complete'
  | 'failed'
  | 'error'
  | 'cancelled'
  | 'pending';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string | number | Date;
  attachments?: DocumentReference[];
  citations?: Citation[];
  status?: MessageStatus;
  errorMessage?: string;
  provider?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  attachments: DocumentReference[];
  createdAt: string | number;
  updatedAt: string | number;
}

export interface SelectionContext {
  documentId: string;
  sourceFilename: string;
  selectedText: string;
  sectionHeading?: string;
  pageNumber?: number;
  cellRef?: string;
  sheetName?: string;
}

export interface ChatRequest {
  message: string;
  sessionId: string;
  attachments?: DocumentReference[];
  activeDocumentId?: string;
  selectionContext?: SelectionContext;
  history?: { role: string; content: string }[];
  include_global?: boolean;
  user_id?: string;
  openRouterKey?: string;
  geminiKey?: string;
  custom_instructions?: string;
  selected_model?: string;
  preferred_provider?: string;
}

export interface ChatResponse {
  message: string;
  citations: Citation[];
  provider: string;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  sessionId?: string;
  documentIds?: string[];
  topK?: number;
  includeGlobal?: boolean;
}

export interface SearchResult {
  document_id: string;
  chunk_id: string;
  text: string;
  score: number;
  page_number?: number;
  sheet_name?: string;
  section?: string;
  source_filename: string;
  matched_terms?: string[];
  // Compatibility
  documentId?: string;
  documentTitle?: string;
  chunkIndex?: number;
  pageNumber?: number;
}

// ─── Streaming Events ────────────────────────────────────────────────────────

export type StreamEventType =
  | 'status'
  | 'delta'
  | 'citation'
  | 'complete'
  | 'cancelled'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: any;
  citations?: Citation[];
  error?: string;
  finish_reason?: string;
}

// ─── Edits & Working Copies ──────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  token?: string;
  apiKey?: string;
  email_verified?: boolean;
  custom_instructions?: string;
  selected_model?: string;
  preferred_provider?: string;
}

export interface UserMemory {
  id: string;
  user_id: string;
  fact: string;
  category?: string;
  created_at?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  apiKey: string | null;
}

export interface CellEdit {
  sheet_name: string;
  cell_ref: string;
  old_value: any;
  new_value: any;
  value_type: string;
}

export interface EditResult {
  success: boolean;
  edits_applied: CellEdit[];
  version: string;
  errors: string[];
}

export interface DocxEdit {
  section_index?: number;
  paragraph_index?: number;
  old_text: string;
  new_text: string;
}

// ─── Upload & Progress ───────────────────────────────────────────────────────

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  stage?: 'queued' | 'parsing' | 'extracting' | 'indexing' | 'concepts' | 'ready' | 'failed' | string;
  error?: string;
  documentRef?: DocumentReference;
}

// ─── Workspace State ─────────────────────────────────────────────────────────

export type ViewMode = 'split' | 'chat' | 'artifacts';

export interface WorkspaceState {
  activeSession: ChatSession | null;
  activeTabs: DocumentTab[];
  activeTabId: string | null;
  sidebarOpen: boolean;
  viewMode: ViewMode;
}

// ─── Provider Configuration ──────────────────────────────────────────────────

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  supportsStreaming: boolean;
  supportsImages: boolean;
  supportsPdf: boolean;
  maxTokens?: number;
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
