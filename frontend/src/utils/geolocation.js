import {
  extractIndianPincode,
  isValidIndianPincode,
} from "./pincode";

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const err = new Error("Geolocation is not supported");
      err.code = 2;
      reject(err);
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * Fresh GPS first — a stale Wi‑Fi fix is the usual cause of the wrong city.
 */
export async function readDevicePosition() {
  const attempts = [
    { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 15000 },
  ];
  let lastErr;
  for (const options of attempts) {
    try {
      return await getCurrentPosition(options);
    } catch (err) {
      lastErr = err;
      if (err?.code === 1) throw err;
    }
  }
  throw lastErr || new Error("Location unavailable");
}

export function geolocationBlockReason() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  return null;
}

export function geolocationErrorStatus(err) {
  if (err?.code === 1) return "denied";
  if (err?.code === 3) return "timeout";
  return "error";
}

async function pinFromPhoton(lat, lng) {
  const res = await fetch(
    `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
  );
  if (!res.ok) return "";
  const data = await res.json();
  const props = data?.features?.[0]?.properties || {};
  return extractIndianPincode(props.postcode);
}

async function pinFromBigDataCloud(lat, lng) {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
      lat
    )}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`
  );
  if (!res.ok) return { pin: "", outside: false };
  const data = await res.json();
  const country = String(data?.countryCode || "").toUpperCase();
  if (country && country !== "IN") return { pin: "", outside: true };
  return { pin: extractIndianPincode(data?.postcode), outside: false };
}

/**
 * Browser fallback used only when the backend did not return a valid PIN.
 * City/state are filled later from India Post using that PIN.
 */
export async function reverseGeocodeBrowserFallback({ lat, lng }) {
  try {
    const pin = await pinFromPhoton(lat, lng);
    if (isValidIndianPincode(pin)) {
      return { ok: true, pincode: pin, city: "", state: "", source: "gps" };
    }
  } catch {
    /* try next provider */
  }
  try {
    const { pin, outside } = await pinFromBigDataCloud(lat, lng);
    if (outside) return { ok: false, reason: "outside_india" };
    if (isValidIndianPincode(pin)) {
      return { ok: true, pincode: pin, city: "", state: "", source: "gps" };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, reason: "not_found" };
}

export function isUsableGeoResult(data) {
  return Boolean(data?.ok && isValidIndianPincode(data.pincode));
}
