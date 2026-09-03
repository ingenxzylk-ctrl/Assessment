/**
 * Load any quiz photo source (data URL, blob URL, or HTTPS) into a Blob without tainting canvas.
 */
export async function imageSourceToBlob(src) {
  const value = String(src || "").trim();
  if (!value) {
    throw new Error("No image data");
  }
  if (value.startsWith("data:") || value.startsWith("blob:")) {
    const res = await fetch(value);
    if (!res.ok) throw new Error("Failed to read image data");
    return res.blob();
  }
  const res = await fetch(value, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error("Failed to load image");
  return res.blob();
}

function isSecurityError(err) {
  const name = String(err?.name || "");
  const msg = String(err?.message || err || "");
  return name === "SecurityError" || /tainted|cross-origin|security/i.test(msg);
}

async function drawBlobToJpegDataUrl(blob, maxWidth, quality) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    // Older browsers without createImageBitmap
    return drawBlobWithImageElement(blob, maxWidth, quality);
  }

  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  return canvas.toDataURL("image/jpeg", quality);
}

function drawBlobWithImageElement(blob, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = url;
  });
}

/** Normalize to a data URL the API can accept (avoids tainted canvas on cross-origin URLs). */
export async function ensureDataUrl(src) {
  const value = String(src || "").trim();
  if (!value) throw new Error("No image data");
  if (value.startsWith("data:image/")) return value;
  const blob = await imageSourceToBlob(value);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(input, maxWidth = 1280, quality = 0.82) {
  const src = String(input || "").trim();
  if (!src) throw new Error("No image data");

  try {
    const blob = await imageSourceToBlob(src);
    return await drawBlobToJpegDataUrl(blob, maxWidth, quality);
  } catch (err) {
    if (src.startsWith("data:image/") && isSecurityError(err)) {
      return src;
    }
    throw err;
  }
}
