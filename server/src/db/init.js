const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

// Database initialization script
// Reads schema.sql and executes it against the database
async function initDatabase() {
  try {
    console.log('🔄 Initializing database schema...');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    await pool.query(schema);

    console.log('Database schema initialized successfully');
    process.exit(0);
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}

initDatabase();
