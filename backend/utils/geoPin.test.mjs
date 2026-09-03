import { nearestOsmPin, pinFromOsmTags, placesOverlap } from "./geoPin.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(pinFromOsmTags({ "addr:postcode": "627 002" }) === "627002", "spaced OSM pin");
assert(pinFromOsmTags({ postal_code: "600001" }) === "600001", "postal_code tag");

const pin = nearestOsmPin(
  [
    { lat: 8.72, lon: 77.76, tags: { "addr:postcode": "627011" } },
    { lat: 8.7139, lon: 77.7567, tags: { "addr:postcode": "627002" } },
    { lat: 8.8, lon: 77.8, tags: { name: "no pin" } },
  ],
  8.7139,
  77.7567
);
assert(pin === "627002", `nearest pin should be 627002, got ${pin}`);

assert(
  placesOverlap(["Palayamkottai", "Tirunelveli"], ["Tirunelveli"]),
  "Tirunelveli GPS should match Tirunelveli PIN"
);
assert(
  !placesOverlap(["Tirunelveli", "Palayamkottai"], ["Villupuram"]),
  "Tirunelveli GPS must not accept Villupuram PIN"
);

console.log("ok geoPin nearest postal code");
