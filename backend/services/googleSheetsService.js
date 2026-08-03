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

export function getSheetsStatus() {
  return {
    configured: isSheetsConfigured(),
    hasSpreadsheetId: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID),
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
    range: sheetsRange(),
    authMode: hasOAuthConfig()
      ? "oauth"
      : hasServiceAccountConfig()
        ? "service_account"
        : "none",
  };
}

function improveSheetsError(err) {
  const message = err?.message || String(err);

  if (/invalid_grant/i.test(message)) {
    return [
      "invalid_grant — Google OAuth refresh token is expired or revoked.",
      "Fix on VPS: cd ~/Assessment/backend && node scripts/get-google-oauth-token.js",
      "Approve Drive + Sheets, paste the new GOOGLE_DRIVE_REFRESH_TOKEN into .env,",
      "then: pm2 restart assessment-api --update-env",
    ].join(" ");
  }

  if (
    /insufficient|ACCESS_TOKEN_SCOPE|Request had insufficient authentication scopes/i.test(
      message
    )
  ) {
    return [
      message,
      "Fix: regenerate OAuth with Sheets scope — from backend/ run: node scripts/get-google-oauth-token.js",
      "Then update GOOGLE_DRIVE_REFRESH_TOKEN and pm2 restart assessment-api --update-env.",
    ].join(" ");
  }

  if (/permission|does not have permission|forbidden|403/i.test(message)) {
    return [
      message,
      "Share the Sheet as Editor with the Google account behind your OAuth refresh token (or the service account email).",
    ].join(" ");
  }

  if (/not found|Unable to parse range|Unable to parse/i.test(message)) {
    return [
      message,
      "Check GOOGLE_SHEETS_SPREADSHEET_ID matches the Sheet URL and GOOGLE_SHEETS_RANGE tab name (default Sheet1!A:L).",
    ].join(" ");
  }

  return message;
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

/** Build one Sheet row (A–L) for a lead. */
export function buildLeadRow({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
  reportMeta = {},
  resultPageUrl = null,
  pdfUrl = null,
} = {}) {
  return [
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
}

/**
 * Append many lead rows in one Sheets write (much lower quota use than 1-by-1).
 */
export async function appendLeadRowsBatch(rows) {
  if (!isSheetsConfigured()) {
    return {
      skipped: true,
      reason:
        "Google Sheets not configured — set GOOGLE_SHEETS_SPREADSHEET_ID and Google OAuth/service-account credentials",
    };
  }
  if (!Array.isArray(rows) || !rows.length) {
    return { ok: true, skipped: true, reason: "no_rows", count: 0 };
  }

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const range = sheetsRange();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });
    const updatedRange = response?.data?.updates?.updatedRange || null;
    console.log(
      `[sheets] batch appended ${rows.length} row(s)${updatedRange ? ` → ${updatedRange}` : ""}`
    );
    return {
      ok: true,
      skipped: false,
      spreadsheetId,
      updatedRange,
      count: rows.length,
    };
  } catch (err) {
    const message = improveSheetsError(err);
    console.error("[sheets] batch append failed:", message);
    return {
      ok: false,
      skipped: false,
      error: message,
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
      count: 0,
    };
  }
}

/**
 * Append one lead row to the team Google Sheet.
 * Columns A–L:
 * Date | Report ID | Name | Phone | Email | Gender | Age | AI Stage | Kit | Result Link | PDF Link | Call Status
 *
 * Never throws to the quiz flow — returns { skipped|ok|error }.
 */
export async function appendLeadToGoogleSheet(lead) {
  if (!isSheetsConfigured()) {
    return {
      skipped: true,
      reason:
        "Google Sheets not configured — set GOOGLE_SHEETS_SPREADSHEET_ID and Google OAuth/service-account credentials",
    };
  }

  const row = buildLeadRow(lead);
  const batch = await appendLeadRowsBatch([row]);
  if (batch.ok) {
    console.log(
      `[sheets] appended lead ${lead.reportId}${batch.updatedRange ? ` → ${batch.updatedRange}` : ""}`
    );
    return {
      ok: true,
      skipped: false,
      spreadsheetId: batch.spreadsheetId,
      updatedRange: batch.updatedRange,
      row,
    };
  }
  return {
    ok: false,
    skipped: Boolean(batch.skipped),
    error: batch.error || batch.reason,
    spreadsheetId: batch.spreadsheetId || null,
  };
}

/**
 * Live probe: open the configured spreadsheet (read metadata + first header row).
 * Use from /api/health?probeSheets=1 or scripts/test-google-sheets.js.
 */
export async function probeGoogleSheets() {
  if (!isSheetsConfigured()) {
    return {
      ok: false,
      skipped: true,
      reason: "not_configured",
      ...getSheetsStatus(),
    };
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const range = sheetsRange();

  try {
    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "spreadsheetId,properties.title,sheets.properties.title",
    });
    const title = meta?.data?.properties?.title || null;
    const tabNames = (meta?.data?.sheets || [])
      .map((s) => s?.properties?.title)
      .filter(Boolean);

    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range.includes("!") ? range.replace(/![^!]+$/, "!A1:L1") : "A1:L1",
    });

    return {
      ok: true,
      skipped: false,
      spreadsheetId,
      title,
      tabNames,
      range,
      headerRow: header?.data?.values?.[0] || [],
      authMode: getSheetsStatus().authMode,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      spreadsheetId,
      range,
      error: improveSheetsError(err),
      authMode: getSheetsStatus().authMode,
    };
  }
}
