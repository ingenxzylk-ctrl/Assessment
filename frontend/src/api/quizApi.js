const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong. Please try again.");
  }
  return data;
}

/**
 * Converts a File object into { base64Data, mediaType } ready for the backend.
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,<data>
      const base64Data = result.split(",")[1];
      resolve({ base64Data, mediaType: file.type, previewUrl: result });
    };
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

/**
 * POST /api/analyze
 * Maps the captured frontend local data images array explicitly to 
 * the 'frontImage' and 'topImage' parameters expected by your Gemini controller.
 */
export async function analyzeScalp({ gender, selfReportedStage, images }) {
  // Extract and format the specific image paths based on their assigned location labels
  const frontItem = images.find(img => img.type === "front" || img.label === "front");
  const topItem = images.find(img => img.type === "top" || img.label === "top");

  // Fallback to absolute array index matching if custom string labels are blank or unassigned
  const frontImageString = frontItem?.dataUrl || frontItem?.previewUrl || images[0]?.dataUrl || images[0]?.previewUrl || "";
  const topImageString = topItem?.dataUrl || topItem?.previewUrl || images[1]?.dataUrl || images[1]?.previewUrl || "";

  const res = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gender,
      selfReportedStage: String(selfReportedStage),
      frontImage: frontImageString,
      topImage: topImageString
    }),
  });
  return handleResponse(res);
}

/**
 * POST /api/result
 */
export async function generateResult({ aboutMe, hairHealth, internalHealth, scalpAnalysis }) {
  const res = await fetch(`${API_URL}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aboutMe, hairHealth, internalHealth, scalpAnalysis }),
  });
  return handleResponse(res);
}