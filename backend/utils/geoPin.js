import { extractIndianPincode } from "./pincode.js";

const toRad = (deg) => (Number(deg) * Math.PI) / 180;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function pinFromOsmTags(tags = {}) {
  return (
    extractIndianPincode(tags["addr:postcode"]) ||
    extractIndianPincode(tags.postal_code) ||
    extractIndianPincode(tags.postcode) ||
    ""
  );
}

/** Nearest OSM element with a valid Indian PIN. */
export function nearestOsmPin(elements = [], lat, lng) {
  let best = null;
  for (const el of elements) {
    const pin = pinFromOsmTags(el?.tags || {});
    if (!pin) continue;
    const elat = el.lat ?? el.center?.lat;
    const elng = el.lon ?? el.center?.lon;
    if (!Number.isFinite(Number(elat)) || !Number.isFinite(Number(elng))) continue;
    const dist = haversineMeters(lat, lng, elat, elng);
    if (!best || dist < best.dist) best = { pin, dist };
  }
  return best?.pin || "";
}

export function normalizePlaceName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/tamil\s*nadu/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/(district|nagar|city|corporation|india)$/g, "");
}

/** What the UI may auto-fill from a GPS reading. */
export function locationFillLevel(accuracy) {
  const acc = Number(accuracy);
  if (!Number.isFinite(acc) || acc <= 0) return "none";
  if (acc <= 500) return "pin";
  if (acc <= 4000) return "city";
  return "none";
}

/** True when GPS locality and India Post place names refer to the same area. */
export function placesOverlap(hints = [], places = []) {
  const hay = hints.map(normalizePlaceName).filter((s) => s.length >= 5);
  const needles = places.map(normalizePlaceName).filter((s) => s.length >= 5);
  if (!hay.length || !needles.length) return false;
  return needles.some((n) => hay.some((h) => h.includes(n) || n.includes(h)));
}

/**
 * Keep reverse-geocode city. Only keep a PIN when India Post agrees with that city.
 * A Villupuram PIN must never replace Tirunelveli.
 */
export function reconcilePinWithPlace(place = {}, official = null, { allowPin = true } = {}) {
  const city = String(place.city || "").trim();
  const state = String(place.state || "").trim();
  const pin = allowPin && official?.ok ? String(official.pincode || "").trim() : "";

  if (pin && city) {
    const matches = placesOverlap(
      [city, state],
      [official.city, official.district, official.postOffice]
    );
    if (matches) {
      return {
        ok: true,
        fill: "pin",
        pincode: pin,
        city,
        state: state || String(official.state || "").trim(),
        pinGuess: true,
        source: place.source,
      };
    }
  }

  if (city || state) {
    return {
      ok: true,
      fill: "city",
      pincode: "",
      city,
      state,
      pinGuess: false,
      source: place.source,
    };
  }

  return { ok: false, reason: "not_found" };
}
