# Admin data consistency and safe deletion

## Architecture

- **Students** are stored once in Azure Cosmos DB `students`, keyed by Firebase UID. Firebase Authentication holds the login, disabled state, and display name. The Firebase login email is an **internal Youth ID address**, not the contact email shown in the profile.
- **Workshops** are stored once in Cosmos DB `workshops`, keyed by workshop ID.
- **Registrations**, **attendance sessions**, **XP transactions**, and **student badges** reference student/workshop IDs. These are historical records, not copies of the editable workshop description or student profile.
- Student APIs fetch the canonical student/workshop documents. Most views reload after navigation or refresh; already-open browser sessions can show stale client-side state until refreshed.

## Admin workflows

| Action | Source of truth | Related-record behavior |
| --- | --- | --- |
| Edit student | Update Cosmos student; update Firebase displayName; synchronize disabled state | Historical consent evidence and completed XP awards remain unchanged. |
| Deactivate student | Firebase disabled + refresh tokens revoked; Cosmos `accountStatus=inactive` | Retains profile, registrations, badges, attendance and progress for authorized reactivation. |
| Reactivate student | Admin Edit/Reactivate restores Firebase enabled + Cosmos `accountStatus=active` | Existing progress becomes accessible again. |
| Start student registration | Existing verified `/api/register` flow; stores `pendingRegistrations` | **No active account** until email verification/guardian consent and password activation. Pending registrations appear separately in Admin Students. |
| Permanently delete student | **Super Admin only**, verified MFA, approved retention/backup policy, `ADMIN_PERMANENT_DELETE_ENABLED=true`, inactive account and typed `DELETE <Youth ID>` | Previews then deletes Cosmos registrations, student badges, XP transactions, the matching pending registration, Youth ID reservation, Firebase Auth account, and student profile. If interrupted, account stays blocked with `deleting` status for a secure retry. Other environments, backups and legally required retention are not affected. |
| Create workshop | Cosmos `workshops`; assigns relevant image | Student catalog and new registrations refer to the same workshop ID. |
| Edit workshop | Cosmos `workshops` | Existing registrations and attendance refer to the same ID and resolve updated workshop details. Historical XP amounts do **not** retroactively change. |
| Mark workshop inactive | Cosmos `workshops.status=inactive` | Removed from the active student catalog; keeps registrations, attendance and XP history. |
| Delete workshop | Cosmos `workshops` document removed only if unreferenced | If any registrations, attendance sessions or XP transactions reference it, deletion is blocked with HTTP 409. Archive instead. This prevents historical data from becoming orphaned. |

## Before enabling permanent deletion

1. Obtain SAIT/client approval for record-retention periods, minor/guardian data handling, and deletion authorizations.
2. Establish and test an Azure Cosmos/Firebase backup and recovery process. This API does **not** purge existing backups or external provider copies.
3. Verify the list of stored student-related collections again if the schema has been expanded beyond `registrations`, `studentBadges`, `xpTransactions`, `pendingRegistrations`, `youthIdReservations` and `students`.
4. Set `ADMIN_PERMANENT_DELETE_ENABLED=true` **only after** those controls are approved. Keep it disabled otherwise.
5. Test with fabricated student identities in a staging database, not real minors. Preview deletion before executing. Confirm the Firebase account is gone and no dependent records remain.

## Staging acceptance test

- Edit a test student's name and learning preferences from Admin, then reload the student profile. Name should match in Firebase displayName, Cosmos students, and the student portal. Contact email is a Cosmos contact field; do not replace the internal Firebase login identifier with it.
- Start a new student registration through Admin. Verify that it appears as **pending**, that the guardian approval is required for a minor, and that it appears in the activated directory only after successful consent and activation.
- Deactivate and reactivate that test student. Ensure protected student APIs reject an inactive account.
- Create an experimental workshop in Admin; confirm it appears in the active student catalog. Edit its description; refresh the details/registrations views and verify the new description.
- Set the workshop to inactive; confirm it stops appearing in the active workshop catalog, but historical completed registrations are retained.
- Attempt deletion of a workshop with a registration; expect HTTP 409 and a message to archive. Delete an unused workshop; it should disappear from Cosmos and student catalog.
- Only with deletion approvals and the feature flag in **staging**, test permanent deletion on a deactivated fabricated account and verify cross-container cleanup. Do not test on production student data.

## Limitations

Cosmos and Firebase do not share an atomic transaction. The admin routes contain rollback or retry safeguards, but operational interruptions can still require an administrator to reconcile a partial failure. GitHub CI tests build/runtime code; it does **not** prove that a live Azure database and Firebase are synchronized until the staging checks above pass.
