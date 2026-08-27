/** Sheet "Purchased" column. Clicked must never overwrite a paid/refunded row. */

export const PURCHASE_STATUS = {
  NO: "No",
  CLICKED: "Clicked",
  YES: "Yes",
  REFUNDED: "Refunded",
};

const RANK = {
  [PURCHASE_STATUS.NO]: 0,
  [PURCHASE_STATUS.CLICKED]: 1,
  [PURCHASE_STATUS.YES]: 2,
  [PURCHASE_STATUS.REFUNDED]: 2,
};

export function normalizePurchaseStatus(value) {
  const raw = String(value || "").trim();
  if (/^yes$/i.test(raw) || /^purchased$/i.test(raw) || /^paid$/i.test(raw)) {
    return PURCHASE_STATUS.YES;
  }
  if (/^clicked$/i.test(raw) || /^buy\s*now$/i.test(raw)) {
    return PURCHASE_STATUS.CLICKED;
  }
  if (/^refund/i.test(raw)) return PURCHASE_STATUS.REFUNDED;
  if (/^no$/i.test(raw) || raw === "") return PURCHASE_STATUS.NO;
  return raw;
}

export function mergePurchaseStatus(current, next) {
  const cur = normalizePurchaseStatus(current);
  const nxt = normalizePurchaseStatus(next);
  if (nxt === PURCHASE_STATUS.REFUNDED) {
    if (cur === PURCHASE_STATUS.YES || cur === PURCHASE_STATUS.REFUNDED) {
      return PURCHASE_STATUS.REFUNDED;
    }
    return cur || PURCHASE_STATUS.NO;
  }
  if ((RANK[nxt] ?? 0) >= (RANK[cur] ?? 0)) return nxt;
  return cur;
}

export function purchaseStatusFromWoo(orderStatus) {
  const s = String(orderStatus || "").toLowerCase();
  if (s === "completed" || s === "processing") return PURCHASE_STATUS.YES;
  if (s === "refunded") return PURCHASE_STATUS.REFUNDED;
  return null;
}

export function extractReportIdFromText(value) {
  const m = String(value || "").toUpperCase().match(/TR-\d{8}-\d+(?:-DUP\d+)?/);
  return m ? m[0] : null;
}

export function extractWooReportId(order = {}) {
  const metas = Array.isArray(order.meta_data) ? order.meta_data : [];
  for (const meta of metas) {
    const key = String(meta?.key || "").toLowerCase();
    if (
      key === "_zylk_report_id" ||
      key === "zylk_report" ||
      key === "zylk_report_id" ||
      key === "report"
    ) {
      const id = extractReportIdFromText(meta?.value);
      if (id) return id;
    }
  }
  return (
    extractReportIdFromText(order.customer_note) ||
    extractReportIdFromText(order.customer_note_contents) ||
    null
  );
}
