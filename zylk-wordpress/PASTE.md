# Zylk Health — what to paste in WordPress

Use **only** these two files. Do not paste the old stacked Additional CSS.

**Marquee:** The script places it at the **top** (first content under the header, above the banner). Do **not** paste the old CSS comment that says “between banner & products” — that was the previous behavior.

## 1. Additional CSS (replace everything)

Raw URL (branch `cursor/marquee-full-bleed-55be`):

`https://raw.githubusercontent.com/ingenxzylk-ctrl/Assessment/cursor/marquee-full-bleed-55be/zylk-wordpress/zylk-full-additional.css`

Appearance → Customize → Additional CSS → select all → paste → Publish.

## 2. Footer script (replace Raw HTML block) — required for top placement

`https://raw.githubusercontent.com/ingenxzylk-ctrl/Assessment/cursor/marquee-full-bleed-55be/zylk-wordpress/zylk-marquee-script.html`

Then hard-refresh the site (Ctrl/Cmd+Shift+R).

## Do not use

Patch files like `zylk-*-fix.css` / `zylk-*-patch.css` in this folder are historical. Everything needed is already merged into `zylk-full-additional.css`.
