// backend/scripts/cleanupHashMappings.js
// Run periodically (e.g. daily via cron / pm2 cron_restart, or a setInterval at boot)
// to stop the reports directory from filling up with _hash_*.json files that will
// never be reused again (they're only useful within HASH_REUSE_TTL_MS anyway).

import fs from "fs/promises";
import path from "path";
import { REPORTS_ROOT } from "../services/reportIdService.js";

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // keep 24h for debugging, well past the 15min reuse TTL

export async function cleanupStaleHashMappings() {
  let removed = 0;
  try {
    const entries = await fs.readdir(REPORTS_ROOT);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.startsWith("_hash_") || !entry.endsWith(".json")) continue;
      const full = path.join(REPORTS_ROOT, entry);
      try {
        const stat = await fs.stat(full);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          await fs.unlink(full);
          removed += 1;
        }
      } catch {
        // ignore individual file errors, keep going
      }
    }
  } catch (err) {
    console.error("[cleanup] failed to scan hash mappings:", err.message);
  }
  if (removed > 0) console.log(`[cleanup] removed ${removed} stale hash mapping file(s)`);
  return removed;
}

// If run directly: `node backend/scripts/cleanupHashMappings.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupStaleHashMappings().then(() => process.exit(0));
}