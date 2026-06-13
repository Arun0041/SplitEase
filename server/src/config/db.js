const { Pool } = require('pg');
require('dotenv').config();

// Create a connection pool to Neon PostgreSQL
// Using a pool allows multiple concurrent queries without opening new connections each time
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false  // Required for Neon serverless PostgreSQL
  },
  max: 20,               // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10s to allow Neon serverless to cold-start without throwing timeout errors
});

// Test the connection on startup
pool.on('connect', () => {
  console.log('Connected to PostgreSQL (Neon)');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Helper: run a single query
const query = (text, params) => pool.query(text, params);

// Helper: get a client from the pool (for transactions)
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };
