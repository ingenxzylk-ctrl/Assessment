import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import {
  getCheckoutWooProductIds,
  STAGE_KIT_WOO_IDS,
  TEST_BUNDLE_NUMBER,
  BUNDLE_CONFIG,
} from "../config/bundles";

const WP_SITE_URL = (
  import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com"
).replace(/\/$/, "");

/**
 * Mobile-safe, CPU-safe checkout for WooCommerce Blocks:
 *
 *   ONE same-tab navigation → /checkout-link/?products=KIT[:QTY]
 *
 * Why checkout-link (not /checkout/?add-to-cart=)?
 * - The storefront checkout is Woo Blocks + Store API.
 * - Plain add-to-cart can set a PHP cookie while Blocks still shows an
 *   empty cart → theme sends you to /cart/ ("Your cart is currently empty!").
 * - checkout-link creates a Store API session and redirects to
 *   /checkout/?session=… with the kit already in the cart.
 *
 * Why not popups / iframes / /cart/?add-to-cart=?
 * - Mobile blocks window.open ("pop-ups blocked").
 * - /cart/?add-to-cart= caused CPU spikes on the theme.
 *
 * Single kit SKUs: 8588 / 8594–8597 / 8590 / 8327 / 8838 (+ test kit).
 */
const CHECKOUT_LINK_URL = `${WP_SITE_URL}/checkout-link/`;
const CHECKOUT_VERSION = "v10-checkout-link-blocks";

const TEST_KIT_ID = Number(BUNDLE_CONFIG[TEST_BUNDLE_NUMBER]?.wooProductId) || 8363;
const ALLOWED_KIT_IDS = new Set([...STAGE_KIT_WOO_IDS, TEST_KIT_ID]);

function resolveKitId(item) {
  if (item?.bundleNumber) {
    const resolved = getCheckoutWooProductIds({
      bundleNumber: item.bundleNumber,
      hasDandruff: Boolean(item.hasDandruff),
      includeHealthMix: false,
      gender: item.gender || null,
    });
    if (resolved.kitId) {
      console.info(`[zylk-checkout] ${CHECKOUT_VERSION}`, {
        kitId: resolved.kitId,
        bundleNumber: item.bundleNumber,
      });
      return Number(resolved.kitId);
    }
  }

  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  console.info(`[zylk-checkout] ${CHECKOUT_VERSION}`, { kitId });
  return kitId;
}

/** Build the Woo shareable checkout URL for one kit. */
export function buildCheckoutLinkUrl(kitId, quantity = 1, extras = {}) {
  const id = Number(kitId);
  const qty = Math.max(1, Number(quantity) || 1);
  const products = qty > 1 ? `${id}:${qty}` : String(id);
  const url = new URL(CHECKOUT_LINK_URL);
  url.searchParams.set("products", products);
  const reportId = String(extras.reportId || "").trim();
  if (reportId) url.searchParams.set("zylk_report", reportId);
  const phone = String(extras.phone || "").replace(/\D/g, "");
  if (phone) url.searchParams.set("zylk_phone", phone.slice(-10));
  return url.toString();
}

/**
 * Persist quiz state quickly, then leave this tab for Woo checkout.
 * Navigation is intentionally not gated on IndexedDB photo save.
 */
export async function redirectToWordPressCheckout(cartItems, quizState, options = {}) {
  if (!cartItems?.length) return;

  const { onStatus } = options;
  const setStatus = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  const item = cartItems[0];
  const kitId = resolveKitId(item);

  if (!kitId || !ALLOWED_KIT_IDS.has(Number(kitId))) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = Math.max(1, Number(item.quantity) || 1);
  setStatus("Opening checkout…");

  if (quizState) {
    persistQuizStateNow(quizState);
    // Fire-and-forget — do not await (keeps navigation inside the click gesture)
    saveScalpImagesToIdb(quizState.scalpImages).catch(() => {});
  }
  markCheckoutReturn();

  const reportId =
    options.reportId || quizState?.archivedReportId || quizState?.reportId || "";
  const phone =
    options.phone ||
    quizState?.aboutMe?.whatsapp ||
    quizState?.aboutMe?.phone ||
    "";
  const url = buildCheckoutLinkUrl(kitId, qty, { reportId, phone });
  console.info(`[zylk-checkout] ${CHECKOUT_VERSION} navigate`, { url });
  window.location.assign(url);
}
