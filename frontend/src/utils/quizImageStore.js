const DB_NAME = "zylk_quiz_images_v1";
const STORE_NAME = "scalpImages";
const RECORD_KEY = "current";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open image DB"));
  });
}

/**
 * Persist scalp photo data URLs outside localStorage (avoids quota stripping).
 */
export async function saveScalpImagesToIdb(images = []) {
  const payload = (Array.isArray(images) ? images : []).map((img) => ({
    type: img?.type,
    label: img?.label || img?.type,
    dataUrl: img?.dataUrl || img?.previewUrl || img?.url || null,
  }));

  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Failed to save images"));
    tx.objectStore(STORE_NAME).put(payload, RECORD_KEY);
  });
  db.close();
}

export async function loadScalpImagesFromIdb() {
  try {
    const db = await openDb();
    const images = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error("Failed to load images"));
    });
    db.close();
    return Array.isArray(images) ? images : [];
  } catch {
    return [];
  }
}

export async function clearScalpImagesIdb() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("Failed to clear images"));
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    });
    db.close();
  } catch {
    // ignore
  }
}

/** Prefer entries that still have a usable data URL. */
export function mergeScalpImages(primary = [], fallback = []) {
  const byType = new Map();
  for (const img of [...(fallback || []), ...(primary || [])]) {
    if (!img?.type) continue;
    const existing = byType.get(img.type);
    const nextUrl = img.dataUrl || img.previewUrl || img.url || null;
    const existingUrl = existing?.dataUrl || existing?.previewUrl || existing?.url || null;
    if (!existing || (nextUrl && !existingUrl) || nextUrl) {
      byType.set(img.type, {
        type: img.type,
        label: img.label || img.type,
        dataUrl: nextUrl || existingUrl || null,
      });
    }
  }
  return Array.from(byType.values());
}
