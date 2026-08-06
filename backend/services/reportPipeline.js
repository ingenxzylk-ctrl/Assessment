import fs from "fs/promises";
import path from "path";
import { buildAssessmentPdf, PDF_FORMAT_VERSION } from "./pdfService.js";
import {
  saveReportArtifactsFailSafe,
  saveScalpPhotosLocal,
  logStorageEvent,
  primaryArchiveExists,
} from "./storageService.js";
import {
  appendLeadToGoogleSheet,
  buildPublicPdfUrl,
  isSheetsConfigured,
} from "./googleSheetsService.js";

async function writeSheetsSidecar(storageInfo, reportId, sheets) {
  const dir =
    storageInfo?.localBackup?.dir ||
    storageInfo?.reportDir ||
    storageInfo?.dir ||
    (storageInfo?.pdfPath && !String(storageInfo.pdfPath).startsWith("s3://")
      ? path.dirname(storageInfo.pdfPath)
      : null);
  if (!dir) return;
  try {
    await fs.writeFile(
      path.join(dir, "sheets.json"),
      JSON.stringify(
        {
          reportId,
          at: new Date().toISOString(),
          sheets,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (err) {
    console.warn(
      `[pipeline] ${reportId}: could not write sheets.json:`,
      err?.message || err
    );
  }
}

/**
 * Fail-safe post-analysis pipeline:
 *   Generate PDF → Save (primary or duplicate_reports) → Save photo files → Sheets → return
 *
 * Never overwrites primary. Collisions go to duplicate_reports/.
 */
export async function runReportPipeline({
  payload,
  apiPublicBase = null,
  patientName = "Guest",
  quizId = null,
  requestPayload = null,
} = {}) {
  const reportId = payload?.reportId;
  if (!reportId) {
    throw new Error("runReportPipeline requires payload.reportId");
  }

  await logStorageEvent("pipeline_start", {
    reportId,
    quizId,
    status: "started",
  });

  const existedBefore = await primaryArchiveExists(reportId);

  // 1) Generate PDF
  const pdfBuffer = await buildAssessmentPdf(payload);

  const archive = {
    ...payload,
    quizId: quizId || payload.quizId || null,
    // Keep the JSON archive lightweight — no inline base64 — but the actual
    // photo bytes are saved separately as real files (see saveScalpPhotosLocal
    // below) and served back via GET /api/report/:reportId/photo/:type.
    scalpImages: Array.isArray(payload.scalpImages)
      ? payload.scalpImages.map((img) => ({
          type: img?.type,
          label: img?.label,
          hasImage: Boolean(img?.dataUrl || img?.previewUrl || img?.url),
        }))
      : [],
    pdfFormatVersion: PDF_FORMAT_VERSION,
    storageInfo: undefined,
  };

  // 2) Fail-safe save (primary if free, else duplicate_reports — never lose)
  const storageInfo = await saveReportArtifactsFailSafe({
    reportId,
    pdfBuffer,
    jsonData: {
      ...archive,
      pdfFormatVersion: PDF_FORMAT_VERSION,
    },
    patientName,
    quizId,
    requestPayload,
    reasonIfDuplicate: existedBefore
      ? "report_id_already_exists"
      : "race_or_unexpected_conflict",
  });

  const savedOnVps = Boolean(
    storageInfo?.localBackup?.pdfPath ||
      storageInfo?.localBackup?.jsonPath ||
      storageInfo?.pdfPath ||
      storageInfo?.jsonPath ||
      storageInfo?.reportDir ||
      storageInfo?.storage === "local" ||
      storageInfo?.storage === "local_duplicate" ||
      storageInfo?.storage === "google_drive" ||
      storageInfo?.storage === "s3"
  );

  await logStorageEvent("pipeline_stored", {
    reportId,
    quizId,
    isDuplicate: Boolean(storageInfo.isDuplicate),
    storageLocation: storageInfo.reportDir || storageInfo.dir || null,
    location: storageInfo.location || storageInfo.storage,
    status: savedOnVps ? "ok" : "error",
  });

  console.log(
    `[pipeline] ${reportId}: pdf=ok` +
      ` storage=${storageInfo.storage}` +
      (storageInfo.isDuplicate ? " DUPLICATE" : " primary") +
      (storageInfo.pdfPath ? ` path=${storageInfo.pdfPath}` : "") +
      (storageInfo.driveError ? ` driveError=${storageInfo.driveError}` : "")
  );

  // 2b) Save scalp photos as real files next to the PDF/JSON so they can be
  // served back by URL — this is what the live Result page and the team's
  // Google Sheet links both need. Only works for local/duplicate storage
  // (S3/Drive-only setups skip this silently — savedPhotos stays empty).
  const reportDirForPhotos =
    storageInfo?.localBackup?.dir || storageInfo?.reportDir || storageInfo?.dir || null;
  let savedPhotos = [];
  if (reportDirForPhotos) {
    try {
      savedPhotos = await saveScalpPhotosLocal({
        reportDir: reportDirForPhotos,
        scalpImages: payload.scalpImages || [],
      });
      if (savedPhotos.length) {
        console.log(
          `[pipeline] ${reportId}: saved ${savedPhotos.length} scalp photo file(s)`
        );
      }
    } catch (err) {
      console.warn(
        `[pipeline] ${reportId}: failed to save scalp photo files:`,
        err?.message || err
      );
    }
  }

  // Sheet / public PDF URL — for duplicates still reference the intended reportId
  const publicPdfUrl =
    buildPublicPdfUrl(reportId, apiPublicBase) || storageInfo.pdfUrl || null;

  // 3) Append lead to Google Sheets (even duplicates — both leads must appear)
  let sheets = { skipped: true, reason: "not_attempted" };
  try {
    const sheetReportId = storageInfo.isDuplicate
      ? storageInfo.duplicateReportId || reportId
      : reportId;
    sheets = await appendLeadToGoogleSheet({
      reportId: sheetReportId,
      reportDate: payload.reportDate,
      aboutMe: payload.aboutMe || {},
      scalpAnalysis: payload.scalpAnalysis || {},
      reportMeta: {
        ...(payload.reportMeta || {}),
        ...(storageInfo.isDuplicate
          ? {
              duplicateOf: storageInfo.originalReportId,
              storedAsDuplicate: true,
            }
          : {}),
      },
      resultPageUrl: payload.resultPageUrl || null,
      pdfUrl: publicPdfUrl,
    });
  } catch (err) {
    console.error(`[pipeline] ${reportId}: sheets failed:`, err?.message || err);
    sheets = { ok: false, skipped: false, error: err?.message || String(err) };
  }

  const sheetsAppended = Boolean(sheets?.ok && !sheets?.skipped);

  console.log(
    `[pipeline] ${reportId}: sheets=` +
      (sheetsAppended
        ? `ok ${sheets.updatedRange || ""}`
        : sheets.skipped
          ? `skipped (${sheets.reason || "n/a"})`
          : `error (${sheets.error || "unknown"})`)
  );

  await writeSheetsSidecar(storageInfo, reportId, sheets);

  await logStorageEvent("pipeline_complete", {
    reportId,
    quizId,
    sheetsAppended,
    isDuplicate: Boolean(storageInfo.isDuplicate),
    status: "ok",
  });

  // 4) Return report package for the frontend
  return {
    reportId,
    reportDate: payload.reportDate,
    resultPageUrl: payload.resultPageUrl || null,
    pdfBuffer,
    archive,
    storageInfo,
    publicPdfUrl,
    savedPhotos,
    sheets,
    isDuplicate: Boolean(storageInfo.isDuplicate),
    originalReportId: storageInfo.originalReportId || null,
    duplicateReportId: storageInfo.duplicateReportId || null,
    pipeline: {
      pdfGenerated: true,
      savedOnVps,
      sheetsAppended,
      sheetsConfigured: isSheetsConfigured(),
      storage: storageInfo.storage || "local",
      location: storageInfo.location || "primary",
      isDuplicate: Boolean(storageInfo.isDuplicate),
      pdfUrl: publicPdfUrl,
      resultPageUrl: payload.resultPageUrl || null,
    },
  };
}