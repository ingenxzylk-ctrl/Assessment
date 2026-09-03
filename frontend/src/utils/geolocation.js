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
 * GPS first (8s, high accuracy, no cache), then a network reading so indoor still works.
 */
export async function readDevicePosition() {
  try {
    return await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
  } catch (err) {
    if (err?.code === 1) throw err;
    return getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 0,
    });
  }
}

export function geolocationBlockReason() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unsupported";
  if (typeof window !== "undefined" && window.isSecureContext === false) return "insecure";
  return null;
}

export function geolocationErrorStatus(err) {
  if (err?.code === 1) return "denied";
  if (err?.code === 2) return "unavailable";
  if (err?.code === 3) return "timeout";
  return "error";
}

function placeHasArea(data) {
  return Boolean(data?.ok && (data.city || data.state || data.pincode));
}

/**
 * GPS (permission + HTTPS) then IP city/state. Never treat IP postal as a pincode.
 */
export async function resolveQuizLocation({ reverseGeocode, lookupIp }) {
  const blocked = geolocationBlockReason();
  let gpsStatus = blocked;
  if (!blocked) {
    try {
      const pos = await readDevicePosition();
      const data = await reverseGeocode({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      if (data?.reason === "outside_india") return { kind: "outside" };
      if (placeHasArea(data)) return { kind: "gps", data };
      gpsStatus = data?.reason === "not_found" ? "no_pin" : "error";
    } catch (err) {
      gpsStatus = geolocationErrorStatus(err);
    }
  }

  try {
    const ip = await lookupIp();
    if (ip?.reason === "outside_india") return { kind: "outside" };
    if (ip?.ok && (ip.city || ip.state)) return { kind: "ip", data: ip };
  } catch {
    // IP is a fallback only
  }

  return { kind: "fail", status: gpsStatus || "error" };
}
