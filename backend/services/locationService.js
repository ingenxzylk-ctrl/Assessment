import {
  isValidIndianPincode,
  normalizeIndianPincode,
  extractIndianPincode,
} from "../utils/pincode.js";
import { parseGoogleGeocodeResult } from "../utils/googleGeocode.js";
import { isPrivateIp, normalizeClientIp } from "../utils/clientIp.js";
import { parseIpLocationPayload } from "../utils/ipLocation.js";

const PIN_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_TTL_MS = 6 * 60 * 60 * 1000;
const pinCache = new Map();
const geoCache = new Map();
const ipCache = new Map();

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

function pickLocalityCity(address = {}) {
  return String(
    address.city ||
      address.town ||
      address.state_district ||
      address.county ||
      address.village ||
      address.municipality ||
      ""
  ).trim();
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

function googleGeocodingKey() {
  return String(
    process.env.GOOGLE_MAPS_GEOCODING_KEY || process.env.GOOGLE_MAPS_API_KEY || ""
  ).trim();
}

async function reverseGoogle(latitude, longitude) {
  const key = googleGeocodingKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(
    latitude
  )},${encodeURIComponent(longitude)}&language=en&region=in&key=${encodeURIComponent(key)}`;
  const data = await fetchJson(url, { timeoutMs: 10000 });
  if (String(data?.status || "") !== "OK" || !Array.isArray(data.results) || !data.results.length) {
    return null;
  }
  const parsed = parseGoogleGeocodeResult(data.results[0]);
  const country = String(parsed.country || "").toLowerCase();
  if (country && country !== "india") {
    return { ok: false, reason: "outside_india" };
  }
  return {
    source: "google",
    pincode: parsed.pincode || "",
    city: parsed.city || "",
    state: parsed.state || "",
  };
}

async function reverseNominatimPlace(latitude, longitude) {
  const area = await nominatimReverse(latitude, longitude, 12);
  const address = area?.address || {};
  const city = pickLocalityCity(address);
  const state = String(address.state || "").trim();
  let pincode = "";
  try {
    const detail = await nominatimReverse(latitude, longitude, 18);
    pincode =
      extractIndianPincode(detail?.address?.postcode) ||
      extractIndianPincode(detail?.extratags?.postcode) ||
      extractIndianPincode(detail?.display_name);
  } catch {
    pincode = "";
  }
  return { source: "osm", pincode, city, state };
}

async function withIndiaPost(place) {
  const pin = isValidIndianPincode(place.pincode) ? place.pincode : "";
  if (pin) {
    const official = await lookupPincode(pin);
    if (official.ok) {
      return {
        ok: true,
        fill: "pin",
        pincode: official.pincode,
        city: official.city || place.city || "",
        state: official.state || place.state || "",
        pinGuess: true,
        source: place.source,
      };
    }
  }
  if (!place.city && !place.state && !pin) {
    return { ok: false, reason: "not_found" };
  }
  return {
    ok: true,
    fill: pin ? "pin" : "city",
    pincode: pin,
    city: place.city || "",
    state: place.state || "",
    pinGuess: Boolean(pin),
    source: place.source,
  };
}

/**
 * Fill city/state from reverse geocode. Pincode is best-effort and should be verified.
 * Google Geocoding is used when GOOGLE_MAPS_GEOCODING_KEY is set; otherwise OSM.
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

  const key = `v6:${roundCoord(latitude)},${roundCoord(longitude)}:${googleGeocodingKey() ? "g" : "o"}`;
  const cached = cacheGet(geoCache, key, GEO_TTL_MS);
  if (cached) return cached;

  try {
    let place = null;
    try {
      place = await reverseGoogle(latitude, longitude);
    } catch (err) {
      console.warn("[geo] google reverse failed:", err?.message || err);
    }
    if (place?.reason === "outside_india") {
      cacheSet(geoCache, key, place);
      return place;
    }
    if (!place?.city && !place?.state && !place?.pincode) {
      place = await reverseNominatimPlace(latitude, longitude);
    }
    const result = await withIndiaPost(place || {});
    cacheSet(geoCache, key, result);
    return result;
  } catch (err) {
    console.warn("[geo] reverse geocode failed:", err?.message || err);
    return { ok: false, reason: "upstream_error" };
  }
}

/**
 * City/state only from the visitor IP. Never fill pincode — IP postal codes are often wrong.
 */
export async function lookupIpLocation(rawIp) {
  const ip = normalizeClientIp(rawIp);
  if (!ip || isPrivateIp(ip)) {
    return { ok: false, reason: "private_ip" };
  }

  const cached = cacheGet(ipCache, ip, GEO_TTL_MS);
  if (cached) return cached;

  const urls = [
    `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,country_code`,
    `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
  ];

  for (const url of urls) {
    try {
      const data = await fetchJson(url, { timeoutMs: 5000 });
      const parsed = parseIpLocationPayload(data);
      if (parsed.ok || parsed.reason === "outside_india") {
        cacheSet(ipCache, ip, parsed);
        return parsed;
      }
    } catch (err) {
      console.warn("[geo] ip lookup failed:", err?.message || err);
    }
  }

  const miss = { ok: false, reason: "not_found" };
  cacheSet(ipCache, ip, miss);
  return miss;
}
