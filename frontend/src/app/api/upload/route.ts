import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL, MAX_UPLOAD_SIZE_MB, SUPPORTED_FORMATS } from "@/lib/constants";
import { generateId, getFileExtension } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = (formData.get("sessionId") as string) || "default";
    const userId = (formData.get("userId") as string) || (formData.get("user_id") as string) || "usr_default";
    const folderId = (formData.get("folder_id") as string) || (formData.get("folderId") as string) || "";

    if (!file || typeof file === "string" || !file.name) {
      return NextResponse.json(
        { error: "No valid file provided. Please attach a valid document.", correlationId },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    // Size validation
    const maxSizeBytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        {
          error: `File size exceeds maximum allowed size of ${MAX_UPLOAD_SIZE_MB}MB`,
          correlationId,
        },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    // Format validation
    const ext = getFileExtension(file.name);
    const isSupported = SUPPORTED_FORMATS.some((f) => f.ext === ext);
    if (!isSupported) {
      const allowed = SUPPORTED_FORMATS.map((f) => `.${f.ext}`).join(", ");
      return NextResponse.json(
        {
          error: `Unsupported file format '.${ext}'. Supported formats are: ${allowed}`,
          correlationId,
        },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    // Forward to Vhagar backend
    const backendFormData = new FormData();
    backendFormData.append("file", file, file.name);
    backendFormData.append("session_id", sessionId);
    backendFormData.append("user_id", userId);
    if (folderId) {
      backendFormData.append("folder_id", folderId);
    }

    const backendRes = await fetch(`${VHAGAR_API_URL}/upload`, {
      method: "POST",
      headers: {
        "X-Correlation-ID": correlationId,
      },
      body: backendFormData,
    });

    if (!backendRes.ok) {
      const errorText = await backendRes.text().catch(() => "Backend processing failed");
      return NextResponse.json(
        { error: `Backend upload failed (${backendRes.status}): ${errorText}`, correlationId },
        { status: backendRes.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Correlation-ID": correlationId },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Upload proxy error:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to upload document", correlationId },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}
