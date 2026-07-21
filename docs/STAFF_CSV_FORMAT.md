# Staff CSV Import Format

Waypoint expects a UTF-8 CSV with a header row. Column names are **case-insensitive** and use **snake_case**.

Import is available on **Staff → Directory** for Session Admin / Super Admin.

## Required columns

| Column | Description | Example |
|---|---|---|
| `first_name` | Staff first name | `Ava` |
| `last_name` | Staff last name | `Nguyen` |
| `role` | Must be an importable role enum value | `STAFF` |
| `email` | Unique login email | `ava.nguyen@demo.camp` |

## Optional columns

| Column | Description | Example |
|---|---|---|
| `phone` | Staff phone (normalized on import) | `555-0200` |
| `team` | Team name — must **exactly match** an existing team in the active session | `Pre-Med` |
| `emergency_contact_1_name` | Primary emergency contact | `Sam Nguyen` |
| `emergency_contact_1_phone` | Primary emergency phone | `555-0201` |
| `emergency_contact_2_name` | Secondary emergency contact | `Jordan Lee` |
| `emergency_contact_2_phone` | Secondary emergency phone | `555-0202` |
| `food_allergy` | Food allergies (plain text) | `Shellfish` |
| `dietary_restriction` | Dietary restriction | `Vegetarian` |
| `dietary_other` | Other dietary notes | `No pork` |

## Roles

Accepted values (case-insensitive; spaces/`-` become `_`):

- `STAFF`
- `NURSE`
- `SESSION_ADMIN`

Unrecognized roles (including `SUPER_ADMIN`, `PARENT`, `STUDENT`) are **rejected** for that row — they are not silently defaulted.

## Team matching

Same rule as roster import: case-insensitive exact match against teams in the **active** camp session. Unknown team names reject the row.

## Passwords

New accounts receive a generated temporary password (`CampTemp-…`) shown in the import results. `mustChangePassword` is set so the first login redirects to `/change-password`.

Re-importing an existing email in the same org **updates** profile/team fields and does **not** rotate the password.

## Example

```csv
first_name,last_name,role,email,phone,team,emergency_contact_1_name,emergency_contact_1_phone,emergency_contact_2_name,emergency_contact_2_phone,food_allergy,dietary_restriction,dietary_other
Ava,Nguyen,STAFF,ava.nguyen@demo.camp,555-020-0001,Pre-Med,Sam Nguyen,555-020-0002,Jordan Lee,555-020-0003,Shellfish,Vegetarian,
Chris,Patel,NURSE,chris.patel@demo.camp,555-020-0010,Biotechnology,Priya Patel,555-020-0011,,,Peanuts,,No tree nuts
```
