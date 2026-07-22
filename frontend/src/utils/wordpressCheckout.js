import { markCheckoutReturn, persistQuizStateNow } from "../context/QuizContext";
import { saveScalpImagesToIdb } from "./quizImageStore";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Redirect to WordPress cart while preserving quiz progress locally,
 * so browser back / return lands on the same quiz step (usually Result).
 */
export async function redirectToWordPressCheckout(cartItems, quizState) {
  if (!cartItems?.length) return;

  const item = cartItems[0];
  const productId = item.wooProductId;
  if (!productId) {
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

  const qty = item.quantity || 1;
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${productId}&quantity=${qty}`;
}
