import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";

const STEPS = [
  "sleep_cycle",
  "stress_level",
  "health_conditions",
  "bowel",
  "gas_acidity",
  "energy_level",
  "supplements",
  "blood_pressure",
];

const STEP_TITLES = {
  sleep_cycle: { title: "How many hours do you sleep on average?", subtitle: "Inadequate sleep stunts protein synthesis metrics." },
  stress_level: { title: "What is your current stress level?", subtitle: "High anxiety speeds up DHT sensitivity triggers." },
  health_conditions: { title: "Do you have any existing health conditions?", subtitle: "Select all that apply to you." },
  bowel: { title: "How are your bowel movements?", subtitle: "Clear patterns ensure metabolic waste elimination." },
  gas_acidity: { title: "Do you experience gas, acidity, or bloating?", subtitle: "Indigestion creates internal micro-inflammation paths." },
  energy_level: { title: "How is your daytime energy level?", subtitle: "Vitality tracking spots macro-nutrient deficits." },
  supplements: { title: "Do you take supplements or vitamins?", subtitle: "Helps tailor nutritional adjustments." },
  blood_pressure: { title: "What is your blood pressure status?", subtitle: "Circulation dynamics feed oxygen to root matrices." },
};

export default function Section3InternalHealthMale({ onComplete, onBack }) {
  const { state, updateInternalHealth } = useQuiz();
  const [step, setStep] = useSectionStep("section3Male", STEPS.length - 1, 0);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [otherCondition, setOtherCondition] = useState("");
  const [errors, setErrors] = useState({});

  const [localForm, setLocalForm] = useState({
    sleep_cycle: state?.internalHealth?.sleep_cycle || "",
    stress_level: state?.internalHealth?.stress_level || "",
    health_conditions: state?.internalHealth?.health_conditions || [],
    bowel: state?.internalHealth?.bowel || "",
    gas_acidity: state?.internalHealth?.gas_acidity || "",
    energy_level: state?.internalHealth?.energy_level || "",
    supplements: state?.internalHealth?.supplements || "",
    blood_pressure: state?.internalHealth?.blood_pressure || "",
  });

  const currentStep = STEPS[step];
  const headingInfo = STEP_TITLES[currentStep];

  const handleSelect = (field, value) => {
    setLocalForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleToggleMulti = (field, value) => {
    setLocalForm((prev) => {
      const current = prev[field];
      const updated = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [field]: updated };
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
  

    if (currentStep === "health_conditions") {
      if (!localForm.health_conditions || localForm.health_conditions.length === 0) {
        e.health_conditions = "Please select at least one option";
      }
    } else {
      if (!localForm[currentStep]) {
        e[currentStep] = "Please select an option to continue";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      // Append manual input strings if "Other" condition is flagged active
      const finalForm = { ...localForm };
      if (localForm.health_conditions.includes("Other") && otherCondition.trim()) {
        finalForm.otherConditionDetails = otherCondition.trim();
      }

      if (updateInternalHealth) updateInternalHealth(finalForm);
      if (onComplete) onComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
    else if (onBack) onBack();
  };

  return (
    <div className="max-w-xl mx-auto mt-6 px-4">
      

      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="mb-6">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            INTERNAL HEALTH ({step + 1}/{STEPS.length})
          </span>
          <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">{headingInfo.title}</h2>
          <p className="text-gray-500 mt-2 text-base">{headingInfo.subtitle}</p>
        </div>

        <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
          {currentStep === "health_conditions" && (
            <div className="grid grid-cols-1 gap-3">
              {["Diabetes / High Blood Sugar", "Thyroid Issues", "High Cholesterol", "Other", "None / Perfectly Healthy"].map((opt) => {
                const isSelected = localForm.health_conditions.includes(opt);
                return (
                  <div key={opt} className="w-full space-y-2">
                    <button
                      type="button"
                      onClick={() => handleToggleMulti("health_conditions", opt)}
                      className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left ${
                        isSelected ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                    >
                      <span>{opt}</span>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                    </button>
                    {opt === "Other" && isSelected && (
                      <input
                        type="text"
                        value={otherCondition}
                        onChange={(e) => setOtherCondition(e.target.value)}
                        placeholder="Please specify condition details here"
                        className="w-full h-12 px-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#064e3b] bg-white text-gray-900 text-sm transition-all"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {["sleep_cycle", "stress_level", "bowel", "gas_acidity", "energy_level", "supplements", "blood_pressure"].includes(currentStep) && (
            <div className="grid grid-cols-1 gap-3">
              {(currentStep === "sleep_cycle" ? ["Less than 5 hours", "6 to 8 hours", "9+ hours"] :
                currentStep === "stress_level" ? ["Low / Manageable", "Moderate / Daily Tension", "High / Severe Stress"] :
                currentStep === "bowel" ? ["Regular every morning", "Irregular / Loose", "Chronic Constipation / Hard"] :
                currentStep === "gas_acidity" ? ["Never / Rare", "Occasionally", "Frequently / Chronic Bloating"] :
                currentStep === "energy_level" ? ["Normal", "Low in afternoon ", "Very Low"] :
                currentStep === "supplements" ? ["Yes","No"] :
                ["Normal (120/80)", "Diagnosed High BP", "Low Blood Pressure"]
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(currentStep, opt)}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left ${
                    localForm[currentStep] === opt ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{opt}</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${localForm[currentStep] === opt ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm[currentStep] === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {errors[currentStep] && <p className="text-sm text-red-500 font-medium mt-3 text-center">{errors[currentStep]}</p>}
          {errors.privacy && <p className="text-sm text-red-500 font-medium mt-3 text-center">{errors.privacy}</p>}
        </div>

        <div className="flex items-center gap-4 mt-10 w-full">
          <button type="button" onClick={handleBack} className="flex-1 h-14 flex items-center justify-center border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-base">
            Back
          </button>
          <button type="button" onClick={handleContinue} className="h-14 flex items-center justify-center bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all shadow-sm text-base flex-[2]">
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
}