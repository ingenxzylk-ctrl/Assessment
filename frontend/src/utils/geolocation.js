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
 * Mobile: try GPS, then network so the button still works indoors.
 * Desktop: network/IP is usually 5–50 km off — caller must not fill a pincode from that.
 */
export async function readDevicePosition() {
  try {
    return await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
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
  if (err?.code === 3) return "timeout";
  return "error";
}
