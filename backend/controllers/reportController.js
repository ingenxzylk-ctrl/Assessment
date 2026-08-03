/**
 * Report API — post-analysis pipeline:
 *
 *   Customer submits quiz
 *        → Gemini analysis          (POST /api/analyze — separate step)
 *        → Generate PDF
 *        → Save PDF on VPS
 *        → Append lead to Google Sheets
 *        → Return report to frontend
 *
 * Optional (non-blocking): Google Drive upload (inside storage), org email.
 */

import fs from "fs/promises";
import path from "path";
import { PDF_FORMAT_VERSION } from "../services/pdfService.js";
import { loadReportJson, loadReportPdf } from "../services/storageService.js";
import { sendReportToOrganisation } from "../services/emailService.js";
import {
  buildPublicPdfUrl,
  isSheetsConfigured,
} from "../services/googleSheetsService.js";
import { runReportPipeline } from "../services/reportPipeline.js";
import {
  allocateReportId,
  isValidReportId,
  REPORTS_ROOT,
} from "../services/reportIdService.js";

const COUNTER_DIR = REPORTS_ROOT;

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

function getApiPublicBase(req) {
  // Sheet / team PDF links should always hit the live VPS API.
  const LIVE = "https://api.zylkhealth.com";
  const envBase =
    process.env.PUBLIC_API_URL ||
    process.env.API_PUBLIC_BASE_URL ||
    null;
  if (envBase && /^https?:\/\//i.test(envBase)) {
    try {
      const host = new URL(envBase).hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
        return LIVE;
      }
    } catch {
      return LIVE;
    }
    return String(envBase).replace(/\/$/, "");
  }
  return LIVE;
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

  const rewriteBrokenWpAssessment = (value) => {
    try {
      const u = new URL(value);
      const host = u.hostname.toLowerCase();
      if (
        (host === "zylkhealth.com" || host === "www.zylkhealth.com") &&
        /\/assessment\/?/i.test(u.pathname)
      ) {
        return LIVE_DEFAULT;
      }
    } catch {
      // ignore
    }
    return value;
  };

  const candidates = [
    rewriteBrokenWpAssessment(envBase),
    typeof resultPageUrl === "string" ? rewriteBrokenWpAssessment(resultPageUrl.trim()) : "",
    typeof appOrigin === "string" ? rewriteBrokenWpAssessment(appOrigin.trim()) : "",
    requestOrigin || "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    if (isLoopbackUrl(candidate)) continue;
    try {
      const u = new URL(candidate);
      if (u.searchParams.get("report") === String(reportId)) return u.toString();
    } catch {
      // fall through
    }
    return appendReportParam(candidate, reportId);
  }

  return appendReportParam(envBase || LIVE_DEFAULT, reportId);
}

/**
 * POST /api/report/submit
 *
 * Runs the canonical pipeline after Gemini analysis is already done client-side:
 * PDF → VPS save → Google Sheets → return report package to frontend.
 */
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
        ok: false,
        error: "aboutMe and scalpAnalysis are required to generate a report.",
      });
    }

    // Never reuse cached PDFs from older layout versions.
    // Skip only when the same quiz content was already rendered with THIS format.
    const existingByHash = await readContentHashMapping(contentHash);
    const hashFormatOk =
      existingByHash?.pdfFormatVersion === PDF_FORMAT_VERSION;
    if (existingByHash?.reportId && hashFormatOk) {
      try {
        const loaded = await loadReportJson(existingByHash.reportId);
        const cachedPdfUrl =
          buildPublicPdfUrl(existingByHash.reportId, getApiPublicBase(req)) ||
          loaded.data?.storageInfo?.pdfUrl ||
          null;
        return res.json({
          ok: true,
          success: true,
          skipped: true,
          reason: "content_unchanged",
          reportId: existingByHash.reportId,
          reportDate:
            existingByHash.reportDate || loaded.data?.reportDate || null,
          resultPageUrl: loaded.data?.resultPageUrl || null,
          storage: loaded.storage || "local",
          pdfPath: null,
          pdfUrl: cachedPdfUrl,
          drive: null,
          sheets: { skipped: true, reason: "content_unchanged" },
          sheetsConfigured: isSheetsConfigured(),
          email: { skipped: true, reason: "content_unchanged" },
          pdfFormatVersion: PDF_FORMAT_VERSION,
          pipeline: {
            geminiAnalysis: true,
            pdfGenerated: true,
            savedOnVps: true,
            sheetsAppended: false,
            sheetsConfigured: isSheetsConfigured(),
            returnedToFrontend: true,
            skipped: true,
            reason: "content_unchanged",
            storage: loaded.storage || "local",
            pdfUrl: cachedPdfUrl,
            resultPageUrl: loaded.data?.resultPageUrl || null,
          },
        });
      } catch {
        // Fall through and regenerate if archive missing
      }
    } else if (existingByHash?.reportId && !hashFormatOk) {
      console.log(
        `[report] regenerating PDF for ${existingByHash.reportId}: format ${existingByHash.pdfFormatVersion || "unknown"} → ${PDF_FORMAT_VERSION}`
      );
    }

    // ALWAYS allocate on the VPS — never trust browser localStorage Report IDs
    // (clientReportId is logged as a hint only; collisions were overwriting archives).
    const { reportId, reportDate } = await allocateReportId();
    if (clientReportId && isValidReportId(clientReportId)) {
      console.log(
        `[report] ignoring clientReportId=${String(clientReportId).trim()} → server ${reportId}`
      );
    }

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
      idSource: "server",
    };

    // Canonical steps: Generate PDF → Save on VPS (create-once) → Append Sheets → return
    const package_ = await runReportPipeline({
      payload,
      apiPublicBase: getApiPublicBase(req),
      patientName: aboutMe.fullName || "Guest",
    });

    await writeContentHashMapping(contentHash, reportId, reportDate);

    const publicPdfUrl = package_.publicPdfUrl || null;
    const storageInfo = package_.storageInfo || {};
    const sheetsResult = package_.sheets || {
      skipped: true,
      reason: "not_attempted",
    };

    // Optional: org email notification (does not block the report response)
    let emailResult;
    try {
      emailResult = await sendReportToOrganisation({
        reportId,
        reportDate,
        aboutMe,
        scalpAnalysis,
        storageInfo: {
          ...storageInfo,
          pdfUrl: publicPdfUrl || storageInfo.pdfUrl,
        },
        resultPageUrl,
      });
    } catch (emailErr) {
      console.error("[report] email failed:", emailErr.message);
      emailResult = { skipped: false, error: emailErr.message };
    }

    return res.json({
      ok: true,
      success: true,
      reportId,
      reportDate,
      resultPageUrl,
      storage: storageInfo.storage,
      pdfPath: storageInfo.pdfPath,
      pdfUrl: publicPdfUrl || storageInfo.pdfUrl,
      drive: storageInfo.drive || null,
      sheets: sheetsResult,
      sheetsConfigured: isSheetsConfigured(),
      email: emailResult,
      pdfFormatVersion: PDF_FORMAT_VERSION,
      // Explicit pipeline contract for the frontend / ops
      pipeline: {
        geminiAnalysis: true, // already completed via POST /api/analyze
        pdfGenerated: package_.pipeline?.pdfGenerated === true,
        savedOnVps: package_.pipeline?.savedOnVps === true,
        sheetsAppended: package_.pipeline?.sheetsAppended === true,
        sheetsConfigured: isSheetsConfigured(),
        returnedToFrontend: true,
        storage: package_.pipeline?.storage || storageInfo.storage || "local",
        pdfUrl: publicPdfUrl || storageInfo.pdfUrl || null,
        resultPageUrl,
      },
      message: package_.pipeline?.sheetsAppended
        ? "Report saved on VPS and appended to Google Sheets"
        : "Report saved on VPS (Sheets skipped or failed — see sheets field)",
    });
  } catch (err) {
    console.error("[report] submit failed:", err);
    return res.status(500).json({
      ok: false,
      success: false,
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
      pdfUrl:
        buildPublicPdfUrl(loaded.reportId, getApiPublicBase(req)) ||
        data.storageInfo?.pdfUrl ||
        null,
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

/**
 * Stream the archived assessment PDF for team / Sheet links.
 * GET /api/report/:reportId/pdf
 */
export async function getAssessmentReportPdf(req, res) {
  try {
    const { reportId } = req.params;
    const loaded = await loadReportPdf(reportId);
    const filename = `${loaded.reportId}_assessment.pdf`;

    res.setHeader("Content-Type", loaded.contentType || "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}"`
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(loaded.buffer);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) {
      return res.status(status).json({ error: err.message });
    }
    console.error("[report] pdf get failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to load assessment PDF.",
    });
  }
}
