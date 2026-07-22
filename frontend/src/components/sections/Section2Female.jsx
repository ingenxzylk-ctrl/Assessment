import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import {
  HAIR_FALL_LOCATION,
  SHEDDING_OPTIONS,
  DANDRUFF_QUESTION_OPTIONS,
  SCALP_SYMPTOM_OPTIONS,
  FAMILY_HISTORY,
  LOSS_DURATION_OPTIONS,
} from "../../data/questions";

const HAIR_TOTAL = 7;

const FEMALE_STAGE_OPTIONS = [
  { id: "1", label: "Stage 1", desc: "Early or unnoticeable part-line change", img: "/stagesf/stage1.png" },
  { id: "2", label: "Stage 2", desc: "Noticeable widening at the part line", img: "/stagesf/stage2.png" },
  { id: "3", label: "Stage 3", desc: "Advanced crown or part exposure", img: "/stagesf/stage3.png" },
  {
    id: "overall-thinning",
    label: "Overall thinning",
    desc: "Diffuse thinning across the scalp",
    img: "/stagesf/overall.png",
  },
];

const LOCATION_CARDS = HAIR_FALL_LOCATION.filter((o) => o.layout === "card");
const LOCATION_ROWS = HAIR_FALL_LOCATION.filter((o) => o.layout === "row");

/** Map shedding option → legacy shedding_amount used by eligibility */
function deriveSheddingAmount(dailyLossId) {
  if (dailyLossId === "clumps" || dailyLossId === "much_more") return "heavy";
  if (dailyLossId === "slightly_more") return "noticeable";
  if (dailyLossId === "same") return "minimal";
  return dailyLossId || "";
}

export default function Section2Female({ onComplete, onBack }) {
  const { state, updateHairHealth } = useQuiz();
  const [subStep, setSubStep] = useSectionStep("section2Female", HAIR_TOTAL - 1, 0);
  const [errors, setErrors] = useState(null);
  const [localForm, setLocalForm] = useState({
    hair_fall_zone: state?.hairHealth?.hair_fall_zone || "",
    hair_loss_area: state?.hairHealth?.hair_loss_area || "",
    daily_loss_amount: state?.hairHealth?.daily_loss_amount || "",
    dandruff_experience: state?.hairHealth?.dandruff_experience || "",
    scalp_symptoms: Array.isArray(state?.hairHealth?.scalp_symptoms)
      ? state.hairHealth.scalp_symptoms
      : [],
    family_history: state?.hairHealth?.family_history || "",
    loss_duration: state?.hairHealth?.loss_duration || "",
  });

  const handleSelect = (field, id) => {
    setLocalForm((prev) => ({ ...prev, [field]: id }));
    setErrors(null);
  };

  const toggleScalpSymptom = (id) => {
    setLocalForm((prev) => {
      const current = Array.isArray(prev.scalp_symptoms) ? prev.scalp_symptoms : [];
      if (id === "none") {
        return { ...prev, scalp_symptoms: current.includes("none") ? [] : ["none"] };
      }
      const withoutNone = current.filter((x) => x !== "none");
      const next = withoutNone.includes(id)
        ? withoutNone.filter((x) => x !== id)
        : [...withoutNone, id];
      return { ...prev, scalp_symptoms: next };
    });
    setErrors(null);
  };

  const handleContinue = () => {
    if (subStep === 0 && !localForm.hair_fall_zone) {
      setErrors("Please select the pattern that looks closest to your hair today.");
      return;
    }
    if (subStep === 1 && !localForm.hair_loss_area) {
      setErrors("Please select where you have noticed hair loss or thinning.");
      return;
    }
    if (subStep === 2 && !localForm.daily_loss_amount) {
      setErrors("Please select how your shedding compares to usual.");
      return;
    }
    if (subStep === 3 && !localForm.dandruff_experience) {
      setErrors("Please select your dandruff experience.");
      return;
    }
    if (subStep === 4 && (!localForm.scalp_symptoms || localForm.scalp_symptoms.length === 0)) {
      setErrors("Please select all scalp symptoms that apply, or None of these.");
      return;
    }
    if (subStep === 5 && !localForm.family_history) {
      setErrors("Please select a family history option.");
      return;
    }
    if (subStep === 6) {
      if (!localForm.loss_duration) {
        setErrors("Please select when you first noticed the change.");
        return;
      }
      const payload = {
        ...localForm,
        shedding_amount: deriveSheddingAmount(localForm.daily_loss_amount),
      };
      if (updateHairHealth) updateHairHealth(payload);
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

  const radioRow = (opt, field) => {
    const isSelected = localForm[field] === opt.id;
    return (
      <button
        key={opt.id}
        type="button"
        onClick={() => handleSelect(field, opt.id)}
        className={`w-full min-h-[56px] px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-sm bg-white cursor-pointer text-left ${
          isSelected
            ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
            : "border-gray-200 text-gray-700 hover:border-gray-300"
        }`}
      >
        <span className="pr-3 leading-snug">{opt.label}</span>
        <div
          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
            isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"
          }`}
        >
          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </button>
    );
  };

  const checkboxRow = (opt) => {
    const selected = (localForm.scalp_symptoms || []).includes(opt.id);
    return (
      <label
        key={opt.id}
        className={`w-full min-h-[56px] px-5 flex items-center gap-3 border rounded-2xl transition-all font-medium text-sm bg-white cursor-pointer text-left ${
          selected
            ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
            : "border-gray-200 text-gray-700 hover:border-gray-300"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleScalpSymptom(opt.id)}
          className="w-4 h-4 rounded border-gray-300 accent-[#064e3b] shrink-0"
        />
        <span className="leading-snug">{opt.label}</span>
      </label>
    );
  };

  const badge = (n) => (
    <span className="text-[10px] font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-2.5 py-0.5 rounded-full">
      HAIR ({n}/{HAIR_TOTAL})
    </span>
  );

  return (
    <div className="max-w-2xl mx-auto mt-4 px-4 mb-8">
      <div className="bg-white rounded-[24px] p-5 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 text-left">
        {errors && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-xl mb-4">
            {errors}
          </div>
        )}

        {subStep === 0 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-4">
              {badge(1)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                Which pattern looks closest to your hair today?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                Choose the closest match. If you&apos;re unsure, that&apos;s okay — your scalp photos will
                help us assess the visible pattern.
              </p>
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
                      isSelected
                        ? "border-[#064e3b] ring-1 ring-[#064e3b]/10 bg-emerald-50/5"
                        : "border-gray-200/80 hover:border-gray-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="mb-3 w-full flex justify-between items-start gap-1">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 tracking-tight leading-tight">
                          {opt.label}
                        </h4>
                        <p className="text-[10px] text-gray-400 font-medium leading-tight mt-0.5">
                          {opt.desc}
                        </p>
                      </div>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center relative shadow-2xs">
                      <img
                        src={opt.img}
                        alt={opt.label}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?auto=format&fit=crop&w=300&q=80";
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {subStep === 1 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-4">
              {badge(2)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                Where have you noticed hair loss or thinning?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                This helps us understand which areas are most affected.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full text-left mt-4">
              {LOCATION_CARDS.map((opt) => {
                const isSelected = localForm.hair_loss_area === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect("hair_loss_area", opt.id)}
                    className={`flex flex-col border rounded-2xl p-4 transition-all duration-200 text-left justify-between group cursor-pointer bg-white w-full ${
                      isSelected
                        ? "border-[#064e3b] ring-1 ring-[#064e3b]/10 bg-emerald-50/5"
                        : "border-gray-200/80 hover:border-gray-300 hover:shadow-xs"
                    }`}
                  >
                    <div className="mb-3 w-full flex justify-between items-start gap-1">
                      <span className="text-sm font-bold text-gray-900 tracking-tight leading-tight">
                        {opt.label}
                      </span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected && <div className="w-1 h-1 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center relative shadow-2xs">
                      <img
                        src={opt.img}
                        alt={opt.label}
                        className="w-full h-full object-contain p-2"
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?auto=format&fit=crop&w=300&q=80";
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-3 mt-4">
              {LOCATION_ROWS.map((opt) => radioRow(opt, "hair_loss_area"))}
            </div>
          </div>
        )}

        {subStep === 2 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              {badge(3)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                Are you shedding more hair than usual?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                Think about what you notice in the shower, on your brush, pillow, or clothing.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {SHEDDING_OPTIONS.map((opt) => radioRow(opt, "daily_loss_amount"))}
            </div>
          </div>
        )}

        {subStep === 3 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              {badge(4)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                Do you experience dandruff?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                This helps us choose the right scalp-care products in your recommended kit.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {DANDRUFF_QUESTION_OPTIONS.map((opt) => radioRow(opt, "dandruff_experience"))}
            </div>
          </div>
        )}

        {subStep === 4 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              {badge(5)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                Do you experience flaking, itching, or scalp irritation?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                Select all that apply. These symptoms help us tailor your scalp-care recommendations.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {SCALP_SYMPTOM_OPTIONS.map((opt) => checkboxRow(opt))}
            </div>
          </div>
        )}

        {subStep === 5 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              {badge(6)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                Does similar hair thinning run in your biological family?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                Family history can help us understand the likelihood of inherited pattern hair loss.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {FAMILY_HISTORY.map((opt) => radioRow(opt, "family_history"))}
            </div>
          </div>
        )}

        {subStep === 6 && (
          <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="mb-6">
              {badge(7)}
              <h2 className="text-2xl font-bold text-gray-900 mt-3 leading-tight">
                When did you first notice the change?
              </h2>
              <p className="text-gray-400 mt-1 text-xs">
                The timeline helps us understand whether the change appeared suddenly or developed
                gradually.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {LOSS_DURATION_OPTIONS.map((opt) => radioRow(opt, "loss_duration"))}
            </div>
          </div>
        )}

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
            {subStep === HAIR_TOTAL - 1 ? "Complete Hair Section →" : "Next Question →"}
          </button>
        </div>
      </div>
    </div>
  );
}
