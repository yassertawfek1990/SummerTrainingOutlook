import nodemailer from "nodemailer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function send(params: { to: string; subject: string; html: string }) {
  const transporter = getTransporter();
  const fromName = process.env.GMAIL_SENDER_NAME || "Course Team";

  return transporter.sendMail({
    from: `"${fromName}" <${process.env.GMAIL_USER}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

export async function sendPdfEmail(params: {
  to: string;
  studentName: string;
  topicName: string;
  dayId: string;
}) {
  const pdfUrl = `${SITE_URL}/api/pdf/${params.dayId}`;
  return send({
    to: params.to,
    subject: params.topicName,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2>Hi ${params.studentName},</h2>
        <p>Today's lesson is ready: <strong>${params.topicName}</strong></p>
        <p>
          <a href="${pdfUrl}" style="display:inline-block;background:#1a1a2e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">
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
