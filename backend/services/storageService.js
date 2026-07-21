import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import {
  isDriveConfigured,
  uploadReportToGoogleDrive,
} from "./googleDriveService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT =
  process.env.REPORT_STORAGE_DIR ||
  path.join(__dirname, "..", "storage", "reports");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function useS3() {
  return Boolean(
    process.env.AWS_S3_BUCKET &&
      (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE)
  );
}

async function saveLocal({ reportId, pdfBuffer, jsonData }) {
  const reportDir = path.join(LOCAL_ROOT, reportId);
  await ensureDir(reportDir);

  const pdfPath = path.join(reportDir, "assessment.pdf");
  const jsonPath = path.join(reportDir, "assessment.json");

  await fs.writeFile(pdfPath, pdfBuffer);
  await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2), "utf8");

  return {
    storage: "local",
    reportDir,
    pdfPath,
    jsonPath,
    pdfUrl: null,
    jsonUrl: null,
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
 * Load archived assessment JSON by report id (local first, then S3 if configured).
 */
export async function loadReportJson(reportId) {
  const safeId = String(reportId || "").trim();
  if (!/^TR-\d{8}-\d{2,}$/i.test(safeId)) {
    const err = new Error("Invalid report id.");
    err.status = 400;
    throw err;
  }

  const localJson = path.join(LOCAL_ROOT, safeId, "assessment.json");
  try {
    const raw = await fs.readFile(localJson, "utf8");
    return { storage: "local", reportId: safeId, data: JSON.parse(raw) };
  } catch {
    // fall through to S3
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

/**
 * Persist PDF + JSON.
 * Priority: Google Drive (if configured) → S3 → local disk.
 * When Drive is used, also keep a local backup copy.
 */
export async function saveReportArtifacts({
  reportId,
  pdfBuffer,
  jsonData,
  patientName,
}) {
  // Always keep a local backup so reports aren't lost if cloud upload fails mid-way.
  const local = await saveLocal({ reportId, pdfBuffer, jsonData });

  if (isDriveConfigured()) {
    try {
      const drive = await uploadReportToGoogleDrive({
        reportId,
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
          localBackup: { pdfPath: local.pdfPath, jsonPath: local.jsonPath },
        };
      }
    } catch (err) {
      console.error(
        "[storage] Google Drive upload failed, falling back:",
        err.message
      );
      local.driveError = err.message;
    }
  }

  if (useS3()) {
    try {
      const s3 = await saveToS3({ reportId, pdfBuffer, jsonData });
      return {
        ...s3,
        localBackup: { pdfPath: local.pdfPath, jsonPath: local.jsonPath },
      };
    } catch (err) {
      console.error("[storage] S3 upload failed, using local only:", err.message);
      local.s3Error = err.message;
    }
  }

  return local;
}
