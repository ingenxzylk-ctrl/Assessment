import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";

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
  iron_level: {
    title: "Have you ever been told that your iron level is low?",
    subtitle: "Low iron can be relevant to hair shedding,but only a blood test can confirm it.",
  },
  symptoms: {
    title: "Do you experience any of these?",
    subtitle: "Select all options that apply to you.",
  },
  life_stage: {
    title: "Which applies to your current life stage?",
    subtitle: "Hormonal shifts directly affect scalp health.",
  },
  digestion: {
    title: "Do you have ongoing digestion symptoms?",
    subtitle: "Gut health impacts nutrient absorption.",
  },
  sleep_cycle: {
    title: "How many hours do you sleep on average?",
    subtitle: "Cellular regeneration happens during deep sleep.",
  },
  stress_level: {
    title: "What is your current stress level?",
    subtitle: "Cortisol spikes push hair into a shedding phase.",
  },
  energy_level: {
    title: "How would you describe your energy on most days?",
    subtitle: "Low energy can be useful context alongside sleep,stress,and nutrition.",
  },
  supplements: {
    title: "Do you take supplements or vitamins?",
    subtitle: "Current nutrient tracking prevents over-supplementation.",
  },
  food_habits: {
    title: "What are your food habits?",
    subtitle: "Dietary building blocks build hair proteins.",
  },
};

const OPTION_BTN =
  "w-full min-h-[56px] px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left cursor-pointer";
const OPTION_SELECTED = "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]";
const OPTION_IDLE = "border-gray-200 text-gray-700 hover:bg-gray-50";

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
    food_habits: state?.internalHealth?.food_habits || "",
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

    if (currentStep === "symptoms") {
      if (!localForm.symptoms || localForm.symptoms.length === 0) {
        e.symptoms = "Please select at least one option";
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
    } else {
      if (updateInternalHealth) updateInternalHealth(localForm);
      if (onComplete) onComplete();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((prev) => prev - 1);
    else if (onBack) onBack();
  };

  const radioOption = (opt, field) => {
    const isSelected = localForm[field] === opt;
    return (
      <button
        key={opt}
        type="button"
        onClick={() => handleSelect(field, opt)}
        className={`${OPTION_BTN} ${isSelected ? OPTION_SELECTED : OPTION_IDLE}`}
      >
        <span className="pr-3 leading-snug">{opt}</span>
        <div
          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
            isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"
          }`}
        >
          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-xl mx-auto mt-6 px-4">
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="mb-6">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            HEALTH ({step + 1}/{STEPS.length})
          </span>
          <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">
            {headingInfo?.title}
          </h2>
          <p className="text-gray-500 mt-2 text-base">{headingInfo?.subtitle}</p>
        </div>

        <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
          {currentStep === "iron_level" && (
            <div className="grid grid-cols-1 gap-3">
              {["No,my iron was normal ", "Yes,i was diagnosed with low iron or anemia", "i have Never Checked"].map((opt) =>
                radioOption(opt, "iron_level")
              )}
            </div>
          )}

          {currentStep === "symptoms" && (
            <div className="grid grid-cols-1 gap-3">
              {[
                "Irregular or absent Periods",
                "Diagnosed PCOS / PCOD ",
                "Ongoing or Extreme Fatigue",
                "Diagnosed Thyroid issue",
                "Increased facial hair",
                "Acne around the chin or lower face",
                "None of these",
              ].map((opt) => {
                const isSelected = localForm.symptoms.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleToggleMulti("symptoms", opt)}
                    className={`${OPTION_BTN} ${isSelected ? OPTION_SELECTED : OPTION_IDLE}`}
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
                );
              })}
            </div>
          )}

          {[
            "life_stage",
            "digestion",
            "sleep_cycle",
            "stress_level",
            "energy_level",
            "supplements",
            "food_habits",
          ].includes(currentStep) && (
            <div className="grid grid-cols-1 gap-3">
              {(currentStep === "life_stage"
                ? [
                    "Planning a pregnancy",
                    "Currently Pregnant",
                    "Postpartum or breastfeeding",
                    "Perimenopause or menopause",
                    "None of these",
                  ]
                : currentStep === "digestion"
                  ? ["No ongoing symptoms ", "Occasional bloating,reflux,diarrhea,or constipation", "Frequent symptoms","Diagnosed digestive condition"]
                  : currentStep === "sleep_cycle"
                    ? ["Under 5 hours", "5–6 hours", "7–8 hours", "More than 8 hours"]
                    : currentStep === "stress_level"
                      ? ["Low or Manageable", "Moderate", "High", "Very high or recent major stress"]
                      : currentStep === "energy_level"
                        ? ["Steady most of the day", "Afternoon dip ", "Low most of the day","It varies a lot"]
                        : currentStep === "supplements"
                          ? ["Yes", "No"]
                          : [" Vegetarian", "Non-Vegetarian"]
              ).map((opt) => radioOption(opt, currentStep))}
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
            className="flex-1 h-14 flex items-center justify-center border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="h-14 flex items-center justify-center bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all shadow-sm text-base flex-[2] cursor-pointer"
          >
            {step === STEPS.length - 1 ? "Continue to Scan →" : "Next Question →"}
          </button>
        </div>
      </div>
    </div>
  );
}