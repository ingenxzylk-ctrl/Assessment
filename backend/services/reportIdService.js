/**
 * Server-side unique Report ID allocator + path layout.
 *
 * Primary ID format: TR-DDMMYYYY-NN (NN grows 01, 02, … 100, …)
 * Duplicate ID format: TR-DDMMYYYY-NN-DUP1, …-DUP2, …
 *
 * On-disk layout (date-partitioned to avoid huge flat directories):
 *   storage/reports/YYYY/MM/TR-DDMMYYYY-NN/
 *   storage/duplicate_reports/YYYY/MM/TR-DDMMYYYY-NN-DUP1/
 *
 * Legacy flat paths (reports/TR-…/) are still resolved for reads.
 *
 * Only the VPS allocates IDs — browsers must not invent them.
 * Uses exclusive lock files so concurrent submits cannot collide.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPORTS_ROOT =
  process.env.REPORT_STORAGE_DIR ||
  path.join(__dirname, "..", "storage", "reports");

export const DUPLICATE_ROOT =
  process.env.REPORT_DUPLICATE_DIR ||
  path.join(path.dirname(REPORTS_ROOT), "duplicate_reports");

const REPORT_ID_RE = /^TR-(\d{2})(\d{2})(\d{4})-(\d+)$/i;
const DUP_ID_RE = /^(TR-\d{8}-\d+)-DUP(\d+)$/i;

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

export function isValidDuplicateReportId(id) {
  return DUP_ID_RE.test(String(id || "").trim());
}

/**
 * Parse TR-DDMMYYYY-NN → { day, month, year, sequence, dateKey, reportId }
 */
export function parseReportId(reportId) {
  const raw = String(reportId || "").trim();
  const m = raw.match(REPORT_ID_RE);
  if (!m) return null;
  return {
    reportId: raw.toUpperCase(),
    day: m[1],
    month: m[2],
    year: m[3],
    sequence: Number(m[4]),
    dateKey: `${m[1]}${m[2]}${m[3]}`,
  };
}

/**
 * YYYY / MM segments for a report ID (from the ID itself).
 */
export function partitionSegmentsFromReportId(reportId) {
  const parsed = parseReportId(reportId);
  if (!parsed) return null;
  return { year: parsed.year, month: parsed.month };
}

export function partitionSegmentsFromDate(d = new Date()) {
  return {
    year: String(d.getFullYear()),
    month: pad2(d.getMonth() + 1),
  };
}

/** Canonical primary path: reports/YYYY/MM/TR-…/ */
export function primaryReportDir(reportId) {
  const safeId = String(reportId || "").trim().toUpperCase();
  const parts = partitionSegmentsFromReportId(safeId);
  if (!parts) return path.join(REPORTS_ROOT, safeId);
  return path.join(REPORTS_ROOT, parts.year, parts.month, safeId);
}

/** Legacy flat path: reports/TR-…/ */
export function legacyPrimaryReportDir(reportId) {
  return path.join(REPORTS_ROOT, String(reportId || "").trim().toUpperCase());
}

/** Canonical duplicate path: duplicate_reports/YYYY/MM/TR-…-DUPN/ */
export function duplicateReportDir(duplicateReportId, originalReportId = null) {
  const dupId = String(duplicateReportId || "").trim().toUpperCase();
  const fromDup = String(dupId).match(DUP_ID_RE)?.[1];
  const baseId = fromDup || (originalReportId && parseReportId(originalReportId)?.reportId);
  const parts = baseId
    ? partitionSegmentsFromReportId(baseId)
    : partitionSegmentsFromDate();
  if (!parts) return path.join(DUPLICATE_ROOT, dupId);
  return path.join(DUPLICATE_ROOT, parts.year, parts.month, dupId);
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
 * True if the report folder exists (partitioned or legacy flat).
 */
export async function reportFolderExists(reportId) {
  const safeId = String(reportId || "").trim().toUpperCase();
  if (!isValidReportId(safeId)) return false;
  return (
    (await pathExists(primaryReportDir(safeId))) ||
    (await pathExists(legacyPrimaryReportDir(safeId)))
  );
}

/**
 * Resolve which on-disk directory holds this primary report (if any).
 * Prefers partitioned, then legacy. Returns null if neither has assessment.json
 * unless preferWrite=true (then returns canonical partitioned path).
 */
export async function resolvePrimaryReportDir(reportId, { preferWrite = false } = {}) {
  const safeId = String(reportId || "").trim().toUpperCase();
  const partitioned = primaryReportDir(safeId);
  const legacy = legacyPrimaryReportDir(safeId);

  if (await pathExists(path.join(partitioned, "assessment.json"))) {
    return partitioned;
  }
  if (await pathExists(path.join(legacy, "assessment.json"))) {
    return legacy;
  }
  if (await pathExists(partitioned)) return partitioned;
  if (await pathExists(legacy)) return legacy;
  return preferWrite ? partitioned : null;
}

/**
 * Highest sequence already used on disk for a date key.
 * Scans partitioned YYYY/MM/ and legacy flat folders.
 */
async function maxExistingSequence(key) {
  let max = 0;
  const prefix = `TR-${key}-`;
  const consider = (name) => {
    const upper = String(name || "").toUpperCase();
    if (!upper.startsWith(prefix.toUpperCase())) return;
    const m = upper.match(REPORT_ID_RE);
    if (!m) return;
    if (`${m[1]}${m[2]}${m[3]}` !== key) return;
    const seq = Number(m[4]);
    if (Number.isFinite(seq) && seq > max) max = seq;
  };

  // Legacy flat: reports/TR-…
  try {
    const entries = await fs.readdir(REPORTS_ROOT, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) consider(e.name);
    }
  } catch {
    // ignore
  }

  // Partitioned: reports/YYYY/MM/TR-…
  const day = key.slice(0, 2);
  const month = key.slice(2, 4);
  const year = key.slice(4, 8);
  const monthDir = path.join(REPORTS_ROOT, year, month);
  try {
    const entries = await fs.readdir(monthDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) consider(e.name);
    }
  } catch {
    // ignore
  }

  // Also peek counter-related orphans named with day in key for safety
  void day;

  return max;
}

async function withLock(lockPath, fn) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  let handle = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      handle = await fs.open(lockPath, "wx");
      break;
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
      await sleep(25 + Math.floor(Math.random() * 25));
    }
  }
  if (!handle) {
    throw new Error("Could not acquire storage lock — try again");
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

async function withCounterLock(key, fn) {
  await fs.mkdir(REPORTS_ROOT, { recursive: true });
  return withLock(path.join(REPORTS_ROOT, `_count_${key}.lock`), fn);
}

/**
 * Allocate the next globally unique report ID for today on this VPS.
 * Reserves reports/YYYY/MM/TR-…/ immediately.
 */
export async function allocateReportId(now = new Date()) {
  const key = dateKey(now);
  const reportDate = formatReportDate(now);
  const counterFile = path.join(REPORTS_ROOT, `_count_${key}.txt`);
  const parts = partitionSegmentsFromDate(now);

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

    let reportId = `TR-${key}-${pad2(next)}`;
    while (await reportFolderExists(reportId)) {
      next += 1;
      reportId = `TR-${key}-${pad2(next)}`;
    }

    await fs.writeFile(counterFile, String(next), "utf8");

    const monthDir = path.join(REPORTS_ROOT, parts.year, parts.month);
    await fs.mkdir(monthDir, { recursive: true });
    const reportDir = path.join(monthDir, reportId);

    try {
      await fs.mkdir(reportDir, { recursive: false });
    } catch (err) {
      if (err?.code === "EEXIST") {
        next += 1;
        reportId = `TR-${key}-${pad2(next)}`;
        const retryDir = path.join(monthDir, reportId);
        await fs.mkdir(retryDir, { recursive: false });
        await fs.writeFile(counterFile, String(next), "utf8");
      } else {
        throw err;
      }
    }

    console.log(
      `[reportId] allocated ${reportId} → ${parts.year}/${parts.month}/`
    );
    return {
      reportId,
      reportDate,
      sequence: next,
      dateKey: key,
      reportDir: primaryReportDir(reportId),
      partition: parts,
    };
  });
}

/**
 * Next secondary ID for a colliding primary: TR-…-DUP1, TR-…-DUP2, …
 */
export async function allocateDuplicateReportId(originalReportId) {
  const original = String(originalReportId || "UNKNOWN").trim().toUpperCase();
  const base = isValidReportId(original) ? original : original.replace(/[^A-Z0-9_-]/g, "_").slice(0, 64) || "UNKNOWN";
  const lockName = `_dup_${base.replace(/[^A-Z0-9_-]/gi, "_")}.lock`;

  return withLock(path.join(DUPLICATE_ROOT, lockName), async () => {
    let max = 0;
    const consider = (name) => {
      const m = String(name || "")
        .toUpperCase()
        .match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-DUP(\\d+)$`, "i"));
      if (!m) return;
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    };

    // Flat duplicate_reports/
    try {
      const entries = await fs.readdir(DUPLICATE_ROOT, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        consider(e.name);
        // legacy stamped folders: TR-…__stamp__DUP-…
        const legacy = e.name.toUpperCase().match(
          new RegExp(
            `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}__.+-DUP(\\d+)$`
          )
        );
        if (legacy) {
          const n = Number(legacy[1]);
          if (Number.isFinite(n) && n > max) max = n;
        }
      }
    } catch {
      // ignore
    }

    // Partitioned duplicate_reports/YYYY/MM/
    const parts =
      partitionSegmentsFromReportId(base) || partitionSegmentsFromDate();
    const monthDir = path.join(DUPLICATE_ROOT, parts.year, parts.month);
    try {
      const entries = await fs.readdir(monthDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) consider(e.name);
      }
    } catch {
      // ignore
    }

    const next = max + 1;
    const duplicateReportId = `${base}-DUP${next}`;
    const reportDir = duplicateReportDir(duplicateReportId, base);
    await fs.mkdir(reportDir, { recursive: true });

    console.log(`[reportId] duplicate ${duplicateReportId}`);
    return {
      originalReportId: base,
      duplicateReportId,
      sequence: next,
      reportDir,
      partition: parts,
    };
  });
}

/**
 * True if this report archive already has a JSON file on disk (any layout).
 */
export async function reportArchiveExists(reportId) {
  if (!isValidReportId(reportId)) return false;
  const dir = await resolvePrimaryReportDir(reportId);
  if (!dir) return false;
  return pathExists(path.join(dir, "assessment.json"));
}

/**
 * List primary report IDs under reports/ (partitioned + legacy).
 */
export async function listLocalPrimaryReportIds() {
  const ids = new Set();

  async function walk(dir, depth) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith("_")) continue;
      if (REPORT_ID_RE.test(e.name)) {
        ids.add(e.name.toUpperCase());
        continue;
      }
      // YYYY or MM folders — descend a few levels
      if (depth < 3 && /^\d{2,4}$/.test(e.name)) {
        await walk(path.join(dir, e.name), depth + 1);
      }
    }
  }

  await walk(REPORTS_ROOT, 0);
  return [...ids].sort();
}
