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
  const res = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gender,
      selfReportedStage: String(selfReportedStage),
      images,
    }),
  });

  const data = await res.json();

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