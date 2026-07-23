import { createContext, useContext, useState, useEffect } from "react";
import {
  getWooProductId,
  getSeparateHealthMixWooId,
  usesSeparateHealthMixProduct,
  SEPARATE_HEALTH_MIX_WOO_ID,
} from "../config/bundles";
import { HAIR_HEALTH_MIX_PRICE } from "../data/zylkProductCatalog";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem("follicle_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("follicle_cart", JSON.stringify(cartItems));
  }, [cartItems]);

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
                healthMixPrice: product.healthMixPrice ?? HAIR_HEALTH_MIX_PRICE,
              }
            : item
        );
      }
      return [
        ...base,
        {
          ...product,
          quantity: 1,
          healthMixPrice: product.healthMixPrice ?? HAIR_HEALTH_MIX_PRICE,
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

  /** Toggle Health Mix → changes price AND WordPress product ID(s) */
  const toggleHealthMix = (productId) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== productId) return item;

        const includeHealthMix = !item.includeHealthMix;
        const newPrice = includeHealthMix ? item.priceWithMix : item.priceWithoutMix;
        const hasDandruff = Boolean(item.hasDandruff);
        const gender = item.gender || null;
        const separateMix = usesSeparateHealthMixProduct(
          item.bundleNumber,
          hasDandruff,
          gender
        );
        const newWooId = getWooProductId(
          item.bundleNumber,
          includeHealthMix,
          hasDandruff,
          gender
        );
        const mixWooId = getSeparateHealthMixWooId(
          item.bundleNumber,
          includeHealthMix,
          hasDandruff,
          gender
        );
        // Kit 8393: Health Mix is always separate product 8303 when checkbox is on
        const isDandruffKit8393 = Number(newWooId) === 8393;
        const allowSeparateMix = separateMix || isDandruffKit8393;

        return {
          ...item,
          includeHealthMix,
          price: newPrice,
          wooProductId: newWooId,
          wooHealthMixProductId:
            allowSeparateMix && includeHealthMix
              ? mixWooId || SEPARATE_HEALTH_MIX_WOO_ID
              : null,
          usesSeparateHealthMix: allowSeparateMix,
          healthMixPrice: item.healthMixPrice ?? HAIR_HEALTH_MIX_PRICE,
          subtitle: includeHealthMix
            ? `Bundle ${item.bundleNumber} • With Health Mix`
            : `Bundle ${item.bundleNumber} • Without Health Mix`,
        };
      })
    );
  };

  const clearCart = () => setCartItems([]);

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
