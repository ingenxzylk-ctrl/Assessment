import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import { HAIR_FALL_LOCATION } from "../../data/questions";

const HAIR_STAGES = [
  { id: "1", title: "Stage 1", desc: "No visible recession.", img: "/stages/Stage1.png" },
  { id: "2", title: "Stage 2", desc: "Minor recession at temples.", img: "/stages/Stage2.png" },
  { id: "3", title: "Stage 3", desc: "Clear M-shape recession.", img: "/stages/Stage3.png" },
  { id: "4", title: "Stage 4", desc: "Receding hairline + thin crown.", img: "/stages/Stage4.png" },
  { id: "5", title: "Stage 5", desc: "Significant bridge thinning.", img: "/stages/Stage5.png" },
  { id: "6", title: "Stage 6", desc: "Bridge completely depleted.", img: "/stages/Stage6.png" },
  { id: "7", title: "Stage 7", desc: "Severe loss; horseshoe pattern.", img: "/stages/Stage7.png" },
  { 
    id: "overall-thinning", 
    title: "Overall Thinning", 
    desc: "Diffuse thinning across the entire scalp area.", 
    img: "/stages/overall_thinning.png" 
  }
];

const HAIR_ZONES = HAIR_FALL_LOCATION;
export default function Section2Male({ onComplete, onBack }) {
  const { state, updateHairHealth } = useQuiz();
  const [subStep, setSubStep] = useSectionStep("section2Male", 5, 0);
  const [errors, setErrors] = useState(null);
  
  const [localForm, setLocalForm] = useState({
    norwood_stage: state?.hairHealth?.norwood_stage || "",
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
    if (subStep === 0 && !localForm.norwood_stage) {
      setErrors("Please select a profile that closely matches your current hair pattern.");
      return;
    }
    if (subStep === 1 && !localForm.hair_fall_zone) {
      setErrors("Please select where you notice your hair fall the most.");
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
        setErrors("Please clarify your hair loss duration timeline.");
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
      <div className="bg-white rounded-[24px] p-5 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 text-left">
        
        {errors && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-xl mb-4 flex gap-2">
            <span>⚠️</span> {errors}
          </div>
        )}

        {/* 1️⃣ QUESTION 1: HAIR LOSS PATTERN SELECTOR */}
        {subStep === 0 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-4">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (1/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">What stage best describes your hair fall?</h2>
              <p className="text-gray-400 mt-1 text-xs">Select the image profile that closest matches your current hairline pattern.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full text-left mt-4">
              {HAIR_STAGES.map((stage) => {
                const isSelected = localForm.norwood_stage === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => handleSelect("norwood_stage", stage.id)}
                    className={`flex flex-col border rounded-2xl p-3.5 transition-all duration-200 text-left justify-between group cursor-pointer bg-white w-full ${
                      isSelected ? "border-[#064e3b] ring-1 ring-[#064e3b]/10 bg-emerald-50/5" : "border-gray-200/80 hover:border-gray-300"
                    }`}
                  >
                    <div className="mb-3 w-full flex justify-between items-start gap-1">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 tracking-tight truncate">{stage.title}</h4>
                        <p className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5 truncate max-w-[200px]">{stage.desc}</p>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300 bg-white"}`}>
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center relative shadow-2xs">
                      <img src={stage.img} alt={stage.title} className="w-full h-full object-contain p-1.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2️⃣ QUESTION 2: WHERE DO YOU NOTICE HAIR LOSS MOST */}
        {subStep === 1 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-4">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (2/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Where do you notice hair loss most?</h2>
              <p className="text-gray-400 mt-1 text-xs">Pinpointing the active zones helps isolate root causes.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full text-left mt-4">
              {HAIR_ZONES.map((opt) => {
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
                      <span className="text-sm font-bold text-gray-900 tracking-tight leading-tight">{opt.label}</span>
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

        {/* 3️⃣ QUESTION 3: DAILY STRAND LOSS QUANTITY */}
        {subStep === 2 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (3/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Estimate your daily hair strand loss amount</h2>
              <p className="text-gray-400 mt-1 text-xs">Tracking volume distinguishes normal shedding from active telogen phase shifts.</p>
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

        {/* 4️⃣ QUESTION 4: 🟢 UPDATED MALE DANDRUFF OPTIONS VIEW */}
        {subStep === 3 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (4/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Do you experience dandruff on your scalp?</h2>
              <p className="text-gray-400 mt-1 text-xs">Scale deposits can compress active hair follicles over time.</p>
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

        {/* 5️⃣ QUESTION 5: GENETIC ADRENAL VECTOR HISTORY */}
        {subStep === 4 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (5/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">Family history of baldness / hair loss?</h2>
              <p className="text-gray-400 mt-1 text-xs">Genetic predisposition acts as a primary vector.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { id: "mother", label: "Mother's side(Uncle,Grandfather)" },
                { id: "father", label: "Father's side(Uncle,Grandfather)" },
                { id: "both", label: "Both sides" },
                { id: "none", label: "None" }
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

        {/* 6️⃣ QUESTION 6: HAIR LOSS TIMELINE HISTORY DURATION */}
        {subStep === 5 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
                HAIR HEALTH (6/6)
              </span>
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">How long have you been facing hair loss?</h2>
              <p className="text-gray-400 mt-1 text-xs">Understanding the timeline helps distinguish acute from chronic patterns.</p>
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

        {/* Bottom Panel Wizard Trigger controls row */}
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
            {subStep === 5 ? "Complete Hair Section" : "Next Question →"}
          </button>
        </div>

      </div>
    </div>
  );
}