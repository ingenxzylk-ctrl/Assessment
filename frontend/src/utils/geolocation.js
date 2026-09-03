import {
  extractIndianPincode,
  isValidIndianPincode,
} from "./pincode";

/** Reject network/IP guesses. Tirunelveli vs Villupuram is hundreds of km. */
const GOOD_ACCURACY_M = 100;
const MAX_ACCURACY_M = 2000;
const GPS_WAIT_MS = 22000;

/**
 * Wait for a real GPS lock. Do not fall back to coarse network location —
 * that is what filled Villupuram for a Tirunelveli user.
 */
export function readDevicePosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const err = new Error("Geolocation is not supported");
      err.code = 2;
      reject(err);
      return;
    }

    let best = null;
    let settled = false;
    let watchId = null;
    let timer = null;

    const stop = () => {
      if (watchId != null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (timer) clearTimeout(timer);
    };

    const finish = (pos, err) => {
      if (settled) return;
      settled = true;
      stop();
      if (pos && Number(pos.coords.accuracy) <= MAX_ACCURACY_M) {
        resolve(pos);
        return;
      }
      const fail = err || new Error("inaccurate");
      if (!fail.code) fail.code = "inaccurate";
      fail.accuracy = pos?.coords?.accuracy ?? best?.coords?.accuracy;
      reject(fail);
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const acc = Number(pos.coords.accuracy);
        if (!Number.isFinite(acc)) return;
        if (!best || acc < Number(best.coords.accuracy)) best = pos;
        if (acc <= GOOD_ACCURACY_M) finish(pos);
      },
      (err) => {
        if (err?.code === 1) finish(null, err);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_WAIT_MS }
    );

    timer = setTimeout(() => finish(best), GPS_WAIT_MS);
  });
}

export function geolocationBlockReason() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  return null;
}

export function geolocationErrorStatus(err) {
  if (err?.code === 1) return "denied";
  if (err?.code === 3) return "timeout";
  if (err?.code === "inaccurate") return "inaccurate";
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
    /* ignore */
  }
  return { ok: false, reason: "not_found" };
}

export function isUsableGeoResult(data) {
  return Boolean(data?.ok && isValidIndianPincode(data.pincode));
}
