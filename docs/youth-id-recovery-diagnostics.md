# Youth ID recovery email — operations and diagnostics

The public \`/forgot-youth-id\` form returns a privacy-preserving result **even when no matching account exists**, is rate-limited, or Azure email send fails. Do not promise a message was delivered based solely on a successful API response.

- The form displays a random **support reference**. Look for \`Youth ID recovery status\` with that reference in **Azure Container Apps runtime logs**, not GitHub Actions build logs. Outcomes include \`rate_limited\`, \`no_eligible_account\`, \`azure_accepted\`, \`azure_delivery_failed\`, and \`request_failed\`. No email address or Youth ID is logged.
- For adult students, the account must be active and the email must match the **verified contactEmail**. For minors, recovery goes only to the registered **parentEmail** with approved consent, never to the child's unverified contact address. Email matches are now case-insensitive for older Cosmos records.
- Azure sends both **HTML and plain-text** content. \`azure_accepted\` only means Azure accepted the request; successful delivery to a mailbox cannot be established by the application.
- If \`azure_delivery_failed\`, verify that the container has the \`AZURE_COMMUNICATION_EMAIL_CONNECTION_STRING\` and \`AZURE_EMAIL_SENDER_ADDRESS\` environment settings, that the Azure sender domain is provisioned, and that the recipient address and mail filtering are correct. **Never print secret values.** Check Azure Communication Services Email operational logs / delivery telemetry.
- If \`azure_accepted\` but nothing arrives, inspect Spam/Junk and ask SAIT IT to review quarantine and message trace. Preserve the support reference and any Azure delivery operation ID for correlation.
- There is a cooldown of **60 seconds** and up to **5 attempts per hour** per requested email. Repeated clicks are not a valid delivery test.
- For testing, use a disposable verified adult account or a consenting guardian test account. Never send another student's Youth ID to an unverified address or use an admin impersonation route.

No changes to contact-email verification or parental-consent requirements are permitted as a delivery workaround.
