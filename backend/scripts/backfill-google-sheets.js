/**
 * Backfill Google Sheets leads from report archives already on the VPS.
 *
 * Usage (from backend/):
 *   node scripts/backfill-google-sheets.js --from 2026-07-30 --to 2026-08-03 --dry-run
 *   node scripts/backfill-google-sheets.js --from 2026-07-30 --to 2026-08-03
 *   node scripts/backfill-google-sheets.js --all --dry-run
 *   node scripts/backfill-google-sheets.js --all
 *
 * Reads backend/storage/reports/TR-DDMMYYYY-NN/assessment.json
 * Skips report IDs already present in column B of the Sheet.
 * Gmail notifications are NOT the source — VPS archives are.
 */

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import {
  appendLeadToGoogleSheet,
  buildPublicPdfUrl,
  getSheetsStatus,
  isSheetsConfigured,
  probeGoogleSheets,
} from "../services/googleSheetsService.js";
import {
  hasOAuthConfig,
  hasServiceAccountConfig,
} from "../services/googleDriveService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR =
  process.env.REPORT_STORAGE_DIR ||
  path.join(__dirname, "..", "storage", "reports");

const REPORT_ID_RE = /^TR-(\d{2})(\d{2})(\d{4})-(\d+)$/i;

function parseArgs(argv) {
  const out = { from: null, to: null, dryRun: false, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--all") out.all = true;
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--to") out.to = argv[++i];
  }
  return out;
}

/** Parse YYYY-MM-DD or DD.MM.YYYY → Date at UTC midnight */
function parseDateInput(value, label) {
  if (!value) throw new Error(`Missing --${label}`);
  const iso = String(value).trim();
  let m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  m = iso.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return new Date(
      Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    );
  }
  throw new Error(
    `Invalid --${label} "${value}". Use YYYY-MM-DD or DD.MM.YYYY`
  );
}

function reportIdToDate(reportId) {
  const m = String(reportId).match(REPORT_ID_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

function inRange(d, from, to) {
  return d && d >= from && d <= to;
}

async function listLocalReportIds() {
  let entries = [];
  try {
    entries = await fs.readdir(REPORTS_DIR, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read ${REPORTS_DIR}: ${err.message}`);
  }
  return entries
    .filter((e) => e.isDirectory() && REPORT_ID_RE.test(e.name))
    .map((e) => e.name)
    .sort();
}

async function loadAssessmentJson(reportId) {
  const jsonPath = path.join(REPORTS_DIR, reportId, "assessment.json");
  const raw = await fs.readFile(jsonPath, "utf8");
  return JSON.parse(raw);
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
  if (!hasServiceAccountConfig()) {
    throw new Error("No Google auth configured");
  }
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/** Existing Report IDs already in column B */
async function fetchExistingReportIds() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tab =
    String(process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A:L")
      .split("!")[0]
      .trim() || "Sheet1";
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!B:B`,
  });
  const values = res?.data?.values || [];
  const ids = new Set();
  for (const row of values) {
    const id = String(row?.[0] || "").trim().toUpperCase();
    if (REPORT_ID_RE.test(id)) ids.add(id);
  }
  return ids;
}

const args = parseArgs(process.argv.slice(2));
const from = args.all
  ? new Date(Date.UTC(2000, 0, 1))
  : parseDateInput(args.from || "2026-07-30", "from");
const to = args.all
  ? new Date(Date.UTC(2100, 0, 1))
  : parseDateInput(args.to || "2026-08-03", "to");

console.log("\n=== Sheets backfill ===\n");
console.log("reports dir:", REPORTS_DIR);
console.log(
  "range:",
  args.all
    ? "ALL local reports"
    : `${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}`
);
console.log("dry-run:", args.dryRun);
console.log("env:", getSheetsStatus());

if (!isSheetsConfigured()) {
  console.error("\n❌ Sheets not configured on this server.\n");
  process.exit(1);
}

const probe = await probeGoogleSheets();
if (!probe.ok) {
  console.error("\n❌ Cannot access Sheet:", probe.error);
  console.error("Fix OAuth first (invalid_grant / truncated token), then retry.\n");
  process.exit(1);
}
console.log(`✅ Sheet: "${probe.title}"`);

const allIds = await listLocalReportIds();
const candidates = allIds.filter((id) =>
  inRange(reportIdToDate(id), from, to)
);

console.log(`\nLocal reports in range: ${candidates.length}`);
if (!candidates.length) {
  console.log("Nothing to backfill.\n");
  process.exit(0);
}

let existing;
try {
  existing = await fetchExistingReportIds();
  console.log(`Already in Sheet: ${existing.size} report IDs`);
} catch (err) {
  console.error("Could not read existing Sheet rows:", err.message);
  process.exit(1);
}

let appended = 0;
let skipped = 0;
let failed = 0;

for (const reportId of candidates) {
  const key = reportId.toUpperCase();
  if (existing.has(key)) {
    console.log(`skip (exists) ${reportId}`);
    skipped += 1;
    continue;
  }

  let data;
  try {
    data = await loadAssessmentJson(reportId);
  } catch (err) {
    console.warn(`skip (no json) ${reportId}: ${err.message}`);
    skipped += 1;
    continue;
  }

  const payload = {
    reportId,
    reportDate: data.reportDate || null,
    aboutMe: data.aboutMe || {},
    scalpAnalysis: data.scalpAnalysis || {},
    reportMeta: data.reportMeta || {},
    resultPageUrl:
      data.resultPageUrl ||
      `https://quiz.zylkhealth.com/?report=${encodeURIComponent(reportId)}`,
    pdfUrl: buildPublicPdfUrl(reportId),
  };

  if (args.dryRun) {
    console.log(
      `dry-run would append ${reportId} | ${payload.aboutMe.fullName || payload.aboutMe.name || "Guest"} | ${payload.reportDate || "?"}`
    );
    appended += 1;
    continue;
  }

  const result = await appendLeadToGoogleSheet(payload);
  if (result.ok) {
    console.log(`ok ${reportId} → ${result.updatedRange || "appended"}`);
    appended += 1;
    existing.add(key);
  } else {
    console.error(`fail ${reportId}: ${result.error || result.reason}`);
    failed += 1;
  }
}

console.log("\n--- summary ---");
console.log("appended:", appended);
console.log("skipped:", skipped);
console.log("failed:", failed);
console.log(args.dryRun ? "(dry-run — no rows written)\n" : "\n");

process.exit(failed ? 1 : 0);
