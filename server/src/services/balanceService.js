const { query } = require('../config/db');

/**
 * Balance Calculation Service
 *
 * Core algorithm:
 * For each expense, the payer is OWED by everyone else in the split.
 * For each split participant, they OWE their share (unless they are the payer).
 *
 * Net balance = total_paid - total_owed
 *   Positive = others owe you
 *   Negative = you owe others
 *
 * This is membership-aware: only members active on the expense date are included
 * in equal splits (Sam's requirement).
 */

// ─── Get net balances for all members of a group ────────
async function getGroupBalances(groupId) {
  // Get all expenses and their splits for this group
  const result = await query(
    `SELECT
       e.id as expense_id,
       e.paid_by,
       e.amount_in_base,
       e.description,
       e.expense_date,
       e.is_settlement,
       es.user_id as split_user_id,
       es.amount as split_amount
     FROM expenses e
     JOIN expense_splits es ON e.id = es.expense_id
     WHERE e.group_id = $1 AND e.is_settlement = false
     ORDER BY e.expense_date`,
    [groupId]
  );

  // Get all settlements
  const settlements = await query(
    `SELECT * FROM settlements WHERE group_id = $1`,
    [groupId]
  );

  // Calculate net balances
  // balances[userId] = net amount (positive = owed TO them, negative = they OWE)
  const balances = {};

  for (const row of result.rows) {
    const payerId = row.paid_by;
    const splitUserId = row.split_user_id;
    const splitAmount = parseFloat(row.split_amount);

    // Initialize if needed
    if (!balances[payerId]) balances[payerId] = 0;
    if (!balances[splitUserId]) balances[splitUserId] = 0;

    // The payer paid for this person's share
    // So split_user owes payer this amount
    if (splitUserId !== payerId) {
      balances[payerId] += splitAmount;       // Payer is owed
      balances[splitUserId] -= splitAmount;   // Split user owes
    }
  }

  // Apply settlements
  for (const s of settlements.rows) {
    const amount = parseFloat(s.amount);
    if (balances[s.paid_by] !== undefined) balances[s.paid_by] += amount;
    if (balances[s.paid_to] !== undefined) balances[s.paid_to] -= amount;
  }

  // Get user details for all participants
  const userIds = Object.keys(balances);
  if (userIds.length === 0) return [];

  const users = await query(
    `SELECT id, name, email, avatar_url FROM users WHERE id = ANY($1::int[])`,
    [userIds]
  );

  const userMap = {};
  for (const u of users.rows) {
    userMap[u.id] = u;
  }

  // Build response
  return userIds.map(userId => ({
    user_id: parseInt(userId),
    name: userMap[userId]?.name || 'Unknown',
    email: userMap[userId]?.email || '',
    avatar_url: userMap[userId]?.avatar_url || null,
    balance: Math.round(balances[userId] * 100) / 100  // Round to 2 decimal places
  })).sort((a, b) => a.balance - b.balance);
}

// ─── Get detailed balance breakdown for a specific user (Rohan's audit trail) ──
async function getUserBalanceBreakdown(groupId, userId) {
  // Get all expenses where this user is either the payer or in the split
  const result = await query(
    `SELECT
       e.id as expense_id,
       e.paid_by,
       e.description,
       e.amount,
       e.currency,
       e.exchange_rate,
       e.amount_in_base,
       e.expense_date,
       e.split_type,
       e.category,
       payer.name as paid_by_name,
       es.amount as my_share,
       es.percentage,
       es.shares
     FROM expenses e
     JOIN expense_splits es ON e.id = es.expense_id AND es.user_id = $2
     JOIN users payer ON e.paid_by = payer.id
     WHERE e.group_id = $1 AND e.is_settlement = false
     ORDER BY e.expense_date DESC`,
    [groupId, userId]
  );

  // Categorize: expenses I paid for others vs expenses others paid for me
  let totalPaid = 0;      // Total I paid out
  let totalOwed = 0;      // Total I owe others
  const breakdown = [];

  for (const row of result.rows) {
    const myShare = parseFloat(row.my_share);
    const isPayer = row.paid_by === parseInt(userId);

    if (isPayer) {
      // I paid for this expense — others owe me (total - my share)
      const owedToMe = parseFloat(row.amount_in_base) - myShare;
      totalPaid += owedToMe;
      breakdown.push({
        ...row,
        type: 'paid',
        net_effect: owedToMe,
        explanation: `You paid ₹${row.amount_in_base} total, your share was ₹${myShare}, so others owe you ₹${owedToMe.toFixed(2)}`
      });
    } else {
      // Someone else paid — I owe them my share
      totalOwed += myShare;
      breakdown.push({
        ...row,
        type: 'owe',
        net_effect: -myShare,
        explanation: `${row.paid_by_name} paid ₹${row.amount_in_base}, your share is ₹${myShare.toFixed(2)}`
      });
    }
  }

  // Get settlements involving this user
  const settlementsResult = await query(
    `SELECT s.*, 
       payer.name as paid_by_name, 
       receiver.name as paid_to_name
     FROM settlements s
     JOIN users payer ON s.paid_by = payer.id
     JOIN users receiver ON s.paid_to = receiver.id
     WHERE s.group_id = $1 AND (s.paid_by = $2 OR s.paid_to = $2)
     ORDER BY s.settlement_date DESC`,
    [groupId, userId]
  );

  let settlementNet = 0;
  for (const s of settlementsResult.rows) {
    const amount = parseFloat(s.amount);
    if (s.paid_by === parseInt(userId)) settlementNet += amount;
    else settlementNet -= amount;
  }

  return {
    user_id: parseInt(userId),
    total_paid_for_others: Math.round(totalPaid * 100) / 100,
    total_owed_to_others: Math.round(totalOwed * 100) / 100,
    settlements_net: Math.round(settlementNet * 100) / 100,
    net_balance: Math.round((totalPaid - totalOwed + settlementNet) * 100) / 100,
    expenses: breakdown,
    settlements: settlementsResult.rows
  };
}

// ─── Simplify debts (Aisha's "who pays whom, how much, done") ──
// Uses the greedy algorithm to minimize number of transactions
function simplifyDebts(balances) {
  // Filter to only people with non-zero balances
  const debtors = [];   // People who owe (negative balance)
  const creditors = []; // People who are owed (positive balance)

  for (const b of balances) {
    if (b.balance < -0.01) {
      debtors.push({ ...b, remaining: Math.abs(b.balance) });
    } else if (b.balance > 0.01) {
      creditors.push({ ...b, remaining: b.balance });
    }
  }

  // Sort: largest debts/credits first for optimal matching
  debtors.sort((a, b) => b.remaining - a.remaining);
  creditors.sort((a, b) => b.remaining - a.remaining);

  const transactions = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].remaining, creditors[j].remaining);

    if (amount > 0.01) {
      transactions.push({
        from: { user_id: debtors[i].user_id, name: debtors[i].name },
        to: { user_id: creditors[j].user_id, name: creditors[j].name },
        amount: Math.round(amount * 100) / 100
      });
    }

    debtors[i].remaining -= amount;
    creditors[j].remaining -= amount;

    if (debtors[i].remaining < 0.01) i++;
    if (creditors[j].remaining < 0.01) j++;
  }

  return transactions;
}

module.exports = { getGroupBalances, getUserBalanceBreakdown, simplifyDebts };
