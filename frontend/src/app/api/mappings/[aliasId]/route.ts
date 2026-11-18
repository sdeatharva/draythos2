import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ aliasId: string }> }
) {
  const { aliasId } = await params;
  try {
    const res = await fetch(`${VHAGAR_API_URL}/api/mappings/${aliasId}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to delete alias" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

