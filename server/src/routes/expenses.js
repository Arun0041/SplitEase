const router = require('express').Router();
const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── GET /api/groups/:groupId/expenses ──────────────────
// List all expenses for a group, with payer details
router.get('/groups/:groupId/expenses', async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50, category, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clause based on filters
    let whereClause = 'WHERE e.group_id = $1';
    const params = [groupId];
    let paramIndex = 2;

    if (category) {
      whereClause += ` AND e.category = $${paramIndex++}`;
      params.push(category);
    }
    if (start_date) {
      whereClause += ` AND e.expense_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ` AND e.expense_date <= $${paramIndex++}`;
      params.push(end_date);
    }

    const result = await query(
      `SELECT e.*, u.name as paid_by_name, u.avatar_url as paid_by_avatar
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       ${whereClause}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const countResult = await query(
      `SELECT COUNT(*) FROM expenses e ${whereClause}`,
      params
    );

    res.json({
      expenses: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// ─── GET /api/expenses/:id ─────────────────────────────
// Get single expense with all its splits (Rohan's audit trail)
router.get('/expenses/:id', async (req, res) => {
  try {
    const expenseResult = await query(
      `SELECT e.*, u.name as paid_by_name, u.avatar_url as paid_by_avatar
       FROM expenses e
       JOIN users u ON e.paid_by = u.id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Get all splits with user names
    const splitsResult = await query(
      `SELECT es.*, u.name as user_name, u.email as user_email
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1
       ORDER BY u.name`,
      [req.params.id]
    );

    res.json({
      ...expenseResult.rows[0],
      splits: splitsResult.rows
    });
  } catch (err) {
    console.error('Error fetching expense:', err);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// ─── POST /api/groups/:groupId/expenses ─────────────────
// Create a new expense with splits
// Supports: equal, exact, percentage, shares split types
router.post('/groups/:groupId/expenses', async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { groupId } = req.params;
    const {
      description, amount, currency, exchange_rate,
      expense_date, split_type, category, notes,
      is_settlement, paid_by, splits
    } = req.body;

    // Validation
    if (!description || !amount || !expense_date || !split_type) {
      return res.status(400).json({ error: 'description, amount, expense_date, and split_type are required' });
    }

    if (!['equal', 'exact', 'percentage', 'shares'].includes(split_type)) {
      return res.status(400).json({ error: 'split_type must be: equal, exact, percentage, or shares' });
    }

    const paidBy = paid_by || req.user.id;
    const expCurrency = currency || 'INR';
    const expRate = parseFloat(exchange_rate) || (expCurrency === 'USD' ? parseFloat(process.env.USD_TO_INR_RATE) || 83.0 : 1.0);
    const amountInBase = parseFloat(amount) * expRate;

    // Insert the expense
    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, paid_by, description, amount, currency, exchange_rate,
       amount_in_base, expense_date, split_type, category, notes, is_settlement)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [groupId, paidBy, description, amount, expCurrency, expRate,
       amountInBase, expense_date, split_type, category || null, notes || null, is_settlement || false]
    );

    const expense = expenseResult.rows[0];

    // Calculate and insert splits based on split_type
    let splitEntries = [];

    if (split_type === 'equal') {
      // Get active members at the expense date if no splits provided
      let memberIds;
      if (splits && splits.length > 0) {
        memberIds = splits.map(s => s.user_id);
      } else {
        // Get members who were active on the expense date
        const membersResult = await client.query(
          `SELECT user_id FROM group_members
           WHERE group_id = $1 AND joined_at <= $2 AND (left_at IS NULL OR left_at >= $2)`,
          [groupId, expense_date]
        );
        memberIds = membersResult.rows.map(m => m.user_id);
      }

      const splitAmount = Math.round((amountInBase / memberIds.length) * 100) / 100;
      // Handle rounding: last person gets the remainder
      const remainder = amountInBase - (splitAmount * memberIds.length);

      splitEntries = memberIds.map((userId, idx) => ({
        user_id: userId,
        amount: idx === memberIds.length - 1 ? splitAmount + remainder : splitAmount,
        percentage: null,
        shares: null
      }));

    } else if (split_type === 'exact') {
      if (!splits || splits.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'splits array is required for exact split type' });
      }
      splitEntries = splits.map(s => ({
        user_id: s.user_id,
        amount: parseFloat(s.amount) * expRate,  // Convert if needed
        percentage: null,
        shares: null
      }));

    } else if (split_type === 'percentage') {
      if (!splits || splits.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'splits array is required for percentage split type' });
      }
      const totalPercent = splits.reduce((sum, s) => sum + parseFloat(s.percentage), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Percentages must sum to 100. Got: ${totalPercent}` });
      }
      splitEntries = splits.map(s => ({
        user_id: s.user_id,
        amount: Math.round((amountInBase * parseFloat(s.percentage) / 100) * 100) / 100,
        percentage: parseFloat(s.percentage),
        shares: null
      }));

    } else if (split_type === 'shares') {
      if (!splits || splits.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'splits array is required for shares split type' });
      }
      const totalShares = splits.reduce((sum, s) => sum + parseFloat(s.shares), 0);
      splitEntries = splits.map(s => ({
        user_id: s.user_id,
        amount: Math.round((amountInBase * parseFloat(s.shares) / totalShares) * 100) / 100,
        percentage: null,
        shares: parseFloat(s.shares)
      }));
    }

    // Insert all split entries
    for (const split of splitEntries) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, shares)
         VALUES ($1, $2, $3, $4, $5)`,
        [expense.id, split.user_id, split.amount, split.percentage, split.shares]
      );
    }

    await client.query('COMMIT');

    // Return expense with splits
    const fullExpense = await query(
      `SELECT e.*, u.name as paid_by_name FROM expenses e
       JOIN users u ON e.paid_by = u.id WHERE e.id = $1`,
      [expense.id]
    );
    const fullSplits = await query(
      `SELECT es.*, u.name as user_name FROM expense_splits es
       JOIN users u ON es.user_id = u.id WHERE es.expense_id = $1`,
      [expense.id]
    );

    res.status(201).json({ ...fullExpense.rows[0], splits: fullSplits.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating expense:', err);
    res.status(500).json({ error: 'Failed to create expense' });
  } finally {
    client.release();
  }
});

// ─── PUT /api/expenses/:id ──────────────────────────────
// Update an expense and its splits
router.put('/expenses/:id', async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { description, amount, currency, exchange_rate, expense_date,
            split_type, category, notes, splits } = req.body;

    const expCurrency = currency || 'INR';
    const expRate = parseFloat(exchange_rate) || (expCurrency === 'USD' ? parseFloat(process.env.USD_TO_INR_RATE) || 83.0 : 1.0);
    const amountInBase = amount ? parseFloat(amount) * expRate : undefined;

    // Update expense
    const result = await client.query(
      `UPDATE expenses SET
       description = COALESCE($1, description),
       amount = COALESCE($2, amount),
       currency = COALESCE($3, currency),
       exchange_rate = COALESCE($4, exchange_rate),
       amount_in_base = COALESCE($5, amount_in_base),
       expense_date = COALESCE($6, expense_date),
       split_type = COALESCE($7, split_type),
       category = COALESCE($8, category),
       notes = COALESCE($9, notes),
       updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [description, amount, expCurrency, expRate, amountInBase,
       expense_date, split_type, category, notes, req.params.id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Expense not found' });
    }

    // If splits provided, delete old and insert new
    if (splits && splits.length > 0) {
      await client.query('DELETE FROM expense_splits WHERE expense_id = $1', [req.params.id]);

      for (const split of splits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, amount, percentage, shares)
           VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, split.user_id, split.amount, split.percentage || null, split.shares || null]
        );
      }
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating expense:', err);
    res.status(500).json({ error: 'Failed to update expense' });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/expenses/:id ───────────────────────────
// Delete an expense and its splits (cascade)
router.delete('/expenses/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
