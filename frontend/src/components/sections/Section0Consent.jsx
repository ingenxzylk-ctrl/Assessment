import { useState } from "react";
import TermsModal from "../legal/TermsModal";

export default function Section0Consent({ onComplete, onBack }) {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="mb-6 text-center">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            Privacy & Trust
          </span>
          <h2 className="text-[26px] font-bold text-gray-900 mt-4 leading-tight">
            Data Authorization & Terms
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            Please review how we handle your information before starting the diagnosis.
          </p>
        </div>

        <div className="text-xs text-gray-600 leading-relaxed space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
          <p>
            At <strong>Zylk Health</strong>, we prioritize the clinical security of your personal
            profiles. The diagnostic quiz uses advanced AI systems to analyze your hair loss metrics
            and deliver localized treatment routines.
          </p>
          <p>
            We will use your <strong>WhatsApp number</strong> and email to send your assessment
            report, treatment recommendations, and important updates. All data is encrypted in
            transit and handled within secure systems.
          </p>
          <p className="text-[11px] text-gray-500">
            This assessment is informational only and is <strong>not</strong> a medical diagnosis.
            Full legal terms cover AI limits, photo processing, liability, and product recommendations.
          </p>
        </div>

        <label className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200/60 cursor-pointer hover:border-[#064e3b]/20 transition-all select-none bg-white">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded accent-[#064e3b] text-[#064e3b] focus:ring-[#064e3b] shrink-0"
          />
          <div className="text-sm text-gray-700 font-medium leading-relaxed">
            I have read and agree to the full{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowTerms(true);
              }}
              className="text-[#064e3b] font-bold underline underline-offset-2 hover:text-[#043427] cursor-pointer"
            >
              Terms & Conditions
            </button>
            , including medical disclaimers, AI scalp analysis, WhatsApp/email contact, data
            processing, product recommendations, and limitation of liability.
          </div>
        </label>

        <p className="text-center mt-4 text-xs text-gray-500">
          Read the complete legal terms (recommended) in our{" "}
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-[#064e3b] font-semibold underline underline-offset-2 hover:text-[#043427] cursor-pointer"
          >
            Terms & Conditions
          </button>
        </p>

        <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100 w-full">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 h-14 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!agreed}
            onClick={onComplete}
            className="flex-[2] h-14 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm text-base cursor-pointer"
          >
            Accept & Start Quiz
          </button>
        </div>
      </div>

      <TermsModal
        open={showTerms}
        onClose={() => setShowTerms(false)}
        onAgree={() => setAgreed(true)}
      />
    </div>
  );
}
