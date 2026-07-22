import { markCheckoutReturn, persistQuizStateNow } from "./quizPersistence";
import { saveScalpImagesToIdb } from "./quizImageStore";
import { SEPARATE_HEALTH_MIX_WOO_ID } from "../config/bundles";

const WP_SITE_URL = import.meta.env.VITE_WP_SITE_URL || "https://zylkhealth.com";
const WP_STORE_API = `${WP_SITE_URL}/wp-json/wc/store/v1`;

/**
 * Resolve checkout product IDs.
 * Only the two no-mix dandruff kits (8393 / 8368) may also add Health Mix 8303.
 * All other bundles use a single with/without-mix Woo product ID.
 */
function resolveCheckoutProductIds(item) {
  const kitId = item?.wooProductId ? Number(item.wooProductId) : null;
  if (!kitId) return { kitId: null, mixId: null };

  const wantsSeparateMix =
    Boolean(item.usesSeparateHealthMix) &&
    Boolean(item.includeHealthMix) &&
    (kitId === 8393 || kitId === 8368);

  const mixId = wantsSeparateMix
    ? Number(item.wooHealthMixProductId) || SEPARATE_HEALTH_MIX_WOO_ID
    : null;

  return { kitId, mixId };
}

function headerValue(headers, name) {
  if (!headers) return null;
  return (
    headers.get(name) ||
    headers.get(name.toLowerCase()) ||
    headers.get(name.replace(/(^|-)([a-z])/g, (_, p, c) => (p ? "-" : "") + c.toUpperCase()))
  );
}

/**
 * Read Cart-Token + Nonce from a Store API response.
 * Woo returns these as response headers (and sometimes nonce in body meta).
 */
function readStoreAuth(response) {
  return {
    cartToken: headerValue(response.headers, "Cart-Token") || headerValue(response.headers, "cart-token"),
    nonce:
      headerValue(response.headers, "Nonce") ||
      headerValue(response.headers, "nonce") ||
      headerValue(response.headers, "X-WC-Store-API-Nonce"),
  };
}

/**
 * Add items via WooCommerce Store API using credentialed requests so the
 * classic PHP session cookies stay in sync — then /cart/ shows both products.
 * Comma-separated ?add-to-cart=8393,8303 is NOT supported by stock WooCommerce.
 */
async function addItemsViaStoreApi(kitId, mixId, qty) {
  const cartRes = await fetch(`${WP_STORE_API}/cart`, {
    method: "GET",
    credentials: "include",
    mode: "cors",
    headers: { Accept: "application/json" },
  });
  if (!cartRes.ok) throw new Error(`Cart bootstrap failed (${cartRes.status})`);

  let { cartToken, nonce } = readStoreAuth(cartRes);
  if (!cartToken) throw new Error("Missing Cart-Token from store API");

  const addItem = async (productId, quantity) => {
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
      body: JSON.stringify({ id: Number(productId), quantity: Number(quantity) || 1 }),
    });

    const nextAuth = readStoreAuth(res);
    if (nextAuth.cartToken) cartToken = nextAuth.cartToken;
    if (nextAuth.nonce) nonce = nextAuth.nonce;

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body?.message || body?.code || "";
      } catch {
        // ignore
      }
      throw new Error(`Add item ${productId} failed (${res.status}) ${detail}`.trim());
    }

    return res.json().catch(() => null);
  };

  await addItem(kitId, qty);
  if (mixId) await addItem(mixId, 1);

  return true;
}

/**
 * Fallback: sequential classic ?add-to-cart= GETs (same-site cookie jar).
 * Still does not rely on unsupported comma-separated product IDs.
 */
async function addItemsViaClassicGet(kitId, mixId, qty) {
  const add = async (id, quantity) => {
    const url = `${WP_SITE_URL}/?add-to-cart=${id}&quantity=${quantity}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      mode: "cors",
      redirect: "follow",
    });
    if (!res.ok && res.status >= 400) {
      throw new Error(`Classic add-to-cart failed for ${id} (${res.status})`);
    }
  };

  await add(kitId, qty);
  if (mixId) await add(mixId, 1);
}

/**
 * Redirect to WordPress cart while preserving quiz progress locally,
 * so browser back / return lands on the same quiz step (usually Result).
 *
 * For kits 8393 / 8368 with Health Mix checked, adds product 8303 as a
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

  if (quizState) {
    persistQuizStateNow(quizState);
    try {
      await saveScalpImagesToIdb(quizState.scalpImages);
    } catch {
      // continue — quiz answers still in localStorage
    }
  }
  markCheckoutReturn();

  // Multi-product path (kit + optional Health Mix 8303)
  if (mixId) {
    try {
      await addItemsViaStoreApi(kitId, mixId, qty);
      window.location.href = `${WP_SITE_URL}/cart/`;
      return;
    } catch (storeErr) {
      console.warn("Store API cart add failed, trying classic add-to-cart:", storeErr);
      try {
        await addItemsViaClassicGet(kitId, mixId, qty);
        window.location.href = `${WP_SITE_URL}/cart/`;
        return;
      } catch (classicErr) {
        console.warn("Classic multi add-to-cart failed:", classicErr);
        // Last resort: land on cart with kit; mix may need manual add
        alert(
          "Could not automatically add Hair Health Mix to your cart. The kit will be added — please also add “Zylk Hair Health Mix” from the shop if needed."
        );
        window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
        return;
      }
    }
  }

  // Single product (all other bundles / mix unchecked)
  window.location.href = `${WP_SITE_URL}/cart/?add-to-cart=${kitId}&quantity=${qty}`;
}
