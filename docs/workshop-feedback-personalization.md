# Workshop Feedback Tasks, Personalized Discovery & Upcoming Notices

## Scope decision (October 2026)
- Do **not** add a separate onboarding interest survey or admin question-builder. Existing lightweight interest choices stay.
- Every verified completed workshop creates a five-choice-question feedback task in the student Profile -> My Tasks.
- An optional short comment (up to 500 characters) can describe improvements. Do not include names or identifying details.
- The exact same five questions appear on every completed workshop. The feedback task is optional.
- One **20 XP reward per completed registration**. A deterministic XP ledger ID prevents double claims.
- If a reward transaction remains in **processing** after an interrupted write, it must be investigated; do not blindly replay it because the student balance might have changed.
- Admin Workshop Feedback shows response counts, average five-point enjoyment rating, answer distributions, optional comments, and aggregated CSV export. No student IDs are exported.
- The existing dashboard's recommended workshops now ranks available unregistered workshops using student's lightweight interests, verified completion categories, preferred learning mode and upcoming dates.
- SAIT pathway recommendations remain based on interests plus completed workshop history, including snapshots from retired offerings.
- Student learning pages show the nearest eligible upcoming workshop and pending feedback task count. Dismissal persists for the browser tab session; no push/email notification permission is required.
- Removing an offering from the live catalogue does not erase workshop feedback or completion rewards stored with the historical registration and XP ledger.

## Required acceptance tests
1. Complete a workshop with verified QR attendance; open Profile -> My Tasks and confirm one feedback task is shown.
2. Submit all five questions; verify 20 XP is added exactly once and the task moves to Completed.
3. Repeat the request, reload, sign out and back in; no extra XP or duplicate feedback.
4. Check invalid answers, incomplete attendance, and attempts to respond to another student's registration are rejected.
5. Verify the Admin Feedback dashboard counts the response and computes the five-point average; CSV should contain no student identifiers.
6. Delete the workshop after the completion; confirm feedback, XP and the historical title are still present.
7. Confirm an active upcoming workshop is promoted across student pages but discontinued/past or already registered workshops are not.
8. Check that recommended youth workshops match interests/learning mode/history and SAIT pathway recommendations still use historical completions.
9. Simulate an interrupted XP write in a disposable environment; the pending ledger must be reviewed, not double-awarded.
10. Run `npm run lint`, `npm test`, `npm run build`, and full Admin then Student UAT against test Firebase/Cosmos/ACS.

## Change control
The October project plan's stories about a separate interest survey and administrator survey-question editor are now proposed to be superseded by workshop feedback tasks and analytics. **Client/instructor scope approval should be recorded in Jira and the final project documentation before handoff.**
