/**
 * Lightweight client-side photo quality precheck.
 * Catches obviously dark / blurry images before AI analysis.
 */

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.src = dataUrl;
  });
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, reasons: string[], message: string }>}
 */
export async function precheckPhotoQuality(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    return {
      ok: false,
      reasons: ["Image unclear / blurry"],
      message: "Please upload a proper image.",
    };
  }

  try {
    const img = await loadImage(dataUrl);
    const maxSide = 320;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(32, Math.round(img.width * scale));
    const h = Math.max(32, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return { ok: true };
    }
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    let sum = 0;
    let sumSq = 0;
    let darkCount = 0;
    const pixels = w * h;

    // Grayscale luminance + simple Laplacian-ish sharpness via neighbor diff
    const gray = new Float32Array(pixels);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = y;
      sum += y;
      sumSq += y * y;
      if (y < 40) darkCount += 1;
    }

    const mean = sum / pixels;
    const variance = sumSq / pixels - mean * mean;

    let edgeSum = 0;
    let edgeCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = gray[i + 1] - gray[i - 1];
        const gy = gray[i + w] - gray[i - w];
        edgeSum += gx * gx + gy * gy;
        edgeCount += 1;
      }
    }
    const sharpness = edgeCount ? edgeSum / edgeCount : 0;
    const darkRatio = darkCount / pixels;

    const reasons = [];
    // Too dark overall, or large dark region
    if (mean < 55 || darkRatio > 0.62) {
      reasons.push("Insufficient lighting / too dark");
    }
    // Very low contrast + low edge energy ≈ blurry / unclear
    if (sharpness < 90 || variance < 280) {
      reasons.push("Image unclear / blurry");
    }

    // Deduplicate
    const unique = [...new Set(reasons)];
    if (!unique.length) return { ok: true };

    return {
      ok: false,
      reasons: unique,
      message: `Please upload a proper image. ${unique.join("; ")}. Use dry hair, good lighting, no hat, and no filters.`,
    };
  } catch {
    return {
      ok: false,
      reasons: ["Image unclear / blurry"],
      message: "Please upload a proper image.",
    };
  }
}
