import PDFDocument from "pdfkit";

/** Bump when PDF layout changes — exposed via GET /api/health for deploy checks. */
export const PDF_FORMAT_VERSION = "v5-compact-2page";

const BRAND = "#064e3b";
const MUTED = "#4b5563";
const INK = "#111827";
const LINE = "#e5e7eb";
const LIVE_RESULT_BASE = "https://zylkhealth.com/assessment/";

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
    const host = new URL(url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
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

function addSectionTitle(doc, title) {
  doc.moveDown(0.45);
  doc
    .fontSize(12)
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .text(title, { underline: true });
  doc.moveDown(0.2);
  doc.font("Helvetica").fillColor(INK).fontSize(9);
}

function addKeyValue(doc, key, value, opts = {}) {
  if (value == null || value === "" || (Array.isArray(value) && !value.length)) return;
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  if (doc.y > doc.page.height - 54) {
    doc.addPage();
  }
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(INK)
    .text(`${key}: ${labelize(value, opts)}`, left, doc.y, { width });
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
    pairs.push(["Supplements", internalHealth.supplements]);
    pairs.push([
      "Prescription medicines",
      internalHealth.prescription_medicines || internalHealth.blood_pressure,
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
    pairs.push(["Supplements", internalHealth.supplements]);
    pairs.push([
      "Prescription medicines",
      internalHealth.prescription_medicines || internalHealth.blood_pressure,
    ]);
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

  return withData;
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
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.moveDown(0.25);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Uploaded scalp photos");
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text("Customer-uploaded photos used for AI assessment:");
  doc.moveDown(0.2);

  if (!photos.length) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("No uploaded scalp photos available.");
    doc.moveDown(0.2);
    return;
  }

  const gap = 10;
  const cols = Math.min(photos.length, 3);
  const boxW = (width - gap * (cols - 1)) / cols;
  const boxH = 88;
  let x = left;
  const rowTop = doc.y;

  photos.forEach((photo, index) => {
    const px = x + (index % cols) * (boxW + gap);
    try {
      doc.image(photo.buffer, px, rowTop, {
        fit: [boxW, boxH - 14],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .fontSize(8)
        .fillColor("#9ca3af")
        .text("Unavailable", px, rowTop + 30, { width: boxW, align: "center" });
    }
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(INK)
      .text(photoCaption(photo.type), px, rowTop + boxH - 12, {
        width: boxW,
        align: "left",
        lineBreak: false,
        height: 10,
      });
  });

  doc.x = left;
  doc.y = rowTop + boxH + 6;
  doc.font("Helvetica").fillColor(INK).fontSize(9);
}

/**
 * Compact 2-page assessment PDF (matches the original report layout).
 * Includes quiz answers, scalp photos, and a single live Result page link.
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
      margin: 48,
      info: {
        Title: `Zylk Health Assessment Report — ${aboutMe.fullName || "Guest"}`,
        Author: "Zylk Health",
        Subject: "Hair & Scalp Assessment",
      },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    doc
      .fontSize(16)
      .fillColor(BRAND)
      .font("Helvetica-Bold")
      .text("ZYLK HEALTH — Hair & Scalp Assessment Report", { align: "center" });
    doc.moveDown(0.25);
    doc.fontSize(9).fillColor(MUTED).font("Helvetica");
    doc.text(`Report ID: ${reportId || "—"}`, { align: "center" });
    doc.text(`Date: ${reportDate || new Date().toLocaleDateString("en-GB")}`, {
      align: "center",
    });

    // Single Result page link (no large CTA boxes)
    if (resultPageUrl) {
      doc.moveDown(0.25);
      doc
        .fillColor("#1d4ed8")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(`Result page: ${resultPageUrl}`, {
          align: "center",
          link: resultPageUrl,
          underline: true,
          width,
        });
    }

    doc.moveDown(0.35);
    doc
      .strokeColor(LINE)
      .lineWidth(1)
      .moveTo(48, doc.y)
      .lineTo(547, doc.y)
      .stroke();

    addSectionTitle(doc, "1. Patient profile");
    addKeyValue(doc, "Name", aboutMe.fullName || "Guest", labelOpts);
    addKeyValue(doc, "Email", aboutMe.email, labelOpts);
    addKeyValue(
      doc,
      "WhatsApp",
      aboutMe.whatsapp ? `${aboutMe.countryCode || ""} ${aboutMe.whatsapp}`.trim() : null,
      labelOpts
    );
    addKeyValue(doc, "Age", aboutMe.age || aboutMe.ageRange, labelOpts);
    addKeyValue(doc, "Gender", aboutMe.gender, labelOpts);

    embedScalpPhotos(doc, scalpImages);

    addSectionTitle(doc, "2. Quiz questions & answers");
    for (const [q, a] of collectQaPairs(payload)) {
      addKeyValue(doc, q, a, labelOpts);
    }

    addSectionTitle(doc, "3. AI scalp assessment");
    addKeyValue(
      doc,
      "Predicted stage",
      scalpAnalysis.aiPredictedStage || scalpAnalysis.finalStage,
      labelOpts
    );
    addKeyValue(doc, "Stage description", scalpAnalysis.stageDescription, labelOpts);
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
    addKeyValue(doc, "Stage discrepancy", scalpAnalysis.stageDiscrepancy ? "Yes" : "No", labelOpts);
    addKeyValue(
      doc,
      "Requires doctor consultation",
      scalpAnalysis.requiresDoctorConsultation ? "Yes" : "No",
      labelOpts
    );
    addKeyValue(doc, "Model", scalpAnalysis.model, labelOpts);

    if (scalpAnalysis.aiReasoning) {
      doc.moveDown(0.15);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("AI reasoning:");
      doc.font("Helvetica").text(String(scalpAnalysis.aiReasoning), { width });
    }

    if (scalpAnalysis.observations && typeof scalpAnalysis.observations === "object") {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Observations:");
      doc.font("Helvetica");
      for (const [k, v] of Object.entries(scalpAnalysis.observations)) {
        if (v && typeof v === "object") {
          doc.text(`${labelize(k, labelOpts)}:`);
          for (const [ik, iv] of Object.entries(v)) {
            doc.text(`  • ${labelize(ik, labelOpts)}: ${labelize(iv, labelOpts)}`, {
              width: width - 12,
            });
          }
        } else {
          doc.text(`• ${labelize(k, labelOpts)}: ${labelize(v, labelOpts)}`);
        }
      }
    }

    if (Array.isArray(reportMeta.rootCauses) && reportMeta.rootCauses.length) {
      addSectionTitle(doc, "4. Root causes (report summary)");
      for (const cause of reportMeta.rootCauses) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(cause.label || cause.id || "Cause");
        doc.font("Helvetica").text(cause.desc || "", { width });
        doc.moveDown(0.12);
      }
    }

    if (reportMeta.eligibilityTimeline) {
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

    if (reportMeta.recommendedBundle) {
      addSectionTitle(doc, "6. Recommended kit");
      const bundle = reportMeta.recommendedBundle;
      addKeyValue(doc, "Bundle", bundle.bundleTitle || bundle.bundleId, labelOpts);
      addKeyValue(
        doc,
        "Price",
        bundle.price != null ? `₹${bundle.price}` : null,
        labelOpts
      );
      addKeyValue(
        doc,
        "Original price",
        bundle.originalPrice != null ? `₹${bundle.originalPrice}` : null,
        labelOpts
      );
      const products = bundle.products || bundle.items || [];
      if (Array.isArray(products) && products.length) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text("Products:");
        doc.font("Helvetica");
        products.forEach((p) => {
          const name =
            typeof p === "string" ? p : p?.name || p?.shortName || p?.title || p?.id || "—";
          doc.text(`  • ${String(name)}`);
        });
      }
    }

    doc.moveDown(0.8);
    doc
      .fontSize(8)
      .fillColor("#9ca3af")
      .font("Helvetica")
      .text(
        `Confidential — for Zylk Health internal use. Generated automatically from the Hair & Scalp Assessment. · ${PDF_FORMAT_VERSION}`,
        { align: "center", width }
      );

    doc.end();
  });
}
