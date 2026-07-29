import { google } from "googleapis";
import {
  hasOAuthConfig,
  hasServiceAccountConfig,
} from "./googleDriveService.js";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const DEFAULT_RANGE = "Leads!A:L";
const CALL_STATUS_NEW = "New";

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

export function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
      (hasOAuthConfig() || hasServiceAccountConfig())
  );
}

async function getSheetsClient() {
  if (hasOAuthConfig()) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET
    );
    oauth2.setCredentials({
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    });
    return google.sheets({ version: "v4", auth: oauth2 });
  }

  const credentials = loadServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    ...(credentials ? { credentials } : {}),
    scopes: [SHEETS_SCOPE],
  });
  return google.sheets({ version: "v4", auth });
}

function sheetsRange() {
  return (
    String(process.env.GOOGLE_SHEETS_RANGE || DEFAULT_RANGE).trim() ||
    DEFAULT_RANGE
  );
}

function cell(value) {
  if (value == null) return "";
  return String(value).trim();
}

function formatPhone(aboutMe = {}) {
  const code = cell(aboutMe.countryCode);
  const phone = cell(aboutMe.whatsapp || aboutMe.phone);
  if (!phone) return "";
  if (!code) return phone;
  if (phone.startsWith("+") || phone.startsWith(code)) return phone;
  return `${code} ${phone}`.trim();
}

function formatStage(scalpAnalysis = {}) {
  const stage =
    scalpAnalysis.aiPredictedStage ||
    scalpAnalysis.finalStage ||
    scalpAnalysis.predictedStage ||
    "";
  return cell(stage);
}

function formatKit(reportMeta = {}) {
  const bundle = reportMeta.recommendedBundle || {};
  return cell(bundle.bundleTitle || bundle.bundleId || bundle.name || "");
}

/**
 * Build the public VPS PDF URL for a report.
 * Prefers PUBLIC_API_URL / API_PUBLIC_BASE_URL, else https://api.zylkhealth.com
 */
export function buildPublicPdfUrl(reportId, explicitBase = null) {
  const id = cell(reportId);
  if (!id) return "";
  const base = String(
    explicitBase ||
      process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_BASE_URL ||
      "https://api.zylkhealth.com"
  ).replace(/\/$/, "");
  const root = base.endsWith("/api") ? base : `${base}/api`;
  return `${root}/report/${encodeURIComponent(id)}/pdf`;
}

/**
 * Append one lead row to the team Google Sheet.
 * Columns A–L:
 * Date | Report ID | Name | Phone | Email | Gender | Age | AI Stage | Kit | Result Link | PDF Link | Call Status
 *
 * Never throws to the quiz flow — returns { skipped|ok|error }.
 */
export async function appendLeadToGoogleSheet({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
  reportMeta = {},
  resultPageUrl = null,
  pdfUrl = null,
} = {}) {
  if (!isSheetsConfigured()) {
    return {
      skipped: true,
      reason:
        "Google Sheets not configured — set GOOGLE_SHEETS_SPREADSHEET_ID and Google OAuth/service-account credentials",
    };
  }

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const range = sheetsRange();

    const row = [
      cell(reportDate) || new Date().toLocaleDateString("en-GB"),
      cell(reportId),
      cell(aboutMe.fullName || aboutMe.name || "Guest"),
      formatPhone(aboutMe),
      cell(aboutMe.email),
      cell(aboutMe.gender),
      cell(aboutMe.age || aboutMe.ageRange),
      formatStage(scalpAnalysis),
      formatKit(reportMeta),
      cell(resultPageUrl),
      cell(pdfUrl) || buildPublicPdfUrl(reportId),
      CALL_STATUS_NEW,
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    const updatedRange = response?.data?.updates?.updatedRange || null;
    console.log(
      `[sheets] appended lead ${reportId}${updatedRange ? ` → ${updatedRange}` : ""}`
    );

    return {
      ok: true,
      skipped: false,
      spreadsheetId,
      updatedRange,
      row,
    };
  } catch (err) {
    const message = err?.message || String(err);
    console.error("[sheets] append failed:", message);
    return {
      ok: false,
      skipped: false,
      error: message,
    };
  }
}
