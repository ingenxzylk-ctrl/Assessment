import { LEGAL_DOCUMENTS } from "../../data/legalDocuments";

export default function LegalDocumentPage({ docId, onBack }) {
  const doc = LEGAL_DOCUMENTS[docId] || LEGAL_DOCUMENTS.privacy;

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-5 md:p-6 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
              Legal
            </span>
            <h2 className="text-xl font-bold text-gray-900 mt-2 leading-tight">{doc.title}</h2>
            <p className="text-xs text-gray-400 mt-1">{doc.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Close legal document"
          >
            ✕
          </button>
        </div>

        <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
          {doc.paragraphs.map((paragraph, index) => (
            <p
              key={`${doc.id}-${index}`}
              className={`text-sm leading-relaxed text-gray-700 ${
                index === 0 ? "font-semibold text-gray-900" : ""
              }`}
            >
              {paragraph}
            </p>
          ))}
        </div>

        <div className="p-5 md:p-6 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="w-full h-12 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all text-sm cursor-pointer"
          >
            Back to Privacy & Consent
          </button>
        </div>
      </div>
    </div>
  );
}
