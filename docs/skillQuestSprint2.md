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
