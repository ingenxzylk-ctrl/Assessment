import PDFDocument from "pdfkit";

/**
 * Bump whenever PDF layout / live Result URL changes.
 * Live check: GET https://api.zylkhealth.com/api/health → pdfFormatVersion
 * Result app is https://quiz.zylkhealth.com/ (not WordPress /assessment/).
 */
export const PDF_FORMAT_VERSION = "v7-quiz-result-link";
export const PDF_TARGET_PAGES = 2;

const BRAND = "#064e3b";
const MUTED = "#4b5563";
const INK = "#111827";
const LINE = "#e5e7eb";
const LIVE_RESULT_BASE = "https://quiz.zylkhealth.com/";

function labelize(value, opts = {}) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => labelize(v, opts)).join(", ") : "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const raw = String(value);
  if (raw.includes("@") || /^https?:\/\//i.test(raw)) return raw;

  const isFemale = Boolean(opts.isFemale);

  const OPTION_LABELS = {
    under_50: "About the same as usual",
    "50_100": "Slightly more than usual",
    "100_150": "Much more than usual",
    over_150: "Hair is coming out in noticeable clumps",
    same: "About the same as usual",
    slightly_more: "Slightly more than usual",
    much_more: "Much more than usual",
    clumps: "Hair is coming out in noticeable clumps",
    minimal: "Minimal shedding",
    noticeable: "Noticeable hair fall",
    heavy: "Heavy shedding",
    flaking: "Flaking or dandruff",
    itching: "Itching",
    redness: "Redness or irritation",
    oily: "Oily scalp",
    tenderness: "Tenderness or burning",
    frequent: "Heavy dandruff",
    moderate: "Moderate dandruff",
    no: "No dandruff",
    front: "Front hairline or temples",
    crown: "Crown or top of head",
    parting: "Both front and crown",
    all_over: "General thinning all over",
    patchy: "Round or patchy areas",
    under_3m: "Within the past 3 months",
    "3m_6m": "3–6 months ago",
    "1": isFemale ? "Stage 1" : "1",
    "2": isFemale ? "Stage 2" : "2",
    "3": isFemale ? "Stage 3" : "3",
    overall_thinning: "Overall Thinning",
    "overall-thinning": "Overall Thinning",
    mother: isFemale
      ? "Mother's side (Mother,Grandmother)"
      : "Mother's side(Uncle,Grandfather)",
    father: isFemale
      ? "Father's side (Father,Grandfather)"
      : "Father's side(Uncle,Grandfather)",
    both: isFemale ? "Both sides of the family tree" : "Both sides",
    none: isFemale ? "No family history recorded" : "None",
    unsure: "I'm not sure",
  };

  const DURATION_LABELS = isFemale
    ? {
        under_6m: "Suddenly, within a few weeks",
        "6m_1y": "Gradually, over several months or years",
        "1y_3y": "It comes and goes",
        over_3y:
          "I noticed shedding after illness, childbirth, stress, or weight change",
      }
    : {
        under_6m: "Less than 6 months",
        "6m_1y": "6 months to 1 year",
        "1y_3y": "1 to 3 years",
        over_3y: "More than 3 years",
      };

  if (DURATION_LABELS[raw]) return DURATION_LABELS[raw];
  if (OPTION_LABELS[raw]) return OPTION_LABELS[raw];

  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(raw)) {
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return raw;
}

function resolveResultPageUrl(rawUrl, reportId) {
  let url = typeof rawUrl === "string" && rawUrl.trim() ? rawUrl.trim() : null;
  if (!url && reportId) {
    return `${LIVE_RESULT_BASE}?report=${encodeURIComponent(reportId)}`;
  }
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
      return reportId
        ? `${LIVE_RESULT_BASE}?report=${encodeURIComponent(reportId)}`
        : LIVE_RESULT_BASE;
    }
    // Old PDFs / misconfig pointed at WordPress /assessment/ (404) — always use quiz app
    if (
      (host === "zylkhealth.com" || host === "www.zylkhealth.com") &&
      /\/assessment\/?/i.test(parsed.pathname)
    ) {
      return reportId
        ? `${LIVE_RESULT_BASE}?report=${encodeURIComponent(reportId)}`
        : LIVE_RESULT_BASE;
    }
  } catch {
    return reportId
      ? `${LIVE_RESULT_BASE}?report=${encodeURIComponent(reportId)}`
      : LIVE_RESULT_BASE;
  }
  return url;
}

function pageWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pageBottom(doc) {
  return doc.page.height - doc.page.margins.bottom;
}

function clampText(value, maxChars) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

function addSectionTitle(doc, title) {
  doc.moveDown(0.2);
  doc
    .fontSize(9.5)
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .text(title, { underline: true });
  doc.moveDown(0.08);
  doc.font("Helvetica").fillColor(INK).fontSize(8);
}

function addKeyValue(doc, key, value, opts = {}) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
  const left = doc.page.margins.left;
  const width = opts.width || pageWidth(doc);
  const line = `${key}: ${clampText(labelize(value, opts), opts.maxChars || 220)}`;
  doc
    .font("Helvetica")
    .fontSize(opts.fontSize || 8)
    .fillColor(INK)
    .text(line, left, doc.y, {
      width,
      lineGap: 0.4,
      height: opts.height,
      ellipsis: Boolean(opts.height),
    });
}

function formatScalpSymptoms(value) {
  if (!Array.isArray(value) || !value.length) return null;
  const map = {
    flaking: "Flaking or dandruff",
    itching: "Itching",
    redness: "Redness or irritation",
    oily: "Oily scalp",
    tenderness: "Tenderness or burning",
    none: "None of these",
  };
  return value.map((id) => map[id] || labelize(id)).join(", ");
}

function formatYesNoWithDetails(choice, details) {
  const c = String(choice || "").trim();
  if (!c) return null;
  if (c.toLowerCase() === "no") return "No";
  if (c.toLowerCase() === "yes") {
    const d = String(details || "").trim();
    return d ? `Yes — ${d}` : "Yes";
  }
  return c;
}

function collectQaPairs(payload) {
  const { aboutMe = {}, hairHealth = {}, internalHealth = {}, gender } = payload;
  const isFemale = (gender || aboutMe.gender) === "female";
  const pairs = [];

  pairs.push(["Full name", aboutMe.fullName]);
  pairs.push(["Email", aboutMe.email]);
  pairs.push([
    "WhatsApp",
    aboutMe.whatsapp ? `${aboutMe.countryCode || ""} ${aboutMe.whatsapp}`.trim() : null,
  ]);
  pairs.push(["Age", aboutMe.age || aboutMe.ageRange]);
  pairs.push(["Gender", aboutMe.gender]);

  if (isFemale) {
    pairs.push(["Shedding amount", hairHealth.shedding_amount]);
    pairs.push(["Hair pattern stage", hairHealth.hair_fall_zone]);
    pairs.push(["Shedding vs usual", hairHealth.daily_loss_amount]);
    pairs.push(["Dandruff", hairHealth.dandruff_experience]);
    pairs.push(["Family history", hairHealth.family_history]);
    pairs.push(["How change began", hairHealth.loss_duration]);
    pairs.push(["Iron level", internalHealth.iron_level]);
    pairs.push(["Symptoms", internalHealth.symptoms]);
    pairs.push(["Life stage", internalHealth.life_stage]);
    pairs.push(["Digestion", internalHealth.digestion]);
    pairs.push(["Sleep", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push([
      "Vitamins / supplements",
      formatYesNoWithDetails(
        internalHealth.supplements,
        internalHealth.supplements_details
      ),
    ]);
    pairs.push([
      "Prescription medicines",
      formatYesNoWithDetails(
        internalHealth.prescription_medicines || internalHealth.blood_pressure,
        internalHealth.prescription_medicines_details
      ),
    ]);
    pairs.push(["Food habits", internalHealth.food_habits]);
  } else {
    pairs.push([
      "Norwood stage (self-report)",
      hairHealth.norwood_stage ? `Stage ${hairHealth.norwood_stage}` : null,
    ]);
    pairs.push(["Hair fall zone", hairHealth.hair_fall_zone]);
    pairs.push(["Shedding vs usual", hairHealth.daily_loss_amount]);
    pairs.push(["Dandruff", hairHealth.dandruff_experience]);
    if (Array.isArray(hairHealth.scalp_symptoms) && hairHealth.scalp_symptoms.length) {
      pairs.push(["Scalp symptoms", formatScalpSymptoms(hairHealth.scalp_symptoms)]);
    }
    pairs.push(["Family history", hairHealth.family_history]);
    pairs.push(["Loss duration", hairHealth.loss_duration]);
    pairs.push(["Sleep", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    const conditions = Array.isArray(internalHealth.health_conditions)
      ? [...internalHealth.health_conditions]
      : [];
    if (
      conditions.some((c) => String(c).toLowerCase() === "other") &&
      internalHealth.otherConditionDetails
    ) {
      const idx = conditions.findIndex((c) => String(c).toLowerCase() === "other");
      if (idx >= 0) conditions[idx] = `Other: ${internalHealth.otherConditionDetails}`;
      else conditions.push(`Other: ${internalHealth.otherConditionDetails}`);
    }
    pairs.push(["Health conditions", conditions]);
    pairs.push(["Digestive symptoms", internalHealth.bowel]);
    pairs.push([
      "Diet / weight change",
      internalHealth.diet_weight_change || internalHealth.gas_acidity,
    ]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push([
      "Vitamins / supplements",
      formatYesNoWithDetails(
        internalHealth.supplements,
        internalHealth.supplements_details
      ),
    ]);
    pairs.push([
      "Prescription medicines",
      formatYesNoWithDetails(
        internalHealth.prescription_medicines || internalHealth.blood_pressure,
        internalHealth.prescription_medicines_details
      ),
    ]);
    pairs.push(["Food habits", internalHealth.food_habits]);
  }

  return pairs.filter(([, v]) => {
    if (v == null || v === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}

function parseDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

function getUploadedScalpPhotos(scalpImages = []) {
  const order = ["front", "top", "side", "back"];
  const list = Array.isArray(scalpImages) ? scalpImages : [];
  const withData = list
    .map((img) => ({
      type: String(img?.type || img?.label || "photo").toLowerCase(),
      buffer: parseDataUrlImage(img?.dataUrl || img?.previewUrl || img?.url),
    }))
    .filter((img) => img.buffer);

  withData.sort((a, b) => {
    const ai = order.indexOf(a.type);
    const bi = order.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Cap at 3 photos so page 1 never overflows
  return withData.slice(0, 3);
}

function photoCaption(type) {
  const raw = String(type || "").toLowerCase();
  if (raw.includes("front")) return "Front";
  if (raw.includes("side")) return "Side";
  if (raw.includes("back")) return "Back";
  if (raw.includes("top") || raw.includes("crown")) return "Top";
  return "Photo";
}

function embedScalpPhotos(doc, scalpImages) {
  const photos = getUploadedScalpPhotos(scalpImages);
  const left = doc.page.margins.left;
  const width = pageWidth(doc);

  doc.moveDown(0.1);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text("Uploaded scalp photos");
  doc
    .font("Helvetica")
    .fontSize(7.5)
    .fillColor(MUTED)
    .text("Customer-uploaded photos used for AI assessment:");

  if (!photos.length) {
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("No uploaded scalp photos available.");
    return;
  }

  const gap = 6;
  const cols = photos.length;
  const boxW = (width - gap * (cols - 1)) / cols;
  const imgH = 58;
  const rowTop = doc.y + 3;

  photos.forEach((photo, index) => {
    const px = left + index * (boxW + gap);
    try {
      doc.image(photo.buffer, px, rowTop, {
        fit: [boxW, imgH],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .fontSize(7.5)
        .fillColor("#9ca3af")
        .text("Unavailable", px, rowTop + 20, { width: boxW, align: "center" });
    }
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(INK)
      .text(photoCaption(photo.type), px, rowTop + imgH + 1, {
        width: boxW,
        align: "left",
        lineBreak: false,
        height: 9,
      });
  });

  doc.x = left;
  doc.y = rowTop + imgH + 14;
  doc.font("Helvetica").fillColor(INK).fontSize(8);
}

/** Dense two-column Q&A so page 1 never spills into page 2. */
function addQaTwoColumn(doc, pairs, labelOpts) {
  const left = doc.page.margins.left;
  const width = pageWidth(doc);
  const gap = 10;
  const colW = (width - gap) / 2;
  const startY = doc.y;
  const mid = Math.ceil(pairs.length / 2);
  const col1 = pairs.slice(0, mid);
  const col2 = pairs.slice(mid);

  function drawCol(items, x) {
    let y = startY;
    doc.font("Helvetica").fontSize(7.5).fillColor(INK);
    for (const [q, a] of items) {
      const line = `${q}: ${clampText(labelize(a, labelOpts), 90)}`;
      doc.text(line, x, y, {
        width: colW,
        lineGap: 0.2,
        height: 22,
        ellipsis: true,
      });
      y = doc.y + 1;
    }
    return y;
  }

  const y1 = drawCol(col1, left);
  const y2 = drawCol(col2, left + colW + gap);
  doc.x = left;
  doc.y = Math.max(y1, y2) + 2;
}

/**
 * Compact assessment PDF — exactly 2 pages, no blanks:
 *  Page 1: header + profile + photos + quiz answers + Result link
 *  Page 2: AI findings + root causes + timeline + kit
 *
 * Layout is intentionally dense so PDFKit never auto-inserts blank pages.
 * Production must run this build — check GET /api/health → pdfFormatVersion.
 */
export function buildAssessmentPdf(payload) {
  const {
    reportId,
    reportDate,
    aboutMe = {},
    scalpAnalysis = {},
    scalpImages = [],
    reportMeta = {},
    resultPageUrl: rawResultPageUrl = null,
  } = payload;

  const resultPageUrl = resolveResultPageUrl(rawResultPageUrl, reportId);
  const isFemale = (payload.gender || aboutMe.gender) === "female";
  const labelOpts = { isFemale };

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 32,
      autoFirstPage: true,
      bufferPages: true,
      info: {
        Title: `Zylk Health Assessment Report — ${aboutMe.fullName || "Guest"}`,
        Author: "Zylk Health",
        Subject: "Hair & Scalp Assessment",
      },
    });
    const chunks = [];
    let pagesCreated = 1;
    doc.on("pageAdded", () => {
      pagesCreated += 1;
    });
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = pageWidth(doc);
    const left = doc.page.margins.left;

    // ─── PAGE 1 ───
    doc
      .fontSize(12)
      .fillColor(BRAND)
      .font("Helvetica-Bold")
      .text("ZYLK HEALTH — Hair & Scalp Assessment Report", {
        align: "center",
        width,
      });
    doc.moveDown(0.08);
    doc.fontSize(8).fillColor(MUTED).font("Helvetica");
    doc.text(
      `Report ID: ${reportId || "—"}  ·  Date: ${
        reportDate || new Date().toLocaleDateString("en-GB")
      }  ·  ${PDF_FORMAT_VERSION}`,
      { align: "center", width }
    );

    if (resultPageUrl) {
      doc.moveDown(0.08);
      doc
        .fillColor("#1d4ed8")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(`Live result: ${resultPageUrl}`, {
          align: "center",
          link: resultPageUrl,
          underline: true,
          width,
        });
    }

    doc.moveDown(0.15);
    doc
      .strokeColor(LINE)
      .lineWidth(0.8)
      .moveTo(left, doc.y)
      .lineTo(left + width, doc.y)
      .stroke();
    doc.moveDown(0.18);

    addSectionTitle(doc, "1. Patient profile");
    const profileLine = [
      aboutMe.fullName || "Guest",
      aboutMe.gender ? labelize(aboutMe.gender, labelOpts) : null,
      aboutMe.age || aboutMe.ageRange ? `Age ${aboutMe.age || aboutMe.ageRange}` : null,
      aboutMe.email || null,
      aboutMe.whatsapp
        ? `${aboutMe.countryCode || ""} ${aboutMe.whatsapp}`.trim()
        : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.font("Helvetica").fontSize(8).fillColor(INK).text(profileLine, { width });

    embedScalpPhotos(doc, scalpImages);

    addSectionTitle(doc, "2. Quiz questions & answers");
    addQaTwoColumn(doc, collectQaPairs(payload), labelOpts);

    // Single intentional page break — AI / kit always on page 2
    doc.addPage();

    // ─── PAGE 2 ───
    const page2Budget = pageBottom(doc) - 36;

    addSectionTitle(doc, "3. AI scalp assessment");
    addKeyValue(
      doc,
      "Predicted stage",
      scalpAnalysis.aiPredictedStage || scalpAnalysis.finalStage,
      labelOpts
    );
    addKeyValue(
      doc,
      "Stage description",
      clampText(scalpAnalysis.stageDescription, 180),
      labelOpts
    );
    addKeyValue(
      doc,
      "Confidence",
      scalpAnalysis.aiConfidence != null
        ? `${Math.round(Number(scalpAnalysis.aiConfidence) * 100)}%`
        : scalpAnalysis.quotaFallback
          ? "Moderate (quiz fallback)"
          : null,
      labelOpts
    );
    addKeyValue(doc, "Self-reported stage", scalpAnalysis.selfReportedStage, labelOpts);
    addKeyValue(
      doc,
      "Stage discrepancy",
      scalpAnalysis.stageDiscrepancy ? "Yes" : "No",
      labelOpts
    );
    addKeyValue(
      doc,
      "Requires doctor consultation",
      scalpAnalysis.requiresDoctorConsultation ? "Yes" : "No",
      labelOpts
    );
    addKeyValue(doc, "Model", scalpAnalysis.model, labelOpts);

    if (scalpAnalysis.aiReasoning && doc.y < page2Budget - 80) {
      doc.moveDown(0.08);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text("AI reasoning:");
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .text(clampText(scalpAnalysis.aiReasoning, 520), {
          width,
          height: 54,
          ellipsis: true,
        });
    }

    if (
      scalpAnalysis.observations &&
      typeof scalpAnalysis.observations === "object" &&
      doc.y < page2Budget - 100
    ) {
      doc.moveDown(0.08);
      doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text("Observations:");
      doc.font("Helvetica").fontSize(7.5);
      const obsLines = [];
      for (const [k, v] of Object.entries(scalpAnalysis.observations)) {
        if (v && typeof v === "object") {
          const inner = Object.entries(v)
            .map(([ik, iv]) => `${labelize(ik, labelOpts)}: ${labelize(iv, labelOpts)}`)
            .join("; ");
          obsLines.push(`• ${labelize(k, labelOpts)}: ${inner}`);
        } else {
          obsLines.push(`• ${labelize(k, labelOpts)}: ${labelize(v, labelOpts)}`);
        }
      }
      doc.text(clampText(obsLines.join("  "), 420), {
        width,
        height: 40,
        ellipsis: true,
      });
    }

    if (Array.isArray(reportMeta.rootCauses) && reportMeta.rootCauses.length) {
      addSectionTitle(doc, "4. Root causes (report summary)");
      for (const cause of reportMeta.rootCauses.slice(0, 4)) {
        if (doc.y > page2Budget - 70) break;
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor(INK)
          .text(clampText(cause.label || cause.id || "Cause", 60), { width });
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .text(clampText(cause.desc || "", 160), { width, height: 18, ellipsis: true });
        doc.moveDown(0.04);
      }
    }

    if (reportMeta.eligibilityTimeline && doc.y < page2Budget - 50) {
      addSectionTitle(doc, "5. Eligibility / timeline");
      addKeyValue(doc, "Label", reportMeta.eligibilityTimeline.label, labelOpts);
      addKeyValue(doc, "Months", reportMeta.eligibilityTimeline.months, labelOpts);
      addKeyValue(
        doc,
        "Needs transplant",
        reportMeta.eligibilityTimeline.needsTransplant ? "Yes" : "No",
        labelOpts
      );
    }

    if (reportMeta.recommendedBundle && doc.y < page2Budget - 40) {
      addSectionTitle(doc, "6. Recommended kit");
      const bundle = reportMeta.recommendedBundle;
      addKeyValue(doc, "Bundle", bundle.bundleTitle || bundle.bundleId, labelOpts);
      addKeyValue(doc, "Price", bundle.price != null ? `₹${bundle.price}` : null, labelOpts);
      const products = bundle.products || bundle.items || [];
      if (Array.isArray(products) && products.length) {
        const names = products
          .map((p) =>
            typeof p === "string" ? p : p?.name || p?.shortName || p?.title || p?.id || "—"
          )
          .join(", ");
        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor(INK)
          .text(`Products: ${clampText(names, 200)}`, { width, height: 16, ellipsis: true });
      }
    }

    if (resultPageUrl) {
      doc.moveDown(0.2);
      doc
        .fillColor("#1d4ed8")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(`Live result: ${resultPageUrl}`, {
          link: resultPageUrl,
          underline: true,
          width,
        });
    }

    doc
      .fontSize(7)
      .fillColor("#9ca3af")
      .font("Helvetica")
      .text(
        `Confidential — Zylk Health internal use · ${PDF_FORMAT_VERSION} · 2 pages`,
        left,
        pageBottom(doc) - 10,
        { align: "center", width }
      );

    if (pagesCreated !== PDF_TARGET_PAGES) {
      console.warn(
        `[pdf] ${reportId}: expected ${PDF_TARGET_PAGES} pages, got ${pagesCreated} (${PDF_FORMAT_VERSION})`
      );
    } else {
      console.log(`[pdf] ${reportId}: ${pagesCreated} pages · ${PDF_FORMAT_VERSION}`);
    }

    doc.end();
  });
}