# Roster CSV Import Format

Waypoint expects a UTF-8 CSV with a header row. Column names are **case-insensitive** and use **snake_case**.

## Required columns

| Column | Description | Example |
|---|---|---|
| `first_name` | Student's first name | `Jordan` |
| `last_name` | Student's last name | `Lee` |

## Optional columns

| Column | Description | Example |
|---|---|---|
| `external_id` | Stable ID from your registration system — used to **update** the same student on re-import | `REG-2026-00421` |
| `date_of_birth` | ISO date `YYYY-MM-DD` | `2012-03-15` |
| `grade` | Grade level | `8` |
| `team` | Team/cabin name — must **exactly match** an existing team in the active session | `Pine Cabin` |
| `allergies` | Comma-separated or free text | `Peanuts, tree nuts` |
| `medications` | Current medications | `EpiPen as needed` |
| `medical_conditions` | Medical conditions | `Asthma` |
| `guardian_name` | Primary guardian full name | `Taylor Lee` |
| `guardian_email` | Guardian email | `taylor@example.com` |
| `guardian_phone` | Guardian phone (normalized on import) | `555-0100` |
| `emergency_contact_name` | Additional emergency contact | `Chris Lee` |
| `emergency_contact_phone` | Emergency contact phone (normalized on import) | `555-0101` |
| `emergency_contact_relationship` | Relationship to student | `Aunt` |
| `emergency_contact_email` | Emergency contact email | `chris@example.com` |

## Phone normalization

`guardian_phone` and `emergency_contact_phone` are stripped of formatting and validated on import:

- Accepts `(555) 010-1000`, `555-010-1000`, `+1 555 010 1000`, etc.
- Stored as E.164-style digits (e.g. `+15550101000`)
- Rows with a provided phone that fails validation are **rejected** with an error

## Example file

```csv
external_id,first_name,last_name,date_of_birth,grade,team,allergies,medications,medical_conditions,guardian_name,guardian_email,guardian_phone,emergency_contact_name,emergency_contact_phone,emergency_contact_relationship,emergency_contact_email
REG-001,Jordan,Lee,2012-03-15,8,Pine Cabin,Peanuts,EpiPen as needed,Asthma,Taylor Lee,taylor@example.com,555-0100,Chris Lee,555-0101,Aunt,chris@example.com
REG-002,Sam,Patel,2011-07-22,9,Maple Cabin,,,,Priya Patel,priya@example.com,555-0200,,,,
```

## Import rules

- Rows missing `first_name` or `last_name` are **rejected** with an error.
- Unknown `team` values produce a row error (teams are not auto-created during import).
- Medical fields create or update a `MedicalProfile` for the student.
- If `emergency_contact_name` and `emergency_contact_phone` are provided, an emergency contact record is created or updated.
- **`external_id`**: if provided and a student with that ID exists in the active session, the row **updates** that record instead of creating a new one.
- **Duplicate detection** uses `first_name` + `last_name` + `date_of_birth`:
  - Exact match (all three) without `external_id` → row is **rejected** as a duplicate.
  - `date_of_birth` missing but first + last name match an existing student → row is **still imported**, but flagged with a **warning** for manual review (possible duplicate).

## Template

A ready-to-fill template is at `docs/roster-import-template.csv`.
