import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";

// Question 1: Female hair loss options with reference image paths
const FEMALE_SHEDDING_OPTIONS = [
  { id: "minimal", label: "Minimal shedding", desc: "~20 strands", img: "/strands/less.png" },
  { id: "noticeable", label: "Noticeable hair fall", desc: "clumps in drain", img: "/strands/moderate.png" },
  { id: "heavy", label: "Heavy shedding", desc: "100+ strands daily", img: "/strands/minimum.png" }
];

// Question 2: Female pattern stage options
const FEMALE_STAGE_OPTIONS = [
  { id: "1", label: "Stage 1", desc: "Early or unnoticeable shifts", img: "/stagesf/stage1.png" },
  { id: "2", label: "Stage 2", desc: "Noticeable widening at partition line", img: "/stagesf/stage2.png" },
  { id: "3", label: "Stage 3", desc: "Advanced structural crown exposure", img: "/stagesf/stage3.png" },
  { id: "overall-thinning", label: "Overall Thinning", desc: "Diffuse loss across entire scalp", img: "/stagesf/overall.png" },

];

export default function Section2Female({ onComplete, onBack }) {
  const { state, updateHairHealth } = useQuiz();
  const [subStep, setSubStep] = useSectionStep("section2Female", 5, 0);
  const [errors, setErrors] = useState(null);
  const [localForm, setLocalForm] = useState({
    shedding_amount: state?.hairHealth?.shedding_amount || "",
    hair_fall_zone: state?.hairHealth?.hair_fall_zone || "",
    daily_loss_amount: state?.hairHealth?.daily_loss_amount || "",
    dandruff_experience: state?.hairHealth?.dandruff_experience || "",
    family_history: state?.hairHealth?.family_history || "",
    loss_duration: state?.hairHealth?.loss_duration || "",
  });

  const handleSelect = (field, id) => {
    setLocalForm((prev) => ({ ...prev, [field]: id }));
    setErrors(null);
  };

  const handleContinue = () => {
    if (subStep === 0 && !localForm.shedding_amount) {
      setErrors("Please select an option that closely describes your volume of hair loss.");
      return;
    }
    if (subStep === 1 && !localForm.hair_fall_zone) {
      setErrors("Please select a pattern type profile that matches your current thickness.");
      return;
    }
    if (subStep === 2 && !localForm.daily_loss_amount) {
      setErrors("Please select an estimated daily volume range.");
      return;
    }
    if (subStep === 3 && !localForm.dandruff_experience) {
      setErrors("Please clarify your dandruff frequency profile.");
      return;
    }
    if (subStep === 4 && !localForm.family_history) {
      setErrors("Please select a genetic background scenario choice.");
      return;
    }
    if (subStep === 5) {
      if (!localForm.loss_duration) {
        setErrors("Please clarify your hair thinning duration timeline.");
        return;
      }
      if (updateHairHealth) updateHairHealth(localForm);
      if (onComplete) onComplete();
      return;
    }

    setSubStep((prev) => prev + 1);
  };

  const handleBackNavigation = () => {
    if (subStep > 0) {
      setSubStep((prev) => prev - 1);
      setErrors(null);
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-4 px-4 mb-8">
      <div className="bg-white rounded-[24px] p-5 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-gray-100 text-left">
        
        {errors && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-xl mb-4 flex gap-2">
            <span>⚠️</span> {errors}
          </div>
        )}

        {/* 1️⃣ QUESTION 1: FEMALE SHEDDING LEVEL SELECTOR */}
        {subStep === 0 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-4">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (1/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">How much hair do you lose when you comb or wash?</h2>
              <p className="text-gray-400 mt-1 text-xs">Estimated volume during daily grooming.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full text-left mt-4">
              {FEMALE_SHEDDING_OPTIONS.map((opt) => {
                const isSelected = localForm.shedding_amount === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect("shedding_amount", opt.id)}
                    className={`flex flex-col border rounded-2xl p-4 transition-all duration-200 text-left justify-between group cursor-pointer bg-white w-full ${
                      isSelected ? "border-[#064e3b] ring-1 ring-[#064e3b]/10 bg-emerald-50/5" : "border-gray-200/80 hover:border-gray-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="mb-3 w-full flex justify-between items-start gap-1">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 tracking-tight leading-tight">{opt.label}</h4>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300 bg-white"}`}>
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>
                    </div>

                    <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center relative shadow-2xs">
                      <img 
                        src={opt.img} 
                        alt={opt.label} 
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?auto=format&fit=crop&w=300&q=80";
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2️⃣ QUESTION 2: FEMALE HAIR VOLUME SPECIFICATION GRID */}
        {subStep === 1 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-4">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (2/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">What best describes your current volume of hair?</h2>
              <p className="text-gray-400 mt-1 text-xs">Select the graphic representation that matches your layout framework.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full text-left mt-4">
              {FEMALE_STAGE_OPTIONS.map((opt) => {
                const isSelected = localForm.hair_fall_zone === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect("hair_fall_zone", opt.id)}
                    className={`flex flex-col border rounded-2xl p-4 transition-all duration-200 text-left justify-between group cursor-pointer bg-white w-full ${
                      isSelected ? "border-[#064e3b] ring-1 ring-[#064e3b]/10 bg-emerald-50/5" : "border-gray-200/80 hover:border-gray-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="mb-3 w-full flex justify-between items-start gap-1">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 tracking-tight leading-tight">{opt.label}</h4>
                        <p className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300 bg-white"}`}>
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>
                    </div>

                    <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center relative shadow-2xs">
                      <img 
                        src={opt.img} 
                        alt={opt.label} 
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?auto=format&fit=crop&w=300&q=80";
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3️⃣ QUESTION 3: STRAND LOSS QUANTITY VOLUME */}
        {subStep === 2 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (3/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Estimate your total daily strand loss amount</h2>
              <p className="text-gray-400 mt-1 text-xs">Distinguishing chronic triggers from traditional telogen phase shifts.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { id: "under_50", label: "Less than 50 strands (Normal)" },
                { id: "50_100", label: "50-100 strands (Moderate)" },
                { id: "100_150", label: "100-150 strands (Heavy)" },
                { id: "over_150", label: "More than 150 strands (Severe)" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect("daily_loss_amount", opt.id)}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-sm bg-white cursor-pointer ${
                    localForm.daily_loss_amount === opt.id ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{opt.label}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${localForm.daily_loss_amount === opt.id ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm.daily_loss_amount === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4️⃣ QUESTION 4: UPDATED DANDRUFF OPTIONS VIEW */}
        {subStep === 3 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (4/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Do you experience dandruff on your scalp?</h2>
              <p className="text-gray-400 mt-1 text-xs">Scale building blocks block vital moisture pathways over time.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { id: "frequent", label: "Heavy dandruff" },
                { id: "moderate", label: "Moderate dandruff" },
                { id: "no", label: "No dandruff" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect("dandruff_experience", opt.id)}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-sm bg-white cursor-pointer ${
                    localForm.dandruff_experience === opt.id ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{opt.label}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${localForm.dandruff_experience === opt.id ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm.dandruff_experience === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5️⃣ QUESTION 5: GENETIC HISTORY */}
        {subStep === 4 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (5/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Family history of thinning / baldness?</h2>
              <p className="text-gray-400 mt-1 text-xs">Genetic inheritance channels play a core role.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { id: "mother", label: "Mother's side (Mother,Grandmother)" },
                { id: "father", label: "Father's side (Father,Grandfather)" },
                { id: "both", label: "Both sides of the family tree" },
                { id: "none", label: "No family history recorded" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect("family_history", opt.id)}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-sm bg-white cursor-pointer ${
                    localForm.family_history === opt.id ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{opt.label}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${localForm.family_history === opt.id ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm.family_history === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 6️⃣ QUESTION 6: DURATION */}
        {subStep === 5 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (6/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">How long have you been facing hair thinning?</h2>
              <p className="text-gray-400 mt-1 text-xs">Isolating acute phase disruptions from longstanding miniaturization paths.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { id: "under_6m", label: "Less than 6 months" },
                { id: "6m_1y", label: "6 months to 1 year" },
                { id: "1y_3y", label: "1 to 3 years" },
                { id: "over_3y", label: "More than 3 years" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect("loss_duration", opt.id)}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-sm bg-white cursor-pointer ${
                    localForm.loss_duration === opt.id ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span>{opt.label}</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${localForm.loss_duration === opt.id ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm.loss_duration === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Button Navigation Controls Area Footer */}
        <div className="pt-4 border-t border-gray-100 flex items-center gap-3 w-full mt-6">
          <button 
            type="button" 
            onClick={handleBackNavigation} 
            className="flex-1 h-11 border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-sm text-center cursor-pointer"
          >
            Back
          </button>
          
          <button 
            type="button" 
            onClick={handleContinue} 
            className="flex-[2] h-11 bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all text-sm shadow-xs text-center cursor-pointer"
          >
            {subStep === 5 ? "Complete Hair Section" : "Continue →"}
          </button>
        </div>

      </div>
    </div>
  );
}