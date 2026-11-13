# SAIT Youth Initiatives – Client Feature Acceptance Matrix

**Audit date:** 2026-11-13  
**Reviewed baseline:** `main` at `0ac8a661b8b84a9e6cc25f85518d1833651ceaa0` (merged PR #11)  
**Review branch:** `fix/client-acceptance-audit-2026-11-13`

## Interpretation

- **In code:** User interface, API and/or Cosmos persistence logic exists. This is **not** proof of a successful live end-to-end workflow.
- **Fixed on review branch:** A concrete source-code gap was corrected here; it is **not** on `main` until approved and merged.
- **Limited / needs validation:** Implementation is partial or requires credentials, connected test services, authorized admins or actual browser verification.
- GitHub CI (lint, unit tests, Next build and HTTP smoke) succeeded for the baseline commit. No live Cosmos/Firebase/Azure integration acceptance is implied.

## Client-requested features

| # | Requirement | Source implementation / evidence | Assessment |
|---|---|---|---|
| 1 | Global student logout control | `StudentHeader.jsx`, `StudentShell.jsx`; uses Firebase `signOut` and login redirect | In code; test shared-device signout in browser |
| 2 | Edit My Identity | `edit-profile/page.js`, `api/student/profile/route.js` replace Cosmos student document; Firebase display name mirrored | In code; live persistence to verify |
| 3 | Required school grade during signup | `registrationSchema.js`, registration UI/API; `tests/workshopEligibility.test.mjs` | In code, unit-tested |
| 4 | Filter workshops to student's grade | `workshopEligibility.js`; list/detail/registration APIs enforce ineligible exclusion | In code, unit-tested; unknown grade/age eligibility is marked unconfirmed |
| 5 | Homepage requested fixed section order | `dashboard/page.js` | **Fixed on review branch**; supplemental progress widgets moved below the seven requested sections |
| 6 | Workshop cards show program area, not format | `WorkshopCard.js` | In code |
| 7 | SAIT Youth Initiatives plural | Student views/metadata use plural; CI/deploy email sender label used singular | **Email sender label fixed on review branch** |
| 8 | First-login flashcard tutorial (3–5) | Five cards in `WelcomeTutorial.jsx`, rendered by `StudentShell.jsx`; completion saved via profile PATCH | In code; test first real login |
| 9 | Tutorial skip, swipe, replay and workshop CTA | Tutorial and profile replay control | In code; device testing needed |
| 10 | Self-report completed workshop, including historical catalogue offerings | `api/workshops/self-report/route.js`, `SelfReportWorkshop.jsx` | In code; live test needed |
| 11 | Half XP immediately for self-report | `completionRules.mjs`, `gamificationAdmin.js`; deterministic XP ledger & Cosmos student updates | In code; unit logic tested, live transaction test required |
| 12 | Store QR vs self-report source | QR attendance and self-report APIs set `completionSource` in registrations and XP transactions | In code |
| 13 | Admin review / approve / reverse self-reports | `admin/completions` UI/API; audit log; ETag updates; XP reversal debt | In code; live test needed |
| 14 | Automatically earned custom badges and artwork | `admin/badges`, `customBadges.mjs`, `gamificationAdmin.js`, media upload | In code; custom badge reversal reconciliation **fixed on review branch** |
| 15 | Workshop create/edit/archive/deletion | `admin/workshops` UI/API; Cosmos persist and history-aware retirement | In code; live deletion test required |
| 16 | Multiple session dates with edit/archive/duplicate | `WorkshopSessionsPanel.jsx`, `api/admin/workshops/sessions`, persisted `workshops.sessions` | In code; live test required |
| 17 | Session registration/info URLs | HTTPS URL validation; student workshop details render per-session links | In code |
| 18 | Upload/replace workshop, badge, reward and banner images | `api/admin/media/upload/route.js`, media/workshop/badge admin views | In code; requires configured Firebase Storage and live permission checks |
| 19 | Image guidance | `MediaUploader.jsx`: PNG/JPEG/WebP, 5 MB max; workshop 1600×900, badge 512×512, banner 1920×640 recommended | In code |
| 20 | Specific Super Admins: Abdullah, Greg, Roz | Roles and secure SAIT approval exist; `docs/admin-console-setup.md` documents Abdullah bootstrap | **Live provisioning of all three is not verified** |
| 21 | Limited staff roles, per-user permission overrides | `adminPermissions.js`, `admin/team` UI/API | In code; verify authorized accounts and role enforcement |
| 22 | Admin badge removal and XP correction | `api/admin/badges/revoke`, `api/admin/xp-adjust` + audit/XP ledger | In code; **permission-gated**, per owner's later policy |
| 23 | Clear all session completions | `api/admin/completions` currently only reverses self-reported completions | **Partial: QR-verified completion reversal is not implemented in this workflow** |
| 24 | Badges & Rewards navigation label | Shared StudentHeader/BottomNavigation | In code |
| 25 | Total XP vs Current XP and swag message | `badges/page.js`, `xpBalance.mjs` | In code; unit-tested balance logic |
| 26 | Admin search and deduct XP for swag | Student directory search, redemption modal, `api/admin/rewards` | In code; live test required |
| 27 | Optional redemption note and audit log | `api/admin/rewards` stored `xpTransactions` with date, amount, actor and note | In code; live verification needed |
| 28 | Block deductions exceeding current XP | `redeemXp` and API ETag retry/validation | In code; unit logic tested |
| 29 | Keep student reward workflow simple (no catalogue/history pages) | Student badges view has totals/copy only; transaction log is admin-side | In code |

## Additional owner decisions checked

- Student email and date of birth stay protected; names, school grade, preferences and interests are editable.
- Self-report half XP is immediate, with administrator review/reversal afterwards.
- A scheduled session has independent date, capacity, status and external URL.
- Student accounts deactivate rather than physically delete.
- Discontinued workshops should be physically removable from the catalogue without erasing historical achievements. **The baseline retirement path looked up only the legacy XP transaction ID; the review branch fixes lookup for each session's XP transaction.**
- XP corrections must keep spendable XP >= 0, record `xpCorrectionDebt` and offset future earnings. `xpBalance.mjs` implements this.
- Completion and badge reversals are available only to authorized admins with the relevant permissions. This later owner decision supersedes the initial client's blanket statement about all admins.

## What administrators can edit today

Workshops, session dates/links/capacity, published statuses, student details within permission limits, account deactivation, badge definitions/rules/artwork, media, student badges, XP balances/redemptions and staff access roles (Super Admin only for authorization management). Some activity is deliberately permission-scoped.

Developer or deployment work remains necessary for changing fixed homepage ordering, altering the underlying XP/business rules, adding application modules, changing external identity-provider/MFA tenant configuration, modifying production environment secrets and changing infrastructure.

## Release blockers / mandatory live QA

1. Verify test accounts for **Abdullah, Greg and Roz** separately; confirm email verification, approved admin records, MFA policy and role-specific access before real minors' data is managed.
2. Exercise complete student signup, guardian consent, login/logout, first-use tutorial, grade filter, manual completion, QR completion, badge award/reversal and refresh/re-login against **test Cosmos/Firebase** accounts.
3. Verify each create/update/archive/delete/import and XP/badge/reward mutation actually persists in Cosmos, survives refresh and is visible through the corresponding admin screen. Test competing writes, idempotency and operation-log reconciliation.
4. Test real Firebase Storage upload/replacement and image display on workshop, badge, banner and reward UI.
5. Run responsive/accessibility browser QA at mobile/tablet/desktop sizes and keyboard/screen-reader controls. CI cannot establish visual quality.
6. Confirm Azure email sender and client-facing templates work with a verified service sender. GitHub CI success does not prove email delivery.
7. Design and test a safe QR-completion reversal path, including the separate 20 XP feedback reward if present. **Do not reuse the self-report reversal unmodified**, or it could leave XP balances/ledger inconsistent.
8. For catalogue deletion, test a multi-session completed workshop so that each session's XP transaction and snapshot survive physical removal. Do not run against real student records.

**Release rule:** A green CI build is necessary, not sufficient. Do not assert “fully functional and error-free” until the live QA above passes on a safe staging system, and the QR-completion reversal gap is resolved or explicitly excluded by the client.
