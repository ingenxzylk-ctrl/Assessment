import { useState, useMemo, useEffect, useRef } from "react";
import { useQuiz } from "../context/QuizContext";
import { useCart } from "../context/CartContext";
import { getRecommendedBundle } from "../data/products";
import { getBundleDisplayName, getWooProductId } from "../config/bundles";
import { getEligibilityTimeline } from "../utils/eligibilityTimeline";
import { formatBundleProduct } from "../config/productImages";
import { motion, useMotionValue, animate } from "framer-motion";

const AVATAR_FALLBACK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e8eede'/><circle cx='50' cy='38' r='18' fill='%23a7c4a0'/><rect x='18' y='64' width='64' height='30' rx='15' fill='%23a7c4a0'/></svg>";

const FREE_ADDONS = [
  {
    id: "coach",
    title: "Hair Coach Support",
    desc: "Personalised guidance from a Hair Coach throughout your journey",
    was: 400,
    icon: "👩‍⚕️",
  },
  {
    id: "diet",
    title: "Customised Diet Plan",
    desc: "Nutrition roadmap tailored to your root causes",
    was: 500,
    icon: "🥗",
  },
  {
    id: "expert",
    title: "Expert Approval",
    desc: "Your kit is reviewed by a trichology expert before dispatch",
    was: 300,
    icon: "✅",
  },
];

const TESTIMONIALS = [
  {
    name: "Ajay Kumar",
    age: 28,
    city: "Hyderabad, Telangana",
    stage: "2",
    rating: 5,
    review:
      "I was losing hope with generic oils. Zylk's stage-based kit actually reduced my shedding in the first month. My hairline looks fuller now.",
    date: "Reviewed on 25th Feb 2025",
    months: ["Month 1", "Month 4", "Month 9"],
  },
  {
    name: "Rahul Mehta",
    age: 32,
    city: "Mumbai, Maharashtra",
    stage: "3",
    rating: 5,
    review:
      "The derma roller + serum combo worked better than anything I tried before. Visible baby hairs by month 5.",
    date: "Reviewed on 12th Jan 2025",
    months: ["Month 1", "Month 3", "Month 8"],
  },
];

function ProductImage({ src, fallbacks = [], alt, className }) {
  const [urlIndex, setUrlIndex] = useState(0);
  const allUrls = [src, ...fallbacks].filter(Boolean);
  const currentUrl = allUrls[urlIndex] || allUrls[allUrls.length - 1];

  return (
    <img
      src={currentUrl}
      alt={alt}
      className={className}
      onError={() => {
        if (urlIndex < allUrls.length - 1) setUrlIndex((p) => p + 1);
      }}
    />
  );
}

function getProductPurpose(name = "") {
  const n = name.toLowerCase();
  if (n.includes("shampoo") || n.includes("cleanser") || n.includes("dandruff")) return "For Dandruff";
  if (n.includes("minoxidil") || n.includes("rosemary") || n.includes("serum") || n.includes("growth")) return "For Hair Regrowth";
  if (n.includes("oil") || n.includes("progro")) return "For Scalp Nourishment";
  if (n.includes("supplement") || n.includes("health mix") || n.includes("vitality")) return "For Internal Health";
  if (n.includes("derma") || n.includes("roller")) return "For Absorption";
  if (n.includes("massager")) return "For Scalp Stimulation";
  if (n.includes("conditioner")) return "For Scalp Care";
  return "For Hair Health";
}

function buildRootCauses(state, hasDandruff, isFemale) {
  const dump = JSON.stringify(state || {}).toLowerCase();
  const causes = [];

  if (hasDandruff) {
    causes.push({
      id: "dandruff",
      label: "Dandruff",
      icon: "🧴",
      activeBg: "bg-orange-50 border-orange-200",
      desc: "Dandruff irritates your scalp and weakens hair roots. We clear it in 1 month for long-term regrowth.",
    });
  }

  causes.push({
    id: "genetic",
    label: "Genetics",
    icon: "🧬",
    activeBg: "bg-orange-50 border-orange-200",
    desc: isFemale
      ? "Hormonal shifts along the hair part line cause progressive thinning. Our kit targets receptors internally and topically."
      : "DHT sensitivity shrinks follicles over time. Our dual-action serum blocks DHT locally while nourishing roots.",
  });

  if (dump.includes("stress") || dump.includes("anxiety")) {
    causes.push({
      id: "stress",
      label: "Stress",
      icon: "⚖️",
      activeBg: "bg-orange-50 border-orange-200",
      desc: "Elevated cortisol pushes follicles into telogen (resting) phase. Adaptogens in your mix help rebalance stress response.",
    });
  }

  if (dump.includes("diet") || dump.includes("nutrition") || dump.includes("iron") || dump.includes("veg")) {
    causes.push({
      id: "nutrition",
      label: "Nutrition",
      icon: "🥬",
      activeBg: "bg-orange-50 border-orange-200",
      desc: "Micronutrient gaps weaken hair shaft production. Your supplement blend restores proteins, iron, and collagen support.",
    });
  }

  if (dump.includes("thyroid") || dump.includes("pcos") || dump.includes("hormone")) {
    causes.push({
      id: "hormonal",
      label: "Hormonal",
      icon: "💊",
      activeBg: "bg-orange-50 border-orange-200",
      desc: "Internal hormonal imbalance accelerates shedding. We address this with targeted internal + topical therapy.",
    });
  }

  return causes.length ? causes : causes;
}

// Maps a month number to its recovery "phase" — used to generate a
// description + icon for every single month, not just checkpoints.
function getMonthPhase(month, totalMonths) {
  if (month === 1) return { desc: "Control Dandruff", icon: "🌱" };
  if (month === totalMonths && totalMonths >= 9) {
    return { desc: "Full Density Results", icon: "🏆" };
  }

  const progress = month / totalMonths;
  if (progress <= 0.2) return { desc: "Improve Follicular Health", icon: "💧" };
  if (progress <= 0.4) return { desc: "Hair Fall Control", icon: "🛡️" };
  if (progress <= 0.6) return { desc: "Hair Growth", icon: "✨" };
  return { desc: "Maintaining Awesome Hair", icon: "🌟" };
}

// Builds the FULL month-by-month roadmap, from Month 1 all the way to
// resultMonths — no skipped months, however long the timeline is.
function buildRoadmapMonths(totalMonths) {
  const m = Math.max(1, Math.round(totalMonths) || 8);
  const months = [];
  for (let month = 1; month <= m; month++) {
    const phase = getMonthPhase(month, m);
    months.push({
      month,
      label: `Month ${month}`,
      desc: phase.desc,
      icon: phase.icon,
    });
  }
  return months;
}

/* ------------------------------------------------------------------ */
/* Roadmap timeline — hair-follicle growth icon                        */
/* ------------------------------------------------------------------ */

function FollicleIcon({ stage }) {
  // stage: 0 (just a root) -> 4 (full growth), drawn as a simple line icon
  const s = Math.min(4, Math.max(0, stage));
  return (
    <svg viewBox="0 0 40 40" className="w-6 h-6 md:w-7 md:h-7" fill="none">
      <circle cx="20" cy="27" r="9" stroke="currentColor" strokeWidth="1.6" />
      {s >= 1 && (
        <path d="M20 18 Q19 10 22 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {s >= 2 && (
        <path d="M16 19 Q13 12 15 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {s >= 3 && (
        <path d="M24 19 Q27 12 26 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
      {s >= 4 && (
        <>
          <path d="M14 20 L10 24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M26 20 L30 24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="17" cy="27" r="1" fill="currentColor" />
          <circle cx="23" cy="27" r="1" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

function RoadmapTimeline({ roadmap, resultMonths }) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);
  const itemRefs = useRef([]);

  const x = useMotionValue(0);
  const [itemWidth, setItemWidth] = useState(84);
  const [maxOffset, setMaxOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoPlayDone, setAutoPlayDone] = useState(false);

  // Measure item width so spacing holds up on any screen size.
  useEffect(() => {
    function measureItemWidth() {
      if (itemRefs.current[0]) setItemWidth(itemRefs.current[0].offsetWidth);
    }
    measureItemWidth();
    window.addEventListener("resize", measureItemWidth);
    return () => window.removeEventListener("resize", measureItemWidth);
  }, [roadmap.length]);

  // Work out how far the track can slide (track width minus visible width).
  useEffect(() => {
    function measureBounds() {
      if (trackRef.current && containerRef.current) {
        const trackWidth = trackRef.current.scrollWidth;
        const containerWidth = containerRef.current.offsetWidth;
        setMaxOffset(Math.max(0, trackWidth - containerWidth));
      }
    }
    measureBounds();
    window.addEventListener("resize", measureBounds);
    return () => window.removeEventListener("resize", measureBounds);
  }, [itemWidth, roadmap.length]);

  // Auto-advance like the reference video, then stop at the end.
  // Stops immediately if the person grabs the timeline themselves.
  useEffect(() => {
    if (isDragging || autoPlayDone || maxOffset === 0) return undefined;

    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const next = Math.min(maxOffset, step * itemWidth);
      animate(x, -next, { type: "spring", stiffness: 90, damping: 18 });
      if (next >= maxOffset) {
        clearInterval(timer);
        setAutoPlayDone(true);
      }
    }, 1300);

    return () => clearInterval(timer);
  }, [isDragging, autoPlayDone, maxOffset, itemWidth, x]);

  return (
    <div className="bg-[#e8f5e9] rounded-2xl p-4 overflow-hidden">
      <p className="text-center text-sm text-gray-700 mb-4">
        Start Seeing Results In{" "}
        <span className="font-black text-[#064e3b] text-lg">{resultMonths} Months</span>
      </p>

      <div ref={containerRef} className="relative overflow-hidden">
        <div className="absolute top-[30px] md:top-[34px] left-2 right-2 h-0.5 bg-[#52b788] z-0" />

        <motion.div
          ref={trackRef}
          className="flex relative z-10 cursor-grab active:cursor-grabbing select-none"
          style={{ x }}
          drag="x"
          dragConstraints={{ left: -maxOffset, right: 0 }}
          dragElastic={0.05}
          dragMomentum={false}
          onDragStart={() => {
            setIsDragging(true);
            setAutoPlayDone(true); // hand control over to the user for good
          }}
          onDragEnd={() => setIsDragging(false)}
        >
          {roadmap.map((step, index) => {
            const stage = Math.round((index / Math.max(1, roadmap.length - 1)) * 4);
            return (
              <div
                key={step.month}
                ref={(el) => (itemRefs.current[index] = el)}
                className="flex flex-col items-center shrink-0 w-[76px] md:w-[110px] px-1"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-white border-2 border-gray-700 text-gray-700 flex items-center justify-center pointer-events-none">
                  <FollicleIcon stage={stage} />
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#2d6a4f] mt-2 border-2 border-white shadow pointer-events-none" />
                <p className="text-[11px] md:text-xs font-bold text-gray-900 mt-2 text-center leading-tight pointer-events-none">
                  {step.label}
                </p>
                <p className="text-[9px] md:text-[10px] text-gray-500 text-center leading-tight mt-0.5 pointer-events-none">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

export default function Result() {
  const { state, resetQuiz, prevStep, setLoading, setError } = useQuiz();
  const { addToCart, cartCount, setIsCartOpen } = useCart();

  const [activeCause, setActiveCause] = useState(null);
  const [includeHealthMix, setIncludeHealthMix] = useState(true);
  const [coachCallOptIn, setCoachCallOptIn] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const rawAnalysis = state?.scalpAnalysis || {};
  const gender = state?.aboutMe?.gender || "male";
  const isFemale = gender === "female";
  const userName = state?.aboutMe?.fullName?.split(" ")[0] || "Guest";

  const aiPredictedStageNumber = rawAnalysis.aiPredictedStage;
  const analysisMissing = !aiPredictedStageNumber;
  const stageDiscrepancy = Boolean(rawAnalysis.stageDiscrepancy);
  const reportedStage = isFemale
    ? state?.hairHealth?.hair_fall_zone
    : state?.hairHealth?.norwood_stage;

  const extractImageUrl = (img) => {
    if (!img) return null;
    if (typeof img === "string") return img;
    return img.dataUrl || img.previewUrl || img.url || null;
  };

  const findScalpImage = (type) => state?.scalpImages?.find((img) => img.type === type);
  const displayUserPhoto =
    extractImageUrl(findScalpImage("front")) ||
    extractImageUrl(findScalpImage("top")) ||
    extractImageUrl(findScalpImage("side")) ||
    extractImageUrl(findScalpImage("back")) ||
    extractImageUrl(state?.scalpImages?.[0]);

  const requiresDoctorConsultation =
    (gender === "male" && ["6", "7"].includes(String(aiPredictedStageNumber))) ||
    (gender === "female" && aiPredictedStageNumber === "patchy-bald");

  const stateDump = JSON.stringify(state || {}).toLowerCase();
  const hasDandruff = stateDump.includes("dandruff") && !stateDump.includes("no-dandruff");

  const rootCauses = useMemo(() => buildRootCauses(state, hasDandruff, isFemale), [state, hasDandruff, isFemale]);
  const selectedCause = rootCauses.find((c) => c.id === (activeCause || rootCauses[0]?.id)) || rootCauses[0];

  const rootCauseTags = [];
  if (stateDump.includes("stress")) rootCauseTags.push("Cortisol Control");
  if (stateDump.includes("diet") || stateDump.includes("nutrition")) rootCauseTags.push("Nutrient Sync");
  if (stateDump.includes("hormone") || stateDump.includes("pcos") || stateDump.includes("thyroid")) rootCauseTags.push("Hormone Balancing");

  const recommendedBundle = !requiresDoctorConsultation
    ? getRecommendedBundle(gender, aiPredictedStageNumber, hasDandruff, rootCauseTags, includeHealthMix)
    : null;

  const eligibilityTimeline = getEligibilityTimeline(state, aiPredictedStageNumber);
  const resultMonths = eligibilityTimeline.months || 8;
  const roadmap = buildRoadmapMonths(resultMonths);

  const getStageTitle = () => {
    if (analysisMissing) return "Assessment Incomplete";
    if (isFemale) {
      if (aiPredictedStageNumber === "patchy-bald") return "Alopecia / Focal Pattern Thinning";
      if (aiPredictedStageNumber === "overall-thinning") return "Overall Diffuse Thinning";
      return `Stage ${aiPredictedStageNumber} Of Female Pattern Hair Fall`;
    }
    if (aiPredictedStageNumber === "overall-thinning") return "Overall Thinning Pattern";
    return `Stage ${aiPredictedStageNumber} Of Male Pattern Hair Fall`;
  };

  const kitProducts = (recommendedBundle?.items ?? [])
    .map((prod) => {
      const formatted = formatBundleProduct(prod, isFemale);
      if (!formatted) return null;
      const isHealthMix =
        prod.id === "zylk-hair-health-mix" ||
        String(prod.id || "").startsWith("prod-supplements");
      return {
        ...formatted,
        id: prod.id,
        subtitle: prod.subtitle || null,
        isHealthMix,
      };
    })
    .filter(Boolean);

  const coreKitProducts = kitProducts.filter((p) => !p.isHealthMix);
  const healthMixProduct = kitProducts.find((p) => p.isHealthMix) || null;
  const healthMixDelta = recommendedBundle
    ? Math.max(0, (recommendedBundle.bundlePrice || 0) - (recommendedBundle.priceWithoutMix || 0))
    : 0;
  const savings = recommendedBundle ? recommendedBundle.originalPrice - recommendedBundle.price : 0;
  const testimonial = TESTIMONIALS[testimonialIdx % TESTIMONIALS.length];
  const handleBuyNow = () => {
    if (requiresDoctorConsultation) {
      alert("Connecting you with a Zylk trichology specialist...");
      return;
    }
    if (!recommendedBundle) return;
    const { bundleNumber } = recommendedBundle;
    addToCart({
      id: recommendedBundle.bundleId,
      name: getBundleDisplayName(bundleNumber, gender, aiPredictedStageNumber),
      price: recommendedBundle.price,
      priceWithMix: recommendedBundle.bundlePrice,
      priceWithoutMix: recommendedBundle.priceWithoutMix,
      bundleNumber,
      includeHealthMix,
      coachCallOptIn,
      wooProductId: getWooProductId(bundleNumber, includeHealthMix),
      wooProductIdWithMix: recommendedBundle.wooProductIdWithMix,
      wooProductIdNoMix: recommendedBundle.wooProductIdNoMix,
      subtitle: `Complete Customized System (Stage ${aiPredictedStageNumber})`,
    });
  };

  const handleBack = () => {
    if (setLoading) setLoading(false);
    if (setError) setError(null);
    if (prevStep) prevStep();
    else window.history.back();
  };

  return (
    <div className="min-h-screen bg-[#f0f7f4] -mx-4 md:-mx-8 -mt-8 pb-36 md:pb-10">
      <div className="max-w-lg md:max-w-6xl mx-auto px-3 md:px-6 pt-4 md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">
      {/* LEFT COLUMN — scrolls normally on desktop, single column on mobile */}
      <div className="space-y-4 md:min-w-0">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 pt-3">
            <span className="inline-block text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 px-3 py-1 rounded-t-lg border border-b-0 border-gray-100">
              Assessment Report
            </span>
          </div>

          <div className="px-4 pb-4 pt-2">
            <div className="flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">Hello {userName},</h1>
                <p className="text-sm text-gray-500 mt-1">You Are Currently On</p>
                <p className="text-base font-bold text-gray-900 leading-snug mt-0.5">{getStageTitle()}</p>

                {!analysisMissing && (
                  <div className="mt-3">
                    {eligibilityTimeline.needsTransplant ? (
                      <>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Recommended Next Step</p>
                        <p className="text-lg font-black text-amber-700">Hair Transplant Consultation</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Start Seeing Results In</p>
                        <p className="text-2xl font-black text-gray-900">{eligibilityTimeline.label}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-[#064e3b]/20 shrink-0 bg-gray-50">
                <img
                  src={displayUserPhoto || AVATAR_FALLBACK}
                  alt="Your scalp capture"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = AVATAR_FALLBACK;
                  }}
                />
              </div>
            </div>

            {analysisMissing && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                <p className="font-bold">AI scalp analysis incomplete.</p>
                <p className="text-xs text-red-600 mt-1">Please retake the scalp scan to get your photo-based stage.</p>
                <button
                  type="button"
                  onClick={() => { if (prevStep) prevStep(); else window.history.back(); }}
                  className="mt-2 text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-3 py-1.5 rounded-full cursor-pointer"
                >
                  Retake Scalp Scan
                </button>
              </div>
            )}

            {stageDiscrepancy && !analysisMissing && (
              <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-900">
                <p className="font-bold">Photo-based assessment used</p>
                <p className="text-xs text-blue-700 mt-1">
                  Your quiz answer was Stage {reportedStage || "—"}, but your uploaded photos indicate Stage {aiPredictedStageNumber}.
                  Results are based on what we see in your images, not the quiz.
                </p>
              </div>
            )}

            {!requiresDoctorConsultation && eligibilityTimeline.eligible !== false && (
              <div className="mt-4 bg-[#5a6b2e] rounded-full px-4 py-2 flex items-center justify-between text-white text-sm">
                <span className="font-bold">94% Saw Results*</span>
                <button type="button" className="text-white/90 text-xs font-semibold flex items-center gap-1">
                   
                </button>
              </div>
            )}

            <div className="mt-4 bg-[#e8f5e9] rounded-xl p-4 text-sm text-[#1b4332] leading-relaxed">
              <p className="font-bold mb-2">
                {requiresDoctorConsultation
                  ? "Your hair loss needs clinical intervention."
                  : hasDandruff
                    ? "Your hair fall has multiple root causes, but don't worry!"
                    : "Your hair fall is genetic, but don't worry!"}
              </p>
              <ul className="list-disc pl-4 space-y-1 text-xs text-[#2d6a4f]">
                {requiresDoctorConsultation ? (
                  <>
                    <li>Advanced follicular depletion at this stage needs specialist evaluation.</li>
                    <li>Topical kits alone may not restore significant density.</li>
                    <li>Book a consultation to explore transplant or clinical therapies.</li>
                  </>
                ) : (
                  <>
                    <li>This is caused by internal hormones and scalp environment working together.</li>
                    <li>At your stage, most hair follicles are still active and can be revived.</li>
                    <li>With consistent use of your customised Zylk kit, regrowth is achievable.</li>
                  </>
                )}
              </ul>
            </div>

            <p className="text-[10px] text-gray-400 mt-3 italic">
              *Based on internal Zylk user outcomes for profiles matching your stage and age group.
            </p>
          </div>
        </div>

        {!requiresDoctorConsultation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">Your Hair Fall Root Causes</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {rootCauses.map((cause) => {
                const isActive = (activeCause || rootCauses[0]?.id) === cause.id;
                return (
                  <button
                    key={cause.id}
                    type="button"
                    onClick={() => setActiveCause(cause.id)}
                    className={`shrink-0 w-20 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
                      isActive ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"
                    }`}
                  >
                    <span className="text-2xl">{cause.icon}</span>
                    <span className="text-[11px] font-semibold text-gray-700">{cause.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedCause && (
              <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
                {selectedCause.desc}
              </div>
            )}
          </div>
        )}

        {!requiresDoctorConsultation && (
          <div className="bg-[#f0faf4] border border-[#b7e4c7] rounded-2xl p-4 flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-3xl font-black text-[#064e3b]">3 Times</p>
              <p className="text-sm font-bold text-gray-800">Better results</p>
              <p className="text-[10px] text-gray-500 uppercase mt-1">Based on a 5-month study*</p>
              <button type="button" className="mt-2 text-xs font-semibold border border-gray-800 rounded-full px-3 py-1.5 bg-white">
                Check Study →
              </button>
            </div>
            <div className="w-28 shrink-0 flex items-end gap-1 h-24">
              <div className="flex flex-col items-center flex-1">
                <div className="w-full bg-gray-300 rounded-t h-8" />
                <span className="text-[8px] text-gray-500 mt-1 text-center leading-tight">Minoxidil Alone</span>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div className="w-full bg-[#52b788] rounded-t h-20 relative">
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#064e3b]">3x</span>
                </div>
                <span className="text-[8px] text-gray-500 mt-1 text-center leading-tight">Zylk Regimen</span>
              </div>
            </div>
          </div>
        )}

        {!requiresDoctorConsultation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-bold text-gray-900">
              Here is <span className="text-[#064e3b]">{testimonial.name.split(" ")[0]}</span>
            </h2>
            <p className="text-sm text-gray-500 mb-3">Who Matches Your Profile</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {testimonial.months.map((label, i) => (
                <div key={i} className="shrink-0 w-24">
                  <div className="h-28 rounded-lg bg-gradient-to-b from-gray-200 to-gray-300 overflow-hidden border border-gray-200">
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-40">👤</div>
                  </div>
                  <p className="text-[10px] text-center text-gray-600 mt-1 font-medium">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-1.5 mt-3">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTestimonialIdx(i)}
                  className={`w-2 h-2 rounded-full ${i === testimonialIdx ? "bg-gray-800" : "bg-gray-300"}`}
                />
              ))}
            </div>
          </div>
        )}

        {!requiresDoctorConsultation && (coreKitProducts.length > 0 || healthMixProduct) && (
          <div className="md:hidden bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Start Your Journey With Just 1 Month Kit
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Personalized Zylk Health bundle for your stage
              </p>
              {recommendedBundle?.bundleTitle && (
                <p className="text-sm font-bold text-[#064e3b] mt-2">
                  {recommendedBundle.bundleTitle}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {coreKitProducts.map((product, index) => (
                <div
                  key={product.id || index}
                  className="p-4 border border-gray-100 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-[#064e3b]/30 hover:shadow-md transition-all flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-4">
                      <ProductImage
                        src={product.imgUrl}
                        fallbacks={product.imgFallbacks}
                        alt={product.shortName}
                        className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-sm font-bold text-gray-800 leading-snug tracking-tight break-words">
                        {product.shortName}
                      </h3>
                      {product.subtitle && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                          {product.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 border text-emerald-800 bg-emerald-50 border-emerald-100/40">
                    Included
                  </span>
                </div>
              ))}

              {healthMixProduct && (
                <div
                  className={`p-4 border rounded-2xl transition-all flex items-center justify-between gap-4 group ${
                    includeHealthMix
                      ? "border-[#064e3b]/30 bg-[#f4f6f0] shadow-[0_2px_12px_rgba(0,0,0,0.01)]"
                      : "border-dashed border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-4">
                      <ProductImage
                        src={healthMixProduct.imgUrl}
                        fallbacks={healthMixProduct.imgFallbacks}
                        alt={healthMixProduct.shortName}
                        className={`w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105 ${
                          includeHealthMix ? "" : "opacity-60"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-sm font-bold text-gray-800 leading-snug tracking-tight break-words">
                        {healthMixProduct.shortName}
                      </h3>
                      {healthMixProduct.subtitle && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                          {healthMixProduct.subtitle}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-[#064e3b] mt-1">
                        {includeHealthMix
                          ? `Included · −₹${healthMixDelta} if removed`
                          : `Add for +₹${healthMixDelta}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeHealthMix(!includeHealthMix)}
                    className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                      includeHealthMix
                        ? "text-emerald-800 bg-emerald-50 border-emerald-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        : "text-white bg-[#064e3b] border-[#064e3b] hover:bg-[#043427]"
                    }`}
                  >
                    {includeHealthMix ? "Remove" : "Add"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#e8f5e9] rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-[#1b4332]">
              <span>🌿</span>
              <span>Supplements &amp; Oil are 100% Ayurvedic with no side effects.</span>
            </div>
          </div>
        )}

        {!requiresDoctorConsultation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex justify-center mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider border-2 border-[#064e3b] text-[#064e3b] rounded-full px-4 py-1">
                Free Add-ons
              </span>
            </div>
            <div className="space-y-3">
              {FREE_ADDONS.map((addon) => (
                <div key={addon.id} className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-xl shrink-0">
                    {addon.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">{addon.title}</p>
                    <p className="text-xs text-gray-500 leading-snug">{addon.desc}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 line-through">₹{addon.was}</span>
                      <span className="text-[10px] font-bold bg-[#52b788] text-white px-2 py-0.5 rounded">FREE</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!requiresDoctorConsultation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">Hair coach unlocked</p>
                <p className="text-xs text-gray-500 mt-1">Dedicated hair expert just a call away to support you.</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-[#e8eede] flex items-center justify-center text-3xl shrink-0">👩‍⚕️</div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-600 flex-1">Opt-in for a call immediately after placing your order</p>
              <button
                type="button"
                role="switch"
                aria-checked={coachCallOptIn}
                onClick={() => setCoachCallOptIn(!coachCallOptIn)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                  coachCallOptIn ? "bg-[#064e3b]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    coachCallOptIn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {!requiresDoctorConsultation && !eligibilityTimeline.needsTransplant && (
          <RoadmapTimeline roadmap={roadmap} resultMonths={resultMonths} />
        )}

        {!requiresDoctorConsultation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-lg font-bold text-gray-900 leading-snug mb-4">
              Your Routine Gets Easier And Cheaper Every Month
            </h2>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 relative h-44">
              <p className="text-sm font-bold text-gray-500 mb-2">Less Products. Less Cost. Less Effort.</p>
              <svg viewBox="0 0 300 100" className="w-full h-24" preserveAspectRatio="none">
                <path d="M20,20 Q150,80 280,70" fill="none" stroke="#52b788" strokeWidth="4" />
                <circle cx="20" cy="20" r="5" fill="#52b788" />
                <circle cx="280" cy="70" r="5" fill="#52b788" />
              </svg>
              <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                <span>Month 1</span>
                <span>Month 3</span>
                <span>Month 5</span>
                <span>Month 8</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-base font-bold text-gray-900 mb-3">Real People, Real Stories</h2>
          <div className="border border-gray-100 rounded-xl p-4">
            <span className="inline-block text-[10px] font-bold bg-gray-800 text-white px-2 py-0.5 rounded mb-3">
              STAGE {testimonial.stage}
            </span>
            <div className="flex gap-2 mb-3">
              {testimonial.months.map((m, i) => (
                <div key={i} className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center text-lg">📷</div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">{testimonial.name}, {testimonial.age}</p>
              <span className="text-xs text-[#52b788] font-semibold flex items-center gap-1">✓ Verified</span>
            </div>
            <p className="text-xs text-gray-400">{testimonial.city}</p>
            <p className="text-yellow-400 text-sm my-2">{"★".repeat(testimonial.rating)}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{testimonial.review}</p>
            <p className="text-[10px] text-gray-400 mt-2">{testimonial.date}</p>
          </div>
        </div>

        {!requiresDoctorConsultation && eligibilityTimeline.eligible !== false && !eligibilityTimeline.needsTransplant && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3 text-xl">₹</div>
            <p className="text-xl font-bold text-[#064e3b]">Congratulations!</p>
            <p className="text-sm font-bold text-gray-600 mt-1">You Are 100% Eligible For The Money Back Policy</p>
            <div className="border-t border-dashed border-gray-200 my-4" />
            <button type="button" className="text-sm text-gray-600 underline">Read Money back policy</button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setFaqOpen(!faqOpen)}
            className="w-full flex items-center justify-between px-4 py-4 text-left font-bold text-gray-900 cursor-pointer"
          >
            FAQ&apos;s
            <span className={`transition-transform ${faqOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          {faqOpen && (
            <div className="px-4 pb-4 space-y-3 text-sm text-gray-600 border-t border-gray-50 pt-3">
              <p><strong>How long until I see results?</strong> Most users see changes in {resultMonths} months with consistent use.</p>
              <p><strong>Is it safe?</strong> All products are GMP &amp; ISO 9001 certified.</p>
              <p><strong>Can I cancel?</strong> Yes — review our money-back policy for eligibility details.</p>
            </div>
          )}
        </div>

        <p className="text-[10px] text-gray-400 italic text-center px-2">
          *As per an internal study conducted by Zylk Health
        </p>

        <div className="flex gap-3 pb-4">
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 h-12 border border-gray-200 rounded-full text-sm font-semibold text-gray-600 bg-white cursor-pointer"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={() => { if (resetQuiz) resetQuiz(); window.location.href = "/"; }}
            className="flex-1 h-12 text-sm font-semibold text-gray-400 cursor-pointer"
          >
            Retake Quiz
          </button>
        </div>
      </div>
      {/* END LEFT COLUMN */}

      {/* RIGHT COLUMN — sticky purchase card, desktop only */}
      {!requiresDoctorConsultation && (coreKitProducts.length > 0 || healthMixProduct) && (
        <div className="hidden md:block md:sticky md:top-6">
          <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Start Your Journey With Just 1 Month Kit
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Personalized Zylk Health bundle for your stage
              </p>
              {recommendedBundle?.bundleTitle && (
                <p className="text-sm font-bold text-[#064e3b] mt-2">
                  {recommendedBundle.bundleTitle}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {coreKitProducts.map((product, index) => (
                <div
                  key={product.id || index}
                  className="p-3 border border-gray-100 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-[#064e3b]/30 hover:shadow-md transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-3">
                      <ProductImage
                        src={product.imgUrl}
                        fallbacks={product.imgFallbacks}
                        alt={product.shortName}
                        className="w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-xs font-bold text-gray-800 leading-snug tracking-tight break-words">
                        {product.shortName}
                      </h3>
                      {product.subtitle && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                          {product.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 border text-emerald-800 bg-emerald-50 border-emerald-100/40">
                    Included
                  </span>
                </div>
              ))}

              {healthMixProduct && (
                <div
                  className={`p-3 border rounded-2xl transition-all flex items-center justify-between gap-3 group ${
                    includeHealthMix
                      ? "border-[#064e3b]/30 bg-[#f4f6f0] shadow-[0_2px_12px_rgba(0,0,0,0.01)]"
                      : "border-dashed border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-3">
                      <ProductImage
                        src={healthMixProduct.imgUrl}
                        fallbacks={healthMixProduct.imgFallbacks}
                        alt={healthMixProduct.shortName}
                        className={`w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-105 ${
                          includeHealthMix ? "" : "opacity-60"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-xs font-bold text-gray-800 leading-snug tracking-tight break-words">
                        {healthMixProduct.shortName}
                      </h3>
                      {healthMixProduct.subtitle && (
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                          {healthMixProduct.subtitle}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-[#064e3b] mt-1">
                        {includeHealthMix
                          ? `Included · −₹${healthMixDelta} if removed`
                          : `Add for +₹${healthMixDelta}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeHealthMix(!includeHealthMix)}
                    className={`text-[10px] font-bold px-2 py-1.5 rounded-full whitespace-nowrap shrink-0 border cursor-pointer transition-colors ${
                      includeHealthMix
                        ? "text-emerald-800 bg-emerald-50 border-emerald-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        : "text-white bg-[#064e3b] border-[#064e3b] hover:bg-[#043427]"
                    }`}
                  >
                    {includeHealthMix ? "Remove" : "Add"}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#e8f5e9] rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-[#1b4332]">
              <span>🌿</span>
              <span>Supplements &amp; Oil are 100% Ayurvedic with no side effects.</span>
            </div>

            <div className="border-t border-gray-100 pt-4">
              {recommendedBundle && !requiresDoctorConsultation ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-900">₹{recommendedBundle.price}</span>
                    <span className="text-sm text-gray-400 line-through">₹{recommendedBundle.originalPrice}</span>
                  </div>
                  {savings > 0 && (
                    <p className="text-xs font-semibold text-[#52b788]">You save ₹{savings}</p>
                  )}
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeHealthMix}
                      onChange={(e) => setIncludeHealthMix(e.target.checked)}
                      className="rounded border-gray-300 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-gray-500">
                      Include Hair Health Mix
                      {healthMixDelta > 0 && (
                        <span className="font-semibold text-[#064e3b]">
                          {" "}({includeHealthMix ? `−₹${healthMixDelta}` : `+₹${healthMixDelta}`})
                        </span>
                      )}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="mt-4 w-full bg-[#c6d947] hover:bg-[#b8c93a] text-gray-900 font-black text-base py-3.5 rounded-lg uppercase tracking-wide cursor-pointer transition-colors shadow-sm"
                  >
                    Buy Now
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full bg-[#c6d947] hover:bg-[#b8c93a] text-gray-900 font-black text-base py-3.5 rounded-lg uppercase tracking-wide cursor-pointer"
                >
                  {requiresDoctorConsultation ? "Schedule Consultation" : "Continue"}
                </button>
              )}
              <p className="text-[10px] text-gray-400 text-center mt-3">
                All of our products are GMP &amp; ISO 9001 certified
              </p>
            </div>
          </div>
        </div>
      )}

      {requiresDoctorConsultation && (
        <div className="hidden md:block md:sticky md:top-6">
          <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 text-center space-y-3">
            <p className="text-sm font-bold text-gray-900">Your hair loss needs clinical intervention.</p>
            <p className="text-xs text-gray-500">Speak with a Zylk trichology specialist to explore next steps.</p>
            <button
              type="button"
              onClick={handleBuyNow}
              className="w-full bg-[#c6d947] hover:bg-[#b8c93a] text-gray-900 font-black text-base py-3.5 rounded-lg uppercase tracking-wide cursor-pointer"
            >
              Schedule Consultation
            </button>
          </div>
        </div>
      )}
      </div>
      {/* END GRID */}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="bg-gray-100 text-center py-1.5">
          <p className="text-[10px] text-gray-600 font-medium">All of our products are GMP &amp; ISO 9001 certified</p>
        </div>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {recommendedBundle && !requiresDoctorConsultation ? (
            <>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900">₹{recommendedBundle.price}</span>
                  <span className="text-sm text-gray-400 line-through">₹{recommendedBundle.originalPrice}</span>
                </div>
                {savings > 0 && (
                  <p className="text-xs font-semibold text-[#52b788]">You save ₹{savings}</p>
                )}
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeHealthMix}
                    onChange={(e) => setIncludeHealthMix(e.target.checked)}
                    className="rounded border-gray-300 w-3.5 h-3.5"
                  />
                  <span className="text-[10px] text-gray-500">
                    Include Hair Health Mix
                    {healthMixDelta > 0 && (
                      <span className="font-semibold text-[#064e3b]">
                        {" "}({includeHealthMix ? `−₹${healthMixDelta}` : `+₹${healthMixDelta}`})
                      </span>
                    )}
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={handleBuyNow}
                className="shrink-0 bg-[#c6d947] hover:bg-[#b8c93a] text-gray-900 font-black text-base px-10 py-3.5 rounded-lg uppercase tracking-wide cursor-pointer transition-colors shadow-sm"
              >
                Buy Now
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleBuyNow}
              className="w-full bg-[#c6d947] hover:bg-[#b8c93a] text-gray-900 font-black text-base py-3.5 rounded-lg uppercase tracking-wide cursor-pointer"
            >
              {requiresDoctorConsultation ? "Schedule Consultation" : "Continue"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
