import { parseIpLocationPayload } from "./ipLocation.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ipwho = parseIpLocationPayload({
  success: true,
  city: "Tirunelveli",
  region: "Tamil Nadu",
  country: "India",
  country_code: "IN",
  postal: "627001",
});
assert(ipwho.ok === true, "ipwho india");
assert(ipwho.city === "Tirunelveli", "ipwho city");
assert(ipwho.state === "Tamil Nadu", "ipwho state");
assert(ipwho.pincode === "", "never fill PIN from IP postal");
assert(ipwho.source === "ip", "source ip");

const ipapi = parseIpLocationPayload({
  city: "Chennai",
  region: "Tamil Nadu",
  country: "IN",
  country_name: "India",
  postal: "600001",
});
assert(ipapi.ok === true && ipapi.city === "Chennai", "ipapi india");
assert(ipapi.pincode === "", "ipapi postal ignored");

const ipApiCom = parseIpLocationPayload({
  status: "success",
  city: "Coimbatore",
  regionName: "Tamil Nadu",
  country: "India",
  countryCode: "IN",
});
assert(ipApiCom.ok === true && ipApiCom.city === "Coimbatore", "ip-api.com india");

assert(parseIpLocationPayload({ success: false }).ok === false, "ipwho fail");
assert(parseIpLocationPayload({ error: true }).reason === "not_found", "ipapi error");
assert(
  parseIpLocationPayload({ city: "London", country_code: "GB" }).reason === "outside_india",
  "reject non-India"
);
assert(parseIpLocationPayload({ country_code: "IN" }).reason === "not_found", "India with no place");

console.log("ok ip location parse");
