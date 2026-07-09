import { useCart } from "../../context/CartContext";
import { HAIR_HEALTH_MIX_ID } from "../../data/products";

export default function CartDrawer() {
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

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />

      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-gray-900">Your Cart ({cartCount})</h3>
          <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer">
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
            cartItems.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800">{item.name}</p>
                    {item.subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{item.subtitle}</p>}
                    <p className="text-sm text-[#064e3b] font-bold mt-1">₹{item.price}</p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-400 hover:text-red-600 text-sm cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>

                {/* Hair Health Mix toggle — only for bundles */}
                {item.priceWithMix && (
                  <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.includesHealthMix !== false}
                      onChange={(e) => toggleHealthMix(item.id, e.target.checked)}
                      className="w-4 h-4 accent-[#064e3b] rounded"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-800">Include Hair Health Mix</p>
                      <p className="text-[10px] text-gray-400">
                        {item.includesHealthMix !== false
                          ? `+₹${item.healthMixItem?.price || 1799} included`
                          : `Save ₹${(item.priceWithMix || 0) - (item.priceWithoutMix || 0)}`}
                      </p>
                    </div>
                  </label>
                )}

                {/* Show included products */}
                {item.items?.length > 0 && (
                  <div className="space-y-1 pl-1">
                    {item.items.map((prod) => (
                      <p key={prod.id} className="text-[10px] text-gray-500 flex justify-between">
                        <span>{prod.name}</span>
                        <span>₹{prod.price}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2.5 bg-white border border-gray-200 px-2 py-1 rounded-xl w-fit">
                  <button onClick={() => updateQuantity(item.id, -1)} className="text-gray-500 font-bold px-2 text-sm cursor-pointer">−</button>
                  <span className="text-xs font-bold text-gray-700 w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-gray-500 font-bold px-2 text-sm cursor-pointer">+</button>
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
            <div className="flex justify-between font-semibold text-gray-900 text-base">
              <span>Total:</span>
              <span className="text-[#064e3b] font-bold text-lg">₹{cartTotal}</span>
            </div>
            <button
              onClick={() => alert("Proceeding to checkout...")}
              className="w-full h-12 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all text-sm cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}