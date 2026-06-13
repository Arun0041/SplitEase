# Shared Expenses App

A full-stack app for tracking shared expenses between flatmates — built to replace a messy spreadsheet with proper data validation, multi-currency support, and clear settlement calculations.

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 19 + Vite + Tailwind CSS v4 |
| Backend   | Node.js + Express |
| Database  | PostgreSQL (Neon) |
| Auth      | Google OAuth 2.0 + JWT |
| DB Client | `pg` (raw SQL, no ORM) |

## Setup Guide

### Step 1: Create a PostgreSQL Database

Go to [neon.tech](https://neon.tech) and create a free database. Copy the connection string — it looks like:
```
postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
```

### Step 2: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
4. Application type: **Web application**
5. Add these URIs:
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
6. Copy the **Client ID** and **Client Secret**

### Step 3: Configure Environment Variables

```bash
cd server
copy .env.example .env
```

Open `server/.env` and fill in your values:
```env
DATABASE_URL=your-neon-connection-string
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=any-random-string-here
```

### Step 4: Initialize the Database

```bash
cd server
npm install
npm run db:init
```

This creates all 8 tables (users, groups, group_members, expenses, expense_splits, settlements, import_sessions, import_anomalies).

### Step 5: Start the App

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev
```

The app will be at **http://localhost:5173**.

---

## How It Works

### CSV Import Engine

The import engine parses `expenses_export.csv` and detects **16 types of data anomalies**:

| # | Anomaly | Example from CSV |
|---|---------|-----------------|
| 1 | Duplicate entry | Row 6: "dinner - marina bites" = Row 5 |
| 2 | Conflicting duplicate | Row 25: Thalassa dinner ₹2450 vs Row 24: ₹2400 |
| 3 | Missing field | Row 13: "paid_by" is blank |
| 4 | Negative amount | Row 26: -$30 parasailing refund |
| 5 | Zero amount | Row 31: ₹0 Swiggy order |
| 6 | Settlement as expense | Row 14: "Rohan paid Aisha back" |
| 7 | USD currency | Row 20: $540 Goa villa booking |
| 8 | Missing currency | Row 28: currency column blank |
| 9 | Unparseable date | — |
| 10 | Ambiguous date | Row 34: "04/05/2026" — April 5 or May 4? |
| 11 | Future date | — |
| 12 | Member not active | Row 36: Meera listed but she left March 31 |
| 13 | Unknown member | Row 23: "Dev's friend Kabir" |
| 14 | Name inconsistency | Row 9: "priya" → "Priya", Row 11: "Priya S" → "Priya" |
| 15 | Invalid percentages | Row 15: 30+30+30+20 = 110% |
| 16 | Split type mismatch | Row 42: type="equal" but details have ratios |

### Balance Calculation

- Net balance = total you paid for others − total others paid for you
- The **Greedy Algorithm** minimizes settlement transactions (Aisha's requirement)
- **Audit trail** shows exactly which expenses make up each person's balance (Rohan's requirement)
- **Membership-aware**: only charges people who were in the group on the expense date (Sam's requirement)
- **Multi-currency**: USD expenses are converted at a configurable rate (Priya's requirement)

## Project Structure

```
├── server/
│   ├── src/
│   │   ├── config/         # db.js, passport.js
│   │   ├── db/             # schema.sql, init.js, expenses_export.csv
│   │   ├── middleware/     # auth.js (JWT verification)
│   │   ├── routes/         # auth, groups, expenses, settlements, import
│   │   ├── services/       # balanceService.js, importService.js
│   │   └── index.js        # Express server entry point
│   └── .env.example
├── client/
│   └── src/
│       ├── components/     # Layout.jsx
│       ├── context/        # AuthContext.jsx
│       ├── lib/            # axios.js
│       └── pages/          # Login, Dashboard, GroupDetail, ImportCSV
├── DECISIONS.md            # Architecture decision log
├── SCOPE.md                # Anomaly detection strategy
├── AI_USAGE.md             # AI usage documentation
└── README.md
```
