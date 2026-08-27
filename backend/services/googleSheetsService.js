import { google } from "googleapis";
import {
  hasOAuthConfig,
  hasServiceAccountConfig,
} from "./googleDriveService.js";
import { formatPhoneForSheets } from "../utils/phone.js";
import {
  mergePurchaseStatus,
  PURCHASE_STATUS,
} from "../utils/purchaseStatus.js";
import { extraLeadCells } from "../utils/leadRow.js";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const DEFAULT_RANGE = "Sheet1!A:R";
const CALL_STATUS_NEW = "New";

/** A–L stay as they are so Call Status dropdowns on L are not shifted. */
export const LEAD_HEADERS = [
  "Date",
  "Report ID",
  "Name",
  "Phone",
  "Email",
  "Gender",
  "Age",
  "AI Stage",
  "Kit Link",
  "Result Link",
  "PDF Link",
  "Call Status",
  "Pincode",
  "City",
  "State",
  "Kit Name",
  "Purchased",
  "Order ID",
];

export const LEAD_COL = {
  DATE: 0,
  REPORT_ID: 1,
  NAME: 2,
  PHONE: 3,
  EMAIL: 4,
  GENDER: 5,
  AGE: 6,
  STAGE: 7,
  KIT_LINK: 8,
  RESULT: 9,
  PDF: 10,
  CALL_STATUS: 11,
  PINCODE: 12,
  CITY: 13,
  STATE: 14,
  KIT_NAME: 15,
  PURCHASED: 16,
  ORDER_ID: 17,
};

const LEAD_LAST_COL = "R";
const LEAD_WIDTH = LEAD_HEADERS.length;

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
 * Strips a pasted +91 / 0 prefix so the local 10 digits are kept (not truncated).
 */
function formatPhone(aboutMe = {}) {
  return formatPhoneForSheets(aboutMe);
}

function formatEmail(aboutMe = {}) {
  return cell(
    aboutMe.email ||
      aboutMe.emailAddress ||
      aboutMe.Email ||
      aboutMe.contactEmail ||
      ""
  );
}

function formatStage(scalpAnalysis = {}) {
  const stage =
    scalpAnalysis.aiPredictedStage ||
    scalpAnalysis.finalStage ||
    scalpAnalysis.predictedStage ||
    "";
  return cell(stage);
}

const LIVE_API_BASE = "https://api.zylkhealth.com";
const LIVE_SHOP_BASE = "https://zylkhealth.com";

/**
 * Static Woo product permalink. Plain GET of `?p=ID` — never add-to-cart —
 * so Sheet links cannot trigger the storefront CPU spike.
 */
export function buildKitProductUrl(wooProductId) {
  const id = Number(wooProductId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return `${LIVE_SHOP_BASE}/?p=${id}`;
}

function formatKit(reportMeta = {}) {
  const bundle = reportMeta.recommendedBundle || {};
  const explicit = cell(bundle.kitUrl);
  if (explicit && !isLoopbackApiUrl(explicit)) return explicit;
  const fromId = buildKitProductUrl(bundle.wooProductId || bundle.wooProductIdNoMix);
  if (fromId) return fromId;
  return "";
}

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

/** Build one Sheet row (A–R) for a lead. A–L are unchanged from the live sheet. */
export function buildLeadRow({
  reportId,
  reportDate,
  aboutMe = {},
  scalpAnalysis = {},
  reportMeta = {},
  resultPageUrl = null,
  pdfUrl = null,
  purchased = PURCHASE_STATUS.NO,
  orderId = "",
} = {}) {
  const row = [
    cell(reportDate) || new Date().toLocaleDateString("en-GB"),
    cell(reportId),
    cell(aboutMe.fullName || aboutMe.name || "Guest"),
    formatPhone(aboutMe),
    formatEmail(aboutMe),
    cell(aboutMe.gender),
    cell(aboutMe.age || aboutMe.ageRange),
    formatStage(scalpAnalysis),
    formatKit(reportMeta),
    cell(resultPageUrl),
    resolveSheetPdfUrl(reportId, pdfUrl),
    CALL_STATUS_NEW,
    ...extraLeadCells({ aboutMe, reportMeta, purchased, orderId }),
  ];
  while (row.length < LEAD_WIDTH) row.push("");
  return row.slice(0, LEAD_WIDTH);
}

function sheetTabName() {
  const range = sheetsRange();
  const tab = range.includes("!") ? range.split("!")[0].trim() : "Sheet1";
  return tab || "Sheet1";
}

/**
 * Write Pincode…Order ID headers in M1:R1 if those cells are empty.
 * Never rewrites A1:L1 (Call Status dropdown lives on L).
 */
async function ensureLeadHeaders(sheets, spreadsheetId, tab) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:${LEAD_LAST_COL}1`,
    });
    const existing = res?.data?.values?.[0] || [];
    const next = existing.slice();
    while (next.length < LEAD_WIDTH) next.push("");
    let changed = false;
    for (let i = LEAD_COL.PINCODE; i < LEAD_WIDTH; i += 1) {
      if (!String(next[i] || "").trim()) {
        next[i] = LEAD_HEADERS[i];
        changed = true;
      }
    }
    if (!changed) return;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!M1:${LEAD_LAST_COL}1`,
      valueInputOption: "RAW",
      requestBody: { values: [next.slice(LEAD_COL.PINCODE)] },
    });
  } catch (err) {
    console.warn("[sheets] could not ensure extra headers:", err?.message || err);
  }
}

function digitsLast10(raw) {
  const n = String(raw || "").replace(/\D/g, "");
  if (n.length >= 10) return n.slice(-10);
  return n;
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
    await ensureLeadHeaders(sheets, spreadsheetId, tab);
    const targetRange = `${tab}!A${startRow}:${LEAD_LAST_COL}${endRow}`;

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
 * Columns A–R:
 * Date | Report ID | Name | Phone | Email | Gender | Age | AI Stage | Kit Link | Result Link | PDF Link | Call Status
 * | Pincode | City | State | Kit Name | Purchased | Order ID
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
    const header = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A1:${LEAD_LAST_COL}1`,
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

/**
 * Find a lead row by Report ID, then phone, then email.
 * Returns 1-based sheet row number or null.
 */
export async function findLeadRowNumber({ reportId, phone, email } = {}) {
  if (!isSheetsConfigured()) return null;
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tab = sheetTabName();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!B:E`,
  });
  const rows = res?.data?.values || [];
  const wantId = String(reportId || "").trim().toUpperCase();
  const wantPhone = digitsLast10(phone);
  const wantEmail = String(email || "").trim().toLowerCase();

  if (wantId) {
    for (let i = 1; i < rows.length; i += 1) {
      if (String(rows[i]?.[0] || "").trim().toUpperCase() === wantId) {
        return i + 1;
      }
    }
  }
  if (wantPhone && wantPhone.length === 10) {
    for (let i = rows.length - 1; i >= 1; i -= 1) {
      if (digitsLast10(rows[i]?.[2]) === wantPhone) return i + 1;
    }
  }
  if (wantEmail && wantEmail.includes("@")) {
    for (let i = rows.length - 1; i >= 1; i -= 1) {
      if (String(rows[i]?.[3] || "").trim().toLowerCase() === wantEmail) {
        return i + 1;
      }
    }
  }
  return null;
}

/**
 * Update Purchased / Order ID on an existing lead. Does not touch Call Status.
 */
export async function updateLeadPurchase({
  reportId,
  phone,
  email,
  purchased,
  orderId,
} = {}) {
  if (!isSheetsConfigured()) {
    return { skipped: true, reason: "not_configured" };
  }
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const tab = sheetTabName();
    const rowNumber = await findLeadRowNumber({ reportId, phone, email });
    if (!rowNumber) {
      return { ok: false, skipped: false, error: "lead_row_not_found", reportId };
    }

    const current = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!Q${rowNumber}:R${rowNumber}`,
    });
    const cells = current?.data?.values?.[0] || [];
    const nextPurchased = mergePurchaseStatus(cells[0], purchased);
    const nextOrderId = cell(orderId) || cell(cells[1]) || "";

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!Q${rowNumber}:R${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[nextPurchased, nextOrderId]] },
    });

    console.log(
      `[sheets] purchase ${nextPurchased} row ${rowNumber} report=${reportId || ""} order=${nextOrderId}`
    );
    return {
      ok: true,
      skipped: false,
      rowNumber,
      purchased: nextPurchased,
      orderId: nextOrderId,
      reportId: reportId || null,
    };
  } catch (err) {
    const message = improveSheetsError(err);
    console.error("[sheets] purchase update failed:", message);
    return { ok: false, skipped: false, error: message };
  }
}
