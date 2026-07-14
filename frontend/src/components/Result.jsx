import { useState, useMemo, useEffect, useRef } from "react";
import { useQuiz } from "../context/QuizContext";
import { useCart } from "../context/CartContext";
import { getRecommendedBundle } from "../data/products";
import { getBundleDisplayName, getWooProductId } from "../config/bundles";
import { getEligibilityTimeline } from "../utils/eligibilityTimeline";
import { formatBundleProduct } from "../config/productImages";
import { HAIR_HEALTH_MIX_PRICE } from "../data/zylkProductCatalog";
import { submitAssessmentReport } from "../api/quizApi";
import { motion, useMotionValue, animate } from "framer-motion";

const AVATAR_FALLBACK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e8eede'/><circle cx='50' cy='38' r='18' fill='%23a7c4a0'/><rect x='18' y='64' width='64' height='30' rx='15' fill='%23a7c4a0'/></svg>";

const TESTIMONIAL_EXTS = ["jpg", "jpeg", "png", "webp"];

/** Normalize a pasted path/filename into a public URL under /testimonials. */
function normalizeTestimonialSrc(raw) {
  if (!raw || typeof raw !== "string") return null;
  let value = raw.trim().replace(/^['"]|['"]$/g, "");
  if (!value) return null;

  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("/testimonials/")) return value;

  // Windows/Unix path → filename only
  // e.g. C:\Users\DELL\Desktop\hair-scalp-quiz\frontend\public\testimonials\ajay-before.jpg
  value = value.replace(/\\/g, "/");
  const marker = "/testimonials/";
  const markerIdx = value.toLowerCase().lastIndexOf(marker);
  if (markerIdx !== -1) {
    value = value.slice(markerIdx + marker.length);
  } else {
    value = value.split("/").pop() || value;
  }

  value = value.split("?")[0].split("#")[0];
  if (!value) return null;
  if (!value.includes(".")) value = `${value}.jpg`;
  return `/testimonials/${value}`;
}

function testimonialExtensionFallbacks(src) {
  if (!src || !src.startsWith("/testimonials/")) return [];
  const match = src.match(/^(.*)\.([a-z0-9]+)$/i);
  if (!match) return [];
  const [, base, ext] = match;
  return TESTIMONIAL_EXTS.filter((e) => e.toLowerCase() !== ext.toLowerCase()).map(
    (e) => `${base}.${e}`
  );
}

/** Resolve public/testimonials paths for before/after photos. */
function resolveTestimonialPhotos(photos = []) {
  return photos
    .map((photo) => {
      const raw =
        typeof photo === "string" ? photo : photo?.file || photo?.src || photo?.path || "";
      const src = normalizeTestimonialSrc(raw);
      if (!src) return null;
      const label = typeof photo === "string" ? "" : photo.label || "";
      const fit = typeof photo === "string" ? "cover" : photo.fit || "cover";
      return {
        label,
        src,
        fallbacks: testimonialExtensionFallbacks(src),
        fit,
      };
    })
    .filter(Boolean);
}

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
    name: "Harish",
    age: 28,
    city: "Chennai, Tamil Nadu",
    stage: "3",
    rating: 5,
    review:
      "I was losing hope with generic oils. Zylk's stage-based kit actually reduced my shedding in the first month. My hairline looks fuller now.",
    date: "Reviewed on 25th Feb 2025",
    // Put files in frontend/public/testimonials/ (jpg/png/webp OK)
    photos: [
      { label: "Before", file: "Harish-before.png" },
     
      { label: "After", file: "Harish-after.png" },
    ],
  },
  {
    name: "Arun",
    age: 32,
    city: "Thoothukudi, Tamil Nadu",
    stage: "4",
    rating: 5,
    review:
      "The derma roller + serum combo worked better than anything I tried before. Visible baby hairs by month 5.",
    date: "Reviewed on 12th Jan 2025",
    // Keep Ajay's default frames; Rahul's Arun shots need contain + portrait frames
    // so they aren't over-cropped like object-cover square crops.
    photoFrameClass: "aspect-[3/4]",
    photos: [
      { label: "Before", file: "Arun-before.png", fit: "contain" },
      { label: "After", file: "Arun-after.png", fit: "contain" },
    ],
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

function TestimonialPhoto({
  src,
  fallbacks = [],
  alt,
  label,
  className,
  fit = "cover",
}) {
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const allUrls = [src, ...fallbacks].filter(Boolean);
  const currentUrl = allUrls[urlIndex];

  useEffect(() => {
    setUrlIndex(0);
    setFailed(false);
  }, [src, fallbacks.join("|")]);

  if (failed || !currentUrl) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-gray-200 text-gray-400 ${className || ""}`}
        aria-label={alt || label || "Photo coming soon"}
      >
        <span className="text-lg opacity-50" aria-hidden="true">
          👤
        </span>
        {label ? <span className="mt-1 text-[9px] font-semibold uppercase tracking-wide">{label}</span> : null}
      </div>
    );
  }

  return (
    <div
      className={`relative h-full w-full overflow-hidden ${
        fit === "contain" ? "bg-gray-100" : ""
      } ${className || ""}`}
    >
      <img
        src={currentUrl}
        alt={alt || label || "Customer progress photo"}
        className={`absolute inset-0 h-full w-full object-center ${
          fit === "contain" ? "object-contain" : "object-cover"
        }`}
        onError={() => {
          if (urlIndex < allUrls.length - 1) setUrlIndex((p) => p + 1);
          else setFailed(true);
        }}
      />
    </div>
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

function getOrCreateDailyReportMeta(fingerprint) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const dateKey = `${dd}${mm}${yyyy}`;
  const reportDate = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (typeof window === "undefined") {
    return { reportId: `TR-${dateKey}-01`, reportDate };
  }

  const assignedKey = `zylk_report_assigned_${dateKey}_${fingerprint}`;
  const existing = window.localStorage.getItem(assignedKey);
  if (existing) {
    return { reportId: existing, reportDate };
  }

  const countKey = `zylk_report_count_${dateKey}`;
  const next = Number(window.localStorage.getItem(countKey) || "0") + 1;
  window.localStorage.setItem(countKey, String(next));
  const reportId = `TR-${dateKey}-${String(next).padStart(2, "0")}`;
  window.localStorage.setItem(assignedKey, reportId);
  return { reportId, reportDate };
}

function buildRootCauses(state, hasDandruff, isFemale) {
  const dump = JSON.stringify(state || {}).toLowerCase();
  const causes = [];

  if (hasDandruff) {
    causes.push({
      id: "dandruff",
      label: "Dandruff",
      icon: "🧴",
      desc: "Dandruff irritates your scalp and weakens hair roots. We clear it in 1 month for long-term regrowth.",
    });
  }

  causes.push({
    id: "genetic",
    label: "Genetics",
    icon: "🧬",
    desc: isFemale
      ? "Hormonal shifts along the hair part line cause progressive thinning. Our kit targets receptors internally and topically."
      : "DHT sensitivity shrinks follicles over time. Our dual-action serum blocks DHT locally while nourishing roots.",
  });

  if (dump.includes("stress") || dump.includes("anxiety") || dump.includes("sleep") || dump.includes("poor")) {
    causes.push({
      id: "lifestyle",
      label: "Lifestyle",
      icon: "❤️",
      desc: "High stress levels and poor sleep can accelerate hair fall. This plan includes strategies to manage these environmental triggers.",
    });
  }

  if (dump.includes("diet") || dump.includes("nutrition") || dump.includes("iron") || dump.includes("veg") || dump.includes("food")) {
    causes.push({
      id: "nutrition",
      label: "Nutrition",
      icon: "🍎",
      desc: "Optimizing your intake is key to healthy growth. Our analysis identifies nutritional gaps to support your hair health from the inside out.",
    });
  } else {
    causes.push({
      id: "nutrition",
      label: "Nutrition",
      icon: "🍎",
      desc: "Optimizing your intake is key to healthy growth. Our analysis identifies nutritional gaps to support your hair health from the inside out.",
    });
  }

  if (dump.includes("thyroid") || dump.includes("pcos") || dump.includes("hormone")) {
    causes.push({
      id: "hormonal",
      label: "Hormonal",
      icon: "💊",
      desc: "Internal hormonal imbalance accelerates shedding. We address this with targeted internal + topical therapy.",
    });
  }

  if (!causes.some((c) => c.id === "lifestyle")) {
    causes.push({
      id: "lifestyle",
      label: "Lifestyle",
      icon: "❤️",
      desc: "High stress levels and poor sleep can accelerate hair fall. This plan includes strategies to manage these environmental triggers.",
    });
  }

  return causes;
}

function getMonthPhase(month, totalMonths) {
  if (month === 1) return { desc: "Scalp Cleared & Fall Reduced", icon: "🌱" };
  if (month === 2) return { desc: "Follicle Health Improving", icon: "💧" };
  if (month === 3) return { desc: "Stronger Roots & Better Texture", icon: "🛡️" };
  if (month === 4) return { desc: "Shedding Stabilises", icon: "✨" };
  if (month === 5) return { desc: "Visible New Growth", icon: "🌿" };
  if (month === totalMonths && totalMonths >= 9) {
    return { desc: "Full Density Results", icon: "🏆" };
  }

  const progress = month / totalMonths;
  if (progress <= 0.45) return { desc: "Hair Fall Control", icon: "🛡️" };
  if (progress <= 0.7) return { desc: "Hair Growth Building", icon: "✨" };
  return { desc: "Maintaining Awesome Hair", icon: "🌟" };
}

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

function ResultsSeeingTimeline({ roadmap, ageRange }) {
  const younger = ["18-25", "26-35"].includes(String(ageRange || ""));
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoProgress, setAutoProgress] = useState(0);
  const [clockKey, setClockKey] = useState(0);
  const itemRefs = useRef([]);
  const listRef = useRef(null);
  const pausedRef = useRef(false);
  const AUTO_MS = 2000;

  const jumpTo = (index) => {
    setActiveIdx(index);
    setAutoProgress(0);
    setClockKey((key) => key + 1);
  };

  useEffect(() => {
    if (!roadmap?.length) return undefined;
    let acc = 0;
    let last = performance.now();
    let rafId = 0;

    const loop = (now) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        const p = Math.min(1, acc / AUTO_MS);
        setAutoProgress(p);
        if (acc >= AUTO_MS) {
          acc = 0;
          setAutoProgress(0);
          setActiveIdx((prev) => (prev + 1) % roadmap.length);
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [roadmap.length, clockKey]);

  useEffect(() => {
    const el = itemRefs.current[activeIdx];
    const container = listRef.current;
    if (!el || !container) return;
    const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [activeIdx]);

  const active = roadmap[activeIdx];

  return (
    <div className="mt-4 rounded-2xl border border-[#d8e8c8] bg-[#f4f8ee] p-4 sm:p-5 text-left overflow-hidden">
      <p className="text-base sm:text-lg font-bold text-gray-900">Start seeing results</p>

      <div className="mt-2.5 mb-4 h-1 w-full rounded-full bg-[#d8e8c8]/80 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#6f8f3d] transition-[width] duration-100 ease-linear"
          style={{ width: `${autoProgress * 100}%` }}
        />
      </div>

      <div
        ref={listRef}
        className="relative max-h-[240px] overflow-y-auto pr-1 scrollbar-thin"
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onTouchStart={() => {
          pausedRef.current = true;
        }}
        onTouchEnd={() => {
          window.setTimeout(() => {
            pausedRef.current = false;
          }, 2000);
        }}
      >
        <ul className="relative space-y-2 py-1">
          {roadmap.map((step, index) => {
            const isActive = index === activeIdx;
            const isPast = index < activeIdx;

            return (
              <li
                key={step.month}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => jumpTo(index)}
                  className="relative w-full flex items-start gap-3.5 text-left rounded-xl px-1 py-2.5 cursor-pointer"
                >
                  {isActive && (
                    <motion.span
                      layoutId="results-timeline-active-bg"
                      className="absolute inset-0 rounded-xl bg-white/80 border border-[#d8e8c8] shadow-[0_4px_14px_rgba(111,143,61,0.12)]"
                      transition={{ type: "spring", stiffness: 340, damping: 32 }}
                    />
                  )}

                  <span className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
                    <motion.span
                      className="relative flex h-7 w-7 items-center justify-center rounded-full border-2"
                      animate={{
                        scale: isActive ? 1.12 : 1,
                        backgroundColor: isActive || isPast ? "#6f8f3d" : "#e8f0d8",
                        borderColor: isActive || isPast ? "#5a7a2f" : "#c5ddb0",
                      }}
                      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {isActive && (
                        <motion.span
                          className="absolute inset-[-5px] rounded-full border border-[#6f8f3d]/35"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: [0.55, 0.15, 0.55], scale: [1, 1.12, 1] }}
                          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                      <motion.span
                        className="rounded-full bg-white"
                        animate={{
                          width: isActive ? 8 : isPast ? 5 : 0,
                          height: isActive ? 8 : isPast ? 5 : 0,
                          opacity: isActive || isPast ? 1 : 0,
                        }}
                        transition={{ duration: 0.35 }}
                      />
                    </motion.span>
                  </span>

                  <motion.div
                    className="relative z-10 min-w-0 flex-1 pt-0.5"
                    animate={{
                      opacity: isActive ? 1 : isPast ? 0.72 : 0.4,
                      y: isActive ? 0 : 1,
                    }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p
                      className={`text-[15px] sm:text-base leading-snug ${
                        isActive ? "text-gray-900" : "text-gray-600"
                      }`}
                    >
                      <span className={`font-bold ${isActive ? "text-[#5a7a2f]" : ""}`}>
                        Month {step.month}:
                      </span>{" "}
                      <span className={isActive ? "text-gray-800" : ""}>{step.desc}</span>
                    </p>
                  </motion.div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-3.5 flex items-center justify-center gap-1.5">
        {roadmap.map((step, index) => (
          <button
            key={`dot-${step.month}`}
            type="button"
            aria-label={`Go to month ${step.month}`}
            onClick={() => jumpTo(index)}
            className="p-1 cursor-pointer"
          >
            <motion.span
              className="block rounded-full bg-[#6f8f3d]"
              animate={{
                width: index === activeIdx ? 18 : 6,
                height: 6,
                opacity: index === activeIdx ? 1 : index < activeIdx ? 0.55 : 0.28,
              }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
            />
          </button>
        ))}
      </div>

      {active ? (
        <motion.p
          key={active.month}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-2 text-center text-[11px] text-gray-500"
        >
          Month {active.month} of {roadmap.length}
        </motion.p>
      ) : null}

      <div className="mt-3 rounded-xl bg-[#e5f0d4] px-3 py-2.5 text-xs text-[#3d5a1f] leading-relaxed">
        {younger ? (
          <>
            <span className="font-bold">At your age, results come faster</span> since hair follicles are most active &amp; responsive.
          </>
        ) : (
          <>
            <span className="font-bold">Consistency matters most at your age</span> — follicles respond steadily when the routine is followed.
          </>
        )}
      </div>
    </div>
  );
}

const MALE_STAGE_IMAGE = {
  1: "/stages/Stage1.png",
  2: "/stages/Stage2.png",
  3: "/stages/Stage3.png",
  4: "/stages/Stage4.png",
  5: "/stages/Stage5.png",
  6: "/stages/Stage6.png",
  7: "/stages/Stage7.png",
  "overall-thinning": "/stages/overall_thinning.png",
};

/** Male progression photos from treated folder (mstage1.png … mstage7.png).
 *  Zylk treatment track only uses stages 1–5; untreated may use 6–7.
 */
const MALE_MSTAGE_IMAGE = {
  1: "/stages/treated/mstage1.png",
  2: "/stages/treated/mstage2.png",
  3: "/stages/treated/mstage3.png",
  4: "/stages/treated/mstage4.png",
  5: "/stages/treated/mstage5.png",
  6: "/stages/treated/mstage6.png",
  7: "/stages/treated/mstage7.png",
};

const FEMALE_STAGE_IMAGE = {
  1: "/stagesf/stage1.png",
  2: "/stagesf/stage2.png",
  3: "/stagesf/stage3.png",
  "overall-thinning": "/stagesf/overall.png",
  "patchy-bald": "/stagesf/stage4.png",
};

const clampMaleStage = (n) => Math.min(7, Math.max(1, n));
/** Male stages eligible for Zylk treatment kits (not transplant). */
const clampMaleTreatableStage = (n) => Math.min(5, Math.max(1, n));
const clampFemaleStage = (n) => Math.min(3, Math.max(1, n));

function stageImageFor(stageKey, isFemale) {
  const key = String(stageKey || (isFemale ? "1" : "2"));
  if (isFemale) return FEMALE_STAGE_IMAGE[key] || FEMALE_STAGE_IMAGE["1"];
  if (key === "overall-thinning") return MALE_STAGE_IMAGE["overall-thinning"];
  const n = clampMaleStage(parseInt(key, 10) || 2);
  return MALE_MSTAGE_IMAGE[n] || MALE_STAGE_IMAGE[n] || MALE_STAGE_IMAGE["2"];
}

/** Both untreated + Zylk tracks use images from public/stages/treated/mstageN.png */
function maleStageCandidates(stageKey) {
  const key = String(stageKey);
  if (key === "overall-thinning") {
    return [MALE_STAGE_IMAGE["overall-thinning"]];
  }
  const n = clampMaleStage(parseInt(key, 10) || 2);
  return [
    `/stages/treated/mstage${n}.png`,
    `/stages/treated/mstage${n}.jpg`,
    `/stages/Stage${n}.png`,
  ];
}

function maleStepImage(stageKey) {
  const candidates = maleStageCandidates(stageKey);
  return {
    image: candidates[0],
    fallback: candidates[1] || candidates[0],
    fallbacks: candidates.slice(1),
  };
}

/**
 * With Zylk: improve by at most ONE stage.
 * Example Stage 4 → 4, 4, 3, 3
 * Example Stage 5 → 5, 5, 4, 4
 */
function maleTreatedStageAt(base, stepIndex) {
  const start = clampMaleTreatableStage(base);
  if (stepIndex <= 1) return start;
  return clampMaleTreatableStage(start - 1);
}

/**
 * Untreated: can worsen into Stage 6–7.
 * Example Stage 5 → 5, 6, 7, 7
 */
function maleUntreatedStageAt(base, stepIndex) {
  return clampMaleStage(base + stepIndex);
}

function buildHairProgressionComparison(currentStage, isFemale, resultMonths = 8) {
  const stage = String(currentStage || (isFemale ? "1" : "2")).toLowerCase();
  const untreatedLabels = ["Today", "6 Months", "1 Year", "2 Years"];
  const treatedLabels = ["Today", "2 Months", "5 Months", `${Math.max(6, resultMonths)} Months`];

  if (isFemale) {
    if (stage === "overall-thinning") {
      return {
        untreated: untreatedLabels.map((label, i) => ({
          label,
          image: stageImageFor(i <= 1 ? "overall-thinning" : String(Math.min(3, i)), true),
        })),
        treated: treatedLabels.map((label, i) => ({
          label,
          image: stageImageFor(i === 0 ? "overall-thinning" : String(Math.max(1, 3 - i)), true),
        })),
      };
    }

    const base = clampFemaleStage(parseInt(stage, 10) || 1);
    return {
      untreated: untreatedLabels.map((label, i) => ({
        label,
        image: stageImageFor(String(clampFemaleStage(base + i)), true),
      })),
      treated: treatedLabels.map((label, i) => ({
        label,
        image: stageImageFor(String(clampFemaleStage(base - Math.floor(i * 0.75))), true),
      })),
    };
  }

  if (stage === "overall-thinning") {
    return {
      untreated: untreatedLabels.map((label, i) => {
        const key = i === 0 ? "overall-thinning" : String(maleUntreatedStageAt(3, i));
        return { label, ...maleStepImage(key) };
      }),
      treated: treatedLabels.map((label, i) => {
        const key = i === 0 ? "overall-thinning" : String(maleTreatedStageAt(3, i));
        return { label, ...maleStepImage(key) };
      }),
    };
  }

  // Male pattern stages: both tracks use mstage images from treated folder
  const raw = parseInt(stage, 10) || 2;
  const untreatedBase = clampMaleStage(raw);
  const treatedBase = clampMaleTreatableStage(raw);

  return {
    untreated: untreatedLabels.map((label, i) => {
      const key = String(maleUntreatedStageAt(untreatedBase, i));
      return { label, ...maleStepImage(key) };
    }),
    treated: treatedLabels.map((label, i) => {
      const key = String(maleTreatedStageAt(treatedBase, i));
      return { label, ...maleStepImage(key) };
    }),
  };
}

function StageProgressImage({ src, fallbacks = [], alt, className }) {
  const candidates = useMemo(
    () => [src, ...fallbacks].filter(Boolean).filter((url, i, arr) => arr.indexOf(url) === i),
    [src, fallbacks]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [candidates.join("|")]);

  const current = candidates[Math.min(index, candidates.length - 1)] || "/stages/Stage2.png";

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => {
        setIndex((prev) => {
          if (prev + 1 < candidates.length) return prev + 1;
          return prev;
        });
      }}
    />
  );
}

function ProgressionTrack({ title, steps, variant }) {
  const isTreated = variant === "treated";
  const shell = isTreated
    ? "bg-[#eef6e8] border-[#cfe3bc]"
    : "bg-[#fdf0ee] border-[#f3d4cf]";
  const titleColor = isTreated ? "text-[#3d5f24]" : "text-[#b42318]";
  const arrowColor = isTreated ? "text-[#6f8f3d]" : "text-gray-700";

  return (
    <div className={`rounded-2xl border p-3 sm:p-4 ${shell}`}>
      <p className={`text-sm font-bold mb-3 ${titleColor}`}>{title}</p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {steps.map((step, index) => (
          <div key={`${step.label}-${index}`} className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center w-[76px] sm:w-[84px]">
              <div className="relative w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] rounded-full overflow-hidden bg-[#f3f4f6] ring-1 ring-black/5 shadow-sm isolate">
                <StageProgressImage
                  src={step.image}
                  fallbacks={step.fallbacks || (step.fallback ? [step.fallback] : [])}
                  alt={step.label}
                  className="absolute inset-0 h-full w-full rounded-full object-cover object-center"
                />
              </div>
              <span className="mt-2 text-[10px] font-semibold text-gray-700 text-center leading-tight">
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span className={`text-base font-bold pb-5 ${arrowColor}`} aria-hidden="true">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HairProgressionComparison({ currentStage, isFemale, resultMonths }) {
  const { untreated, treated } = useMemo(
    () => buildHairProgressionComparison(currentStage, isFemale, resultMonths),
    [currentStage, isFemale, resultMonths]
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">
        How your hair may change over time
      </h2>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Based on {isFemale ? "women" : "men"} with similar profile as you
      </p>

      <div className="flex flex-col gap-3">
        <ProgressionTrack title="If left untreated" steps={untreated} variant="untreated" />
        <ProgressionTrack title="With Zylk Treatment" steps={treated} variant="treated" />
      </div>

      <p className="mt-4 flex items-start gap-2 text-[11px] text-gray-500 leading-relaxed">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold mt-0.5">
          i
        </span>
        Results vary for each individual. Consistent use for minimum 4–6 months is essential.
      </p>
    </div>
  );
}

function FollicleIcon({ stage }) {
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

  useEffect(() => {
    function measureItemWidth() {
      if (itemRefs.current[0]) setItemWidth(itemRefs.current[0].offsetWidth);
    }
    measureItemWidth();
    window.addEventListener("resize", measureItemWidth);
    return () => window.removeEventListener("resize", measureItemWidth);
  }, [roadmap.length]);

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
            setAutoPlayDone(true);
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

function severityRank(value) {
  const s = String(value || "none").toLowerCase();
  if (s.includes("severe") || s === "3") return 3;
  if (s.includes("moderate") || s === "2") return 2;
  if (s.includes("mild") || s === "1" || s.includes("receding")) return 1;
  return 0;
}

/**
 * Stage-/observation-driven hair-loss overlay.
 * M-shape is only used when temple recession warrants it — not for every user.
 */
function ScalpHairLossOverlay({ isFemale, stage, observations = {}, hairFallLocation }) {
  const front = observations.frontView || {};
  const top = observations.topView || {};
  const back = observations.backView || {};
  const stageKey = String(stage || "").toLowerCase();
  const zone = String(hairFallLocation || "").toLowerCase();
  const hairline = String(front.frontalHairline || "").toLowerCase();

  let left = severityRank(front.templeRecessionLeft);
  let right = severityRank(front.templeRecessionRight);
  let crown = Math.max(
    severityRank(top.crownThinning),
    severityRank(back.crownDensity === "sparse" ? "severe" : back.crownDensity === "reduced" ? "mild" : "none")
  );

  // Fall back to AI stage when observation fields are missing
  const stageNum = parseInt(stageKey, 10);
  if (!Number.isNaN(stageNum)) {
    if (stageNum >= 2 && left === 0 && right === 0 && hairline.includes("intact") === false) {
      const d = stageNum === 2 ? 1 : stageNum === 3 ? 2 : 3;
      left = Math.max(left, d);
      right = Math.max(right, d);
    }
    if (stageNum >= 4) crown = Math.max(crown, stageNum >= 6 ? 3 : 2);
  }
  if (stageKey === "overall-thinning") crown = Math.max(crown, 2);
  if (stageKey === "patchy-bald") crown = Math.max(crown, 2);

  // Quiz location can emphasize zones even if stage is early
  if (!isFemale) {
    if (zone === "front" || zone === "parting") {
      left = Math.max(left, 1);
      right = Math.max(right, 1);
    }
    if (zone === "crown" || zone === "parting") crown = Math.max(crown, 1);
    if (zone === "all_over") crown = Math.max(crown, 2);
  } else {
    if (stageKey === "2") crown = Math.max(crown, 1);
    if (stageKey === "3" || stageKey === "overall-thinning") crown = Math.max(crown, 2);
  }

  if (hairline.includes("severe")) {
    left = Math.max(left, 3);
    right = Math.max(right, 3);
  } else if (hairline.includes("moderate")) {
    left = Math.max(left, 2);
    right = Math.max(right, 2);
  } else if (hairline.includes("mild") || hairline.includes("receding")) {
    left = Math.max(left, 1);
    right = Math.max(right, 1);
  }

  const templeDepth = Math.max(left, right);
  const showTemples = !isFemale && templeDepth > 0;
  const showCrown =
    crown > 0 ||
    stageKey === "overall-thinning" ||
    stageKey === "patchy-bald" ||
    zone === "crown" ||
    zone === "all_over" ||
    zone === "parting";
  const showDiffuse = stageKey === "overall-thinning" || zone === "all_over" || (isFemale && stageKey === "overall-thinning");
  const showPartLine = isFemale && (stageKey === "1" || stageKey === "2" || stageKey === "3");

  if (!showTemples && !showCrown && !showDiffuse && !showPartLine) {
    return null;
  }

  // Frontline sits on the forehead/hair boundary (lower on the frame),
  // not up in the hair. Temple peaks rise from that line into recession.
  const frontlineY = 58;
  const leftPeakY = frontlineY - 6 - left * 5; // 52 / 47 / 42 / 37
  const rightPeakY = frontlineY - 6 - right * 5;
  const leftValleyY = frontlineY + Math.min(left, 2) * 2;
  const rightValleyY = frontlineY + Math.min(right, 2) * 2;
  const centerY = frontlineY - 2 - Math.min(templeDepth, 2);
  const sideY = frontlineY + 1;

  const frontlinePath = showTemples
    ? `M 4 ${sideY}
       C 10 ${leftPeakY + 2} 16 ${leftPeakY} 24 ${leftPeakY + 3}
       C 32 ${leftValleyY} 40 ${centerY + 4} 50 ${centerY}
       C 60 ${centerY + 4} 68 ${rightValleyY} 76 ${rightPeakY + 3}
       C 84 ${rightPeakY} 90 ${rightPeakY + 2} 96 ${sideY}`
    : null;

  // Hair-loss fills sit on the exposed temple/forehead skin (below the peaks)
  const leftFill =
    left > 0
      ? `M 8 ${sideY + 4} C 16 ${sideY + 6} 22 ${leftValleyY + 2} 30 ${leftValleyY}
         L 24 ${leftPeakY + 4} C 16 ${leftPeakY + 2} 10 ${sideY} 8 ${sideY + 4}Z`
      : null;
  const rightFill =
    right > 0
      ? `M 92 ${sideY + 4} C 84 ${sideY + 6} 78 ${rightValleyY + 2} 70 ${rightValleyY}
         L 76 ${rightPeakY + 4} C 84 ${rightPeakY + 2} 90 ${sideY} 92 ${sideY + 4}Z`
      : null;

  const crownRadius = 10 + crown * 5;
  const crownOpacity = 0.14 + crown * 0.06;
  // Don't paint a crown blob into the hair on front temple-focused photos
  const showCrownBlob =
    showCrown &&
    (isFemale ||
      zone === "crown" ||
      zone === "all_over" ||
      zone === "parting" ||
      (!Number.isNaN(stageNum) && stageNum >= 4) ||
      stageKey === "overall-thinning" ||
      stageKey === "patchy-bald");

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {showDiffuse && (
        <ellipse
          cx="50"
          cy="48"
          rx="34"
          ry="26"
          fill={`rgba(220,38,38,${0.12 + crown * 0.04})`}
        />
      )}

      {showCrownBlob && !showDiffuse && (
        <ellipse
          cx="50"
          cy={isFemale ? 40 : 22}
          rx={crownRadius}
          ry={crownRadius * 0.85}
          fill={`rgba(220,38,38,${crownOpacity})`}
        />
      )}

      {showPartLine && (
        <path
          d={
            stageKey === "3"
              ? "M 48 18 C 46 32 44 44 42 56 C 50 58 58 56 58 56 C 56 44 54 32 52 18Z"
              : stageKey === "2"
                ? "M 49 20 C 48 34 47 46 46 56 C 50 57 54 56 54 56 C 53 44 52 32 51 20Z"
                : "M 49.5 22 C 49 36 48.5 46 48 56 C 50 56.5 52 56 52 56 C 51.5 44 51 32 50.5 22Z"
          }
          fill={`rgba(220,38,38,${stageKey === "3" ? 0.28 : stageKey === "2" ? 0.22 : 0.16})`}
        />
      )}

      {leftFill && <path d={leftFill} fill={`rgba(220,38,38,${0.18 + left * 0.06})`} />}
      {rightFill && <path d={rightFill} fill={`rgba(220,38,38,${0.18 + right * 0.06})`} />}

      {frontlinePath && (
        <path
          d={frontlinePath}
          fill="none"
          stroke="rgba(220,38,38,0.92)"
          strokeWidth={1.8 + Math.min(templeDepth, 2) * 0.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {isFemale && !showPartLine && showCrownBlob && (
        <path
          d="M 12 52 C 30 58 40 60 50 56 C 60 60 70 58 88 52"
          fill="none"
          stroke="rgba(220,38,38,0.75)"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

export default function Result() {
  const { state, resetQuiz, prevStep, setLoading, setError } = useQuiz();
  const { addToCart, cartCount, setIsCartOpen } = useCart();

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
      return `Stage ${aiPredictedStageNumber} Female Pattern Hair Loss`;
    }
    if (aiPredictedStageNumber === "overall-thinning") return "Overall Thinning Pattern";
    return `Stage ${aiPredictedStageNumber} Male Pattern Hair Loss`;
  };

  const getScaleBadge = () => {
    if (analysisMissing) return null;
    if (isFemale) {
      if (aiPredictedStageNumber === "patchy-bald") return "Patchy";
      if (aiPredictedStageNumber === "overall-thinning") return "Diffuse";
      return `Ludwig ${aiPredictedStageNumber}`;
    }
    if (aiPredictedStageNumber === "overall-thinning") return "Diffuse";
    return `Norwood ${aiPredictedStageNumber}`;
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
        price: prod.price ?? null,
        isHealthMix,
      };
    })
    .filter(Boolean);

  const coreKitProducts = kitProducts.filter((p) => !p.isHealthMix);
  const healthMixProduct = kitProducts.find((p) => p.isHealthMix) || null;
  // Sheet list price for Health Mix is ₹1799 (not the bundle price delta)
  const healthMixPrice = healthMixProduct?.price || HAIR_HEALTH_MIX_PRICE;
  const savings = recommendedBundle ? recommendedBundle.originalPrice - recommendedBundle.price : 0;
  const testimonial = TESTIMONIALS[testimonialIdx % TESTIMONIALS.length];
  const testimonialPhotos = useMemo(
    () => resolveTestimonialPhotos(testimonial.photos || []),
    [testimonial]
  );

  useEffect(() => {
    if (TESTIMONIALS.length <= 1) return undefined;
    const timer = setInterval(() => {
      setTestimonialIdx((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  
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
      healthMixPrice: HAIR_HEALTH_MIX_PRICE,
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

  const { reportId, reportDate } = useMemo(() => {
    const fingerprint = [
      userName,
      state?.aboutMe?.email || "",
      state?.aboutMe?.whatsapp || "",
      aiPredictedStageNumber || "",
      rawAnalysis?.model || "",
    ].join("|");
    return getOrCreateDailyReportMeta(fingerprint);
  }, [userName, state?.aboutMe?.email, state?.aboutMe?.whatsapp, aiPredictedStageNumber, rawAnalysis?.model]);

  // Persist quiz + report as PDF → storage → org email (once per Result visit).
  const reportSubmitRef = useRef(false);
  useEffect(() => {
    if (reportSubmitRef.current) return;
    if (!state?.aboutMe || !rawAnalysis || analysisMissing) return;
    reportSubmitRef.current = true;

    submitAssessmentReport({
      aboutMe: state.aboutMe,
      hairHealth: state.hairHealth || {},
      internalHealth: state.internalHealth || {},
      scalpAnalysis: rawAnalysis,
      scalpImages: (state.scalpImages || []).map((img) => ({
        type: img.type,
        label: img.label,
        // Omit full dataUrl from wire payload size; metadata is enough for archive.
        // Backend PDF v1 is text-based; images stay on the client Result UI.
        hasImage: Boolean(img.dataUrl || img.previewUrl || img.url),
      })),
      gender,
      clientReportId: reportId,
      reportMeta: {
        rootCauses,
        eligibilityTimeline,
        recommendedBundle: recommendedBundle
          ? {
              bundleId: recommendedBundle.bundleId,
              bundleTitle: recommendedBundle.bundleTitle,
              price: recommendedBundle.price,
              originalPrice: recommendedBundle.originalPrice,
            }
          : null,
      },
    }).catch((err) => {
      console.warn("[report] submit failed:", err?.message || err);
    });
  }, [
    state?.aboutMe,
    state?.hairHealth,
    state?.internalHealth,
    state?.scalpImages,
    rawAnalysis,
    analysisMissing,
    gender,
    reportId,
    rootCauses,
    eligibilityTimeline,
    recommendedBundle,
  ]);

  const confidencePhrase = (() => {
    if (analysisMissing || rawAnalysis.quotaFallback) return "moderate confidence";
    const c = Number(rawAnalysis.aiConfidence);
    if (Number.isNaN(c) || c >= 0.8) return "high confidence";
    if (c >= 0.65) return "good confidence";
    return "moderate confidence";
  })();

  return (
    <div className="min-h-screen bg-[#f0f7f4] -mx-4 md:-mx-8 -mt-8 pb-32 md:pb-10">
      <div className="max-w-lg md:max-w-6xl mx-auto px-3 md:px-6 pt-4 md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">
      {/* LEFT COLUMN — scrolls normally on desktop, single column on mobile */}
      <div className="space-y-4 md:min-w-0">
        {/* Hair Assessment Report intro + scalp overview */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4 sm:p-5">
          <div className="flex flex-row gap-3 sm:gap-5 items-start">
            <div className="flex-1 min-w-0 text-left space-y-2 sm:space-y-3">
              <h1 className="text-[1.35rem] sm:text-[2.1rem] font-bold text-gray-900 leading-[1.15] tracking-tight">
                Hello {userName},
              </h1>

              <h2 className="text-[1.05rem] sm:text-[1.65rem] font-bold leading-[1.25] tracking-tight text-gray-900">
                <span className="text-[#6f8f3d]">Here is</span> your personalized{" "}
                <span className="text-[#6f8f3d]">Hair Assessment Report</span>
              </h2>

              <div className="inline-flex items-center gap-2 rounded-full bg-[#ececec] px-2.5 sm:px-3.5 py-1 sm:py-1.5 max-w-full">
                <span className="inline-flex h-4 w-4 items-center justify-center shrink-0" aria-hidden="true">
                  <svg className="h-4 w-4 text-[#6f8f3d]" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1.2l5.2 2.1v4.2c0 3.3-2.2 5.9-5.2 6.9-3-1-5.2-3.6-5.2-6.9V3.3L8 1.2z" />
                    <path d="M5.2 7.6l1.7 1.7 3.4-3.5" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[10px] sm:text-[12px] font-medium text-[#555555] truncate">
                  Report ID: {reportId} • {reportDate}
                </span>
              </div>

              <p className="text-[13px] sm:text-[15px] text-[#555555] leading-relaxed">
                Our AI scan + expert analysis of 14 key parameters gives us{" "}
                <span className="font-bold text-[#6f8f3d]">{confidencePhrase}</span> in this report.
              </p>
            </div>

            <div className="w-[88px] sm:w-[180px] shrink-0 rounded-xl sm:rounded-2xl border border-gray-100 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden">
              <p className="px-1.5 pt-1.5 pb-1 sm:px-3 sm:pt-3 sm:pb-2 text-[9px] sm:text-sm font-semibold text-gray-900 leading-tight text-center sm:text-left">
                Your Scalp Overview
              </p>
              <div className="px-1.5 pb-1.5 sm:px-3 sm:pb-3">
                <div className="relative w-full aspect-square rounded-lg sm:rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={displayUserPhoto || AVATAR_FALLBACK}
                    alt="Your scalp overview"
                    className="absolute inset-0 h-full w-full object-contain object-center"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = AVATAR_FALLBACK;
                    }}
                  />
                  <ScalpHairLossOverlay
                    isFemale={isFemale}
                    stage={aiPredictedStageNumber}
                    observations={rawAnalysis.observations}
                    hairFallLocation={isFemale ? null : state?.hairHealth?.hair_fall_zone}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 text-left">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#6f8f3d]">
              Your Assessment
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                {getStageTitle()}
              </h3>
              {getScaleBadge() && (
                <span className="inline-flex items-center rounded-full bg-[#ececec] px-2.5 py-1 text-xs font-semibold text-[#555555]">
                  {getScaleBadge()}
                </span>
              )}
            </div>

            {!analysisMissing && (
              <div className="mt-4">
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

            {!requiresDoctorConsultation && !eligibilityTimeline.needsTransplant && (
              <ResultsSeeingTimeline
                roadmap={roadmap}
                ageRange={state?.aboutMe?.ageRange}
              />
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
        </section>

        {!requiresDoctorConsultation && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left">
            <h2 className="text-base font-bold text-gray-900 mb-3">Your Hair fall Root Causes</h2>
            <div className="space-y-3">
              {rootCauses.map((cause) => (
                <div
                  key={cause.id}
                  className="flex items-start gap-3 rounded-2xl bg-[#f7efe6] border border-[#f0e2d2] p-3.5"
                >
                  <div className="w-14 shrink-0 flex flex-col items-center gap-1 pt-0.5">
                    <span className="text-2xl leading-none">{cause.icon}</span>
                    <span className="text-[11px] font-bold text-gray-800 text-center leading-tight">
                      {cause.label}
                    </span>
                  </div>
                  <p className="flex-1 text-xs text-gray-700 leading-relaxed pt-1">
                    {cause.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!requiresDoctorConsultation && !analysisMissing && (
          <HairProgressionComparison
            currentStage={aiPredictedStageNumber}
            isFemale={isFemale}
            resultMonths={resultMonths}
          />
        )}

        {!requiresDoctorConsultation && (
          <div className="bg-[#f0faf4] border border-[#b7e4c7] rounded-2xl p-4 flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-3xl font-black text-[#064e3b]">4X Growth</p>
              <p className="text-sm font-bold text-gray-800">Better results</p>
              <p className="text-[10px] text-gray-500 uppercase mt-1 leading-snug">
                Based on DNA, Doctor, Nutrition, AI and Machine Learning
              </p>
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
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#064e3b]">4X</span>
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
              {(testimonialPhotos.length > 0
                ? testimonialPhotos
                : (testimonial.photos || []).map((p) => ({
                    label: p.label,
                    src: null,
                    fallbacks: [],
                  }))
              ).map((photo, i) => (
                <div key={`${photo.label}-${i}`} className="shrink-0 w-[104px]">
                  <div
                    className={`relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 ${
                      testimonial.photoFrameClass || "aspect-square"
                    }`}
                  >
                    <TestimonialPhoto
                      src={photo.src}
                      fallbacks={photo.fallbacks}
                      label={photo.label}
                      alt={`${testimonial.name} — ${photo.label}`}
                      fit={photo.fit || "cover"}
                    />
                  </div>
                  <p className="text-[10px] text-center text-gray-600 mt-1.5 font-medium">{photo.label}</p>
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
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-4">
                      <ProductImage
                        src={product.imgUrl}
                        fallbacks={product.imgFallbacks}
                        alt={product.shortName}
                        className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
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
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-4">
                      <ProductImage
                        src={healthMixProduct.imgUrl}
                        fallbacks={healthMixProduct.imgFallbacks}
                        alt={healthMixProduct.shortName}
                        className={`w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105 ${
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
                          ? `Included · ₹${healthMixPrice}`
                          : `Add for ₹${healthMixPrice}`}
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h2 className="text-base font-bold text-gray-900 mb-3">Real People, Real Stories</h2>
          <div className="border border-gray-100 rounded-xl p-3 sm:p-4">
            <span className="inline-block text-[10px] font-bold bg-gray-800 text-white px-2 py-0.5 rounded mb-3">
              STAGE {testimonial.stage}
            </span>
            {(() => {
              const beforeAfter = testimonialPhotos.filter((photo) =>
                /before|after/i.test(photo.label)
              );
              const gallery = beforeAfter.length >= 2 ? beforeAfter : testimonialPhotos;
              const midPhotos =
                beforeAfter.length >= 2
                  ? testimonialPhotos.filter((photo) => !/before|after/i.test(photo.label))
                  : [];

              return (
                <>
                  <div
                    className={`grid gap-2 sm:gap-3 mb-3 ${
                      gallery.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    }`}
                  >
                    {gallery.map((photo, i) => (
                      <div key={`${photo.label}-${i}`} className="min-w-0">
                        <div
                          className={`relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-sm ${
                            testimonial.photoFrameClass || "aspect-[4/5] sm:aspect-square"
                          }`}
                        >
                          <TestimonialPhoto
                            src={photo.src}
                            fallbacks={photo.fallbacks}
                            label={photo.label}
                            alt={`${testimonial.name} — ${photo.label}`}
                            fit={photo.fit || "cover"}
                          />
                        </div>
                        <p className="text-[10px] text-center font-semibold text-gray-600 mt-1.5 uppercase tracking-wide">
                          {photo.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  {midPhotos.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5">
                      {midPhotos.map((photo, i) => (
                        <div key={`${photo.label}-mid-${i}`} className="shrink-0 w-[72px]">
                          <div
                            className={`relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100 ${
                              testimonial.photoFrameClass || "aspect-square"
                            }`}
                          >
                            <TestimonialPhoto
                              src={photo.src}
                              fallbacks={photo.fallbacks}
                              label={photo.label}
                              alt={`${testimonial.name} — ${photo.label}`}
                              fit={photo.fit || "cover"}
                            />
                          </div>
                          <p className="text-[9px] text-center text-gray-500 mt-1 leading-tight">
                            {photo.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">{testimonial.name}, {testimonial.age}</p>
              <span className="text-xs text-[#52b788] font-semibold flex items-center gap-1">✓ Verified</span>
            </div>
            <p className="text-xs text-gray-400">{testimonial.city}</p>
            <p className="text-yellow-400 text-sm my-2">{"★".repeat(testimonial.rating)}</p>
            <p className="text-sm text-gray-700 leading-relaxed">{testimonial.review}</p>
            <p className="text-[10px] text-gray-400 mt-2">{testimonial.date}</p>
            <div className="flex justify-center gap-1.5 mt-3">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={`story-dot-${i}`}
                  type="button"
                  onClick={() => setTestimonialIdx(i)}
                  aria-label={`Show testimonial ${i + 1}`}
                  className={`w-2 h-2 rounded-full ${i === testimonialIdx ? "bg-gray-800" : "bg-gray-300"}`}
                />
              ))}
            </div>
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
                    <div className="w-16 h-16 xl:w-[72px] xl:h-[72px] rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-3">
                      <ProductImage
                        src={product.imgUrl}
                        fallbacks={product.imgFallbacks}
                        alt={product.shortName}
                        className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
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
                    <div className="w-16 h-16 xl:w-[72px] xl:h-[72px] rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-3">
                      <ProductImage
                        src={healthMixProduct.imgUrl}
                        fallbacks={healthMixProduct.imgFallbacks}
                        alt={healthMixProduct.shortName}
                        className={`w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105 ${
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
                          ? `Included · ₹${healthMixPrice}`
                          : `Add for ₹${healthMixPrice}`}
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

            <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
              {recommendedBundle && !requiresDoctorConsultation ? (
                <>
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-[11px] font-medium text-gray-500 tracking-wide uppercase">Your treatment plan price</span>
                    
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[26px] font-black text-gray-900 leading-none">₹{recommendedBundle.price}</span>
                      <span className="text-xs font-semibold text-gray-500">/ month</span>
                    </div>
                    
                    <p className="text-xs font-medium text-gray-700">
                      (Less than ₹{Math.round(recommendedBundle.price / 30)} / day)
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      {savings > 0 && (
                        <span className="inline-block bg-[#e8f5e9] text-[#1b5e20] text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                          You save ₹{savings}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 line-through font-medium">₹{recommendedBundle.originalPrice}</span>
                    </div>

                    <label className="flex items-center gap-2 mt-2 cursor-pointer bg-gray-50 p-2 rounded-md border border-gray-100">
                      <input
                        type="checkbox"
                        checked={includeHealthMix}
                        onChange={(e) => setIncludeHealthMix(e.target.checked)}
                        className="rounded border-gray-300 w-3.5 h-3.5 accent-[#2e7d32]"
                      />
                      <span className="text-[11px] text-gray-600 font-medium">
                        Include Hair Health Mix
                        {healthMixPrice > 0 && (
                          <span className="font-bold text-[#1b5e20]">
                            {" "}(₹{healthMixPrice})
                          </span>
                        )}
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3.5 px-5 rounded-lg tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-between group"
                  >
                    <span className="mx-auto pl-4 text-center">See My Treatment Plan &amp; Start My Recovery</span>
                    <svg className="w-4 h-4 text-white transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3.5 rounded-lg tracking-wide cursor-pointer shadow-md transition-all"
                >
                  {requiresDoctorConsultation ? "Schedule Consultation" : "Continue"}
                </button>
              )}

              {/* Secure Checkout Badge */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500 font-semibold tracking-wide uppercase mt-0.5">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure Checkout
              </div>
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
              className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3.5 rounded-lg uppercase tracking-wide cursor-pointer shadow-md transition-all"
            >
              Schedule Consultation
            </button>
          </div>
        </div>
      )}
      </div>
      {/* END GRID */}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-lg mx-auto px-4 py-3 flex flex-col gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {recommendedBundle && !requiresDoctorConsultation ? (
            <>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-gray-500 tracking-wide uppercase">Your treatment plan price</span>
                
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-extrabold text-gray-900 leading-none">₹{recommendedBundle.price}</span>
                  <span className="text-[11px] font-semibold text-gray-500">/ month</span>
                </div>
                
                <p className="text-[11px] font-medium text-gray-700">
                  (Less than ₹{Math.round(recommendedBundle.price / 30)} / day)
                </p>

                <div className="flex items-center gap-2 mt-0.5">
                  {savings > 0 && (
                    <span className="inline-block bg-[#e8f5e9] text-[#1b5e20] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      You save ₹{savings}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400 line-through font-medium">₹{recommendedBundle.originalPrice}</span>
                </div>

                <label className="flex items-center gap-2 mt-1.5 cursor-pointer bg-gray-50 p-2 rounded-md border border-gray-100">
                  <input
                    type="checkbox"
                    checked={includeHealthMix}
                    onChange={(e) => setIncludeHealthMix(e.target.checked)}
                    className="rounded border-gray-300 w-3.5 h-3.5 accent-[#2e7d32]"
                  />
                  <span className="text-[11px] text-gray-600 font-medium">
                    Include Hair Health Mix
                    {healthMixPrice > 0 && (
                      <span className="font-bold text-[#1b5e20]">
                        {" "}(₹{healthMixPrice})
                      </span>
                    )}
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3 px-5 rounded-lg tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-between group"
              >
                <span className="mx-auto pl-4 text-center">See My Treatment Plan &amp; Start My Recovery</span>
                <svg className="w-4 h-4 text-white transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleBuyNow}
              className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3.5 rounded-lg tracking-wide cursor-pointer shadow-md transition-all"
            >
              {requiresDoctorConsultation ? "Schedule Consultation" : "Continue"}
            </button>
          )}

          {/* Secure Checkout Badge */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-500 font-semibold tracking-wide uppercase mt-0.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure Checkout
          </div>
        </div>
      </div>
    </div>
  );
}
