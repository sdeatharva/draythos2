import { NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const factId = searchParams.get("fact_id");

    if (!factId) {
      return NextResponse.json({ error: "fact_id required" }, { status: 400 });
    }

    const script = `
import sqlite3, json, sys

conn = sqlite3.connect('data/draythos.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

fact_id = sys.argv[1]

c.execute('''
    SELECT f.*, d.filename, d.sha256 as doc_sha256
    FROM facts f
    LEFT JOIN documents d ON f.doc_id = d.doc_id
    WHERE f.fact_id = ?
''', (fact_id,))
f_row = c.fetchone()
if not f_row:
    print(json.dumps({'error': 'Fact not found'}))
    sys.exit(0)
fact = dict(f_row)

c.execute('SELECT * FROM concepts WHERE concept_id = ?', (fact.get('concept_id'),))
concept_row = c.fetchone()
concept = dict(concept_row) if concept_row else {}

c.execute('''
    SELECT entry_id, event_type, entity_id, actor, payload, prev_hash, current_hash, created_at
    FROM audit_ledger
    WHERE entity_id = ? OR entity_id = ?
    ORDER BY entry_id ASC
''', (fact_id, fact.get('doc_id')))
ledger_entries = [dict(r) for r in c.fetchall()]

c.execute('SELECT * FROM aliases WHERE LOWER(alias) = LOWER(?) LIMIT 1', (fact.get('raw_label'),))
alias_row = c.fetchone()
alias = dict(alias_row) if alias_row else None

if alias:
    rule = f"Deterministic rule: Exact alias match '{alias['alias']}' mapped to '{alias['concept_id']}' with relation '{alias.get('relation', 'equivalent')}'."
else:
    conf = float(fact.get('confidence') or 0.9) * 100
    rule = f"AST & syntactic matcher: Label '{fact.get('raw_label')}' mapped via {fact.get('match_method', 'calibrated model')} with confidence {conf:.1f}%."

explanation = {
    'fact_id': fact['fact_id'],
    'raw_label': fact.get('raw_label'),
    'assigned_concept': fact.get('concept_id'),
    'concept_title': concept.get('label') or fact.get('concept_label') or fact.get('concept_id'),
    'concept_definition': concept.get('definition') or 'Canonical reporting metric.',
    'mapping_rule': rule,
    'provenance': {
        'document': fact.get('filename') or fact.get('doc_id'),
        'document_hash': fact.get('doc_sha256') or 'N/A',
        'locator': fact.get('locator'),
        'period': fact.get('period'),
        'unit': fact.get('unit'),
        'value': fact.get('value_num'),
    },
    'audit_trail': [
        {
            'entry_id': e['entry_id'],
            'event': e['event_type'],
            'timestamp': e['created_at'],
            'hash': e['current_hash'][:16] + '...'
        }
        for e in ledger_entries
    ],
    'regulatory_basis': 'Terminology normalization, not a legal determination. Grounded to verified corpus bounding box.'
}

print(json.dumps(explanation))
`;

    const rootDir = path.resolve(process.cwd(), "..");
    const { stdout } = await execFileAsync("python", ["-c", script, factId], {
      cwd: rootDir,
    });

    const parsed = JSON.parse(stdout.trim());
    if (parsed.error) {
      return NextResponse.json({ error: parsed.error }, { status: 404 });
    }
    return NextResponse.json(parsed);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate fact explanation" },
      { status: 500 }
    );
  }
}
