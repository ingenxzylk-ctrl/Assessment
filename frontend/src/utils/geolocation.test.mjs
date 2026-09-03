import { resolveQuizLocation } from "./geolocation.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const none = await resolveQuizLocation({
  reverseGeocode: async () => {
    throw new Error("GPS should not run without a geolocation API");
  },
});
assert(none.kind === "fail", `node/no-GPS should not fill from IP, got ${none.kind}`);
assert(none.status === "unsupported", `status should be unsupported, got ${none.status}`);

console.log("ok geolocation fallback");
