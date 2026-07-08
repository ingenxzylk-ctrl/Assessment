import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

if (!API_KEY) {
  console.error("Set GEMINI_API_KEY in backend/.env first");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function main() {
  console.log("Testing model:", MODEL);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: "Describe this image in one word as JSON: {\"word\":\"...\"}" },
          { inlineData: { mimeType: "image/png", data: tinyPng } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      thinkingConfig: { thinkingLevel: "minimal" },
    },
  });

  console.log("SUCCESS:");
  console.log(response.text);
}

main().catch((err) => {
  console.error("FAILED:");
  console.error(err.message || err);
  process.exit(1);
});