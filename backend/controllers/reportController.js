/**
 * Report API — post-analysis pipeline:
 *
 *   Customer submits quiz
 *        → Gemini analysis          (POST /api/analyze — separate step)
 *        → Generate PDF
 *        → Save PDF on VPS (fail-safe: primary or duplicate_reports)
 *        → Append lead to Google Sheets
 *        → Return report to frontend
 *
 * Optional (non-blocking): Google Drive upload (inside storage), org email.
 */

import fs from "fs/promises";
import path from "path";
import { PDF_FORMAT_VERSION } from "../services/pdfService.js";
import {
  loadReportJson,
  loadReportPdf,
  loadReportPhoto,
  persistIncomingRequest,
  saveDuplicateReport,
  logStorageEvent,
  primaryArchiveExists,
} from "../services/storageService.js";
import { sendReportToOrganisation } from "../services/emailService.js";
import {
  buildPublicPdfUrl,
  isSheetsConfigured,
} from "../services/googleSheetsService.js";
import { runReportPipeline } from "../services/reportPipeline.js";
import {
  allocateReportId,
  allocateDuplicateReportId,
  isValidReportId,
  REPORTS_ROOT,
} from "../services/reportIdService.js";

const COUNTER_DIR = REPORTS_ROOT;

// Only reuse a cached report if it was created within this window.
// This exists purely to dedupe retries / double-submits (e.g. a flaky network
// causing the frontend to fire the same request twice within seconds) — it is
// NOT meant to be a permanent "same content = same result" identity cache.
// Letting it live forever was the root cause of stale/"stuck" report reuse.
const HASH_REUSE_TTL_MS = 15 * 60 * 1000; // 15 minutes

async function readContentHashMapping(contentHash) {
  if (!contentHash) return null;
  const safe = String(contentHash).replace(/[^\w-]/g, "").slice(0, 64);
  if (!safe) return null;
  const file = path.join(COUNTER_DIR, `_hash_${safe}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw);

    // Stale entries are treated as a miss — this forces a fresh report
    // instead of silently handing back something that may be arbitrarily old.
    const savedAt = parsed?.savedAt ? new Date(parsed.savedAt).getTime() : 0;
    if (!savedAt || Date.now() - savedAt > HASH_REUSE_TTL_MS) {
      return null;
    }
    return parsed;
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
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;

  // Atomic write: write to a temp file first, then rename into place.
  // Two near-simultaneous requests racing on the same content hash can no
  // longer observe a half-written file, and rename() is atomic on the same
  // filesystem, so the mapping file is always either fully old or fully new.
  await fs.writeFile(
    tmp,
    JSON.stringify({
      reportId,
      reportDate,
      pdfFormatVersion: PDF_FORMAT_VERSION,
      savedAt: new Date().toISOString(),
    }),
    "utf8"
  );
  await fs.rename(tmp, file);
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

function buildSafeRequestPayload(req, quizId) {
  const body = req.body || {};
  return {
    quizId: quizId || null,
    aboutMe: body.aboutMe || null,
    hairHealth: body.hairHealth || null,
    internalHealth: body.internalHealth || null,
    scalpAnalysis: body.scalpAnalysis || null,
    reportMeta: body.reportMeta || null,
    gender: body.gender || null,
    clientReportId: body.clientReportId || null,
    clientReportDate: body.clientReportDate || null,
    contentHash: body.contentHash || null,
    appOrigin: body.appOrigin || null,
    resultPageUrl: body.resultPageUrl || null,
    scalpImageCount: Array.isArray(body.scalpImages) ? body.scalpImages.length : 0,
    receivedAt: new Date().toISOString(),
    ip: req.ip || null,
    userAgent: typeof req.get === "function" ? req.get("user-agent") : null,
  };
}

/**
 * POST /api/report/submit
 *
 * Fail-safe flow:
 * 1) receive + persist raw request (incoming/)
 * 2) validate payload
 * 3) allocate Report ID on VPS
 * 4) if primary already exists → duplicate_reports (never overwrite)
 * 5) else save primary via pipeline
 * 6) continue Sheets / response — never lose data
 */
export async function submitAssessmentReport(req, res) {
  const receivedAt = new Date().toISOString();
  const quizId =
    typeof req.body?.quizId === "string" && req.body.quizId.trim()
      ? req.body.quizId.trim()
      : null;
  const requestPayload = buildSafeRequestPayload(req, quizId);

  let incoming = null;
  try {
    incoming = await persistIncomingRequest({
      quizId,
      payload: {
        ...requestPayload,
        scalpImages: req.body?.scalpImages,
      },
      meta: {
        path: req.originalUrl || req.url,
        method: req.method,
        receivedAt,
      },
    });
  } catch (persistErr) {
    console.error("CRITICAL: failed to persist incoming request:", persistErr);
    logStorageEvent("incoming_persist_failed", {
      quizId,
      error: persistErr.message,
      timestamp: receivedAt,
    });
  }

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
      logStorageEvent("validation_failed", {
        quizId,
        incomingId: incoming?.incomingId || null,
        reason: "aboutMe_and_scalpAnalysis_required",
      });
      return res.status(400).json({
        ok: false,
        error: "aboutMe and scalpAnalysis are required to generate a report.",
        quizId,
        incomingId: incoming?.incomingId || null,
      });
    }

    // Never reuse cached PDFs from older layout versions, and never reuse a
    // mapping older than HASH_REUSE_TTL_MS (see readContentHashMapping).
    // This only skips regeneration for near-instant duplicate submits.
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
        logStorageEvent("content_unchanged_reuse", {
          quizId,
          reportId: existingByHash.reportId,
          incomingId: incoming?.incomingId || null,
          status: "ok",
        });
        return res.json({
          ok: true,
          success: true,
          skipped: true,
          reason: "content_unchanged",
          quizId,
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
    let { reportId, reportDate } = await allocateReportId();
    logStorageEvent("report_id_generated", {
      quizId,
      reportId,
      incomingId: incoming?.incomingId || null,
      ignoredClientReportId: clientReportId || null,
      clientReportDate: clientReportDate || null,
    });

    if (clientReportId && isValidReportId(clientReportId)) {
      console.log(
        `[report] ignoring clientReportId=${String(clientReportId).trim()} → server ${reportId}`
      );
    }

    // Extra safety: if primary archive somehow already exists, never overwrite.
    // Keep the conflicting submission as TR-…-DUPN, then allocate a fresh primary ID.
    let precheckDuplicate = null;
    if (await primaryArchiveExists(reportId)) {
      const { duplicateReportId } = await allocateDuplicateReportId(reportId);
      precheckDuplicate = await saveDuplicateReport({
        originalReportId: reportId,
        duplicateReportId,
        reason: "report_id_already_exists_before_pipeline",
        requestPayload,
        quizId,
        jsonData: {
          reportId,
          quizId,
          aboutMe,
          hairHealth: hairHealth || {},
          internalHealth: internalHealth || {},
          scalpAnalysis,
          note: "Captured before pipeline because primary Report ID already existed",
        },
      });

      logStorageEvent("duplicate_detected", {
        quizId,
        reportId,
        duplicateReportId: precheckDuplicate.duplicateReportId,
        storageLocation: precheckDuplicate.dir,
        reason: "report_id_already_exists_before_pipeline",
        status: "saved_to_duplicate_reports",
      });

      const regenerated = await allocateReportId();
      logStorageEvent("report_id_regenerated_after_duplicate", {
        quizId,
        originalReportId: reportId,
        regeneratedReportId: regenerated.reportId,
      });
      reportId = regenerated.reportId;
      reportDate = regenerated.reportDate;
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
      quizId,
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
      ...(precheckDuplicate
        ? {
            originalConflictingReportId: precheckDuplicate.originalReportId,
            duplicateArchiveId: precheckDuplicate.duplicateReportId,
          }
        : {}),
    };

    // Canonical steps: Generate PDF → Save on VPS (fail-safe) → Append Sheets → return
    const package_ = await runReportPipeline({
      payload,
      apiPublicBase: getApiPublicBase(req),
      patientName: aboutMe.fullName || "Guest",
      quizId,
      requestPayload,
    });

    await writeContentHashMapping(contentHash, reportId, reportDate);

    const publicPdfUrl = package_.publicPdfUrl || null;
    const storageInfo = package_.storageInfo || {};
    const sheetsResult = package_.sheets || {
      skipped: true,
      reason: "not_attempted",
    };

    logStorageEvent("storage_success", {
      quizId,
      reportId,
      storageLocation: storageInfo.reportDir || storageInfo.dir || null,
      isDuplicate: Boolean(package_.isDuplicate || storageInfo.isDuplicate),
      sheetsSynced: sheetsResult?.ok === true && sheetsResult?.skipped !== true,
      status:
        package_.isDuplicate || storageInfo.isDuplicate
          ? "ok_via_duplicate_storage"
          : "ok_primary",
    });

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
      quizId,
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
      isDuplicate: Boolean(package_.isDuplicate || storageInfo.isDuplicate),
      duplicateHandling: precheckDuplicate
        ? {
            originalReportId: precheckDuplicate.originalReportId,
            duplicateArchiveId: precheckDuplicate.duplicateReportId,
            regeneratedReportId: reportId,
          }
        : package_.isDuplicate
          ? {
              originalReportId: package_.originalReportId,
              duplicateArchiveId: package_.duplicateReportId,
              regeneratedReportId: null,
            }
          : null,
      // Explicit pipeline contract for the frontend / ops
      pipeline: {
        geminiAnalysis: true, // already completed via POST /api/analyze
        pdfGenerated: package_.pipeline?.pdfGenerated === true,
        savedOnVps: package_.pipeline?.savedOnVps === true,
        sheetsAppended: package_.pipeline?.sheetsAppended === true,
        sheetsConfigured: isSheetsConfigured(),
        returnedToFrontend: true,
        storage: package_.pipeline?.storage || storageInfo.storage || "local",
        location: package_.pipeline?.location || storageInfo.location || "primary",
        isDuplicate: Boolean(package_.isDuplicate || storageInfo.isDuplicate),
        pdfUrl: publicPdfUrl || storageInfo.pdfUrl || null,
        resultPageUrl,
      },
      message: package_.pipeline?.sheetsAppended
        ? "Report saved on VPS and appended to Google Sheets"
        : "Report saved on VPS (Sheets skipped or failed — see sheets field)",
    });
  } catch (err) {
    console.error("[report] submit failed:", err);
    logStorageEvent("storage_failure", {
      quizId,
      incomingId: incoming?.incomingId || null,
      error: err.message,
      status: "failed",
    });

    // Last-resort: keep the full request in duplicate_reports so nothing is lost.
    try {
      const failBase =
        (req.body?.clientReportId && isValidReportId(req.body.clientReportId)
          ? String(req.body.clientReportId).trim().toUpperCase()
          : null) || "FAIL";
      await saveDuplicateReport({
        originalReportId: failBase,
        reason: `submit_exception: ${err.message}`,
        requestPayload,
        quizId,
        jsonData: {
          error: err.message,
          aboutMe: req.body?.aboutMe || null,
          scalpAnalysis: req.body?.scalpAnalysis || null,
          hairHealth: req.body?.hairHealth || null,
          internalHealth: req.body?.internalHealth || null,
        },
      });
    } catch (dupErr) {
      console.error("CRITICAL: failed to save exception duplicate archive:", dupErr);
    }

    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message || "Failed to generate and store assessment report.",
      quizId,
      incomingId: incoming?.incomingId || null,
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
    const apiPublicBase = getApiPublicBase(req);

    // The JSON archive only stores { type, label, hasImage } — the actual
    // photo bytes were saved as real files (see saveScalpPhotosLocal) and
    // are served from GET /api/report/:reportId/photo/:type. Attach that
    // URL here so the frontend's existing merge logic, which already checks
    // img.url, picks it up with no frontend changes needed.
    const scalpImagesWithUrls = (Array.isArray(data.scalpImages) ? data.scalpImages : []).map(
      (img) => {
        if (!img?.hasImage || !img?.type) return img;
        return {
          ...img,
          url: `${apiPublicBase}/api/report/${encodeURIComponent(loaded.reportId)}/photo/${encodeURIComponent(img.type)}`,
        };
      }
    );

    return res.json({
      ok: true,
      reportId: loaded.reportId,
      reportDate: data.reportDate || null,
      resultPageUrl: data.resultPageUrl || null,
      aboutMe: data.aboutMe || {},
      hairHealth: data.hairHealth || {},
      internalHealth: data.internalHealth || {},
      scalpAnalysis: data.scalpAnalysis || null,
      scalpImages: scalpImagesWithUrls,
      reportMeta: data.reportMeta || {},
      gender: data.gender || data.aboutMe?.gender || null,
      submittedAt: data.submittedAt || null,
      quizId: data.quizId || null,
      pdfUrl:
        buildPublicPdfUrl(loaded.reportId, apiPublicBase) ||
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
 * Stream a single saved scalp photo (front/top/side/back) for a report.
 * GET /api/report/:reportId/photo/:type
 *
 * This is what lets the live Result page, the team's Google Sheet, or any
 * other device/browser see the actual photo — instead of depending on the
 * originating browser's IndexedDB, which is empty for anyone else.
 */
export async function getAssessmentReportPhoto(req, res) {
  try {
    const { reportId, type } = req.params;
    const loaded = await loadReportPhoto(reportId, type);

    res.setHeader("Content-Type", loaded.contentType || "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(loaded.buffer);
  } catch (err) {
    const status = err.status || 500;
    if (status === 404 || status === 400) {
      return res.status(status).json({ error: err.message });
    }
    console.error("[report] photo get failed:", err);
    return res.status(500).json({
      error: err.message || "Failed to load photo.",
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