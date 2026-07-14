import PDFDocument from "pdfkit";

function labelize(value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) {
    return value.length ? value.map(labelize).join(", ") : "—";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function addSectionTitle(doc, title) {
  doc.moveDown(0.6);
  doc
    .fontSize(13)
    .fillColor("#064e3b")
    .font("Helvetica-Bold")
    .text(title, { underline: true });
  doc.moveDown(0.3);
  doc.font("Helvetica").fillColor("#111827").fontSize(10);
}

function addKeyValue(doc, key, value) {
  const text = `${key}: ${labelize(value)}`;
  doc.text(text, { width: 500 });
}

function collectQaPairs(payload) {
  const { aboutMe = {}, hairHealth = {}, internalHealth = {}, gender } = payload;
  const isFemale = (gender || aboutMe.gender) === "female";
  const pairs = [];

  pairs.push(["Full name", aboutMe.fullName]);
  pairs.push(["Email", aboutMe.email]);
  pairs.push(["WhatsApp", aboutMe.whatsapp ? `${aboutMe.countryCode || ""} ${aboutMe.whatsapp}` : null]);
  pairs.push(["Age range", aboutMe.ageRange]);
  pairs.push(["Gender", aboutMe.gender]);

  if (isFemale) {
    pairs.push(["Shedding amount", hairHealth.shedding_amount]);
    pairs.push(["Hair fall zone", hairHealth.hair_fall_zone]);
    pairs.push(["Daily loss amount", hairHealth.daily_loss_amount]);
    pairs.push(["Dandruff", hairHealth.dandruff_experience]);
    pairs.push(["Family history", hairHealth.family_history]);
    pairs.push(["Loss duration", hairHealth.loss_duration]);
    pairs.push(["Iron level", internalHealth.iron_level]);
    pairs.push(["Symptoms", internalHealth.symptoms]);
    pairs.push(["Life stage", internalHealth.life_stage]);
    pairs.push(["Digestion", internalHealth.digestion]);
    pairs.push(["Sleep cycle", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push(["Supplements", internalHealth.supplements]);
    pairs.push(["Food habits", internalHealth.food_habits]);
  } else {
    pairs.push(["Norwood stage (self-report)", hairHealth.norwood_stage]);
    pairs.push(["Hair fall zone", hairHealth.hair_fall_zone]);
    pairs.push(["Daily loss amount", hairHealth.daily_loss_amount]);
    pairs.push(["Dandruff", hairHealth.dandruff_experience]);
    pairs.push(["Family history", hairHealth.family_history]);
    pairs.push(["Loss duration", hairHealth.loss_duration]);
    pairs.push(["Sleep cycle", internalHealth.sleep_cycle]);
    pairs.push(["Stress level", internalHealth.stress_level]);
    pairs.push(["Health conditions", internalHealth.health_conditions]);
    pairs.push(["Bowel", internalHealth.bowel]);
    pairs.push(["Gas / acidity", internalHealth.gas_acidity]);
    pairs.push(["Energy level", internalHealth.energy_level]);
    pairs.push(["Supplements", internalHealth.supplements]);
    pairs.push(["Blood pressure", internalHealth.blood_pressure]);
    if (internalHealth.otherConditionDetails) {
      pairs.push(["Other condition details", internalHealth.otherConditionDetails]);
    }
  }

  return pairs.filter(([, v]) => v != null && v !== "");
}

/** Parse a browser data-URL into a Buffer PDFKit can embed. */
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
  if (!photos.length) {
    addSectionTitle(doc, "Uploaded scalp photos");
    doc.font("Helvetica").fillColor("#6b7280").text("No uploaded scalp photos were available for this report.");
    return;
  }

  addSectionTitle(doc, "Uploaded scalp photos");
  doc
    .font("Helvetica")
    .fillColor("#4b5563")
    .fontSize(9)
    .text("Customer-uploaded photos used for AI assessment:", { width: 500 });
  doc.moveDown(0.4);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const gap = 16;
  const boxW = Math.min(240, (pageWidth - gap) / 2);
  const boxH = boxW;
  const startX = doc.page.margins.left;
  let x = startX;
  let rowTop = doc.y;

  // Ensure room for one row of images
  if (rowTop + boxH + 28 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    rowTop = doc.y;
  }

  photos.forEach((photo, index) => {
    if (index > 0 && index % 2 === 0) {
      doc.y = rowTop + boxH + 22;
      if (doc.y + boxH + 28 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      rowTop = doc.y;
      x = startX;
    }

    try {
      doc.image(photo.buffer, x, rowTop, {
        fit: [boxW, boxH],
        align: "center",
        valign: "center",
      });
    } catch (err) {
      console.warn("[pdf] could not embed scalp photo:", photo.type, err.message);
      doc
        .rect(x, rowTop, boxW, boxH)
        .strokeColor("#e5e7eb")
        .stroke();
      doc
        .fontSize(9)
        .fillColor("#9ca3af")
        .text("Image unavailable", x + 8, rowTop + boxH / 2 - 6, { width: boxW - 16, align: "center" });
    }

    doc
      .fontSize(9)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text(labelize(photo.label || photo.type), x, rowTop + boxH + 4, {
        width: boxW,
        align: "center",
      });

    x += boxW + gap;
  });

  doc.y = rowTop + boxH + 28;
  doc.font("Helvetica").fillColor("#111827").fontSize(10);
}

/**
 * Build an A4 PDF Buffer for the assessment report (Q&A + AI findings + photos).
 */
export function buildAssessmentPdf(payload) {
  const {
    reportId,
    reportDate,
    aboutMe = {},
    scalpAnalysis = {},
    scalpImages = [],
    reportMeta = {},
  } = payload;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc
      .fontSize(18)
      .fillColor("#064e3b")
      .font("Helvetica-Bold")
      .text("ZYLK HEALTH — Hair & Scalp Assessment Report", { align: "center" });
    doc.moveDown(0.4);
    doc
      .fontSize(10)
      .fillColor("#4b5563")
      .font("Helvetica")
      .text(`Report ID: ${reportId || "—"}`, { align: "center" });
    doc.text(`Date: ${reportDate || new Date().toLocaleDateString("en-GB")}`, {
      align: "center",
    });
    doc.moveDown(0.5);
    doc
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .moveTo(48, doc.y)
      .lineTo(547, doc.y)
      .stroke();

    addSectionTitle(doc, "1. Patient profile");
    addKeyValue(doc, "Name", aboutMe.fullName || "Guest");
    addKeyValue(doc, "Email", aboutMe.email);
    addKeyValue(doc, "WhatsApp", aboutMe.whatsapp);
    addKeyValue(doc, "Age range", aboutMe.ageRange);
    addKeyValue(doc, "Gender", aboutMe.gender);

    // Embed both (or all) uploaded scalp photos early in the report
    embedScalpPhotos(doc, scalpImages);

    addSectionTitle(doc, "2. Quiz questions & answers");
    for (const [q, a] of collectQaPairs(payload)) {
      addKeyValue(doc, q, a);
    }

    addSectionTitle(doc, "3. AI scalp assessment");
    addKeyValue(doc, "Predicted stage", scalpAnalysis.aiPredictedStage || scalpAnalysis.finalStage);
    addKeyValue(doc, "Stage description", scalpAnalysis.stageDescription);
    addKeyValue(
      doc,
      "Confidence",
      scalpAnalysis.aiConfidence != null
        ? `${Math.round(Number(scalpAnalysis.aiConfidence) * 100)}%`
        : scalpAnalysis.quotaFallback
          ? "Moderate (quiz fallback)"
          : null
    );
    addKeyValue(doc, "Self-reported stage", scalpAnalysis.selfReportedStage);
    addKeyValue(doc, "Stage discrepancy", scalpAnalysis.stageDiscrepancy ? "Yes" : "No");
    addKeyValue(doc, "Requires doctor consultation", scalpAnalysis.requiresDoctorConsultation ? "Yes" : "No");
    addKeyValue(doc, "Model", scalpAnalysis.model);
    if (scalpAnalysis.aiReasoning) {
      doc.moveDown(0.2);
      doc.font("Helvetica-Bold").text("AI reasoning:");
      doc.font("Helvetica").text(String(scalpAnalysis.aiReasoning), { width: 500 });
    }

    if (scalpAnalysis.observations && typeof scalpAnalysis.observations === "object") {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Observations:");
      doc.font("Helvetica");
      for (const [k, v] of Object.entries(scalpAnalysis.observations)) {
        if (v && typeof v === "object") {
          doc.text(`${labelize(k)}:`);
          for (const [ik, iv] of Object.entries(v)) {
            doc.text(`  • ${labelize(ik)}: ${labelize(iv)}`, { width: 480 });
          }
        } else {
          doc.text(`• ${labelize(k)}: ${labelize(v)}`);
        }
      }
    }

    if (Array.isArray(reportMeta.rootCauses) && reportMeta.rootCauses.length) {
      addSectionTitle(doc, "4. Root causes (report summary)");
      for (const cause of reportMeta.rootCauses) {
        doc
          .font("Helvetica-Bold")
          .text(cause.label || cause.id || "Cause");
        doc
          .font("Helvetica")
          .text(cause.desc || "", { width: 500 });
        doc.moveDown(0.2);
      }
    }

    if (reportMeta.eligibilityTimeline) {
      addSectionTitle(doc, "5. Eligibility / timeline");
      addKeyValue(doc, "Label", reportMeta.eligibilityTimeline.label);
      addKeyValue(doc, "Months", reportMeta.eligibilityTimeline.months);
      addKeyValue(doc, "Needs transplant", reportMeta.eligibilityTimeline.needsTransplant ? "Yes" : "No");
    }

    if (reportMeta.recommendedBundle) {
      addSectionTitle(doc, "6. Recommended kit");
      addKeyValue(doc, "Bundle", reportMeta.recommendedBundle.bundleTitle || reportMeta.recommendedBundle.bundleId);
      addKeyValue(doc, "Price", reportMeta.recommendedBundle.price != null ? `₹${reportMeta.recommendedBundle.price}` : null);
      addKeyValue(
        doc,
        "Original price",
        reportMeta.recommendedBundle.originalPrice != null
          ? `₹${reportMeta.recommendedBundle.originalPrice}`
          : null
      );
    }

    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(
        "Confidential — for Zylk Health internal use. Generated automatically from the Hair & Scalp Assessment.",
        { align: "center" }
      );

    doc.end();
  });
}
