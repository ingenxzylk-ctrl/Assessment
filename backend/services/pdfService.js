import PDFDocument from "pdfkit";

/** Bump when PDF layout changes — exposed via GET /api/health for deploy checks. */
export const PDF_FORMAT_VERSION = "v2-result-link";

const BRAND = "#064e3b";
const MUTED = "#6b7280";
const INK = "#111827";
const LINE = "#e5e7eb";
const SOFT = "#f4f6f0";
const WARN = "#b45309";

function labelize(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    return value.length ? value.map(labelize).join(", ") : "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const raw = String(value);
  // Keep emails / URLs / already human-formatted values intact
  if (raw.includes("@") || /^https?:\/\//i.test(raw)) return raw;

  const OPTION_LABELS = {
    same: "About the same as usual",
    slightly_more: "Slightly more than usual",
    much_more: "Much more than usual",
    clumps: "Hair is coming out in noticeable clumps",
    unsure: "I'm not sure",
    flaking: "Flaking or dandruff",
    itching: "Itching",
    redness: "Redness or irritation",
    oily: "Oily scalp",
    tenderness: "Tenderness or burning",
    frequent: "Heavy dandruff",
    moderate: "Mild dandruff",
    no: "No dandruff",
    front: "Front hairline or temples",
    crown: "Crown or top of head",
    parting: "Both front and crown",
    all_over: "General thinning all over",
    patchy: "Round or patchy areas",
    under_3m: "Within the past 3 months",
    "3m_6m": "3–6 months ago",
    "6m_1y": "6–12 months ago",
    "1y_3y": "1–3 years ago",
    over_3y: "More than 3 years ago",
    mother: "Mother's side",
    father: "Father's side",
    both: "Both sides",
    overall_thinning: "Overall thinning",
    "overall-thinning": "Overall thinning",
  };
  if (OPTION_LABELS[raw]) return OPTION_LABELS[raw];

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawHeader(doc, { reportId, reportDate, model, resultPageUrl = null }) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(BRAND)
    .text("ZYLK HEALTH", left, doc.page.margins.top, { width: width * 0.55, lineBreak: false });

  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text("HAIR & SCALP DIAGNOSTICS", left, doc.page.margins.top + 14, {
      width: width * 0.55,
      lineBreak: false,
    });

  const metaX = left + width * 0.55;
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(`Report ID: ${reportId || "—"}`, metaX, doc.page.margins.top, {
      width: width * 0.45,
      align: "right",
      lineBreak: false,
    });
  doc.text(`Generated ${reportDate || "—"}`, metaX, doc.page.margins.top + 12, {
    width: width * 0.45,
    align: "right",
    lineBreak: false,
  });
  if (model) {
    doc.text(`AI Model: ${model}`, metaX, doc.page.margins.top + 24, {
      width: width * 0.45,
      align: "right",
      lineBreak: false,
    });
  }
  if (resultPageUrl) {
    doc
      .fillColor("#1d4ed8")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text("Open Result Page ->", metaX, doc.page.margins.top + (model ? 36 : 24), {
        width: width * 0.45,
        align: "right",
        link: resultPageUrl,
        underline: true,
        lineBreak: false,
      });
  }

  doc.y = doc.page.margins.top + (resultPageUrl ? 52 : 42);
  doc
    .strokeColor(LINE)
    .lineWidth(1)
    .moveTo(left, doc.y)
    .lineTo(left + width, doc.y)
    .stroke();
  doc.moveDown(0.8);
  doc.x = left;
}

function drawFooter(doc, pageLabel) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const y = doc.page.height - 36;
  doc
    .fontSize(7)
    .fillColor("#9ca3af")
    .font("Helvetica")
    .text(
      `Confidential — for Zylk Health internal use only.  ·  PDF ${PDF_FORMAT_VERSION} · zylkhealth.com`,
      left,
      y,
      { width: width * 0.68, lineBreak: false }
    );
  doc.text(pageLabel, left + width * 0.68, y, {
    width: width * 0.32,
    align: "right",
    lineBreak: false,
  });
}

/**
 * Prominent, reliably clickable Result-page link for organisation review.
 * Always renders when a URL or reportId is available — never silently skip.
 * Uses a filled CTA + blue underlined URL on its own line + link annotations.
 */
function drawResultPageLink(doc, resultPageUrl, { compact = false, reportId = null } = {}) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const url =
    (typeof resultPageUrl === "string" && resultPageUrl.trim()) ||
    (reportId ? `/?report=${encodeURIComponent(reportId)}` : null);
  if (!url) return;

  const needed = compact ? 58 : 92;
  if (doc.y + needed > doc.page.height - 56) {
    doc.addPage();
    doc.y = doc.page.margins.top + 8;
  }

  const boxY = doc.y;
  const boxH = compact ? 54 : 86;
  doc.roundedRect(left, boxY, width, boxH, 6).fill("#ecfdf5").strokeColor(BRAND).lineWidth(1.2).stroke();

  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(
      compact ? "RESULT PAGE LINK" : "RESULT PAGE LINK  ·  FOR ORGANISATION REVIEW",
      left + 12,
      boxY + 8,
      { width: width - 24, lineBreak: false }
    );

  if (!compact) {
    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Click the button or the blue URL below to open this assessment Result page in the app.",
        left + 12,
        boxY + 22,
        { width: width - 24, lineBreak: false }
      );
  }

  const btnY = compact ? boxY + 26 : boxY + 38;
  const btnLabel = "Open Result Page";
  const btnW = Math.min(150, width - 24);
  doc.roundedRect(left + 12, btnY, btnW, 18, 4).fill(BRAND);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(btnLabel, left + 12, btnY + 4, {
      width: btnW,
      align: "center",
      lineBreak: false,
    });
  doc.link(left + 12, btnY, btnW, 18, url);

  // Full URL on its own line — most reliable click + copy target in PDF readers
  const urlY = compact ? btnY + 22 : boxY + 62;
  doc
    .fillColor("#1d4ed8")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(url, left + 12, urlY, {
      width: width - 24,
      link: url,
      underline: true,
      lineBreak: false,
    });
  // Extra hit area over the URL line
  doc.link(left + 12, urlY - 2, width - 24, 14, url);
  doc.link(left, boxY, width, boxH, url);

  doc.y = boxY + boxH + 12;
  doc.x = left;
  doc.fillColor(INK).font("Helvetica").fontSize(9);
}

function sectionBanner(doc, number, title) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const y = doc.y;
  doc.rect(left, y, width, 22).fill(SOFT);
  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`${number}  ${title}`, left + 10, y + 6, {
      width: width - 20,
      lineBreak: false,
    });
  doc.y = y + 28;
  doc.x = left;
  doc.fillColor(INK).font("Helvetica").fontSize(9);
}

function addKeyValueRow(doc, key, value) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const col1 = width * 0.42;
  const col2 = width * 0.58;
  const y = doc.y;
  const needed = 16;
  if (y + needed > doc.page.height - 56) {
    doc.addPage();
    doc.y = doc.page.margins.top + 8;
  }
  const rowY = doc.y;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(MUTED)
    .text(key, left, rowY, { width: col1, lineBreak: false });
  doc
    .font("Helvetica-Bold")
    .fillColor(INK)
    .text(labelize(value), left + col1, rowY, { width: col2 });
  doc.x = left;
  doc.moveDown(0.15);
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
  pairs.push(["WhatsApp number", aboutMe.whatsapp ? `${aboutMe.countryCode || ""} ${aboutMe.whatsapp}` : null]);
  pairs.push(["Email", aboutMe.email]);
  pairs.push(["Age", aboutMe.age || aboutMe.ageRange]);
  pairs.push(["Gender", aboutMe.gender]);

  if (isFemale) {
    pairs.push(["Self-reported pattern stage", hairHealth.hair_fall_zone]);
    pairs.push(["Where have you noticed hair loss?", hairHealth.hair_loss_area || hairHealth.hair_fall_zone]);
    pairs.push(["Are you shedding more than usual?", hairHealth.daily_loss_amount || hairHealth.shedding_amount]);
    pairs.push(["Do you experience dandruff?", hairHealth.dandruff_experience]);
    pairs.push([
      "Do you experience flaking, itching, or scalp irritation?",
      formatScalpSymptoms(hairHealth.scalp_symptoms),
    ]);
    pairs.push(["Family history of hair loss?", hairHealth.family_history]);
    pairs.push(["When did you first notice the change?", hairHealth.loss_duration]);
    pairs.push(["Iron level", internalHealth.iron_level]);
    pairs.push(["Symptoms", internalHealth.symptoms]);
    pairs.push(["Life stage", internalHealth.life_stage]);
    pairs.push(["Digestive symptoms", internalHealth.digestion]);
    pairs.push(["Sleep", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push(["Currently on supplements?", internalHealth.supplements]);
    pairs.push(["Food habits", internalHealth.food_habits]);
  } else {
    pairs.push(["Self-reported Norwood stage", hairHealth.norwood_stage ? `Stage ${hairHealth.norwood_stage}` : null]);
    pairs.push(["Where have you noticed hair loss?", hairHealth.hair_fall_zone]);
    pairs.push(["Are you shedding more than usual?", hairHealth.daily_loss_amount]);
    pairs.push(["Do you experience dandruff?", hairHealth.dandruff_experience]);
    pairs.push([
      "Do you experience flaking, itching, or scalp irritation?",
      formatScalpSymptoms(hairHealth.scalp_symptoms),
    ]);
    pairs.push(["Family history of hair loss?", hairHealth.family_history]);
    pairs.push(["When did you first notice the change?", hairHealth.loss_duration]);
    pairs.push(["Sleep", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Existing health conditions", internalHealth.health_conditions]);
    pairs.push(["Digestive symptoms", internalHealth.bowel]);
    pairs.push(["Diet / weight change", internalHealth.diet_weight_change || internalHealth.gas_acidity]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push(["Currently on supplements?", internalHealth.supplements]);
    pairs.push([
      "Prescription medicines",
      internalHealth.prescription_medicines || internalHealth.blood_pressure,
    ]);
  }

  return pairs.filter(([, v]) => v != null && v !== "");
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
      type: img?.type || img?.label || "photo",
      label: img?.label || img?.type || "photo",
      buffer: parseDataUrlImage(img?.dataUrl || img?.previewUrl || img?.url),
    }))
    .filter((img) => img.buffer);

  withData.sort((a, b) => {
    const ai = order.indexOf(String(a.type).toLowerCase());
    const bi = order.indexOf(String(b.type).toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return withData;
}

function embedScalpPhotos(doc, scalpImages) {
  const photos = getUploadedScalpPhotos(scalpImages);
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND)
    .text("UPLOADED SCALP PHOTOS", left, doc.y, { width });
  doc.moveDown(0.35);

  if (!photos.length) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("No uploaded scalp photos were available for this report.");
    doc.moveDown(0.4);
    return;
  }

  const gap = 14;
  const cols = Math.min(2, photos.length);
  const boxW = (width - gap * (cols - 1)) / cols;
  const boxH = 118;
  let x = left;
  let rowTop = doc.y;

  photos.forEach((photo, index) => {
    if (index > 0 && index % cols === 0) {
      rowTop += boxH + 22;
      x = left;
      if (rowTop + boxH + 30 > doc.page.height - 56) {
        doc.addPage();
        rowTop = doc.page.margins.top + 8;
      }
    }

    doc.roundedRect(x, rowTop, boxW, boxH, 6).strokeColor(LINE).lineWidth(0.8).stroke();
    try {
      doc.image(photo.buffer, x + 6, rowTop + 6, {
        fit: [boxW - 12, boxH - 12],
        align: "center",
        valign: "center",
      });
    } catch {
      doc
        .fontSize(8)
        .fillColor("#9ca3af")
        .text("Image unavailable", x + 8, rowTop + boxH / 2 - 6, {
          width: boxW - 16,
          align: "center",
          lineBreak: false,
        });
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor(INK)
      .text(labelize(photo.label || photo.type).toUpperCase(), x, rowTop + boxH + 4, {
        width: boxW,
        align: "center",
        lineBreak: false,
      });

    x += boxW + gap;
  });

  doc.x = left;
  doc.y = rowTop + boxH + 24;
  doc.font("Helvetica").fillColor(INK).fontSize(9);
}

const PHOTO_QUALITY_LABELS = {
  unclear: "Image unclear / blurry",
  insufficientLight: "Insufficient lighting / too dark",
  hatOrCovering: "Hat or head covering blocking scalp",
  filtersApplied: "Filters or beauty effects applied",
  wetHair: "Wet hair hiding density",
};

function resolvePhotoQualityAssessment(scalpAnalysis = {}) {
  const existing = scalpAnalysis.photoQualityAssessment;
  if (existing && typeof existing === "object") {
    return existing;
  }

  const checks = scalpAnalysis.qualityChecks || {};
  const failedKeys = Object.keys(PHOTO_QUALITY_LABELS).filter((key) => Boolean(checks[key]));
  const reasons = Array.isArray(scalpAnalysis.rejectionReasons)
    ? scalpAnalysis.rejectionReasons.filter(Boolean)
    : failedKeys.map((key) => PHOTO_QUALITY_LABELS[key]);
  const imageQuality = String(scalpAnalysis.imageQuality || "").toLowerCase() || null;
  const rejected =
    Boolean(scalpAnalysis.photoQualityRejected) ||
    failedKeys.length > 0 ||
    imageQuality === "poor" ||
    reasons.length > 0;

  return {
    rejected,
    imageQuality,
    qualityChecks: Object.fromEntries(
      Object.keys(PHOTO_QUALITY_LABELS).map((key) => [key, Boolean(checks[key])])
    ),
    failedCriteria: failedKeys.map((key) => ({
      key,
      label: PHOTO_QUALITY_LABELS[key],
      status: "rejected",
    })),
    passedCriteria: Object.keys(PHOTO_QUALITY_LABELS)
      .filter((key) => !failedKeys.includes(key))
      .map((key) => ({
        key,
        label: PHOTO_QUALITY_LABELS[key],
        status: "passed",
      })),
    rejectionReasons: reasons,
    note: rejected
      ? "One or more scalp photos were rejected for AI processing because they did not meet image-quality criteria."
      : "Uploaded scalp photos met AI processing quality criteria.",
  };
}

function drawPhotoQualityAssessment(doc, scalpAnalysis = {}) {
  const assessment = resolvePhotoQualityAssessment(scalpAnalysis);
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(BRAND)
    .text("AI PHOTO QUALITY (FOR PROCESSING)", left, doc.y, { width });
  doc.moveDown(0.25);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(
      "Clear scalp photos are required for reliable AI analysis. Photos that fail these criteria are marked rejected below.",
      { width }
    );
  doc.moveDown(0.35);

  if (assessment.rejected) {
    const reasons =
      (assessment.rejectionReasons && assessment.rejectionReasons.length
        ? assessment.rejectionReasons
        : (assessment.failedCriteria || []).map((c) => c.label)) || [];
    const bannerText = reasons.length
      ? `REJECTED FOR AI PROCESSING — ${reasons.join(" · ")}`
      : "REJECTED FOR AI PROCESSING — photo did not meet quality criteria";
    const bannerH = 28;
    const y = doc.y;
    doc.roundedRect(left, y, width, bannerH, 4).fill("#fef2f2");
    doc
      .fillColor("#b91c1c")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(bannerText, left + 10, y + 9, { width: width - 20, lineBreak: false });
    doc.y = y + bannerH + 8;
    doc.x = left;
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(BRAND)
      .text("PASSED — photos met AI processing quality criteria", { width });
    doc.moveDown(0.3);
  }

  const rows = [
    ...(assessment.failedCriteria || []).map((c) => ({ ...c, status: "rejected" })),
    ...(assessment.passedCriteria || []).map((c) => ({ ...c, status: "passed" })),
  ];

  // Stable order matching guide criteria
  const order = Object.keys(PHOTO_QUALITY_LABELS);
  rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  if (!rows.length) {
    for (const [key, label] of Object.entries(PHOTO_QUALITY_LABELS)) {
      rows.push({
        key,
        label,
        status: assessment.rejected && assessment.imageQuality === "poor" ? "rejected" : "passed",
      });
    }
  }

  for (const row of rows) {
    const rejected = row.status === "rejected";
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(rejected ? "#b91c1c" : INK)
      .text(
        `${rejected ? "[REJECTED]" : "[PASSED] "}  ${row.label}`,
        left,
        doc.y,
        { width }
      );
    doc.moveDown(0.15);
  }

  if (assessment.imageQuality) {
    doc.moveDown(0.15);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Overall image quality rating: ${String(assessment.imageQuality).toUpperCase()}`, {
        width,
      });
  }

  doc.moveDown(0.45);
  doc.font("Helvetica").fillColor(INK).fontSize(9);
}

function drawStageCards(doc, predicted, selfReported, { isFemale = false } = {}) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const gap = 12;
  const cardW = (width - gap) / 2;
  const y = doc.y;
  const scaleLabel = isFemale ? "LUDWIG STAGE" : "NORWOOD STAGE";

  // Predicted
  doc.roundedRect(left, y, cardW, 72, 8).fill(SOFT);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text("AI PREDICTED", left + 12, y + 12, { width: cardW - 24, lineBreak: false });
  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text(String(predicted || "—"), left + 12, y + 28, { width: cardW - 24, lineBreak: false });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(scaleLabel, left + 12, y + 56, { width: cardW - 24, lineBreak: false });

  // Self-reported
  const x2 = left + cardW + gap;
  doc.roundedRect(x2, y, cardW, 72, 8).fill("#ffffff").strokeColor(LINE).lineWidth(1).stroke();
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text("SELF-REPORTED", x2 + 12, y + 12, { width: cardW - 24, lineBreak: false });
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text(String(selfReported || "—"), x2 + 12, y + 28, { width: cardW - 24, lineBreak: false });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8)
    .text(scaleLabel, x2 + 12, y + 56, { width: cardW - 24, lineBreak: false });

  doc.y = y + 84;
  doc.x = left;
}

/**
 * Build an A4 PDF Buffer matching the Zylk assessment report structure.
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

  // Never omit the link — fall back to a report deep-link if URL missing
  const resultPageUrl =
    (typeof rawResultPageUrl === "string" && rawResultPageUrl.trim()) ||
    (reportId ? `/?report=${encodeURIComponent(reportId)}` : null);

  const predicted = scalpAnalysis.aiPredictedStage || scalpAnalysis.finalStage || "—";
  const selfReported = scalpAnalysis.selfReportedStage || aboutMe?.norwood_stage || "—";
  const confidence =
    scalpAnalysis.aiConfidence != null
      ? `${Math.round(Number(scalpAnalysis.aiConfidence) * 100)}%`
      : scalpAnalysis.quotaFallback
        ? "Moderate (quiz fallback)"
        : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
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

    const left = doc.page.margins.left;
    const width = contentWidth(doc);
    const model = scalpAnalysis.model || null;

    // ───────── PAGE 1: Profile & Quiz ─────────
    drawHeader(doc, { reportId, reportDate, model, resultPageUrl });

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(INK)
      .text("Hair & Scalp Assessment Report", left, doc.y, { width });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        "A personalised, AI-assisted analysis of hair health, scalp condition and a tailored recovery timeline based on uploaded photos and quiz responses.",
        { width }
      );
    doc.moveDown(0.35);

    // Plain-text Result URL first (always visible, even if styled box is overlooked)
    if (resultPageUrl) {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(INK)
        .text("Result page URL (click to open):", { width });
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#1d4ed8")
        .text(resultPageUrl, {
          width,
          link: resultPageUrl,
          underline: true,
        });
      doc.link(left, doc.y - 14, width, 16, resultPageUrl);
      doc.moveDown(0.35);
    }

    // Org-facing Result page link — always drawn when reportId exists
    drawResultPageLink(doc, resultPageUrl, { reportId });

    sectionBanner(doc, "1", "PATIENT PROFILE");
    const name = aboutMe.fullName || "Guest";
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(INK)
      .text(name, { width });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `${labelize(aboutMe.gender)}${
          aboutMe.age || aboutMe.ageRange ? `  ·  Age ${aboutMe.age || aboutMe.ageRange}` : ""
        }`
      );
    doc.moveDown(0.35);

    // Profile chips
    const chips = [];
    const isFemaleProfile = (payload.gender || aboutMe.gender) === "female";
    if (selfReported && selfReported !== "—") {
      chips.push(
        `${isFemaleProfile ? "LUDWIG" : "NORWOOD"} ${String(selfReported).toUpperCase()} (SELF)`
      );
    }
    if (aboutMe?.gender || payload.hairHealth?.family_history) {
      const fam = payload.hairHealth?.family_history;
      if (fam) chips.push(`FAMILY HISTORY: ${labelize(fam).toUpperCase()}`);
    }
    if (payload.hairHealth?.loss_duration) {
      chips.push(labelize(payload.hairHealth.loss_duration).toUpperCase());
    }
    let chipX = left;
    const chipY = doc.y;
    chips.slice(0, 3).forEach((chip) => {
      const tw = doc.widthOfString(chip) + 16;
      doc.roundedRect(chipX, chipY, tw, 16, 8).fill("#e8eede");
      doc
        .fillColor(BRAND)
        .font("Helvetica-Bold")
        .fontSize(7)
        .text(chip, chipX + 8, chipY + 4, { lineBreak: false });
      chipX += tw + 8;
    });
    doc.y = chipY + 24;
    doc.x = left;

    embedScalpPhotos(doc, scalpImages);
    drawPhotoQualityAssessment(doc, scalpAnalysis);

    sectionBanner(doc, "2", "QUIZ QUESTIONS & RESPONSES");
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Every answer ${name} submitted during the intake assessment, used to build this report`, {
        width,
      });
    doc.moveDown(0.4);

    for (const [q, a] of collectQaPairs(payload)) {
      addKeyValueRow(doc, q, a);
    }

    drawFooter(doc, "PAGE 1 OF 2 · PROFILE & QUIZ RESPONSES");

    // ───────── PAGE 2: Assessment & Plan ─────────
    doc.addPage();
    drawHeader(doc, { reportId, reportDate, model, resultPageUrl });
    const isFemale = (payload.gender || aboutMe.gender) === "female";

    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor(INK)
      .text("AI Assessment & Recovery Plan", { width });
    doc.moveDown(0.25);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(
        `Scalp analysis findings, root causes, expected timeline and the personalised kit recommended for ${name}'s ${
          isFemale ? "Ludwig" : "Norwood"
        } Stage ${predicted} profile.`,
        { width }
      );
    doc.moveDown(0.6);

    sectionBanner(doc, "3", "AI SCALP ASSESSMENT");
    drawStageCards(doc, predicted, selfReported, { isFemale });

    if (scalpAnalysis.stageDescription) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(INK)
        .text(String(scalpAnalysis.stageDescription), { width });
      doc.moveDown(0.4);
    }

    if (scalpAnalysis.stageDiscrepancy) {
      const warnY = doc.y;
      doc.roundedRect(left, warnY, width, 22, 4).fill("#fff7ed");
      doc
        .fillColor(WARN)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("⚠  STAGE DISCREPANCY DETECTED", left + 10, warnY + 6, {
          width: width - 20,
          lineBreak: false,
        });
      doc.y = warnY + 28;
      doc.x = left;
    }

    if (confidence) {
      addKeyValueRow(doc, "Model confidence", confidence);
    }
    addKeyValueRow(
      doc,
      "Doctor consultation",
      scalpAnalysis.requiresDoctorConsultation ? "Required" : "Not required"
    );

    if (scalpAnalysis.observations && typeof scalpAnalysis.observations === "object") {
      doc.moveDown(0.25);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND).text("OBSERVATIONS");
      doc.moveDown(0.2);
      doc.font("Helvetica").fontSize(9).fillColor(INK);
      for (const [k, v] of Object.entries(scalpAnalysis.observations)) {
        if (v && typeof v === "object") {
          doc.font("Helvetica-Bold").text(labelize(k).toUpperCase());
          doc.font("Helvetica");
          for (const [ik, iv] of Object.entries(v)) {
            addKeyValueRow(doc, labelize(ik), iv);
          }
        } else {
          addKeyValueRow(doc, labelize(k), v);
        }
      }
    }

    if (scalpAnalysis.aiReasoning) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(BRAND).text("AI REASONING");
      doc.moveDown(0.15);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(INK)
        .text(String(scalpAnalysis.aiReasoning), { width });
    }

    if (Array.isArray(reportMeta.rootCauses) && reportMeta.rootCauses.length) {
      doc.moveDown(0.5);
      sectionBanner(doc, "4", "ROOT CAUSE ANALYSIS");
      for (const cause of reportMeta.rootCauses) {
        const y = doc.y;
        if (y + 48 > doc.page.height - 56) {
          doc.addPage();
          doc.y = doc.page.margins.top + 8;
        }
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .fillColor(INK)
          .text(cause.label || cause.id || "Cause", { width });
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(MUTED)
          .text(cause.desc || "", { width });
        doc.moveDown(0.35);
      }
    }

    if (reportMeta.eligibilityTimeline) {
      sectionBanner(doc, "5", "RECOVERY TIMELINE");
      const months = reportMeta.eligibilityTimeline.months;
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(BRAND)
        .text(months != null ? String(months) : "—", { continued: true });
      doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("  MONTHS");
      doc.moveDown(0.2);
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(INK)
        .text(
          reportMeta.eligibilityTimeline.label ||
            `Estimated visible improvement window based on Stage ${predicted} profile.`,
          { width }
        );
      if (reportMeta.eligibilityTimeline.needsTransplant) {
        doc.fillColor(WARN).text("Hair transplant pathway may be required.");
      } else {
        doc.fillColor(BRAND).text("✓ Non-surgical pathway");
      }
      doc.moveDown(0.4);
    }

    if (reportMeta.recommendedBundle) {
      sectionBanner(doc, "6", "RECOMMENDED KIT");
      const bundle = reportMeta.recommendedBundle;
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor(INK)
        .text(bundle.bundleTitle || bundle.bundleId || "Recommended kit", { width });
      doc.moveDown(0.15);
      if (bundle.price != null) {
        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor(BRAND)
          .text(`₹${bundle.price}`, { continued: true });
        if (bundle.originalPrice != null) {
          doc
            .font("Helvetica")
            .fontSize(10)
            .fillColor(MUTED)
            .text(`   ₹${bundle.originalPrice}`, { continued: true });
          const save =
            bundle.originalPrice > bundle.price
              ? Math.round(((bundle.originalPrice - bundle.price) / bundle.originalPrice) * 100)
              : null;
          if (save) {
            doc.fillColor(BRAND).text(`   Save ${save}%`);
          } else {
            doc.text("");
          }
        } else {
          doc.text("");
        }
      }

      const products = bundle.products || bundle.items || [];
      if (Array.isArray(products) && products.length) {
        doc.moveDown(0.3);
        doc.font("Helvetica").fontSize(9).fillColor(INK);
        const names = products.map((p) => {
          if (typeof p === "string") return p;
          return p?.name || p?.shortName || p?.title || p?.id || "—";
        });
        // Chip-like wrapping list
        names.forEach((n) => {
          doc.text(`•  ${String(n).replace(/^Zylk\s+/i, "")}`, { width });
        });
      }
    }

    if (resultPageUrl || reportId) {
      doc.moveDown(0.5);
      drawResultPageLink(doc, resultPageUrl, { compact: true, reportId });
    }

    drawFooter(doc, "PAGE 2 OF 2 · ASSESSMENT & PLAN");

    doc.end();
  });
}
