import { normalizeClientIp, isPrivateIp, pickClientIp } from "./clientIp.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeClientIp("::ffff:49.37.1.2") === "49.37.1.2", "v4-mapped");
assert(normalizeClientIp("[2405:201:1::1]") === "2405:201:1::1", "bracket v6");

assert(isPrivateIp("127.0.0.1"), "loopback");
assert(isPrivateIp("10.0.0.8"), "class A");
assert(isPrivateIp("192.168.1.10"), "class C");
assert(isPrivateIp("172.16.0.1"), "class B start");
assert(isPrivateIp("172.31.255.1"), "class B end");
assert(isPrivateIp("::1"), "v6 loopback");
assert(isPrivateIp("not-an-ip"), "garbage");
assert(!isPrivateIp("49.37.1.2"), "public v4");
assert(!isPrivateIp("172.32.0.1"), "172.32 is public");

assert(
  pickClientIp({ "x-forwarded-for": "49.37.1.2, 10.0.0.1" }, "127.0.0.1") === "49.37.1.2",
  "first forwarded public IP"
);
assert(
  pickClientIp({ "x-forwarded-for": "192.168.0.2" }, "8.8.8.8") === "8.8.8.8",
  "skip private forwarded, use fallback"
);
assert(
  pickClientIp({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }) === "1.2.3.4",
  "prefer Cloudflare connecting IP"
);
assert(pickClientIp({}, "127.0.0.1") === "", "private-only yields empty");

console.log("ok client ip");
