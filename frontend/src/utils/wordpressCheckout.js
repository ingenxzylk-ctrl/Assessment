import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { SEPARATE_HEALTH_MIX_WOO_ID } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Resolve checkout product IDs.
 * Male kit 8393 may also add Health Mix 8303.
 * All other bundles (including female) use a single with/without-mix Woo product ID.
 */
function resolveCheckoutProductIds(item) {
  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  if (!kitId) return { kitId: null, mixId: null };

  const wantsSeparateMix =
    Boolean(item.usesSeparateHealthMix) &&
    Boolean(item.includeHealthMix) &&
    item.gender === "male" &&
    kitId === 8393;

  const mixId = wantsSeparateMix
    ? Number(item.wooHealthMixProductId) || SEPARATE_HEALTH_MIX_WOO_ID
    : null;

  return { kitId, mixId };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForPopupLoad(popup, timeoutMs = 12000) {
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
        // Let WooCommerce commit the session cookie before the next hop.
        setTimeout(() => finish("load"), 500);
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
    // Cross-origin or closed — ignore.
  }
}

/**
 * Classic WooCommerce only accepts one ?add-to-cart= ID per request.
 * Cross-origin fetch/Store API cannot set the shop session from the assessment
 * app (CORS Access-Control-Allow-Origin is empty on zylkhealth.com).
 *
 * Drive kit → Health Mix → /cart/ via top-level navigations in a popup opened
 * under the user gesture; the main window then opens the same cart (shared cookies).
 */
async function addKitAndHealthMixViaNavigation(kitId, mixId, qty, popup) {
  const kitUrl = `${WP_SITE_URL}/?add-to-cart=${kitId}&quantity=${qty || 1}`;
  const mixUrl = `${WP_SITE_URL}/?add-to-cart=${mixId}&quantity=1`;
  const cartUrl = `${WP_SITE_URL}/cart/`;

  if (!popup || popup.closed) {
    throw new Error("Checkout popup unavailable");
  }

  writePopupPlaceholder(
    popup,
    "Adding your kit and Hair Health Mix to cart…<br/><span style='color:#666;font-size:0.875rem'>This window will close automatically.</span>"
  );

  popup.location.href = kitUrl;
  await waitForPopupLoad(popup);

  if (popup.closed) throw new Error("Checkout popup closed");

  popup.location.href = mixUrl;
  await waitForPopupLoad(popup);

  if (!popup.closed) {
    try {
      popup.location.href = cartUrl;
    } catch {
      // ignore
    }
  }

  // Shared cookie jar with the popup — both line items should be present.
  window.location.href = cartUrl;
}

/**
 * If the first window.open was blocked, ask again under a fresh user gesture.
 */
async function addKitAndHealthMixWithPopupRetry(kitId, mixId, qty, existingPopup) {
  let popup = existingPopup && !existingPopup.closed ? existingPopup : null;

  if (!popup) {
    popup = window.open("about:blank", "zylk_woo_add");
  }

  if (!popup || popup.closed) {
    const retry = window.confirm(
      "Your browser blocked the checkout window.\n\nClick OK to open it so we can add both the kit and Hair Health Mix to your cart."
    );
    if (!retry) return false;
    popup = window.open("about:blank", "zylk_woo_add");
  }

  if (!popup || popup.closed) {
    alert(
      "Please allow popups for this site, then try checkout again so both the kit and Hair Health Mix can be added."
    );
    return false;
  }

  await addKitAndHealthMixViaNavigation(kitId, mixId, qty, popup);
  return true;
}

/**
 * Redirect to WordPress cart while preserving quiz progress locally,
 * so browser back / return lands on the same quiz step (usually Result).
 *
 * For male kit 8393 with Health Mix checked, adds product 8303 as a
 * second line item (Woo does not accept comma-separated add-to-cart IDs).
 */
export async function redirectToWordPressCheckout(cartItems, quizState) {
  if (!cartItems?.length) return;

  const item = cartItems[0];
  const { kitId, mixId } = resolveCheckoutProductIds(item);
  if (!kitId) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = item.quantity || 1;

  // Open the popup synchronously while we still have the user-gesture token.
  // Any await before window.open will cause browsers to block it.
  const checkoutPopup = mixId ? window.open("about:blank", "zylk_woo_add") : null;
  if (checkoutPopup) {
    writePopupPlaceholder(
      checkoutPopup,
      "Preparing checkout…<br/><span style='color:#666;font-size:0.875rem'>Adding kit + Hair Health Mix</span>"
    );
  }

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue — quiz answers still in localStorage
    }
  }
  markCheckoutReturn();

  // Multi-product path (kit + Health Mix 8303)
  if (mixId) {
    try {
      const ok = await addKitAndHealthMixWithPopupRetry(kitId, mixId, qty, checkoutPopup);
      if (!ok) return;
      // Brief pause so the location change can start before this function returns.
      await sleep(100);
      return;
    } catch (err) {
      console.warn("Multi-product cart add failed:", err);
      try {
        if (checkoutPopup && !checkoutPopup.closed) checkoutPopup.close();
      } catch {
        // ignore
      }
      alert(
        "Could not add both products automatically. Please allow popups and try again, or add “Zylk Hair Health Mix” from the shop after the kit is in your cart."
      );
      window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
      return;
    }
  }

  // Single product (all other bundles / mix unchecked)
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
}
