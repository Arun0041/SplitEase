# Project Scope & Database Schema

## Anomaly Detection Strategy

The app is built to detect the following anomalies in the CSV data:
1. **Duplicate Entries**: Same expense logged twice.
2. **Conflicting Duplicates**: Same event logged with different amounts.
3. **Negative Amounts**: Negative values flagged as refunds/credits.
4. **Zero Amounts**: $0 expenses flagged to skip.
5. **Settlements as Expenses**: Payments disguised as expenses.
6. **Currency Mismatches**: USD amounts disguised as INR.
7. **Future Dates**: Dates in the future flagged for review.
8. **Inconsistent Date Formats**: Handles YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, etc.
9. **Missing Required Fields**: Blank amounts, descriptions, or payers.
10. **Name Inconsistencies**: Fuzzy matching to canonical names (e.g., Rohan S. -> Rohan).
11. **Unknown Members**: People not recognized in the group.
12. **Pre-join Expenses**: Expense before member joined.
13. **Post-leave Expenses**: Expense after member left.
14. **Invalid Percentage Splits**: Percentages don't sum to 100%.

*(Note: The exact final list of anomalies found in the `expenses_export.csv` will be documented here once the file is imported during the live session)*

## Database Schema

We chose to use raw SQL with PostgreSQL to maintain full control over the queries and ensure every line of code is explainable in the live session (no ORM magic).

### Tables
1. `users`: Stores all users (Google OAuth).
2. `groups`: Stores shared expense groups.
3. `group_members`: Tracks `joined_at` and `left_at` dates for membership-aware splits (Sam's requirement).
4. `expenses`: Stores individual expenses, with `currency` and `exchange_rate` for multi-currency support (Priya's requirement).
5. `expense_splits`: Tracks exactly how much each person owes for an expense (Rohan's requirement).
6. `settlements`: Stores explicit debt payments between members.
7. `import_sessions`: Tracks CSV import attempts.
8. `import_anomalies`: Stores detected anomalies for user review before importing (Meera's requirement).
