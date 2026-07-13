import { google } from "googleapis";
import { Readable } from "stream";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function hasOAuthConfig() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

function hasServiceAccountConfig() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
  );
}

function isDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
      (hasOAuthConfig() || hasServiceAccountConfig())
  );
}

function loadServiceAccountCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  if (
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(
        /\\n/g,
        "\n"
      ),
    };
  }

  return null;
}

async function getDriveClient() {
  // Prefer OAuth (real user / Workspace user) — works with personal My Drive.
  if (hasOAuthConfig()) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET
    );
    oauth2.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });
    return google.drive({ version: "v3", auth: oauth2 });
  }

  // Service account — only works with Shared Drives (not personal My Drive).
  const credentials = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: [DRIVE_SCOPE],
  });
  return google.drive({ version: "v3", auth });
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

function improveDriveError(err) {
  const msg = err?.message || String(err);
  if (/storage quota|Service Accounts do not have storage quota/i.test(msg)) {
    return new Error(
      [
        "Google Drive upload failed: service accounts cannot store files in personal My Drive.",
        "Fix options:",
        "1) RECOMMENDED for personal Gmail: use OAuth instead — set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN (run: node scripts/get-google-drive-token.js).",
        "2) For Google Workspace: create a Shared Drive, add the service account as Content Manager, and set GOOGLE_DRIVE_FOLDER_ID to a folder inside that Shared Drive.",
      ].join(" ")
    );
  }
  return err;
}

/**
 * Upload assessment PDF (+ optional JSON) to a Google Drive folder.
 * Returns Drive file metadata including webViewLink for emailing.
 */
export async function uploadReportToGoogleDrive({
  reportId,
  pdfBuffer,
  jsonData,
  patientName = "Guest",
}) {
  if (!isDriveConfigured()) {
    return { skipped: true, reason: "google_drive_not_configured" };
  }

  let drive;
  try {
    drive = await getDriveClient();
  } catch (err) {
    throw improveDriveError(err);
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const authMode = hasOAuthConfig() ? "oauth" : "service_account";
  const safeName =
    String(patientName || "Guest")
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .slice(0, 40) || "Guest";

  const pdfName = `${reportId}_${safeName}_assessment.pdf`;
  const jsonName = `${reportId}_${safeName}_assessment.json`;

  let pdfUpload;
  try {
    pdfUpload = await drive.files.create({
      requestBody: {
        name: pdfName,
        parents: [folderId],
        description: `Zylk Hair & Scalp Assessment report ${reportId}`,
      },
      media: {
        mimeType: "application/pdf",
        body: bufferToStream(pdfBuffer),
      },
      fields: "id, name, webViewLink, webContentLink",
      supportsAllDrives: true,
    });
  } catch (err) {
    throw improveDriveError(err);
  }

  let jsonFile = null;
  if (jsonData) {
    try {
      const jsonUpload = await drive.files.create({
        requestBody: {
          name: jsonName,
          parents: [folderId],
          description: `Zylk assessment JSON archive ${reportId}`,
        },
        media: {
          mimeType: "application/json",
          body: bufferToStream(
            Buffer.from(JSON.stringify(jsonData, null, 2), "utf8")
          ),
        },
        fields: "id, name, webViewLink, webContentLink",
        supportsAllDrives: true,
      });
      jsonFile = jsonUpload.data;
    } catch (err) {
      console.warn("[drive] JSON upload failed (PDF ok):", err.message);
    }
  }

  if (
    String(process.env.GOOGLE_DRIVE_MAKE_LINK_PUBLIC || "").toLowerCase() ===
    "true"
  ) {
    try {
      await drive.permissions.create({
        fileId: pdfUpload.data.id,
        requestBody: { role: "reader", type: "anyone" },
        supportsAllDrives: true,
      });
    } catch (err) {
      console.warn("[drive] could not set public link permission:", err.message);
    }
  }

  return {
    skipped: false,
    storage: "google_drive",
    authMode,
    folderId,
    pdfFileId: pdfUpload.data.id,
    pdfName: pdfUpload.data.name,
    pdfUrl: pdfUpload.data.webViewLink || null,
    pdfDownloadUrl: pdfUpload.data.webContentLink || null,
    jsonFileId: jsonFile?.id || null,
    jsonUrl: jsonFile?.webViewLink || null,
  };
}

export { isDriveConfigured, hasOAuthConfig, hasServiceAccountConfig, DRIVE_SCOPE };
