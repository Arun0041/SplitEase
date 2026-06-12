const router = require('express').Router();
const multer = require('multer');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { processCSVImport, saveImportSession, confirmImport } = require('../services/importService');

// Configure multer for file upload (store in memory for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.use(authenticate);

// ─── POST /api/groups/:id/import ────────────────────────
// Upload a CSV, parse it, detect anomalies, and return the report
router.post('/groups/:id/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const groupId = req.params.id;

    // Fetch all members of this group and their join/leave dates
    // This is needed for the membership-aware anomaly checks
    const membersResult = await query(
      `SELECT u.name, gm.joined_at, gm.left_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [groupId]
    );

    const membershipMap = {};
    for (const m of membersResult.rows) {
      membershipMap[m.name] = {
        joined: m.joined_at,
        left: m.left_at
      };
    }

    // Process the CSV content
    const csvContent = req.file.buffer.toString('utf-8');
    const result = await processCSVImport(csvContent, groupId, req.user.id, membershipMap);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Save the import session and anomalies to DB for review
    const session = await saveImportSession(groupId, req.user.id, req.file.originalname, result);

    res.json({
      session_id: session.id,
      stats: result.stats,
      anomalies: result.anomalies,
      name_map: result.name_map
    });

  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message || 'Failed to process CSV import' });
  }
});

// ─── GET /api/groups/:id/import/:sessionId/anomalies ────
// Get all anomalies for a review session
router.get('/groups/:id/import/:sessionId/anomalies', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM import_anomalies
       WHERE import_session_id = $1
       ORDER BY CASE severity
         WHEN 'critical' THEN 1
         WHEN 'error' THEN 2
         WHEN 'warning' THEN 3
         WHEN 'info' THEN 4
         ELSE 5 END, row_number`,
      [req.params.sessionId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching anomalies:', err);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// ─── PUT /api/groups/:id/import/:sessionId/anomalies/:anomalyId ──
// Resolve an anomaly (accept suggestion, reject, or modify)
router.put('/groups/:id/import/:sessionId/anomalies/:anomalyId', async (req, res) => {
  try {
    const { user_action, user_value } = req.body; // action: 'accept', 'reject', 'modify'

    const result = await query(
      `UPDATE import_anomalies
       SET user_action = $1, user_value = $2, resolved = true
       WHERE id = $3 AND import_session_id = $4
       RETURNING *`,
      [user_action, JSON.stringify(user_value || null), req.params.anomalyId, req.params.sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Anomaly not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error resolving anomaly:', err);
    res.status(500).json({ error: 'Failed to resolve anomaly' });
  }
});

// ─── POST /api/groups/:id/import/:sessionId/confirm ─────
// Confirm the import and commit the valid data to the expenses tables
router.post('/groups/:id/import/:sessionId/confirm', async (req, res) => {
  try {
    // 1. Check if there are any unresolved CRITICAL or ERROR anomalies
    const unresolved = await query(
      `SELECT count(*) FROM import_anomalies
       WHERE import_session_id = $1 AND resolved = false
       AND severity IN ('error', 'critical')`,
      [req.params.sessionId]
    );

    if (parseInt(unresolved.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot confirm import. There are unresolved errors or critical anomalies. Please resolve them or choose to skip those rows.'
      });
    }

    // 2. Perform the confirmation and actual data insertion (placeholder logic handled in service)
    // NOTE: In a full implementation, this would read the parsed rows, apply the user's
    // resolutions, and insert into expenses and expense_splits tables.
    // For this assignment skeleton, we mark the session as confirmed.
    const confirmationResult = await confirmImport(req.params.sessionId, req.params.id);

    res.json(confirmationResult);
  } catch (err) {
    console.error('Error confirming import:', err);
    res.status(500).json({ error: 'Failed to confirm import' });
  }
});

module.exports = router;
