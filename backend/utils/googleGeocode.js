import { extractIndianPincode } from "./pincode.js";

export function googleAddressComponent(components = [], type) {
  const row = (Array.isArray(components) ? components : []).find(
    (c) => Array.isArray(c?.types) && c.types.includes(type)
  );
  return String(row?.long_name || "").trim();
}

/** Map a Google Geocoding result to Indian city / state / PIN. */
export function parseGoogleGeocodeResult(result = {}) {
  const components = result.address_components || [];
  const get = (type) => googleAddressComponent(components, type);
  const country = get("country");
  const pincode = extractIndianPincode(get("postal_code"));
  const city =
    get("locality") ||
    get("administrative_area_level_2") ||
    get("administrative_area_level_3") ||
    get("sublocality") ||
    "";
  const state = get("administrative_area_level_1") || "";
  return { pincode, city, state, country };
}
