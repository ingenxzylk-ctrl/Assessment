import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { getCheckoutWooProductIds } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Build the WooCommerce product ID list for checkout from a cart line item.
 *
 * No dandruff Bundle-5: [8315] or [8325]
 * With dandruff Bundle-5: [8393] or [8393, 8303] when Include Health Mix is on
 */
function resolveCheckoutProductIds(item) {
  // Prefer live resolution from bundle + flags (source of truth = config)
  if (item?.bundleNumber) {
    const resolved = getCheckoutWooProductIds({
      bundleNumber: item.bundleNumber,
      hasDandruff: Boolean(item.hasDandruff),
      includeHealthMix: Boolean(item.includeHealthMix),
      gender: item.gender || null,
    });
    if (resolved.kitId) return resolved;
  }

  // Fallback for stale cart rows that already carry Woo IDs
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

function waitForPopupLoad(popup, timeoutMs = 4500) {
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
        setTimeout(() => finish("load"), 700);
      };
    } catch {
      clearTimeout(timer);
      finish("error");
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

/** Classic Woo only accepts one ?add-to-cart= ID per request. */
function addToCartUrl(productId, quantity = 1) {
  return `${WP_SITE_URL}/?add-to-cart=${productId}&quantity=${quantity || 1}`;
}

/**
 * Same-site no-cors GETs can still set classic Woo session cookies.
 * Adds each product ID in order: e.g. addToCart(8393) then addToCart(8303).
 */
async function addProductsViaNoCors(productIds, qty) {
  const opts = {
    method: "GET",
    mode: "no-cors",
    credentials: "include",
    cache: "no-store",
  };
  for (let i = 0; i < productIds.length; i += 1) {
    const id = productIds[i];
    const quantity = i === 0 ? qty || 1 : 1;
    await fetch(addToCartUrl(id, quantity), opts);
    if (i < productIds.length - 1) await sleep(500);
  }
}

/**
 * Drive sequential top-level navigations in a popup:
 *   addToCart(8393) → addToCart(8303) → /cart/
 */
async function addProductsViaPopupNavigation(productIds, qty, popup) {
  const cartUrl = `${WP_SITE_URL}/cart/`;
  if (!popup || popup.closed) throw new Error("Checkout popup unavailable");

  writePopupPlaceholder(
    popup,
    `Adding ${productIds.length} product${productIds.length > 1 ? "s" : ""} to cart…<br/><span style='color:#666;font-size:0.875rem'>IDs: ${productIds.join(", ")}</span>`
  );

  for (let i = 0; i < productIds.length; i += 1) {
    if (popup.closed) throw new Error("Checkout popup closed");
    const id = productIds[i];
    const quantity = i === 0 ? qty || 1 : 1;
    popup.location.href = addToCartUrl(id, quantity);
    await waitForPopupLoad(popup);
    await sleep(900);
  }

  if (!popup.closed) {
    try {
      popup.location.href = cartUrl;
    } catch {
      // ignore
    }
  }
  window.location.href = cartUrl;
}

/** Open one window per product under the same user gesture, then land on /cart/. */
async function addProductsViaParallelWindows(productIds, qty) {
  const cartUrl = `${WP_SITE_URL}/cart/`;
  const windows = productIds.map((id, i) => {
    const quantity = i === 0 ? qty || 1 : 1;
    return window.open(addToCartUrl(id, quantity), `zylk_add_${id}`);
  });

  if (windows.every((w) => !w)) throw new Error("Popups blocked");

  await sleep(3500);

  windows.forEach((w) => {
    try {
      w?.close();
    } catch {
      // ignore
    }
  });

  window.location.href = cartUrl;
}

/**
 * Redirect to WordPress cart.
 *
 * Dandruff Bundle-5 with Health Mix checked:
 *   addToCart(8393)
 *   addToCart(8303)   ← from config.healthMixProductId
 */
export async function redirectToWordPressCheckout(cartItems, quizState) {
  if (!cartItems?.length) return;

  const item = cartItems[0];
  const { kitId, mixId, productIds } = resolveCheckoutProductIds(item);

  if (!kitId || !productIds.length) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = item.quantity || 1;
  const cartUrl = `${WP_SITE_URL}/cart/`;
  const needsMultiAdd = productIds.length > 1;

  // Open popup synchronously while we still have the user-gesture token.
  const checkoutPopup = needsMultiAdd ? window.open("about:blank", "zylk_woo_add") : null;
  if (checkoutPopup) {
    writePopupPlaceholder(
      checkoutPopup,
      mixId
        ? `Preparing checkout…<br/><span style='color:#666;font-size:0.875rem'>Adding kit ${kitId} + Health Mix ${mixId}</span>`
        : "Preparing checkout…"
    );
  }

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue
    }
  }
  markCheckoutReturn();

  // Single product → one classic add-to-cart URL
  if (!needsMultiAdd) {
    window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
    return;
  }

  // Multi-product: addToCart(8393) then addToCart(8303)
  if (checkoutPopup && !checkoutPopup.closed) {
    try {
      await addProductsViaPopupNavigation(productIds, qty, checkoutPopup);
      return;
    } catch (err) {
      console.warn("Sequential popup add failed:", err);
      try {
        if (!checkoutPopup.closed) checkoutPopup.close();
      } catch {
        // ignore
      }
    }
  }

  try {
    await addProductsViaNoCors(productIds, qty);
    window.location.href = cartUrl;
    return;
  } catch (err) {
    console.warn("no-cors multi add failed:", err);
  }

  const retry = window.confirm(
    `Click OK to add both products to your cart:\n• Kit ${kitId}\n• Health Mix ${mixId}`
  );
  if (retry) {
    try {
      await addProductsViaParallelWindows(productIds, qty);
      return;
    } catch (err) {
      console.warn("Parallel popup add failed:", err);
    }
  }

  alert(
    "Please allow popups for this site, then try again so both the kit and Hair Health Mix can be added."
  );
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
}
