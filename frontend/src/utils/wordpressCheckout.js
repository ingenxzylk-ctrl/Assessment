const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

export function redirectToWordPressCheckout(cartItems) {
  if (!cartItems?.length) return;

  const item = cartItems[0];
  const productId = item.wooProductId;
  if (!productId) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = item.quantity || 1;
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${productId}&quantity=${qty}`;
}