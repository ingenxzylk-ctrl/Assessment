import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { SEPARATE_HEALTH_MIX_WOO_ID } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Resolve checkout product IDs.
 * Only the two no-mix dandruff kits (8393 / 8368) may also add Health Mix 8303.
 * All other bundles use a single with/without-mix Woo product ID.
 */
function resolveCheckoutProductIds(item) {
  const kitId = item?.wooProductId;
  if (!kitId) return { kitId: null, mixId: null };

  const wantsSeparateMix =
    Boolean(item.usesSeparateHealthMix) &&
    Boolean(item.includeHealthMix) &&
    // Guard: never attach 8303 unless this cart line is one of the special kits
    (Number(kitId) === 8393 || Number(kitId) === 8368);

  const mixId = wantsSeparateMix
    ? Number(item.wooHealthMixProductId) || SEPARATE_HEALTH_MIX_WOO_ID
    : null;

  return { kitId, mixId };
}

/**
 * Build WooCommerce add-to-cart URL.
 * Special kits (8393 / 8368) may also add Health Mix product 8303 when checked.
 */
function buildCartUrl(cartItems) {
  if (!cartItems?.length) return null;

  const item = cartItems[0];
  const { kitId, mixId } = resolveCheckoutProductIds(item);
  if (!kitId) return null;

  const qty = item.quantity || 1;

  if (mixId) {
    // Kit + separate Health Mix (8303) — comma-separated multi-add URL
    return `${WP_SITE_URL}/cart/?add-to-cart=${kitId},${mixId}&quantity=${qty},1`;
  }

  return `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
}

/**
 * Redirect to WordPress cart while preserving quiz progress locally,
 * so browser back / return lands on the same quiz step (usually Result).
 */
export async function redirectToWordPressCheckout(cartItems, quizState) {
  if (!cartItems?.length) return;

  const url = buildCartUrl(cartItems);
  if (!url) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  if (quizState) {
    persistQuizStateNow(quizState);
    // Ensure photos are flushed to IndexedDB before leaving the page
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue — quiz answers still in localStorage
    }
  }
  markCheckoutReturn();

  window.location.href = url;
}
