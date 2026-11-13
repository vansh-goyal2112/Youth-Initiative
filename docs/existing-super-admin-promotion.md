# Promote an existing verified SAIT administrator to Super Admin

**Do not add email-based special cases or bypass the Team API.** Super Admin has every permission in \`src/services/adminPermissions.js\`, including staff management, all workshops, XP, badge management, attendance and reporting. The in-app Team UI deliberately blocks assigning this role.

The manual provisioning script \`scripts/promoteExistingSuperAdmin.mjs\` is for an **already active** administrator in Cosmos DB who owns an active, email-verified Firebase Auth identity. It is not a login bypass and does not create an account. Access requires an existing, verified, active authorizing Super Admin, authorized Firebase Admin/Cosmos credentials, explicit environment confirmation, and an operator-run command. No automated or publicly callable promotion exists.

1. Confirm the target employee's identity with SAIT and exact SAIT email. For the currently documented Abdullah account, check that the signed-in email is \`Abdullah.Rafih@sait.ca\` — **never assume a display name is enough**.
2. On a trusted workstation, configure \`.env.local\` with existing Firebase Admin and Cosmos credentials and the intended environment. Do not commit, email, or paste secrets into chat.
3. In PowerShell, use the actual email of a **different existing Super Admin**:

   \`\`\`powershell
   $env:TARGET_SUPER_ADMIN_EMAIL="Abdullah.Rafih@sait.ca"
   $env:AUTHORIZING_SUPER_ADMIN_EMAIL="<current-super-admin>@sait.ca"
   node --env-file=.env.local scripts/promoteExistingSuperAdmin.mjs --dry-run
   \`\`\`

4. Review the dry-run result and authorization. Only then confirm the change:

   \`\`\`powershell
   $env:CONFIRM_SUPER_ADMIN_PROMOTION="YES_I_APPROVE_THIS_PROMOTION"
   node --env-file=.env.local scripts/promoteExistingSuperAdmin.mjs --confirm
   Remove-Item Env:\CONFIRM_SUPER_ADMIN_PROMOTION
   Remove-Item Env:\TARGET_SUPER_ADMIN_EMAIL
   Remove-Item Env:\AUTHORIZING_SUPER_ADMIN_EMAIL
   \`\`\`

5. The script checks both verified Firebase identities and both Cosmos admin records, rejects disabled/pending/unknown-role users, writes a pre-change audit event, updates the existing record with an ETag check, writes the completion audit event, and reads the new role back. It preserves the account's MFA configuration.
6. Have Abdullah sign out and sign back in, complete existing MFA, and open **Team & access**, **Audit activity**, workshops and other Super Admin features. Existing sessions may cache old UI permissions until refresh; API permissions are derived from current Cosmos records. Confirm from a test admin account that role assignment still requires full authorization.

If the script reports that the target is pending/unverified, resolve that account state through the normal verification/access approval process first. This procedure does not change any live database until an authorized operator executes \`--confirm\` against the intended environment.
