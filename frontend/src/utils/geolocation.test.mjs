import { resolveQuizLocation } from "./geolocation.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ip = await resolveQuizLocation({
  reverseGeocode: async () => {
    throw new Error("GPS should not run without a geolocation API");
  },
  lookupIp: async () => ({ ok: true, city: "Chennai", state: "Tamil Nadu" }),
});
assert(ip.kind === "ip", `node/no-GPS should fall back to IP, got ${ip.kind}`);
assert(ip.data.city === "Chennai", "IP city");

const fail = await resolveQuizLocation({
  reverseGeocode: async () => ({ ok: false }),
  lookupIp: async () => ({ ok: false, reason: "private_ip" }),
});
assert(fail.kind === "fail", "no GPS and no IP");
assert(fail.status === "unsupported", `status should be unsupported, got ${fail.status}`);

console.log("ok geolocation fallback");
