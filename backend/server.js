import "dotenv/config";
import express from "express";
import cors from "cors";

import quizRouter from "./routes/quiz.js"; 
import { setGlobalDispatcher, Agent } from 'undici';

// Extend the network timeout to 3 minutes (180,000ms)
setGlobalDispatcher(new Agent({
  connect: { timeout: 180_000 },
  headersTimeout: 180_000,
  bodyTimeout: 180_000
}));// Explicit extension added

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" })); // Handles large image strings without dropping connections

// Bind application sub-routes
app.use("/api", quizRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Model: ${process.env.OPENAI_MODEL || "gpt-4o"}`);
  console.log(`API key loaded: ${process.env.OPENAI_API_KEY ? "yes" : "NO — add OPENAI_API_KEY to .env"}`);
});