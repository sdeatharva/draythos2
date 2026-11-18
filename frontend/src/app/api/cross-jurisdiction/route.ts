import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const concept = searchParams.get("concept") || "fs.revenue";

    const script = `
import sqlite3, json, sys

conn = sqlite3.connect('data/draythos.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

concept = sys.argv[1]

c.execute('''
    SELECT f.fact_id, f.doc_id, f.entity, f.jurisdiction, f.raw_label, f.concept_id, 
           f.value_num, f.unit, f.period, f.locator, f.confidence, f.match_method,
           d.filename
    FROM facts f
    LEFT JOIN documents d ON f.doc_id = d.doc_id
    WHERE f.concept_id LIKE ? OR f.raw_label LIKE ?
    ORDER BY f.jurisdiction ASC, f.period DESC
''', (f'%{concept}%', f'%{concept}%'))
facts = [dict(r) for r in c.fetchall()]

c.execute('SELECT * FROM concepts WHERE concept_id = ?', (concept,))
c_row = c.fetchone()
concept_details = dict(c_row) if c_row else {
    'concept_id': concept,
    'label': concept,
    'definition': 'Standard financial reporting metric across accounting standards'
}

c.execute(\"SELECT DISTINCT concept_id, concept_label FROM facts WHERE concept_id IS NOT NULL AND concept_id != ''\")
available = [dict(r) for r in c.fetchall()]

by_jur = {'IN': [], 'UK': [], 'US': [], 'SG': []}
for f in facts:
    jur = (f.get('jurisdiction') or 'GLOBAL').upper()
    if 'IN' in jur or jur == 'INDIA': by_jur['IN'].append(f)
    elif 'UK' in jur or 'GB' in jur: by_jur['UK'].append(f)
    elif 'US' in jur: by_jur['US'].append(f)
    elif 'SG' in jur: by_jur['SG'].append(f)
    else:
        ent = (f.get('entity') or '').lower()
        if 'bharat' in ent: by_jur['IN'].append(f)
        elif 'thames' in ent: by_jur['UK'].append(f)
        elif 'acme' in ent: by_jur['US'].append(f)
        else: by_jur['SG'].append(f)

print(json.dumps({
    'selectedConcept': concept,
    'conceptDetails': concept_details,
    'availableConcepts': available,
    'comparison': by_jur,
    'accountingStandards': {
        'IN': 'Ind AS 115 / Companies Act 2013 (INR)',
        'UK': 'UK GAAP / FRS 102 (GBP)',
        'US': 'US GAAP / ASC 606 (USD)',
        'SG': 'SFRS(I) 15 / ACRA Guidelines (SGD)'
    }
}))
`;

    const rootDir = path.resolve(process.cwd(), "..");
    const { stdout } = await execFileAsync("python", ["-c", script, concept], {
      cwd: rootDir,
    });

    const parsed = JSON.parse(stdout.trim());
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate cross-jurisdiction comparison" },
      { status: 500 }
    );
  }
}
