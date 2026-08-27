import {
  mergePurchaseStatus,
  purchaseStatusFromWoo,
  extractWooReportId,
  extractReportIdFromText,
  PURCHASE_STATUS,
} from "./purchaseStatus.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(mergePurchaseStatus("No", "Clicked") === "Clicked", "click after no");
assert(mergePurchaseStatus("Clicked", "Yes") === "Yes", "paid after click");
assert(mergePurchaseStatus("Yes", "Clicked") === "Yes", "click must not overwrite paid");
assert(mergePurchaseStatus("Yes", "Refunded") === "Refunded", "refund after paid");
assert(mergePurchaseStatus("Clicked", "Refunded") === "Clicked", "refund ignored if never paid");
assert(purchaseStatusFromWoo("processing") === "Yes", "processing is purchase");
assert(purchaseStatusFromWoo("completed") === "Yes", "completed is purchase");
assert(purchaseStatusFromWoo("pending") === null, "pending ignored");
assert(extractReportIdFromText("see TR-20082026-07 please") === "TR-20082026-07", "extract id");
assert(
  extractWooReportId({
    meta_data: [{ key: "_zylk_report_id", value: "TR-20082026-07" }],
  }) === "TR-20082026-07",
  "woo meta"
);

console.log("ok purchase status");
