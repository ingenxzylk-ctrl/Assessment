/**
 * WordPress / WooCommerce checkout redirect — DISABLED.
 * Quiz no longer sends users to zylkhealth.com/cart.
 * Kept as a no-op so any leftover imports do not break the build.
 */
export async function redirectToWordPressCheckout() {
  console.info(
    "[zylk-checkout] WordPress cart redirect is disabled — staying in the quiz app"
  );
  return false;
}
