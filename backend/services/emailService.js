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

/** Prefer Google Drive webViewLink; fall back to file-id URL or other storage URL. */
function resolveDrivePdfLink(storageInfo = {}) {
  const drive = storageInfo.drive || {};
  if (drive.pdfUrl) return drive.pdfUrl;
  if (drive.pdfFileId) {
    return `https://drive.google.com/file/d/${drive.pdfFileId}/view`;
  }
  if (storageInfo.storage === "google_drive" && storageInfo.pdfUrl) {
    return storageInfo.pdfUrl;
  }
  return storageInfo.pdfUrl || null;
}

/**
 * Send a short org notification when a new assessment is submitted.
 * No PDF attachment — includes the Google Drive PDF link when available.
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
  const drivePdfLink = resolveDrivePdfLink(storageInfo);
  const driveFileName = storageInfo.drive?.pdfName || null;

  const transporter = createTransport();
  const info = await transporter.sendMail({
    from,
    to,
    subject: `[Zylk] New assessment — ${reportId} (${name})`,
    text: [
      "New Hair & Scalp Assessment submitted.",
      "",
      `Report ID: ${reportId}`,
      `Date: ${reportDate || "—"}`,
      `Patient: ${name}`,
      `Stage: ${stage}`,
      aboutMe.whatsapp ? `WhatsApp: ${aboutMe.whatsapp}` : "",
      aboutMe.email ? `Email: ${aboutMe.email}` : "",
      "",
      drivePdfLink
        ? `Open PDF in Google Drive:\n${drivePdfLink}`
        : "Google Drive PDF link is not available yet. Check the Drive assessment folder.",
      driveFileName ? `Drive file: ${driveFileName}` : "",
      "",
      "PDF is not attached to this email — use the Drive link above.",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5">
        <h2 style="color:#064e3b;margin:0 0 12px">New assessment notification</h2>
        <p style="margin:0 0 12px">A new Hair &amp; Scalp Assessment was submitted.</p>
        <p style="margin:0 0 16px">
          <strong>Report ID:</strong> ${reportId}<br/>
          <strong>Date:</strong> ${reportDate || "—"}<br/>
          <strong>Patient:</strong> ${name}<br/>
          <strong>Stage:</strong> ${stage}
          ${aboutMe.whatsapp ? `<br/><strong>WhatsApp:</strong> ${aboutMe.whatsapp}` : ""}
          ${aboutMe.email ? `<br/><strong>Email:</strong> ${aboutMe.email}` : ""}
        </p>
        ${
          drivePdfLink
            ? `<p style="margin:0 0 8px">
                <a href="${drivePdfLink}"
                   style="display:inline-block;background:#064e3b;color:#fff;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:8px">
                  Open PDF in Google Drive
                </a>
              </p>
              <p style="margin:0 0 12px;font-size:13px;color:#555;word-break:break-all">
                ${drivePdfLink}
              </p>
              ${
                driveFileName
                  ? `<p style="margin:0 0 12px;font-size:13px;color:#555"><strong>Drive file:</strong> ${driveFileName}</p>`
                  : ""
              }`
            : `<p style="margin:0 0 12px;color:#b45309">
                 Google Drive PDF link is not available. Check the Drive assessment folder for report <strong>${reportId}</strong>.
               </p>`
        }
        <p style="margin:0;color:#666;font-size:13px">PDF is not attached — use the Google Drive link.</p>
      </div>
    `,
  });

  return {
    skipped: false,
    messageId: info.messageId,
    to,
    notificationOnly: true,
    drivePdfLink,
  };
}

export { isEmailConfigured };
