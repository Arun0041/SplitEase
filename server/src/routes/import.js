const router = require('express').Router();
const multer = require('multer');
const { query, getClient } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { processCSVImport, saveImportSession, confirmImport } = require('../services/importService');

// Store uploaded file in memory — we read it once and discard
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.use(authenticate);

// POST /api/groups/:id/import — upload CSV, run analysis, return anomalies
router.post('/groups/:id/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const groupId = req.params.id;

    // Build membership map from group_members table
    const membersResult = await query(
      `SELECT u.name, gm.joined_at, gm.left_at
       FROM group_members gm JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [groupId]
    );

    const membershipMap = {};
    for (const m of membersResult.rows) {
      membershipMap[m.name] = { joined: m.joined_at, left: m.left_at };
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const result = await processCSVImport(csvContent, groupId, req.user.id, membershipMap);

    if (!result.success) return res.status(400).json(result);

    // Save to database so the user can review anomalies before confirming
    const session = await saveImportSession(groupId, req.user.id, req.file.originalname, result, query, getClient);

    const dbAnomalies = await query(
      `SELECT * FROM import_anomalies WHERE import_session_id = $1
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END, row_number`,
      [session.id]
    );

    res.json({
      session_id: session.id,
      stats: result.stats,
      anomalies: dbAnomalies.rows,
      name_map: result.name_map
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message || 'Failed to process CSV' });
  }
});

// GET /api/groups/:id/import/:sessionId/anomalies — get anomalies for review
router.get('/groups/:id/import/:sessionId/anomalies', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM import_anomalies WHERE import_session_id = $1
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END, row_number`,
      [req.params.sessionId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching anomalies:', err);
    res.status(500).json({ error: 'Failed to fetch anomalies' });
  }
});

// PUT /api/groups/:id/import/:sessionId/anomalies/:anomalyId — resolve one anomaly
router.put('/groups/:id/import/:sessionId/anomalies/:anomalyId', async (req, res) => {
  try {
    const { user_action, user_value } = req.body;
    const result = await query(
      `UPDATE import_anomalies SET user_action = $1, user_value = $2, resolved = true
       WHERE id = $3 AND import_session_id = $4 RETURNING *`,
      [user_action, JSON.stringify(user_value || null), req.params.anomalyId, req.params.sessionId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Anomaly not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error resolving anomaly:', err);
    res.status(500).json({ error: 'Failed to resolve anomaly' });
  }
});

// POST /api/groups/:id/import/:sessionId/confirm — finalize the import
router.post('/groups/:id/import/:sessionId/confirm', async (req, res) => {
  try {
    // Block if there are unresolved errors
    const unresolved = await query(
      `SELECT count(*) FROM import_anomalies
       WHERE import_session_id = $1 AND resolved = false AND severity IN ('error', 'critical')`,
      [req.params.sessionId]
    );
    if (parseInt(unresolved.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Please resolve all errors before confirming.' });
    }

    const result = await confirmImport(req.params.sessionId, req.params.id, query, getClient);
    res.json(result);
  } catch (err) {
    console.error('Confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm import' });
  }
});

module.exports = router;
