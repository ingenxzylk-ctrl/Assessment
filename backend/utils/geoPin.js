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
