import PDFDocument from "pdfkit";

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
  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawHeader(doc, { reportId, reportDate, model }) {
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

  doc.y = doc.page.margins.top + 42;
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
      "Confidential — for Zylk Health internal use only.  ·  Generated automatically from the Hair & Scalp Assessment · zylkhealth.com",
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
    pairs.push(["Shedding amount", hairHealth.shedding_amount]);
    pairs.push(["Where does hair fall the most?", hairHealth.hair_fall_zone]);
    pairs.push(["Daily hair loss amount", hairHealth.daily_loss_amount]);
    pairs.push(["Do you have dandruff?", hairHealth.dandruff_experience]);
    pairs.push(["Family history of hair loss?", hairHealth.family_history]);
    pairs.push(["How long has hair loss lasted?", hairHealth.loss_duration]);
    pairs.push(["Iron level", internalHealth.iron_level]);
    pairs.push(["Symptoms", internalHealth.symptoms]);
    pairs.push(["Life stage", internalHealth.life_stage]);
    pairs.push(["Digestion", internalHealth.digestion]);
    pairs.push(["Sleep cycle", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push(["Currently on supplements?", internalHealth.supplements]);
    pairs.push(["Food habits", internalHealth.food_habits]);
  } else {
    pairs.push(["Self-reported Norwood stage", hairHealth.norwood_stage ? `Stage ${hairHealth.norwood_stage}` : null]);
    pairs.push(["Where does hair fall the most?", hairHealth.hair_fall_zone]);
    pairs.push(["Daily hair loss amount", hairHealth.daily_loss_amount]);
    pairs.push(["Do you have dandruff?", hairHealth.dandruff_experience]);
    pairs.push(["Family history of hair loss?", hairHealth.family_history]);
    pairs.push(["How long has hair loss lasted?", hairHealth.loss_duration]);
    pairs.push(["Sleep cycle", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Existing health conditions", internalHealth.health_conditions]);
    pairs.push(["Bowel movement", internalHealth.bowel]);
    pairs.push(["Gas / acidity", internalHealth.gas_acidity]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push(["Currently on supplements?", internalHealth.supplements]);
    pairs.push(["Blood pressure", internalHealth.blood_pressure]);
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
    resultPageUrl = null,
  } = payload;

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
    drawHeader(doc, { reportId, reportDate, model });

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
    doc.moveDown(0.6);

    // View results CTA
    if (resultPageUrl) {
      const ctaY = doc.y;
      doc.roundedRect(left, ctaY, width, 28, 6).fill(BRAND);
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("View interactive results in the app  ->", left + 12, ctaY + 9, {
          width: width - 24,
          link: resultPageUrl,
          underline: false,
          lineBreak: false,
        });
      // Invisible link area for PDF readers
      doc.link(left, ctaY, width, 28, resultPageUrl);
      doc.y = ctaY + 36;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(resultPageUrl, { width, link: resultPageUrl });
      doc.moveDown(0.5);
    }

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
    drawHeader(doc, { reportId, reportDate, model });
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

    if (resultPageUrl) {
      doc.moveDown(0.8);
      const ctaY = doc.y;
      if (ctaY + 40 < doc.page.height - 56) {
        doc.roundedRect(left, ctaY, width, 28, 6).fill(BRAND);
        doc
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(10)
          .text("Open this result in the Zylk Health app  ->", left + 12, ctaY + 9, {
            width: width - 24,
            lineBreak: false,
          });
        doc.link(left, ctaY, width, 28, resultPageUrl);
        doc.y = ctaY + 34;
      }
    }

    drawFooter(doc, "PAGE 2 OF 2 · ASSESSMENT & PLAN");

    doc.end();
  });
}
