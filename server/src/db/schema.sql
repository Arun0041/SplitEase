-- =============================================
-- Shared Expenses App - Database Schema
-- =============================================

-- Users table: stores all app users (linked via Google OAuth)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Groups table: a shared expense group (e.g., "Flat Expenses")
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_currency VARCHAR(3) DEFAULT 'INR',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Group Members: tracks who is in a group and WHEN (join/leave dates)
-- This is critical for Sam's requirement: membership-aware splits
CREATE TABLE IF NOT EXISTS group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL,
    left_at DATE,  -- NULL means still active
    role VARCHAR(20) DEFAULT 'member', -- 'admin' or 'member'
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(group_id, user_id, joined_at)
);

-- Expenses: every shared expense or cost
-- currency + exchange_rate + amount_in_base handles Priya's multi-currency requirement
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    paid_by INTEGER REFERENCES users(id),
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    exchange_rate DECIMAL(10, 4) DEFAULT 1.0,
    amount_in_base DECIMAL(12, 2) NOT NULL,  -- Always in group's default currency (INR)
    expense_date DATE NOT NULL,
    split_type VARCHAR(20) NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
    category VARCHAR(100),
    notes TEXT,
    is_settlement BOOLEAN DEFAULT FALSE,  -- Distinguishes settlements logged as expenses
    import_id INTEGER,  -- Links to import_sessions if imported from CSV
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Expense Splits: how each expense is divided among members
-- This is critical for Rohan's requirement: traceable per-person breakdowns
CREATE TABLE IF NOT EXISTS expense_splits (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(12, 2) NOT NULL,  -- The actual amount this user owes (in base currency)
    percentage DECIMAL(5, 2),  -- For percentage splits
    shares DECIMAL(5, 2),  -- For share/ratio splits
    created_at TIMESTAMP DEFAULT NOW()
);

-- Settlements: explicit debt payments between members
CREATE TABLE IF NOT EXISTS settlements (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    paid_by INTEGER REFERENCES users(id),  -- Who paid
    paid_to INTEGER REFERENCES users(id),  -- Who received
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    settlement_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Import Sessions: tracks each CSV import attempt
CREATE TABLE IF NOT EXISTS import_sessions (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    imported_by INTEGER REFERENCES users(id),
    filename VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'confirmed', 'cancelled')),
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    error_rows INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Import Anomalies: every data problem detected during CSV import
-- This is critical for Meera's requirement: review before delete/change
CREATE TABLE IF NOT EXISTS import_anomalies (
    id SERIAL PRIMARY KEY,
    import_session_id INTEGER REFERENCES import_sessions(id) ON DELETE CASCADE,
    row_number INTEGER,
    anomaly_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    description TEXT NOT NULL,
    original_data JSONB,  -- The raw CSV row data
    suggested_action VARCHAR(50),  -- 'skip', 'modify', 'keep', 'merge', 'reclassify'
    suggested_value JSONB,  -- What we suggest changing it to
    user_action VARCHAR(50),  -- What the user decided: 'accept', 'reject', 'modify'
    user_value JSONB,  -- If user modified, what they chose
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_dates ON group_members(group_id, joined_at, left_at);
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_user ON expense_splits(user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_import_anomalies_session ON import_anomalies(import_session_id);
