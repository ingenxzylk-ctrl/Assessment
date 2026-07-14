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
 * Send a short org notification when a new assessment is submitted.
 * Does not attach the PDF — the report remains in storage / Drive.
 * Skips (returns { skipped: true }) when SMTP/ORG_REPORT_EMAIL are not configured.
 */
export async function sendReportToOrganisation({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
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
  const storageLink = storageInfo.pdfUrl || null;

  const transporter = createTransport();
  const info = await transporter.sendMail({
    from,
    to,
    subject: `[Zylk] New assessment notification — ${reportId}`,
    text: [
      "New Hair & Scalp Assessment submitted.",
      "",
      `Report ID: ${reportId}`,
      `Date: ${reportDate || "—"}`,
      `Patient: ${name}`,
      `Stage: ${stage}`,
      aboutMe.whatsapp ? `WhatsApp: ${aboutMe.whatsapp}` : "",
      aboutMe.email ? `Email: ${aboutMe.email}` : "",
      storageLink ? `Report link: ${storageLink}` : "",
      "",
      "This is a notification only — the PDF is not attached.",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
        <h2 style="color:#064e3b;margin:0 0 12px">New assessment notification</h2>
        <p style="margin:0 0 12px">A new Hair &amp; Scalp Assessment was submitted.</p>
        <p style="margin:0 0 12px">
          <strong>Report ID:</strong> ${reportId}<br/>
          <strong>Date:</strong> ${reportDate || "—"}<br/>
          <strong>Patient:</strong> ${name}<br/>
          <strong>Stage:</strong> ${stage}
          ${aboutMe.whatsapp ? `<br/><strong>WhatsApp:</strong> ${aboutMe.whatsapp}` : ""}
          ${aboutMe.email ? `<br/><strong>Email:</strong> ${aboutMe.email}` : ""}
        </p>
        ${
          storageLink
            ? `<p style="margin:0 0 12px"><a href="${storageLink}" style="color:#064e3b;font-weight:bold">Open report</a></p>`
            : ""
        }
        <p style="margin:0;color:#666;font-size:13px">Notification only — PDF is not attached.</p>
      </div>
    `,
  });

  return {
    skipped: false,
    messageId: info.messageId,
    to,
    notificationOnly: true,
  };
}

export { isEmailConfigured };
