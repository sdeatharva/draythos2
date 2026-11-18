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

c.execute('''
    SELECT f.fact_id, f.doc_id, f.entity, f.jurisdiction, f.raw_label, f.concept_id,
           f.value_num, f.unit, f.period, f.confidence, f.match_method, f.locator,
           d.filename
    FROM facts f
    LEFT JOIN documents d ON f.doc_id = d.doc_id
    WHERE f.state = 'needs_review' OR f.confidence < 0.75
    ORDER BY f.confidence ASC LIMIT 50
''')
abstained = [dict(r) for r in c.fetchall()]

conflicts_query = '''
    SELECT f1.fact_id as fact1_id, f1.doc_id as doc1_id, f1.concept_id, f1.raw_label as label1, 
           f1.value_num as val1, f1.period, f1.entity as entity1, f1.jurisdiction as jur1,
           f2.fact_id as fact2_id, f2.doc_id as doc2_id, f2.raw_label as label2, 
           f2.value_num as val2, f2.entity as entity2, f2.jurisdiction as jur2
    FROM facts f1
    JOIN facts f2 ON f1.concept_id = f2.concept_id 
                 AND f1.period = f2.period 
                 AND f1.fact_id < f2.fact_id
                 AND f1.value_num != f2.value_num
    LIMIT 25
'''
c.execute(conflicts_query)
conflicts = [dict(r) for r in c.fetchall()]

print(json.dumps({
    'abstained': abstained,
    'conflicts': conflicts,
    'totalExceptions': len(abstained) + len(conflicts)
}))
`;

    const rootDir = path.resolve(process.cwd(), "..");
    const { stdout } = await execFileAsync("python", ["-c", script], {
      cwd: rootDir,
    });

    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load exceptions" },
      { status: 500 }
    );
  }
}
