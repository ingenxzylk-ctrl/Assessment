import express from "express";
import { analyzeScalp } from "../controllers/analyzeController.js";
import { generateResult } from "../controllers/resultController.js";
import {
  submitAssessmentReport,
  getAssessmentReport,
  getAssessmentReportPdf,
  getAssessmentReportPhoto,
} from "../controllers/reportController.js";
import {
  PDF_FORMAT_VERSION,
  PDF_TARGET_PAGES,
} from "../services/pdfService.js";
import {
  isDriveConfigured,
  hasOAuthConfig,
  hasServiceAccountConfig,
} from "../services/googleDriveService.js";
import {
  isSheetsConfigured,
  probeGoogleSheets,
} from "../services/googleSheetsService.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  const keys = [
    process.env.GEMINI_API_KEY,
    ...(String(process.env.GEMINI_API_KEYS || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)),
  ].filter((k) => k && k !== "your_key_from_https://aistudio.google.com/apikey");

  const driveConfigured = isDriveConfigured();
  const sheetsConfigured = isSheetsConfigured();
  const wantProbe =
    String(req.query.probeSheets || "") === "1" ||
    String(req.query.probeSheets || "").toLowerCase() === "true";

  let sheetsProbe = null;
  if (wantProbe) {
    sheetsProbe = await probeGoogleSheets();
  }

  res.json({
    ok: true,
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    hasApiKey: keys.length > 0,
    apiKeyCount: [...new Set(keys)].length,
    pdfFormatVersion: PDF_FORMAT_VERSION,
    pdfTargetPages: PDF_TARGET_PAGES,
    // End-to-end assessment flow (Gemini stays on POST /api/analyze for photo reject UX)
    pipeline: [
      "customer_submits_quiz",
      "gemini_analysis (POST /api/analyze)",
      "generate_pdf",
      "save_pdf_vps",
      "append_google_sheets",
      "return_report_frontend (POST /api/report/submit)",
    ],
    // If drive.configured is false, PDFs stay local and do not appear in Drive
    drive: {
      configured: driveConfigured,
      hasFolderId: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
      authMode: hasOAuthConfig()
        ? "oauth"
        : hasServiceAccountConfig()
          ? "service_account"
          : "none",
      hint: driveConfigured
        ? "Drive upload enabled — check PM2 logs if a file is missing"
        : "Drive upload disabled — set GOOGLE_DRIVE_FOLDER_ID + OAuth (CLIENT_ID/SECRET/REFRESH_TOKEN) or a Shared Drive service account",
    },
    sheets: {
      configured: sheetsConfigured,
      hasSpreadsheetId: Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID),
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
      range: process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A:L",
      authMode: hasOAuthConfig()
        ? "oauth"
        : hasServiceAccountConfig()
          ? "service_account"
          : "none",
      hint: sheetsConfigured
        ? "Sheets lead sync enabled — new assessments append a row with Call Status=New. Add ?probeSheets=1 to verify live access."
        : "Sheets sync disabled — set GOOGLE_SHEETS_SPREADSHEET_ID + prefer service account (share Sheet with SA email as Editor); OAuth also works if Sheets scope is on the refresh token",
      probe: sheetsProbe,
    },
  });
});
router.post("/analyze", analyzeScalp);
router.post("/result", generateResult);
router.post("/report/submit", submitAssessmentReport);

router.get("/report/:reportId/pdf", getAssessmentReportPdf);
router.get("/report/:reportId/photo/:type", getAssessmentReportPhoto);
router.get("/report/:reportId", getAssessmentReport);

export default router;
