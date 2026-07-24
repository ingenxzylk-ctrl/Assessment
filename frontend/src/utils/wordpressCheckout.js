import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { getCheckoutWooProductIds } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";
const CART_URL = `${WP_SITE_URL}/cart/`;

/** Match CartDrawer UI: missing/undefined means Health Mix is included. */
function wantsHealthMix(item) {
  return item?.includeHealthMix !== false;
}

/**
 * Build WooCommerce product IDs for checkout.
 * Re-resolve from bundleNumber so Health Mix 8303 is never dropped.
 */
function resolveCheckoutProductIds(item) {
  const includeHealthMix = wantsHealthMix(item);

  if (item?.bundleNumber) {
    const resolved = getCheckoutWooProductIds({
      bundleNumber: item.bundleNumber,
      hasDandruff: Boolean(item.hasDandruff),
      includeHealthMix,
      gender: item.gender || null,
    });
    if (resolved.kitId) {
      console.info("[zylk-checkout] v4-smooth-ux", {
        kitId: resolved.kitId,
        mixId: resolved.mixId,
        includeHealthMix,
        bundleNumber: item.bundleNumber,
        hasDandruff: Boolean(item.hasDandruff),
      });
      return resolved;
    }
  }

  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  if (!kitId) return { kitId: null, mixId: null, productIds: [] };

  const mixId =
    includeHealthMix && Number(item.wooHealthMixProductId)
      ? Number(item.wooHealthMixProductId)
      : includeHealthMix
        ? 8303
        : null;

  console.info("[zylk-checkout] v4-smooth-ux", { kitId, mixId, includeHealthMix });

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
        setTimeout(() => finish("load"), 900);
      };
    } catch {
      clearTimeout(timer);
      setTimeout(() => finish("error"), 1600);
    }
  });
}

/** Keep focus on the assessment UI so the shop tab does not steal attention. */
function refocusOpener() {
  try {
    window.focus();
  } catch {
    // ignore
  }
}

/**
 * Tiny helper window for top-level Woo add-to-cart (needed for SameSite cookies).
 * Kept small so the customer stays on the quiz UI with an in-app spinner.
 */
function openCheckoutHelper() {
  const features = "popup=yes,width=80,height=80,left=0,top=0,noopener=no";
  const popup = window.open("about:blank", "zylk_woo_add", features);
  if (!popup) return null;
  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Zylk</title></head>
<body style="margin:0;background:#064e3b;"></body></html>`);
    popup.document.close();
  } catch {
    // ignore
  }
  refocusOpener();
  return popup;
}

/**
 * Add kit then Health Mix via top-level navigations in a tiny helper window,
 * then send the MAIN window straight to /cart/ (no Woo “Adding ₹…” interstitial).
 */
async function addKitAndMixThenOpenCart(kitId, mixId, qty, popup, setStatus) {
  if (!popup || popup.closed) {
    alert(
      "Please allow popups for this site so Hair Health Mix can be added with your kit.\n\nOpening cart with the kit only for now."
    );
    window.location.href = cartWithAddUrl(kitId, qty);
    return false;
  }

  setStatus("Adding your kit…");
  refocusOpener();
  try {
    popup.location.href = addToCartUrl(kitId, qty);
  } catch {
    window.location.href = cartWithAddUrl(kitId, qty);
    return false;
  }

  await waitForPopupLoad(popup);
  await sleep(700);
  refocusOpener();

  if (popup.closed) {
    // Kit likely added — finish with a single cart add for mix
    setStatus("Opening your cart…");
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
    setStatus("Opening your cart…");
    window.location.href = cartWithAddUrl(mixId, 1);
    return true;
  }

  await waitForPopupLoad(popup);
  await sleep(700);

  try {
    if (!popup.closed) popup.close();
  } catch {
    // ignore
  }

  // Both products already in session — go straight to cart (no “Adding…” page)
  setStatus("Opening your cart…");
  window.location.href = CART_URL;
  return true;
}

/**
 * Redirect to WordPress cart while preserving quiz progress.
 * Main window stays on the assessment with spinner until the final cart open.
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

  // Open helper SYNCHRONOUSLY under the user gesture (before any await).
  const checkoutPopup = mixId ? openCheckoutHelper() : null;
  if (mixId && !checkoutPopup) {
    console.warn("[zylk-checkout] popup blocked — Health Mix may be missing");
  }

  setStatus(mixId ? "Adding kit + Hair Health Mix…" : "Opening your cart…");

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue
    }
  }
  markCheckoutReturn();

  // Kit only — one navigation to cart with add-to-cart
  if (!mixId) {
    window.location.href = cartWithAddUrl(kitId, qty);
    return;
  }

  try {
    await addKitAndMixThenOpenCart(kitId, mixId, qty, checkoutPopup, setStatus);
  } catch (err) {
    console.warn("Kit + Health Mix checkout failed:", err);
    try {
      if (checkoutPopup && !checkoutPopup.closed) checkoutPopup.close();
    } catch {
      // ignore
    }
    alert(
      "Could not add Hair Health Mix automatically. Opening cart with your kit — please add “Zylk Hair Health Mix” from the shop if it is missing."
    );
    window.location.href = cartWithAddUrl(kitId, qty);
  }
}
