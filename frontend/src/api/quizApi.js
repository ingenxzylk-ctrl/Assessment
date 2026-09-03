const PRODUCTION_API_URL = "https://api.zylkhealth.com/api";

/** Never call localhost from the live quiz — only from local dev. */
function resolveApiUrl() {
  const fromEnv = String(import.meta.env.VITE_API_URL || "").trim();
  const fallback = PRODUCTION_API_URL;
  if (!fromEnv) return fallback;

  const onLocalHost =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

  if (fromEnv.includes("localhost") && !onLocalHost) {
    return fallback;
  }
  return fromEnv;
}

const API_URL = resolveApiUrl();

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64Data = result.split(",")[1];
      resolve({ base64Data, mediaType: file.type, previewUrl: result });
    };
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

export async function analyzeScalp({ gender, selfReportedStage, images }) {
  let res;
  try {
    res = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gender,
        selfReportedStage: String(selfReportedStage),
        images,
      }),
    });
  } catch {
    throw new Error(
      "Cannot reach backend server. Make sure backend is running: cd backend && npm run dev"
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Backend returned an invalid response. Check backend terminal for errors.");
  }

  if (res.status === 422 && data.imageRejected) {
    const err = new Error(data.error || "Invalid scalp image.");
    err.imageRejected = true;
    err.rejectionReasons = Array.isArray(data.rejectionReasons) ? data.rejectionReasons : [];
    err.qualityChecks = data.qualityChecks || null;
    err.photoQualityAssessment = data.photoQualityAssessment || null;
    throw err;
  }

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }

  return data;
}

export async function generateResult({ aboutMe, hairHealth, internalHealth, scalpAnalysis }) {
  const res = await fetch(`${API_URL}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aboutMe, hairHealth, internalHealth, scalpAnalysis }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

/**
 * Post-Gemini report pipeline (POST /api/report/submit):
 *   Generate PDF → Save PDF on VPS (fail-safe) → Append lead to Google Sheets → return.
 *
 * Send a stable `quizId` (UUID) with each attempt. The VPS allocates `reportId`.
 * Expects analysis already completed via analyzeScalp() (POST /api/analyze).
 * Returns { ok, quizId, reportId, pdfUrl, resultPageUrl, sheets, pipeline, ... }.
 */
export async function submitAssessmentReport(payload) {
  let res;
  try {
    res = await fetch(`${API_URL}/report/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Cannot reach backend server to save assessment report. Make sure backend is running."
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Backend returned an invalid response while saving the report.");
  }

  if (!res.ok) {
    throw new Error(data.error || "Failed to save assessment report.");
  }
  return data;
}

/**
 * Load an archived assessment by report id (for `?report=TR-…` deep links).
 */
export async function fetchAssessmentReport(reportId) {
  const id = encodeURIComponent(String(reportId || "").trim());
  let res;
  try {
    res = await fetch(`${API_URL}/report/${id}`);
  } catch {
    throw new Error(
      "Cannot reach backend server to load this assessment report."
    );
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error("Backend returned an invalid response while loading the report.");
  }

  if (!res.ok) {
    throw new Error(data.error || "Failed to load assessment report.");
  }
  return data;
}

export async function lookupPincode(pincode) {
  const pin = encodeURIComponent(String(pincode || "").trim());
  const res = await fetch(`${API_URL}/pincode/${pin}`);
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { ok: false, reason: "upstream_error" };
  }
  return data;
}

export async function reverseGeocodeLocation({ lat, lng, accuracy }) {
  try {
    const res = await fetch(`${API_URL}/geo/reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, accuracy }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = { ok: false, reason: "upstream_error" };
    }
    return data;
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function guessLocationFromIp() {
  try {
    const res = await fetch(`${API_URL}/geo/ip`);
    let data = {};
    try {
      data = await res.json();
    } catch {
      data = { ok: false, reason: "upstream_error" };
    }
    return data;
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function markCheckoutClicked({ reportId, aboutMe } = {}) {
  const id = encodeURIComponent(String(reportId || "").trim());
  if (!id) return { ok: false, skipped: true, reason: "no_report_id" };
  try {
    const res = await fetch(`${API_URL}/report/${id}/checkout-click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, aboutMe: aboutMe || {} }),
    });
    return await res.json();
  } catch {
    return { ok: false, skipped: true, reason: "network" };
  }
}