/**
 * Backfill Google Sheets leads from report archives already on the VPS.
 *
 * Usage (from backend/):
 *   # After clearing the Sheet — write EVERY local report again:
 *   node scripts/backfill-google-sheets.js --all --force
 *
 *   node scripts/backfill-google-sheets.js --all --dry-run
 *   node scripts/backfill-google-sheets.js --all
 *   node scripts/backfill-google-sheets.js --from 2026-07-30 --to 2026-08-03
 *   node scripts/backfill-google-sheets.js --retry-failed
 *
 * --force  = do NOT skip IDs already in column B (use after you wipe the Sheet)
 * Batch writes (~40 rows / request) to avoid Sheets per-minute write quota.
 *
 * Gmail notifications are NOT the source — VPS archives are.
 */

import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import {
  appendLeadRowsBatch,
  buildLeadRow,
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
const BATCH_SIZE = 40;

function parseArgs(argv) {
  const out = {
    from: null,
    to: null,
    dryRun: false,
    all: false,
    retryFailed: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--all") out.all = true;
    else if (a === "--retry-failed") out.retryFailed = true;
    else if (a === "--force") out.force = true;
    else if (a === "--from") out.from = argv[++i];
    else if (a === "--to") out.to = argv[++i];
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FAILED_LIST_PATH = path.join(REPORTS_DIR, "_backfill_failed.txt");

async function loadFailedList() {
  try {
    const raw = await fs.readFile(FAILED_LIST_PATH, "utf8");
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => REPORT_ID_RE.test(l));
  } catch {
    return [];
  }
}

async function saveFailedList(ids) {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.writeFile(
    FAILED_LIST_PATH,
    ids.map((id) => String(id).toUpperCase()).join("\n") +
      (ids.length ? "\n" : ""),
    "utf8"
  );
}

function parseDateInput(value, label) {
  if (!value) throw new Error(`Missing --${label}`);
  const iso = String(value).trim();
  let m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  m = iso.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) {
    return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
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

async function appendBatchWithRetry(rows, label, attempts = 6) {
  let last = null;
  for (let i = 1; i <= attempts; i += 1) {
    last = await appendLeadRowsBatch(rows);
    if (last?.ok) return last;

    const err = String(last?.error || last?.reason || "");
    const retryable = /rate|quota|429|500|503|ECONNRESET|ETIMEDOUT|socket/i.test(
      err
    );
    if (!retryable || i === attempts) break;

    // Google write quota is per minute — wait a full minute on quota errors
    const waitMs = /quota|429/i.test(err) ? 65_000 : 1500 * i;
    console.warn(
      `retry ${label} (${i}/${attempts}) waiting ${Math.round(waitMs / 1000)}s — ${err.slice(0, 100)}`
    );
    await sleep(waitMs);
  }
  return last;
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
console.log("force (ignore existing IDs):", args.force);
console.log("dry-run:", args.dryRun);
console.log("env:", getSheetsStatus());

if (!isSheetsConfigured()) {
  console.error("\n❌ Sheets not configured on this server.\n");
  process.exit(1);
}

const probe = await probeGoogleSheets();
if (!probe.ok) {
  console.error("\n❌ Cannot access Sheet:", probe.error);
  console.error("Fix OAuth first, then retry.\n");
  process.exit(1);
}
console.log(`✅ Sheet: "${probe.title}"`);

const allIds = await listLocalReportIds();
let candidates = allIds.filter((id) => inRange(reportIdToDate(id), from, to));

if (args.retryFailed) {
  const failedIds = await loadFailedList();
  if (!failedIds.length) {
    console.log(`\nNo failed list at ${FAILED_LIST_PATH}`);
    console.log("Run a normal backfill first, or pass --all --force.\n");
    process.exit(0);
  }
  const allow = new Set(failedIds.map((id) => id.toUpperCase()));
  candidates = allIds.filter((id) => allow.has(id.toUpperCase()));
  console.log(`\nRetrying ${candidates.length} IDs from _backfill_failed.txt`);
} else {
  console.log(`\nLocal reports in range: ${candidates.length}`);
}

if (!candidates.length) {
  console.log("Nothing to backfill.\n");
  process.exit(0);
}

let existing = new Set();
if (!args.force) {
  try {
    existing = await fetchExistingReportIds();
    console.log(`Already in Sheet: ${existing.size} report IDs (will skip)`);
  } catch (err) {
    console.error("Could not read existing Sheet rows:", err.message);
    process.exit(1);
  }
} else {
  console.log("Force mode: will append ALL candidates (no skip-by-ID)");
}

const rowsToWrite = [];
const rowReportIds = [];
let skipped = 0;

for (const reportId of candidates) {
  const key = reportId.toUpperCase();
  if (!args.force && existing.has(key)) {
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
    rowsToWrite.push(null);
    rowReportIds.push(reportId);
    continue;
  }

  rowsToWrite.push(buildLeadRow(payload));
  rowReportIds.push(reportId);
}

if (args.dryRun) {
  console.log("\n--- summary ---");
  console.log("would append:", rowsToWrite.length);
  console.log("skipped:", skipped);
  console.log("(dry-run — no rows written)\n");
  process.exit(0);
}

let appended = 0;
let failed = 0;
const failedIds = [];
const failReasons = new Map();

for (let i = 0; i < rowsToWrite.length; i += BATCH_SIZE) {
  const chunkRows = rowsToWrite.slice(i, i + BATCH_SIZE);
  const chunkIds = rowReportIds.slice(i, i + BATCH_SIZE);
  const label = `batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunkIds[0]}…${chunkIds[chunkIds.length - 1]})`;

  const result = await appendBatchWithRetry(chunkRows, label);
  if (result?.ok) {
    console.log(`ok ${label} → ${result.updatedRange || "appended"}`);
    appended += chunkRows.length;
    // Small pause between batches
    await sleep(1500);
  } else {
    const reason = result?.error || result?.reason || "unknown";
    console.error(`fail ${label}: ${reason}`);
    failed += chunkIds.length;
    failedIds.push(...chunkIds);
    failReasons.set(reason, (failReasons.get(reason) || 0) + chunkIds.length);
  }
}

await saveFailedList(failedIds);

console.log("\n--- summary ---");
console.log("appended:", appended);
console.log("skipped:", skipped);
console.log("failed:", failed);
if (failReasons.size) {
  console.log("fail reasons:");
  for (const [reason, count] of failReasons) {
    console.log(`  (${count}) ${reason}`);
  }
}
if (failedIds.length) {
  console.log(`\nFailed IDs saved to: ${FAILED_LIST_PATH}`);
  console.log(
    "Retry with: node scripts/backfill-google-sheets.js --retry-failed --force"
  );
}
console.log("");

process.exit(failed ? 1 : 0);
