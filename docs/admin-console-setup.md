# SAIT Youth Initiative — Administrator activation and security

This document describes the manual security setup that cannot be performed from GitHub source code. Never commit a password, Firebase private key, Azure credential, App Check debug token, or TOTP secret.

## Scope and safety

Only the `feature/sprint2-skill-quest-adventure` branch is being developed. Do not merge or deploy until authorization tests, enrollment, client acceptance and MFA readiness are verified. Existing student authentication and student-facing pages remain separate.

## First Super Admin

The authorized initial Super Admin is **Abdullah.Rafih@sait.ca**. Merely knowing this address must not grant access. The owner of that inbox must verify and approve use of their SAIT account.

1. The owner opens `/admin/login`, selects **New Admin**, registers with their own verified SAIT email and chooses a password they keep private.
2. The owner clicks the Firebase verification email link and selects **Request Access** with their own credentials.
3. Only after checking this authorization, run the one-time bootstrap from a trusted development workstation with existing `.env.local` configuration and authorized Cosmos access:

   ```powershell
   $env:INITIAL_SUPER_ADMIN_EMAIL="Abdullah.Rafih@sait.ca"
   $env:CONFIRM_SUPER_ADMIN_BOOTSTRAP="YES_I_HAVE_VERIFIED_AUTHORIZATION"
   node --env-file=.env.local scripts/bootstrapSuperAdmin.mjs
   Remove-Item Env:\INITIAL_SUPER_ADMIN_EMAIL
   Remove-Item Env:\CONFIRM_SUPER_ADMIN_BOOTSTRAP
   ```

4. The script verifies the Firebase identity, email verification and current account state. It writes the initial Super Admin record to the `admins` Cosmos container. No public endpoint grants Super Admin access.
5. Abdullah can subsequently approve pending verified `@sait.ca` employees under **Team & Permissions**, select a role, and customize per-user permissions. All sensitive APIs independently enforce permissions.

## TOTP MFA

The project uses Firebase Spark currently. Firebase TOTP MFA requires upgrading to **Firebase Authentication with Identity Platform** and enabling TOTP. Review pricing and effect on existing student users before upgrading.

The code includes an **Account Security** enrollment screen and TOTP challenge handling for admin sign-in. After Identity Platform TOTP is enabled and administrators have enrolled successfully, set `ADMIN_REQUIRE_MFA=true` only on the admin-serving backend environment and verify a fresh TOTP-authenticated session. In that mode, protected admin operations require a Firebase ID token with `firebase.sign_in_second_factor === "totp"`. A non-MFA user can still reach the account-security enrollment page but not protected data APIs.

Until mandatory MFA is enabled and verified, do not use this portal to manage real minors' records in production.

## Acceptance checklist

- Confirm Super Admin can activate and sign in using the authorized SAIT account.
- Confirm pending employee can't read students, workshops or reports before approval.
- Confirm permission overrides apply immediately and cannot be bypassed by direct API calls.
- Confirm last Super Admin is protected and self-promotion is impossible.
- Confirm account deactivation blocks access on subsequent requests.
- Confirm report access, CSV exports and browser Print / Save PDF require appropriate rights.
- Confirm sensitive admin mutation attempts and report access appear under Activity & Audit without student data or secrets in audit rows.
- Confirm workshop Excel import, student editing and all user-side features still work.
- Confirm lint, unit tests, production build and HTTP smoke tests pass on the final commit.
- Validate browser sessions with and without enrolled MFA, and enforce MFA before release.

## Notes

Authorization and audit records use the existing `admins` Cosmos container; audit records have the dedicated `audit:` ID prefix and role `audit`. The Team API filters to role `admin`, so audit events cannot become administrative identities.

The initial student-report PDF pathway uses the browser Print / Save as PDF capability with an A4 print stylesheet. No background PDF service has been deployed.
