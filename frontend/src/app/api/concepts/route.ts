import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = new URL(`${VHAGAR_API_URL}/api/concepts`);
  searchParams.forEach((v, k) => targetUrl.searchParams.append(k, v));

  try {
    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load concepts" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

