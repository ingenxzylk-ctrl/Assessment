import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import {
  HEALTH_SLEEP_OPTIONS,
  HEALTH_STRESS_OPTIONS,
  HEALTH_ENERGY_OPTIONS,
  HEALTH_SUPPLEMENT_OPTIONS,
} from "../../data/questions";

const STEPS = [
  "iron_level",
  "symptoms",
  "life_stage",
  "digestion",
  "sleep_cycle",
  "stress_level",
  "energy_level",
  "supplements",
  "food_habits",
];

const STEP_TITLES = {
  iron_level: { title: "What is your iron level status?", subtitle: "Iron levels heavily affect hair growth cycles." },
  symptoms: { title: "Do you experience any of these?", subtitle: "Select all options that apply to you." },
  life_stage: { title: "Which applies to your current life stage?", subtitle: "Hormonal shifts directly affect scalp health." },
  digestion: {
    title: "Do you have ongoing digestive symptoms?",
    subtitle: "Persistent digestive issues can affect comfort and, in some cases, nutrition.",
  },
  sleep_cycle: {
    title: "How many hours do you usually sleep each night?",
    subtitle:
      "Sleep and changes in routine can influence overall wellbeing and may be relevant when assessing hair shedding.",
  },
  stress_level: {
    title: "What has your stress level been like over the past 3 months?",
    subtitle: "Major or ongoing stress can sometimes be linked with increased hair shedding.",
  },
  energy_level: {
    title: "How would you describe your energy on most days?",
    subtitle: "Low energy can be useful context alongside sleep, stress, and nutrition.",
  },
  supplements: {
    title: "Are you currently taking vitamins or supplements?",
    subtitle: "This helps us avoid duplicate recommendations and tailor your report.",
  },
  food_habits: { title: "What are your food habits?", subtitle: "Dietary building blocks build hair proteins." },
};

export default function Section3Female({ onComplete, onBack }) {
  const { state, updateInternalHealth } = useQuiz();
  const [step, setStep] = useSectionStep("section3Female", STEPS.length - 1, 0);
  const [errors, setErrors] = useState({});

  const [localForm, setLocalForm] = useState({
    iron_level: state?.internalHealth?.iron_level || "",
    symptoms: state?.internalHealth?.symptoms || [],
    life_stage: state?.internalHealth?.life_stage || "",
    digestion: state?.internalHealth?.digestion || "",
    sleep_cycle: state?.internalHealth?.sleep_cycle || "",
    stress_level: state?.internalHealth?.stress_level || "",
    energy_level: state?.internalHealth?.energy_level || "",
    supplements: state?.internalHealth?.supplements || "",
    food_habits: state?.internalHealth?.food_habits || ""
  });

  const currentStep = STEPS[step];
  const headingInfo = STEP_TITLES[currentStep];

  const handleSelect = (field, value) => {
    setLocalForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleToggleMulti = (field, value) => {
    setLocalForm((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field] : [];
      if (value === "None of these") {
        return {
          ...prev,
          [field]: current.includes("None of these") ? [] : ["None of these"],
        };
      }
      const withoutNone = current.filter((item) => item !== "None of these");
      const updated = withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
      return { ...prev, [field]: updated };
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const isCurrentAnswered = () => {
    if (currentStep === "symptoms") {
      return Array.isArray(localForm.symptoms) && localForm.symptoms.length > 0;
    }
    return Boolean(localForm[currentStep]);
  };

  const validate = () => {
    const e = {};

    if (currentStep === "symptoms") {
      if (!localForm.symptoms || localForm.symptoms.length === 0) {
        e.symptoms = "Please select at least one option";
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
      if (updateInternalHealth) updateInternalHealth(localForm);
      setStep((prev) => prev + 1);
    } else {
      if (updateInternalHealth) updateInternalHealth(localForm);
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
          <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">{headingInfo?.title}</h2>
          <p className="text-gray-500 mt-2 text-base">{headingInfo?.subtitle}</p>
        </div>

        <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
          {currentStep === "iron_level" && (
            <div className="grid grid-cols-1 gap-3">
              {["Normal ", "Diagnosed Low Iron ", "Never Checked"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect("iron_level", opt)}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left cursor-pointer ${
                    localForm.iron_level === opt ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{opt}</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${localForm.iron_level === opt ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm.iron_level === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {currentStep === "symptoms" && (
            <div className="grid grid-cols-1 gap-3">
              {["Irregular Periods", "PCOS / PCOD Diagnosis", "Extreme Fatigue", "Thyroid issue","Extra hair on face" ,"Pimples on chin or lower face", "None of these"].map((opt) => {
                const isSelected = localForm.symptoms.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleToggleMulti("symptoms", opt)}
                    className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left cursor-pointer ${
                      isSelected ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span>{opt}</span>
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                      {isSelected && <span className="text-white text-xs">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {["life_stage", "digestion", "sleep_cycle", "stress_level", "energy_level", "supplements", "food_habits"].includes(currentStep) && (
            <div className="grid grid-cols-1 gap-3">
              {(
                currentStep === "life_stage" ? [
                  "None",
                  "Planning to get Pregnant sometime soon",
                  "Currently Pregnant",
                  "My baby is less than 1 year old or I am breastfeeding",
                  "I don't get my periods anymore"
                ] :
                currentStep === "digestion" ? [
                  "No ongoing symptoms",
                  "Occasional bloating, reflux, diarrhea, or constipation",
                  "Frequent symptoms",
                  "Diagnosed digestive condition",
                  "Prefer not to say",
                ] :
                currentStep === "sleep_cycle" ? HEALTH_SLEEP_OPTIONS :
                currentStep === "stress_level" ? HEALTH_STRESS_OPTIONS :
                currentStep === "energy_level" ? HEALTH_ENERGY_OPTIONS :
                currentStep === "supplements" ? HEALTH_SUPPLEMENT_OPTIONS :
                ["Vegetarian", "Non-Vegetarian"]
              ).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(currentStep, opt)}
                  className={`w-full min-h-[56px] py-3 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left cursor-pointer ${
                    localForm[currentStep] === opt ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]" : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="pr-3 leading-snug">{opt}</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${localForm[currentStep] === opt ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
                    {localForm[currentStep] === opt && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {errors[currentStep] && <p className="text-sm text-red-500 font-medium mt-3 text-center">{errors[currentStep]}</p>}
        </div>

        <div className="flex items-center gap-4 mt-10 w-full">
          <button type="button" onClick={handleBack} className="flex-1 h-14 flex items-center justify-center border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer">
            Back
          </button>
          <button
            type="button"
            disabled={!isCurrentAnswered()}
            onClick={handleContinue}
            className="h-14 flex items-center justify-center bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all shadow-sm text-base flex-[2] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === STEPS.length - 1 ? "Continue to Scan →" : "Next Question →"}
          </button>
        </div>
      </div>
    </div>
  );
}