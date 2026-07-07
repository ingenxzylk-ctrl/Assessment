import { useCart } from "../../context/CartContext";

export default function CartDrawer() {
  const { cartItems, isCartOpen, setIsCartOpen, updateQuantity, removeFromCart, cartTotal, cartCount } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-[fadeIn_0.2s_ease-out]">
      {/* Dark backdrop shadow mask */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />

      <div className="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
        
        {/* Header Block */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-xl text-gray-900">Your Cart ({cartCount})</h3>
          <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1 cursor-pointer">×</button>
        </div>

        {/* Item Iteration List Panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="text-center py-20 text-gray-400 space-y-2">
              <span className="text-4xl block">🛒</span>
              <p className="text-sm font-medium">Your selection pipeline is currently empty.</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className="flex gap-4 p-3 rounded-2xl border border-gray-100 bg-gray-50/50 justify-between items-center">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-800">{item.name}</p>
                  <p className="text-xs text-[#064e3b] font-semibold mt-1">₹{item.price}</p>
                </div>
                <div className="flex items-center gap-2.5 bg-white border border-gray-200 px-2 py-1 rounded-xl">
                  <button onClick={() => updateQuantity(item.id, -1)} className="text-gray-500 font-bold px-1 text-sm cursor-pointer">-</button>
                  <span className="text-xs font-bold text-gray-700 w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="text-gray-500 font-bold px-1 text-sm cursor-pointer">+</button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 text-sm font-bold pl-2 cursor-pointer">🗑️</button>
              </div>
            ))
          )}
        </div>

        {/* Bottom Total Summary & Checkout Button Box */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-4">
            <div className="flex justify-between font-semibold text-gray-900 text-base">
              <span>Subtotal:</span>
              <span className="text-[#064e3b] font-bold text-lg">₹{cartTotal}</span>
            </div>
            <button 
              onClick={() => alert("Connecting order payload directly to payments module (Razorpay)...")}
              className="w-full h-13 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all tracking-wide text-sm shadow-sm cursor-pointer"
            >
              Proceed to Secure Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}