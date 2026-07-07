import express from "express";
import { analyzeScalp } from "../controllers/analyzeController.js"; // Added .js extension
import { generateResult } from "../controllers/resultController.js";   // Added .js extension

const router = express.Router();

// Route vectors handling image parsing and analytical recommendations
router.post("/analyze", analyzeScalp);
router.post("/result", generateResult);

export default router;