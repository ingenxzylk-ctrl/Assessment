import { TERMS_AND_CONDITIONS, TERMS_LAST_UPDATED, TERMS_VERSION } from "../../legal/termsAndConditions";

/**
 * Full-screen scrollable Terms & Conditions modal.
 * Used from consent step and Home footer — not a user-facing PDF report.
 */
export default function TermsModal({ open, onClose, onAgree }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div
        className="bg-white rounded-[24px] w-full max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-start gap-3 shrink-0">
          <div>
            <h3 id="terms-modal-title" className="text-lg font-bold text-gray-900">
              Terms & Conditions
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Zylk Health — Hair & Scalp Assessment · v{TERMS_VERSION} · Last updated {TERMS_LAST_UPDATED}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 text-lg font-bold cursor-pointer shrink-0"
            aria-label="Close terms"
          >
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-6 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Please scroll and review carefully. These Terms include important medical disclaimers,
            AI limitations, liability caps, and data-processing consents that affect your legal rights.
          </p>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {TERMS_AND_CONDITIONS.map((term, index) => (
            <section key={index} className="space-y-2">
              <h4 className="text-sm font-bold text-gray-900 leading-snug">{term.title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{term.body}</p>
            </section>
          ))}
          <p className="text-[10px] text-gray-400 pt-2 border-t border-gray-100">
            End of Terms & Conditions (v{TERMS_VERSION}). By accepting, you agree to all sections above.
          </p>
        </div>

        <div className="p-5 sm:p-6 border-t border-gray-100 shrink-0 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm cursor-pointer"
          >
            Close
          </button>
          {typeof onAgree === "function" && (
            <button
              type="button"
              onClick={() => {
                onAgree();
                onClose();
              }}
              className="flex-[2] h-12 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all text-sm cursor-pointer"
            >
              I Agree to All Terms
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
