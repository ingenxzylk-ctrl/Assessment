import { useState } from "react";

export default function Section0Consent({ onComplete, onBack }) {
  const [checkedItems, setCheckedItems] = useState({
    contactAuth: false,
    dataPrivacy: false,
    scalpAnalysis: false,
  });

  const handleCheckboxChange = (key) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllAccepted = Object.values(checkedItems).every(Boolean);

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        
        {/* Header Branding */}
        <div className="mb-6 text-center">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            Privacy & Trust
          </span>
          <h2 className="text-[26px] font-bold text-gray-900 mt-4 leading-tight">Data Authorization & Terms</h2>
          <p className="text-gray-500 mt-2 text-sm">Please review how we handle your information before starting the diagnosis.</p>
        </div>

        {/* Informational Summary Statement */}
        <div className="text-xs text-gray-600 leading-relaxed space-y-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
          <p>
            At <strong>Zylk Health</strong>, we prioritize the clinical security of your personal profiles. The diagnostic quiz uses advanced AI systems to analyze your hair loss metrics and deliver localized treatment routines.
          </p>
          <p>
            All submitted datasets are encrypted in transit and handled strictly within our isolated sandbox networks under automated medical compliance practices.
          </p>
        </div>

        {/* Interactive Checkbox List */}
        <div className="space-y-4">
          
          {/* Item 1: Contact Methods */}
          <label className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200/60 cursor-pointer hover:border-[#064e3b]/20 transition-all select-none bg-white">
            <input
              type="checkbox"
              checked={checkedItems.contactAuth}
              onChange={() => handleCheckboxChange("contactAuth")}
              className="mt-1 w-5 h-5 rounded accent-[#064e3b] text-[#064e3b] focus:ring-[#064e3b] shrink-0"
            />
            <div className="text-sm text-gray-700 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block mb-0.5">Contact Notification Consent</span>
              I authorize Zylk Health to use my provided phone number and email address to send my final clinical report, automated updates, and treatment summaries.
            </div>
          </label>

          {/* Item 2: Personal Info Data Privacy */}
          <label className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200/60 cursor-pointer hover:border-[#064e3b]/20 transition-all select-none bg-white">
            <input
              type="checkbox"
              checked={checkedItems.dataPrivacy}
              onChange={() => handleCheckboxChange("dataPrivacy")}
              className="mt-1 w-5 h-5 rounded accent-[#064e3b] text-[#064e3b] focus:ring-[#064e3b] shrink-0"
            />
            <div className="text-sm text-gray-700 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block mb-0.5">Personal Data Processing Acknowledgement</span>
              I confirm that all health metrics, age boundaries, lifestyle patterns, and personal information provided during this quiz are given voluntarily with my explicit consent.
            </div>
          </label>

          {/* Item 3: Scalp Scanning AI Analysis */}
          <label className="flex items-start gap-4 p-4 rounded-2xl border border-gray-200/60 cursor-pointer hover:border-[#064e3b]/20 transition-all select-none bg-white">
            <input
              type="checkbox"
              checked={checkedItems.scalpAnalysis}
              onChange={() => handleCheckboxChange("scalpAnalysis")}
              className="mt-1 w-5 h-5 rounded accent-[#064e3b] text-[#064e3b] focus:ring-[#064e3b] shrink-0"
            />
            <div className="text-sm text-gray-700 font-medium leading-relaxed">
              <span className="font-bold text-gray-900 block mb-0.5">AI Computer Vision Scalp Analysis Authorization</span>
              I authorize the application to process my high-resolution scalp image captures using modern multimodal AI algorithms solely to calculate follicular density variations and crown area trends.
            </div>
          </label>

        </div>

        {/* Navigation Actions Panel */}
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
            disabled={!isAllAccepted}
            onClick={onComplete}
            className="flex-[2] h-14 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm text-base cursor-pointer"
          >
            Accept & Start Quiz
          </button>
        </div>

      </div>
    </div>
  );
}