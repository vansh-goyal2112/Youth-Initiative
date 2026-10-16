# Sprint 2 Release Acceptance Plan
**Target manual QA:** Week of October 19, 2026  
**Review branch:** `feature/sprint2-skill-quest-adventure`  
**Merge gate:** Draft PR #3 -> `main` **only after explicit approval**.

## Before testing (15 minutes)

- [ ] Fetch and switch to the feature branch. Run `git status` and make sure no other uncommitted changes will be overwritten.
- [ ] Verify the latest GitHub Actions run is green: lint, unit/workflow tests, production build, and HTTP smoke checks.
- [ ] Use a **test environment** with test Firebase users, test Cosmos data, and an approved Azure Communication Services sender. Do **not** create pretend guardian approvals or fake attendance in live student records.
- [ ] Confirm `NEXT_PUBLIC_APP_URL`, Azure email connection/sender, Firebase Admin, Firebase App Check, and Cosmos environment settings. Have both an adult test inbox and **separate** minor + guardian test inboxes.
- [ ] Record outcome as **Pass / Fail / Blocked** with reproduction steps. Do not post actual minors' names, birthdates, passwords, guardian emails, or tokens in the PR.

## P0 — Must pass before merging (approximately 60–90 minutes)

| ID | Scenario | Actions | Pass criteria |
| --- | --- | --- | --- |
| P0-01 | Adult registration | Register adult test user; open verification email; verify and set password | Account activates; Youth ID email is correct; login succeeds |
| P0-02 | Abandoned adult recovery | Register adult; don't open initial email; expire the verification link; choose **Resume Registration** with same student email | New verification link arrives in student inbox; previous link invalid; no duplicate registration |
| P0-03 | Adult activation recovery | Adult verifies email but doesn't finish password setup; let setup link expire; resume | Fresh setup link arrives at previously verified student email; verification is **not** skipped for unverified users |
| P0-04 | Minor parental consent | Register minor test user and distinct guardian email; open guardian email; approve consent; finish activation | No account activation until guardian approval; guardian record remains associated with original email |
| P0-05 | Abandoned minor recovery | Register minor; lose original browser session, let guardian link expire; resume using student's original email | **Original guardian** gets replacement link; student never receives consent capability; no duplicate account |
| P0-06 | Approved-guardian recovery | Approve guardian consent but don't finish account activation; let link expire; resume | Original approved guardian gets fresh setup link; consent approval remains recorded |
| P0-07 | Existing account safety | Submit Resume Registration for a completed account and a non-existent email | Both show generic response; neither exposes status, guardian address or registration ID; neither creates a second account |
| P0-08 | Protected endpoints | Try a protected mutation without valid authentication/App Check | Access denied; no data modified or emails sent |
| P0-09 | Login and Cosmos profile | Log in as active student; open Profile and refresh; edit interests and revisit | Real `youthId` and `contactEmail` display; current preferences appear; synthetic Firebase email/UID not exposed |
| P0-10 | QR -> attendance -> XP | Sign up for a test workshop through normal flow, verify attendance once; scan QR again | One completed registration and **one** XP award; second scan doesn't add XP |
| P0-11 | Reward recovery | With test data only, simulate verified attendance where XP processing fails; revisit Journey | Attendance stays verified; safe reconciliation grants missing reward once; processing transactions aren't blindly replayed |

**Stop and fix before merging** for any failure to preserve guardian consent, incorrect permissions, duplicate accounts/XP, or an impossible recovery path.

## P1 — Should pass before merging (approximately 45–60 minutes)

| ID | Scenario | Actions | Pass criteria |
| --- | --- | --- | --- |
| P1-01 | Mission persistence | On Dashboard choose a quest; reload and sign out/in | Mission stays selected; selecting it awards no XP |
| P1-02 | Journal stamps | Complete verified workshop; answer reflection once; open Dashboard/Journey; repeat submission | Exactly one persisted reflection stamp per verified workshop; no unearned XP |
| P1-03 | Real badge/level totals | Compare Dashboard, Journey, Profile and Badges for same test student | All show consistent totals from gamification API |
| P1-04 | Upcoming workshops | Admin creates dated active workshop tomorrow, inactive/past workshop, undated workshop, and registered workshop | Only eligible upcoming unregistered workshops appear in reminders; all valid catalogue entries remain discoverable |
| P1-05 | Surprise Me compass | Spin several times | Shows an actual active eligible workshop; detail link works; does not claim direct CampBrain registration |
| P1-06 | Registration link recovery limits | Request recovery twice within 60 seconds; test quota with controlled mock/unit test | Sending throttled; public message does not reveal whether a record exists |
| P1-07 | Account recovery | Use Forgot Password and Forgot Youth ID for an activated test user | Existing secure account recovery works; registration recovery does not replace login recovery |

## P2 — UI, accessibility and regression (approximately 30–45 minutes)

- [ ] Desktop at **1440px** and **1920px**: no giant blank gaps, overly stretched text, overflow, or animations blocking controls.
- [ ] Mobile at **320px, 375px, 430px**; tablet **768px/1024px**; browser at **200% zoom**.
- [ ] Header has consistent height, correct active section, and working logo/back links on Dashboard, Workshops, detail, Journey, Badges, Profile, attendance, and completed workshops.
- [ ] Mobile PWA bottom navigation does not obscure forms or buttons. All touch targets accessible.
- [ ] Tab through authentication/recovery forms, mission choices, journal form, and actions. Focus remains visible.
- [ ] Turn on **Reduced Motion**: floating bubbles/stars and compass transitions stop; important information remains legible.
- [ ] Test Register, Login, Profile/Edit Profile, Workshops filtering/detail, external CampBrain handoff, attendance scanning, admin workshop CRUD/import. Non-student admin navigation remains unchanged.
- [ ] Error states are meaningful: email provider temporarily unavailable, backend unavailable, old token rejected, expired token, and invalid App Check.

## Decision and release gate

**Merge only when all are true:** latest PR CI green; every P0 passes; no unresolved high-severity P1 issues; P2 accessibility basics checked; test notes/screenshots reviewed; developer and user give explicit approval.

If a P0 fails, keep PR #3 in **Draft** and fix it on the branch. Rerun the automated pipeline and affected manual tests before re-reviewing.

## Commands

```powershell
git switch feature/sprint2-skill-quest-adventure
git pull origin feature/sprint2-skill-quest-adventure
npm ci
npm run lint
npm test
npm run build
npm run test:smoke
npm run dev
```

**What automation covers today:** deterministic data/validation rules, registration recovery workflow against fake Cosmos/email services, and live HTTP routing/auth guards against the built Next.js app. **What it cannot verify without connected test services:** real Azure email delivery, Firebase Authentication and App Check in a browser, actual Cosmos persistence, QR camera permissions, and the actual CampBrain handoff. These remain mandatory manual integration tests; no automated pass should be presented as a live-system acceptance pass.
