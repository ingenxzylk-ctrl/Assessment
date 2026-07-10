import express from "express";
import { analyzeScalp } from "../controllers/analyzeController.js";
import { generateResult } from "../controllers/resultController.js";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-4o",
    hasApiKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

router.post("/analyze", analyzeScalp);
router.post("/result", generateResult);

export default router;
