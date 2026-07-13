import nodemailer from "nodemailer";

function isEmailConfigured() {
  return Boolean(
    process.env.ORG_REPORT_EMAIL &&
      (process.env.SMTP_HOST || process.env.SMTP_URL) &&
      (process.env.SMTP_USER || process.env.SMTP_URL)
  );
}

function createTransport() {
  if (process.env.SMTP_URL) {
    return nodemailer.createTransport(process.env.SMTP_URL);
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Email the PDF to the organisation inbox.
 * Skips (returns { skipped: true }) when SMTP/ORG_REPORT_EMAIL are not configured.
 */
export async function sendReportToOrganisation({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
  pdfBuffer,
  storageInfo = {},
}) {
  if (!isEmailConfigured()) {
    console.warn(
      "[email] ORG_REPORT_EMAIL / SMTP not configured — skipping org email. PDF still saved to storage."
    );
    return { skipped: true, reason: "email_not_configured" };
  }

  const to = process.env.ORG_REPORT_EMAIL;
  const from =
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    "noreply@zylkhealth.com";

  const stage =
    scalpAnalysis.aiPredictedStage || scalpAnalysis.finalStage || "—";
  const name = aboutMe.fullName || "Guest";

  const transporter = createTransport();
  const info = await transporter.sendMail({
    from,
    to,
    subject: `[Zylk Assessment] ${reportId} — ${name} (Stage ${stage})`,
    text: [
      "A new Hair & Scalp Assessment report is ready.",
      "",
      `Report ID: ${reportId}`,
      `Date: ${reportDate || "—"}`,
      `Patient: ${name}`,
      `Email: ${aboutMe.email || "—"}`,
      `WhatsApp: ${aboutMe.whatsapp || "—"}`,
      `Gender: ${aboutMe.gender || "—"}`,
      `AI Stage: ${stage}`,
      storageInfo.pdfUrl ? `Google Drive / storage link: ${storageInfo.pdfUrl}` : "",
      storageInfo.drive?.pdfName ? `Drive file: ${storageInfo.drive.pdfName}` : "",
      storageInfo.pdfPath && storageInfo.storage === "local"
        ? `Local path: ${storageInfo.pdfPath}`
        : "",
      "",
      "The PDF is attached to this email.",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111">
        <h2 style="color:#064e3b">New Hair &amp; Scalp Assessment Report</h2>
        <p><strong>Report ID:</strong> ${reportId}<br/>
        <strong>Date:</strong> ${reportDate || "—"}<br/>
        <strong>Patient:</strong> ${name}<br/>
        <strong>Email:</strong> ${aboutMe.email || "—"}<br/>
        <strong>WhatsApp:</strong> ${aboutMe.whatsapp || "—"}<br/>
        <strong>Gender:</strong> ${aboutMe.gender || "—"}<br/>
        <strong>AI Stage:</strong> ${stage}</p>
        ${
          storageInfo.pdfUrl
            ? `<p><a href="${storageInfo.pdfUrl}" style="color:#064e3b;font-weight:bold">Open PDF in Google Drive</a></p>`
            : ""
        }
        <p>The PDF is also attached to this email.</p>
      </div>
    `,
    attachments: [
      {
        filename: `${reportId}-assessment.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return {
    skipped: false,
    messageId: info.messageId,
    to,
  };
}

export { isEmailConfigured };
