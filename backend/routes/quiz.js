import express from "express";
import { analyzeScalp } from "../controllers/analyzeController.js";
import { generateResult } from "../controllers/resultController.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

router.post("/analyze", analyzeScalp);
router.post("/result", generateResult);

export default router;