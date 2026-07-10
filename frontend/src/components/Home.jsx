import React from "react";
import { getTestBundle } from "../config/bundles";
import { useCart } from "../context/CartContext";
import { redirectToWordPressCheckout } from "../utils/wordpressCheckout";

export default function Home({ onStart }) {
  const { addToCart } = useCart();
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20 animate-[fadeIn_0.4s_ease-out]">
      
      {/* 1. Hero Content & How It Works Split Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center mt-6 lg:mt-12">
        
        {/* Left Side: Dynamic Hero Text Block */}
        <div className="lg:col-span-7 space-y-6 text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100/60 border border-emerald-200/50 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#064e3b] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#064e3b]">
              FREE • 2-MIN ASSESSMENT
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight font-serif text-gray-900 leading-[1.15]">
            Discover the root cause of your hair <br />
            <span className="text-[#064e3b]">thinning in 2 min</span>
          </h1>

          <p className="text-gray-600 text-base sm:text-lg max-w-xl leading-relaxed font-medium">
            Take our FREE AI scalp analysis to uncover why you have hair-loss and get the exact routine to fix it.

          </p>

          {/* Action Trigger Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
            <button
              type="button"
              onClick={onStart}
              className="h-14 px-8 bg-[#064e3b] text-white font-semibold rounded-2xl hover:bg-[#043427] transition-all transform hover:scale-[1.01] shadow-[0_4px_18px_rgba(6,78,59,0.25)] flex items-center justify-center gap-3 group text-base cursor-pointer"
            >
              <span>START FREE ASSESSMENT</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <div className="text-xs text-gray-400 font-medium sm:pl-2">
              No commitment • Private & secure
            </div>
          </div>

          {/* Core Trust Feature Bullet Lists */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-gray-200/50 max-w-xl">
            <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
              <span className="text-emerald-700 font-bold">✓</span> 10,000+ assessments
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
              <span className="text-emerald-700 font-bold">✓</span> AI-powered analysis
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
              <span className="text-emerald-700 font-bold">✓</span> Doctor-reviewed
            </div>
          </div>
        </div>

        {/* Right Side: Step Matrix Metric Floating Card */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-md bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.03)] border border-gray-100/80">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/80 mb-5 text-left">
              HOW IT WORKS
            </p>
            
            <div className="space-y-3.5 text-left">
              {/* Step 1 */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-900/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-lg shadow-sm">👤</div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900"><span className="text-purple-700 font-mono text-xs mr-1 font-normal">01</span>Take the Quiz</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Share a bit about your hair history and goals.</p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-900/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg shadow-sm">💇</div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900"><span className="text-orange-600 font-mono text-xs mr-1 font-normal">02</span> Upload Photo</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Snap and upload a quick picture of your scalp.</p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-900/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg shadow-sm">🩺</div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900"><span className="text-blue-600 font-mono text-xs mr-1 font-normal">03</span> AI Analysis</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Our advanced tech instantly pinpoints your root causes.</p>
                </div>
              </div>
              {/* Step 4 */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-100 hover:border-emerald-900/10 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-lg shadow-sm">📸</div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900"><span className="text-teal-600 font-mono text-xs mr-1 font-normal">04</span> Your Custom Routine</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Get a targeted hair therapy plan with the exact oils , rollers , and massagers you need.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Secondary Strategy Pillars Grid Section */}
      <div className="mt-24 pt-12 border-t border-gray-200/60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] text-left space-y-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#064e3b] flex items-center justify-center text-lg font-bold">🧪</div>
            <h3 className="font-bold text-lg text-gray-900">AI Scalp Analysis</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Dual-angle photo capture with confidence-scored stage classification.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] text-left space-y-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#064e3b] flex items-center justify-center text-lg font-bold">✦</div>
            <h3 className="font-bold text-lg text-gray-900">Root Cause Mapping</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Genetic, hormonal, nutritional, and lifestyle factors analyzed together.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] text-left space-y-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#064e3b] flex items-center justify-center text-lg font-bold">❤️</div>
            <h3 className="font-bold text-lg text-gray-900">Hope-Forward Results</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Honest, reassuring guidance with clear next steps — never alarmist.
            </p>
          </div>

        </div>
      </div>

      {/* Dev: ₹1 test bundle for WooCommerce checkout */}
      {import.meta.env.DEV && (
        <div className="mt-16 p-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Dev only — test checkout</p>
          <button
            type="button"
            onClick={() => {
              const testBundle = getTestBundle();
              addToCart(testBundle);
              redirectToWordPressCheckout([{ ...testBundle, quantity: 1 }]);
            }}
            className="h-10 px-6 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors cursor-pointer"
          >
            Add ₹1 Test Bundle &amp; Go to Checkout
          </button>
        </div>
      )}

      {/* 3. Bottom Call To Action Block */}
      <div className="mt-20 text-center space-y-5">
        <h2 className="text-2xl font-serif font-bold text-gray-900">Ready to take the first step?</h2>
        <button
          type="button"
          onClick={onStart}
          className="h-14 px-10 bg-[#064e3b] text-white font-semibold rounded-2xl hover:bg-[#043427] transition-all transform hover:scale-[1.01] shadow-md text-base cursor-pointer inline-flex items-center justify-center"
        >
          Begin Your Assessment
        </button>
      </div>

    </div>
  );
}