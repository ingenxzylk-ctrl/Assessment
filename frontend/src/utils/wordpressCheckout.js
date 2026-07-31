import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { getCheckoutWooProductIds } from "../config/bundles";

const WP_SITE_URL = (
  import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com"
).replace(/\/$/, "");
/** Clean cart URL only — never /cart/?add-to-cart= (expensive full Woo page). */
const CART_URL = `${WP_SITE_URL}/cart/`;
/** Lightweight WooCommerce AJAX endpoint (JSON), not a full theme page. */
const WC_AJAX_ADD_URL = `${WP_SITE_URL}/?wc-ajax=add_to_cart`;

/** Match CartDrawer UI: missing/undefined means Health Mix is included. */
function wantsHealthMix(item) {
  return item?.includeHealthMix !== false;
}

/**
 * Build WooCommerce product IDs for checkout.
 * New stage kits are single SKUs (8588 / 8590 / 8594–8597) — mixId is usually null.
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
      console.info("[zylk-checkout] v5-ajax", {
        kitId: resolved.kitId,
        mixId: resolved.mixId,
        bundleNumber: item.bundleNumber,
      });
      return resolved;
    }
  }

  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  if (!kitId) return { kitId: null, mixId: null, productIds: [] };

  const mixId =
    includeHealthMix && Number(item.wooHealthMixProductId)
      ? Number(item.wooHealthMixProductId)
      : null;

  console.info("[zylk-checkout] v5-ajax", { kitId, mixId });

  return {
    kitId,
    mixId,
    productIds: mixId ? [kitId, mixId] : [kitId],
  };
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
        // Brief settle so Woo can write the cart cookie before we continue
        setTimeout(() => finish("load"), 500);
      };
    } catch {
      clearTimeout(timer);
      setTimeout(() => finish("error"), 1200);
    }
  });
}

function refocusOpener() {
  try {
    window.focus();
  } catch {
    // ignore
  }
}

/**
 * Tiny helper window. We submit a same-document form that POSTs to
 * WooCommerce `wc-ajax=add_to_cart` (top-level navigation → cart cookie set,
 * response is lightweight JSON — not a full /cart/ PHP render).
 */
function openCheckoutHelper() {
  const features = "popup=yes,width=120,height=120,left=0,top=0,noopener=no";
  const popup = window.open("about:blank", "zylk_woo_ajax_add", features);
  if (!popup) return null;
  try {
    popup.document.open();
    popup.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Zylk</title></head>
<body style="margin:0;background:#064e3b;color:#fff;font:12px system-ui;display:flex;align-items:center;justify-content:center;height:100vh;">
Adding…
</body></html>`);
    popup.document.close();
  } catch {
    // ignore
  }
  refocusOpener();
  return popup;
}

/**
 * POST product_id to Woo `/?wc-ajax=add_to_cart` via form in the helper window.
 * Must run while popup is still same-origin (about:blank) so we can write the form.
 */
function submitWcAjaxAddInPopup(popup, productId, quantity = 1) {
  if (!popup || popup.closed) return false;
  try {
    const doc = popup.document;
    const form = doc.createElement("form");
    form.method = "POST";
    form.action = WC_AJAX_ADD_URL;
    form.acceptCharset = "UTF-8";

    const fields = {
      product_id: String(productId),
      quantity: String(Math.max(1, Number(quantity) || 1)),
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = doc.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }

    doc.body.appendChild(form);
    form.submit();
    return true;
  } catch (err) {
    console.warn("[zylk-checkout] ajax form submit failed:", err);
    return false;
  }
}

/**
 * After a wc-ajax POST the popup is cross-origin — open a fresh about:blank
 * helper for the next product add.
 */
function openFreshHelper() {
  try {
    const existing = window.open("", "zylk_woo_ajax_add");
    if (existing && !existing.closed) {
      try {
        existing.close();
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return openCheckoutHelper();
}

/**
 * Phase 1 checkout:
 *   AJAX add kit → (optional AJAX add mix) → ONE redirect to /cart/
 * Never uses /cart/?add-to-cart= (that pattern was driving ~80% of expensive hits).
 */
async function ajaxAddProductsThenOpenCart(productIds, quantities, setStatus) {
  const ids = (Array.isArray(productIds) ? productIds : []).filter(
    (id) => Number.isFinite(Number(id)) && Number(id) > 0
  );
  if (!ids.length) return false;

  for (let i = 0; i < ids.length; i += 1) {
    const productId = Number(ids[i]);
    const qty = Math.max(1, Number(quantities?.[i]) || 1);
    const label =
      ids.length > 1 && i === 0
        ? "Adding your kit…"
        : ids.length > 1 && i > 0
          ? "Adding extras…"
          : "Adding to cart…";
    setStatus(label);

    const popup = openFreshHelper();
    if (!popup) {
      console.warn("[zylk-checkout] popup blocked — cannot AJAX-add without it");
      return false;
    }

    refocusOpener();
    const submitted = submitWcAjaxAddInPopup(popup, productId, qty);
    if (!submitted) {
      try {
        popup.close();
      } catch {
        // ignore
      }
      return false;
    }

    await waitForPopupLoad(popup);
    await sleep(400);
    refocusOpener();

    try {
      if (!popup.closed) popup.close();
    } catch {
      // ignore
    }
  }

  setStatus("Opening your cart…");
  window.location.href = CART_URL;
  return true;
}

/**
 * Last-resort fallback when popups are blocked.
 * Uses homepage `/?add-to-cart=` (NOT /cart/?add-to-cart=) then a delayed
 * navigation to clean /cart/. Still heavier than AJAX, but avoids the worst URL.
 */
function fallbackHomepageAddThenCart(kitId, qty, mixId, setStatus) {
  setStatus("Adding to cart…");
  const first = `${WP_SITE_URL}/?add-to-cart=${kitId}&quantity=${Math.max(1, qty || 1)}`;

  // Open add in a named window if possible; otherwise navigate main (leaves quiz).
  const win = window.open(first, "zylk_woo_fallback");
  if (!win) {
    alert(
      "Please allow popups for this site so we can add your kit without overloading the store.\n\nOpening the cart page now — use Buy on the product page if the kit is missing."
    );
    window.location.href = CART_URL;
    return;
  }

  // After homepage add settles, send MAIN window once to clean /cart/
  setTimeout(() => {
    try {
      if (!win.closed) win.close();
    } catch {
      // ignore
    }
    setStatus("Opening your cart…");
    window.location.href = CART_URL;
  }, mixId ? 2200 : 1400);
}

/**
 * Redirect to WordPress cart while preserving quiz progress.
 * Main window stays on the assessment with spinner until the final clean /cart/ open.
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
  const ids = mixId ? [kitId, mixId] : [kitId];
  const quantities = mixId ? [qty, 1] : [qty];

  setStatus(mixId ? "Adding kit + extras…" : "Adding your kit…");

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue
    }
  }
  markCheckoutReturn();

  try {
    const ok = await ajaxAddProductsThenOpenCart(ids, quantities, setStatus);
    if (ok) return;

    // Popup blocked or AJAX form failed
    fallbackHomepageAddThenCart(kitId, qty, mixId, setStatus);
  } catch (err) {
    console.warn("[zylk-checkout] AJAX checkout failed:", err);
    fallbackHomepageAddThenCart(kitId, qty, mixId, setStatus);
  }
}
