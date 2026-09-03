import {
  isValidIndianPincode,
  normalizeIndianPincode,
  extractIndianPincode,
} from "../utils/pincode.js";

const PIN_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_TTL_MS = 6 * 60 * 60 * 1000;
const pinCache = new Map();
const geoCache = new Map();

const POSTAL_URL = "https://api.postalpincode.in/pincode/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const BIGDATA_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
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

async function fetchJson(url, { timeoutMs = 8000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
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

function resultFromParts({ pin, city, state }) {
  return {
    ok: Boolean(pin || city),
    pincode: pin || "",
    city: String(city || "").trim(),
    state: String(state || "").trim(),
    source: "gps",
  };
}

async function enrichWithPostal(result) {
  if (!isValidIndianPincode(result.pincode)) return result;
  const official = await lookupPincode(result.pincode);
  if (!official.ok) return result;
  return {
    ok: true,
    pincode: official.pincode,
    city: official.city || result.city,
    state: official.state || result.state,
    source: "gps",
  };
}

async function reverseNominatim(latitude, longitude) {
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${encodeURIComponent(
    latitude
  )}&lon=${encodeURIComponent(longitude)}&zoom=16&addressdetails=1`;
  const data = await fetchJson(url, {
    timeoutMs: 10000,
    headers: { "User-Agent": USER_AGENT },
  });
  const address = data?.address || {};
  const pin =
    extractIndianPincode(address.postcode) ||
    extractIndianPincode(data?.display_name);
  const city =
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.county ||
    address.state_district ||
    "";
  return resultFromParts({
    pin,
    city,
    state: address.state || "",
  });
}

async function reverseBigDataCloud(latitude, longitude) {
  const url = `${BIGDATA_URL}?latitude=${encodeURIComponent(
    latitude
  )}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;
  const data = await fetchJson(url, { timeoutMs: 8000 });
  const country = String(data?.countryCode || "").toUpperCase();
  if (country && country !== "IN") {
    return { ok: false, reason: "outside_india" };
  }
  const pin = extractIndianPincode(data?.postcode);
  const city = data?.city || data?.locality || "";
  return resultFromParts({
    pin,
    city,
    state: data?.principalSubdivision || "",
  });
}

/**
 * Browser lat/lng → Indian PIN + city/state (Nominatim, then BigDataCloud, then PIN lookup).
 */
export async function reverseGeocode(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { ok: false, reason: "invalid_coords" };
  }
  if (latitude < 6 || latitude > 38 || longitude < 68 || longitude > 98) {
    return { ok: false, reason: "outside_india" };
  }

  const key = `${roundCoord(latitude)},${roundCoord(longitude)}`;
  const cached = cacheGet(geoCache, key, GEO_TTL_MS);
  if (cached) return cached;

  const providers = [reverseNominatim, reverseBigDataCloud];
  let last = { ok: false, reason: "upstream_error" };

  for (const provider of providers) {
    try {
      const raw = await provider(latitude, longitude);
      if (raw?.reason === "outside_india") {
        cacheSet(geoCache, key, raw);
        return raw;
      }
      if (!raw?.ok) {
        last = raw || last;
        continue;
      }
      const result = await enrichWithPostal(raw);
      cacheSet(geoCache, key, result);
      return result;
    } catch (err) {
      console.warn("[geo] reverse geocode failed:", err?.message || err);
      last = { ok: false, reason: "upstream_error" };
    }
  }

  cacheSet(geoCache, key, last);
  return last;
}
