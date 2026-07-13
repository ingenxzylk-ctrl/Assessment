import { useState } from "react";

const TERMS_AND_CONDITIONS = [
  {
    title: "1. WhatsApp & Contact Notification Consent",
    body: "I authorize Zylk Health to use my provided WhatsApp number and email address to send my final clinical report, assessment results, treatment recommendations, automated updates, appointment reminders, and promotional offers related to hair and scalp health.",
  },
  {
    title: "2. WhatsApp Communication",
    body: "By providing my WhatsApp number, I agree to receive messages from Zylk Health via WhatsApp, including one-time passwords (OTP), quiz completion links, report delivery, and follow-up care instructions. Standard messaging rates may apply as per your mobile carrier.",
  },
  {
    title: "3. Personal Data Processing",
    body: "I confirm that all health metrics, age boundaries, lifestyle patterns, scalp images, and personal information provided during this quiz are given voluntarily with my explicit consent.",
  },
  {
    title: "4. AI Scalp Analysis Authorization",
    body: "I authorize Zylk Health to process my scalp image captures using AI algorithms solely to calculate follicular density variations and crown area trends for assessment purposes.",
  },
  {
    title: "5. Data Security",
    body: "All submitted data, including your WhatsApp number, email, and health information, is encrypted in transit and handled within secure systems under applicable medical compliance practices. We do not sell your personal data to third parties.",
  },
  {
    title: "6. Medical Disclaimer",
    body: "This assessment is for informational purposes only and does not replace professional medical advice, diagnosis, or treatment. Please consult a qualified dermatologist or trichologist for clinical decisions.",
  },
];

export default function Section0Consent({ onComplete, onBack }) {
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        {/* Header */}
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

        {/* Summary */}
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
        </div>

        {/* WhatsApp info badge */}
       

        {/* Single checkbox */}
        <label className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200/60 cursor-pointer hover:border-[#064e3b]/20 transition-all select-none bg-white">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded accent-[#064e3b] text-[#064e3b] focus:ring-[#064e3b] shrink-0"
          />
          <div className="text-sm text-gray-700 font-medium leading-relaxed">
            I have read and agree to all terms and conditions,including WhatsApp notifications, contact updates, data processing, and AI scalp
            analysis authorization.
          </div>
        </label>

        {/* Terms link below checkbox */}
        <p className="text-center mt-4 text-xs text-gray-500">
          Read full details in our{" "}
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="text-[#064e3b] font-semibold underline underline-offset-2 hover:text-[#043427] cursor-pointer"
          >
            Terms & Conditions
          </button>
        </p>

        {/* Navigation */}
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

      {/* Terms & Conditions Modal */}
      {showTerms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="bg-white rounded-[24px] w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Terms & Conditions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Zylk Health — Hair & Scalp Assessment</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {TERMS_AND_CONDITIONS.map((term, index) => (
                <div key={index} className="space-y-1.5">
                  <h4 className="text-sm font-bold text-gray-900">{term.title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{term.body}</p>
                </div>
              ))}
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAgreed(true);
                  setShowTerms(false);
                }}
                className="w-full h-12 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all text-sm cursor-pointer"
              >
                I Agree to All Terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}