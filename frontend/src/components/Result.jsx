import { useState } from "react";
import { useQuiz } from "../context/QuizContext";
import { useCart } from "../context/CartContext";
import { getCustomBundle } from "../data/products";
import { PDFDownloadLink } from "@react-pdf/renderer";
import AssessmentPDFTemplate from "./sections/AssessmentPDFTemplate"; 

const FACTOR_STYLES = {
  genetic: { bg: "bg-purple-50", text: "text-purple-800", dot: "bg-purple-500" },
  hormonal: { bg: "bg-pink-50", text: "text-pink-800", dot: "bg-pink-500" },
  nutritional: { bg: "bg-orange-50", text: "text-orange-800", dot: "bg-orange-500" },
  "stress-related": { bg: "bg-blue-50", text: "text-blue-800", dot: "bg-blue-500" },
  "scalp-related": { bg: "bg-teal-50", text: "text-teal-800", dot: "bg-teal-500" },
};

// 🟢 A data-URI can never 404, unlike /stages/female_stage1.png which
// doesn't exist in public/stages. Used as the ultimate fallback for the
// user's capture avatar so the box is never left blank.
const AVATAR_FALLBACK_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f3f4f6'/><circle cx='50' cy='38' r='18' fill='%23d1d5db'/><rect x='18' y='64' width='64' height='30' rx='15' fill='%23d1d5db'/></svg>";

export default function Result() {
  const { state, resetQuiz, prevStep, setLoading, setError } = useQuiz();
  const { addToCart } = useCart(); 
  const [showRoutinePanel, setShowRoutinePanel] = useState(false); 
  const [activeTab, setActiveTab] = useState("genetic");

  // 1. Gather variables safely
  const rawAnalysis = state?.scalpAnalysis || {};
  const gender = state?.aboutMe?.gender || "male";
  const isFemale = gender === "female";
  const userName = state?.aboutMe?.fullName || "Guest User";
  
  // Normalize reported staging metrics safely based on gender
  const reportedStage = isFemale 
    ? (state?.hairHealth?.hair_fall_zone || "1") 
    : (state?.hairHealth?.norwood_stage || "1");
  const aiPredictedStageNumber = rawAnalysis.aiPredictedStage;

  // 🟢 DEBUG: log exactly what stage data made it into Result.jsx.
  // Check DevTools console when this page loads — this tells you whether
  // the AI pipeline actually returned a stage, or if rawAnalysis is empty
  // (meaning scalpAnalysis never got set in QuizContext state).
  console.log("🔍 RESULT PAGE DEBUG:", {
    gender,
    reportedStage: isFemale
      ? (state?.hairHealth?.hair_fall_zone || "1")
      : (state?.hairHealth?.norwood_stage || "1"),
    aiPredictedStage: aiPredictedStageNumber,
    rawAnalysis,
    fullScalpAnalysisPresent: !!state?.scalpAnalysis,
  });

  // 🟢 FIX: single lookup per image type instead of searching the array twice.
  // Previously this ran .find() twice for the same type, which was redundant
  // (and confusing to read) even though it happened not to crash.
  const findScalpImage = (type) => state?.scalpImages?.find(img => img.type === type);
  const realFrontImage = findScalpImage("front");
  const realSideImage = findScalpImage("side");
  const realTopImage = findScalpImage("top");

  const displayUserPhoto = (typeof realFrontImage === 'string' ? realFrontImage : realFrontImage?.dataUrl) || 
                            (typeof realSideImage === 'string' ? realSideImage : realSideImage?.dataUrl) || 
                            (typeof realTopImage === 'string' ? realTopImage : realTopImage?.dataUrl);

  // CLINICAL GUARDRAIL: Advanced stages directed to specialist practitioner routing
  const requiresDoctorConsultation = (gender === "male" && ["6", "7"].includes(String(aiPredictedStageNumber))) ||
                                     (gender === "female" && aiPredictedStageNumber === "patchy-bald");

  // Parse root causes from questionnaire
  const stateDumpString = JSON.stringify(state || {}).toLowerCase();
  const hasDandruff = stateDumpString.includes("dandruff") && !stateDumpString.includes("no-dandruff");
  
  const rootCauses = [];
  if (stateDumpString.includes("stress") || stateDumpString.includes("anxiety")) rootCauses.push("Cortisol Control");
  if (stateDumpString.includes("diet") || stateDumpString.includes("nutrition") || stateDumpString.includes("veg")) rootCauses.push("Nutrient Sync");
  if (stateDumpString.includes("hormone") || stateDumpString.includes("pcos") || stateDumpString.includes("thyroid")) rootCauses.push("Hormone Balancing");

  // Generate treatment bundle configurations
  const recommendedBundle = !requiresDoctorConsultation 
    ? getCustomBundle(gender, aiPredictedStageNumber, hasDandruff, rootCauses) 
    : null;

  // 🟢 Explicit flag for "the AI never returned a stage" — used to show an
  // honest banner instead of quietly rendering a fake-looking report.
  const analysisMissing = !aiPredictedStageNumber;

  // 🟢 DYNAMIC TITLE: Sets professional terminology based on profile tracking scales
  const getStageTitle = () => {
    // 🟢 FIX: guard against aiPredictedStageNumber being undefined (e.g. before
    // analysis finishes), which previously rendered "Stage undefined Of..."
    if (analysisMissing) return "Assessment Incomplete";

    if (isFemale) {
      if (aiPredictedStageNumber === "patchy-bald") return "Alopecia / Focal Pattern Thinning";
      if (aiPredictedStageNumber === "overall-thinning") return "Overall Diffuse Thinning Profile";
      return `Ludwig Stage ${aiPredictedStageNumber} Of Female Pattern Thinning`;
    }
    if (aiPredictedStageNumber === "overall-thinning") return "Overall Thinning Pattern";
    return `Stage ${aiPredictedStageNumber} Of Male Pattern Hair Fall`;
  };
  
  const stageDescription = requiresDoctorConsultation
    ? `Our multi-modal assessment indicates advanced follicular depletion matching an advanced profiling scale. At this configuration layout, generic online topical serums are highly restricted. Direct medical oversight is required.`
    : (rawAnalysis.stageDescription || `Our multi-modal assessment indicates localized phase shifts matching a ${getStageTitle()} signature layout.`);
  
  const regrowthOutlook = requiresDoctorConsultation
    ? `Advanced hair loss configurations require specialized clinical treatment strategies (such as clinical targeted therapies or surgical transpositioning plans). Speak with a dermatologist.`
    : (rawAnalysis.regrowthOutlook || `Your target configuration responds exceptionally well to your prescribed comprehensive treatment package layout.`);

  const confidencePercent = rawAnalysis.aiConfidence ? Math.round(rawAnalysis.aiConfidence * 100) : 94;
  const aiReasoning = rawAnalysis.aiReasoning || `Visual tracking mapping isolated root thinning areas consistent with a distinct signature layout configuration.`;

  const timelineMap = {
    "1": "1 - 2 Months",
    "2": "3 - 4 Months",
    "3": "6 Months",
    "4": "8 Months",
    "5": "12 Months",
    "overall-thinning": "4 - 6 Months",
    "patchy-bald": "Clinical Care Plan"
  };

  const contributingFactors = requiresDoctorConsultation
    ? [
        { tag: "genetic", label: "Advanced Genetic Miniaturization", description: "Long-standing enzyme paths causing closure of active root fields." }
      ]
    : [
        { tag: "genetic", label: isFemale ? "Hormonal Hair Vector" : "Genetic Predisposition Vector", description: isFemale ? "Receptor pathways causing micro-thinning along center hair parts over time." : "Hormonal shifts triggering cellular variations along target active follicles." },
        { tag: "stress-related", label: "Stress Adaptation Metrics", description: "Fluctuating cortisol levels forcing root clusters prematurely into resting telogen phases." },
        { tag: "scalp-related", label: "Scalp Shield Environment", description: hasDandruff ? "Surface microbial activity disrupting lipid barrier consistency." : "Standard external cellular balance status." }
      ];

  const formatProductName = (name) => {
    // 🟢 SAFE FILTER: Disallow and completely exclude Finasteride formulas for female users
    if (isFemale && name.toLowerCase().includes("finasteride")) {
      return null;
    }

    let shortName = name;
    if (name.toLowerCase().includes("minoxidil")) {
      shortName = isFemale ? "Targeted Growth Serum (Female Formula)" : "Minoxidil + Finasteride Serum";
    } else if (name.toLowerCase().includes("derma")) {
      shortName = "Scalp Derma Roller (0.5mm)";
    } else if (name.toLowerCase().includes("shampoo")) {
      shortName = "Anti-Dandruff Cleanser";
    }
    
    return { 
      shortName, 
      imgUrl: "/products/placeholder.png" 
    };
  };

  const handleBackNavigation = () => {
    if (setLoading) setLoading(false);
    if (setError) setError(null);
    
    if (prevStep) prevStep();
    else window.history.back();
  };

  return (
    <div className="max-w-7xl mx-auto mt-4 px-4 mb-16 select-none !text-left animate-[fadeIn_0.3s_ease-out] block w-full">
      
      {/* Back Navigation Bar */}
      <div className="flex justify-between items-center mb-6 w-full !text-left">
        <button
          type="button"
          onClick={handleBackNavigation}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 transition-colors cursor-pointer group py-2"
        >
          <span className="transform group-hover:-translate-x-0.5 transition-transform">←</span> Back to Questions
        </button>

        <span className="text-[10px] md:text-xs font-medium text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full border border-gray-200/40">
          🤖 Generated by AI Assessment Engines • Adaptive Gender Metrics
        </span>
      </div>

      {/* Main Grid Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start w-full !text-left">
        
        {/* ================= LEFT SIDE COMPONENT: DIAGNOSTICS ASSESSMENT REPORT ================= */}
        <div className="lg:col-span-6 bg-white rounded-[32px] p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 space-y-8 w-full !text-left block">
          
          <div className="w-full !text-left block">
            <span className="text-xs font-bold tracking-[0.1em] text-gray-400 uppercase block !text-left">Assessment Report</span>
            
            <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-6 mt-4 w-full !text-left">
              <div className="space-y-3 flex-1 !text-left block">
                <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight !text-left">{userName},</h2>
                <p className="text-lg text-gray-700 font-medium !text-left">
                  You Are Currently On <span className="text-[#064e3b] font-bold">{getStageTitle()}</span>
                </p>
                <div className="pt-2 !text-left block">
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wide !text-left">Start Seeing Results In</span>
                  <span className="text-2xl font-black text-gray-900 !text-left block">{timelineMap[aiPredictedStageNumber] || "6 Months"}</span>
                </div>
              </div>

              {/* 🟢 GENDER-SPECIFIC AVATAR ACCORDING TO USER STATE */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 shadow-sm mx-auto sm:mx-0">
                <img 
                  src={displayUserPhoto || AVATAR_FALLBACK_SVG} 
                  alt="Real user scalp photograph diagnostics visual representation" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // 🟢 FIX: previously fell back to /stages/female_stage1.png
                    // (or /stages/Stage1.png), but female_stage1.png doesn't
                    // exist in public/stages — that 404 triggered this same
                    // onError handler again, which re-set the SAME missing
                    // path, so the box just stayed permanently blank.
                    // A data-URI SVG can never 404, so this is guaranteed
                    // to render something instead of nothing.
                    e.target.onerror = null; // stop any possible loop
                    e.target.src = AVATAR_FALLBACK_SVG;
                  }}
                />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur-[1px]">
                  Your Capture
                </span>
              </div>
            </div>
          </div>

          {/* 🟢 Analysis-missing banner: shown instead of pretending the
              report is complete when aiPredictedStage never arrived. */}
          {analysisMissing && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800 font-medium leading-relaxed !text-left w-full block">
              ⚠️ <span className="font-bold">We couldn't complete your AI scalp analysis.</span>
              <p className="text-xs text-red-600 mt-1.5 !text-left">
                Your questionnaire answers were saved, but the photo analysis didn't finish. Please retake the scalp scan to get your actual stage.
              </p>
              <button
                type="button"
                onClick={() => { if (prevStep) prevStep(); else window.history.back(); }}
                className="mt-3 text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-colors cursor-pointer"
              >
                Retake Scalp Scan
              </button>
            </div>
          )}

          {/* 🟢 DEBUG CHIP: shows exactly which stage the page thinks it's on.
              Safe to delete once you've confirmed the pipeline is returning
              the right stage — this is dev-only visibility, not for production. */}
          <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-[11px] text-yellow-800 font-mono !text-left w-full block">
            🔧 DEBUG — gender: <b>{gender}</b> | self-reported: <b>{reportedStage}</b> | AI predicted stage: <b>{String(aiPredictedStageNumber)}</b> | requiresDoctorConsultation: <b>{String(requiresDoctorConsultation)}</b>
          </div>

          {/* Hope Prompt Status Banner Panel */}
          <div className="p-4 bg-[#f4f6f0] border border-[#064e3b]/10 rounded-2xl text-sm text-[#064e3b] font-medium leading-relaxed !text-left w-full block">
            ✨ <span className="font-bold">Prognosis Context:</span>
            <ul className="list-disc pl-5 mt-2 space-y-1.5 text-xs text-gray-600 font-normal !text-left">
              <li>{stageDescription}</li>
              <li>{regrowthOutlook}</li>
            </ul>
          </div>

          {/* TAB DRIVEN INTERACTIVE CONTRIBUTING CAUSES VIEWER */}
          <div className="space-y-4 w-full !text-left block">
            <h4 className="text-base font-bold text-gray-900 tracking-tight !text-left">Your Hair Fall Root Causes</h4>
            <div className="grid grid-cols-3 gap-3 w-full">
              {contributingFactors.map((factor) => (
                <button 
                  key={factor.tag}
                  type="button" 
                  onClick={() => setActiveTab(factor.tag)}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    activeTab === factor.tag ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] font-bold" : "border-gray-100 text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg">
                    {factor.tag === "genetic" && "🧬"}
                    {factor.tag === "stress-related" && "⚖️"}
                    {factor.tag === "scalp-related" && "❄️"}
                  </span>
                  <span className="text-xs tracking-tight truncate max-w-full">{factor.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>

            {/* Display active tab parameters text */}
            {contributingFactors.find(f => f.tag === activeTab) && (
              <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-600 border border-gray-100 !text-left space-y-1 w-full block">
                <p className="font-bold text-gray-900 !text-left">{contributingFactors.find(f => f.tag === activeTab).label}</p>
                <p className="leading-relaxed !text-left">{contributingFactors.find(f => f.tag === activeTab).description}</p>
              </div>
            )}
          </div>

          {/* Confidence Meter Subsystem */}
          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/60 w-full !text-left block">
            <div className="flex justify-between text-xs mb-2 font-bold w-full !text-left">
              <span className="text-gray-500 uppercase tracking-wider !text-left">AI Confidence Matrix Ratio</span>
              <span className="text-[#064e3b]">{confidencePercent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden w-full block">
              <div className="h-full rounded-full bg-[#064e3b] transition-all duration-500" style={{ width: `${confidencePercent}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-gray-400 italic !text-left">"{aiReasoning}"</p>
          </div>

          {/* ACTIONS: PDF DOWNLOAD & RETAKE QUIZ */}
          <div className="pt-4 border-t border-gray-100 space-y-4 w-full block">
            <div className="w-full block">
              {state ? (
                <PDFDownloadLink
                  document={<AssessmentPDFTemplate state={state} aiAnalysis={rawAnalysis} />}
                  fileName={`${userName.replace(/\s+/g, '_')}_Hair_Report.pdf`}
                >
                  {({ blob, url, loading, error }) => (
                    <button
                      type="button"
                      disabled={loading}
                      className="w-full h-14 bg-white border-2 border-dashed border-gray-300 text-gray-700 rounded-full font-bold hover:bg-gray-50 hover:border-gray-400 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      {loading ? "🔄 Compiling Document Layout..." : "📥 Download Full PDF Assessment Report"}
                    </button>
                  )}
                </PDFDownloadLink>
              ) : (
                <div className="text-center text-xs text-gray-400 py-2">Awaiting image extraction matrix...</div>
              )}
            </div>

            <button 
              type="button" 
              onClick={() => {
                if (resetQuiz) resetQuiz();
                window.location.href = "/";
              }} 
              className="w-full text-center text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors pt-2 cursor-pointer block"
            >
              🔄 Discard & Retake Quiz
            </button>
          </div>

        </div>

        {/* ================= RIGHT SIDE COMPONENT: RETAIL TREATMENT SYSTEM PRODUCTS ================= */}
        <div className="lg:col-span-4 bg-white rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 space-y-6 w-full !text-left block">
          
          <div className="!text-left w-full block">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight !text-left">Start Your Journey With Just 1 Month Kit</h3>
            <p className="text-xs text-gray-400 mt-1 !text-left">Clinically targeted formula system mapped configurations.</p>
          </div>

          {/* PRODUCT STACK CONTAINER */}
          {requiresDoctorConsultation ? (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 !text-left space-y-2 w-full block">
              <h4 className="font-bold text-sm text-amber-900 flex items-center gap-1 !text-left">⚠️ Direct Orders Restricted</h4>
              <p className="text-xs text-amber-700 leading-relaxed !text-left">
                Due to advanced hair loss depletion parameters, this configuration layout requires custom medical prescription setups. Please arrange an entry consultation exam with an authorized trichologist practitioner using the link below.
              </p>
            </div>
          ) : (
            <div className="space-y-4 w-full !text-left flex flex-col justify-start items-start">
              {/* 🟢 FIX: was `recommendedBundle?.items.map(...)` — the optional
                  chaining protected `.items` but NOT the `.map()` call right after
                  it, so if getCustomBundle() ever returns null/undefined (no
                  matching bundle for a stage/gender/factor combo), this threw
                  "Cannot read properties of undefined (reading 'map')" and crashed
                  the whole Result page. Now fully optional-chained with a safe
                  empty-array fallback. */}
              {(recommendedBundle?.items ?? [])
                .map((prod) => formatProductName(prod.name))
                .filter((productDetails) => productDetails !== null) // 🟢 Strict Array Removal filter for non-null entities
                .map((productDetails, index) => (
                  <div 
                    key={index} 
                    className="p-4 border border-gray-100 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-[#064e3b]/30 hover:shadow-md transition-all flex flex-row items-center justify-between gap-4 !text-left w-full block group"
                  >
                    <div className="flex flex-row items-center justify-start text-left flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shadow-xs shrink-0 overflow-hidden mr-4">
                        <img 
                          src={productDetails.imgUrl} 
                          alt={productDetails.shortName}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.target.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23064e3b'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'/></svg>";
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0 text-left block pr-2">
                        <h4 className="text-sm font-bold text-gray-800 leading-snug tracking-tight !text-left block whitespace-normal break-words">
                          {productDetails.shortName}
                        </h4>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center justify-end">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100/40 px-2.5 py-1 rounded-full whitespace-nowrap shadow-3xs">
                        Included
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* BASKET TRANSACTION FOOTER */}
          <div className="pt-4 border-t border-gray-100 space-y-4 w-full !text-left block">
            {!requiresDoctorConsultation && recommendedBundle && (
              <div className="flex justify-between items-center text-sm font-bold px-1 w-full !text-left">
                <span className="text-gray-500 !text-left">Total Bundle Value</span>
                <div className="text-right">
                  <span className="text-xs text-gray-400 line-through mr-1.5 font-medium">₹{recommendedBundle.originalPrice}</span>
                  <span className="text-xl font-black text-gray-900">₹{recommendedBundle.bundlePrice}</span>
                </div>
              </div>
            )}

            <button 
              type="button" 
              onClick={() => {
                if (requiresDoctorConsultation) {
                  alert("Connecting with our authorized clinical specialist network panel...");
                } else if (recommendedBundle) {
                  addToCart({
                    id: recommendedBundle.bundleId,
                    name: recommendedBundle.bundleTitle,
                    price: recommendedBundle.bundlePrice,
                    subtitle: `Complete Customized System (Stage ${aiPredictedStageNumber} Configuration)`
                  });
                  alert("Your customized combo routine pack has been added to the cart!");
                }
              }}
              className="w-full h-14 bg-[#064e3b] text-white rounded-full font-bold shadow-md hover:bg-[#043427] transition-all text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              {requiresDoctorConsultation ? "🩺 Schedule Specialist Consultation" : "BUY NOW — Start Treatment"}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}