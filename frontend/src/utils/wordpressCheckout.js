import { markCheckoutReturn, persistQuizStateNow } from "../context/QuizContext";
import { saveScalpImagesToIdb } from "./quizImageStore";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Build WooCommerce add-to-cart URL.
 * Special kits (8393 / 8368) may also add Health Mix product 8303 when checked.
 */
function buildCartUrl(cartItems) {
  if (!cartItems?.length) return null;

  const item = cartItems[0];
  const productId = item.wooProductId;
  if (!productId) return null;

  const qty = item.quantity || 1;
  const mixId = item.wooHealthMixProductId || null;

  // Kit + optional separate Health Mix (8303) for no-mix dandruff kits only
  if (mixId) {
    // WooCommerce multi-product URL (comma-separated product IDs)
    return `${WP_SITE_URL}/cart/?add-to-cart=${productId},${mixId}&quantity=${qty},1`;
  }

  return `${WP_SITE_URL}/cart/?add-to-cart=${productId}&quantity=${qty}`;
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
