import { ConfidentialClientApplication } from "@azure/msal-node";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
  },
});

// Client-credentials flow: the app authenticates as itself (no signed-in user
// needed), which is what an unattended cron job requires. Tokens are cached
// by msal-node automatically and refreshed a little before they expire.
async function getAccessToken(): Promise<string> {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!result?.accessToken) {
    throw new Error("Failed to acquire Microsoft Graph access token");
  }
  return result.accessToken;
}

async function send(params: { to: string; subject: string; html: string }) {
  const token = await getAccessToken();
  const senderMailbox = process.env.MICROSOFT_SENDER_EMAIL;

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderMailbox}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: "HTML", content: params.html },
          toRecipients: [{ emailAddress: { address: params.to } }],
        },
        saveToSentItems: false,
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Graph sendMail failed (${res.status}): ${errText}`);
  }
}

export async function sendPdfEmail(params: {
  to: string;
  studentName: string;
  topicName: string;
  pdfUrl: string;
}) {
  return send({
    to: params.to,
    subject: params.topicName,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Hi ${params.studentName},</h2>
        <p>Today's lesson is ready: <strong>${params.topicName}</strong></p>
        <p>
          <a href="${params.pdfUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">
            Open PDF
          </a>
        </p>
        <p>Or view it on your dashboard: <a href="${SITE_URL}/dashboard">${SITE_URL}/dashboard</a></p>
        <p>Remember, the quiz for this lesson unlocks tomorrow — make sure to complete it in time!</p>
      </div>
    `,
  });
}

export async function sendQuizEmail(params: {
  to: string;
  studentName: string;
  topicName: string;
  dayId: string;
}) {
  const quizUrl = `${SITE_URL}/quiz/${params.dayId}`;
  return send({
    to: params.to,
    subject: `Quiz: ${params.topicName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Hi ${params.studentName},</h2>
        <p>The quiz for <strong>${params.topicName}</strong> is now open.</p>
        <p>
          <a href="${quizUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">
            Take the Quiz
          </a>
        </p>
      </div>
    `,
  });
}
