import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { getCheckoutWooProductIds } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

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
      console.info("[zylk-checkout] v3-popup-mix", {
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

  console.info("[zylk-checkout] v3-popup-mix", { kitId, mixId, includeHealthMix });

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
        setTimeout(() => finish("load"), 1200);
      };
    } catch {
      clearTimeout(timer);
      setTimeout(() => finish("error"), 2000);
    }
  });
}

function writePopupPlaceholder(popup, message) {
  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Adding to cart…</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f7f7f5;color:#064e3b;">
  <p style="text-align:center;padding:1.5rem;font-size:1rem;line-height:1.5;">${message}</p>
</body></html>`);
    popup.document.close();
  } catch {
    // ignore
  }
}

/**
 * Woo cart cookies are SameSite=Lax — only top-level navigations can add items.
 * Store API / iframes from localhost or quiz.zylkhealth.com are blocked by CORS
 * and never update the shop session (that caused kit-only carts).
 */
async function addKitThenOpenCartWithMix(kitId, mixId, qty, popup, setStatus) {
  if (!popup || popup.closed) {
    alert(
      "Please allow popups for this site so Hair Health Mix can be added with your kit.\n\nOpening cart with the kit only for now."
    );
    window.location.href = cartWithAddUrl(kitId, qty);
    return false;
  }

  setStatus(`Adding kit ${kitId}…`);
  writePopupPlaceholder(popup, `Adding kit ${kitId} to cart…`);
  try {
    popup.location.href = addToCartUrl(kitId, qty);
  } catch {
    window.location.href = cartWithAddUrl(kitId, qty);
    return false;
  }

  await waitForPopupLoad(popup);
  await sleep(1000);

  if (popup.closed) {
    window.location.href = cartWithAddUrl(mixId, 1);
    return true;
  }

  setStatus(`Adding Hair Health Mix ${mixId}…`);
  writePopupPlaceholder(popup, `Adding Hair Health Mix (${mixId})…`);
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
  await sleep(1000);

  try {
    if (!popup.closed) popup.close();
  } catch {
    // ignore
  }

  setStatus("Opening your cart…");
  window.location.href = cartWithAddUrl(mixId, 1);
  return true;
}

/**
 * Redirect to WordPress cart while preserving quiz progress.
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

  // Open popup SYNCHRONOUSLY while we still have the user-gesture token.
  const checkoutPopup = mixId ? window.open("about:blank", "zylk_woo_add") : null;
  if (checkoutPopup) {
    writePopupPlaceholder(
      checkoutPopup,
      "Preparing checkout…<br/><span style='color:#666;font-size:0.875rem'>Adding kit + Hair Health Mix</span>"
    );
  } else if (mixId) {
    console.warn("[zylk-checkout] popup blocked — Health Mix may be missing");
  }

  setStatus(
    mixId
      ? `Adding kit ${kitId} + Hair Health Mix ${mixId}…`
      : "Preparing checkout…"
  );

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue
    }
  }
  markCheckoutReturn();

  if (!mixId) {
    window.location.href = cartWithAddUrl(kitId, qty);
    return;
  }

  try {
    await addKitThenOpenCartWithMix(kitId, mixId, qty, checkoutPopup, setStatus);
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
