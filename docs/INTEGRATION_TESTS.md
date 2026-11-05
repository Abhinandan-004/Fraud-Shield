# Integration test sheet (Step 9 / Step 11)

Run each row with the **real** API and the extension loaded. Fill the last two columns.
Any failure goes to the owner of that slice as a GitHub issue.

| # | Scenario | Expected | Actual | Pass? |
|---|---|---|---|---|
| 1 | Open a known phishing email in Gmail | Red badge "!", verdict Likely fraud | | |
| 2 | Open a normal email from a friend | Green badge, Looks safe | | |
| 3 | Open Gmail inbox (no email open) | No badge | | |
| 4 | Open Outlook web, open a phishing email | Red badge | | |
| 5 | Visit a phishing URL from PhishTank (don't enter data!) | Red or amber badge | | |
| 6 | Visit google.com / wikipedia.org | Green badge | | |
| 7 | Email with link text `paypal.com` pointing elsewhere | Link outlined red, tooltip explains | | |
| 8 | Click "Why?" on a fraud verdict | List of top words/features shows | | |
| 9 | Click "Report as phishing" | "Thanks" message; row appears in `data/reports.jsonl` | | |
| 10 | Stop the API, click Rescan | Grey "Can't reach server" + hint, no crash | | |
| 11 | Scan screen: share a screenshot of a phishing email | Text is read, verdict shown | | |
| 12 | Scan screen: cancel the picker | "Cancelled.", nothing sent | | |
| 13 | Typosquat (e.g. `paypa1.com`) | Flagged (once Arijit's checker is wired in) | | |

Also record: model precision/recall from Abhinandan's and Arijit's write-ups, and one demo GIF.
