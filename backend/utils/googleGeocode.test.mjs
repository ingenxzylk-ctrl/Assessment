import { parseGoogleGeocodeResult } from "./googleGeocode.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tirunelveli = parseGoogleGeocodeResult({
  address_components: [
    { long_name: "627002", types: ["postal_code"] },
    { long_name: "Tirunelveli", types: ["locality", "political"] },
    { long_name: "Tamil Nadu", types: ["administrative_area_level_1", "political"] },
    { long_name: "India", types: ["country", "political"] },
  ],
});

assert(tirunelveli.pincode === "627002", "google pin");
assert(tirunelveli.city === "Tirunelveli", "google city");
assert(tirunelveli.state === "Tamil Nadu", "google state");

const noPin = parseGoogleGeocodeResult({
  address_components: [
    { long_name: "Tirunelveli", types: ["administrative_area_level_2"] },
    { long_name: "Tamil Nadu", types: ["administrative_area_level_1"] },
    { long_name: "India", types: ["country"] },
  ],
});
assert(noPin.pincode === "", "missing pin stays empty");
assert(noPin.city === "Tirunelveli", "district used as city");

console.log("ok google geocode parse");
