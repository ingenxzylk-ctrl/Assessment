import { useState } from "react";
import { useCart } from "../../context/CartContext";
import { useQuiz } from "../../context/QuizContext";
import { redirectToWordPressCheckout } from "../../utils/wordpressCheckout";
import { HAIR_HEALTH_MIX_PRICE } from "../../data/zylkProductCatalog";

export default function CartDrawer() {
  const { state, flushPersistence } = useQuiz();
  const {
    cartItems,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeFromCart,
    toggleHealthMix,
    cartTotal,
    cartCount,
  } = useCart();
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState("");

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    if (checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutStatus("Adding to your cart…");
    try {
      if (flushPersistence) flushPersistence();
      await redirectToWordPressCheckout(cartItems, state, {
        onStatus: setCheckoutStatus,
      });
      // On success the page navigates away; if not, re-enable.
      setCheckoutBusy(false);
      setCheckoutStatus("");
    } catch (err) {
      console.warn("Checkout failed:", err);
      setCheckoutBusy(false);
      setCheckoutStatus("");
      alert("Checkout could not be started. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => {
          if (!checkoutBusy) setIsCartOpen(false);
        }}
      />

      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-gray-900">Your Cart ({cartCount})</h3>
          <button
            type="button"
            disabled={checkoutBusy}
            onClick={() => setIsCartOpen(false)}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 text-gray-400 space-y-2">
              <span className="text-4xl block">🛒</span>
              <p className="text-sm font-medium">Your cart is empty.</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const mixPrice = item.healthMixPrice ?? HAIR_HEALTH_MIX_PRICE;
              return (
                <div key={item.id} className="p-3 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-3">
                  <div className="flex gap-4 justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800">{item.name}</p>
                      <p className="text-xs text-[#064e3b] font-semibold mt-1">₹{item.price}</p>
                      {item.isTestBundle && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Test Bundle
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 bg-white border border-gray-200 px-2 py-1 rounded-xl">
                      <button
                        type="button"
                        disabled={checkoutBusy}
                        onClick={() => updateQuantity(item.id, -1)}
                        className="text-gray-500 font-bold px-1 text-sm cursor-pointer disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-gray-700 w-4 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={checkoutBusy}
                        onClick={() => updateQuantity(item.id, 1)}
                        className="text-gray-500 font-bold px-1 text-sm cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={checkoutBusy}
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-600 text-sm font-bold pl-2 cursor-pointer disabled:opacity-40"
                    >
                      🗑️
                    </button>
                  </div>

                  {item.bundleNumber && !item.isTestBundle && (
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={checkoutBusy}
                        checked={item.includeHealthMix !== false}
                        onChange={() => toggleHealthMix(item.id)}
                        className="rounded border-gray-300"
                      />
                      Include Hair Health Mix (+₹{mixPrice})
                    </label>
                  )}
                </div>
              );
            })
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
            <div className="flex justify-between font-semibold text-gray-900 text-base">
              <span>Subtotal:</span>
              <span className="text-[#064e3b] font-bold text-lg">₹{cartTotal}</span>
            </div>
            <button
              type="button"
              disabled={checkoutBusy}
              onClick={handleCheckout}
              className="w-full min-h-[3.25rem] bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all tracking-wide text-sm shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-wait flex items-center justify-center gap-2 px-4"
            >
              {checkoutBusy ? (
                <>
                  <span
                    className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
                    aria-hidden
                  />
                  <span>Adding to cart…</span>
                </>
              ) : (
                "Go to Cart"
              )}
            </button>
          </div>
        )}
      </div>

      {/* In-app loading overlay — stay on the quiz UI instead of a blank Woo page */}
      {checkoutBusy && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#064e3b]/70 backdrop-blur-[2px]">
          <div className="mx-4 max-w-sm w-full rounded-3xl bg-white p-8 shadow-2xl text-center space-y-4">
            <span
              className="inline-block w-10 h-10 border-[3px] border-[#064e3b]/20 border-t-[#064e3b] rounded-full animate-spin"
              aria-hidden
            />
            <div>
              <p className="text-base font-bold text-gray-900">Adding to your cart</p>
              <p className="text-sm text-gray-500 mt-1">
                {checkoutStatus || "Please wait a moment…"}
              </p>
            </div>
            <p className="text-xs text-gray-400">
              Keep this tab open — your cart will open automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
