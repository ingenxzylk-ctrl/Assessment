import {
  isValidIndianPincode,
  normalizeIndianPincode,
  extractIndianPincode,
} from "../utils/pincode.js";
import { locationFillLevel, placesOverlap } from "../utils/geoPin.js";

const PIN_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_TTL_MS = 6 * 60 * 60 * 1000;
const pinCache = new Map();
const geoCache = new Map();

const POSTAL_URL = "https://api.postalpincode.in/pincode/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "ZylkHealthQuiz/1.0 (https://zylkhealth.com; location lookup)";

function cacheGet(map, key, ttl) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(map, key, value, max = 2000) {
  if (map.size >= max) {
    const first = map.keys().next().value;
    if (first !== undefined) map.delete(first);
  }
  map.set(key, { at: Date.now(), value });
}

async function fetchJson(url, { timeoutMs = 8000, headers = {}, method = "GET", body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      method,
      body,
      headers: { Accept: "application/json", ...headers },
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function pickCity(office = {}) {
  const district = String(office.District || "").trim();
  const block = String(office.Block || "").trim();
  const name = String(office.Name || "").trim();
  if (district && !/^na$/i.test(district)) return district;
  if (block && !/^na$/i.test(block)) return block;
  return name || "";
}

/**
 * Official India Post PIN → district (as city) + state.
 */
export async function lookupPincode(rawPin) {
  const pincode = normalizeIndianPincode(rawPin);
  if (!isValidIndianPincode(pincode)) {
    return { ok: false, reason: "invalid_format", pincode };
  }

  const cached = cacheGet(pinCache, pincode, PIN_TTL_MS);
  if (cached) return cached;

  try {
    const data = await fetchJson(`${POSTAL_URL}${encodeURIComponent(pincode)}`);
    const row = Array.isArray(data) ? data[0] : data;
    const offices = Array.isArray(row?.PostOffice) ? row.PostOffice : [];
    const status = String(row?.Status || "").toLowerCase();
    if (status !== "success" || !offices.length) {
      const miss = { ok: false, reason: "not_found", pincode };
      cacheSet(pinCache, pincode, miss);
      return miss;
    }
    const office = offices[0] || {};
    const result = {
      ok: true,
      pincode,
      city: pickCity(office),
      district: String(office.District || "").trim(),
      state: String(office.State || "").trim(),
      postOffice: String(office.Name || "").trim(),
    };
    cacheSet(pinCache, pincode, result);
    return result;
  } catch (err) {
    console.warn("[pincode] lookup failed:", err?.message || err);
    return { ok: false, reason: "upstream_error", pincode };
  }
}

function roundCoord(n) {
  return Number(n).toFixed(3);
}

function hintsFromNominatim(data = {}) {
  const address = data.address || {};
  return [
    address.city,
    address.town,
    address.village,
    address.suburb,
    address.county,
    address.state_district,
    address.municipality,
    address.city_district,
  ].filter(Boolean);
}

function pickLocalityCity(address = {}) {
  return (
    String(
      address.state_district ||
        address.county ||
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        ""
    ).trim()
  );
}

async function nominatimReverse(latitude, longitude, zoom) {
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${encodeURIComponent(
    latitude
  )}&lon=${encodeURIComponent(
    longitude
  )}&zoom=${zoom}&addressdetails=1&extratags=1&accept-language=en`;
  return fetchJson(url, {
    timeoutMs: 10000,
    headers: { "User-Agent": USER_AGENT },
  });
}

/**
 * Real-world fill policy:
 *   GPS ≤ 500m  → pincode + city/state (India Post)
 *   GPS ≤ 4km   → city/state only, user types pincode
 *   Coarser     → fill nothing (desktop IP guesses the wrong town)
 */
export async function reverseGeocode(lat, lng, { accuracy } = {}) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, reason: "invalid_coords" };
  }
  if (latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
    return { ok: false, reason: "outside_india" };
  }

  const fill = locationFillLevel(accuracy);
  const key = `v5:${fill}:${roundCoord(latitude)},${roundCoord(longitude)}`;
  const cached = cacheGet(geoCache, key, GEO_TTL_MS);
  if (cached) return cached;

  if (fill === "none") {
    const none = { ok: true, fill: "none", reason: "coarse", pincode: "", city: "", state: "" };
    cacheSet(geoCache, key, none);
    return none;
  }

  try {
    const area = await nominatimReverse(latitude, longitude, 12);
    const address = area?.address || {};
    const city = pickLocalityCity(address);
    const state = String(address.state || "").trim();
    const hints = hintsFromNominatim(area);
    if (!city && !state) {
      const miss = { ok: false, reason: "not_found" };
      cacheSet(geoCache, key, miss);
      return miss;
    }

    if (fill === "city") {
      const cityOnly = {
        ok: true,
        fill: "city",
        pincode: "",
        city,
        state,
        source: "gps",
      };
      cacheSet(geoCache, key, cityOnly);
      return cityOnly;
    }

    const detail = await nominatimReverse(latitude, longitude, 18);
    const pin =
      extractIndianPincode(detail?.address?.postcode) ||
      extractIndianPincode(detail?.extratags?.postcode) ||
      extractIndianPincode(detail?.display_name);
    if (!isValidIndianPincode(pin)) {
      const cityOnly = {
        ok: true,
        fill: "city",
        pincode: "",
        city,
        state,
        source: "gps",
      };
      cacheSet(geoCache, key, cityOnly);
      return cityOnly;
    }

    const official = await lookupPincode(pin);
    if (
      official.ok &&
      placesOverlap(
        [...hints, city],
        [official.city, official.district, official.postOffice]
      )
    ) {
      const pinFill = {
        ok: true,
        fill: "pin",
        pincode: official.pincode,
        city: official.city || city,
        state: official.state || state,
        district: official.district || "",
        source: "gps",
      };
      cacheSet(geoCache, key, pinFill);
      return pinFill;
    }

    const fallbackCity = {
      ok: true,
      fill: "city",
      pincode: "",
      city,
      state,
      source: "gps",
    };
    cacheSet(geoCache, key, fallbackCity);
    return fallbackCity;
  } catch (err) {
    console.warn("[geo] reverse geocode failed:", err?.message || err);
    return { ok: false, reason: "upstream_error" };
  }
}
