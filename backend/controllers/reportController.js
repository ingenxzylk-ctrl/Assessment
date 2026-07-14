import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { buildAssessmentPdf } from "../services/pdfService.js";
import { saveReportArtifacts } from "../services/storageService.js";
import { sendReportToOrganisation } from "../services/emailService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTER_DIR =
  process.env.REPORT_STORAGE_DIR ||
  path.join(__dirname, "..", "storage", "reports");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatReportDate(d = new Date()) {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dateKey(d = new Date()) {
  return `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${d.getFullYear()}`;
}

async function allocateReportId() {
  const now = new Date();
  const key = dateKey(now);
  await fs.mkdir(COUNTER_DIR, { recursive: true });
  const counterFile = path.join(COUNTER_DIR, `_count_${key}.txt`);

  let next = 1;
  try {
    const raw = await fs.readFile(counterFile, "utf8");
    next = Number(raw.trim() || "0") + 1;
  } catch {
    next = 1;
  }
  await fs.writeFile(counterFile, String(next), "utf8");
  return {
    reportId: `TR-${key}-${pad2(next)}`,
    reportDate: formatReportDate(now),
  };
}

/**
 * Strip bulky image payloads from the JSON archive (PDF does not embed them in v1).
 * Keeps image metadata (type/label) for audit.
 */
function sanitizeForArchive(payload) {
  const images = Array.isArray(payload.scalpImages)
    ? payload.scalpImages.map((img) => ({
        type: img.type,
        label: img.label,
        hasImage: Boolean(img.dataUrl || img.previewUrl || img.url),
      }))
    : [];

  return {
    ...payload,
    scalpImages: images,
  };
}

export async function submitAssessmentReport(req, res) {
  try {
    const {
      aboutMe,
      hairHealth,
      internalHealth,
      scalpAnalysis,
      scalpImages,
      reportMeta,
      clientReportId,
      gender,
    } = req.body || {};

    if (!aboutMe || !scalpAnalysis) {
      return res.status(400).json({
        error: "aboutMe and scalpAnalysis are required to generate a report.",
      });
    }

    const { reportId, reportDate } = await allocateReportId();

    const payload = {
      reportId,
      reportDate,
      clientReportId: clientReportId || null,
      aboutMe,
      hairHealth: hairHealth || {},
      internalHealth: internalHealth || {},
      scalpAnalysis,
      scalpImages: scalpImages || [],
      reportMeta: reportMeta || {},
      gender: gender || aboutMe.gender,
      submittedAt: new Date().toISOString(),
    };

    const pdfBuffer = await buildAssessmentPdf(payload);
    const archive = sanitizeForArchive(payload);
    const storageInfo = await saveReportArtifacts({
      reportId,
      pdfBuffer,
      jsonData: archive,
      patientName: aboutMe.fullName || "Guest",
    });

    let emailResult;
    try {
      // Notification only — never pass pdfBuffer (Drive link is in storageInfo)
      emailResult = await sendReportToOrganisation({
        reportId,
        reportDate,
        aboutMe,
        scalpAnalysis,
        storageInfo,
      });
    } catch (emailErr) {
      console.error("[report] email failed:", emailErr.message);
      emailResult = { skipped: false, error: emailErr.message };
    }

    return res.json({
      ok: true,
      reportId,
      reportDate,
      storage: storageInfo.storage,
      pdfPath: storageInfo.pdfPath,
      pdfUrl: storageInfo.pdfUrl,
      drive: storageInfo.drive || null,
      email: emailResult,
    });
  } catch (err) {
    console.error("[report] submit failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to generate and store assessment report.",
    });
  }
}
