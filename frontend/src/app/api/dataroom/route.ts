import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    const script = `
import sqlite3, json

conn = sqlite3.connect('data/draythos.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

query = '''
  SELECT d.doc_id, d.filename, d.format, d.sha256, d.status, d.entity, d.jurisdiction,
         d.page_count, d.size, d.uploaded_at, d.created_at,
         COUNT(f.fact_id) as fact_count,
         SUM(CASE WHEN f.state = 'auto_accepted' OR f.state = 'user_confirmed' THEN 1 ELSE 0 END) as verified_count,
         SUM(CASE WHEN f.state = 'needs_review' THEN 1 ELSE 0 END) as review_count
  FROM documents d
  LEFT JOIN facts f ON d.doc_id = f.doc_id
  GROUP BY d.doc_id
  ORDER BY d.created_at DESC
'''
c.execute(query)
docs = [dict(r) for r in c.fetchall()]
print(json.dumps({'documents': docs}))
`;

    const rootDir = path.resolve(process.cwd(), "..");
    const { stdout } = await execFileAsync("python", ["-c", script], {
      cwd: rootDir,
    });

    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load dataroom documents" },
      { status: 500 }
    );
  }
}
