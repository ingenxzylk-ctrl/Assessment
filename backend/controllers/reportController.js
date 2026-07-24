import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { buildAssessmentPdf, PDF_FORMAT_VERSION } from "../services/pdfService.js";
import {
  saveReportArtifacts,
  loadReportJson,
} from "../services/storageService.js";
import { sendReportToOrganisation } from "../services/emailService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTER_DIR =
  process.env.REPORT_STORAGE_DIR ||
  path.join(__dirname, "..", "storage", "reports");

const REPORT_ID_RE = /^TR-\d{8}-\d{2,}$/i;

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

function isValidReportId(id) {
  return REPORT_ID_RE.test(String(id || "").trim());
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

async function readContentHashMapping(contentHash) {
  if (!contentHash) return null;
  const safe = String(contentHash).replace(/[^\w-]/g, "").slice(0, 64);
  if (!safe) return null;
  const file = path.join(COUNTER_DIR, `_hash_${safe}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeContentHashMapping(contentHash, reportId, reportDate) {
  if (!contentHash || !reportId) return;
  const safe = String(contentHash).replace(/[^\w-]/g, "").slice(0, 64);
  if (!safe) return;
  await fs.mkdir(COUNTER_DIR, { recursive: true });
  const file = path.join(COUNTER_DIR, `_hash_${safe}.json`);
  await fs.writeFile(
    file,
    JSON.stringify({
      reportId,
      reportDate,
      pdfFormatVersion: PDF_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
    }),
    "utf8"
  );
}

/**
 * Prefer the client-facing report id so the PDF, archive folder, and
 * in-app `?report=` link all share the same identifier.
 */
async function resolveReportIdentity(clientReportId, clientReportDate) {
  const now = new Date();
  const reportDate =
    (typeof clientReportDate === "string" && clientReportDate.trim()) ||
    formatReportDate(now);

  if (isValidReportId(clientReportId)) {
    return {
      reportId: String(clientReportId).trim().toUpperCase(),
      reportDate,
    };
  }

  return allocateReportId();
}

function isLoopbackHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1";
}

function isLoopbackUrl(value) {
  try {
    return isLoopbackHost(new URL(value).hostname);
  } catch {
    return true;
  }
}

function appendReportParam(base, reportId) {
  try {
    const url = new URL(base);
    url.searchParams.set("report", reportId);
    return url.toString();
  } catch {
    const trimmed = String(base || "").replace(/\/$/, "");
    if (!trimmed) return null;
    return `${trimmed}/?report=${encodeURIComponent(reportId)}`;
  }
}

function getRequestOrigin(req) {
  if (!req || typeof req.get !== "function") return null;
  const origin = req.get("origin");
  if (origin && /^https?:\/\//i.test(origin)) return origin.replace(/\/$/, "");
  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Build an org-shareable Result page URL.
 * Prefer RESULT_APP_BASE_URL / FRONTEND_ORIGIN / production default so emailed PDFs
 * never point at localhost when the live assessment app is available.
 * Always returns a URL when reportId is present so the PDF never omits the link.
 */
function buildResultPageUrl({ resultPageUrl, appOrigin, reportId, requestOrigin }) {
  const LIVE_DEFAULT = "https://quiz.zylkhealth.com/";
  const envBase =
    process.env.RESULT_APP_BASE_URL ||
    process.env.FRONTEND_ORIGIN ||
    process.env.PUBLIC_APP_URL ||
    LIVE_DEFAULT;

  const candidates = [
    envBase,
    typeof resultPageUrl === "string" ? resultPageUrl.trim() : "",
    typeof appOrigin === "string" ? appOrigin.trim() : "",
    requestOrigin || "",
  ].filter(Boolean);

  // Prefer the first non-loopback absolute URL (rewrite path + report id onto env/live base when needed)
  for (const candidate of candidates) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    if (isLoopbackUrl(candidate)) continue;
    // If candidate is already a full result URL with report param, keep it
    try {
      const u = new URL(candidate);
      if (u.searchParams.get("report") === String(reportId)) return u.toString();
    } catch {
      // fall through
    }
    return appendReportParam(candidate, reportId);
  }

  // Client sent only localhost (local testing) — still publish the live org link
  return appendReportParam(envBase || LIVE_DEFAULT, reportId);
}

/**
 * Strip bulky image payloads from the JSON archive after PDF generation.
 * PDF embeds the photos; JSON keeps metadata only.
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
      clientReportDate,
      contentHash,
      gender,
      resultPageUrl: bodyResultPageUrl,
      appOrigin,
    } = req.body || {};

    if (!aboutMe || !scalpAnalysis) {
      return res.status(400).json({
        error: "aboutMe and scalpAnalysis are required to generate a report.",
      });
    }

    // Never reuse cached PDFs from older layout versions (v2 had 7–8 pages + blanks).
    // Skip only when the same quiz content was already rendered with THIS format.
    const existingByHash = await readContentHashMapping(contentHash);
    const hashFormatOk =
      existingByHash?.pdfFormatVersion === PDF_FORMAT_VERSION;
    if (existingByHash?.reportId && hashFormatOk) {
      try {
        const loaded = await loadReportJson(existingByHash.reportId);
        return res.json({
          ok: true,
          skipped: true,
          reason: "content_unchanged",
          reportId: existingByHash.reportId,
          reportDate: existingByHash.reportDate || loaded.data?.reportDate || null,
          resultPageUrl: loaded.data?.resultPageUrl || null,
          storage: loaded.storage || "local",
          pdfPath: null,
          pdfUrl: loaded.data?.storageInfo?.pdfUrl || null,
          drive: null,
          email: { skipped: true, reason: "content_unchanged" },
          pdfFormatVersion: PDF_FORMAT_VERSION,
        });
      } catch {
        // Fall through and regenerate if archive missing
      }
    } else if (existingByHash?.reportId && !hashFormatOk) {
      console.log(
        `[report] regenerating PDF for ${existingByHash.reportId}: format ${existingByHash.pdfFormatVersion || "unknown"} → ${PDF_FORMAT_VERSION}`
      );
    }

    const { reportId, reportDate } = await resolveReportIdentity(
      clientReportId || existingByHash?.reportId,
      clientReportDate || existingByHash?.reportDate
    );

    const resultPageUrl = buildResultPageUrl({
      resultPageUrl: bodyResultPageUrl,
      appOrigin,
      reportId,
      requestOrigin: getRequestOrigin(req),
    });

    if (!resultPageUrl) {
      console.warn("[report] resultPageUrl could not be resolved for", reportId);
    } else {
      console.log("[report] embedding result page link:", resultPageUrl);
    }

    const payload = {
      reportId,
      reportDate,
      clientReportId: clientReportId || null,
      contentHash: contentHash || null,
      aboutMe,
      hairHealth: hairHealth || {},
      internalHealth: internalHealth || {},
      scalpAnalysis,
      scalpImages: scalpImages || [],
      reportMeta: reportMeta || {},
      gender: gender || aboutMe.gender,
      resultPageUrl,
      submittedAt: new Date().toISOString(),
    };

    const pdfBuffer = await buildAssessmentPdf(payload);
    const archive = sanitizeForArchive({
      ...payload,
      pdfFormatVersion: PDF_FORMAT_VERSION,
      storageInfo: undefined,
    });
    const storageInfo = await saveReportArtifacts({
      reportId,
      pdfBuffer,
      jsonData: {
        ...archive,
        pdfFormatVersion: PDF_FORMAT_VERSION,
      },
      patientName: aboutMe.fullName || "Guest",
    });

    await writeContentHashMapping(contentHash, reportId, reportDate);

    let emailResult;
    try {
      // Notification only — never pass pdfBuffer (Drive link is in storageInfo)
      emailResult = await sendReportToOrganisation({
        reportId,
        reportDate,
        aboutMe,
        scalpAnalysis,
        storageInfo,
        resultPageUrl,
      });
    } catch (emailErr) {
      console.error("[report] email failed:", emailErr.message);
      emailResult = { skipped: false, error: emailErr.message };
    }

    return res.json({
      ok: true,
      reportId,
      reportDate,
      resultPageUrl,
      storage: storageInfo.storage,
      pdfPath: storageInfo.pdfPath,
      pdfUrl: storageInfo.pdfUrl,
      drive: storageInfo.drive || null,
      email: emailResult,
      pdfFormatVersion: PDF_FORMAT_VERSION,
    });
  } catch (err) {
    console.error("[report] submit failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to generate and store assessment report.",
    });
  }
}

/**
 * Fetch a previously archived assessment so the app can restore the Result page.
 * GET /api/report/:reportId
 */
export async function getAssessmentReport(req, res) {
  try {
    const { reportId } = req.params;
    const loaded = await loadReportJson(reportId);
    const data = loaded.data || {};

    return res.json({
      ok: true,
      reportId: loaded.reportId,
      reportDate: data.reportDate || null,
      resultPageUrl: data.resultPageUrl || null,
      aboutMe: data.aboutMe || {},
      hairHealth: data.hairHealth || {},
      internalHealth: data.internalHealth || {},
      scalpAnalysis: data.scalpAnalysis || null,
      scalpImages: data.scalpImages || [],
      reportMeta: data.reportMeta || {},
      gender: data.gender || data.aboutMe?.gender || null,
      submittedAt: data.submittedAt || null,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) {
      return res.status(status).json({ error: err.message });
    }
    console.error("[report] get failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to load assessment report.",
    });
  }
}