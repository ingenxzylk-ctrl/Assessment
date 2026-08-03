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
 * Mobile-safe, CPU-safe checkout:
 *
 *   ONE same-tab navigation → /checkout/?add-to-cart=KIT
 *
 * Why not popups / iframes?
 * - Mobile Chrome blocks window.open ("pop-ups blocked") and may return a
 *   fake window → we used to think add succeeded, then opened empty /checkout/
 *   which Woo redirects to an empty /cart/.
 * - Cross-origin iframes often never set the Woo session cookie.
 *
 * Why not /cart/?add-to-cart=?
 * - That path caused heavy CPU spikes on the storefront.
 *
 * Single kit SKUs only: 8588 / 8594–8597 / 8590 (+ test kit).
 */
const CHECKOUT_URL = `${WP_SITE_URL}/checkout/`;
const CHECKOUT_VERSION = "v9-mobile-direct-checkout";

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

/**
 * Quiz → add 1 kit → /checkout (same tab, no popup, no cart page).
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
  setStatus("Saving your assessment…");

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue — checkout must not block on photo cache
    }
  }
  markCheckoutReturn();

  // Same-tab first-party navigation: Woo adds the kit and opens checkout.
  // No window.open → no "pop-ups blocked". No /cart/ → no CPU spike.
  setStatus("Opening checkout…");
  const url = `${CHECKOUT_URL}?add-to-cart=${encodeURIComponent(kitId)}&quantity=${qty}`;
  console.info(`[zylk-checkout] ${CHECKOUT_VERSION} navigate`, { url });
  window.location.assign(url);
}
