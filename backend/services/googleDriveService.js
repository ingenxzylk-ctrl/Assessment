import { google } from "googleapis";
import { Readable } from "stream";

function isDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_FOLDER_ID &&
      (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
        (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
          process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY))
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

  // GOOGLE_APPLICATION_CREDENTIALS path is picked up by GoogleAuth automatically.
  return null;
}

async function getDriveClient() {
  const credentials = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
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

  const drive = await getDriveClient();
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const safeName = String(patientName || "Guest")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .slice(0, 40) || "Guest";

  const pdfName = `${reportId}_${safeName}_assessment.pdf`;
  const jsonName = `${reportId}_${safeName}_assessment.json`;

  const pdfUpload = await drive.files.create({
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

  let jsonFile = null;
  if (jsonData) {
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
  }

  // Anyone-with-link view is optional; prefer folder shared with org accounts.
  // If GOOGLE_DRIVE_MAKE_LINK_PUBLIC=true, set reader permission on the PDF.
  if (String(process.env.GOOGLE_DRIVE_MAKE_LINK_PUBLIC || "").toLowerCase() === "true") {
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
    folderId,
    pdfFileId: pdfUpload.data.id,
    pdfName: pdfUpload.data.name,
    pdfUrl: pdfUpload.data.webViewLink || null,
    pdfDownloadUrl: pdfUpload.data.webContentLink || null,
    jsonFileId: jsonFile?.id || null,
    jsonUrl: jsonFile?.webViewLink || null,
  };
}

export { isDriveConfigured };
