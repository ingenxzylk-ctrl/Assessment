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

function addToCartUrl(productId, quantity = 1) {
  return `${WP_SITE_URL}/?add-to-cart=${productId}&quantity=${quantity || 1}`;
}

/**
 * Same-site no-cors GETs can set classic Woo session cookies without opening tabs.
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
 * Use ONE helper popup only to hit add-to-cart URLs, then close it and
 * navigate the main window to /cart/ once (never open cart in two tabs).
 */
async function addProductsViaHelperPopup(productIds, qty, popup) {
  if (!popup || popup.closed) throw new Error("Checkout popup unavailable");

  writePopupPlaceholder(
    popup,
    `Adding products to cart…<br/><span style='color:#666;font-size:0.875rem'>IDs: ${productIds.join(", ")}</span>`
  );

  for (let i = 0; i < productIds.length; i += 1) {
    if (popup.closed) throw new Error("Checkout popup closed");
    const id = productIds[i];
    const quantity = i === 0 ? qty || 1 : 1;
    popup.location.href = addToCartUrl(id, quantity);
    await waitForPopupLoad(popup);
    await sleep(900);
  }

  try {
    popup.close();
  } catch {
    // ignore
  }

  // Single tab: only the main window opens the cart
  window.location.href = `${WP_SITE_URL}/cart/`;
}

/**
 * Redirect to WordPress cart in a single browser tab.
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

  // Reserve one helper popup under the user gesture (closed before cart opens).
  const helperPopup = needsMultiAdd ? window.open("about:blank", "zylk_woo_add") : null;
  if (helperPopup) {
    writePopupPlaceholder(
      helperPopup,
      mixId
        ? `Adding kit ${kitId} + Health Mix ${mixId}…`
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

  // Single product → one navigation in this tab only
  if (!needsMultiAdd) {
    if (helperPopup && !helperPopup.closed) {
      try {
        helperPopup.close();
      } catch {
        // ignore
      }
    }
    window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
    return;
  }

  // Prefer cookie-based adds with no extra tabs, then open cart once here
  try {
    await addProductsViaNoCors(productIds, qty);
    if (helperPopup && !helperPopup.closed) {
      try {
        helperPopup.close();
      } catch {
        // ignore
      }
    }
    window.location.href = cartUrl;
    return;
  } catch (err) {
    console.warn("no-cors multi add failed:", err);
  }

  // Fallback: helper popup adds items, then we close it and open cart in THIS tab only
  if (helperPopup && !helperPopup.closed) {
    try {
      await addProductsViaHelperPopup(productIds, qty, helperPopup);
      return;
    } catch (err) {
      console.warn("Helper popup add failed:", err);
      try {
        if (!helperPopup.closed) helperPopup.close();
      } catch {
        // ignore
      }
    }
  }

  const retry = window.confirm(
    `Click OK to add both products, then open your cart in this tab:\n• Kit ${kitId}\n• Health Mix ${mixId}`
  );
  if (retry) {
    const popup = window.open("about:blank", "zylk_woo_add");
    if (popup) {
      try {
        await addProductsViaHelperPopup(productIds, qty, popup);
        return;
      } catch (err) {
        console.warn("Retry helper popup failed:", err);
        try {
          popup.close();
        } catch {
          // ignore
        }
      }
    }
  }

  alert(
    "Please allow popups briefly so we can add both products, then your cart will open in this tab."
  );
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
}
