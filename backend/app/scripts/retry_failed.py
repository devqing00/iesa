import os
import sys
import json
import time

sys.path.insert(0, r"c:\Users\QING\Desktop\Qing\iesa\backend")
from app.scripts.send_conference_emails import (
    fetch_conference_announcement,
    render_personalized_email,
    send_via_resend,
)

results_file = r"c:\Users\QING\Desktop\Qing\iesa\backend\app\data\conference_email_results.json"
with open(results_file, "r", encoding="utf-8") as f:
    report = json.load(f)

ann = fetch_conference_announcement()

failed_records = [r for r in report.get("records", []) if not r.get("success")]
print(f"Retrying {len(failed_records)} failed emails...")

for r in failed_records:
    att = {"first_name": r["first_name"], "full_name": r["full_name"], "email": r["email"]}
    subject, html = render_personalized_email(ann, att)
    success, detail = send_via_resend(r["email"], subject, html)
    if success:
        print(f"✅ SENT RETRY: {r['email']} ({r['first_name']}) - ID: {detail}")
        r["success"] = True
        r["detail"] = detail
    else:
        print(f"❌ FAILED RETRY: {r['email']} - Error: {detail}")
    time.sleep(1.0)

# Update report
report["success"] = sum(1 for r in report["records"] if r.get("success"))
report["failed"] = sum(1 for r in report["records"] if not r.get("success"))

with open(results_file, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)

print(f"\nFinal report: Success: {report['success']}/{report['total']}, Failed: {report['failed']}")
