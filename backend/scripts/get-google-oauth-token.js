/**
 * One-time helper: get a Google OAuth refresh token for Drive + Sheets.
 *
 * Setup:
 * 1. Google Cloud Console → enable Google Drive API + Google Sheets API
 * 2. Credentials → OAuth client (Desktop, or Web with redirect http://localhost:3333/oauth2callback)
 * 3. Put CLIENT_ID + CLIENT_SECRET in backend/.env
 * 4. From backend/:  node scripts/get-google-oauth-token.js
 * 5. Open the printed URL, approve with the Google account that owns the Sheet
 * 6. Copy GOOGLE_DRIVE_REFRESH_TOKEN=... into backend/.env (same token used for Sheets)
 * 7. Also set GOOGLE_SHEETS_SPREADSHEET_ID=...
 */

import "dotenv/config";
import http from "http";
import { google } from "googleapis";
import { DRIVE_SCOPE } from "../services/googleDriveService.js";
import { SHEETS_SCOPE } from "../services/googleSheetsService.js";

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_DRIVE_REDIRECT_URI || "http://localhost:3333/oauth2callback";
const PORT = Number(new URL(REDIRECT_URI).port || 3333);

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET in backend/.env"
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [DRIVE_SCOPE, SHEETS_SCOPE],
});

console.log("\n=== Zylk Google OAuth setup (Drive + Sheets) ===\n");
console.log("1. Make sure this redirect URI is allowed on your OAuth client:");
console.log(`   ${REDIRECT_URI}`);
console.log("\n2. Open this URL in your browser and approve access:\n");
console.log(authUrl);
console.log("\n3. Waiting for Google redirect on", REDIRECT_URI, "...\n");

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url?.startsWith("/oauth2callback")) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const code = url.searchParams.get("code");
    const err = url.searchParams.get("error");

    if (err) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`OAuth error: ${err}`);
      console.error("OAuth error:", err);
      server.close();
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing code");
      return;
    }

    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(
      "<h2>Success</h2><p>You can close this tab and return to the terminal.</p>"
    );

    console.log("\nAdd these to backend/.env on the VPS:\n");
    console.log(`GOOGLE_DRIVE_CLIENT_ID=${CLIENT_ID}`);
    console.log(`GOOGLE_DRIVE_CLIENT_SECRET=${CLIENT_SECRET}`);
    if (tokens.refresh_token) {
      console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${tokens.refresh_token}`);
    } else {
      console.log(
        "# No refresh_token returned. Revoke app access at https://myaccount.google.com/permissions then run again."
      );
    }
    console.log(
      "# GOOGLE_SHEETS_SPREADSHEET_ID=paste_id_from_sheet_url"
    );
    console.log("# GOOGLE_SHEETS_RANGE=Leads!A:L");
    console.log("# PUBLIC_API_URL=https://api.zylkhealth.com");
    console.log("");

    server.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(e.message || e));
    server.close();
    process.exit(1);
  }
});

server.listen(PORT);
