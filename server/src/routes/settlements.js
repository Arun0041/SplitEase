const router = require('express').Router();
const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { getGroupBalances, getUserBalanceBreakdown, simplifyDebts } = require('../services/balanceService');

router.use(authenticate);

// ─── GET /api/groups/:id/balances ───────────────────────
// Get net balances for all group members
router.get('/groups/:id/balances', async (req, res) => {
  try {
    const balances = await getGroupBalances(req.params.id);
    res.json(balances);
  } catch (err) {
    console.error('Error calculating balances:', err);
    res.status(500).json({ error: 'Failed to calculate balances' });
  }
});

// ─── GET /api/groups/:id/balances/:userId ───────────────
// Get detailed balance breakdown for a specific user (Rohan's audit trail)
router.get('/groups/:id/balances/:userId', async (req, res) => {
  try {
    const breakdown = await getUserBalanceBreakdown(req.params.id, req.params.userId);
    res.json(breakdown);
  } catch (err) {
    console.error('Error getting balance breakdown:', err);
    res.status(500).json({ error: 'Failed to get balance breakdown' });
  }
});

// ─── GET /api/groups/:id/simplified-debts ───────────────
// Get simplified "who pays whom" (Aisha's one-number-per-person)
router.get('/groups/:id/simplified-debts', async (req, res) => {
  try {
    const balances = await getGroupBalances(req.params.id);
    const transactions = simplifyDebts(balances);
    res.json({ balances, transactions });
  } catch (err) {
    console.error('Error simplifying debts:', err);
    res.status(500).json({ error: 'Failed to simplify debts' });
  }
});

// ─── GET /api/groups/:id/settlements ────────────────────
// List all settlements for a group
router.get('/groups/:id/settlements', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, 
         payer.name as paid_by_name, payer.avatar_url as paid_by_avatar,
         receiver.name as paid_to_name, receiver.avatar_url as paid_to_avatar
       FROM settlements s
       JOIN users payer ON s.paid_by = payer.id
       JOIN users receiver ON s.paid_to = receiver.id
       WHERE s.group_id = $1
       ORDER BY s.settlement_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching settlements:', err);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

// ─── POST /api/groups/:id/settlements ───────────────────
// Record a settlement (payment between members)
router.post('/groups/:id/settlements', async (req, res) => {
  try {
    const { paid_by, paid_to, amount, settlement_date, notes } = req.body;

    if (!paid_by || !paid_to || !amount) {
      return res.status(400).json({ error: 'paid_by, paid_to, and amount are required' });
    }

    if (paid_by === paid_to) {
      return res.status(400).json({ error: 'Cannot settle with yourself' });
    }

    const result = await query(
      `INSERT INTO settlements (group_id, paid_by, paid_to, amount, settlement_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, paid_by, paid_to, amount, settlement_date || new Date().toISOString().split('T')[0], notes || null]
    );

    // Get names for response
    const settlement = result.rows[0];
    const users = await query(
      'SELECT id, name FROM users WHERE id = ANY($1::int[])',
      [[paid_by, paid_to]]
    );
    const userMap = {};
    users.rows.forEach(u => { userMap[u.id] = u.name; });

    res.status(201).json({
      ...settlement,
      paid_by_name: userMap[paid_by],
      paid_to_name: userMap[paid_to]
    });
  } catch (err) {
    console.error('Error recording settlement:', err);
    res.status(500).json({ error: 'Failed to record settlement' });
  }
});

module.exports = router;
