import { buildAssessmentPdf, PDF_FORMAT_VERSION } from "./pdfService.js";
import { saveReportArtifacts } from "./storageService.js";
import {
  appendLeadToGoogleSheet,
  buildPublicPdfUrl,
  isSheetsConfigured,
} from "./googleSheetsService.js";

/**
 * Canonical post-analysis report pipeline (after Gemini via POST /api/analyze):
 *
 *   Customer submits quiz → Gemini analysis
 *        ↓
 *   Generate PDF
 *        ↓
 *   Save PDF (+ JSON) on VPS disk
 *        ↓
 *   Append lead to Google Sheets
 *        ↓
 *   Return report metadata to the frontend
 *
 * Drive upload / org email are optional side-effects handled by the controller.
 *
 * @returns {Promise<{
 *   reportId: string,
 *   reportDate: string,
 *   resultPageUrl: string|null,
 *   pdfBuffer: Buffer,
 *   archive: object,
 *   storageInfo: object,
 *   publicPdfUrl: string|null,
 *   sheets: object,
 *   pipeline: {
 *     pdfGenerated: boolean,
 *     savedOnVps: boolean,
 *     sheetsAppended: boolean,
 *     sheetsConfigured: boolean,
 *     storage: string,
 *   }
 * }>}
 */
export async function runReportPipeline({
  payload,
  apiPublicBase = null,
  patientName = "Guest",
} = {}) {
  const reportId = payload?.reportId;
  if (!reportId) {
    throw new Error("runReportPipeline requires payload.reportId");
  }

  // 1) Generate PDF
  const pdfBuffer = await buildAssessmentPdf(payload);

  const archive = {
    ...payload,
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

  // 2) Save PDF (+ JSON) on VPS (local disk always; Drive/S3 optional inside storage service)
  const storageInfo = await saveReportArtifacts({
    reportId,
    pdfBuffer,
    jsonData: {
      ...archive,
      pdfFormatVersion: PDF_FORMAT_VERSION,
    },
    patientName,
  });

  const savedOnVps = Boolean(
    storageInfo?.localBackup?.pdfPath ||
      storageInfo?.pdfPath ||
      storageInfo?.storage === "local" ||
      storageInfo?.storage === "google_drive" ||
      storageInfo?.storage === "s3"
  );

  console.log(
    `[pipeline] ${reportId}: pdf=ok storage=${storageInfo.storage}` +
      (storageInfo.pdfPath ? ` path=${storageInfo.pdfPath}` : "") +
      (storageInfo.driveError ? ` driveError=${storageInfo.driveError}` : "")
  );

  // Live VPS PDF URL for Sheets / frontend (never localhost)
  const publicPdfUrl =
    buildPublicPdfUrl(reportId, apiPublicBase) || storageInfo.pdfUrl || null;

  // 3) Append lead to Google Sheets
  let sheets = { skipped: true, reason: "not_attempted" };
  try {
    sheets = await appendLeadToGoogleSheet({
      reportId,
      reportDate: payload.reportDate,
      aboutMe: payload.aboutMe || {},
      scalpAnalysis: payload.scalpAnalysis || {},
      reportMeta: payload.reportMeta || {},
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

  // 4) Return report package for the frontend
  return {
    reportId,
    reportDate: payload.reportDate,
    resultPageUrl: payload.resultPageUrl || null,
    pdfBuffer,
    archive,
    storageInfo,
    publicPdfUrl,
    sheets,
    pipeline: {
      pdfGenerated: true,
      savedOnVps,
      sheetsAppended,
      sheetsConfigured: isSheetsConfigured(),
      storage: storageInfo.storage || "local",
      pdfUrl: publicPdfUrl,
      resultPageUrl: payload.resultPageUrl || null,
    },
  };
}
