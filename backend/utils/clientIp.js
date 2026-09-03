import net from "net";
const isIP = net.isIP || (() => 0);

export function normalizeClientIp(raw) {
  let ip = String(raw || "")
    .trim()
    .replace(/^\[|\]$/g, "");
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
  return ip;
}

export function isPrivateIp(ip) {
  const n = normalizeClientIp(ip);
  if (!n || !isIP(n)) return true;
  if (n === "127.0.0.1" || n === "::1") return true;
  if (n.startsWith("10.")) return true;
  if (n.startsWith("192.168.")) return true;
  if (n.startsWith("169.254.")) return true;
  const m = n.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  const lower = n.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80:")) return true;
  return false;
}

/** First public IP from proxy headers, then the socket address. */
export function pickClientIp(headers = {}, fallback = "") {
  const cf = headers["cf-connecting-ip"];
  const forwarded = String(headers["x-forwarded-for"] || "").split(",")[0];
  const real = headers["x-real-ip"];
  for (const candidate of [cf, forwarded, real, fallback]) {
    const ip = normalizeClientIp(candidate);
    if (ip && isIP(ip) && !isPrivateIp(ip)) return ip;
  }
  return "";
}
