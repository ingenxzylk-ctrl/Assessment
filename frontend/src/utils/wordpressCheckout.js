import { markCheckoutReturn, persistQuizStateNow } from "../context/QuizContext";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Redirect to WordPress cart while preserving quiz progress locally,
 * so browser back / return lands on the same quiz step (usually Result).
 */
export function redirectToWordPressCheckout(cartItems, quizState) {
  if (!cartItems?.length) return;

  const item = cartItems[0];
  const productId = item.wooProductId;
  if (!productId) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  if (quizState) {
    persistQuizStateNow(quizState);
  }
  markCheckoutReturn();

  const qty = item.quantity || 1;
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${productId}&quantity=${qty}`;
}
