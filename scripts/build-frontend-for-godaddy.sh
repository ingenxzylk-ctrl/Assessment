#!/usr/bin/env bash
# Build frontend for GoDaddy web hosting (quiz.zylkhealth.com).
# Upload everything inside frontend/dist/ to the subdomain document root in cPanel.
set -euo pipefail
cd "$(dirname "$0")/.."
cd frontend
npm install
npm run build
echo ""
echo "Done. Upload the contents of frontend/dist/ to GoDaddy:"
echo "  cPanel → Domains → quiz.zylkhealth.com → Document root"
echo "  (or public_html/quiz if that is your subdomain folder)"
echo ""
ls -la dist/ | head -20
