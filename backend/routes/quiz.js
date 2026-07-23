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

const router = express.Router();

router.get("/health", (_req, res) => {
  const keys = [
    process.env.GEMINI_API_KEY,
    ...(String(process.env.GEMINI_API_KEYS || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)),
  ].filter((k) => k && k !== "your_key_from_https://aistudio.google.com/apikey");

  res.json({
    ok: true,
    provider: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    hasApiKey: keys.length > 0,
    apiKeyCount: [...new Set(keys)].length,
    // Deploy check: production must show v6-strict-2page (not v2-result-link).
    // curl -s https://api.zylkhealth.com/api/health | jq .pdfFormatVersion
    pdfFormatVersion: PDF_FORMAT_VERSION,
    pdfTargetPages: PDF_TARGET_PAGES,
  });
});
router.post("/analyze", analyzeScalp);
router.post("/result", generateResult);
router.post("/report/submit", submitAssessmentReport);
router.get("/report/:reportId", getAssessmentReport);

export default router;