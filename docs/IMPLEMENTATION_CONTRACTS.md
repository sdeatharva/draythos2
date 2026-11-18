# Draythos implementation contracts

## Document references and versions

`DocumentReference` is the canonical client contract: `document_id`, `session_id`, media type, source filename, original/working-copy paths where available, format, and processing status. Originals under `data/documents/<document_id>/` are immutable. A successful save creates a separately named working copy; the newest validated copy is used by the default content and download endpoints. `?original=true` always selects the immutable source.

## Editing capability matrix

| Format | Capability | Save contract |
| --- | --- | --- |
| PDF | Preview, page navigation, zoom, text-layer search | No native editing. The save endpoint returns 409 rather than producing a regenerated approximation. |
| XLSX/XLS | Typed cell edits | A temporary working copy is reopened and every requested edit is verified before atomic promotion. |
| CSV | Content/cell edits | Versioned working copy. |
| DOCX | Guarded editing is not enabled until the documented round-trip matrix has passed | Treat as preview/download only in releases without that evidence. |

## Chat route contract

`POST /api/chat/stream` is the canonical chat endpoint. Events are SSE frames with one of `status`, `delta`, `citation`, `complete`, `cancelled`, or `error`. The compatibility `POST /api/chat` uses the same validation, retrieval-context construction, provider selection, and citation formatting service.

Requests must name the active session and attachment document IDs explicitly. Attachment-scoped retrieval takes precedence; global retrieval is opt-in. Citations must carry a document ID and an available source locator.

## Design tokens

The supplied design-token document was not included in this repository as of 2026-11-13. No replacement palette or token mapping may be invented. Visual token alignment remains blocked until that source is supplied.
