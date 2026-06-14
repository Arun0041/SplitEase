const { parse } = require('csv-parse/sync');

/**
 * CSV Import Service
 * 
 * Parses expense CSV files and detects data problems before importing.
 * Each problem is flagged as an "anomaly" with a severity level so the
 * user can review and decide what to do (accept, fix, or skip).
 * 
 * Anomaly types we check for:
 *  1. duplicate              – Same expense appears twice
 *  2. duplicate_conflict     – Same event logged by two people with different amounts
 *  3. missing_field          – A required column is blank
 *  4. negative_amount        – Negative value (could be a refund)
 *  5. zero_amount            – Amount is zero
 *  6. settlement_as_expense  – A payment between people logged as an expense
 *  7. currency_mismatch      – USD amount that needs conversion to INR
 *  8. missing_currency       – Currency column is blank, defaulting to INR
 *  9. date_format            – Date couldn't be parsed or is ambiguous
 * 10. ambiguous_date         – DD/MM vs MM/DD can't be determined
 * 11. future_date            – Expense date is in the future
 * 12. member_not_active      – Person wasn't in the group on that date
 * 13. unknown_member         – Person not recognised as a group member
 * 14. name_inconsistency     – Variant spelling mapped to a known name
 * 15. invalid_percentage     – Percentage splits don't add up to 100%
 * 16. split_type_mismatch    – split_type and split_details contradict each other
 */


// ── Helper: Levenshtein distance for fuzzy name matching ──────────

function levenshtein(a, b) {
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = b[i - 1] === a[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[b.length][a.length];
}


// ── Helper: pull a value from a row using multiple possible column names ──

function col(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') {
      return String(row[name]).trim();
    }
  }
  // try case-insensitive fallback
  const keys = Object.keys(row);
  for (const name of names) {
    const match = keys.find(k => k.toLowerCase() === name.toLowerCase());
    if (match && row[match] !== undefined && String(row[match]).trim() !== '') {
      return String(row[match]).trim();
    }
  }
  return null;
}


// ── Helper: collect all names that appear anywhere in the CSV ──

function collectNames(rows) {
  const names = new Set();
  for (const row of rows) {
    const payer = col(row, ['paid_by', 'payer', 'Paid By']);
    if (payer) names.add(payer);

    const splitWith = col(row, ['split_with', 'split with', 'participants', 'members']);
    if (splitWith) {
      splitWith.split(/[;,|]/).forEach(n => { if (n.trim()) names.add(n.trim()); });
    }
  }
  return [...names];
}


// ── Build a map from every name variant to a canonical name ──

function buildNameMap(allNames, knownMembers) {
  const map = {};
  const canonical = knownMembers.length > 0 ? knownMembers : ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

  for (const name of allNames) {
    const lower = name.toLowerCase();

    // exact match
    const exact = canonical.find(c => c.toLowerCase() === lower);
    if (exact) { map[name] = exact; continue; }

    // variant contains canonical (e.g. "Priya S" contains "Priya")
    // but skip if it contains "friend" — "Dev's friend Kabir" should NOT map to Dev
    if (!lower.includes('friend')) {
      const contains = canonical.find(c => lower.includes(c.toLowerCase()) && c.length >= 3);
      if (contains) { map[name] = contains; continue; }
    }

    // fuzzy match (edit distance <= 2)
    const fuzzy = canonical.find(c => levenshtein(lower, c.toLowerCase()) <= 2);
    if (fuzzy) { map[name] = fuzzy; continue; }

    // no match — keep as-is (will be flagged as unknown)
    map[name] = name;
  }

  return map;
}


// ── Parse a date string from many possible formats ──

function parseDate(raw) {
  if (!raw || raw.trim() === '') return { date: null, error: 'missing' };
  const s = raw.trim();

  // ISO: 2026-02-01
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return { date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) };
  }

  // DD/MM/YYYY or MM/DD/YYYY — ambiguous when both parts <= 12
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = +m[1], b = +m[2], year = +m[3];
    const ambiguous = a <= 12 && b <= 12 && a !== b;
    // Default interpretation: DD/MM/YYYY
    return { date: new Date(Date.UTC(year, b - 1, a)), ambiguous, raw: s };
  }

  // Month-name without year: "Mar 14" → assume 2026
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (m) {
    const month = new Date(Date.parse(m[1] + ' 1, 2026')).getMonth();
    if (!isNaN(month)) {
      return { date: new Date(Date.UTC(2026, month, +m[2])) };
    }
  }

  // Last resort: native parser
  const d = new Date(s);
  if (!isNaN(d.getTime())) return { date: d };

  return { date: null, error: 'unparseable', raw: s };
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}


// ── Parse an amount string, handling commas, currency symbols, whitespace ──

function parseAmount(raw, currencyCol) {
  if (!raw || raw.trim() === '') return { amount: null, currency: null, error: 'missing' };

  let s = raw.trim();
  let currency = (currencyCol && currencyCol.trim()) ? currencyCol.trim().toUpperCase() : null;

  // Strip currency symbols
  if (s.startsWith('$')) { currency = currency || 'USD'; s = s.slice(1); }
  if (s.startsWith('₹')) { currency = currency || 'INR'; s = s.slice(1); }

  // Remove commas and extra spaces: "1,200" → "1200", " 1450 " → "1450"
  s = s.replace(/[,\s]/g, '');

  const num = parseFloat(s);
  if (isNaN(num)) return { amount: null, currency: null, error: 'invalid', raw };

  return { amount: num, currency: currency || 'INR', currencyMissing: !currencyCol || currencyCol.trim() === '' };
}


// ── Check if a description looks like a settlement, not an expense ──

function looksLikeSettlement(description, splitType) {
  if (!description) return false;
  const lower = description.toLowerCase();
  const keywords = [
    'paid back', 'pay back', 'payback', 'settle', 'settlement',
    'repaid', 'repay', 'reimburs', 'deposit share', 'deposit',
    'transfer', 'cleared', 'return'
  ];
  // Also suspicious: no split_type, which means it's probably a person-to-person payment
  const hasKeyword = keywords.some(kw => lower.includes(kw));
  const noSplitType = !splitType || splitType.trim() === '';
  return hasKeyword || (noSplitType && lower.includes('paid'));
}


// ── Find exact duplicates (same date + similar description + same amount) ──

function findDuplicates(rows) {
  const seen = new Map();
  const dupes = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Normalize description: remove filler words and punctuation
    const descNorm = (r.description || '').toLowerCase()
      .replace(/\b(at|the|for|and|in|a)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
    const key = `${r.date}|${descNorm}|${Math.abs(r.amount || 0)}`;

    if (seen.has(key)) {
      dupes.push({ index: i, originalIndex: seen.get(key) });
    } else {
      seen.set(key, i);
    }
  }
  return dupes;
}


// ── Find conflicting duplicates (same event but different amounts) ──

function findConflicts(rows) {
  const byEvent = new Map();
  const conflicts = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.date || !r.splitWith) continue;

    const people = r.splitWith.split(/[;,|]/).map(n => n.trim().toLowerCase()).sort().join('|');
    const key = `${r.date}|${people}`;

    if (byEvent.has(key)) {
      const prev = byEvent.get(key);
      if (Math.abs((prev.amount || 0) - (r.amount || 0)) > 0.01) {
        // Check descriptions share at least one meaningful word
        const words1 = (r.description || '').toLowerCase().split(/\s+/);
        const words2 = (prev.description || '').toLowerCase().split(/\s+/);
        const overlap = words1.filter(w => words2.includes(w) && w.length > 3).length;
        if (overlap > 0) {
          conflicts.push({ index: i, otherIndex: prev.index, amt1: prev.amount, amt2: r.amount });
        }
      }
    } else {
      byEvent.set(key, { ...r, index: i });
    }
  }
  return conflicts;
}


// ═══════════════════════════════════════════════════════
// MAIN FUNCTION: Parse CSV + detect all anomalies
// ═══════════════════════════════════════════════════════

async function processCSVImport(csvContent, groupId, userId, membershipMap) {
  const anomalies = [];
  const USD_RATE = parseFloat(process.env.USD_TO_INR_RATE) || 83.0;

  // ── Step 1: Parse the raw CSV ──
  let rawRows;
  try {
    rawRows = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true
    });
  } catch (err) {
    return {
      success: false,
      error: `CSV parsing failed: ${err.message}`,
      anomalies: [{ row_number: 0, anomaly_type: 'parse_error', severity: 'critical', description: err.message }]
    };
  }

  // ── Step 2: Build name map from all names found in the CSV ──
  const knownMembers = membershipMap ? Object.keys(membershipMap) : [];
  const allNames = collectNames(rawRows);
  const nameMap = buildNameMap(allNames, knownMembers);

  // Log name variants as info-level anomalies
  for (const [variant, canonical] of Object.entries(nameMap)) {
    if (variant !== canonical) {
      anomalies.push({
        row_number: 0,
        anomaly_type: 'name_inconsistency',
        severity: 'info',
        description: `Name variant "${variant}" → mapped to "${canonical}"`,
        original_data: { variant, canonical },
        suggested_action: 'modify',
        suggested_value: { original: variant, mapped_to: canonical }
      });
    }
    // Flag completely unknown people
    if (variant === canonical && knownMembers.length > 0 && !knownMembers.includes(canonical)) {
      anomalies.push({
        row_number: 0,
        anomaly_type: 'unknown_member',
        severity: 'warning',
        description: `Unknown person "${variant}" is not a member of this group.`,
        original_data: { name: variant },
        suggested_action: 'keep',
        suggested_value: { add_as_member: true }
      });
    }
  }

  // ── Step 3: Parse each row and run per-row checks ──
  const parsed = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // +2 because row 1 is the header, and we're 1-indexed

    const dateRaw     = col(raw, ['date', 'Date']);
    const description = col(raw, ['description', 'Description', 'desc']);
    const amountRaw   = col(raw, ['amount', 'Amount', 'total']);
    const paidByRaw   = col(raw, ['paid_by', 'Paid By', 'payer']);
    const currencyRaw = col(raw, ['currency', 'Currency']);
    const splitType   = col(raw, ['split_type', 'Split Type', 'type']);
    const splitWith   = col(raw, ['split_with', 'Split With', 'participants']);
    const splitDetail = col(raw, ['split_details', 'Split Details', 'split_detail']);
    const notes       = col(raw, ['notes', 'Notes', 'comment']);

    // ── Date check ──
    const dateResult = parseDate(dateRaw);
    let date = null;

    if (dateResult.error === 'missing') {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'missing_field', severity: 'error',
        description: `Row ${rowNum}: Missing date`, original_data: raw, suggested_action: 'skip'
      });
    } else if (dateResult.error === 'unparseable') {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'date_format', severity: 'error',
        description: `Row ${rowNum}: Could not parse date "${dateResult.raw}"`,
        original_data: raw, suggested_action: 'skip'
      });
    } else {
      date = formatDate(dateResult.date);

      if (dateResult.ambiguous) {
        anomalies.push({
          row_number: rowNum, anomaly_type: 'ambiguous_date', severity: 'warning',
          description: `Row ${rowNum}: Ambiguous date "${dateResult.raw}" — could be DD/MM or MM/DD. Interpreted as DD/MM/YYYY → ${date}`,
          original_data: raw, suggested_action: 'modify',
          suggested_value: { interpreted_as: date, format: 'DD/MM/YYYY' }
        });
      }

      // Future date?
      if (dateResult.date > new Date()) {
        anomalies.push({
          row_number: rowNum, anomaly_type: 'future_date', severity: 'warning',
          description: `Row ${rowNum}: Date ${date} is in the future`,
          original_data: raw, suggested_action: 'keep'
        });
      }
    }

    // ── Amount check ──
    const amtResult = parseAmount(amountRaw, currencyRaw);

    if (amtResult.error) {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'missing_field', severity: 'error',
        description: `Row ${rowNum}: Missing or invalid amount "${amountRaw || ''}"`,
        original_data: raw, suggested_action: 'skip'
      });
    }

    if (amtResult.amount !== null && amtResult.amount < 0) {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'negative_amount', severity: 'warning',
        description: `Row ${rowNum}: Negative amount (${amtResult.amount}). Treating as refund/credit.`,
        original_data: raw, suggested_action: 'modify',
        suggested_value: { treat_as: 'refund', amount: Math.abs(amtResult.amount) }
      });
    }

    if (amtResult.amount === 0) {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'zero_amount', severity: 'warning',
        description: `Row ${rowNum}: Amount is ₹0 for "${description}". Should this row be skipped?`,
        original_data: raw, suggested_action: 'skip'
      });
    }

    // ── Currency check ──
    if (amtResult.currency === 'USD') {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'currency_mismatch', severity: 'info',
        description: `Row ${rowNum}: USD amount ($${amtResult.amount}). Will convert at ₹${USD_RATE}/USD = ₹${(amtResult.amount * USD_RATE).toFixed(2)}`,
        original_data: raw, suggested_action: 'modify',
        suggested_value: { currency: 'USD', rate: USD_RATE, amount_inr: amtResult.amount * USD_RATE }
      });
    }

    if (amtResult.currencyMissing && amtResult.amount !== null) {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'missing_currency', severity: 'warning',
        description: `Row ${rowNum}: Currency column is blank — defaulting to INR`,
        original_data: raw, suggested_action: 'modify',
        suggested_value: { assumed_currency: 'INR' }
      });
    }

    // ── Missing payer ──
    if (!paidByRaw) {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'missing_field', severity: 'error',
        description: `Row ${rowNum}: "Paid By" is blank — can't tell who paid`,
        original_data: raw, suggested_action: 'skip'
      });
    }

    // ── Settlement masquerading as expense ──
    if (looksLikeSettlement(description, splitType)) {
      anomalies.push({
        row_number: rowNum, anomaly_type: 'settlement_as_expense', severity: 'warning',
        description: `Row ${rowNum}: "${description}" looks like a payment/settlement, not a shared expense. Should be reclassified.`,
        original_data: raw, suggested_action: 'reclassify',
        suggested_value: { is_settlement: true }
      });
    }

    // ── Percentage split validation ──
    if (splitType === 'percentage' && splitDetail) {
      const pcts = splitDetail.match(/(\d+(?:\.\d+)?)\s*%/g);
      if (pcts) {
        const total = pcts.reduce((sum, p) => sum + parseFloat(p), 0);
        if (Math.abs(total - 100) > 0.01) {
          anomalies.push({
            row_number: rowNum, anomaly_type: 'invalid_percentage', severity: 'error',
            description: `Row ${rowNum}: Percentages add up to ${total}%, not 100%`,
            original_data: raw, suggested_action: 'modify',
            suggested_value: { total_percentage: total, details: splitDetail }
          });
        }
      }
    }

    // ── Split type vs. split details mismatch ──
    if (splitType === 'equal' && splitDetail && splitDetail.trim() !== '') {
      // If split_type is "equal" but split_details has share/percentage info, flag it
      const hasRatios = /\d+\s*[;:]/.test(splitDetail) || /\d+\s*%/.test(splitDetail);
      if (hasRatios) {
        anomalies.push({
          row_number: rowNum, anomaly_type: 'split_type_mismatch', severity: 'info',
          description: `Row ${rowNum}: split_type is "equal" but split_details has ratios ("${splitDetail}"). Using equal split, ignoring details.`,
          original_data: raw, suggested_action: 'keep'
        });
      }
    }

    // ── Membership checks ──
    if (membershipMap && date && splitWith) {
      const people = splitWith.split(/[;,|]/).map(n => n.trim());
      for (const person of people) {
        const canonical = nameMap[person] || person;
        const membership = membershipMap[canonical];
        if (!membership) continue; // unknown member — already flagged above

        const expDate = new Date(date);
        const joined = new Date(membership.joined);
        const left = membership.left ? new Date(membership.left) : null;

        if (expDate < joined) {
          anomalies.push({
            row_number: rowNum, anomaly_type: 'member_not_active', severity: 'warning',
            description: `Row ${rowNum}: ${canonical} hadn't joined yet on ${date} (joined ${membership.joined})`,
            original_data: raw, suggested_action: 'modify',
            suggested_value: { exclude_member: canonical, reason: 'not_yet_joined' }
          });
        }

        if (left && expDate > left) {
          anomalies.push({
            row_number: rowNum, anomaly_type: 'member_not_active', severity: 'warning',
            description: `Row ${rowNum}: ${canonical} had already left by ${date} (left ${membership.left})`,
            original_data: raw, suggested_action: 'modify',
            suggested_value: { exclude_member: canonical, reason: 'already_left' }
          });
        }
      }
    }

    parsed.push({
      rowNum, date, description,
      amount: amtResult.amount,
      currency: amtResult.currency,
      paid_by: paidByRaw,
      split_type: splitType,
      splitWith, splitDetail, notes, raw
    });
  }

  // ── Step 4: Cross-row checks ──

  // Exact duplicates
  for (const dup of findDuplicates(parsed)) {
    const r = parsed[dup.index];
    const orig = parsed[dup.originalIndex];
    anomalies.push({
      row_number: r.rowNum, anomaly_type: 'duplicate', severity: 'warning',
      description: `Row ${r.rowNum}: Duplicate of row ${orig.rowNum} — "${r.description}" on ${r.date}`,
      original_data: r.raw, suggested_action: 'skip',
      suggested_value: { duplicate_of_row: orig.rowNum }
    });
  }

  // Conflicting duplicates (same event, different amounts)
  for (const c of findConflicts(parsed)) {
    const r = parsed[c.index];
    const other = parsed[c.otherIndex];
    anomalies.push({
      row_number: r.rowNum, anomaly_type: 'duplicate_conflict', severity: 'error',
      description: `Row ${r.rowNum}: Same event as row ${other.rowNum} but different amounts (₹${c.amt1} vs ₹${c.amt2}). Which is correct?`,
      original_data: r.raw, suggested_action: 'keep',
      suggested_value: { conflicting_row: other.rowNum }
    });
  }

  // ── Sort anomalies: errors first, then by row number ──
  const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
  anomalies.sort((a, b) => {
    const diff = (severityOrder[a.severity] || 9) - (severityOrder[b.severity] || 9);
    return diff !== 0 ? diff : a.row_number - b.row_number;
  });

  // ── Build stats summary ──
  const stats = {
    total_rows: rawRows.length,
    anomaly_count: anomalies.length,
    by_severity: {
      critical: anomalies.filter(a => a.severity === 'critical').length,
      error:    anomalies.filter(a => a.severity === 'error').length,
      warning:  anomalies.filter(a => a.severity === 'warning').length,
      info:     anomalies.filter(a => a.severity === 'info').length,
    },
    by_type: anomalies.reduce((acc, a) => { acc[a.anomaly_type] = (acc[a.anomaly_type] || 0) + 1; return acc; }, {})
  };

  return { success: true, total_rows: rawRows.length, parsed_rows: parsed, anomalies, name_map: nameMap, stats };
}


// ── Save the import session and anomalies to the database ──

async function saveImportSession(groupId, importedBy, filename, importResult, dbQuery, dbGetClient) {
  const client = await dbGetClient();
  try {
    await client.query('BEGIN');

    const session = await client.query(
      `INSERT INTO import_sessions (group_id, imported_by, filename, status, total_rows, error_rows, parsed_rows)
       VALUES ($1, $2, $3, 'reviewing', $4, $5, $6) RETURNING *`,
      [groupId, importedBy, filename, importResult.total_rows,
       importResult.anomalies.filter(a => a.severity === 'error' || a.severity === 'critical').length,
       JSON.stringify(importResult.parsed_rows)]
    );

    for (const a of importResult.anomalies) {
      await client.query(
        `INSERT INTO import_anomalies
         (import_session_id, row_number, anomaly_type, severity, description, original_data, suggested_action, suggested_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [session.rows[0].id, a.row_number, a.anomaly_type, a.severity,
         a.description, JSON.stringify(a.original_data),
         a.suggested_action, JSON.stringify(a.suggested_value || null)]
      );
    }

    await client.query('COMMIT');
    return session.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


// ── Confirm the import: mark session as done ──

async function confirmImport(sessionId, groupId, dbQuery, dbGetClient) {
  const client = await dbGetClient();
  try {
    await client.query('BEGIN');

    const session = await client.query('SELECT * FROM import_sessions WHERE id = $1', [sessionId]);
    if (session.rows.length === 0) throw new Error('Import session not found');

    const anomalies = await client.query(
      'SELECT * FROM import_anomalies WHERE import_session_id = $1', [sessionId]
    );

    const skippedRows = new Set();
    const modificationsByRow = {};

    for (const a of anomalies.rows) {
      if (a.user_action === 'reject' || (a.severity === 'error' && !a.resolved)) {
        skippedRows.add(a.row_number);
      } else if (a.user_action === 'accept' && a.user_value) {
        if (!modificationsByRow[a.row_number]) modificationsByRow[a.row_number] = [];
        modificationsByRow[a.row_number].push({ type: a.anomaly_type, value: a.user_value });
      } else if (a.user_action === 'accept' && a.anomaly_type === 'settlement_as_expense') {
        if (!modificationsByRow[a.row_number]) modificationsByRow[a.row_number] = [];
        modificationsByRow[a.row_number].push({ type: a.anomaly_type, value: { is_settlement: true } });
      }
    }

    const parsedRows = session.rows[0].parsed_rows || [];
    const memberNames = new Set();
    const validRows = [];

    for (const row of parsedRows) {
      if (skippedRows.has(row.rowNum)) continue;
      let r = { ...row };

      const mods = modificationsByRow[r.rowNum] || [];
      for (const m of mods) {
        if (m.type === 'settlement_as_expense') r.is_settlement = true;
        if (m.type === 'negative_amount' && m.value?.amount) r.amount = m.value.amount;
        if (m.type === 'missing_currency' && m.value?.assumed_currency) r.currency = m.value.assumed_currency;
      }

      validRows.push(r);
      if (r.paid_by) memberNames.add(r.paid_by);
      if (r.splitWith) r.splitWith.split(/[;,|]/).forEach(n => { if (n.trim()) memberNames.add(n.trim()); });
    }

    const userIdsByName = {};
    for (const name of memberNames) {
      let u = await client.query('SELECT id, name FROM users WHERE name ILIKE $1', [name]);
      let userId;
      if (u.rows.length === 0) {
        const email = `${name.replace(/\s+/g, '').toLowerCase()}@split.local`;
        const res = await client.query(
          `INSERT INTO users (name, email) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
          [name, email]
        );
        userId = res.rows[0].id;
      } else {
        userId = u.rows[0].id;
      }
      userIdsByName[name] = userId;

      await client.query(
        `INSERT INTO group_members (group_id, user_id, joined_at) VALUES ($1, $2, '2020-01-01') ON CONFLICT DO NOTHING`,
        [groupId, userId]
      );
    }

    for (const r of validRows) {
      const payerId = userIdsByName[r.paid_by];
      const amt = parseFloat(r.amount) || 0;

      if (r.is_settlement || r.description?.toLowerCase().includes('settle')) {
        let targetName = null;
        if (r.splitWith) {
          const parts = r.splitWith.split(/[;,|]/);
          if (parts.length > 0) targetName = parts[0].trim();
        }
        if (targetName && userIdsByName[targetName]) {
          await client.query(
            `INSERT INTO settlements (group_id, paid_by, paid_to, amount, currency, settlement_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [groupId, payerId, userIdsByName[targetName], amt, r.currency || 'INR', r.date, r.description]
          );
        }
      } else {
        const amountInBase = r.currency === 'USD' ? amt * 83.0 : amt;
        let finalSplitType = (r.split_type && r.split_type !== '') ? r.split_type.toLowerCase() : 'equal';
        if (finalSplitType === 'unequal') finalSplitType = 'exact';
        if (finalSplitType === 'share') finalSplitType = 'shares';
        if (!['equal', 'exact', 'percentage', 'shares'].includes(finalSplitType)) finalSplitType = 'equal';
        
        const expRes = await client.query(
          `INSERT INTO expenses (group_id, paid_by, description, amount, currency, exchange_rate, amount_in_base, expense_date, split_type, notes, import_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [groupId, payerId, r.description, amt, r.currency || 'INR', r.currency === 'USD' ? 83.0 : 1.0, amountInBase, r.date, finalSplitType, r.notes, sessionId]
        );
        const expId = expRes.rows[0].id;

        const splitWithNames = r.splitWith ? r.splitWith.split(/[;,|]/).map(n => n.trim()).filter(n => n) : [];
        if (splitWithNames.length === 0) continue;

        if (finalSplitType === 'percentage' && r.splitDetail) {
          const pcts = r.splitDetail.match(/(\d+(?:\.\d+)?)\s*%/g);
          for (let i = 0; i < splitWithNames.length; i++) {
            const pname = splitWithNames[i];
            const pct = pcts && pcts[i] ? parseFloat(pcts[i]) : (100 / splitWithNames.length);
            const splitAmt = amountInBase * (pct / 100);
            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)`,
              [expId, userIdsByName[pname], splitAmt, pct]
            );
          }
        } else if (finalSplitType === 'exact' && r.splitDetail) {
           const parts = r.splitDetail.split(/[;,|]/);
           const exactMap = {};
           for (const part of parts) {
               const m = part.match(/([A-Za-z\s]+)\s+([\d.]+)/);
               if (m) exactMap[m[1].trim().toLowerCase()] = parseFloat(m[2]);
           }
           for (const pname of splitWithNames) {
               const parsedAmt = exactMap[pname.toLowerCase()] || 0;
               const splitAmt = r.currency === 'USD' ? parsedAmt * 83.0 : parsedAmt;
               await client.query(
                   `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)`,
                   [expId, userIdsByName[pname], splitAmt]
               );
           }
        } else if (finalSplitType === 'shares' && r.splitDetail) {
           const parts = r.splitDetail.split(/[;,|]/);
           const shareMap = {};
           let totalShares = 0;
           for (const part of parts) {
               const m = part.match(/([A-Za-z\s]+)\s+([\d.]+)/);
               if (m) {
                   const s = parseFloat(m[2]);
                   shareMap[m[1].trim().toLowerCase()] = s;
                   totalShares += s;
               }
           }
           if (totalShares === 0) totalShares = splitWithNames.length;
           for (const pname of splitWithNames) {
               const s = shareMap[pname.toLowerCase()] || 1;
               const splitAmt = amountInBase * (s / totalShares);
               await client.query(
                   `INSERT INTO expense_splits (expense_id, user_id, amount, shares) VALUES ($1, $2, $3, $4)`,
                   [expId, userIdsByName[pname], splitAmt, s]
               );
           }
        } else {
          const splitAmt = amountInBase / splitWithNames.length;
          for (const pname of splitWithNames) {
            await client.query(
              `INSERT INTO expense_splits (expense_id, user_id, amount) VALUES ($1, $2, $3)`,
              [expId, userIdsByName[pname], splitAmt]
            );
          }
        }
      }
    }

    await client.query(
      `UPDATE import_sessions SET status = 'confirmed', completed_at = NOW(),
       processed_rows = total_rows - $2 WHERE id = $1`,
      [sessionId, skippedRows.size]
    );

    await client.query('COMMIT');


    return {
      confirmed: true,
      total_rows: session.rows[0].total_rows,
      skipped_rows: skippedRows.size,
      imported_rows: session.rows[0].total_rows - skippedRows.size
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { processCSVImport, saveImportSession, confirmImport };
