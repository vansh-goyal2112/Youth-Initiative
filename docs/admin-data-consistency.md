# Admin data consistency and safe deletion

## Architecture

- **Students** are stored once in Azure Cosmos DB `students`, keyed by Firebase UID. Firebase Authentication holds the login, disabled state, and display name. The Firebase login email is an **internal Youth ID address**, not the contact email shown in the profile.
- **Workshops** are stored once in Cosmos DB `workshops`, keyed by workshop ID.
- **Registrations**, **attendance sessions**, **XP transactions**, and **student badges** reference student/workshop IDs. Verified completed registrations keep immutable workshop snapshots so the original workshop document can be physically removed without destroying achievements.
- Student APIs fetch the canonical student/workshop documents. Most views reload after navigation or refresh; already-open browser sessions can show stale client-side state until refreshed.

## Admin workflows

| Action | Source of truth | Related-record behavior |
| --- | --- | --- |
| Edit student | Update Cosmos student; update Firebase displayName; synchronize disabled state | Historical consent evidence and completed XP awards remain unchanged. |
| Deactivate student | Firebase disabled + refresh tokens revoked; Cosmos `accountStatus=inactive` | Retains profile, registrations, badges, attendance and progress for authorized reactivation. |
| Reactivate student | Admin Edit/Reactivate restores Firebase enabled + Cosmos `accountStatus=active` | Existing progress becomes accessible again. |
| Start student registration | Existing verified `/api/register` flow; stores `pendingRegistrations` | **No active account** until email verification/guardian consent and password activation. Pending registrations appear separately in Admin Students. |
| Create workshop | Cosmos `workshops`; assigns relevant image | Student catalog and new registrations refer to the same workshop ID. |
| Edit workshop | Cosmos `workshops` | Existing registrations and attendance refer to the same ID and resolve updated workshop details. Historical XP amounts do **not** retroactively change. |
| Mark workshop inactive | Cosmos `workshops.status=inactive` | Removed from the active student catalog; keeps registrations, attendance and XP history. |
| Delete workshop | Persist snapshots of completed experiences, cancel unfinished registrations and close active QR sessions, then physically delete the Cosmos `workshops` document. | Historical completed registrations, journal reflections, XP transactions and student badges remain; new enrollment is blocked. |
| Replace annual catalogue | Choose offering year, import Excel, preview incoming and retired workshops, then explicitly confirm. | New year offerings get separate workshop IDs; older achievements remain in completed registrations. Replacing across Cosmos partitions is retryable but not atomic. |

## Student retention policy

Administrator actions support deactivation and reactivation only. Permanent student deletion is not exposed by the application. Student records, attendance history, consent evidence, badges and XP remain in Cosmos when an account is deactivated.

## Staging acceptance test

- Edit a test student's name and learning preferences from Admin, then reload the student profile. Name should match in Firebase displayName, Cosmos students, and the student portal. Contact email is a Cosmos contact field; do not replace the internal Firebase login identifier with it.
- Start a new student registration through Admin. Verify that it appears as **pending**, that the guardian approval is required for a minor, and that it appears in the activated directory only after successful consent and activation.
- Deactivate and reactivate that test student. Ensure protected student APIs reject an inactive account.
- Create an experimental workshop in Admin; confirm it appears in the active student catalog. Edit its description; refresh the details/registrations views and verify the new description.
- Set the workshop to inactive; confirm it stops appearing in the active workshop catalog, but historical completed registrations are retained.
- Complete a test workshop, finalize its XP, then delete the workshop. Confirm its record disappears from Cosmos `workshops` but its completion snapshot, XP, badges and journal reflection remain. Verify unfinished registrations are cancelled and QR sessions disabled.\n- Import new annual workshops in Add mode; repeat in Preview replacement mode and verify no changes occur until explicit confirmation. Confirm replacement and verify that discontinued workshops are physically gone, current offerings remain available, and earlier achievements still display.
- Verify that the Admin UI and API have no permanent student deletion action. Deactivate and reactivate only test accounts.

## Limitations

Cosmos cannot atomically replace an entire catalogue spread across workshop/registration/attendance partitions. A failed replacement can be partially applied and must be reviewed/retried before further imports. Cosmos and Firebase also do not share an atomic transaction. The admin routes contain rollback or retry safeguards, but operational interruptions can still require an administrator to reconcile a partial failure. GitHub CI tests build/runtime code; it does **not** prove that a live Azure database and Firebase are synchronized until the staging checks above pass.
