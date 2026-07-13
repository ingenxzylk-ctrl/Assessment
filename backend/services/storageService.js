import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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

/**
 * Persist PDF + JSON for a report.
 * Returns { storage: 'local'|'s3', pdfPath|pdfUrl, jsonPath|jsonUrl, reportDir }
 */
export async function saveReportArtifacts({ reportId, pdfBuffer, jsonData }) {
  if (useS3()) {
    return saveToS3({ reportId, pdfBuffer, jsonData });
  }
  return saveLocal({ reportId, pdfBuffer, jsonData });
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
  // Dynamic import so local-only installs don't require AWS SDK.
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION || "ap-south-1";
  const prefix = (process.env.AWS_S3_PREFIX || "assessment-reports").replace(/\/$/, "");
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

  const base = `s3://${bucket}/${prefix}/${reportId}`;
  return {
    storage: "s3",
    reportDir: base,
    pdfPath: pdfKey,
    jsonPath: jsonKey,
    pdfUrl: `https://${bucket}.s3.${region}.amazonaws.com/${pdfKey}`,
    jsonUrl: `https://${bucket}.s3.${region}.amazonaws.com/${jsonKey}`,
  };
}
