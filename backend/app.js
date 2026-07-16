import "dotenv/config";
import express from "express";
import cors from "cors";
import quizRouter from "./routes/quiz.js";
import { setGlobalDispatcher, Agent } from "undici";

setGlobalDispatcher(
  new Agent({
    connect: { timeout: 180_000 },
    headersTimeout: 180_000,
    bodyTimeout: 180_000,
  })
);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.use("/api", quizRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Model: ${process.env.GEMINI_MODEL || "gemini-3.5-flash"}`);
  console.log(
    `API key loaded: ${process.env.GEMINI_API_KEY ? "yes" : "NO — add GEMINI_API_KEY to .env"}`
  );
});