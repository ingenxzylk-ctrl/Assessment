import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import {
  HEALTH_SLEEP_OPTIONS,
  HEALTH_STRESS_OPTIONS,
  HEALTH_CONDITION_OPTIONS,
  HEALTH_DIGESTIVE_OPTIONS,
  HEALTH_DIET_WEIGHT_OPTIONS,
  HEALTH_ENERGY_OPTIONS,
  HEALTH_SUPPLEMENT_OPTIONS,
  HEALTH_PRESCRIPTION_OPTIONS,
} from "../../data/questions";

const STEPS = [
  "sleep_cycle",
  "stress_level",
  "health_conditions",
  "bowel",
  "diet_weight_change",
  "energy_level",
  "supplements",
  "prescription_medicines",
];

const STEP_TITLES = {
  sleep_cycle: {
    title: "How many hours do you usually sleep each night?",
    subtitle:
      "Sleep and changes in routine can influence overall wellbeing and may be relevant when assessing hair shedding.",
  },
  stress_level: {
    title: "What has your stress level been like over the past 3 months?",
    subtitle: "Major or ongoing stress can sometimes be linked with increased hair shedding.",
  },
  health_conditions: {
    title: "Have you been diagnosed with any of these conditions?",
    subtitle:
      "Some health conditions can affect hair growth or influence which recommendations are suitable. Select all that apply.",
  },
  bowel: {
    title: "Do you have ongoing digestive symptoms?",
    subtitle: "Persistent digestive issues can affect comfort and, in some cases, nutrition.",
  },
  diet_weight_change: {
    title: "Have you had a major change in diet or weight recently?",
    subtitle: "Rapid weight change or restrictive dieting can sometimes contribute to increased shedding.",
  },
  energy_level: {
    title: "How would you describe your energy on most days?",
    subtitle: "Low energy can be useful context alongside sleep, stress, and nutrition.",
  },
  supplements: {
    title: "Are you currently taking vitamins or supplements?",
    subtitle: "This helps us avoid duplicate recommendations and tailor your report.",
  },
  prescription_medicines: {
    title: "Are you currently taking any prescription medicines?",
    subtitle: "Some medicines may affect hair or interact with treatment recommendations.",
  },
};

const OPTIONS = {
  sleep_cycle: HEALTH_SLEEP_OPTIONS,
  stress_level: HEALTH_STRESS_OPTIONS,
  bowel: HEALTH_DIGESTIVE_OPTIONS,
  diet_weight_change: HEALTH_DIET_WEIGHT_OPTIONS,
  energy_level: HEALTH_ENERGY_OPTIONS,
  supplements: HEALTH_SUPPLEMENT_OPTIONS,
  prescription_medicines: HEALTH_PRESCRIPTION_OPTIONS,
};

export default function Section3InternalHealthMale({ onComplete, onBack }) {
  const { state, updateInternalHealth } = useQuiz();
  const [step, setStep] = useSectionStep("section3Male", STEPS.length - 1, 0);
  const [otherCondition, setOtherCondition] = useState(
    state?.internalHealth?.otherConditionDetails || ""
  );
  const [errors, setErrors] = useState({});

  const [localForm, setLocalForm] = useState({
    sleep_cycle: state?.internalHealth?.sleep_cycle || "",
    stress_level: state?.internalHealth?.stress_level || "",
    health_conditions: state?.internalHealth?.health_conditions || [],
    bowel: state?.internalHealth?.bowel || "",
    diet_weight_change: state?.internalHealth?.diet_weight_change || "",
    energy_level: state?.internalHealth?.energy_level || "",
    supplements: state?.internalHealth?.supplements || "",
    prescription_medicines:
      state?.internalHealth?.prescription_medicines ||
      state?.internalHealth?.blood_pressure ||
      "",
  });

  const currentStep = STEPS[step];
  const headingInfo = STEP_TITLES[currentStep];

  const handleSelect = (field, value) => {
    setLocalForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleToggleMulti = (field, value) => {
    setLocalForm((prev) => {
      let current = [...(prev[field] || [])];
      if (value === "None of these or not sure") {
        current = current.includes(value) ? [] : [value];
      } else {
        current = current.filter((item) => item !== "None of these or not sure");
        current = current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value];
      }
      return { ...prev, [field]: current };
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (currentStep === "health_conditions") {
      if (!localForm.health_conditions || localForm.health_conditions.length === 0) {
        e.health_conditions = "Please select at least one option";
      }
    } else if (!localForm[currentStep]) {
      e[currentStep] = "Please select an option to continue";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
      return;
    }

    const finalForm = {
      ...localForm,
      // Keep legacy key for older report readers
      blood_pressure: localForm.prescription_medicines,
      gas_acidity: localForm.diet_weight_change,
    };
    if (localForm.health_conditions.includes("Other") && otherCondition.trim()) {
      finalForm.otherConditionDetails = otherCondition.trim();
    }

    if (updateInternalHealth) updateInternalHealth(finalForm);
    if (onComplete) onComplete();
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
            HEALTH ({step + 1}/{STEPS.length})
          </span>
          <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">
            {headingInfo.title}
          </h2>
          <p className="text-gray-500 mt-2 text-base">{headingInfo.subtitle}</p>
        </div>

        <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
          {currentStep === "health_conditions" && (
            <div className="grid grid-cols-1 gap-3">
              {HEALTH_CONDITION_OPTIONS.map((opt) => {
                const isSelected = localForm.health_conditions.includes(opt);
                return (
                  <div key={opt} className="w-full space-y-2">
                    <button
                      type="button"
                      onClick={() => handleToggleMulti("health_conditions", opt)}
                      className={`w-full min-h-[56px] px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left ${
                        isSelected
                          ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="pr-3 leading-snug">{opt}</span>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                          isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"
                        }`}
                      >
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

          {OPTIONS[currentStep] && (
            <div className="grid grid-cols-1 gap-3">
              {OPTIONS[currentStep].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(currentStep, opt)}
                  className={`w-full min-h-[56px] px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left ${
                    localForm[currentStep] === opt
                      ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="pr-3 leading-snug">{opt}</span>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      localForm[currentStep] === opt
                        ? "border-[#064e3b] bg-[#064e3b]"
                        : "border-gray-300"
                    }`}
                  >
                    {localForm[currentStep] === opt && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {errors[currentStep] && (
            <p className="text-sm text-red-500 font-medium mt-3 text-center">{errors[currentStep]}</p>
          )}
        </div>

        <div className="flex items-center gap-4 mt-10 w-full">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 h-14 flex items-center justify-center border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-base"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="h-14 flex items-center justify-center bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all shadow-sm text-base flex-[2]"
          >
            {step === STEPS.length - 1 ? "Continue to Scan →" : "Next Question →"}
          </button>
        </div>
      </div>
    </div>
  );
}
