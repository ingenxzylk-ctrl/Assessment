import { useState, useRef, useEffect } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import { ageToRange } from "../../utils/eligibilityTimeline";

const STEPS = ["name", "contact", "age", "gender"];

const STEP_TITLES = {
  name: { title: "What should we call you?", subtitle: "We'll use your first name to personalize your report." },
  contact: {
    title: "Where should we send your report?",
    subtitle:
      "Enter your WhatsApp number to receive your personalized hair assessment and recommendations. Add your email as a backup.",
  },
  age: { title: "What's your age?", subtitle: "Enter your age in years so we can tailor your plan." },
  gender: { title: "How do you identify?", subtitle: "This helps us tailor the assessment to you." },
};

const COUNTRY_CODES = [
  { code: "+93", name: "Afghanistan", flag: "🇦🇫" },
  { code: "+355", name: "Albania", flag: "🇦🇱" },
  { code: "+213", name: "Algeria", flag: "🇩🇿" },
  { code: "+376", name: "Andorra", flag: "🇦🇩" },
  { code: "+244", name: "Angola", flag: "🇦🇴" },
  { code: "+1", name: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "+54", name: "Argentina", flag: "🇦🇷" },
  { code: "+374", name: "Armenia", flag: "🇦🇲" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+43", name: "Austria", flag: "🇦🇹" },
  { code: "+994", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "+1", name: "Bahamas", flag: "🇧🇸" },
  { code: "+973", name: "Bahrain", flag: "🇧🇭" },
  { code: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+1", name: "Barbados", flag: "🇧🇧" },
  { code: "+375", name: "Belarus", flag: "🇧🇾" },
  { code: "+32", name: "Belgium", flag: "🇧🇪" },
  { code: "+501", name: "Belize", flag: "🇧🇿" },
  { code: "+229", name: "Benin", flag: "🇧🇯" },
  { code: "+975", name: "Bhutan", flag: "🇧🇹" },
  { code: "+591", name: "Bolivia", flag: "🇧🇴" },
  { code: "+387", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "+267", name: "Botswana", flag: "🇧🇼" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+673", name: "Brunei", flag: "🇧🇳" },
  { code: "+359", name: "Bulgaria", flag: "🇧🇬" },
  { code: "+226", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "+257", name: "Burundi", flag: "🇧🇮" },
  { code: "+855", name: "Cambodia", flag: "🇰🇭" },
  { code: "+237", name: "Cameroon", flag: "🇨🇲" },
  { code: "+1", name: "Canada", flag: "🇨🇦" },
  { code: "+238", name: "Cape Verde", flag: "🇨🇻" },
  { code: "+236", name: "Central African Republic", flag: "🇨🇫" },
  { code: "+235", name: "Chad", flag: "🇹🇩" },
  { code: "+56", name: "Chile", flag: "🇨🇱" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+57", name: "Colombia", flag: "🇨🇴" },
  { code: "+269", name: "Comoros", flag: "🇰🇲" },
  { code: "+242", name: "Congo", flag: "🇨🇬" },
  { code: "+243", name: "Congo (DRC)", flag: "🇨🇩" },
  { code: "+506", name: "Costa Rica", flag: "🇨🇷" },
  { code: "+225", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "+385", name: "Croatia", flag: "🇭🇷" },
  { code: "+53", name: "Cuba", flag: "🇨🇺" },
  { code: "+357", name: "Cyprus", flag: "🇨🇾" },
  { code: "+420", name: "Czech Republic", flag: "🇨🇿" },
  { code: "+45", name: "Denmark", flag: "🇩🇰" },
  { code: "+253", name: "Djibouti", flag: "🇩🇯" },
  { code: "+1", name: "Dominica", flag: "🇩🇲" },
  { code: "+1", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "+593", name: "Ecuador", flag: "🇪🇨" },
  { code: "+20", name: "Egypt", flag: "🇪🇬" },
  { code: "+503", name: "El Salvador", flag: "🇸🇻" },
  { code: "+240", name: "Equatorial Guinea", flag: "🇬🇶" },
  { code: "+291", name: "Eritrea", flag: "🇪🇷" },
  { code: "+372", name: "Estonia", flag: "🇪🇪" },
  { code: "+268", name: "Eswatini", flag: "🇸🇿" },
  { code: "+251", name: "Ethiopia", flag: "🇪🇹" },
  { code: "+679", name: "Fiji", flag: "🇫🇯" },
  { code: "+358", name: "Finland", flag: "🇫🇮" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+241", name: "Gabon", flag: "🇬🇦" },
  { code: "+220", name: "Gambia", flag: "🇬🇲" },
  { code: "+995", name: "Georgia", flag: "🇬🇪" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+233", name: "Ghana", flag: "🇬🇭" },
  { code: "+30", name: "Greece", flag: "🇬🇷" },
  { code: "+1", name: "Grenada", flag: "🇬🇩" },
  { code: "+502", name: "Guatemala", flag: "🇬🇹" },
  { code: "+224", name: "Guinea", flag: "🇬🇳" },
  { code: "+245", name: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "+592", name: "Guyana", flag: "🇬🇾" },
  { code: "+509", name: "Haiti", flag: "🇭🇹" },
  { code: "+504", name: "Honduras", flag: "🇭🇳" },
  { code: "+852", name: "Hong Kong", flag: "🇭🇰" },
  { code: "+36", name: "Hungary", flag: "🇭🇺" },
  { code: "+354", name: "Iceland", flag: "🇮🇸" },
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+62", name: "Indonesia", flag: "🇮🇩" },
  { code: "+98", name: "Iran", flag: "🇮🇷" },
  { code: "+964", name: "Iraq", flag: "🇮🇶" },
  { code: "+353", name: "Ireland", flag: "🇮🇪" },
  { code: "+972", name: "Israel", flag: "🇮🇱" },
  { code: "+39", name: "Italy", flag: "🇮🇹" },
  { code: "+1", name: "Jamaica", flag: "🇯🇲" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+962", name: "Jordan", flag: "🇯🇴" },
  { code: "+7", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "+254", name: "Kenya", flag: "🇰🇪" },
  { code: "+686", name: "Kiribati", flag: "🇰🇮" },
  { code: "+965", name: "Kuwait", flag: "🇰🇼" },
  { code: "+996", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "+856", name: "Laos", flag: "🇱🇦" },
  { code: "+371", name: "Latvia", flag: "🇱🇻" },
  { code: "+961", name: "Lebanon", flag: "🇱🇧" },
  { code: "+266", name: "Lesotho", flag: "🇱🇸" },
  { code: "+231", name: "Liberia", flag: "🇱🇷" },
  { code: "+218", name: "Libya", flag: "🇱🇾" },
  { code: "+423", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "+370", name: "Lithuania", flag: "🇱🇹" },
  { code: "+352", name: "Luxembourg", flag: "🇱🇺" },
  { code: "+853", name: "Macau", flag: "🇲🇴" },
  { code: "+261", name: "Madagascar", flag: "🇲🇬" },
  { code: "+265", name: "Malawi", flag: "🇲🇼" },
  { code: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "+960", name: "Maldives", flag: "🇲🇻" },
  { code: "+223", name: "Mali", flag: "🇲🇱" },
  { code: "+356", name: "Malta", flag: "🇲🇹" },
  { code: "+692", name: "Marshall Islands", flag: "🇲🇭" },
  { code: "+222", name: "Mauritania", flag: "🇲🇷" },
  { code: "+230", name: "Mauritius", flag: "🇲🇺" },
  { code: "+52", name: "Mexico", flag: "🇲🇽" },
  { code: "+691", name: "Micronesia", flag: "🇫🇲" },
  { code: "+373", name: "Moldova", flag: "🇲🇩" },
  { code: "+377", name: "Monaco", flag: "🇲🇨" },
  { code: "+976", name: "Mongolia", flag: "🇲🇳" },
  { code: "+382", name: "Montenegro", flag: "🇲🇪" },
  { code: "+212", name: "Morocco", flag: "🇲🇦" },
  { code: "+258", name: "Mozambique", flag: "🇲🇿" },
  { code: "+95", name: "Myanmar", flag: "🇲🇲" },
  { code: "+264", name: "Namibia", flag: "🇳🇦" },
  { code: "+674", name: "Nauru", flag: "🇳🇷" },
  { code: "+977", name: "Nepal", flag: "🇳🇵" },
  { code: "+31", name: "Netherlands", flag: "🇳🇱" },
  { code: "+64", name: "New Zealand", flag: "🇳🇿" },
  { code: "+505", name: "Nicaragua", flag: "🇳🇮" },
  { code: "+227", name: "Niger", flag: "🇳🇪" },
  { code: "+234", name: "Nigeria", flag: "🇳🇬" },
  { code: "+850", name: "North Korea", flag: "🇰🇵" },
  { code: "+389", name: "North Macedonia", flag: "🇲🇰" },
  { code: "+47", name: "Norway", flag: "🇳🇴" },
  { code: "+968", name: "Oman", flag: "🇴🇲" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+680", name: "Palau", flag: "🇵🇼" },
  { code: "+970", name: "Palestine", flag: "🇵🇸" },
  { code: "+507", name: "Panama", flag: "🇵🇦" },
  { code: "+675", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "+595", name: "Paraguay", flag: "🇵🇾" },
  { code: "+51", name: "Peru", flag: "🇵🇪" },
  { code: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "+48", name: "Poland", flag: "🇵🇱" },
  { code: "+351", name: "Portugal", flag: "🇵🇹" },
  { code: "+974", name: "Qatar", flag: "🇶🇦" },
  { code: "+40", name: "Romania", flag: "🇷🇴" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "+250", name: "Rwanda", flag: "🇷🇼" },
  { code: "+1", name: "Saint Kitts and Nevis", flag: "🇰🇳" },
  { code: "+1", name: "Saint Lucia", flag: "🇱🇨" },
  { code: "+1", name: "Saint Vincent and the Grenadines", flag: "🇻🇨" },
  { code: "+685", name: "Samoa", flag: "🇼🇸" },
  { code: "+378", name: "San Marino", flag: "🇸🇲" },
  { code: "+239", name: "Sao Tome and Principe", flag: "🇸🇹" },
  { code: "+966", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+221", name: "Senegal", flag: "🇸🇳" },
  { code: "+381", name: "Serbia", flag: "🇷🇸" },
  { code: "+248", name: "Seychelles", flag: "🇸🇨" },
  { code: "+232", name: "Sierra Leone", flag: "🇸🇱" },
  { code: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "+421", name: "Slovakia", flag: "🇸🇰" },
  { code: "+386", name: "Slovenia", flag: "🇸🇮" },
  { code: "+677", name: "Solomon Islands", flag: "🇸🇧" },
  { code: "+252", name: "Somalia", flag: "🇸🇴" },
  { code: "+27", name: "South Africa", flag: "🇿🇦" },
  { code: "+82", name: "South Korea", flag: "🇰🇷" },
  { code: "+211", name: "South Sudan", flag: "🇸🇸" },
  { code: "+34", name: "Spain", flag: "🇪🇸" },
  { code: "+94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "+249", name: "Sudan", flag: "🇸🇩" },
  { code: "+597", name: "Suriname", flag: "🇸🇷" },
  { code: "+46", name: "Sweden", flag: "🇸🇪" },
  { code: "+41", name: "Switzerland", flag: "🇨🇭" },
  { code: "+963", name: "Syria", flag: "🇸🇾" },
  { code: "+886", name: "Taiwan", flag: "🇹🇼" },
  { code: "+992", name: "Tajikistan", flag: "🇹🇯" },
  { code: "+255", name: "Tanzania", flag: "🇹🇿" },
  { code: "+66", name: "Thailand", flag: "🇹🇭" },
  { code: "+670", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "+228", name: "Togo", flag: "🇹🇬" },
  { code: "+676", name: "Tonga", flag: "🇹🇴" },
  { code: "+1", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "+216", name: "Tunisia", flag: "🇹🇳" },
  { code: "+90", name: "Turkey", flag: "🇹🇷" },
  { code: "+993", name: "Turkmenistan", flag: "🇹🇲" },
  { code: "+688", name: "Tuvalu", flag: "🇹🇻" },
  { code: "+256", name: "Uganda", flag: "🇺🇬" },
  { code: "+380", name: "Ukraine", flag: "🇺🇦" },
  { code: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+598", name: "Uruguay", flag: "🇺🇾" },
  { code: "+998", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "+678", name: "Vanuatu", flag: "🇻🇺" },
  { code: "+379", name: "Vatican City", flag: "🇻🇦" },
  { code: "+58", name: "Venezuela", flag: "🇻🇪" },
  { code: "+84", name: "Vietnam", flag: "🇻🇳" },
  { code: "+967", name: "Yemen", flag: "🇾🇪" },
  { code: "+260", name: "Zambia", flag: "🇿🇲" },
  { code: "+263", name: "Zimbabwe", flag: "🇿🇼" },
];


const DEFAULT_COUNTRY = COUNTRY_CODES.find((c) => c.name === "India") || COUNTRY_CODES[0];

export default function Section1AboutMe({ onComplete, onBack }) {
  const { state, updateAboutMe } = useQuiz(); 
  const [step, setStep] = useSectionStep("section1AboutMe", STEPS.length - 1, 0);
  const [errors, setErrors] = useState({});
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const countryMenuRef = useRef(null);

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
    age: state?.aboutMe?.age || "",
    ageRange: state?.aboutMe?.ageRange || "",
    gender: state?.aboutMe?.gender || "",
  });

  const selectedCountry =
    COUNTRY_CODES.find(
      (c) =>
        c.code === localForm.countryCode &&
        c.name === (localForm.countryName || DEFAULT_COUNTRY.name)
    ) ||
    COUNTRY_CODES.find((c) => c.code === localForm.countryCode) ||
    DEFAULT_COUNTRY;

  useEffect(() => {
    if (!countryMenuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!countryMenuRef.current?.contains(event.target)) {
        setCountryMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [countryMenuOpen]);

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
    if (step === 2) {
      const ageNum = Number(localForm.age);
      if (!localForm.age || !Number.isFinite(ageNum)) {
        e.age = "Please enter your age";
      } else if (ageNum < 13 || ageNum > 100) {
        e.age = "Please enter an age between 13 and 100";
      }
    }
    if (step === 3 && !localForm.gender) e.gender = "Please select your gender";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleContinue = () => {
    if (!validate()) return;

    // Persist answers as the user advances so reload mid-section can resume
    if (updateAboutMe) {
      const ageRange = ageToRange(localForm.age) || localForm.ageRange || "";
      updateAboutMe({ ...localForm, ageRange });
    }

    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
    } else {
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
              <label className="text-sm font-semibold text-gray-700">First name</label>
              <input
                type="text"
                value={localForm.fullName}
                onChange={(e) => handleChange({ fullName: e.target.value })}
                placeholder="Enter your first name"
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
  <div className="relative shrink-0" ref={countryMenuRef}>
    <button
      type="button"
      onClick={() => setCountryMenuOpen((open) => !open)}
      className="h-14 w-[6.75rem] px-2 border border-gray-200 rounded-2xl bg-white text-gray-900 focus:outline-none focus:border-[#064e3b] text-sm font-medium flex items-center justify-between gap-1 cursor-pointer"
      aria-label="WhatsApp country code"
      aria-haspopup="listbox"
      aria-expanded={countryMenuOpen}
    >
      <span className="truncate">
        {selectedCountry.flag} {selectedCountry.code}
      </span>
      <span className="text-gray-400 text-xs" aria-hidden="true">▾</span>
    </button>

    {countryMenuOpen && (
      <ul
        role="listbox"
        className="absolute left-0 top-[calc(100%+0.35rem)] z-30 max-h-64 w-[16rem] overflow-y-auto rounded-2xl border border-gray-200 bg-white py-1 shadow-lg"
      >
        {COUNTRY_CODES.map((c) => {
          const isSelected =
            c.code === selectedCountry.code && c.name === selectedCountry.name;
          return (
            <li key={`${c.name}-${c.code}`}>
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  handleChange({ countryCode: c.code, countryName: c.name });
                  setCountryMenuOpen(false);
                }}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-gray-50 cursor-pointer ${
                  isSelected ? "bg-[#064e3b]/5 text-[#064e3b] font-semibold" : "text-gray-800"
                }`}
              >
                <span className="shrink-0">{c.flag}</span>
                <span className="shrink-0 font-medium">{c.code}</span>
                <span className="truncate text-gray-500">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>

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
                  Email Address (optional)
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
          {/* STEP 2: AGE NUMBER INPUT */}
          {step === 2 && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700">Age (years)</label>
              <input
                type="number"
                inputMode="numeric"
                min={13}
                max={100}
                value={localForm.age}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                  handleChange({ age: digits, ageRange: ageToRange(digits) });
                }}
                placeholder="e.g. 28"
                className={`w-full h-14 px-4 bg-white border rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#064e3b]/20 focus:border-[#064e3b] transition-all text-base ${
                  errors.age ? "border-red-500 bg-red-50/10" : "border-gray-200"
                }`}
              />
              {errors.age && <p className="text-sm text-red-500 font-medium mt-1">{errors.age}</p>}
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