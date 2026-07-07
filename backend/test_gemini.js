// Standalone isolation test — run with: node test_gemini.js
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";

console.log("Node version:", process.version);
console.log("Key prefix:", API_KEY.slice(0, 6), "length:", API_KEY.length);

const ai = new GoogleGenAI({ apiKey: API_KEY });

// A tiny 1x1 red pixel PNG, base64-encoded — stands in for a real scalp photo.
const TINY_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const imagePart = {
  inlineData: { mimeType: "image/png", data: TINY_IMAGE_BASE64 },
};

async function runTest(label, payload) {
  console.log(`\n--- ${label} ---`);
  console.log("Sending at", new Date().toISOString());
  const start = Date.now();
  try {
    const response = await ai.models.generateContent(payload);
    console.log(`✅ SUCCESS in ${Date.now() - start}ms`);
    console.log(response.text);
  } catch (err) {
    console.log(`❌ FAILED after ${Date.now() - start}ms`);
    console.error(err.message || err);
  }
}

// OLD SHAPE (suspected broken): bare string mixed with Part objects.
await runTest("OLD SHAPE (string + parts, no role wrapper)", {
  model: "gemini-3.5-flash",
  contents: ["Describe this image in one word.", imagePart],
});

// NEW SHAPE (fixed): explicit Content object with role + parts, text wrapped.
await runTest("NEW SHAPE (explicit role/parts, text wrapped)", {
  model: "gemini-3.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        { text: "Describe this image in one word." },
        imagePart,
      ],
    },
  ],
});