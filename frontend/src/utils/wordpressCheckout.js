import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import {
  getCheckoutWooProductIds,
  STAGE_KIT_WOO_IDS,
  TEST_BUNDLE_NUMBER,
  BUNDLE_CONFIG,
} from "../config/bundles";

const WP_SITE_URL = (
  import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com"
).replace(/\/$/, "");

/**
 * CPU-safe checkout architecture:
 *   Quiz → Calculate Bundle → ONE AJAX add (single kit SKU) → Success → /checkout
 *
 * Never use /cart/?add-to-cart=… (full Woo page = CPU spike).
 * Kits are single products: 8588 / 8594–8597 / 8590 — no Health Mix line item.
 */
const CHECKOUT_URL = `${WP_SITE_URL}/checkout/`;
const WC_AJAX_ADD_URL = `${WP_SITE_URL}/?wc-ajax=add_to_cart`;
const CHECKOUT_VERSION = "v7-single-kit-ajax";

const TEST_KIT_ID = Number(BUNDLE_CONFIG[TEST_BUNDLE_NUMBER]?.wooProductId) || 8363;
const ALLOWED_KIT_IDS = new Set([...STAGE_KIT_WOO_IDS, TEST_KIT_ID]);

function resolveKitId(item) {
  if (item?.bundleNumber) {
    const resolved = getCheckoutWooProductIds({
      bundleNumber: item.bundleNumber,
      hasDandruff: Boolean(item.hasDandruff),
      includeHealthMix: false,
      gender: item.gender || null,
    });
    if (resolved.kitId) {
      console.info(`[zylk-checkout] ${CHECKOUT_VERSION}`, {
        kitId: resolved.kitId,
        bundleNumber: item.bundleNumber,
      });
      return Number(resolved.kitId);
    }
  }

  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  console.info(`[zylk-checkout] ${CHECKOUT_VERSION}`, { kitId });
  return kitId;
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
 * ONE wc-ajax add for the kit → ONE redirect to /checkout
 */
async function ajaxAddKitThenCheckout(kitId, quantity, setStatus) {
  const id = Number(kitId);
  if (!Number.isFinite(id) || id <= 0) return false;
  if (!ALLOWED_KIT_IDS.has(id)) {
    console.warn("[zylk-checkout] refusing unknown Woo product id:", id);
    return false;
  }

  setStatus("Adding your kit…");
  const popup = openFreshHelper();
  if (!popup) return false;

  refocusOpener();
  const submitted = submitWcAjaxAddInPopup(
    popup,
    id,
    Math.max(1, Number(quantity) || 1)
  );
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

  setStatus("Opening checkout…");
  window.location.href = CHECKOUT_URL;
  return true;
}

/**
 * Last resort when popups are blocked.
 * Does NOT use /cart/?add-to-cart= (CPU spike).
 * One soft homepage add, then /checkout once.
 */
function fallbackSingleAddThenCheckout(kitId, qty, setStatus) {
  setStatus("Adding your kit…");
  const url = `${WP_SITE_URL}/?add-to-cart=${kitId}&quantity=${Math.max(1, qty || 1)}`;
  const win = window.open(url, "zylk_woo_fallback");
  if (!win) {
    alert(
      "Please allow popups for quiz.zylkhealth.com so we can add your kit without overloading the store.\n\nThen tap Proceed to Checkout again."
    );
    return;
  }

  setTimeout(() => {
    try {
      if (!win.closed) win.close();
    } catch {
      // ignore
    }
    setStatus("Opening checkout…");
    window.location.href = CHECKOUT_URL;
  }, 1400);
}

/**
 * Quiz → Calculate Bundle → AJAX add (1 kit) → /checkout
 */
export async function redirectToWordPressCheckout(cartItems, quizState, options = {}) {
  if (!cartItems?.length) return;

  const { onStatus } = options;
  const setStatus = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  const item = cartItems[0];
  const kitId = resolveKitId(item);

  if (!kitId || !ALLOWED_KIT_IDS.has(Number(kitId))) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = item.quantity || 1;
  setStatus("Adding your kit…");

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
    const ok = await ajaxAddKitThenCheckout(kitId, qty, setStatus);
    if (ok) return;
    fallbackSingleAddThenCheckout(kitId, qty, setStatus);
  } catch (err) {
    console.warn("[zylk-checkout] AJAX checkout failed:", err);
    fallbackSingleAddThenCheckout(kitId, qty, setStatus);
  }
}
