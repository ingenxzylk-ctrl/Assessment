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

/**
 * Build an A4 PDF Buffer for the assessment report (Q&A + AI findings).
 */
export function buildAssessmentPdf(payload) {
  const {
    reportId,
    reportDate,
    aboutMe = {},
    scalpAnalysis = {},
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
