/**
 * Server-side unique Report ID allocator.
 *
 * Format: TR-DDMMYYYY-NN (NN grows 01, 02, … 100, …)
 * Only the VPS allocates IDs — browsers must not invent them.
 *
 * Uses an exclusive lock file so concurrent submits cannot collide.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPORTS_ROOT =
  process.env.REPORT_STORAGE_DIR ||
  path.join(__dirname, "..", "storage", "reports");

const REPORT_ID_RE = /^TR-(\d{8})-(\d+)$/i;

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatReportDate(d = new Date()) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function dateKey(d = new Date()) {
  return `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${d.getFullYear()}`;
}

export function isValidReportId(id) {
  return REPORT_ID_RE.test(String(id || "").trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Highest sequence already used on disk for a date key (from folder names).
 */
async function maxExistingSequence(key) {
  let max = 0;
  let entries = [];
  try {
    entries = await fs.readdir(REPORTS_ROOT, { withFileTypes: true });
  } catch {
    return 0;
  }
  const prefix = `TR-${key}-`;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const name = e.name.toUpperCase();
    if (!name.startsWith(prefix.toUpperCase())) continue;
    const m = name.match(REPORT_ID_RE);
    if (!m) continue;
    if (m[1] !== key) continue;
    const seq = Number(m[2]);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max;
}

async function withCounterLock(key, fn) {
  await fs.mkdir(REPORTS_ROOT, { recursive: true });
  const lockPath = path.join(REPORTS_ROOT, `_count_${key}.lock`);

  let handle = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      // Exclusive create — only one process holds the lock
      handle = await fs.open(lockPath, "wx");
      break;
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
      await sleep(25 + Math.floor(Math.random() * 25));
    }
  }
  if (!handle) {
    throw new Error("Could not acquire report ID counter lock — try again");
  }

  try {
    return await fn();
  } finally {
    try {
      await handle.close();
    } catch {
      // ignore
    }
    try {
      await fs.unlink(lockPath);
    } catch {
      // ignore
    }
  }
}

/**
 * Allocate the next globally unique report ID for today on this VPS.
 * Guarantees the report folder does not already exist.
 */
export async function allocateReportId(now = new Date()) {
  const key = dateKey(now);
  const reportDate = formatReportDate(now);
  const counterFile = path.join(REPORTS_ROOT, `_count_${key}.txt`);

  return withCounterLock(key, async () => {
    let fromFile = 0;
    try {
      const raw = await fs.readFile(counterFile, "utf8");
      fromFile = Number(String(raw).trim() || "0") || 0;
    } catch {
      fromFile = 0;
    }

    const fromDisk = await maxExistingSequence(key);
    let next = Math.max(fromFile, fromDisk) + 1;

    // Create-once: skip any sequence whose folder already exists
    let reportId = `TR-${key}-${pad2(next)}`;
    while (await pathExists(path.join(REPORTS_ROOT, reportId))) {
      next += 1;
      reportId = `TR-${key}-${pad2(next)}`;
    }

    await fs.writeFile(counterFile, String(next), "utf8");

    // Reserve the directory immediately so a concurrent allocate cannot reuse it
    try {
      await fs.mkdir(path.join(REPORTS_ROOT, reportId), { recursive: false });
    } catch (err) {
      if (err?.code === "EEXIST") {
        next += 1;
        reportId = `TR-${key}-${pad2(next)}`;
        await fs.mkdir(path.join(REPORTS_ROOT, reportId), { recursive: false });
        await fs.writeFile(counterFile, String(next), "utf8");
      } else {
        throw err;
      }
    }

    console.log(`[reportId] allocated ${reportId}`);
    return { reportId, reportDate, sequence: next, dateKey: key };
  });
}

/**
 * True if this report archive already has a JSON file on disk.
 */
export async function reportArchiveExists(reportId) {
  if (!isValidReportId(reportId)) return false;
  return pathExists(
    path.join(REPORTS_ROOT, String(reportId).trim().toUpperCase(), "assessment.json")
  );
}
