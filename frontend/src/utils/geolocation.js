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
 * GPS first (8s, high accuracy, no cache). A network-only reading is marked
 * so the quiz does not treat ISP/wifi triangulation as the user's town.
 */
export async function readDevicePosition() {
  try {
    const position = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 0,
    });
    return { position, highAccuracy: true };
  } catch (err) {
    if (err?.code === 1) throw err;
    const position = await getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 0,
    });
    return { position, highAccuracy: false };
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

/**
 * GPS only. Coarse/IP-level readings are not used — they can land in the wrong district.
 */
export async function resolveQuizLocation({ reverseGeocode }) {
  const blocked = geolocationBlockReason();
  if (blocked) return { kind: "fail", status: blocked };

  try {
    const { position: pos, highAccuracy } = await readDevicePosition();
    if (!highAccuracy) return { kind: "coarse" };
    const data = await reverseGeocode({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
    if (data?.reason === "outside_india") return { kind: "outside" };
    if (data?.reason === "low_accuracy") return { kind: "coarse" };
    if (data?.ok && (data.city || data.state)) return { kind: "gps", data };
    return { kind: "fail", status: data?.reason === "not_found" ? "no_pin" : "error" };
  } catch (err) {
    return { kind: "fail", status: geolocationErrorStatus(err) };
  }
}
