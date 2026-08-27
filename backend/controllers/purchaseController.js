import crypto from "crypto";
import {
  updateLeadPurchase,
  isSheetsConfigured,
} from "../services/googleSheetsService.js";
import { isValidReportId } from "../services/reportIdService.js";
import {
  extractReportIdFromText,
  extractWooReportId,
  mergePurchaseStatus,
  purchaseStatusFromWoo,
  PURCHASE_STATUS,
} from "../utils/purchaseStatus.js";
import { normalizeLocalPhone } from "../utils/phone.js";

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyWooRequest(req) {
  const secret = String(process.env.WOO_WEBHOOK_SECRET || "").trim();
  const token = String(process.env.WOO_WEBHOOK_TOKEN || "").trim();
  if (!secret && !token) {
    return {
      ok: false,
      status: 503,
      error: "Set WOO_WEBHOOK_SECRET or WOO_WEBHOOK_TOKEN on the API.",
    };
  }
  if (token) {
    const provided =
      req.query?.token ||
      req.get("x-zylk-webhook-token") ||
      "";
    if (safeEqual(provided, token)) return { ok: true };
  }
  if (secret) {
    const signature = req.get("x-wc-webhook-signature") || "";
    const raw = req.rawBody;
    if (!raw || !signature) {
      return { ok: false, status: 401, error: "Missing WooCommerce webhook signature." };
    }
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("base64");
    if (safeEqual(expected, signature)) return { ok: true };
    return { ok: false, status: 401, error: "Invalid WooCommerce webhook signature." };
  }
  return { ok: false, status: 401, error: "Unauthorized webhook." };
}

function billingPhone(order = {}) {
  return (
    order.billing?.phone ||
    order.billing?.Phone ||
    order.customer?.phone ||
    ""
  );
}

function billingEmail(order = {}) {
  return order.billing?.email || order.customer?.email || "";
}

/**
 * Quiz tapped Buy Now — mark Purchased=Clicked. Not a payment.
 * POST /api/report/:reportId/checkout-click
 */
export async function markCheckoutClick(req, res) {
  const reportId = String(req.params.reportId || req.body?.reportId || "")
    .trim()
    .toUpperCase();
  if (!isValidReportId(reportId) && !extractReportIdFromText(reportId)) {
    return res.status(400).json({ ok: false, error: "Valid reportId is required." });
  }
  if (!isSheetsConfigured()) {
    return res.json({
      ok: true,
      skipped: true,
      reason: "sheets_not_configured",
      purchased: PURCHASE_STATUS.CLICKED,
    });
  }

  const aboutMe = req.body?.aboutMe || {};
  const result = await updateLeadPurchase({
    reportId,
    phone:
      aboutMe.whatsapp ||
      aboutMe.phone ||
      req.body?.phone ||
      "",
    email: aboutMe.email || req.body?.email || "",
    purchased: PURCHASE_STATUS.CLICKED,
  });

  if (result.error === "lead_row_not_found") {
    return res.json({
      ok: true,
      skipped: true,
      reason: "lead_row_not_found",
      reportId,
      purchased: PURCHASE_STATUS.CLICKED,
    });
  }
  if (result.ok === false && !result.skipped) {
    return res.status(500).json({ ok: false, ...result });
  }
  return res.json({
    ok: true,
    reportId,
    purchased: result.purchased || PURCHASE_STATUS.CLICKED,
    ...result,
  });
}

/**
 * WooCommerce order webhook. Updates Purchased=Yes / Refunded.
 * POST /api/webhooks/woocommerce
 */
export async function handleWooCommerceWebhook(req, res) {
  const auth = verifyWooRequest(req);
  if (!auth.ok) {
    return res.status(auth.status || 401).json({ ok: false, error: auth.error });
  }

  const order = req.body && typeof req.body === "object" ? req.body : {};
  const topic = String(req.get("x-wc-webhook-topic") || "").toLowerCase();
  const status = purchaseStatusFromWoo(order.status);
  if (!status) {
    return res.json({
      ok: true,
      skipped: true,
      reason: "ignored_status",
      orderStatus: order.status || null,
      topic: topic || null,
    });
  }

  const reportId =
    extractWooReportId(order) ||
    extractReportIdFromText(req.query?.report) ||
    null;
  const phone = normalizeLocalPhone(billingPhone(order), "+91") || billingPhone(order);
  const email = String(billingEmail(order) || "").trim();
  const orderId = order.id != null ? String(order.id) : "";

  if (!reportId && !phone && !email) {
    return res.json({
      ok: true,
      skipped: true,
      reason: "no_identity",
      orderId,
    });
  }

  if (!isSheetsConfigured()) {
    return res.json({
      ok: true,
      skipped: true,
      reason: "sheets_not_configured",
      purchased: status,
      orderId,
    });
  }

  const result = await updateLeadPurchase({
    reportId,
    phone,
    email,
    purchased: mergePurchaseStatus(null, status),
    orderId,
  });

  if (result.error === "lead_row_not_found") {
    return res.json({
      ok: true,
      skipped: true,
      reason: "lead_row_not_found",
      reportId,
      orderId,
      purchased: status,
    });
  }
  if (result.ok === false && !result.skipped) {
    return res.status(500).json({ ok: false, ...result });
  }
  return res.json({
    ok: true,
    purchased: result.purchased || status,
    orderId,
    reportId: result.reportId || reportId,
    rowNumber: result.rowNumber || null,
  });
}
