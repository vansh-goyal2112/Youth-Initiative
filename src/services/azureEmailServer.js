import {
  EmailClient,
} from "@azure/communication-email";

let emailClient = null;

function getEmailClient() {
  if (
    emailClient
  ) {
    return emailClient;
  }

  const connectionString =
    process.env
      .AZURE_COMMUNICATION_EMAIL_CONNECTION_STRING;

  if (
    !connectionString
  ) {
    throw new Error(
      "AZURE_COMMUNICATION_EMAIL_CONNECTION_STRING environment variable is missing."
    );
  }

  emailClient =
    new EmailClient(
      connectionString
    );

  return emailClient;
}

function getSenderAddress() {
  const senderAddress =
    process.env
      .AZURE_EMAIL_SENDER_ADDRESS;

  if (
    !senderAddress
  ) {
    throw new Error(
      "AZURE_EMAIL_SENDER_ADDRESS environment variable is missing."
    );
  }

  return senderAddress;
}

function normalizeRecipients(
  recipients
) {
  const addresses =
    Array.isArray(
      recipients
    )
      ? recipients
      : [
          recipients,
        ];

  return addresses
    .filter(
      (address) =>
        typeof address ===
          "string" &&
        address.trim()
    )
    .map(
      (address) => ({
        address:
          address.trim(),
      })
    );
}

async function sendAzureEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}) {
  const recipients =
    normalizeRecipients(
      to
    );

  if (
    recipients.length ===
    0
  ) {
    throw new Error(
      "At least one email recipient is required."
    );
  }

  if (
    !subject ||
    typeof subject !==
      "string"
  ) {
    throw new Error(
      "Email subject is required."
    );
  }

  const message = {
    senderAddress:
      getSenderAddress(),

    recipients: {
      to:
        recipients,
    },

    content: {
      subject,

      plainText:
        text ||
        "",

      html:
        html ||
        "",
    },
  };

  if (
    replyTo &&
    typeof replyTo ===
      "string" &&
    replyTo.trim()
  ) {
    message.replyTo = [
      {
        address:
          replyTo.trim(),
      },
    ];
  }

  const client =
    getEmailClient();

  const poller =
    await client.beginSend(
      message
    );

  const result =
    await poller.pollUntilDone();

  if (
    result.status !==
      "Succeeded"
  ) {
    const errorMessage =
      result.error?.message ||
      "Azure Communication Services could not send the email.";

    throw new Error(
      errorMessage
    );
  }

  return {
    id:
      result.id,

    status:
      result.status,
  };
}

export {
  sendAzureEmail,
};