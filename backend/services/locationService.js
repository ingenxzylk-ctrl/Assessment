import {
  isValidIndianPincode,
  normalizeIndianPincode,
  extractIndianPincode,
} from "../utils/pincode.js";
import { nearestOsmPin } from "../utils/geoPin.js";

const PIN_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_TTL_MS = 6 * 60 * 60 * 1000;
const pinCache = new Map();
const geoCache = new Map();

const POSTAL_URL = "https://api.postalpincode.in/pincode/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const PHOTON_URL = "https://photon.komoot.io/reverse";
const BIGDATA_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
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

function pinOnly(pin, extra = {}) {
  if (!isValidIndianPincode(pin)) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    pincode: pin,
    city: "",
    state: extra.state || "",
    source: "gps",
  };
}

async function enrichWithPostal(result) {
  if (!isValidIndianPincode(result?.pincode)) {
    return { ok: false, reason: "not_found" };
  }
  const official = await lookupPincode(result.pincode);
  if (official.ok) {
    return {
      ok: true,
      pincode: official.pincode,
      city: official.city || "",
      state: official.state || result.state || "",
      source: "gps",
    };
  }
  return {
    ok: true,
    pincode: result.pincode,
    city: result.city || "",
    state: result.state || "",
    source: "gps",
  };
}

async function reverseNominatim(latitude, longitude) {
  for (const zoom of [18, 16]) {
    const url = `${NOMINATIM_URL}?format=jsonv2&lat=${encodeURIComponent(
      latitude
    )}&lon=${encodeURIComponent(
      longitude
    )}&zoom=${zoom}&addressdetails=1&extratags=1&accept-language=en`;
    const data = await fetchJson(url, {
      timeoutMs: 10000,
      headers: { "User-Agent": USER_AGENT },
    });
    const address = data?.address || {};
    const extras = data?.extratags || {};
    const pin =
      extractIndianPincode(address.postcode) ||
      extractIndianPincode(extras.postcode) ||
      extractIndianPincode(data?.display_name);
    if (isValidIndianPincode(pin)) return pinOnly(pin, { state: address.state || "" });
  }
  return { ok: false, reason: "not_found" };
}

async function reversePhoton(latitude, longitude) {
  const url = `${PHOTON_URL}?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(
    longitude
  )}`;
  const data = await fetchJson(url, { timeoutMs: 8000 });
  const props = data?.features?.[0]?.properties || {};
  return pinOnly(extractIndianPincode(props.postcode), { state: props.state || "" });
}

async function reverseOverpass(latitude, longitude) {
  const query = `[out:json][timeout:8];
(
  node["addr:postcode"](around:1200,${latitude},${longitude});
  way["addr:postcode"](around:1200,${latitude},${longitude});
  node["postal_code"](around:1200,${latitude},${longitude});
  node["amenity"="post_office"](around:1200,${latitude},${longitude});
);
out center 30;`;
  const data = await fetchJson(OVERPASS_URL, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    timeoutMs: 12000,
  });
  const pin = nearestOsmPin(data?.elements || [], latitude, longitude);
  return pinOnly(pin);
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
  return pinOnly(extractIndianPincode(data?.postcode));
}

/**
 * Browser lat/lng → Indian PIN, then official India Post city/state.
 * Never returns a city without a validated PIN (that filled the wrong place).
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

  const key = `v3:${roundCoord(latitude)},${roundCoord(longitude)}`;
  const cached = cacheGet(geoCache, key, GEO_TTL_MS);
  if (cached) return cached;

  const providers = [reverseNominatim, reversePhoton, reverseOverpass, reverseBigDataCloud];
  let last = { ok: false, reason: "not_found" };

  for (const provider of providers) {
    try {
      const raw = await provider(latitude, longitude);
      if (raw?.reason === "outside_india") {
        cacheSet(geoCache, key, raw);
        return raw;
      }
      if (!isValidIndianPincode(raw?.pincode)) {
        last = raw || last;
        continue;
      }
      const result = await enrichWithPostal(raw);
      if (isValidIndianPincode(result.pincode)) {
        cacheSet(geoCache, key, result);
        return result;
      }
    } catch (err) {
      console.warn("[geo] reverse geocode failed:", err?.message || err);
      last = { ok: false, reason: "upstream_error" };
    }
  }

  cacheSet(geoCache, key, last);
  return last;
}
