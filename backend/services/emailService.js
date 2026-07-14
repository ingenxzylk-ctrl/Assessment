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

/** Prefer Google Drive webViewLink; fall back to file-id URL. */
function resolveDrivePdfLink(storageInfo = {}) {
  const drive = storageInfo.drive || {};
  if (drive.pdfUrl) return drive.pdfUrl;
  if (storageInfo.storage === "google_drive" && storageInfo.pdfUrl) {
    return storageInfo.pdfUrl;
  }
  if (drive.pdfFileId) {
    return `https://drive.google.com/file/d/${drive.pdfFileId}/view`;
  }
  return null;
}

/**
 * Org notification only — NEVER attaches the PDF.
 * Body = new-customer notice + Google Drive PDF link.
 */
export async function sendReportToOrganisation({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
  storageInfo = {},
  // Intentionally ignored if a caller still passes it
  pdfBuffer: _ignoredPdfBuffer,
}) {
  if (_ignoredPdfBuffer) {
    console.warn(
      "[email] pdfBuffer was passed but will NOT be attached. Org mail is notification-only."
    );
  }

  if (!isEmailConfigured()) {
    console.warn(
      "[email] ORG_REPORT_EMAIL / SMTP not configured — skipping org email. PDF still saved to Drive/storage."
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

  const mailOptions = {
    from,
    to,
    subject: `[Zylk] New customer took the assessment — ${name}`,
    text: [
      "NOTIFICATION (no PDF attached)",
      "",
      "A new customer took the Hair & Scalp Assessment.",
      "",
      `Customer: ${name}`,
      `Report ID: ${reportId}`,
      `Date: ${reportDate || "—"}`,
      `Stage: ${stage}`,
      aboutMe.whatsapp ? `WhatsApp: ${aboutMe.whatsapp}` : "",
      aboutMe.email ? `Email: ${aboutMe.email}` : "",
      "",
      "PDF in Google Drive (open this link):",
      drivePdfLink ||
        "(Drive link unavailable — check the Google Drive assessment folder)",
      driveFileName ? `File name: ${driveFileName}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#111;line-height:1.5;max-width:560px">
        <p style="margin:0 0 8px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.04em">
          Notification only · PDF not attached
        </p>
        <h2 style="color:#064e3b;margin:0 0 12px">New customer took the assessment</h2>
        <p style="margin:0 0 16px">
          A new customer completed the Hair &amp; Scalp Assessment.
        </p>
        <p style="margin:0 0 20px">
          <strong>Customer:</strong> ${name}<br/>
          <strong>Report ID:</strong> ${reportId}<br/>
          <strong>Date:</strong> ${reportDate || "—"}<br/>
          <strong>Stage:</strong> ${stage}
          ${aboutMe.whatsapp ? `<br/><strong>WhatsApp:</strong> ${aboutMe.whatsapp}` : ""}
          ${aboutMe.email ? `<br/><strong>Email:</strong> ${aboutMe.email}` : ""}
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px" />
        <p style="margin:0 0 8px;font-weight:bold;color:#111">PDF in Google Drive</p>
        ${
          drivePdfLink
            ? `<p style="margin:0 0 8px">
                <a href="${drivePdfLink}"
                   style="display:inline-block;background:#064e3b;color:#fff;text-decoration:none;font-weight:bold;padding:10px 16px;border-radius:8px">
                  Open PDF in Drive
                </a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#555;word-break:break-all">
                ${drivePdfLink}
              </p>
              ${
                driveFileName
                  ? `<p style="margin:0;font-size:13px;color:#555"><strong>File:</strong> ${driveFileName}</p>`
                  : ""
              }`
            : `<p style="margin:0;color:#b45309">
                 Drive link not available for <strong>${reportId}</strong>. Check the Google Drive assessment folder.
               </p>`
        }
      </div>
    `,
    // Explicitly empty — never attach assessment PDF
    attachments: [],
  };

  const transporter = createTransport();
  console.log(
    `[email] Sending notification-only mail to ${to} for ${reportId} (attachments=${mailOptions.attachments.length}, driveLink=${drivePdfLink ? "yes" : "no"})`
  );
  const info = await transporter.sendMail(mailOptions);

  return {
    skipped: false,
    messageId: info.messageId,
    to,
    notificationOnly: true,
    attachmentsCount: 0,
    drivePdfLink,
  };
}

export { isEmailConfigured };
