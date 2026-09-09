import csv
import re
import sys

csv_path = r'c:\Users\QING\Desktop\Qing\iesa\public\assets\IESA CONFERENCE 2026 (Responses) - Form Responses 1.csv'

rows = []
with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(r)

print(f"Total rows in CSV: {len(rows)}")

# Check duplicate emails and name variations
emails_seen = set()
duplicates = []
invalid_emails = []

email_regex = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

for i, r in enumerate(rows):
    e1 = r.get("Email Address", "").strip()
    e2 = r.get("Email address", "").strip()
    # Primary email: e2 is the one typed by user in the form field "Email address", e1 is Google Form login
    chosen_email = e2 if (e2 and "@" in e2) else e1
    chosen_email = chosen_email.strip().lower()
    
    if not email_regex.match(chosen_email):
        invalid_emails.append((i + 1, chosen_email, r.get("Name(Surname, First name)")))
    
    if chosen_email in emails_seen:
        duplicates.append((i + 1, chosen_email, r.get("Name(Surname, First name)")))
    else:
        emails_seen.add(chosen_email)

print(f"Unique valid emails: {len(emails_seen)}")
print(f"Duplicates: {len(duplicates)}")
for d in duplicates:
    print(f"  Duplicate row {d[0]}: {d[1]} ({d[2]})")

print(f"Invalid emails: {len(invalid_emails)}")
for inv in invalid_emails:
    print(f"  Invalid row {inv[0]}: {inv[1]} ({inv[2]})")

print("\n--- Edge cases (len <= 1) across all rows ---")
for i, r in enumerate(rows):
    raw_name = r.get("Name(Surname, First name)", "").strip()
    tokens = [t.strip().title() for t in raw_name.replace(",", " ").split() if t.strip()]
    if len(tokens) <= 1:
        print(f"Row {i+1}: raw='{raw_name}', email='{r.get('Email address')}'")

