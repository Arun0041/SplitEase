# Decision Log

## 1. Raw SQL vs ORM
**Options Considered**: Prisma ORM, Sequelize, Raw SQL (node-postgres)
**Decision**: Raw SQL (node-postgres)
**Why**: The assignment evaluates my ability to understand and explain every line of code submitted. Using an ORM obscures the actual database operations behind abstractions. By writing raw SQL, I can easily trace and explain the exact logic used for complex operations like balance calculation and multi-currency handling during the live session.

## 2. Frontend / Backend Architecture
**Options Considered**: Next.js Full Stack, React (Vite) + Express Backend
**Decision**: React (Vite) + Express Backend (Separate Repositories/Folders)
**Why**: Keeps the concerns strictly separated. Building the CSV parsing and anomaly detection engine in a dedicated Express backend allows for a cleaner REST API design that the React frontend simply consumes.

## 3. CSV Import Strategy
**Options Considered**: 
- Silent automatic fixing of anomalies
- Block import on any error
- Parse -> Surface Anomalies -> User Review -> Import
**Decision**: Parse -> Surface Anomalies -> User Review -> Import
**Why**: Direct response to Meera's requirement ("I want to approve anything the app deletes or changes"). This three-step process stores the anomalies in the database and provides a UI for the user to resolve them before the data hits the main `expenses` table.

## 4. Multi-Currency Implementation
**Options Considered**: 
- Fetch live historical exchange rates via API
- Static configurable exchange rate for the trip
**Decision**: Static configurable exchange rate (via `.env`)
**Why**: Satisfies Priya's requirement without introducing a dependency on a external third-party API that could break or rate-limit during the demo. Every expense stores its original currency, the exchange rate applied, and the computed base currency (INR) amount.

## 5. Balance Calculation Algorithm
**Options Considered**: 
- Calculate debts on the fly
- Store rolling balances
**Decision**: Calculate net balances on the fly, then apply Greedy Algorithm for simplification.
**Why**: Calculating on the fly ensures accuracy when historical expenses are edited or deleted. Applying the Greedy Algorithm satisfies Aisha's requirement ("one number per person") by matching the largest debtors with the largest creditors to minimize total transactions.
