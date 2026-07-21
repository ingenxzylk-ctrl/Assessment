import { useState } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import { COUNTRY_CODES } from "../../data/countryCodes";

const STEPS = ["name", "contact", "age", "gender"];

const STEP_TITLES = {
  name: { title: "What's your name?", subtitle: "We'll personalize your report." },
  contact: { title: "How can we reach you?", subtitle: "Your final report will be sent to your WhatsApp number or Email." },
  age: { title: "What's your age range?", subtitle: "Hair health varies across life stages." },
  gender: { title: "How do you identify?", subtitle: "This helps us tailor the assessment to you." },
};

const DEFAULT_COUNTRY = COUNTRY_CODES.find((c) => c.name === "India") || COUNTRY_CODES[0];

function countryOptionValue(country) {
  return `${country.code}|${country.name}`;
}

function parseCountryOption(value) {
  const [code, ...nameParts] = value.split("|");
  return { code, name: nameParts.join("|") };
}

export default function Section1AboutMe({ onComplete, onBack }) {
  const { state, updateAboutMe } = useQuiz(); 
  const [step, setStep] = useSectionStep("section1AboutMe", STEPS.length - 1, 0);
  const [errors, setErrors] = useState({});

  const initialCountry =
    COUNTRY_CODES.find(
      (c) =>
        c.code === (state?.aboutMe?.countryCode || DEFAULT_COUNTRY.code) &&
        (state?.aboutMe?.countryName ? c.name === state.aboutMe.countryName : true)
    ) || DEFAULT_COUNTRY;
  
  const [localForm, setLocalForm] = useState({
    fullName: state?.aboutMe?.fullName || "",
    whatsapp: state?.aboutMe?.whatsapp || "",
    email: state?.aboutMe?.email || "",
    countryCode: initialCountry.code,
    countryName: state?.aboutMe?.countryName || initialCountry.name,
    ageRange: state?.aboutMe?.ageRange || "",
    gender: state?.aboutMe?.gender || "",
  });

  const currentStep = STEPS[step];
  const headingInfo = STEP_TITLES[currentStep];

  const handleChange = (fields) => {
    setLocalForm((prev) => ({ ...prev, ...fields }));
    setErrors((prev) => ({ ...prev, [Object.keys(fields)[0]]: "" }));
  };

  const validate = () => {
    const e = {};
    if (step === 0 && !localForm.fullName.trim()) e.fullName = "Name is required";
    if (step === 1) {
      if (!localForm.whatsapp.trim()) e.whatsapp = "WhatsApp number is required";
      if (!localForm.email.trim()) {
        e.email = "Email is required";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(localForm.email)) {
        e.email = "Invalid email format";
      }
    }
    if (step === 2 && !localForm.ageRange) e.ageRange = "Please select your age range";
    if (step === 3 && !localForm.gender) e.gender = "Please select your gender";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      if (updateAboutMe) {
        updateAboutMe(localForm);
      }
      if (onComplete) onComplete();
    }
  };

  // Handles moving back through inner steps or returning out to the consent terms page
  const handleBackNavigation = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-6 px-4 w-full box-border">
  <div className="bg-white rounded-[32px] p-5 sm:p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 transition-all duration-300 w-full max-w-full overflow-hidden">
        
        <div className="mb-6">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            ASSESSMENT
          </span>
          <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">
            {headingInfo.title}
          </h2>
          <p className="text-gray-500 mt-2 text-base">
            {headingInfo.subtitle}
          </p>
        </div>

        <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
          
          {/* STEP 0: FULL NAME INPUT */}
          {step === 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">Full Name</label>
              <input
                type="text"
                value={localForm.fullName}
                onChange={(e) => handleChange({ fullName: e.target.value })}
                placeholder="Enter your full name"
                className={`w-full h-14 px-4 bg-white border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b] transition-all text-base ${
                  errors.fullName ? "border-red-500 bg-red-50/10" : "border-gray-200"
                }`}
              />
              {errors.fullName && <p className="text-sm text-red-500 font-medium mt-1">{errors.fullName}</p>}
            </div>
          )}

                    {/* STEP 1: CONTACT METHODS */}
          {step === 1 && (
            <div className="space-y-5 w-full min-w-0">
              <div className="flex flex-col gap-2 w-full min-w-0">
                <label className="text-sm font-semibold text-gray-700">
                  WhatsApp Number
                </label>

                {/* Mobile-friendly: stacked on small screens, side-by-side on sm+ */}
                <div className="flex gap-2 w-full min-w-0 max-w-full">
  <select
    value={countryOptionValue({
      code: localForm.countryCode,
      name: localForm.countryName || DEFAULT_COUNTRY.name,
    })}
    onChange={(e) => {
      const { code, name } = parseCountryOption(e.target.value);
      handleChange({ countryCode: code, countryName: name });
    }}
    className="h-14 w-[8.5rem] sm:w-[11rem] shrink-0 px-2 border border-gray-200 rounded-2xl bg-white text-gray-900 focus:outline-none focus:border-[#064e3b] text-sm font-medium"
    aria-label="WhatsApp country code"
  >
    {COUNTRY_CODES.map((c) => (
      <option key={`${c.name}-${c.code}`} value={countryOptionValue(c)}>
        {c.flag} {c.code} {c.name}
      </option>
    ))}
  </select>

  <input
    type="tel"
    inputMode="numeric"
    autoComplete="tel"
    value={localForm.whatsapp}
    onChange={(e) =>
      handleChange({ whatsapp: e.target.value.replace(/\D/g, "") })
    }
    placeholder="Phone number"
    className={`flex-1 min-w-0 basis-0 h-14 px-3 border rounded-2xl text-gray-900 focus:outline-none focus:border-[#064e3b] transition-all text-base ${
      errors.whatsapp ? "border-red-500" : "border-gray-200"
    }`}
  />
</div>

                {errors.whatsapp && (
                  <p className="text-sm text-red-500 font-medium">{errors.whatsapp}</p>
                )}
              </div>

              <div className="flex flex-col gap-2 w-full min-w-0">
                <label className="text-sm font-semibold text-gray-700">
                  Email Address
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={localForm.email}
                  onChange={(e) => handleChange({ email: e.target.value })}
                  placeholder="name@example.com"
                  className={`w-full min-w-0 h-14 px-4 border rounded-2xl text-gray-900 focus:outline-none focus:border-[#064e3b] transition-all text-base ${
                    errors.email ? "border-red-500" : "border-gray-200"
                  }`}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 font-medium">{errors.email}</p>
                )}
              </div>
            </div>
          )}
          {/* STEP 2: AGE INTERVAL SELECTORS */}
          {step === 2 && (
            <div className="grid grid-cols-1 gap-3">
              {["18-25", "26-35", "36-45", "46+"].map((age) => (
                <button
                  key={age}
                  type="button"
                  onClick={() => handleChange({ ageRange: age })}
                  className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left ${
                    localForm.ageRange === age
                      ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50/50"
                  }`}
                >
                  <span>{age} years old</span>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    localForm.ageRange === age ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"
                  }`}>
                    {localForm.ageRange === age && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
              {errors.ageRange && <p className="text-sm text-red-500 font-medium mt-1">{errors.ageRange}</p>}
            </div>
          )}

          {/* STEP 3: GENDER IDENTIFICATION */}
          {step === 3 && (
            <div className="grid grid-cols-2 gap-4">
              {["male", "female"].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => handleChange({ gender: g })}
                  className={`h-24 flex flex-col items-center justify-center gap-2 border rounded-2xl transition-all font-semibold capitalize text-base ${
                    localForm.gender === g
                      ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
                      : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  
                  <span className="capitalize">{g}</span>
                </button>
              ))}
              {errors.gender && <p className="text-sm text-red-500 font-medium col-span-2 text-center mt-1">{errors.gender}</p>}
            </div>
          )}

        </div>

        {/* 🟢 Unified, Clean Footer Button Actions Panel Row */}
        <div className="flex items-center gap-4 mt-10 w-full">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="flex-1 h-14 border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors cursor-pointer text-base text-center"
          >
            Back
          </button>
          
          <button
            type="button"
            onClick={handleContinue}
            className="flex-[2] h-14 bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all text-base shadow-sm cursor-pointer text-center"
          >
            {step === STEPS.length - 1 ? "Finish Section" : "Continue"}
          </button>
        </div>

      </div>
    </div>
  );
}