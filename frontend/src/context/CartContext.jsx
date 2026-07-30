import { createContext, useContext, useState, useEffect } from "react";
import { getCheckoutWooProductIds } from "../config/bundles";

const CartContext = createContext();
const CART_STORAGE_KEY = "follicle_cart";

function clearCartCache() {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function CartProvider({ children }) {
  // No localStorage cart cache — always start fresh (no WP checkout resume)
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    clearCartCache();
  }, []);

  // When quiz gender changes mid-session, drop stale male/female kits
  useEffect(() => {
    const onGenderChanged = () => {
      setCartItems((prev) => prev.filter((item) => item.isTestBundle));
      setIsCartOpen(false);
    };
    window.addEventListener("zylk:gender-changed", onGenderChanged);
    return () => window.removeEventListener("zylk:gender-changed", onGenderChanged);
  }, []);

  const addToCart = (product) => {
    setCartItems((prev) => {
      // Assessment kits replace each other so a male kit cannot linger after a female result
      const isAssessmentKit = Boolean(product.bundleNumber) && !product.isTestBundle;
      const base = isAssessmentKit
        ? prev.filter((item) => item.isTestBundle || !item.bundleNumber)
        : prev;

      const existing = base.find((item) => item.id === product.id);
      if (existing) {
        return base.map((item) =>
          item.id === product.id
            ? {
                ...item,
                ...product,
                quantity: item.quantity + 1,
                includeHealthMix: false,
                usesSeparateHealthMix: false,
                wooHealthMixProductId: null,
              }
            : item
        );
      }

      // Keep Woo IDs on the item for display/reference, but do not redirect to WordPress
      let wooProductId = product.wooProductId || null;
      if (product.bundleNumber && !product.isTestBundle) {
        const { kitId } = getCheckoutWooProductIds({
          bundleNumber: product.bundleNumber,
          hasDandruff: Boolean(product.hasDandruff),
          includeHealthMix: false,
          gender: product.gender || null,
        });
        wooProductId = kitId || wooProductId;
      }

      return [
        ...base,
        {
          ...product,
          quantity: 1,
          includeHealthMix: false,
          usesSeparateHealthMix: false,
          wooProductId,
          wooHealthMixProductId: null,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, amount) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = item.quantity + amount;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  /** No-op — kits no longer support a separate Health Mix add-on */
  const toggleHealthMix = () => {};

  const clearCart = () => {
    clearCartCache();
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        toggleHealthMix,
        clearCart,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return context;
};
