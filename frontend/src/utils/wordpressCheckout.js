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
 * CPU-safe checkout (works with popups blocked):
 *   1) Prefer tiny popup → wc-ajax=add_to_cart → /checkout
 *   2) Else hidden iframe → same wc-ajax add → /checkout
 *   3) Else ONE main-window trip: /checkout/?add-to-cart=KIT
 *
 * Never use /cart/?add-to-cart= (CPU spike).
 * Single kit SKUs only: 8588 / 8594–8597 / 8590.
 */
const CHECKOUT_URL = `${WP_SITE_URL}/checkout/`;
const WC_AJAX_ADD_URL = `${WP_SITE_URL}/?wc-ajax=add_to_cart`;
const CHECKOUT_VERSION = "v8-no-popup-fallback";

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

function waitForWindowLoad(win, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      resolve(reason);
    };

    const timer = setTimeout(() => finish("timeout"), timeoutMs);

    try {
      win.onload = () => {
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

function buildAddToCartForm(doc, productId, quantity, target = null) {
  const form = doc.createElement("form");
  form.method = "POST";
  form.action = WC_AJAX_ADD_URL;
  form.acceptCharset = "UTF-8";
  if (target) form.target = target;

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
  return form;
}

/** Popup helper (best when allowed) — sets first-party cart cookie on zylkhealth.com */
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

async function ajaxAddViaPopup(kitId, quantity, setStatus) {
  setStatus("Adding your kit…");
  const popup = openCheckoutHelper();
  if (!popup) return false;

  try {
    const form = buildAddToCartForm(popup.document, kitId, quantity);
    popup.document.body.appendChild(form);
    form.submit();
  } catch (err) {
    console.warn("[zylk-checkout] popup ajax failed:", err);
    try {
      popup.close();
    } catch {
      // ignore
    }
    return false;
  }

  await waitForWindowLoad(popup);
  await sleep(400);
  refocusOpener();
  try {
    if (!popup.closed) popup.close();
  } catch {
    // ignore
  }
  return true;
}

/**
 * Hidden iframe POST to wc-ajax — no popup permission needed.
 * Cookie may be blocked on localhost (third-party); works better on quiz.zylkhealth.com.
 */
async function ajaxAddViaIframe(kitId, quantity, setStatus) {
  setStatus("Adding your kit…");
  const iframeName = "zylk_woo_ajax_iframe";

  let iframe = document.getElementById(iframeName);
  if (!iframe) {
    iframe = document.createElement("iframe");
    iframe.id = iframeName;
    iframe.name = iframeName;
    iframe.title = "checkout";
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:absolute;width:0;height:0;border:0;left:-9999px;top:-9999px;";
    document.body.appendChild(iframe);
  }

  const form = buildAddToCartForm(document, kitId, quantity, iframeName);
  form.style.display = "none";
  document.body.appendChild(form);

  const loaded = new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    iframe.onload = () => setTimeout(finish, 400);
    setTimeout(finish, 2500);
  });

  try {
    form.submit();
  } catch (err) {
    console.warn("[zylk-checkout] iframe ajax failed:", err);
    form.remove();
    return false;
  }

  await loaded;
  try {
    form.remove();
  } catch {
    // ignore
  }
  return true;
}

/**
 * No popup / iframe cookie issues: one navigation that adds kit and opens checkout.
 * Avoids /cart/?add-to-cart= — uses checkout URL only (single page load).
 */
function navigateCheckoutWithAdd(kitId, quantity, setStatus) {
  setStatus("Opening checkout…");
  const qty = Math.max(1, Number(quantity) || 1);
  const url = `${CHECKOUT_URL}?add-to-cart=${encodeURIComponent(kitId)}&quantity=${qty}`;
  console.info(`[zylk-checkout] ${CHECKOUT_VERSION} navigate`, { url });
  window.location.href = url;
}

async function goToCheckoutAfterAdd(setStatus) {
  setStatus("Opening checkout…");
  window.location.href = CHECKOUT_URL;
}

/**
 * Quiz → Calculate Bundle → add 1 kit → /checkout
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
    // 1) Popup AJAX (best cookie behaviour when allowed)
    const popupOk = await ajaxAddViaPopup(kitId, qty, setStatus);
    if (popupOk) {
      await goToCheckoutAfterAdd(setStatus);
      return;
    }

    // 2) Hidden iframe AJAX (no popup prompt)
    console.info(`[zylk-checkout] ${CHECKOUT_VERSION} trying iframe (popups blocked)`);
    const iframeOk = await ajaxAddViaIframe(kitId, qty, setStatus);
    if (iframeOk) {
      await goToCheckoutAfterAdd(setStatus);
      return;
    }
  } catch (err) {
    console.warn("[zylk-checkout] ajax path failed:", err);
  }

  // 3) Always works without popups — one checkout page load with add-to-cart
  navigateCheckoutWithAdd(kitId, qty, setStatus);
}
