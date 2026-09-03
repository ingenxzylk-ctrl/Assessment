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
app.set("trust proxy", 1);

app.use(cors());
app.use((req, res, next) => {
  const isWooHook = String(req.path || "").includes("/webhooks/woocommerce");
  const parser = express.json({
    limit: isWooHook ? "1mb" : "50mb",
    verify: isWooHook
      ? (request, _res, buf) => {
          request.rawBody = buf;
        }
      : undefined,
  });
  return parser(req, res, next);
});

app.use("/api", quizRouter);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Model: ${process.env.GEMINI_MODEL || "gemini-3.5-flash"}`);
  console.log(
    `API key loaded: ${process.env.GEMINI_API_KEY ? "yes" : "NO — add GEMINI_API_KEY to .env"}`
  );
});