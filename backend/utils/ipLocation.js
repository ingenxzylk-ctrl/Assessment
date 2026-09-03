/**
 * Normalize ipwho.is / ipapi.co / ip-api.com payloads.
 * Never trust postal/ZIP from IP — city-level only, and India only.
 */
export function parseIpLocationPayload(data = {}) {
  if (!data || typeof data !== "object") {
    return { ok: false, reason: "not_found" };
  }
  if (data.error === true || data.success === false || data.status === "fail") {
    return { ok: false, reason: "not_found" };
  }

  const city = String(data.city || "").trim();
  const state = String(data.region || data.regionName || data.region_name || "").trim();
  const countryName = String(data.country_name || "").trim();
  const countryRaw = String(data.country || "").trim();
  const countryCode = String(data.country_code || data.countryCode || "")
    .trim()
    .toUpperCase();

  const code =
    countryCode ||
    (/^[A-Z]{2}$/i.test(countryRaw) ? countryRaw.toUpperCase() : "");
  const isIndia = code === "IN" || /^india$/i.test(countryName || countryRaw);
  if (!isIndia) {
    return { ok: false, reason: "outside_india" };
  }
  if (!city && !state) {
    return { ok: false, reason: "not_found" };
  }

  return {
    ok: true,
    fill: "city",
    city,
    state,
    pincode: "",
    pinGuess: false,
    source: "ip",
  };
}
