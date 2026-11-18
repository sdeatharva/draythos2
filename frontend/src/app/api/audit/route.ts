import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const verify = searchParams.get("verify") === "true";
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const script = `
import sqlite3, json, hashlib, sys

conn = sqlite3.connect('data/draythos.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

if ${verify ? "True" : "False"}:
    c.execute('SELECT entry_id, event_type, entity_id, payload, prev_hash, current_hash FROM audit_ledger ORDER BY entry_id ASC')
    rows = c.fetchall()
    is_valid = True
    broken_idx = -1
    for i, r in enumerate(rows):
        expected_input = r['prev_hash'] + r['event_type'] + r['entity_id'] + r['payload']
        calc = hashlib.sha256(expected_input.encode('utf-8')).hexdigest()
        if calc != r['current_hash'] or (i > 0 and r['prev_hash'] != rows[i-1]['current_hash']):
            is_valid = False
            broken_idx = r['entry_id']
            break
    print(json.dumps({
        'verified': is_valid,
        'total_entries': len(rows),
        'broken_entry_id': broken_idx,
        'algorithm': 'SHA-256 Hash Chain'
    }))
else:
    c.execute('SELECT entry_id, event_type, entity_id, actor, payload, prev_hash, current_hash, created_at FROM audit_ledger ORDER BY entry_id DESC LIMIT ?', (${limit},))
    entries = [dict(r) for r in c.fetchall()]
    c.execute('SELECT COUNT(*) as count FROM audit_ledger')
    total = c.fetchone()['count']
    print(json.dumps({'entries': entries, 'total': total}))
`;

    const rootDir = path.resolve(process.cwd(), "..");
    const { stdout } = await execFileAsync("python", ["-c", script], {
      cwd: rootDir,
    });

    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch audit ledger" },
      { status: 500 }
    );
  }
}
