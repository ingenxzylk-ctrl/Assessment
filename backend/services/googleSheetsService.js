import { google } from "googleapis";
import {
  hasOAuthConfig,
  hasServiceAccountConfig,
} from "./googleDriveService.js";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const DEFAULT_RANGE = "Sheet1!A:L";
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

/**
 * Format phone for Google Sheets.
 * Values starting with "+" become #ERROR! under USER_ENTERED (treated as formulas),
 * so we force a text value with a leading apostrophe.
 */
function formatPhone(aboutMe = {}) {
  const code = cell(aboutMe.countryCode) || "+91";
  let phone = cell(aboutMe.whatsapp || aboutMe.phone || aboutMe.mobile);
  if (!phone) return "";

  // Digits only for the local number part when possible
  const digits = phone.replace(/[^\d]/g, "");
  let display = phone;

  if (phone.startsWith("+")) {
    display = phone.replace(/\s+/g, " ");
  } else if (code.startsWith("+") && digits) {
    // Avoid duplicating country code if already prefixed as digits (e.g. 91XXXXXXXXXX)
    const codeDigits = code.replace(/[^\d]/g, "");
    if (digits.startsWith(codeDigits) && digits.length > codeDigits.length) {
      display = `+${digits}`;
    } else {
      display = `${code} ${digits}`.trim();
    }
  } else if (digits) {
    display = digits;
  }

  // Leading ' makes Sheets store as plain text (not a formula)
  return `'${display}`;
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

const LIVE_API_BASE = "https://api.zylkhealth.com";

function isLoopbackApiUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(String(value || ""));
  }
}

/**
 * Build the public VPS PDF URL for a report.
 * Always prefers the live API for Sheet links (never localhost).
 */
export function buildPublicPdfUrl(reportId, explicitBase = null) {
  const id = cell(reportId);
  if (!id) return "";

  let base = String(
    explicitBase ||
      process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_BASE_URL ||
      LIVE_API_BASE
  ).replace(/\/$/, "");

  // Sheet / team links must be reachable — never write localhost
  if (!base || isLoopbackApiUrl(base)) {
    base = LIVE_API_BASE;
  }

  const root = base.endsWith("/api") ? base : `${base}/api`;
  return `${root}/report/${encodeURIComponent(id)}/pdf`;
}

function resolveSheetPdfUrl(reportId, pdfUrl) {
  const candidate = cell(pdfUrl);
  if (candidate && !isLoopbackApiUrl(candidate)) return candidate;
  return buildPublicPdfUrl(reportId);
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
      resolveSheetPdfUrl(reportId, pdfUrl),
      CALL_STATUS_NEW,
    ];

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      // USER_ENTERED makes Result/PDF links clickable; phone is prefixed with ' for text
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
