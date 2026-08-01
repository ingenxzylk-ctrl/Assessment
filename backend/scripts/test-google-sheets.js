/**
 * Diagnose Google Sheets lead sync on the VPS.
 *
 * Usage (from backend/):
 *   node scripts/test-google-sheets.js
 *   node scripts/test-google-sheets.js --append
 *
 * --append writes one test row (Call Status=New) so you can confirm the Sheet updates.
 */

import "dotenv/config";
import {
  appendLeadToGoogleSheet,
  getSheetsStatus,
  probeGoogleSheets,
} from "../services/googleSheetsService.js";

const doAppend = process.argv.includes("--append");

console.log("\n=== Google Sheets diagnostic ===\n");
console.log("env status:", getSheetsStatus());

const probe = await probeGoogleSheets();
console.log("\nprobe:", JSON.stringify(probe, null, 2));

if (!probe.ok) {
  console.error("\n❌ Cannot access the Sheet. Fix the error above, then retry.");
  process.exit(1);
}

console.log(`\n✅ Opened spreadsheet: "${probe.title}"`);
console.log("   Tabs:", (probe.tabNames || []).join(", ") || "(none)");
console.log("   Header:", (probe.headerRow || []).join(" | ") || "(empty)");

if (!doAppend) {
  console.log("\nNo row written. Re-run with --append to insert a test lead.\n");
  process.exit(0);
}

const reportId = `TR-SHEETS-TEST-${Date.now().toString().slice(-6)}`;
const result = await appendLeadToGoogleSheet({
  reportId,
  reportDate: new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  aboutMe: {
    fullName: "Sheets Test Lead",
    email: "sheets-test@zylkhealth.com",
    gender: "male",
    age: 30,
    whatsapp: "9999999999",
    countryCode: "+91",
  },
  scalpAnalysis: { aiPredictedStage: 1 },
  reportMeta: { recommendedBundle: { bundleTitle: "Sheets Probe Kit" } },
  resultPageUrl: `https://quiz.zylkhealth.com/?report=${reportId}`,
  pdfUrl: `https://api.zylkhealth.com/api/report/${reportId}/pdf`,
});

console.log("\nappend:", JSON.stringify(result, null, 2));

if (result.ok) {
  console.log(`\n✅ Test row appended (${reportId}). Refresh the Google Sheet.\n`);
  process.exit(0);
}

console.error("\n❌ Append failed. See error above.\n");
process.exit(1);
