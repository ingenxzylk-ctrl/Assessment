import { useState } from "react";
import LegalDocumentPage from "./LegalDocumentPage";

const PRIVACY_POINTS = [
  {
    title: "Secure & Encrypted",
    body: "Your data and photos are encrypted and stored securely.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: "Used for Your Assessment",
    body: "We use your information to analyze your results and personalize your plan.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5M10 19V9M16 19v-6M22 19V7" />
      </svg>
    ),
  },
  {
    title: "You're in Control",
    body: "You can unsubscribe or delete your data anytime.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </svg>
    ),
  },
  {
    title: "We'll Keep You Updated",
    body: "Get your results, hair-care tips, product recommendations and exclusive offers.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
];

function LegalLinkButton({ docId, children, onOpen }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onOpen(docId);
      }}
      className="text-[#064e3b] font-semibold underline underline-offset-2 hover:text-[#043427] cursor-pointer bg-transparent border-0 p-0 inline"
    >
      {children}
    </button>
  );
}

export default function Section0Consent({ onComplete, onBack }) {
  const [agreedConsent, setAgreedConsent] = useState(false);
  const [openDocId, setOpenDocId] = useState(null);
  const canContinue = agreedConsent;

  if (openDocId) {
    return <LegalDocumentPage docId={openDocId} onBack={() => setOpenDocId(null)} />;
  }

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="mb-7 text-center">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            Privacy & Consent
          </span>

          <div className="mt-5 mx-auto w-14 h-14 rounded-full bg-[#e8eede] flex items-center justify-center text-[#064e3b]">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3 5 6v5c0 5 3.2 8.4 7 9.5 3.8-1.1 7-4.5 7-9.5V6l-7-3z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <h2 className="text-[26px] md:text-[28px] font-bold text-[#064e3b] mt-4 leading-tight">
            Your Privacy Matters
          </h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed max-w-md mx-auto">
            We protect your information and use it only to create your personalized hair assessment
            and recommendations.
          </p>
        </div>

        <div className="space-y-4 mb-7">
          {PRIVACY_POINTS.map((point) => (
            <div key={point.title} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#e8eede] text-[#064e3b] flex items-center justify-center shrink-0">
                {point.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{point.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{point.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 mb-4">
          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-gray-200/70 cursor-pointer hover:border-[#064e3b]/25 transition-all select-none bg-white">
            <input
              type="checkbox"
              checked={agreedConsent}
              onChange={(e) => setAgreedConsent(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-[#064e3b] text-[#064e3b] focus:ring-[#064e3b] shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              I have read and agree to the{" "}
              <LegalLinkButton docId="terms" onOpen={setOpenDocId}>
                Terms of Service
              </LegalLinkButton>{" "}
              and{" "}
              <LegalLinkButton docId="privacy" onOpen={setOpenDocId}>
                Privacy Policy
              </LegalLinkButton>
              . I understand that Zylk Health will process my information to provide my personalized
              assessment and, with this consent, send my assessment results, hair-care
              recommendations, promotional offers, and updates via WhatsApp and email. I understand I
              can opt out of marketing communications at any time.
            </span>
          </label>
        </div>

        <p className="text-center text-xs text-gray-500 mb-6">
          Read our{" "}
          <LegalLinkButton docId="privacy" onOpen={setOpenDocId}>
            Privacy Policy
          </LegalLinkButton>
          {", "}
          <LegalLinkButton docId="terms" onOpen={setOpenDocId}>
            Terms of Service
          </LegalLinkButton>
          {", and "}
          <LegalLinkButton docId="consent" onOpen={setOpenDocId}>
            Care Plan Informed Consent
          </LegalLinkButton>
        </p>

        <div className="flex gap-4 pt-4 border-t border-gray-100 w-full">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 h-14 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={onComplete}
            className="flex-[2] h-14 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm text-base cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Start My Free Assessment
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-400 inline-flex items-center justify-center gap-1.5 w-full">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#064e3b]" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3 5 6v5c0 5 3.2 8.4 7 9.5 3.8-1.1 7-4.5 7-9.5V6l-7-3z" />
          </svg>
          100% Private · Unsubscribe anytime
        </p>
      </div>
    </div>
  );
}
