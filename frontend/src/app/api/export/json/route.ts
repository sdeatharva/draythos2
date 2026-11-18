import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = new URL(`${VHAGAR_API_URL}/api/export/json`);
  searchParams.forEach((v, k) => targetUrl.searchParams.append(k, v));

  try {
    const res = await fetch(targetUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "JSON export failed" }, { status: res.status });
    }

    const json = await res.json();
    return new NextResponse(JSON.stringify(json, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="draythos_canonical_facts.json"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }
}

