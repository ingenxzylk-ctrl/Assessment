/**
 * Fail-safe report storage.
 *
 * Guarantees:
 * - Never overwrite an existing primary report
 * - Never delete / replace reports automatically
 * - On ID collision → persist under duplicate_reports/ with full metadata
 * - Raw incoming payloads are written to incoming/ before processing
 *
 * Layout (VPS):
 *   storage/reports/TR-…/                 primary archives
 *   storage/duplicate_reports/…/          collision copies + meta
 *   storage/incoming/…                    durable raw request dumps
 *   storage/logs/report-storage.log       append-only event log
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import {
  isDriveConfigured,
  uploadReportToGoogleDrive,
} from "./googleDriveService.js";
import { REPORTS_ROOT, isValidReportId } from "./reportIdService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = path.dirname(REPORTS_ROOT);
const DUPLICATE_ROOT =
  process.env.REPORT_DUPLICATE_DIR ||
  path.join(STORAGE_ROOT, "duplicate_reports");
const INCOMING_ROOT =
  process.env.REPORT_INCOMING_DIR || path.join(STORAGE_ROOT, "incoming");
const LOG_DIR = path.join(STORAGE_ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "report-storage.log");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function useS3() {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
      (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE)
  );
}

/**
 * Append-only storage log. Accepts either:
 *   logStorageEvent({ event, ... })
 *   logStorageEvent('event_name', { ... })
 */
export async function logStorageEvent(event, data) {
  const payload =
    typeof event === "string"
      ? { event, ...(data && typeof data === "object" ? data : {}) }
      : event && typeof event === "object"
        ? event
        : { event: "unknown" };

  const line = JSON.stringify({
    at: new Date().toISOString(),
    ...payload,
  });
  console.log(`[report-storage] ${line}`);
  try {
    await ensureDir(LOG_DIR);
    await fs.appendFile(LOG_FILE, `${line}\n`, "utf8");
  } catch (err) {
    console.warn("[report-storage] log write failed:", err?.message || err);
  }
}

function sanitizeIncomingPayload(body = {}) {
  const clone = { ...body };
  if (Array.isArray(body.scalpImages)) {
    clone.scalpImages = body.scalpImages.map((img) => ({
      type: img?.type,
      label: img?.label,
      hasImage: Boolean(img?.dataUrl || img?.previewUrl || img?.url),
      dataUrlLength: img?.dataUrl ? String(img.dataUrl).length : 0,
    }));
  }
  return clone;
}

/**
 * Persist the raw request before any processing so a crash cannot lose it.
 * @param {{ quizId?: string|null, payload?: object, meta?: object }} args
 */
export async function persistIncomingRequest({
  quizId = null,
  payload = null,
  meta = null,
} = {}) {
  const id =
    (typeof quizId === "string" && quizId.trim()) ||
    (typeof payload?.quizId === "string" && payload.quizId.trim()) ||
    randomUUID();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await ensureDir(INCOMING_ROOT);
  const filename = `${stamp}__${id}.json`;
  const incomingPath = path.join(INCOMING_ROOT, filename);

  await fs.writeFile(
    incomingPath,
    JSON.stringify(
      {
        receivedAt: new Date().toISOString(),
        quizId: id,
        meta: meta || null,
        payload: sanitizeIncomingPayload(payload || {}),
      },
      null,
      2
    ),
    "utf8"
  );

  await logStorageEvent("request_received", {
    quizId: id,
    incomingId: id,
    incomingPath,
    status: "ok",
  });

  return {
    incomingId: id,
    quizId: id,
    path: incomingPath,
    incomingPath,
  };
}

export async function primaryArchiveExists(reportId) {
  const safeId = String(reportId || "").trim().toUpperCase();
  if (!isValidReportId(safeId)) return false;
  return pathExists(path.join(REPORTS_ROOT, safeId, "assessment.json"));
}

async function writePrimaryLocal({ reportId, pdfBuffer, jsonData }) {
  const safeId = String(reportId || "").trim().toUpperCase();
  const reportDir = path.join(REPORTS_ROOT, safeId);
  await ensureDir(reportDir);

  const pdfPath = path.join(reportDir, "assessment.pdf");
  const jsonPath = path.join(reportDir, "assessment.json");

  if (await pathExists(jsonPath)) {
    const err = new Error(
      `Report archive already exists for ${safeId} — refusing overwrite`
    );
    err.code = "REPORT_EXISTS";
    err.status = 409;
    throw err;
  }

  await fs.writeFile(pdfPath, pdfBuffer);
  await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), "utf8");

  return {
    storage: "local",
    location: "primary",
    isDuplicate: false,
    reportId: safeId,
    reportDir,
    dir: reportDir,
    pdfPath,
    jsonPath,
    pdfUrl: null,
    jsonUrl: null,
  };
}

/**
 * Save under duplicate_reports/ — never touches primary archives.
 */
export async function saveDuplicateReport({
  originalReportId,
  duplicateReportId = null,
  reason = "report_id_already_exists",
  quizId = null,
  pdfBuffer = null,
  jsonData = null,
  requestPayload = null,
  analysis = null,
} = {}) {
  const original = String(originalReportId || "UNKNOWN").trim().toUpperCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dupId =
    (duplicateReportId && String(duplicateReportId).trim()) ||
    `DUP-${stamp}`;
  const folderName = `${original}__${stamp}__${dupId}`.replace(
    /[^A-Za-z0-9._-]/g,
    "_"
  );

  await ensureDir(DUPLICATE_ROOT);
  const reportDir = path.join(DUPLICATE_ROOT, folderName);
  await ensureDir(reportDir);

  const pdfPath = path.join(reportDir, "assessment.pdf");
  const jsonPath = path.join(reportDir, "assessment.json");
  const metaPath = path.join(reportDir, "duplicate_meta.json");

  if (pdfBuffer) {
    await fs.writeFile(pdfPath, pdfBuffer);
  }

  const archiveBody = {
    ...(jsonData && typeof jsonData === "object" ? jsonData : {}),
    analysis: analysis ?? jsonData?.analysis ?? null,
    duplicateOf: original,
    duplicateReportId: dupId,
    storedAsDuplicate: true,
  };
  await fs.writeFile(jsonPath, JSON.stringify(archiveBody, null, 2), "utf8");

  const meta = {
    originalReportId: original,
    duplicateReportId: dupId,
    timestamp: new Date().toISOString(),
    reason,
    quizId: quizId || null,
    storagePath: reportDir,
    hasPdf: Boolean(pdfBuffer),
    requestPayload: requestPayload || null,
  };
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");

  await logStorageEvent("duplicate_saved", {
    originalReportId: original,
    duplicateReportId: dupId,
    reason,
    quizId,
    storageLocation: reportDir,
    storagePath: reportDir,
    status: "ok",
  });

  return {
    storage: "local_duplicate",
    location: "duplicate_reports",
    isDuplicate: true,
    originalReportId: original,
    duplicateReportId: dupId,
    reportId: dupId,
    reportDir,
    dir: reportDir,
    pdfPath: pdfBuffer ? pdfPath : null,
    jsonPath,
    metaPath,
    meta,
    pdfUrl: null,
    jsonUrl: null,
    localBackup: {
      pdfPath: pdfBuffer ? pdfPath : null,
      jsonPath,
      dir: reportDir,
    },
  };
}

async function saveToS3({ reportId, pdfBuffer, jsonData }) {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || "ap-south-1";
  const prefix = (process.env.AWS_S3_PREFIX || "assessment-reports").replace(
    /\/$/,
    ""
  );
  const client = new S3Client({ region });

  const pdfKey = `${prefix}/${reportId}/assessment.pdf`;
  const jsonKey = `${prefix}/${reportId}/assessment.json`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: jsonKey,
      Body: Buffer.from(JSON.stringify(jsonData, null, 2), "utf8"),
      ContentType: "application/json",
    })
  );

  return {
    storage: "s3",
    reportDir: `s3://${bucket}/${prefix}/${reportId}`,
    pdfPath: pdfKey,
    jsonPath: jsonKey,
    pdfUrl: `https://${bucket}.s3.${region}.amazonaws.com/${pdfKey}`,
    jsonUrl: `https://${bucket}.s3.${region}.amazonaws.com/${jsonKey}`,
  };
}

/**
 * Atomic fail-safe save:
 * 1) If primary ID free → write primary (never overwrite)
 * 2) If primary exists → write duplicate_reports + metadata (never lose)
 */
export async function saveReportArtifactsFailSafe({
  reportId,
  pdfBuffer,
  jsonData,
  patientName = "Guest",
  quizId = null,
  requestPayload = null,
  reasonIfDuplicate = "report_id_already_exists",
} = {}) {
  const safeId = String(reportId || "").trim().toUpperCase();

  await logStorageEvent("storage_attempt", {
    reportId: safeId,
    quizId,
    status: "started",
  });

  const exists = await primaryArchiveExists(safeId);
  if (exists) {
    await logStorageEvent("duplicate_detected", {
      reportId: safeId,
      quizId,
      status: "conflict",
      reason: reasonIfDuplicate,
    });

    return saveDuplicateReport({
      originalReportId: safeId,
      reason: reasonIfDuplicate,
      quizId,
      pdfBuffer,
      jsonData,
      requestPayload,
    });
  }

  try {
    const local = await writePrimaryLocal({
      reportId: safeId,
      pdfBuffer,
      jsonData,
    });

    await logStorageEvent("primary_saved", {
      reportId: safeId,
      quizId,
      storageLocation: local.reportDir,
      status: "ok",
    });

    // Optional cloud mirrors — failures must not erase local primary
    if (isDriveConfigured()) {
      try {
        const drive = await uploadReportToGoogleDrive({
          reportId: safeId,
          pdfBuffer,
          jsonData,
          patientName,
        });
        if (!drive.skipped) {
          return {
            ...local,
            storage: "google_drive",
            pdfUrl: drive.pdfUrl,
            jsonUrl: drive.jsonUrl,
            drive,
            localBackup: {
              pdfPath: local.pdfPath,
              jsonPath: local.jsonPath,
              dir: local.reportDir,
            },
          };
        }
      } catch (err) {
        console.error("[storage] Drive upload failed (local kept):", err.message);
        local.driveError = err.message;
      }
    }

    if (useS3()) {
      try {
        const s3 = await saveToS3({
          reportId: safeId,
          pdfBuffer,
          jsonData,
        });
        return {
          ...s3,
          location: "primary",
          isDuplicate: false,
          reportId: safeId,
          localBackup: {
            pdfPath: local.pdfPath,
            jsonPath: local.jsonPath,
            dir: local.reportDir,
          },
        };
      } catch (err) {
        console.error("[storage] S3 upload failed (local kept):", err.message);
        local.s3Error = err.message;
      }
    }

    return {
      ...local,
      localBackup: {
        pdfPath: local.pdfPath,
        jsonPath: local.jsonPath,
        dir: local.reportDir,
      },
    };
  } catch (err) {
    // Race: another process wrote primary between exists-check and write
    if (err?.code === "REPORT_EXISTS" || err?.code === "EEXIST") {
      await logStorageEvent("duplicate_detected_race", {
        reportId: safeId,
        quizId,
        status: "conflict",
        error: err.message,
      });
      return saveDuplicateReport({
        originalReportId: safeId,
        reason: "race_condition_primary_exists",
        quizId,
        pdfBuffer,
        jsonData,
        requestPayload,
      });
    }

    await logStorageEvent("storage_failed", {
      reportId: safeId,
      quizId,
      status: "error",
      error: err?.message || String(err),
    });

    // Last resort: still try duplicate folder so nothing is lost
    try {
      return await saveDuplicateReport({
        originalReportId: safeId,
        reason: `storage_exception:${err?.message || "unknown"}`,
        quizId,
        pdfBuffer,
        jsonData,
        requestPayload,
      });
    } catch (dupErr) {
      await logStorageEvent("storage_catastrophic_failure", {
        reportId: safeId,
        quizId,
        status: "error",
        error: dupErr?.message || String(dupErr),
      });
      throw dupErr;
    }
  }
}

// ── Loaders (primary archives) ──────────────────────────────────────────

export async function loadReportJson(reportId) {
  const safeId = String(reportId || "").trim();
  if (!/^TR-\d{8}-\d{2,}$/i.test(safeId)) {
    const err = new Error("Invalid report id.");
    err.status = 400;
    throw err;
  }

  const localJson = path.join(REPORTS_ROOT, safeId, "assessment.json");
  try {
    const raw = await fs.readFile(localJson, "utf8");
    return { storage: "local", reportId: safeId, data: JSON.parse(raw) };
  } catch {
    // fall through
  }

  if (useS3()) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || "ap-south-1";
    const prefix = (process.env.AWS_S3_PREFIX || "assessment-reports").replace(
      /\/$/,
      ""
    );
    const client = new S3Client({ region });
    const jsonKey = `${prefix}/${safeId}/assessment.json`;
    try {
      const out = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: jsonKey })
      );
      const body = await out.Body.transformToString();
      return {
        storage: "s3",
        reportId: safeId,
        data: JSON.parse(body),
      };
    } catch (err) {
      console.error("[storage] S3 load failed:", err.message);
    }
  }

  const notFound = new Error("Report not found.");
  notFound.status = 404;
  throw notFound;
}

export async function loadReportPdf(reportId) {
  const safeId = String(reportId || "").trim();
  if (!/^TR-\d{8}-\d{2,}$/i.test(safeId)) {
    const err = new Error("Invalid report id.");
    err.status = 400;
    throw err;
  }

  const localPdf = path.join(REPORTS_ROOT, safeId, "assessment.pdf");
  try {
    const buffer = await fs.readFile(localPdf);
    return {
      storage: "local",
      reportId: safeId,
      buffer,
      contentType: "application/pdf",
    };
  } catch {
    // fall through
  }

  if (useS3()) {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION || "ap-south-1";
    const prefix = (process.env.AWS_S3_PREFIX || "assessment-reports").replace(
      /\/$/,
      ""
    );
    const client = new S3Client({ region });
    const pdfKey = `${prefix}/${safeId}/assessment.pdf`;
    try {
      const out = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: pdfKey })
      );
      const chunks = [];
      for await (const chunk of out.Body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return {
        storage: "s3",
        reportId: safeId,
        buffer: Buffer.concat(chunks),
        contentType: "application/pdf",
      };
    } catch (err) {
      console.error("[storage] S3 PDF load failed:", err.message);
    }
  }

  const notFound = new Error("Report PDF not found.");
  notFound.status = 404;
  throw notFound;
}

/**
 * Back-compat wrapper used by older call sites.
 * Never overwrites — delegates to fail-safe save.
 */
export async function saveReportArtifacts(args) {
  return saveReportArtifactsFailSafe(args);
}

export {
  REPORTS_ROOT,
  DUPLICATE_ROOT,
  INCOMING_ROOT,
  LOG_FILE,
};
