# Shared Expenses App

A modern, full-stack application for managing shared expenses between flatmates, built to solve the "messy spreadsheet" problem.

## 🚀 Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, React Router, Axios, Lucide React
- **Backend**: Node.js, Express, Passport.js (Google OAuth), JWT
- **Database**: PostgreSQL (via Neon), raw SQL using `pg` (no ORM, for full control and explainability)

## 🛠️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- A Google Cloud Console project (for OAuth credentials)
- A Neon PostgreSQL database (or any local/hosted PostgreSQL instance)

### 2. Environment Variables

Create a `.env` file in the `server` directory based on `.env.example`:

```env
PORT=5000
NODE_ENV=development

# Database Connection (Get this from Neon Console)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Google OAuth Credentials (Get these from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# JWT Secrets
JWT_SECRET=super-secret-key
JWT_EXPIRES_IN=7d

# Frontend URL
CLIENT_URL=http://localhost:5173

# Exchange Rate (for multi-currency support)
USD_TO_INR_RATE=83.0
```

### 3. Initialize Database

Run the database initialization script to create all tables (Users, Groups, Expenses, Settlements, Import Sessions, etc.):

```bash
cd server
npm run db:init
```

### 4. Start the Application

Open two terminal windows:

**Terminal 1 (Backend Server):**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm install
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 📊 Core Features Implemented

1. **Google OAuth Login**: Secure, passwordless authentication.
2. **Membership-Aware Group Management**: Tracks when people join and leave, ensuring they aren't charged for expenses outside their tenancy (solves Sam's problem).
3. **Multi-Currency Support**: Automatically detects USD expenses and converts them to the group's base currency (solves Priya's problem).
4. **Greedy Debt Simplification Algorithm**: Calculates the minimum number of transactions needed to settle all debts in a group (solves Aisha's problem).
5. **Detailed Audit Trails**: Shows exactly how each user's balance is calculated, breaking down every expense they paid for or owe a share of (solves Rohan's problem).
6. **Robust CSV Import Engine**: Parses messy CSVs, detects 14 different types of data anomalies, and provides a review UI for manual resolution before importing (solves Meera's problem).

## 🕵️‍♂️ CSV Import Anomalies Handled
- Duplicate entries
- Conflicting duplicates (same event, different amounts)
- Negative amounts (refunds)
- Zero amounts
- Settlements logged as expenses
- Currency mismatches (USD vs INR)
- Future dates
- Inconsistent date formats
- Missing required fields
- Name inconsistencies (fuzzy matching)
- Unknown members
- Expense dates before member joined
- Expense dates after member left
- Invalid percentage splits (don't sum to 100%)
