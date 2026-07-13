const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

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
 * Persist quiz Q&A + assessment as PDF, store it, and email the org.
 * Non-blocking for the user UI — callers should catch errors.
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