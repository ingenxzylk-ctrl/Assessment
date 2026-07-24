import express from "express";
import { analyzeScalp } from "../controllers/analyzeController.js";
import { generateResult } from "../controllers/resultController.js";
import {
  submitAssessmentReport,
  getAssessmentReport,
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

const router = express.Router();

router.get("/health", (_req, res) => {
  const keys = [
    process.env.GEMINI_API_KEY,
    ...(String(process.env.GEMINI_API_KEYS || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)),
  ].filter((k) => k && k !== "your_key_from_https://aistudio.google.com/apikey");

  const driveConfigured = isDriveConfigured();
  res.json({
    ok: true,
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    hasApiKey: keys.length > 0,
    apiKeyCount: [...new Set(keys)].length,
    pdfFormatVersion: PDF_FORMAT_VERSION,
    pdfTargetPages: PDF_TARGET_PAGES,
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
  });
});
router.post("/analyze", analyzeScalp);
router.post("/result", generateResult);
router.post("/report/submit", submitAssessmentReport);
router.get("/report/:reportId", getAssessmentReport);

export default router;
