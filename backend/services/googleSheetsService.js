import { google } from "googleapis";
import {
  hasOAuthConfig,
  hasServiceAccountConfig,
} from "./googleDriveService.js";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// A–O now (was A–N). New column O = Kit Link.
const DEFAULT_RANGE = "Sheet1!A:O";
const CALL_STATUS_NEW = "New";

// Fixed column order. NEVER conditionally skip a column — every entry
// below must always push a value (even "") so nothing downstream shifts.
// A: Date | B: Report ID | C: Name | D: Phone | E: Email | F: City |
// G: Pincode | H: Gender | I: Age | J: AI Stage | K: Kit Name |
// L: Result Link | M: PDF Link | N: Call Status | O: Kit Link (checkout)
const LEAD_ROW_COLUMNS = 15;

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
      "Check GOOGLE_SHEETS_SPREADSHEET_ID matches the Sheet URL and GOOGLE_SHEETS_RANGE tab name (default Sheet1!A:O).",
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

/** Kit NAME column (text only — no link here anymore). */
function formatKitName(reportMeta = {}) {
  const bundle = reportMeta.recommendedBundle || {};
  return cell(bundle.bundleTitle || bundle.bundleId || bundle.name || "");
}

const LIVE_WP_BASE = "https://zylkhealth.com";

function isLoopbackUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(String(value || ""));
  }
}

/**
 * Kit LINK column — a real, clickable purchase link for the recommended kit.
 *
 * Priority order:
 *   1. reportMeta.recommendedBundle.checkoutUrl — this is the SAME link
 *      Result.jsx builds for the "Buy Now" button (generatedCheckoutUrl),
 *      so it always matches what the customer would actually click.
 *   2. A numeric WooCommerce product id on the first bundle item → direct
 *      add-to-cart checkout link.
 *   3. A slug/catalog id on the first bundle item → product page link.
 *   4. Empty string if none of the above is available (e.g. doctor-consult
 *      cases with no recommended bundle).
 */
function formatKitLink(reportMeta = {}) {
  const bundle = reportMeta.recommendedBundle || {};

  const checkoutUrl = cell(bundle.checkoutUrl);
  if (checkoutUrl && !isLoopbackUrl(checkoutUrl)) {
    return checkoutUrl;
  }

  const wpBase = (
    process.env.WP_SITE_URL ||
    process.env.PUBLIC_WP_SITE_URL ||
    LIVE_WP_BASE
  ).replace(/\/$/, "");

  const firstProductId = bundle?.products?.[0]?.id;
  if (firstProductId != null) {
    const asString = String(firstProductId).trim();
    if (/^\d+$/.test(asString)) {
      // Numeric Woo product ID → direct add-to-cart checkout link
      return cell(`${wpBase}/checkout-link/?products=${encodeURIComponent(asString)}`);
    }
    // Slug/catalog id → product page
    return cell(`${wpBase}/product/${encodeURIComponent(asString)}`);
  }

  return "";
}

const LIVE_API_BASE = "https://api.zylkhealth.com";

function isLoopbackApiUrl(value) {
  return isLoopbackUrl(value);
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
 * Pad/trim a row to exactly LEAD_ROW_COLUMNS entries.
 * Belt-and-braces guard: if a future edit adds/removes a field and
 * forgets to update every call site, this stops columns from silently
 * shifting instead of failing loudly in logs.
 */
function normalizeRowLength(row) {
  const out = row.slice(0, LEAD_ROW_COLUMNS);
  while (out.length < LEAD_ROW_COLUMNS) out.push("");
  if (row.length !== LEAD_ROW_COLUMNS) {
    console.warn(
      `[sheets] row had ${row.length} cells, expected ${LEAD_ROW_COLUMNS} — padded/trimmed to avoid column drift`
    );
  }
  return out;
}

/** Build one Sheet row (A–O) for a lead. */
export function buildLeadRow({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
  reportMeta = {},
  resultPageUrl = null,
  pdfUrl = null,
} = {}) {
  const row = [
    cell(reportDate) || new Date().toLocaleDateString("en-GB"), // A: Date
    cell(reportId),                                              // B: Report ID
    cell(aboutMe.fullName || aboutMe.name || "Guest"),            // C: Name
    formatPhone(aboutMe),                                         // D: Phone
    cell(aboutMe.email),                                          // E: Email
    cell(aboutMe.city || ""),                                     // F: City
    cell(aboutMe.pincode || ""),                                  // G: Pincode
    cell(aboutMe.gender),                                         // H: Gender
    cell(aboutMe.age || aboutMe.ageRange),                        // I: Age
    formatStage(scalpAnalysis),                                   // J: AI Stage
    formatKitName(reportMeta),                                    // K: Kit Name
    cell(resultPageUrl),                                          // L: Result Link
    resolveSheetPdfUrl(reportId, pdfUrl),                         // M: PDF Link
    CALL_STATUS_NEW,                                              // N: Call Status
    formatKitLink(reportMeta),                                    // O: Kit Link (NEW)
  ];

  return normalizeRowLength(row);
}

function sheetTabName() {
  const range = sheetsRange();
  const tab = range.includes("!") ? range.split("!")[0].trim() : "Sheet1";
  return tab || "Sheet1";
}

/**
 * Find the next empty row after real lead data (column B = Report ID).
 * Ignores pre-formatted blank rows / dropdown-only formatting that make
 * values.append jump to row 1000+.
 */
async function findNextLeadRow(sheets, spreadsheetId) {
  const tab = sheetTabName();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!B:B`,
    majorDimension: "COLUMNS",
  });
  const col = res?.data?.values?.[0] || [];
  // Row 1 is header. Find last row with a real Report ID (or any non-empty B).
  let lastDataRow = 1;
  for (let i = 1; i < col.length; i += 1) {
    const v = String(col[i] || "").trim();
    if (!v) continue;
    if (/^report\s*id$/i.test(v)) continue;
    lastDataRow = i + 1; // 1-based sheet row
  }
  return lastDataRow + 1;
}

/**
 * Write many lead rows starting at the first empty data row (A2 if empty).
 * Uses values.update (not append) so pre-filled Call Status dropdowns
 * don't push new leads thousands of rows down the sheet.
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
    const tab = sheetTabName();
    const startRow = await findNextLeadRow(sheets, spreadsheetId);
    const endRow = startRow + rows.length - 1;

    // Always use the fixed schema width, not just the first row's length,
    // so a short/malformed row never truncates the target range.
    function colLetter(n) {
      let s = "";
      while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
      }
      return s || "A";
    }
    const endCol = colLetter(LEAD_ROW_COLUMNS);
    const targetRange = `${tab}!A${startRow}:${endCol}${endRow}`;

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: targetRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    const updatedRange = response?.data?.updatedRange || targetRange;
    console.log(
      `[sheets] wrote ${rows.length} row(s) at ${updatedRange} (start row ${startRow})`
    );
    return {
      ok: true,
      skipped: false,
      spreadsheetId,
      updatedRange,
      startRow,
      count: rows.length,
    };
  } catch (err) {
    const message = improveSheetsError(err);
    console.error("[sheets] batch write failed:", message);
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
 * Columns A–O:
 * Date | Report ID | Name | Phone | Email | City | Pincode | Gender | Age |
 * AI Stage | Kit Name | Result Link | PDF Link | Call Status | Kit Link
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

    const tab = sheetTabName();
    // Read first header row using current configured range's end column
    const headerEndCol = (sheetsRange() || DEFAULT_RANGE).includes("!")
      ? sheetsRange().split("!")[1].replace(/\d+/g, "")
      : "O";
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:${headerEndCol}1`,
    });
    const nextRow = await findNextLeadRow(sheets, spreadsheetId);
    const previewStart = Math.max(2, nextRow - 3);
    const preview = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A${previewStart}:C${Math.max(previewStart, nextRow - 1)}`,
    });

    return {
      ok: true,
      skipped: false,
      spreadsheetId,
      title,
      tabNames,
      range,
      headerRow: header?.data?.values?.[0] || [],
      nextWriteRow: nextRow,
      dataRowCount: Math.max(0, nextRow - 2),
      recentRows: preview?.data?.values || [],
      hint:
        nextRow <= 2
          ? "Sheet has no lead rows yet — next write goes to row 2 (under the header)."
          : `Sheet has ${nextRow - 2} lead row(s). Next write starts at row ${nextRow}. If you do not see data, clear filters and jump to row 2.`,
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