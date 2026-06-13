const fs = require('fs');
const path = require('path');
const { processCSVImport } = require('./services/importService');

const csvPath = path.join(__dirname, 'db', 'expenses_export.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');

// Membership dates from the problem statement
const membershipMap = {
  'Aisha': { joined: '2026-02-01', left: null },
  'Rohan': { joined: '2026-02-01', left: null },
  'Priya': { joined: '2026-02-01', left: null },
  'Meera': { joined: '2026-02-01', left: '2026-03-31' },
  'Sam':   { joined: '2026-04-08', left: null },
  'Dev':   { joined: '2026-03-08', left: '2026-03-15' }
};

processCSVImport(csvContent, 1, 1, membershipMap).then(result => {
  console.log('=== STATS ===');
  console.log(JSON.stringify(result.stats, null, 2));

  console.log('\n=== ANOMALIES (' + result.anomalies.length + ' total) ===');
  for (const a of result.anomalies) {
    console.log(`[${a.severity.toUpperCase().padEnd(7)}] Row ${String(a.row_number).padStart(2)}: ${a.anomaly_type} — ${a.description}`);
  }

  console.log('\n=== NAME MAP ===');
  for (const [k, v] of Object.entries(result.name_map)) {
    if (k !== v) console.log(`  "${k}" → "${v}"`);
  }
}).catch(err => console.error(err));
