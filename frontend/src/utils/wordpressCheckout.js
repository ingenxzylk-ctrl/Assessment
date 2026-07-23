import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { getCheckoutWooProductIds } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";
const WP_STORE_API = `${WP_SITE_URL}/wp-json/wc/store/v1`;

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

function headerValue(headers, name) {
  if (!headers) return null;
  return (
    headers.get(name) ||
    headers.get(name.toLowerCase()) ||
    headers.get(name.replace(/(^|-)([a-z])/g, (_, p, c) => (p ? "-" : "") + c.toUpperCase()))
  );
}

function readStoreAuth(response) {
  return {
    cartToken: headerValue(response.headers, "Cart-Token") || headerValue(response.headers, "cart-token"),
    nonce:
      headerValue(response.headers, "Nonce") ||
      headerValue(response.headers, "nonce") ||
      headerValue(response.headers, "X-WC-Store-API-Nonce"),
  };
}

function addToCartUrl(productId, quantity = 1) {
  return `${WP_SITE_URL}/?add-to-cart=${productId}&quantity=${quantity || 1}`;
}

/**
 * Woo Store API — same-tab, no popups.
 * Works when CORS allows the assessment origin; fails otherwise.
 */
async function addProductsViaStoreApi(productIds, qty) {
  const cartRes = await fetch(`${WP_STORE_API}/cart`, {
    method: "GET",
    credentials: "include",
    mode: "cors",
    headers: { Accept: "application/json" },
  });
  if (!cartRes.ok) throw new Error(`Cart bootstrap failed (${cartRes.status})`);

  let { cartToken, nonce } = readStoreAuth(cartRes);
  if (!cartToken) throw new Error("Missing Cart-Token");

  for (let i = 0; i < productIds.length; i += 1) {
    const id = productIds[i];
    const quantity = i === 0 ? qty || 1 : 1;
    const res = await fetch(`${WP_STORE_API}/cart/add-item`, {
      method: "POST",
      credentials: "include",
      mode: "cors",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Cart-Token": cartToken,
        ...(nonce ? { Nonce: nonce } : {}),
      },
      body: JSON.stringify({ id: Number(id), quantity: Number(quantity) || 1 }),
    });

    const next = readStoreAuth(res);
    if (next.cartToken) cartToken = next.cartToken;
    if (next.nonce) nonce = next.nonce;

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body?.message || body?.code || "";
      } catch {
        // ignore
      }
      throw new Error(`Add item ${id} failed (${res.status}) ${detail}`.trim());
    }
  }
}

/**
 * Same-tab hidden iframes — no new browser tabs.
 * On same-site hosts (assessment.zylkhealth.com → zylkhealth.com) Woo session cookies apply.
 */
function addProductsViaHiddenIframes(productIds, qty) {
  return productIds.reduce(async (prev, id, i) => {
    await prev;
    const quantity = i === 0 ? qty || 1 : 1;
    const url = addToCartUrl(id, quantity);

    await new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      iframe.style.cssText =
        "position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;pointer-events:none";

      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try {
          iframe.remove();
        } catch {
          // ignore
        }
        if (ok) resolve();
        else reject(new Error(`Iframe add-to-cart failed for ${id}`));
      };

      const timer = window.setTimeout(() => finish(true), 3500);
      iframe.onload = () => {
        // Give Woo a moment to commit the session before the next product
        window.setTimeout(() => finish(true), 700);
      };
      iframe.onerror = () => finish(false);

      document.body.appendChild(iframe);
      iframe.src = url;
    });

    if (i < productIds.length - 1) await sleep(400);
  }, Promise.resolve());
}

/**
 * no-cors GETs in the current tab (opaque responses; cookies may still be set same-site).
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
 * Same-tab checkout:
 * 1) Persist quiz
 * 2) Add all Woo products async in this tab (no window.open / about:blank)
 * 3) Wait until adds finish
 * 4) Redirect this window once to /cart/
 *
 * @param {object[]} cartItems
 * @param {object} quizState
 * @param {{ onStatus?: (msg: string) => void }} [options]
 */
export async function redirectToWordPressCheckout(cartItems, quizState, options = {}) {
  if (!cartItems?.length) return;

  const { onStatus } = options;
  const setStatus = (msg) => {
    if (typeof onStatus === "function") onStatus(msg);
  };

  const item = cartItems[0];
  const { kitId, productIds } = resolveCheckoutProductIds(item);

  if (!kitId || !productIds.length) {
    alert("Product is not linked to the store yet. Please contact support.");
    return;
  }

  const qty = item.quantity || 1;
  const cartUrl = `${WP_SITE_URL}/cart/`;
  const needsMultiAdd = productIds.length > 1;

  setStatus(
    needsMultiAdd
      ? `Adding products to cart… (${productIds.join(", ")})`
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

  // Single product — one same-tab redirect
  if (!needsMultiAdd) {
    window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
    return;
  }

  // Multi-product: sync in this tab, then one redirect (never open a second tab)
  let added = false;

  try {
    setStatus(`Adding kit ${productIds[0]}…`);
    await addProductsViaStoreApi(productIds, qty);
    added = true;
  } catch (err) {
    console.warn("Store API cart add failed:", err);
  }

  if (!added) {
    try {
      setStatus(`Adding products… (${productIds.join(", ")})`);
      await addProductsViaHiddenIframes(productIds, qty);
      added = true;
    } catch (err) {
      console.warn("Hidden iframe cart add failed:", err);
    }
  }

  if (!added) {
    try {
      setStatus(`Syncing cart… (${productIds.join(", ")})`);
      await addProductsViaNoCors(productIds, qty);
      added = true;
    } catch (err) {
      console.warn("no-cors cart add failed:", err);
    }
  }

  if (!added) {
    // Last resort still stays in THIS tab — kit first; user can add Health Mix from shop
    alert(
      "Could not sync both products automatically. Opening cart with your kit — please confirm Hair Health Mix is included."
    );
    window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
    return;
  }

  // Brief pause so the session cookie is committed before /cart/ loads
  setStatus("Opening your cart…");
  await sleep(400);
  window.location.href = cartUrl;
}
