# Sprint 2 — Skill Quest Adventure (review branch)

This changes the student gamification experience while preserving all
existing authentication, URLs, backend access checks, and `globals.css`.

## What changed

- Adds a colourful, responsive Adventure Map using the existing quest states,
  with clear current/completed/upcoming visual states. Milestones do not
  restrict workshop choices or registration.
- Brightens Journey, Badges, and Reward using scoped CSS Modules rather than
  replacing the project's existing CSS.
- Adds an in-app "Adventures Coming Soon" dashboard list using real
  `startDate` values, filtering inactive, past, unscheduled, and already
  registered workshops. This is not a push notification service.
- Corrects the existing dashboard's `workshop.date` field to `startDate`
  and orders recorded upcoming registrations by their schedule.
- Preserves verified attendance if reward processing fails. A student
  viewing Journey triggers authenticated, limited reward reconciliation.
- Checks the deterministic Cosmos `xpTransactions` record before reporting
  an XP award as complete.
- Prevents duplicate XP by never blindly retrying an already-existing
  "processing" transaction.
- Removes misleading quest-bonus-XP claims from the visible gamification UI.
  Quests remain visual progress milestones.

## Important operational limitation

The reward-reconciliation endpoint retries a verified completion only when
there is **no** XP transaction. Existing completed transactions synchronize
the registration flag. Transactions stuck in `processing` remain pending
for manual investigation, because the student balance may already have
been updated before the transaction's final status was saved.

This is eventual consistency and not a multi-document atomic transaction.

## Automated checks

```sh
npm ci
npm run lint
npm test
npm run build
```

The GitHub CI workflow now runs tests before the production build. Tests
include `tests/rewardRecovery.test.mjs` and
`tests/upcomingWorkshops.test.mjs`.

## Required manual QA before merging

- [ ] Test Journey, Badge and Reward pages with 0, 1, and 5+ completed workshops.
- [ ] Run a complete QR attendance scan with a valid registered student.
- [ ] Simulate a failing reward persistence call and verify attendance stays
      completed while the Journey reconciliation safely retries later.
- [ ] Confirm concurrent scans/repeated visits do not duplicate XP.
- [ ] Investigate a stuck `processing` transaction; do not reset it blindly.
- [ ] Review keyboard traversal and screen-reader names on the Adventure Map.
- [ ] Test reduced-motion preferences and browser zoom to 200%.
- [ ] Check viewport widths 320, 375, 430, 768, 1024 and 1440 px.
- [ ] Test installed PWA mode and mobile bottom navigation.
- [ ] Confirm in-app workshop reminders at today/tomorrow/7-day boundaries,
      with missing or unscheduled dates, and with existing registrations.
- [ ] Confirm official CampBrain registration is still a handoff rather
      than an automatically verified enrollment.
- [ ] Review colour contrast and touch sizes with real devices.

No push notifications, email reminders, new identities, or changes to
administrator functionality are introduced in this branch.

## Second update: interactive dashboard (October 16)

The previous dashboard still looked like the older app. This update adds
a large, page-scoped **Skill Quest HQ** with:

- A playful purple/gold/red dashboard hero that matches Journey and Badges.
- Real progress summaries for levels, verified workshops, badges and
  learning-journal stamps.
- **Choose Your Mission:** an authenticated, persistent personal focus
  mission stored on the student's Cosmos record via
  `POST /api/gamification/focus`. Choosing a mission does not grant XP
  and does not restrict workshop registration.
- **My Learning Journal:** a short, age-friendly two-question reflection
  after **verified** attendance, saved once per workshop on the
  student's existing registration document via
  `POST /api/gamification/reflect`. There is no free text or public
  sharing; reflection does not grant extra XP.
- A journal stamp collection visible on both Dashboard and Journey.
- Existing upcoming workshop notifications, registrations, recommendations,
  skill tracks and mobile navigation remain available.

The changes use new CSS Modules; `src/app/globals.css` has not been
rewritten. Reflection and mission authorization reuse the existing
`requireActiveStudent` Firebase/App Check and Cosmos account checks.

## Additional verification before merge

- [ ] Existing test student: select a mission, refresh the dashboard,
      and confirm the same selected mission returns from Cosmos.
- [ ] Confirm mission choice cannot be set by unauthenticated or
      inactive accounts.
- [ ] Confirm reflection cannot be saved before verified attendance
      or on someone else's registration.
- [ ] Save a reflection using the mood/moment selections; check
      dashboard journal count and the Journey journal stamp.
- [ ] Confirm repeated submissions cannot create duplicate stamps.
- [ ] Test an account with zero completed workshops, several completed
      workshops, and a completed workshop pending XP recovery.
- [ ] Test keyboard interaction, focus indicators, radio groups,
      screen readers and reduced-motion preferences.
- [ ] Check visual layouts at 320px, 375px, 430px, 768px, 1024px,
      1440px and 200% zoom on device or a real browser.
- [ ] Confirm admin pages, authentication, workshop CRUD and the
      existing bottom navigation are unchanged.

Automated engagement-rule tests:
`tests/skillQuestEngagement.test.mjs`.

**Limitations:** Additional journal stamps are not counted as existing XP
badges; these are a separate collection. No daily streak punishments,
public leaderboard, arbitrary bonus XP or social sharing are introduced.

## Third update: shared navigation, whitespace and subtle motion

The student experience now uses a **single shared header** on all primary
student pages, including Dashboard, Workshops, workshop details, Journey,
Badges, Profile, registered/completed workshops, QR attendance, reward and
post-registration confirmation. On narrow screens, one matching mobile
bottom navigation is used instead of each page rendering its own version.

- Added `StudentHeader.jsx`, `StudentShell.jsx`, and CSS Modules in
  `src/components/common/`. The StudentShell is attached through the
  existing root layout **only for student learning routes**.
- Public login/registration/onboarding pages and the separate admin
  portal are intentionally unchanged.
- The duplicated legacy headers, workshop-details back bar and mobile
  bottom navigations are hidden by styles scoped inside StudentShell,
  without deleting them from the original pages.
- Predictable back links: Journey/Badges/Workshops -> Home, Workshop
  details -> Workshops, Edit Profile -> Profile, Completed/QR -> Upcoming.
- The shared header has a consistent 74px desktop height (responsive
  66px tablet and 62px small mobile), active navigation, SAIT branding
  and a small gently animated Skill Quest sparkle.
- Larger desktop content widths of up to 1380px reduce unused space.
  Very subtle, pointer-event-free drifting shapes decorate wide-screen
  margins and workshop/page heroes; they do not block user controls.
- The workshop catalogue's hero, cards, search/filter panel and spacing
  are visually aligned with the playful Journey/Badges/Dashboard aesthetic.
- Reduced-motion settings disable decorative animations throughout the
  student shell. The former maximum-scale viewport cap was removed to
  restore mobile pinch-zoom accessibility.
- Added a **Surprise Me!** workshop compass that randomly reveals a
  real active, unregistered, not-past workshop on the dashboard. It never
  grants XP, registers a student, or invents workshop inventory.

### Third-update manual QA before merge
- [ ] Visually compare header height, logo, active tab, back link and
      position on Dashboard, Workshops, workshop details, Journey,
      Badges, Profile, registered/completed workshops and QR attendance.
- [ ] Inspect 320px, 375px, 430px, 768px, 1024px, 1440px, and 1920px
      breakpoints, and test 200% zoom.
- [ ] Ensure the single shared mobile nav stays visible and never
      overlaps a form, QR scanner, registration link or bottom action.
- [ ] Check header/back links via keyboard, screen reader and PWA mode.
- [ ] Check reduced-motion OS/browser setting: sparkle, bubbles and
      discovery compass do not animate.
- [ ] Verify that desktop floating elements never catch clicks or obscure
      text, and do not cause scrollbars or layout shifts.
- [ ] Verify Workshop filters, links, QR scanning, registration flow,
      account recovery and non-student pages still work.
- [ ] Click Surprise Me several times; confirm each result is an
      actual available workshop and the details link works.

Added unit tests `tests/studentRouteConfig.test.mjs` and
`tests/discoverySpin.test.mjs`. Frontend smoke tests and visual
review on real browsers remain necessary; the CI build cannot verify
visual consistency by itself.

## Fourth update: Cosmos-backed Explorer Passport student profile

**Root cause:** The legacy Profile page read `student` from `useAuth()`,
but `AuthContext` originally provided `studentProfile`. As a result,
the screen showed blank/fallback identity fields even when the
authenticated Cosmos student document included `youthId` and
`contactEmail`.

**Fix:** `AuthContext` now exposes `student: studentProfile` as a
backward-compatible alias for the existing Dashboard and StudentShell
while retaining its original `studentProfile` field. The new Profile
page reads the correct `studentProfile` field and also fetches
`GET /api/student/profile` with `studentFetch` for fresh
authenticated Cosmos data. It loads `GET /api/gamification` for current
XP, badges, level and verified workshop totals. If fresh loading
fails, it warns clearly when using cached authenticated context.

**Design:** The new Profile is an animated, accessible and responsive
**Skill Quest Explorer Passport** with personal initials, level/rank,
progress meter, Youth ID and actual contact email from Cosmos,
date-of-birth and learning preference, emoji-enhanced interest worlds,
earned badge preview, and links to Adventure Map, Badges and Workshop
history. Existing Edit Preferences and Log Out actions are retained.
Styles live in `src/app/profile/profileAdventure.module.css`; no
global stylesheet rewrite.

**Privacy:** The profile does not expose Firebase UID as a Youth ID
or display the synthetic `@youthinitiative.local` Firebase sign-in
email as a real contact address. It uses only the logged-in
student's authenticated profile. No public student sharing or social
leaderboard has been introduced.

**Checks:** Added `tests/studentProfileDisplay.test.mjs` for field
mapping, missing-value fallbacks, dates and progress sourcing.

### Required manual acceptance checks

- [ ] Log in as a test student whose Cosmos record has `youthId`
      and `contactEmail`. Confirm both fields show accurate values.
- [ ] Confirm Firebase synthetic login email and Firebase UID are
      never substituted for missing Youth ID/contact information.
- [ ] Edit learning mode and interests; return to Profile and confirm
      refreshed Cosmos data is displayed without logging out.
- [ ] Verify level, XP, badge count and completed workshop count match
      `/api/gamification`.
- [ ] Try an authorized profile with absent optional fields; display
      useful placeholders instead of `undefined` or a fake account ID.
- [ ] Check Profile layout on mobile, tablet, desktop and 200% zoom;
      test keyboard focus, screen reader, reduced motion and PWA mode.
- [ ] Test Edit Preferences, View Journey, View Badges, Completed
      Workshops and Log Out links.
- [ ] Confirm test student data remains private; avoid using actual
      minors' personal information in screenshots or PR attachments.

**Status:** Compilation/lint/unit tests verify the implementation,
but end-to-end live Firebase/Cosmos and visual-device tests require
an authenticated test account and cannot be claimed without them.
