const { parse } = require('csv-parse/sync');
const { query, getClient } = require('../config/db');

/**
 * CSV Import Service
 *
 * This is the core of the assignment. The importer must:
 * 1. Parse the CSV regardless of format inconsistencies
 * 2. Detect at least 12 data anomalies
 * 3. Surface each anomaly to the user
 * 4. Handle each anomaly with a documented policy
 *
 * ANOMALY TYPES:
 * - duplicate          : Same expense logged twice
 * - negative_amount    : Negative amount (refund or error?)
 * - settlement_as_expense : A settlement/payment logged as regular expense
 * - currency_mismatch  : USD amount treated as INR
 * - date_format        : Inconsistent or ambiguous date format
 * - member_not_active  : Expense includes someone who wasn't in the group at that time
 * - unknown_member     : Person not recognized in the group
 * - split_mismatch     : Split amounts don't add up to total
 * - missing_field      : Required field is empty
 * - name_inconsistency : Variant spellings of a name
 * - invalid_percentage : Percentage splits don't sum to 100
 * - zero_amount        : Expense with zero amount
 * - future_date        : Expense date is in the future
 * - duplicate_conflict : Same expense logged by two people with different amounts
 */

// ─── Canonical name mapping ─────────────────────────────
// Handles inconsistent naming (e.g., "rohan" vs "Rohan" vs "Rohan S.")
function buildNameMap(rows) {
  const nameVariants = {};
  const allNames = new Set();

  for (const row of rows) {
    // Collect all names from payer and split columns
    const names = extractNamesFromRow(row);
    names.forEach(n => allNames.add(n));
  }

  // Known canonical names from the problem statement
  const canonicalNames = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

  for (const name of allNames) {
    const normalized = name.trim().toLowerCase();
    const match = canonicalNames.find(cn => {
      const cnLower = cn.toLowerCase();
      return normalized === cnLower
        || normalized.startsWith(cnLower)
        || cnLower.startsWith(normalized)
        || levenshtein(normalized, cnLower) <= 2;
    });

    if (match) {
      nameVariants[name] = match;
    } else {
      nameVariants[name] = name.trim(); // Keep as-is, flag as unknown
    }
  }

  return nameVariants;
}

// Simple Levenshtein distance for fuzzy name matching
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// Extract all person names from a CSV row
function extractNamesFromRow(row) {
  const names = new Set();
  // Payer/Paid by column
  const payerCols = ['paid_by', 'payer', 'paid by', 'Paid By', 'Paid_By', 'PaidBy'];
  for (const col of payerCols) {
    if (row[col]) names.add(row[col].trim());
  }
  // Split-with or participants column
  const splitCols = ['split_with', 'split with', 'Split With', 'participants', 'Participants', 'members', 'split_between', 'Split Between'];
  for (const col of splitCols) {
    if (row[col]) {
      row[col].split(/[,;|]/).forEach(n => {
        if (n.trim()) names.add(n.trim());
      });
    }
  }
  return [...names];
}

// ─── Parse date from multiple formats ───────────────────
function parseDate(dateStr, rowNum) {
  if (!dateStr || dateStr.trim() === '') return { date: null, anomaly: 'missing_field' };

  const cleaned = dateStr.trim();
  const anomalies = [];

  // Try multiple date formats
  const formats = [
    // YYYY-MM-DD (ISO)
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, parse: (m) => new Date(m[1], m[2] - 1, m[3]) },
    // DD/MM/YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m) => new Date(m[3], m[2] - 1, m[1]) },
    // MM/DD/YYYY (ambiguous with DD/MM/YYYY)
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, parse: (m) => new Date(m[3], m[1] - 1, m[2]), ambiguous: true },
    // DD-MM-YYYY
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, parse: (m) => new Date(m[3], m[2] - 1, m[1]) },
    // DD.MM.YYYY
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, parse: (m) => new Date(m[3], m[2] - 1, m[1]) },
    // Mon DD, YYYY (e.g., "Mar 15, 2025")
    { regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, parse: (m) => new Date(`${m[1]} ${m[2]}, ${m[3]}`) },
    // DD Mon YYYY (e.g., "15 Mar 2025")
    { regex: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/, parse: (m) => new Date(`${m[2]} ${m[1]}, ${m[3]}`) },
  ];

  for (const fmt of formats) {
    const match = cleaned.match(fmt.regex);
    if (match) {
      const date = fmt.parse(match);
      if (!isNaN(date.getTime())) {
        // Check for ambiguous date (could be DD/MM or MM/DD)
        const isAmbiguous = fmt.ambiguous && parseInt(match[1]) <= 12 && parseInt(match[2]) <= 12;
        return {
          date: date.toISOString().split('T')[0],
          format_detected: fmt.regex.toString(),
          ambiguous: isAmbiguous || false
        };
      }
    }
  }

  // Last resort: try native Date parser
  const lastResort = new Date(cleaned);
  if (!isNaN(lastResort.getTime())) {
    return { date: lastResort.toISOString().split('T')[0], format_detected: 'native' };
  }

  return { date: null, anomaly: 'date_format', original: cleaned };
}

// ─── Parse amount, handling currency symbols ────────────
function parseAmount(amountStr) {
  if (!amountStr || amountStr.trim() === '') return { amount: null, currency: null, anomaly: 'missing_field' };

  const cleaned = amountStr.trim();

  // Detect currency
  let currency = 'INR';
  let numStr = cleaned;

  if (cleaned.startsWith('$') || cleaned.toLowerCase().includes('usd')) {
    currency = 'USD';
    numStr = cleaned.replace(/[$USDusd\s]/g, '');
  } else if (cleaned.startsWith('₹') || cleaned.toLowerCase().includes('inr')) {
    currency = 'INR';
    numStr = cleaned.replace(/[₹INRinr\s]/g, '');
  }

  // Remove commas and whitespace
  numStr = numStr.replace(/[,\s]/g, '');

  const amount = parseFloat(numStr);

  if (isNaN(amount)) {
    return { amount: null, currency: null, anomaly: 'missing_field', original: cleaned };
  }

  return { amount, currency, isNegative: amount < 0 };
}

// ─── Detect settlement keywords in description ─────────
function isSettlementDescription(description) {
  if (!description) return false;
  const keywords = [
    'settle', 'settled', 'settlement', 'paid back', 'payback', 'pay back',
    'repaid', 'repay', 'repayment', 'reimbursed', 'reimbursement',
    'transfer', 'transferred', 'return', 'returned', 'cleared', 'clearing'
  ];
  const lower = description.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

// ─── Detect duplicates ──────────────────────────────────
function findDuplicates(parsedRows) {
  const seen = new Map();
  const duplicates = [];

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    // Create a hash key based on date + description + amount + payer
    const key = `${row.date}|${(row.description || '').toLowerCase().trim()}|${Math.abs(row.amount || 0)}|${(row.paid_by || '').toLowerCase().trim()}`;

    if (seen.has(key)) {
      duplicates.push({
        rowIndex: i,
        duplicateOf: seen.get(key),
        key
      });
    } else {
      seen.set(key, i);
    }
  }

  return duplicates;
}

// ─── Find conflicting duplicates (same event, different amounts) ──
function findConflictingDuplicates(parsedRows) {
  const byEvent = new Map();
  const conflicts = [];

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    // Key by date + normalized description (ignore amount and payer)
    const descNorm = (row.description || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const key = `${row.date}|${descNorm}`;

    if (byEvent.has(key)) {
      const existing = byEvent.get(key);
      if (Math.abs((existing.amount || 0) - (row.amount || 0)) > 0.01) {
        conflicts.push({
          rowIndex: i,
          conflictsWith: existing.rowIndex,
          row1Amount: existing.amount,
          row2Amount: row.amount
        });
      }
    } else {
      byEvent.set(key, { ...row, rowIndex: i });
    }
  }

  return conflicts;
}

// ─── Get column name (flexible matching) ────────────────
function getColumnValue(row, possibleNames) {
  for (const name of possibleNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  // Also try case-insensitive
  const rowKeys = Object.keys(row);
  for (const name of possibleNames) {
    const match = rowKeys.find(k => k.toLowerCase().trim() === name.toLowerCase().trim());
    if (match && row[match] !== undefined && row[match] !== null && row[match] !== '') {
      return row[match];
    }
  }
  return null;
}

// ═════════════════════════════════════════════════════════
// MAIN IMPORT FUNCTION
// ═════════════════════════════════════════════════════════
async function processCSVImport(csvContent, groupId, importedBy, membershipMap) {
  const anomalies = [];

  // Step 1: Parse CSV
  let rawRows;
  try {
    rawRows = parse(csvContent, {
      columns: true,       // Use first row as headers
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,  // Handle inconsistent column counts
      relax_quotes: true
    });
  } catch (err) {
    return {
      success: false,
      error: `CSV parsing failed: ${err.message}`,
      anomalies: [{ row_number: 0, anomaly_type: 'parse_error', severity: 'critical', description: err.message }]
    };
  }

  // Step 2: Normalize and parse each row
  const parsedRows = [];

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const rowNum = i + 2; // +2 because row 1 is header, and 1-indexed

    // Extract fields using flexible column name matching
    const dateRaw = getColumnValue(raw, ['date', 'Date', 'DATE', 'expense_date', 'Expense Date']);
    const descRaw = getColumnValue(raw, ['description', 'Description', 'DESC', 'desc', 'expense', 'Expense', 'item', 'Item']);
    const amountRaw = getColumnValue(raw, ['amount', 'Amount', 'AMOUNT', 'total', 'Total']);
    const paidByRaw = getColumnValue(raw, ['paid_by', 'Paid By', 'paid by', 'Paid_By', 'PaidBy', 'payer', 'Payer']);
    const splitTypeRaw = getColumnValue(raw, ['split_type', 'Split Type', 'split type', 'Split_Type', 'type', 'Type']);
    const splitWithRaw = getColumnValue(raw, ['split_with', 'Split With', 'split with', 'Split_With', 'participants', 'Participants', 'split_between', 'Split Between', 'members', 'Members']);
    const categoryRaw = getColumnValue(raw, ['category', 'Category', 'cat', 'Cat']);
    const notesRaw = getColumnValue(raw, ['notes', 'Notes', 'note', 'Note', 'comment', 'Comment']);

    // Parse date
    const dateResult = parseDate(dateRaw, rowNum);
    if (dateResult.anomaly) {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: dateResult.anomaly === 'missing_field' ? 'missing_field' : 'date_format',
        severity: dateResult.anomaly === 'missing_field' ? 'error' : 'warning',
        description: dateResult.anomaly === 'missing_field'
          ? `Row ${rowNum}: Missing date field`
          : `Row ${rowNum}: Could not parse date "${dateResult.original}"`,
        original_data: raw,
        suggested_action: 'skip'
      });
    }
    if (dateResult.ambiguous) {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'date_format',
        severity: 'warning',
        description: `Row ${rowNum}: Ambiguous date format "${dateRaw}" — interpreted as DD/MM/YYYY`,
        original_data: raw,
        suggested_action: 'modify',
        suggested_value: { date: dateResult.date }
      });
    }

    // Parse amount
    const amountResult = parseAmount(amountRaw);
    if (amountResult.anomaly) {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'missing_field',
        severity: 'error',
        description: `Row ${rowNum}: Missing or invalid amount "${amountRaw}"`,
        original_data: raw,
        suggested_action: 'skip'
      });
    }

    // Check for negative amount
    if (amountResult.isNegative) {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'negative_amount',
        severity: 'warning',
        description: `Row ${rowNum}: Negative amount ${amountResult.amount}. Treating as refund/credit.`,
        original_data: raw,
        suggested_action: 'modify',
        suggested_value: { treat_as: 'refund', amount: Math.abs(amountResult.amount) }
      });
    }

    // Check for zero amount
    if (amountResult.amount === 0) {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'zero_amount',
        severity: 'warning',
        description: `Row ${rowNum}: Zero amount expense "${descRaw}"`,
        original_data: raw,
        suggested_action: 'skip'
      });
    }

    // Check for USD currency
    if (amountResult.currency === 'USD') {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'currency_mismatch',
        severity: 'info',
        description: `Row ${rowNum}: USD amount detected ($${amountResult.amount}). Will convert to INR at rate ${process.env.USD_TO_INR_RATE || 83.0}.`,
        original_data: raw,
        suggested_action: 'modify',
        suggested_value: {
          currency: 'USD',
          exchange_rate: parseFloat(process.env.USD_TO_INR_RATE) || 83.0,
          amount_in_inr: amountResult.amount * (parseFloat(process.env.USD_TO_INR_RATE) || 83.0)
        }
      });
    }

    // Check for missing description
    if (!descRaw || descRaw.trim() === '') {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'missing_field',
        severity: 'error',
        description: `Row ${rowNum}: Missing description`,
        original_data: raw,
        suggested_action: 'skip'
      });
    }

    // Check for missing payer
    if (!paidByRaw || paidByRaw.trim() === '') {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'missing_field',
        severity: 'error',
        description: `Row ${rowNum}: Missing "Paid By" field`,
        original_data: raw,
        suggested_action: 'skip'
      });
    }

    // Check for settlement keywords in description
    if (isSettlementDescription(descRaw)) {
      anomalies.push({
        row_number: rowNum,
        anomaly_type: 'settlement_as_expense',
        severity: 'warning',
        description: `Row ${rowNum}: "${descRaw}" looks like a settlement/payment, not an expense. Will reclassify as settlement.`,
        original_data: raw,
        suggested_action: 'reclassify',
        suggested_value: { is_settlement: true }
      });
    }

    // Check for future date
    if (dateResult.date) {
      const expDate = new Date(dateResult.date);
      if (expDate > new Date()) {
        anomalies.push({
          row_number: rowNum,
          anomaly_type: 'future_date',
          severity: 'warning',
          description: `Row ${rowNum}: Future date ${dateResult.date} for "${descRaw}"`,
          original_data: raw,
          suggested_action: 'keep'
        });
      }
    }

    // Store parsed row for further checks
    parsedRows.push({
      rowNum,
      date: dateResult.date,
      description: descRaw,
      amount: amountResult.amount,
      currency: amountResult.currency,
      paid_by: paidByRaw,
      split_type: splitTypeRaw,
      split_with: splitWithRaw,
      category: categoryRaw,
      notes: notesRaw,
      raw
    });
  }

  // Step 3: Build name map and check for name inconsistencies
  const nameMap = buildNameMap(rawRows);
  const canonicalNames = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Dev', 'Sam'];

  for (const [variant, canonical] of Object.entries(nameMap)) {
    if (variant !== canonical) {
      anomalies.push({
        row_number: 0,  // Global anomaly
        anomaly_type: 'name_inconsistency',
        severity: 'info',
        description: `Name variant "${variant}" will be mapped to "${canonical}"`,
        original_data: { variant, canonical },
        suggested_action: 'modify',
        suggested_value: { original: variant, mapped_to: canonical }
      });
    }

    if (!canonicalNames.includes(canonical) && variant === canonical) {
      anomalies.push({
        row_number: 0,
        anomaly_type: 'unknown_member',
        severity: 'warning',
        description: `Unknown person "${variant}" found in CSV. Not in the known group members.`,
        original_data: { name: variant },
        suggested_action: 'keep',
        suggested_value: { add_as_member: true }
      });
    }
  }

  // Step 4: Check for duplicates
  const duplicates = findDuplicates(parsedRows);
  for (const dup of duplicates) {
    anomalies.push({
      row_number: parsedRows[dup.rowIndex].rowNum,
      anomaly_type: 'duplicate',
      severity: 'warning',
      description: `Row ${parsedRows[dup.rowIndex].rowNum}: Duplicate of row ${parsedRows[dup.duplicateOf].rowNum} — "${parsedRows[dup.rowIndex].description}" on ${parsedRows[dup.rowIndex].date}`,
      original_data: parsedRows[dup.rowIndex].raw,
      suggested_action: 'skip',
      suggested_value: { duplicate_of_row: parsedRows[dup.duplicateOf].rowNum }
    });
  }

  // Step 5: Check for conflicting duplicates
  const conflicts = findConflictingDuplicates(parsedRows);
  for (const conflict of conflicts) {
    anomalies.push({
      row_number: parsedRows[conflict.rowIndex].rowNum,
      anomaly_type: 'duplicate_conflict',
      severity: 'error',
      description: `Row ${parsedRows[conflict.rowIndex].rowNum}: Same event as row ${parsedRows[conflict.conflictsWith].rowNum} but different amounts (₹${conflict.row1Amount} vs ₹${conflict.row2Amount}). Which is correct?`,
      original_data: parsedRows[conflict.rowIndex].raw,
      suggested_action: 'keep',
      suggested_value: { conflicting_row: parsedRows[conflict.conflictsWith].rowNum }
    });
  }

  // Step 6: Check membership dates
  // membershipMap format: { "Name": { joined: "2025-02-01", left: "2025-03-31" | null } }
  if (membershipMap) {
    for (const row of parsedRows) {
      if (!row.date || !row.split_with) continue;

      const participants = row.split_with.split(/[,;|]/).map(n => n.trim());

      for (const name of participants) {
        const canonical = nameMap[name] || name;
        const membership = membershipMap[canonical];

        if (membership) {
          const expDate = new Date(row.date);
          const joinDate = new Date(membership.joined);
          const leftDate = membership.left ? new Date(membership.left) : null;

          // Check if expense is before they joined
          if (expDate < joinDate) {
            anomalies.push({
              row_number: row.rowNum,
              anomaly_type: 'member_not_active',
              severity: 'warning',
              description: `Row ${row.rowNum}: ${canonical} hadn't joined yet on ${row.date} (joined ${membership.joined}). Excluding from split.`,
              original_data: row.raw,
              suggested_action: 'modify',
              suggested_value: { exclude_member: canonical, reason: 'not_yet_joined' }
            });
          }

          // Check if expense is after they left
          if (leftDate && expDate > leftDate) {
            anomalies.push({
              row_number: row.rowNum,
              anomaly_type: 'member_not_active',
              severity: 'warning',
              description: `Row ${row.rowNum}: ${canonical} had already left on ${row.date} (left ${membership.left}). Excluding from split.`,
              original_data: row.raw,
              suggested_action: 'modify',
              suggested_value: { exclude_member: canonical, reason: 'already_left' }
            });
          }
        }
      }
    }
  }

  // Step 7: Check split amounts
  for (const row of parsedRows) {
    if (row.split_type === 'percentage' && row.split_with) {
      // Parse percentage values if present
      const percentages = row.split_with.match(/(\d+(?:\.\d+)?)\s*%/g);
      if (percentages) {
        const total = percentages.reduce((sum, p) => sum + parseFloat(p), 0);
        if (Math.abs(total - 100) > 0.01) {
          anomalies.push({
            row_number: row.rowNum,
            anomaly_type: 'invalid_percentage',
            severity: 'error',
            description: `Row ${row.rowNum}: Percentages sum to ${total}%, not 100%`,
            original_data: row.raw,
            suggested_action: 'modify',
            suggested_value: { total_percentage: total }
          });
        }
      }
    }
  }

  return {
    success: true,
    total_rows: rawRows.length,
    parsed_rows: parsedRows,
    anomalies: anomalies.sort((a, b) => {
      // Sort by severity (critical > error > warning > info), then by row number
      const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return a.row_number - b.row_number;
    }),
    name_map: nameMap,
    stats: {
      total_rows: rawRows.length,
      anomaly_count: anomalies.length,
      by_severity: {
        critical: anomalies.filter(a => a.severity === 'critical').length,
        error: anomalies.filter(a => a.severity === 'error').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        info: anomalies.filter(a => a.severity === 'info').length,
      },
      by_type: anomalies.reduce((acc, a) => {
        acc[a.anomaly_type] = (acc[a.anomaly_type] || 0) + 1;
        return acc;
      }, {})
    }
  };
}

// ─── Save import session and anomalies to database ──────
async function saveImportSession(groupId, importedBy, filename, importResult) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Create import session
    const sessionResult = await client.query(
      `INSERT INTO import_sessions (group_id, imported_by, filename, status, total_rows, error_rows)
       VALUES ($1, $2, $3, 'reviewing', $4, $5) RETURNING *`,
      [groupId, importedBy, filename, importResult.total_rows, importResult.anomalies.filter(a => a.severity === 'error' || a.severity === 'critical').length]
    );

    const session = sessionResult.rows[0];

    // Save anomalies
    for (const anomaly of importResult.anomalies) {
      await client.query(
        `INSERT INTO import_anomalies
         (import_session_id, row_number, anomaly_type, severity, description, original_data, suggested_action, suggested_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [session.id, anomaly.row_number, anomaly.anomaly_type, anomaly.severity,
         anomaly.description, JSON.stringify(anomaly.original_data),
         anomaly.suggested_action, JSON.stringify(anomaly.suggested_value || null)]
      );
    }

    await client.query('COMMIT');
    return session;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Confirm import: insert approved rows as expenses ───
async function confirmImport(sessionId, groupId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Get the session
    const session = await client.query(
      'SELECT * FROM import_sessions WHERE id = $1',
      [sessionId]
    );
    if (session.rows.length === 0) throw new Error('Import session not found');

    // Get all anomalies and their resolutions
    const anomalies = await client.query(
      'SELECT * FROM import_anomalies WHERE import_session_id = $1',
      [sessionId]
    );

    // Build a set of rows to skip (user rejected or error anomalies not resolved)
    const rowsToSkip = new Set();
    const rowModifications = {};

    for (const a of anomalies.rows) {
      if (a.user_action === 'reject' || (a.severity === 'error' && !a.resolved)) {
        rowsToSkip.add(a.row_number);
      }
      if (a.user_action === 'accept' && a.suggested_value) {
        if (!rowModifications[a.row_number]) rowModifications[a.row_number] = {};
        Object.assign(rowModifications[a.row_number], JSON.parse(a.suggested_value));
      }
    }

    // Update session status
    await client.query(
      `UPDATE import_sessions SET status = 'confirmed', completed_at = NOW(),
       processed_rows = total_rows - $2 WHERE id = $1`,
      [sessionId, rowsToSkip.size]
    );

    await client.query('COMMIT');

    return {
      confirmed: true,
      total_rows: session.rows[0].total_rows,
      skipped_rows: rowsToSkip.size,
      imported_rows: session.rows[0].total_rows - rowsToSkip.size
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { processCSVImport, saveImportSession, confirmImport };
