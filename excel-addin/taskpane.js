/**
 * Office.js Task Pane logic for Draythos Finance Concept Translator.
 */

const API_BASE = "http://localhost:8001";

Office.onReady((info) => {
  if (info.host === Office.HostType.Excel) {
    document.getElementById("btn-normalize").onclick = normalizeSelection;
    document.getElementById("btn-pull-fact").onclick = pullFact;
    document.getElementById("btn-open-source").onclick = openSource;
  }
});

function log(msg) {
  const el = document.getElementById("log");
  el.style.display = "block";
  el.innerHTML += `<div>> ${msg}</div>`;
  el.scrollTop = el.scrollHeight;
}

/**
 * 1. Read selected cells, call POST /api/normalize, and write canonical concept
 * and confidence into adjacent columns.
 */
async function normalizeSelection() {
  try {
    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      range.load(["values", "rowIndex", "columnIndex", "rowCount", "columnCount"]);
      await context.sync();

      const labels = [];
      for (let r = 0; r < range.rowCount; r++) {
        for (let c = 0; c < range.columnCount; c++) {
          const val = range.values[r][c];
          if (val && typeof val === "string") {
            labels.push({ row: r, col: c, text: val.trim() });
          }
        }
      }

      if (labels.length === 0) {
        log("No text headers found in selection.");
        return;
      }

      log(`Normalizing ${labels.length} headers...`);

      // Call Vhagar normalization endpoint
      const res = await fetch(`${API_BASE}/api/normalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: labels.map(l => ({ text: l.text })) }),
      });

      if (!res.ok) {
        throw new Error(`Normalization API error: ${res.status}`);
      }

      const data = await res.json();
      const results = data.results || [];

      // Write adjacent columns: Canonical Concept, Confidence
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      for (let i = 0; i < labels.length; i++) {
        const item = labels[i];
        const match = results[i];
        if (match && match.concept_id) {
          const targetCell = sheet.getCell(range.rowIndex + item.row, range.columnIndex + range.columnCount);
          targetCell.values = [[`${match.concept_label} (${match.concept_id})`]];
          
          const confCell = sheet.getCell(range.rowIndex + item.row, range.columnIndex + range.columnCount + 1);
          confCell.values = [[Math.round(match.confidence * 100) + "%"]];
        }
      }

      await context.sync();
      log(`Inserted canonical translations into adjacent columns.`);
    });
  } catch (err) {
    log(`Error: ${err.message}`);
  }
}

/**
 * 2. Pull verified fact from Draythos Facts service into the active sheet.
 */
async function pullFact() {
  const concept = document.getElementById("concept-select").value;
  const period = document.getElementById("period-input").value;

  try {
    log(`Querying facts for ${concept} (${period})...`);
    const res = await fetch(`${API_BASE}/api/facts?concept_id=${concept}&limit=1`);
    if (!res.ok) throw new Error(`Facts query error: ${res.status}`);

    const data = await res.json();
    const facts = data.facts || [];
    if (facts.length === 0) {
      log(`No facts found for ${concept}.`);
      return;
    }

    const fact = facts[0];

    await Excel.run(async (context) => {
      const activeCell = context.workbook.getActiveCell();
      activeCell.values = [[fact.value_num]];
      
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      activeCell.load(["rowIndex", "columnIndex"]);
      await context.sync();

      // Write unit and source quote in next columns
      const unitCell = sheet.getCell(activeCell.rowIndex, activeCell.columnIndex + 1);
      unitCell.values = [[fact.unit || "USD"]];

      const sourceCell = sheet.getCell(activeCell.rowIndex, activeCell.columnIndex + 2);
      sourceCell.values = [[`Source: [F:${fact.fact_id}] ${fact.locator?.quote || ""}`]];

      await context.sync();
      log(`Fact ${fact.fact_id} inserted successfully.`);
    });
  } catch (err) {
    log(`Error: ${err.message}`);
  }
}

/**
 * 3. Open deep-linked source in Eyrie.
 */
function openSource() {
  window.open("http://localhost:3000/app/review", "_blank");
}

