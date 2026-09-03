import { lookupPincode, reverseGeocode } from "../services/locationService.js";
import { isValidIndianPincode } from "../utils/pincode.js";

export async function getPincodeLookup(req, res) {
  const pin = req.params.pincode || req.query.pincode;
  if (!isValidIndianPincode(pin)) {
    return res.status(400).json({
      ok: false,
      reason: "invalid_format",
      error: "Enter a valid 6-digit Indian pincode.",
    });
  }
  const result = await lookupPincode(pin);
  const status = result.ok ? 200 : result.reason === "not_found" ? 404 : 502;
  return res.status(status).json(result);
}

export async function postReverseGeocode(req, res) {
  const lat = req.body?.lat ?? req.body?.latitude ?? req.query.lat;
  const lng = req.body?.lng ?? req.body?.longitude ?? req.query.lng;
  const accuracy = req.body?.accuracy ?? req.query.accuracy;
  const result = await reverseGeocode(lat, lng, { accuracy });
  const status = result.ok
    ? 200
    : result.reason === "invalid_coords" || result.reason === "outside_india"
      ? 400
      : result.reason === "not_found"
        ? 404
        : 502;
  return res.status(status).json(result);
}
