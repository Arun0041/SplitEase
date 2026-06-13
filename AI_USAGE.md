# AI Usage Log

**AI Tool Used**: Gemini 3.1 Pro (via Antigravity IDE framework)

## Key Prompts Used
- "Analyze the 5 persona requirements from the problem statement and map them to technical features."
- "Design a PostgreSQL schema that handles membership join/leave dates and multi-currency expenses without using an ORM."
- "Write a CSV parsing engine in Node.js that detects 12 different types of data anomalies without throwing errors, but instead flagging them for user review."
- "Generate a React frontend using Vite and Tailwind CSS to display the import anomaly report."

## Cases Where AI Was Wrong (And How It Was Fixed)

1. **AI Error**: Initially, the AI suggested using Prisma ORM for the database layer because it's "modern and type-safe".
   **Correction**: I realized the assignment evaluates the ability to explain every line of code. Prisma's abstraction would make it difficult to explain the underlying SQL during the live session. I directed the AI to rewrite the database layer using raw SQL (`pg` module) instead.

2. **AI Error**: When generating the balance calculation algorithm, the AI initially calculated debts globally for the entire group history.
   **Correction**: I caught that this violated Sam's requirement ("March electricity shouldn't affect my balance" since he joined in April). I corrected the AI to implement a membership-aware split calculation that checks `group_members.joined_at` against `expenses.expense_date`.

3. **AI Error**: For the CSV import, the AI originally wrote a script that automatically deleted duplicate rows and converted negative amounts to positive.
   **Correction**: This violated Meera's requirement ("I want to approve anything the app deletes or changes"). I instructed the AI to rewrite the importer to store anomalies in a database table (`import_anomalies`) and build a UI for manual review.
