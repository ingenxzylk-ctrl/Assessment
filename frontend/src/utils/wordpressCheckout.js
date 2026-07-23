import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { SEPARATE_HEALTH_MIX_WOO_ID } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";

/**
 * Resolve checkout product IDs.
 *
 * Bundle-5 without dandruff: single Woo ID 8315 / 8325.
 * Bundle-5 with dandruff: kit 8393, and if Health Mix is checked → also 8303.
 */
function resolveCheckoutProductIds(item) {
  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  if (!kitId) return { kitId: null, mixId: null };

  // Kit 8393 never includes Health Mix — optional add-on is always product 8303
  const wantsMix = Boolean(item.includeHealthMix);
  const mixId =
    wantsMix && kitId === 8393
      ? Number(item.wooHealthMixProductId) || SEPARATE_HEALTH_MIX_WOO_ID
      : null;

  return { kitId, mixId };
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
        // Let WooCommerce commit the session cookie before the next hop.
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
    // Cross-origin or closed — ignore.
  }
}

/**
 * Same-site no-cors GETs can still set classic Woo session cookies
 * (assessment.zylkhealth.com → zylkhealth.com). Opaque responses cannot be read.
 */
async function addItemsViaNoCors(kitId, mixId, qty) {
  const opts = {
    method: "GET",
    mode: "no-cors",
    credentials: "include",
    cache: "no-store",
  };
  await fetch(`${WP_SITE_URL}/?add-to-cart=${kitId}&quantity=${qty || 1}`, opts);
  if (mixId) {
    await sleep(500);
    await fetch(`${WP_SITE_URL}/?add-to-cart=${mixId}&quantity=1`, opts);
  }
}

/**
 * Classic WooCommerce only accepts one ?add-to-cart= ID per request.
 * Drive kit → Health Mix → /cart/ via top-level navigations in a popup.
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
    "Adding your kit and Hair Health Mix to cart…<br/><span style='color:#666;font-size:0.875rem'>Please keep this window open for a moment.</span>"
  );

  popup.location.href = kitUrl;
  await waitForPopupLoad(popup);
  await sleep(900);

  if (popup.closed) throw new Error("Checkout popup closed");

  popup.location.href = mixUrl;
  await waitForPopupLoad(popup);
  await sleep(900);

  if (!popup.closed) {
    try {
      popup.location.href = cartUrl;
    } catch {
      // ignore
    }
  }

  window.location.href = cartUrl;
}

async function addKitAndHealthMixViaParallelWindows(kitId, mixId, qty) {
  const kitUrl = `${WP_SITE_URL}/?add-to-cart=${kitId}&quantity=${qty || 1}`;
  const mixUrl = `${WP_SITE_URL}/?add-to-cart=${mixId}&quantity=1`;
  const cartUrl = `${WP_SITE_URL}/cart/`;

  const wKit = window.open(kitUrl, "zylk_add_kit");
  const wMix = window.open(mixUrl, "zylk_add_mix");
  if (!wKit && !wMix) {
    throw new Error("Popups blocked");
  }

  await sleep(3500);

  try {
    wKit?.close();
  } catch {
    // ignore
  }
  try {
    wMix?.close();
  } catch {
    // ignore
  }

  window.location.href = cartUrl;
}

/**
 * Redirect to WordPress cart while preserving quiz progress locally.
 * For kit 8393 with Health Mix checked, also adds product 8303.
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
  const cartUrl = `${WP_SITE_URL}/cart/`;

  // Open the popup synchronously while we still have the user-gesture token.
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

  // Multi-product path (kit 8393 + Health Mix 8303)
  if (mixId) {
    // 1) Preferred: sequential top-level navigations in the pre-opened popup
    if (checkoutPopup && !checkoutPopup.closed) {
      try {
        await addKitAndHealthMixViaNavigation(kitId, mixId, qty, checkoutPopup);
        return;
      } catch (err) {
        console.warn("Sequential popup cart add failed:", err);
        try {
          if (!checkoutPopup.closed) checkoutPopup.close();
        } catch {
          // ignore
        }
      }
    }

    // 2) Same-site no-cors cookie writes, then open cart
    try {
      await addItemsViaNoCors(kitId, mixId, qty);
      window.location.href = cartUrl;
      return;
    } catch (err) {
      console.warn("no-cors cart add failed:", err);
    }

    // 3) Parallel popups under a fresh confirm gesture
    const retry = window.confirm(
      "Click OK to open checkout windows so we can add both the dandruff kit (8393) and Hair Health Mix (8303)."
    );
    if (retry) {
      try {
        await addKitAndHealthMixViaParallelWindows(kitId, mixId, qty);
        return;
      } catch (err) {
        console.warn("Parallel popup cart add failed:", err);
      }
    }

    alert(
      "Please allow popups for this site, then try again so both the kit and Hair Health Mix can be added."
    );
    window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
    return;
  }

  // Single product (no separate Health Mix)
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
}
