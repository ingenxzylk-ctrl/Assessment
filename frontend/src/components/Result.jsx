import { useState } from "react";
import { useQuiz } from "../context/QuizContext";
import { useCart } from "../context/CartContext";
import { getRecommendedBundle } from "../data/products";
import { getBundleDisplayName, getWooProductId } from "../config/bundles";
import { PDFDownloadLink } from "@react-pdf/renderer";
import AssessmentPDFTemplate from "./sections/AssessmentPDFTemplate";

const AVATAR_FALLBACK_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23f3f4f6'/><circle cx='50' cy='38' r='18' fill='%23d1d5db'/><rect x='18' y='64' width='64' height='30' rx='15' fill='%23d1d5db'/></svg>";

const PRODUCT_FALLBACK = "/products/default-product.png";

export default function Result() {
  const { state, resetQuiz, prevStep, setLoading, setError } = useQuiz();
  const { addToCart } = useCart();
  const [activeTab, setActiveTab] = useState("genetic");
  const [includeHealthMix, setIncludeHealthMix] = useState(true);

  const rawAnalysis = state?.scalpAnalysis || {};
  const gender = state?.aboutMe?.gender || "male";
  const isFemale = gender === "female";
  const userName = state?.aboutMe?.fullName || "Guest User";

  const reportedStage = isFemale
    ? (state?.hairHealth?.hair_fall_zone || "1")
    : (state?.hairHealth?.norwood_stage || "1");
  const aiPredictedStageNumber = rawAnalysis.aiPredictedStage;
  const stageDiscrepancy = Boolean(rawAnalysis.stageDiscrepancy);

  const findScalpImage = (type) => state?.scalpImages?.find((img) => img.type === type);
  const displayUserPhoto =
    findScalpImage("front")?.dataUrl ||
    findScalpImage("side")?.dataUrl ||
    findScalpImage("top")?.dataUrl;

  const requiresDoctorConsultation =
    (gender === "male" && ["6", "7"].includes(String(aiPredictedStageNumber))) ||
    (gender === "female" && aiPredictedStageNumber === "patchy-bald");

  const stateDumpString = JSON.stringify(state || {}).toLowerCase();
  const hasDandruff = stateDumpString.includes("dandruff") && !stateDumpString.includes("no-dandruff");

  const rootCauses = [];
  if (stateDumpString.includes("stress") || stateDumpString.includes("anxiety")) rootCauses.push("Cortisol Control");
  if (stateDumpString.includes("diet") || stateDumpString.includes("nutrition") || stateDumpString.includes("veg")) rootCauses.push("Nutrient Sync");
  if (stateDumpString.includes("hormone") || stateDumpString.includes("pcos") || stateDumpString.includes("thyroid")) rootCauses.push("Hormone Balancing");

  const recommendedBundle = !requiresDoctorConsultation
    ? getRecommendedBundle(gender, aiPredictedStageNumber, hasDandruff, rootCauses, includeHealthMix)
    : null;

  const analysisMissing = !aiPredictedStageNumber;

  const getStageTitle = () => {
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
    ? `Advanced follicular depletion detected. Direct medical oversight is required before starting treatment.`
    : (rawAnalysis.stageDescription || `Assessment indicates patterns matching ${getStageTitle()}.`);

  const regrowthOutlook = requiresDoctorConsultation
    ? `Speak with a dermatologist for advanced treatment options.`
    : (rawAnalysis.regrowthOutlook || `Your profile responds well to the recommended Zylk treatment bundle.`);

  const confidencePercent = rawAnalysis.aiConfidence ? Math.round(rawAnalysis.aiConfidence * 100) : 94;
  const aiReasoning = rawAnalysis.aiReasoning || `Visual analysis consistent with your reported hair loss pattern.`;

  const timelineMap = {
    "1": "1 - 2 Months",
    "2": "3 - 4 Months",
    "3": "6 Months",
    "4": "8 Months",
    "5": "12 Months",
    "overall-thinning": "4 - 6 Months",
    "patchy-bald": "Clinical Care Plan",
  };

  const contributingFactors = requiresDoctorConsultation
    ? [{ tag: "genetic", label: "Advanced Genetic Miniaturization", description: "Long-standing enzyme paths causing closure of active root fields." }]
    : [
        { tag: "genetic", label: isFemale ? "Hormonal Hair Vector" : "Genetic Predisposition Vector", description: isFemale ? "Receptor pathways causing micro-thinning along center hair parts." : "Hormonal shifts triggering cellular variations along follicles." },
        { tag: "stress-related", label: "Stress Adaptation Metrics", description: "Fluctuating cortisol levels forcing roots into resting telogen phases." },
        { tag: "scalp-related", label: "Scalp Shield Environment", description: hasDandruff ? "Surface microbial activity disrupting lipid barrier." : "Standard external cellular balance status." },
      ];

  const handleBackNavigation = () => {
    if (setLoading) setLoading(false);
    if (setError) setError(null);
    if (prevStep) prevStep();
    else window.history.back();
  };

  return (
    <div className="max-w-7xl mx-auto mt-4 px-4 mb-16 select-none !text-left animate-[fadeIn_0.3s_ease-out] block w-full">

      <div className="flex justify-between items-center mb-6 w-full">
        <button type="button" onClick={handleBackNavigation} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-700 transition-colors cursor-pointer group py-2">
          <span className="transform group-hover:-translate-x-0.5 transition-transform">←</span> Back to Questions
        </button>
        <span className="text-[10px] md:text-xs font-medium text-gray-400 bg-gray-100/80 px-3 py-1 rounded-full border border-gray-200/40">
          🤖 AI Assessment • Zylk Health
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start w-full">

        {/* LEFT — Report */}
        <div className="lg:col-span-6 bg-white rounded-[32px] p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 space-y-8 w-full">

          <div>
            <span className="text-xs font-bold tracking-[0.1em] text-gray-400 uppercase">Assessment Report</span>
            <div className="flex flex-col-reverse sm:flex-row justify-between items-start gap-6 mt-4">
              <div className="space-y-3 flex-1">
                <h2 className="text-3xl font-extrabold text-gray-900">{userName},</h2>
                <p className="text-lg text-gray-700 font-medium">
                  You Are Currently On <span className="text-[#064e3b] font-bold">{getStageTitle()}</span>
                </p>
                <div className="pt-2">
                  <span className="text-xs font-bold text-gray-400 block uppercase">Start Seeing Results In</span>
                  <span className="text-2xl font-black text-gray-900">{timelineMap[aiPredictedStageNumber] || "6 Months"}</span>
                </div>
              </div>
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0 shadow-sm mx-auto sm:mx-0">
                <img src={displayUserPhoto || AVATAR_FALLBACK_SVG} alt="Your capture" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = AVATAR_FALLBACK_SVG; }} />
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">Your Capture</span>
              </div>
            </div>
          </div>

          {analysisMissing && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-800">
              ⚠️ <b>AI scalp analysis incomplete.</b> Please retake the scalp scan.
              <button type="button" onClick={() => { if (prevStep) prevStep(); }} className="mt-3 text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-full cursor-pointer">Retake Scalp Scan</button>
            </div>
          )}
          {stageDiscrepancy && !analysisMissing && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-900 font-medium leading-relaxed !text-left w-full block">
              📸 <span className="font-bold">Photo-based assessment used.</span>
              <p className="text-xs text-blue-700 mt-1.5 !text-left">
                Your quiz answer was Stage {reportedStage}, but your uploaded photos indicate Stage {aiPredictedStageNumber}. Results are based on what we see in your images, not the quiz.
              </p>
            </div>
          )}

          <div className="p-4 bg-[#f4f6f0] border border-[#064e3b]/10 rounded-2xl text-sm text-[#064e3b]">
            ✨ <b>Prognosis:</b>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-gray-600">
              <li>{stageDescription}</li>
              <li>{regrowthOutlook}</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-base font-bold text-gray-900">Your Hair Fall Root Causes</h4>
            <div className="grid grid-cols-3 gap-3">
              {contributingFactors.map((factor) => (
                <button key={factor.tag} type="button" onClick={() => setActiveTab(factor.tag)} className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 text-center cursor-pointer ${activeTab === factor.tag ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] font-bold" : "border-gray-100 text-gray-500 hover:bg-gray-50"}`}>
                  <span className="text-lg">{factor.tag === "genetic" ? "🧬" : factor.tag === "stress-related" ? "⚖️" : "❄️"}</span>
                  <span className="text-xs truncate max-w-full">{factor.label.split(" ")[0]}</span>
                </button>
              ))}
            </div>
            {contributingFactors.find((f) => f.tag === activeTab) && (
              <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-600 border border-gray-100">
                <p className="font-bold text-gray-900">{contributingFactors.find((f) => f.tag === activeTab).label}</p>
                <p className="mt-1">{contributingFactors.find((f) => f.tag === activeTab).description}</p>
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200/60">
            <div className="flex justify-between text-xs mb-2 font-bold">
              <span className="text-gray-500 uppercase">AI Confidence</span>
              <span className="text-[#064e3b]">{confidencePercent}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#064e3b]" style={{ width: `${confidencePercent}%` }} />
            </div>
            <p className="mt-3 text-[11px] text-gray-400 italic">"{aiReasoning}"</p>
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-4">
            {state && (
              <PDFDownloadLink document={<AssessmentPDFTemplate state={state} aiAnalysis={rawAnalysis} />} fileName={`${userName.replace(/\s+/g, "_")}_Hair_Report.pdf`}>
                {({ loading }) => (
                  <button type="button" disabled={loading} className="w-full h-14 bg-white border-2 border-dashed border-gray-300 text-gray-700 rounded-full font-bold hover:bg-gray-50 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                    {loading ? "🔄 Compiling PDF..." : "📥 Download Full PDF Report"}
                  </button>
                )}
              </PDFDownloadLink>
            )}
            <button type="button" onClick={() => { if (resetQuiz) resetQuiz(); window.location.href = "/"; }} className="w-full text-center text-xs font-bold uppercase text-gray-400 hover:text-gray-600 cursor-pointer">
              🔄 Discard & Retake Quiz
            </button>
          </div>
        </div>

        {/* RIGHT — Zylk Products */}
        <div className="lg:col-span-4 bg-white rounded-[32px] p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 space-y-6 w-full">

          <div>
            <h3 className="text-lg font-bold text-gray-900">Your Recommended 1 Month Kit</h3>
            <p className="text-xs text-gray-400 mt-1">Personalized Zylk Health bundle for your stage</p>
            {recommendedBundle?.bundleTitle && (
              <p className="text-sm font-bold text-[#064e3b] mt-2">{recommendedBundle.bundleTitle}</p>
            )}
          </div>

          {requiresDoctorConsultation ? (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
              <h4 className="font-bold text-sm text-amber-900">⚠️ Direct Orders Restricted</h4>
              <p className="text-xs text-amber-700 mt-1">Please consult a trichologist for advanced stages.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(recommendedBundle?.items ?? []).map((prod) => (
                <div key={prod.id} className="p-3 border border-gray-100 rounded-2xl bg-white hover:border-[#064e3b]/30 transition-all flex items-center gap-3 group">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
                    <img
                      src={prod.imgUrl || PRODUCT_FALLBACK}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => { e.target.onerror = null; e.target.src = PRODUCT_FALLBACK; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-gray-800 leading-snug">{prod.name}</h4>
                    {prod.subtitle && <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{prod.subtitle}</p>}
                    <p className="text-xs text-[#064e3b] font-semibold mt-1">₹{prod.price}</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full shrink-0">
                    {prod.id === "zylk-hair-health-mix" && !includeHealthMix ? "Optional" : "Included"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 space-y-4">
            {!requiresDoctorConsultation && recommendedBundle && (
              <>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={includeHealthMix} onChange={(e) => setIncludeHealthMix(e.target.checked)} className="rounded border-gray-300" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Include Hair Health Mix</p>
                    <p className="text-xs text-gray-500">Zylk Hair Health Mix — ₹1,799 value</p>
                  </div>
                </label>
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-gray-500">Bundle Price</span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 line-through mr-2">₹{recommendedBundle.originalPrice}</span>
                    <span className="text-xl font-black text-gray-900">₹{recommendedBundle.price}</span>
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                if (requiresDoctorConsultation) {
                  alert("Please schedule a specialist consultation.");
                } else if (recommendedBundle) {
                  const { bundleNumber } = recommendedBundle;
                  addToCart({
                    id: recommendedBundle.bundleId,
                    name: getBundleDisplayName(bundleNumber, gender, aiPredictedStageNumber),
                    price: recommendedBundle.price,
                    priceWithMix: recommendedBundle.bundlePrice,
                    priceWithoutMix: recommendedBundle.priceWithoutMix,
                    bundleNumber,
                    includeHealthMix,
                    wooProductId: getWooProductId(bundleNumber, includeHealthMix),
                    wooProductIdWithMix: recommendedBundle.wooProductIdWithMix,
                    wooProductIdNoMix: recommendedBundle.wooProductIdNoMix,
                    subtitle: recommendedBundle.bundleTitle,
                  });
                  alert("Bundle added to cart!");
                }
              }}
              className="w-full h-14 bg-[#064e3b] text-white rounded-full font-bold shadow-md hover:bg-[#043427] transition-all text-base cursor-pointer"
            >
              {requiresDoctorConsultation ? "🩺 Schedule Consultation" : "BUY NOW — Start Treatment"}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}