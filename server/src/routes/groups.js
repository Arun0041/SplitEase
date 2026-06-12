const router = require('express').Router();
const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// All group routes require authentication
router.use(authenticate);

// ─── GET /api/groups ────────────────────────────────────
// List all groups the current user is a member of
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT g.*, gm.role, gm.joined_at, gm.left_at,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND left_at IS NULL) as active_members
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id AND gm.user_id = $1
       ORDER BY g.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// ─── POST /api/groups ───────────────────────────────────
// Create a new group and add the creator as admin
router.post('/', async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { name, description, default_currency } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Create the group
    const groupResult = await client.query(
      `INSERT INTO groups (name, description, default_currency, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), description || null, default_currency || 'INR', req.user.id]
    );

    const group = groupResult.rows[0];

    // Add creator as admin member
    await client.query(
      `INSERT INTO group_members (group_id, user_id, joined_at, role)
       VALUES ($1, $2, $3, 'admin')`,
      [group.id, req.user.id, new Date().toISOString().split('T')[0]]
    );

    await client.query('COMMIT');
    res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
});

// ─── GET /api/groups/:id ────────────────────────────────
// Get group details including all members (current and past)
router.get('/:id', async (req, res) => {
  try {
    // Verify user is a member of this group
    const memberCheck = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get group details
    const groupResult = await query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get all members with their user details
    const membersResult = await query(
      `SELECT gm.*, u.name, u.email, u.avatar_url
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [req.params.id]
    );

    res.json({
      ...groupResult.rows[0],
      members: membersResult.rows
    });
  } catch (err) {
    console.error('Error fetching group:', err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// ─── PUT /api/groups/:id ────────────────────────────────
// Update group details (admin only)
router.put('/:id', async (req, res) => {
  try {
    // Check if user is admin
    const adminCheck = await query(
      "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'",
      [req.params.id, req.user.id]
    );
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can update the group' });
    }

    const { name, description, default_currency } = req.body;
    const result = await query(
      `UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description),
       default_currency = COALESCE($3, default_currency), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, description, default_currency, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating group:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// ─── POST /api/groups/:id/members ───────────────────────
// Add a member to the group
// Requires: user_id (or email to find/create user), joined_at
router.post('/:id/members', async (req, res) => {
  try {
    const { user_id, email, name, joined_at } = req.body;
    const groupId = req.params.id;

    let targetUserId = user_id;

    // If email provided instead of user_id, find or create the user
    if (!targetUserId && email) {
      let userResult = await query('SELECT id FROM users WHERE email = $1', [email]);

      if (userResult.rows.length === 0) {
        // Create a placeholder user (they can link Google later)
        userResult = await query(
          'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
          [email, name || email.split('@')[0]]
        );
      }
      targetUserId = userResult.rows[0].id;
    }

    if (!targetUserId) {
      return res.status(400).json({ error: 'user_id or email is required' });
    }

    // Check if already an active member
    const existing = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2 AND left_at IS NULL',
      [groupId, targetUserId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User is already an active member of this group' });
    }

    const joinDate = joined_at || new Date().toISOString().split('T')[0];
    const result = await query(
      `INSERT INTO group_members (group_id, user_id, joined_at)
       VALUES ($1, $2, $3) RETURNING *`,
      [groupId, targetUserId, joinDate]
    );

    // Get user details for response
    const userDetail = await query(
      'SELECT name, email, avatar_url FROM users WHERE id = $1',
      [targetUserId]
    );

    res.status(201).json({ ...result.rows[0], ...userDetail.rows[0] });
  } catch (err) {
    console.error('Error adding member:', err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// ─── PUT /api/groups/:id/members/:memberId ──────────────
// Update a member (e.g., set leave date — Meera moved out end of March)
router.put('/:id/members/:memberId', async (req, res) => {
  try {
    const { left_at, role } = req.body;

    const result = await query(
      `UPDATE group_members
       SET left_at = COALESCE($1, left_at), role = COALESCE($2, role)
       WHERE id = $3 AND group_id = $4 RETURNING *`,
      [left_at, role, req.params.memberId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating member:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// ─── DELETE /api/groups/:id ─────────────────────────────
// Delete a group (admin only)
router.delete('/:id', async (req, res) => {
  try {
    const adminCheck = await query(
      "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'",
      [req.params.id, req.user.id]
    );
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only admins can delete the group' });
    }

    await query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    console.error('Error deleting group:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

module.exports = router;
