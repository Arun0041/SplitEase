# Project Scope & Database Schema

## Anomaly Log

Based on the required data import of `expenses_export.csv`, our import engine detects and surfaces 16 specific data problems. Each problem is evaluated and assigned a severity, and the user must review and decide how to handle it before the import completes. 

Here is the log of every data problem found in the CSV and how it is handled:

| # | Anomaly Type | Example found in CSV | Severity | Policy / How Handled |
|---|-------------|----------------------|----------|-----------------------|
| 1 | **Duplicate entry** | Row 6: "dinner - marina bites" is identical to Row 5 | Warning | Flagged to user. Suggested action: **Skip Row**. |
| 2 | **Conflicting duplicate** | Row 25: Thalassa dinner ₹2450 conflicts with Row 24: ₹2400 | Error | Flags both rows as conflicting. User must manually decide which version to **Accept** or **Skip**. |
| 3 | **Missing field** | Row 13: "paid_by" is blank | Error | Without required data, the row cannot be imported. Suggested action: **Skip Row**. |
| 4 | **Negative amount** | Row 26: -$30 parasailing refund | Warning | Identifies as a refund. Suggested action: **Modify** to positive absolute value and keep. |
| 5 | **Zero amount** | Row 31: ₹0 Swiggy order | Warning | Flagged as placeholder. Suggested action: **Skip Row**. |
| 6 | **Settlement as expense**| Row 14: "Rohan paid Aisha back" | Warning | Misclassified in CSV. Suggested action: **Reclassify** as a settlement transaction. |
| 7 | **USD currency** | Row 20: $540 Goa villa booking | Info | Legitimate expense in USD. Handled by applying configured exchange rate. Action: **Acknowledge**. |
| 8 | **Missing currency** | Row 28: currency column is blank | Warning | Guesses default based on group settings (INR). Suggested action: **Modify** to explicitly set to INR. |
| 9 | **Unparseable date** | Malformed string instead of a date | Error | Prevents split calculations. Suggested action: **Skip Row** or manual correction. |
| 10 | **Ambiguous date** | Row 34: "04/05/2026" (April 5 vs May 4) | Warning | Defaults to standard parsing (DD/MM/YYYY in our region). Suggested action: **Acknowledge**. |
| 11 | **Future date** | Dates occurring beyond today | Warning | Flagged for review to prevent typos. Suggested action: **Acknowledge** or **Skip**. |
| 12 | **Member not active** | Row 36: Meera listed but she left March 31 | Warning | Violates membership constraints. Suggested action: **Modify** to exclude her from the split. |
| 13 | **Unknown member** | Row 23: "Dev's friend Kabir" | Warning | Member doesn't exist in group. Suggested action: Auto-create member and **Accept**. |
| 14 | **Name inconsistency** | Row 9: "priya", Row 11: "Priya S" | Info | Fuzzy matches and maps to canonical "Priya". Action: **Acknowledge**. |
| 15 | **Invalid percentage** | Row 15: 30+30+30+20 = 110% | Error | Percentages must sum to 100%. Suggested action: **Skip Row**. |
| 16 | **Split type mismatch** | Row 42: type is "equal" but ratios provided | Info | Overrides to "shares" split. Action: **Acknowledge**. |

---

## Database Schema

We chose to use raw SQL with PostgreSQL (`node-postgres`) to maintain full control over the queries and ensure every line of code is explainable in the live session (no ORM magic).

### Tables

1. **`users`**
   - Stores all app users (authenticated via Google OAuth).
   - Columns: `id`, `google_id`, `email`, `name`, `avatar_url`, `created_at`

2. **`groups`**
   - Stores shared expense groups (e.g., "Flat Expenses", "Goa Trip").
   - Columns: `id`, `name`, `description`, `default_currency`, `created_by`, `created_at`

3. **`group_members`**
   - Tracks who is in a group and *when* (join/leave dates).
   - **Critical for Sam's requirement**: `joined_at` and `left_at` allow membership-aware splits.
   - Columns: `id`, `group_id`, `user_id`, `joined_at`, `left_at`, `role`

4. **`expenses`**
   - Stores every shared expense or cost.
   - **Critical for Priya's requirement**: `currency`, `exchange_rate`, and `amount_in_base` handle multi-currency logic natively.
   - Columns: `id`, `group_id`, `paid_by`, `description`, `amount`, `currency`, `exchange_rate`, `amount_in_base`, `expense_date`, `split_type`, `category`, `is_settlement`

5. **`expense_splits`**
   - Details exactly how each expense is divided among members.
   - **Critical for Rohan's requirement**: Allows traceable per-person, per-expense breakdowns.
   - Columns: `id`, `expense_id`, `user_id`, `amount`, `percentage`, `shares`

6. **`settlements`**
   - Explicit debt payments between members to clear balances.
   - Columns: `id`, `group_id`, `paid_by`, `paid_to`, `amount`, `currency`, `settlement_date`

7. **`import_sessions`**
   - Tracks each CSV import attempt and its state.
   - Columns: `id`, `group_id`, `imported_by`, `filename`, `status` (pending, reviewing, confirmed), `total_rows`, `processed_rows`, `error_rows`, `parsed_rows` (JSONB)

8. **`import_anomalies`**
   - Every data problem detected during a CSV import is written here.
   - **Critical for Meera's requirement**: Stores the issue, the `original_data`, a `suggested_action`, and records the `user_action` to ensure review before database mutation.
   - Columns: `id`, `import_session_id`, `row_number`, `anomaly_type`, `severity`, `description`, `original_data`, `suggested_action`, `suggested_value`, `user_action`, `user_value`, `resolved`
