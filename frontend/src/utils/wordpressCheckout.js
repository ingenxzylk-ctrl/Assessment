import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { getCheckoutWooProductIds } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Build WooCommerce product IDs for checkout.
 * Re-resolve from bundleNumber so Health Mix 8303 is never dropped.
 */
function resolveCheckoutProductIds(item) {
  if (item?.bundleNumber) {
    const resolved = getCheckoutWooProductIds({
      bundleNumber: item.bundleNumber,
      hasDandruff: Boolean(item.hasDandruff),
      includeHealthMix: Boolean(item.includeHealthMix),
      gender: item.gender || null,
    });
    if (resolved.kitId) return resolved;
  }

  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  if (!kitId) return { kitId: null, mixId: null, productIds: [] };

  const mixId =
    Boolean(item.includeHealthMix) && Number(item.wooHealthMixProductId)
      ? Number(item.wooHealthMixProductId)
      : null;

  return {
    kitId,
    mixId,
    productIds: mixId ? [kitId, mixId] : [kitId],
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addToCartUrl(productId, quantity = 1) {
  return `${WP_SITE_URL}/?add-to-cart=${productId}&quantity=${quantity || 1}`;
}

function cartWithAddUrl(productId, quantity = 1) {
  return `${WP_SITE_URL}/cart/?add-to-cart=${productId}&quantity=${quantity || 1}`;
}

function waitForPopupLoad(popup, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      resolve(reason);
    };

    const timer = setTimeout(() => finish("timeout"), timeoutMs);

    try {
      popup.onload = () => {
        clearTimeout(timer);
        // Woo needs time to commit the cart cookie after each add
        setTimeout(() => finish("load"), 1200);
      };
    } catch {
      clearTimeout(timer);
      setTimeout(() => finish("error"), 2000);
    }
  });
}

/**
 * WooCommerce cart cookies are SameSite=Lax — only top-level navigations
 * (not iframes/fetch from quiz.zylkhealth.com) can add items to the shop session.
 *
 * Flow when Health Mix is included:
 *  1. Top-level popup adds the kit (8393)
 *  2. Same popup adds Health Mix (8303)
 *  3. Close popup
 *  4. Main window top-level navigates to /cart/?add-to-cart=8303 once
 *     (ensures mix is in the session even if popup cookies were flaky,
 *      and opens exactly one cart tab)
 */
async function addKitThenOpenCartWithMix(kitId, mixId, qty, setStatus) {
  setStatus("Adding your kit…");

  // Open synchronously under the user gesture whenever possible
  let popup = window.open(addToCartUrl(kitId, qty), "zylk_woo_add");

  if (!popup || popup.closed) {
    const retry = window.confirm(
      "Your browser blocked the checkout window.\n\nClick OK to open it so we can add the kit and Hair Health Mix."
    );
    if (!retry) return false;
    popup = window.open(addToCartUrl(kitId, qty), "zylk_woo_add");
  }

  if (!popup || popup.closed) {
    // Last resort: at least add kit in this tab (mix cannot be chained without a helper)
    alert(
      "Please allow popups for this site so Hair Health Mix can be added with your kit.\n\nOpening cart with the kit only for now."
    );
    window.location.href = cartWithAddUrl(kitId, qty);
    return false;
  }

  await waitForPopupLoad(popup);
  await sleep(800);

  if (popup.closed) {
    // Kit may still have been added — finish with mix on the main tab
    window.location.href = cartWithAddUrl(mixId, 1);
    return true;
  }

  setStatus("Adding Hair Health Mix…");
  try {
    popup.location.href = addToCartUrl(mixId, 1);
  } catch {
    try {
      popup.close();
    } catch {
      // ignore
    }
    window.location.href = cartWithAddUrl(mixId, 1);
    return true;
  }

  await waitForPopupLoad(popup);
  await sleep(800);

  try {
    if (!popup.closed) popup.close();
  } catch {
    // ignore
  }

  setStatus("Opening your cart…");
  // Top-level main navigation: adds/ensures Health Mix + shows cart (one tab)
  window.location.href = cartWithAddUrl(mixId, 1);
  return true;
}

/**
 * Redirect to WordPress cart while preserving quiz progress.
 * Kit-only: one same-tab redirect.
 * Kit + Health Mix 8303: top-level adds (required for Woo cookies), then one cart tab.
 */
export async function redirectToWordPressCheckout(cartItems, quizState, options = {}) {
  if (!cartItems?.length) return;

  const { onStatus } = options;
  const setStatus = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  const item = cartItems[0];
  const { kitId, mixId, productIds } = resolveCheckoutProductIds(item);

  if (!kitId || !productIds.length) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = item.quantity || 1;

  setStatus(
    mixId
      ? `Adding kit ${kitId} + Hair Health Mix ${mixId}…`
      : "Preparing checkout…"
  );

  // Persist BEFORE any navigation / popup work
  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue
    }
  }
  markCheckoutReturn();

  // Single product — one same-tab redirect
  if (!mixId) {
    window.location.href = cartWithAddUrl(kitId, qty);
    return;
  }

  // Kit + Health Mix
  try {
    await addKitThenOpenCartWithMix(kitId, mixId, qty, setStatus);
  } catch (err) {
    console.warn("Kit + Health Mix checkout failed:", err);
    alert(
      "Could not add Hair Health Mix automatically. Opening cart with your kit — please add “Zylk Hair Health Mix” from the shop if it is missing."
    );
    window.location.href = cartWithAddUrl(kitId, qty);
  }
}
