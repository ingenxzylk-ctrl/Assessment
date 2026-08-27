import { normalizeIndianPincode } from "./pincode.js";
import { PURCHASE_STATUS } from "./purchaseStatus.js";

function cell(value) {
  if (value == null) return "";
  return String(value).trim();
}

export function formatKitName(reportMeta = {}) {
  const bundle = reportMeta.recommendedBundle || {};
  return cell(
    bundle.bundleTitle || bundle.name || bundle.bundleId || bundle.label || ""
  );
}

export function extraLeadCells({
  aboutMe = {},
  reportMeta = {},
  purchased = PURCHASE_STATUS.NO,
  orderId = "",
} = {}) {
  return [
    cell(normalizeIndianPincode(aboutMe.pincode) || aboutMe.pincode),
    cell(aboutMe.city),
    cell(aboutMe.state || aboutMe.region || aboutMe.addressState),
    formatKitName(reportMeta),
    cell(purchased) || PURCHASE_STATUS.NO,
    cell(orderId),
  ];
}
