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
 * Mobile GPS often needs a cached/low-accuracy read first, then a longer GPS retry.
 */
export async function readDevicePosition() {
  const attempts = [
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 },
    { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
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

/**
 * Browser-side reverse geocode so PIN fill still works if the backend lookup fails.
 * BigDataCloud's client endpoint is CORS-enabled and needs no API key.
 */
export async function reverseGeocodeBrowserFallback({ lat, lng }) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
    lat
  )}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, reason: "upstream_error" };
  const data = await res.json();
  const country = String(data?.countryCode || "").toUpperCase();
  if (country && country !== "IN") return { ok: false, reason: "outside_india" };
  const pin = extractIndianPincode(data?.postcode);
  const city = String(data?.city || data?.locality || "").trim();
  const state = String(data?.principalSubdivision || "").trim();
  if (!pin && !city) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    pincode: pin || "",
    city,
    state,
    source: "gps",
  };
}

export function isUsableGeoResult(data) {
  if (!data?.ok) return false;
  return Boolean(
    (data.pincode && isValidIndianPincode(data.pincode)) || data.city || data.state
  );
}
