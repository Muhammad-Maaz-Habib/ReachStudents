/** Ready-to-paste AI prompts for CSV import reformatting (optional guidance only). */

export const ROSTER_CSV_AI_PROMPT = `I have a spreadsheet of summer camp/conference students that I need reformatted
into a specific CSV format for import into an app called Waypoint. Please read
the attached file and convert it into a CSV with exactly these column headers,
in this order:

first_name, last_name, date_of_birth, grade, team, allergies, medications,
medical_conditions, guardian_name, guardian_email, guardian_phone,
emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
emergency_contact_email

Rules:
- first_name and last_name are required. Skip any row missing either, and tell
  me which rows you skipped and why.
- date_of_birth should be formatted as YYYY-MM-DD if present in the source data.
  Leave blank if not available.
- "team" should map to whatever column represents the student's cabin, group,
  program, or track in the source data. Tell me the full list of unique team
  values you found, since these need to already exist as Teams in Waypoint
  before I import.
- Normalize all phone numbers to E.164 format (e.g. +14155551234). If a phone
  number can't be parsed, leave it blank and flag it as a warning.
- If the source data doesn't have a separate emergency contact from the parent/
  guardian, use the guardian's info for both, but tell me you did this.
- Leave allergies, medications, and medical_conditions blank if not present —
  do not guess or infer these, since they're safety-critical.
- After reformatting, give me a summary: total rows processed, rows skipped,
  any unparseable phone numbers, and the full list of unique team names found.
- Output the result as a downloadable CSV file.`;

export const STAFF_CSV_AI_PROMPT = `I have a spreadsheet of summer camp/conference staff members that I need
reformatted into a specific CSV format for import into an app called Waypoint.
Please read the attached file and convert it into a CSV with exactly these
column headers, in this order:

first_name, last_name, role, email, phone, team, emergency_contact_1_name,
emergency_contact_1_phone, emergency_contact_2_name, emergency_contact_2_phone,
food_allergy, dietary_restriction, dietary_other

Rules:
- first_name and last_name are required. Skip any row missing either.
- "role" must be one of exactly: STAFF, NURSE, SESSION_ADMIN. Map job titles
  to the closest match (e.g. "Counselor"/"Mentor" → STAFF, "Camp Nurse" →
  NURSE, "Director"/"Program Manager" → SESSION_ADMIN). If unsure, default to
  STAFF and flag it — don't guess at SESSION_ADMIN, since it has broad access.
- Normalize phone numbers to E.164 format. Leave blank and flag if unparseable.
- "team" should map to the staff member's primary group/cabin/program if
  present in the source data.
- Leave food_allergy, dietary_restriction, and dietary_other blank if not
  present — don't infer these.
- After reformatting, give me a summary: total rows processed, rows skipped,
  any uncertain role mappings, and any unparseable phone numbers.
- Output the result as a downloadable CSV file.`;

export const HEALTH_CSV_AI_PROMPT = `I have a spreadsheet of summer camp/conference student health information that I
need reformatted into a specific CSV format for import into an app called
Waypoint. Please read the attached file and convert it into a CSV with exactly
these column headers, in this order:

external_id, first_name, last_name, date_of_birth, allergies, medications,
medical_conditions

Rules:
- This import UPDATES existing students only — it never creates new students.
  Every row must identify a student confidently.
- Prefer external_id when available. Otherwise include first_name, last_name,
  AND date_of_birth (YYYY-MM-DD) together. Never match on name alone.
- If student identity is ambiguous (missing DOB, multiple possible matches, or
  unclear which person a row refers to), omit that row and flag it — do not
  guess which student it is.
- allergies, medications, and medical_conditions are safety-critical. Never
  guess or infer values that are not clearly stated in the source data. Leave
  blank if not clearly present.
- Do not invent or include confidential notes — that field is not part of this
  CSV and must stay blank/out of scope.
- After reformatting, give me a summary: total rows processed, rows skipped for
  ambiguous identity, and any fields left blank because they were unclear.
- Output the result as a downloadable CSV file.`;

export const SCHEDULE_CSV_AI_PROMPT = `I have a spreadsheet of summer camp/conference activities that I need reformatted
into a specific CSV format for import into an app called Waypoint. Please read
the attached file and convert it into a CSV with exactly these column headers,
in this order:

activity_name, team, start_date, start_time, duration_minutes, recurrence_days,
overdue_alert_minutes

Rules:
- activity_name, start_date, start_time, and duration_minutes are required.
- start_date must be YYYY-MM-DD. start_time should be 24-hour HH:MM (e.g. 14:00)
  or 12-hour like 2:00 PM.
- duration_minutes must be an integer between 15 and 480.
- "team" is optional. If present, it must match an existing team name in
  Waypoint. Leave blank for session-wide activities.
- recurrence_days is optional (e.g. Mon,Wed,Fri). If present, Waypoint will
  create a recurring series from start_date through the end of the active
  session. If blank, create a one-off activity on start_date only.
- overdue_alert_minutes is optional (0–120). Default is 15 if blank.
- After reformatting, give me a summary: total rows processed, unique team
  names found, and which rows are one-off vs recurring.
- Output the result as a downloadable CSV file.`;
