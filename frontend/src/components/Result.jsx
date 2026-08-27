import { useState, useMemo, useEffect, useRef } from "react";
import { useQuiz } from "../context/QuizContext";
import { useCart } from "../context/CartContext";
import { getRecommendedBundle } from "../data/products";
import {
  getBundleDisplayName,
  getWooProductId,
  getCheckoutWooProductIds,
  buildKitProductUrl,
} from "../config/bundles";
import { getEligibilityTimeline } from "../utils/eligibilityTimeline";
import { formatBundleProduct } from "../config/productImages";
import { getBundleItems } from "../data/zylkProductCatalog";
import { submitAssessmentReport, markCheckoutClicked } from "../api/quizApi";
import { redirectToWordPressCheckout } from "../utils/wordpressCheckout";
import { normalizeLocalPhone, leadContactKeys } from "../utils/phone";
import { motion, useMotionValue, animate } from "framer-motion";

const AVATAR_FALLBACK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23e8eede'/><circle cx='50' cy='38' r='18' fill='%23a7c4a0'/><rect x='18' y='64' width='64' height='30' rx='15' fill='%23a7c4a0'/></svg>";


const TESTIMONIAL_EXTS = ["jpg", "jpeg", "png", "webp"];

const PRODUCT_DETAIL_CONTENT = {
  "zylk-antidandruff-shampoo": {
    title: "Anti Dandruff Shampoo",
    summary: "Clinically formulated to remove flakes, calm irritation, and clean the scalp deeply.",
    usage: "Wet your hair, lather well, massage into the scalp for 60 seconds, then rinse. Use 3 times a week.",
    ingredients: ["Salicylic Acid", "Tea Tree Oil", "Aloe Vera", "Natural Surfactants"],
    hindi: {
      summary: "खुरदरी त्वचा और पपड़ी को दूर करने के लिए शांति देने वाला क्लीनिंग शैम्पू।",
      usage: "बाल गीले करें, अच्छी तरह झाग बनायें, 60 सेकेंड तक खोपड़ी पर मसाज करें और फिर धो लें। सप्ताह में 3 बार उपयोग करें।",
      ingredients: ["सैलिसिलिक एसिड", "टी ट्री ऑयल", "एलो वेरा", "प्राकृतिक क्लीनिंग घटक"],
    },
  },
  "zylk-dermaroller": {
    title: "Dermaroller",
    summary: "Supports product absorption and stimulates scalp microcirculation with gentle needling.",
    usage: "Roll gently over the scalp in 4 directions for 2-3 minutes. Clean before and after use. Use once or twice weekly.",
    ingredients: ["Stainless Steel Microneedles", "Medical Grade Handle"],
    hindi: {
      summary: "उत्पादों को अवशोषित करने और खोपड़ी में रक्त प्रवाह बढ़ाने में मदद करता है।",
      usage: "स्कalp पर 2-3 मिनट के लिए हल्के से रोल करें। उपयोग से पहले और बाद में साफ करें। सप्ताह में 1-2 बार उपयोग करें।",
      ingredients: ["स्टेनलेस स्टील माइक्रोनीडल", "मेडिकल ग्रेड हैंडल"],
    },
  },
  "zylk-pumpkin-seed": {
    title: "Pumpkin Seed Softgel",
    summary: "Provides daily nutritional support to strengthen follicles and reduce shedding.",
    usage: "Take one softgel daily after a meal or as directed by your physician.",
    ingredients: ["Pumpkin Seed Oil", "Vitamin E", "Zinc"],
    hindi: {
      summary: "बालों की जड़ें मजबूत करने और गिरावट को कम करने के लिए दैनिक पोषण समर्थन देता है।",
      usage: "एक सॉफ्टगेल रोज़ भोजन के बाद लें या डॉक्टर के निर्देशानुसार।",
      ingredients: ["कद्दू के बीज का तेल", "विटामिन ई", "जिंक"],
    },
  },
  "zylk-serum": {
    title: "Serum",
    summary: "Lightweight topical serum designed to nourish follicles and improve scalp hydration.",
    usage: "Apply 4-6 drops to the scalp daily, gently massage until absorbed.",
    ingredients: ["Niacinamide", "Caffeine", "Botanical Extracts"],
    hindi: {
      summary: "फोलिकल को पोषण देने और खोपड़ी को हाइड्रेटेड रखने के लिए तैयार किया गया सीरम।",
      usage: "रोज़ाना 4-6 बूंदें खोपड़ी पर लगायें, धीरे से मसाज करें।",
      ingredients: ["नियासिनामाइड", "कैफीन", "औषधीय अर्क"],
    },
  },
  "zylk-advanced-serum": {
    title: "Advanced Serum",
    summary: "A deeper-strength serum for mature thinning, repairing damaged strands and boosting density.",
    usage: "Apply daily to the scalp and massage. Use consistently for best results.",
    ingredients: ["Peptides", "Amino Acids", "Antioxidants"],
    hindi: {
      summary: "पुराने पतले बालों के लिए गहरी शक्ति वाला सीरम, जो खराब धारा की मरम्मत करता है।",
      usage: "रोज़ाना खोपड़ी पर लगायें और मसाज करें। बेहतर परिणामों के लिए नियमित उपयोग करें।",
      ingredients: ["पेप्टाइड्स", "अमीनो एसिड", "एंटीऑक्सिडेंट"],
    },
  },
  "zylk-scalp-massager": {
    title: "Scalp Massager",
    summary: "Improves circulation and helps products penetrate the scalp more effectively.",
    usage: "Use for 2-3 minutes on damp or dry scalp. Move in small circles over the problem areas.",
    ingredients: ["Soft Silicone Bristles", "Ergonomic Grip"],
    hindi: {
      summary: "संचरण को बेहतर बनाता है और उत्पादों को खोपड़ी में असरदार तरीके से पहुँचाता है।",
      usage: "गीली या सूखी खोपड़ी पर 2-3 मिनट तक छोटे घेरे में उपयोग करें।",
      ingredients: ["नरम सिलिकॉन ब्रिसल", "आरामदायक पकड़"],
    },
  },
  "zylk-rosemary-oil": {
    title: "Rosemary Hair Oil",
    summary: "Natural oil to soothe the scalp, reduce inflammation, and support healthy hair growth.",
    usage: "Apply a few drops to the scalp at night, massage gently, and leave on for 1-2 hours before shampooing.",
    ingredients: ["Rosemary Oil", "Jojoba Oil", "Vitamin E"],
    hindi: {
      summary: "खोपड़ी को शांत करने और स्वस्थ बालों के विकास का समर्थन करने वाला प्राकृतिक तेल।",
      usage: "रात में खोपड़ी पर कुछ बूंदें लगायें, धीरे से मालिश करें और 1-2 घंटे बाद शैम्पू करें।",
      ingredients: ["रोsemary ऑयल", "जोजोबा ऑयल", "विटामिन ई"],
    },
  },
  "zylk-rosemary-mist": {
    title: "Rosemary Mist Spray",
    summary: "Refreshing scalp spray that calms irritation and supports daily hydration.",
    usage: "Spray evenly across the scalp once a day and massage lightly.",
    ingredients: ["Rosemary Extract", "Aloe Vera", "Botanical Hydrators"],
    hindi: {
      summary: "ताज़ा करने वाला खोपड़ी स्प्रे जो जलन को शांत करता है।",
      usage: "रोज़ाना एक बार खोपड़ी पर समान रूप से स्प्रे करें और हल्के से मसाज करें।",
      ingredients: ["रोsemary अर्क", "एलो वेरा", "बोटैनिकल ह्यूड्रेटर्स"],
    },
  },
  "zylk-salicylic-shampoo": {
    title: "Salicylic Acid Shampoo",
    summary: "Deep-clean shampoo that removes excess oil, unclogs pores and keeps the scalp balanced.",
    usage: "Lather on wet hair focusing on scalp, leave for 1 minute, then rinse thoroughly.",
    ingredients: ["Salicylic Acid", "Zinc Pyrithione", "Mint Extract"],
    hindi: {
      summary: "अतिरिक्त तेल निकालने और खोपड़ी को संतुलित रखने वाला गहरा शैम्पू।",
      usage: "गीले बालों पर झाग लगायें, 1 मिनट तक छोड़ें और फिर अच्छी तरह धो लें।",
      ingredients: ["सैलिसिलिक एसिड", "जिंक पिरिथियोन", "पुदीना अर्क"],
    },
  },
  "zylk-minoxidil-finasteride": {
    title: "5% Minoxidil + 0.1% Finasteride",
    summary: "Clinically designed to stimulate regrowth and strengthen thinning follicles.",
    usage: "Apply twice daily to a clean, dry scalp. Use as directed and avoid contact with eyes.",
    ingredients: ["Minoxidil", "Finasteride", "Propylene Glycol", "Purified Water"],
    hindi: {
      summary: "बालों की जड़ों को मजबूती देने और पतले बालों की रिकवरी में मदद करने के लिए तैयार।",
      usage: "दो बार रोज़ साफ और सूखी खोपड़ी पर लगायें। आंखों से बचायें।",
      ingredients: ["मिनॉक्सिडिल", "फिनास्टेराइड", "प्रोपाइलीन ग्लाइकोल", "शुद्ध पानी"],
    },
  },
  "zylk-minoxidil-2": {
    title: "2% Minoxidil",
    summary: "A 2% minoxidil solution formulated for female pattern hair loss and sensitive scalps.",
    usage: "Apply 1 ml twice daily to a clean, dry scalp on thinning areas. Avoid contact with eyes.",
    ingredients: ["Minoxidil 2%", "Alcohol", "Propylene Glycol", "Purified Water"],
    hindi: {
      summary: "महिलाओं के पैटर्न हेयर लॉस के लिए तैयार 2% मिनॉक्सिडिल घोल।",
      usage: "पतले हिस्सों पर साफ सूखी खोपड़ी पर दिन में दो बार 1 मिली लगायें।",
      ingredients: ["मिनॉक्सिडिल 2%", "अल्कोहल", "प्रोपाइलीन ग्लाइकोल", "शुद्ध पानी"],
    },
  },
  "zylk-hair-growth-serum": {
    title: "Hair Growth Serum",
    summary: "Lightweight serum that nourishes follicles and supports visible density.",
    usage: "Apply 4-6 drops to the scalp daily and massage until absorbed.",
    ingredients: ["Niacinamide", "Caffeine", "Botanical Extracts"],
    hindi: {
      summary: "फोलिकल को पोषण देने और घनत्व बढ़ाने वाला हल्का सीरम।",
      usage: "रोज़ाना 4-6 बूंदें खोपड़ी पर लगायें और मसाज करें।",
      ingredients: ["नियासिनामाइड", "कैफीन", "औषधीय अर्क"],
    },
  },
  "zylk-advanced-hair-serum": {
    title: "Advanced Hair Serum",
    summary: "A deeper-strength serum for advanced thinning, repairing strands and boosting density.",
    usage: "Apply daily to the scalp and massage. Use consistently for best results.",
    ingredients: ["Peptides", "Amino Acids", "Antioxidants"],
    hindi: {
      summary: "एडवांस्ड थिनिंग के लिए गहरी शक्ति वाला सीरम।",
      usage: "रोज़ाना खोपड़ी पर लगायें और मसाज करें।",
      ingredients: ["पेप्टाइड्स", "अमीनो एसिड", "एंटीऑक्सिडेंट"],
    },
  },
  "zylk-tea-tree-oil": {
    title: "Tea Tree Oil",
    summary: "Tea tree oil that helps calm an itchy, flaky scalp and supports a cleaner hair environment.",
    usage: "Apply a few drops to the scalp, massage gently, and leave on before shampooing.",
    ingredients: ["Tea Tree Oil", "Jojoba Oil", "Vitamin E"],
    hindi: {
      summary: "खुजली और पपड़ी वाली खोपड़ी को शांत करने वाला टी ट्री ऑयल।",
      usage: "खोपड़ी पर कुछ बूंदें लगायें, मालिश करें और शैम्पू से पहले लगा रहने दें।",
      ingredients: ["टी ट्री ऑयल", "जोजोबा ऑयल", "विटामिन ई"],
    },
  },
  "zylk-tea-tree-mist": {
    title: "Tea Tree Mist Spray",
    summary: "A lightweight tea tree mist for daily scalp freshness and flake control.",
    usage: "Spray evenly across the scalp once a day and massage lightly.",
    ingredients: ["Tea Tree Extract", "Aloe Vera", "Botanical Hydrators"],
    hindi: {
      summary: "रोज़मर्रा की ताज़गी और फ्लेक कंट्रोल के लिए टी ट्री मिस्ट।",
      usage: "रोज़ाना एक बार खोपड़ी पर स्प्रे करें और हल्के से मसाज करें।",
      ingredients: ["टी ट्री अर्क", "एलो वेरा", "बोटैनिकल ह्यूड्रेटर्स"],
    },
  },
  "zylk-scalp-massager-complimentary": {
    title: "Scalp Massager",
    summary: "Improves circulation and helps products penetrate the scalp more effectively.",
    usage: "Use for 2-3 minutes on damp or dry scalp. Move in small circles over the problem areas.",
    ingredients: ["Soft Silicone Bristles", "Ergonomic Grip"],
    hindi: {
      summary: "संचरण को बेहतर बनाता है और उत्पादों को खोपड़ी में असरदार तरीके से पहुँचाता है।",
      usage: "गीली या सूखी खोपड़ी पर 2-3 मिनट तक छोटे घेरे में उपयोग करें।",
      ingredients: ["नरम सिलिकॉन ब्रिसल", "आरामदायक पकड़"],
    },
  },
};

function getProductDetails(product = {}, language = "english") {
  const productId =
    typeof product === "string"
      ? product
      : product?.id || "";
  const normalizedId =
    productId === "zylk-scalp-massager-complimentary" ||
    productId === "zylk-scalp-massager-listed"
      ? "zylk-scalp-massager"
      : productId === "zylk-salicylic-shampoo-s3"
        ? "zylk-salicylic-shampoo"
        : productId === "zylk-hair-growth-serum-ad"
          ? "zylk-hair-growth-serum"
          : productId;
  const detail = PRODUCT_DETAIL_CONTENT[normalizedId] || null;
  if (detail) {
    if (language === "hindi") {
      return {
        title: detail.title,
        summary: detail.hindi?.summary || detail.summary,
        usage: detail.hindi?.usage || detail.usage,
        ingredients: detail.hindi?.ingredients || detail.ingredients,
      };
    }
    return detail;
  }

  return {
    title: product.subtitle || product.shortName || "Product Details",
    summary: product.description || "Discover the full benefits of this product.",
    usage: "Tap the product name to view how to use it and the ingredients.",
    ingredients: product.ingredients || [],
  };
}

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

const MALE_TESTIMONIALS = [
  {
    name: "Harish",
    age: 28,
    city: "Chennai, Tamil Nadu",
    stage: "3",
    rating: 5,
    review:
      "I was losing hope with generic oils. Zylk's stage-based kit actually reduced my shedding in the first month. My hairline looks fuller now.",
    date: "Reviewed on 25th Feb 2025",
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
    photos: [
      { label: "Before", file: "Arun-before.png" },
      { label: "After", file: "Arun-after.png" },
    ],
  },
];
const FEMALE_TESTIMONIALS = [
  {
    name: "Priya",
    age: 29,
    city: "Coimbatore, Tamil Nadu",
    stage: "2",
    rating: 5,
    review:
      "After pregnancy my hair fall became severe. Within a few months of following the Zylk routine, shedding reduced and my part line looked much fuller.",
    date: "Reviewed on 8th Mar 2025",
    photos: [
      { label: "Before", file: "Priya-before.png" },
      { label: "After", file: "Priya-after.png" },
    ],
  },
  {
    name: "Divya",
    age: 35,
    city: "Madurai, Tamil Nadu",
    stage: "3",
    rating: 5,
    review:
      "I tried many shampoos without success. Zylk's personalized treatment helped reduce hair fall and I started seeing healthy new growth after a few months.",
    date: "Reviewed on 18th Apr 2025",
    photos: [
      { label: "Before", file: "Divya-before.png" },
      { label: "After", file: "Divya-after.png" },
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
  if (n.includes("anti-dandruff") || n.includes("antidandruff") || n.includes("dandruff")) return "For Dandruff";
  if (n.includes("shampoo") || n.includes("cleanser")) return "For Scalp Detox";
  if (n.includes("minoxidil")) return "For Hair Regrowth";
  if (n.includes("serum") || n.includes("growth")) return "For Hair Density";
  if (n.includes("tea tree") || n.includes("rosemary")) return "For Hair Nourishment";
  if (n.includes("oil") || n.includes("progro")) return "For Scalp Nourishment";
  if (n.includes("pumpkin") || n.includes("softgel")) return "For Nutritional Support";
  if (n.includes("supplement") || n.includes("health mix") || n.includes("vitality")) return "For Internal Health";
  if (n.includes("derma") || n.includes("roller")) return "For Hair Follicle Stimulation";
  if (n.includes("massager")) return "For Daily Scalp Health";
  if (n.includes("conditioner")) return "For Scalp Care";
  return "For Hair Health";
}

function getProvisionalReportMeta() {
  const now = new Date();
  const reportDate = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return { reportId: null, reportDate, provisional: true };
}

const SUBMITTED_KEY_TTL_MS = 15 * 60 * 1000; // match backend HASH_REUSE_TTL_MS

/** Read a "submitted" localStorage entry, treating anything older than the
 *  TTL as a miss so a stale record can never block a genuinely new attempt. */
function readSubmittedEntry(key) {
  if (typeof window === "undefined") return null;
  let raw;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;

  // Back-compat: older entries were stored as a bare "TR-…" string with no timestamp.
  // Treat those as immediately stale so they get re-validated against the server
  // instead of trusted forever.
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.id) {
      if (Date.now() - (parsed.ts || 0) > SUBMITTED_KEY_TTL_MS) return null;
      return parsed.id;
    }
  } catch {
    // raw wasn't JSON — it's an old bare-string entry, treat as stale
    return null;
  }
  return null;
}

function writeSubmittedEntry(key, id) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ id, ts: Date.now() }));
  } catch {
    // ignore
  }
}

function djb2Hash(payload) {
  let hash = 5381;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 33) ^ payload.charCodeAt(i);
  }
  return `c${(hash >>> 0).toString(16)}`;
}

/**
 * Identity of this quiz result for submit dedupe (NOT Report ID).
 * Contact only — phone/email — so changing stress or phone formatting cannot
 * mint a second report for the same person. Photo bytes are also excluded.
 */
function buildReportIdentityHash(state) {
  const aboutMe = state?.aboutMe || {};
  const payload = JSON.stringify({
    keys: leadContactKeys({
      ...aboutMe,
      whatsapp: normalizeLocalPhone(aboutMe.whatsapp, aboutMe.countryCode || "+91"),
    }),
  });
  return djb2Hash(payload);
}

function hasEmbeddableScalpPhotos(images = []) {
  return (Array.isArray(images) ? images : []).some((img) => {
    const u = String(img?.dataUrl || img?.previewUrl || img?.url || "");
    return u.startsWith("data:image/");
  });
}

function getDandruffLevel(state) {
  return String(state?.hairHealth?.dandruff_experience || "").toLowerCase().trim();
}

/** Quiz values: frequent | moderate | no */
function resolveHasDandruff(state) {
  const level = getDandruffLevel(state);
  return level === "frequent" || level === "moderate";
}

function includesIgnoreCase(value, needle) {
  return String(value || "").toLowerCase().includes(String(needle).toLowerCase());
}

function listIncludesIgnoreCase(list, needle) {
  return (Array.isArray(list) ? list : []).some((item) => includesIgnoreCase(item, needle));
}

/**
 * Root causes from important quiz answers only.
 * Does not change UI layout — only which cards/copy appear.
 */
function buildRootCauses(state, hasDandruff, isFemale) {
  const hair = state?.hairHealth || {};
  const internal = state?.internalHealth || {};
  const causes = [];
  const dandruffLevel = getDandruffLevel(state);
  const family = String(hair.family_history || "").toLowerCase();
  const stress = String(internal.stress_level || "");
  const sleep = String(internal.sleep_cycle || "");
  const energy = String(internal.energy_level || "");
  const bowel = String(internal.bowel || "");
  const gas = String(internal.gas_acidity || "");
  const digestion = String(internal.digestion || "");
  const iron = String(internal.iron_level || "");
  const food = String(internal.food_habits || "");
  const lifeStage = String(internal.life_stage || "");
  const conditions = Array.isArray(internal.health_conditions) ? internal.health_conditions : [];
  const symptoms = Array.isArray(internal.symptoms) ? internal.symptoms : [];
  const dailyLoss = String(hair.daily_loss_amount || "");
  const shedding = String(hair.shedding_amount || "").toLowerCase();

  // Dandruff ← dandruff_experience
  if (hasDandruff) {
    causes.push({
      id: "dandruff",
      label: dandruffLevel === "frequent" ? "Heavy Dandruff" : "Dandruff",
      icon: "🧴",
      desc:
        dandruffLevel === "frequent"
          ? "You reported heavy dandruff. Flakes irritate the scalp and weaken roots — clearing this early is a priority in your plan."
          : "You reported moderate dandruff. Reducing flakes helps calm the scalp so growth products can work better.",
    });
  }

  // Genetics ← family_history
  if (family && family !== "none" && family !== "unsure") {
    const sideLabel =
      family === "both"
        ? "both sides of your family"
        : family === "mother"
          ? "your mother's side"
          : "your father's side";
    causes.push({
      id: "genetic",
      label: "Genetics",
      icon: "🧬",
      desc: isFemale
        ? `Family history on ${sideLabel} points to genetic thinning along the part line. Your kit targets follicle receptors internally and topically.`
        : `Family history on ${sideLabel} increases DHT-related follicle shrinkage risk. Your plan blocks DHT locally while nourishing roots.`,
    });
  }

  // Hormonal ← symptoms / life_stage / health_conditions
  const hormonalSignals = [];
  if (listIncludesIgnoreCase(symptoms, "pcos") || listIncludesIgnoreCase(symptoms, "pcod")) {
    hormonalSignals.push("PCOS/PCOD");
  }
  if (listIncludesIgnoreCase(symptoms, "thyroid") || listIncludesIgnoreCase(conditions, "thyroid")) {
    hormonalSignals.push("thyroid");
  }
  if (
    listIncludesIgnoreCase(symptoms, "irregular") ||
    listIncludesIgnoreCase(symptoms, "absent periods")
  ) {
    hormonalSignals.push("irregular periods");
  }
  if (
    listIncludesIgnoreCase(symptoms, "facial hair") ||
    listIncludesIgnoreCase(symptoms, "extra hair on face")
  ) {
    hormonalSignals.push("androgen signs");
  }
  if (
    listIncludesIgnoreCase(symptoms, "acne") ||
    listIncludesIgnoreCase(symptoms, "pimples")
  ) {
    hormonalSignals.push("hormonal acne");
  }
  if (listIncludesIgnoreCase(conditions, "diabetes")) hormonalSignals.push("blood sugar");
  if (listIncludesIgnoreCase(conditions, "hormonal") || listIncludesIgnoreCase(conditions, "pcos")) {
    hormonalSignals.push("hormonal condition");
  }
  if (listIncludesIgnoreCase(conditions, "iron") || listIncludesIgnoreCase(conditions, "anemia")) {
    // handled via nutrition
  }
  if (listIncludesIgnoreCase(conditions, "thyroid")) {
    if (!hormonalSignals.includes("thyroid")) hormonalSignals.push("thyroid");
  }
  if (
    lifeStage &&
    !/^none( of these)?$/i.test(lifeStage.trim()) &&
    (includesIgnoreCase(lifeStage, "pregnant") ||
      includesIgnoreCase(lifeStage, "breastfeeding") ||
      includesIgnoreCase(lifeStage, "postpartum") ||
      includesIgnoreCase(lifeStage, "menopause") ||
      includesIgnoreCase(lifeStage, "perimenopause") ||
      includesIgnoreCase(lifeStage, "periods anymore") ||
      includesIgnoreCase(lifeStage, "planning"))
  ) {
    hormonalSignals.push("life-stage hormone shift");
  }
  if (hormonalSignals.length) {
    causes.push({
      id: "hormonal",
      label: "Hormonal",
      icon: "💊",
      desc: `Your answers flagged ${hormonalSignals.slice(0, 2).join(" + ")}. Hormonal imbalance can accelerate shedding — we address this with targeted internal + topical support.`,
    });
  }

  // Nutrition ← iron / energy / gut / food / supplements
  const nutritionBits = [];
  if (includesIgnoreCase(iron, "low iron") || listIncludesIgnoreCase(conditions, "iron") || listIncludesIgnoreCase(conditions, "anemia")) {
    nutritionBits.push("low iron");
  }
  if (includesIgnoreCase(iron, "never checked")) nutritionBits.push("unchecked iron status");
  if (includesIgnoreCase(energy, "very low") || includesIgnoreCase(energy, "low most") || includesIgnoreCase(energy, "afternoon dip") || includesIgnoreCase(energy, "low in afternoon")) {
    nutritionBits.push("low daytime energy");
  }
  if (includesIgnoreCase(bowel, "irregular") || includesIgnoreCase(bowel, "constipation") || includesIgnoreCase(bowel, "frequent") || includesIgnoreCase(bowel, "bloating")) {
    nutritionBits.push("irregular digestion");
  }
  if (includesIgnoreCase(gas, "frequently") || includesIgnoreCase(gas, "chronic") || includesIgnoreCase(gas, "restrictive") || includesIgnoreCase(gas, "lost weight")) {
    nutritionBits.push("diet or weight change");
  }
  if (includesIgnoreCase(digestion, "bloating") || includesIgnoreCase(digestion, "constipation")) {
    nutritionBits.push("gut absorption stress");
  }
  if (includesIgnoreCase(food, "vegetarian") && !/non[-\s]?veg/i.test(food)) {
    nutritionBits.push("vegetarian diet gaps");
  }
  if (String(internal.supplements || "").toLowerCase() === "no") {
    nutritionBits.push("no current supplements");
  }
  if (nutritionBits.length) {
    causes.push({
      id: "nutrition",
      label: includesIgnoreCase(iron, "low iron") ? "Iron & Nutrition" : "Nutrition",
      icon: "🍎",
      desc: `Based on your quiz (${nutritionBits.slice(0, 2).join(", ")}), nutrient support is important for stronger growth from the inside out.`,
    });
  }

  // Lifestyle ← stress_level / sleep_cycle
  const lifestyleBits = [];
  if (includesIgnoreCase(stress, "high") || includesIgnoreCase(stress, "severe") || includesIgnoreCase(stress, "very high")) {
    lifestyleBits.push("high stress");
  } else if (includesIgnoreCase(stress, "moderate")) {
    lifestyleBits.push("daily stress");
  }
  if (includesIgnoreCase(sleep, "under 5") || includesIgnoreCase(sleep, "less than 5")) lifestyleBits.push("short sleep");
  if (lifestyleBits.length) {
    causes.push({
      id: "lifestyle",
      label: "Lifestyle",
      icon: "❤️",
      desc: `You reported ${lifestyleBits.join(" + ")}. Stress and poor sleep can push more follicles into shedding — your plan includes habits that calm these triggers.`,
    });
  }

  // Heavy shedding is intentionally not shown as a root-cause card (non-blocking)

  // Keep section non-empty if quiz signals are sparse
  if (!causes.length) {
    causes.push({
      id: "pattern",
      label: isFemale ? "Part-line Thinning" : "Pattern Hair Loss",
      icon: "🧬",
      desc: isFemale
        ? "Your photos and answers point to pattern thinning. We focus on scalp health and follicle support along the part and crown."
        : "Your photos and answers point to pattern hair loss. We focus on DHT control and follicle nourishment for your stage.",
    });
  }

  return causes;
}

function buildRootCauseTags(state, hasDandruff) {
  const tags = [];
  const internal = state?.internalHealth || {};
  const symptoms = Array.isArray(internal.symptoms) ? internal.symptoms : [];
  const conditions = Array.isArray(internal.health_conditions) ? internal.health_conditions : [];

  if (hasDandruff) tags.push("Scalp Clear");
  if (
    includesIgnoreCase(internal.stress_level, "high") ||
    includesIgnoreCase(internal.stress_level, "severe") ||
    includesIgnoreCase(internal.stress_level, "moderate")
  ) {
    tags.push("Cortisol Control");
  }
  if (
    includesIgnoreCase(internal.iron_level, "low") ||
    includesIgnoreCase(internal.iron_level, "anemia") ||
    includesIgnoreCase(internal.iron_level, "anaemia") ||
    includesIgnoreCase(internal.energy_level, "low") ||
    includesIgnoreCase(internal.energy_level, "afternoon") ||
    (includesIgnoreCase(internal.food_habits, "vegetarian") &&
      !/non[-\s]?veg/i.test(String(internal.food_habits || ""))) ||
    includesIgnoreCase(internal.bowel, "irregular") ||
    includesIgnoreCase(internal.bowel, "constipation") ||
    includesIgnoreCase(internal.bowel, "bloating") ||
    includesIgnoreCase(internal.bowel, "frequent") ||
    includesIgnoreCase(internal.digestion, "bloating") ||
    includesIgnoreCase(internal.digestion, "constipation") ||
    includesIgnoreCase(internal.digestion, "frequent")
  ) {
    tags.push("Nutrient Sync");
  }
  if (
    listIncludesIgnoreCase(symptoms, "pcos") ||
    listIncludesIgnoreCase(symptoms, "pcod") ||
    listIncludesIgnoreCase(symptoms, "thyroid") ||
    listIncludesIgnoreCase(conditions, "thyroid") ||
    listIncludesIgnoreCase(symptoms, "irregular") ||
    listIncludesIgnoreCase(symptoms, "absent periods") ||
    listIncludesIgnoreCase(symptoms, "facial hair") ||
    listIncludesIgnoreCase(symptoms, "acne") ||
    includesIgnoreCase(internal.life_stage, "menopause") ||
    includesIgnoreCase(internal.life_stage, "perimenopause") ||
    includesIgnoreCase(internal.life_stage, "pregnant") ||
    includesIgnoreCase(internal.life_stage, "postpartum") ||
    includesIgnoreCase(internal.life_stage, "breastfeeding")
  ) {
    tags.push("Hormone Balancing");
  }
  return tags;
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

function ResultsSeeingTimeline({ roadmap, ageRange, age }) {
  const ageNum = Number(age);
  const younger = Number.isFinite(ageNum) && ageNum > 0
    ? ageNum <= 35
    : ["18-25", "26-35"].includes(String(ageRange || ""));
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

export default function Result() {
  const { state, resetQuiz, prevStep, setLoading, setError, restorePhotosFromIdb } = useQuiz();
  const { addToCart, cartCount, setIsCartOpen } = useCart();

  const [coachCallOptIn, setCoachCallOptIn] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [drawerLanguage, setDrawerLanguage] = useState("english");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const rootCausesRef = useRef(null);
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
  const dandruffLevel = getDandruffLevel(state);
  const hasDandruff = resolveHasDandruff(state);

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

  // After WP cart return, restore photos from IndexedDB if missing.
  //
  // Privacy fix: this must NEVER run while viewing an archived report
  // (i.e. state.archivedReportId is set, such as opening a ?report=TR-... link).
  // Pulling in whatever scalp photos happen to be cached on this device would
  // display a *different* person's leftover local photo on someone else's
  // report if this browser was previously used to take the quiz. It's only
  // safe to borrow local IndexedDB photos while the current user is actively
  // progressing through their own in-progress quiz session.
useEffect(() => {
  if (displayUserPhoto) return undefined;
  if (state?.archivedReportId) return undefined; // never restore local photos onto an archived report
  let cancelled = false;
  (async () => {
    await restorePhotosFromIdb?.();
    if (cancelled) return;
  })();
  return () => { cancelled = true; };
}, [displayUserPhoto, restorePhotosFromIdb, state?.archivedReportId]);

useEffect(() => {
  const section = rootCausesRef.current;
  if (!section || typeof IntersectionObserver === "undefined") return undefined;

  const observer = new IntersectionObserver(
    ([entry]) => {
      setShowStickyBar(entry.boundingClientRect.bottom <= 0);
    },
    {
      root: null,
      threshold: 0,
    }
  );

  observer.observe(section);

  return () => observer.disconnect();
}, []);

  const requiresDoctorConsultation =
    (gender === "male" && ["6", "7"].includes(String(aiPredictedStageNumber))) ||
    (gender === "female" && aiPredictedStageNumber === "patchy-bald");

  const rootCauses = useMemo(() => buildRootCauses(state, hasDandruff, isFemale), [state, hasDandruff, isFemale]);
  const rootCauseTags = buildRootCauseTags(state, hasDandruff);

  const recommendedBundle = !requiresDoctorConsultation
    ? getRecommendedBundle(gender, aiPredictedStageNumber, dandruffLevel, rootCauseTags, false)
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

  const kitSourceItems = useMemo(() => {
    if (!recommendedBundle) return [];
    const fromRecommended = Array.isArray(recommendedBundle.items)
      ? recommendedBundle.items
      : [];
    const fromCatalog = getBundleItems(recommendedBundle.bundleNumber, false, hasDandruff);
    // Catalog is source of truth so a stale recommendedBundle.items list cannot
    // keep showing the old rosemary Stage-3 kit.
    const source = fromCatalog.length ? fromCatalog : fromRecommended;
    return source.filter(
      (item) =>
        item.id !== "zylk-hair-health-mix" &&
        !String(item.id || "").startsWith("prod-supplements") &&
        !/health mix/i.test(String(item.name || ""))
    );
  }, [hasDandruff, recommendedBundle]);

  const kitProducts = kitSourceItems
    .map((prod) => {
      const formatted = formatBundleProduct(prod, isFemale) || {};
      return {
        id: prod.id,
        shortName: prod.name || formatted.shortName,
        subtitle: prod.subtitle || null,
        description: prod.name || "",
        price: prod.price ?? null,
        originalPrice: prod.originalPrice ?? null,
        imgUrl: formatted.imgUrl || prod.imgUrl,
        imgFallbacks: formatted.imgFallbacks || prod.imgFallbacks || [],
        catalogId: prod.id,
      };
    })
    .filter((product) => product.shortName);

  const drawerProduct = kitProducts.find((product) => product.id === expandedProductId) || null;
  const drawerProductDetails = drawerProduct
    ? getProductDetails(drawerProduct.id, drawerLanguage)
    : null;

  const openProductDrawer = (productId) => {
    setExpandedProductId(productId);
    setDrawerLanguage("english");
  };

  const closeProductDrawer = () => {
    setExpandedProductId(null);
  };

  const coreKitProducts = kitProducts;
  const kitDisplayName = recommendedBundle
    ? getBundleDisplayName(
        recommendedBundle.bundleNumber,
        gender,
        aiPredictedStageNumber
      )
    : null;
const savings = recommendedBundle ? recommendedBundle.originalPrice - recommendedBundle.price : 0;
const testimonials = isFemale
  ? FEMALE_TESTIMONIALS
  : MALE_TESTIMONIALS;

const testimonial =
  testimonials[testimonialIdx % testimonials.length];
  const testimonialPhotos = useMemo(
    () => resolveTestimonialPhotos(testimonial.photos || []),
    [testimonial]
  );

   useEffect(() => {
  if (testimonials.length <= 1) return;

  setTestimonialIdx(0);

  const timer = setInterval(() => {
    setTestimonialIdx((prev) => (prev + 1) % testimonials.length);
  }, 3000);

  return () => clearInterval(timer);
}, [isFemale]);
  
  const handleBuyNow = () => {
    if (requiresDoctorConsultation) {
      alert("Connecting you with a Zylk trichology specialist...");
      return;
    }
    if (!recommendedBundle) return;
    const { bundleNumber } = recommendedBundle;
    const { kitId: kitWooId } = getCheckoutWooProductIds({
      bundleNumber,
      hasDandruff,
      includeHealthMix: false,
      gender,
    });
    const wooProductId =
      kitWooId || getWooProductId(bundleNumber, false, hasDandruff, gender);

    // Keep local quiz cart in sync (optional), then leave this tab for Woo Blocks checkout.
    // Do NOT open the quiz cart drawer — that led to popups / empty-cart on mobile.
    addToCart(
      {
        id: recommendedBundle.bundleId,
        name: getBundleDisplayName(bundleNumber, gender, aiPredictedStageNumber),
        price: recommendedBundle.price,
        priceWithMix: recommendedBundle.bundlePrice,
        priceWithoutMix: recommendedBundle.priceWithoutMix,
        bundleNumber,
        includeHealthMix: false,
        coachCallOptIn,
        gender,
        stage: aiPredictedStageNumber,
        hasDandruff,
        usesSeparateHealthMix: false,
        wooProductId,
        wooHealthMixProductId: null,
        wooProductIdWithMix: recommendedBundle.wooProductIdWithMix,
        wooProductIdNoMix: recommendedBundle.wooProductIdNoMix,
        subtitle: `Complete Customized System (Stage ${aiPredictedStageNumber})`,
      },
      { open: false }
    );

    const checkoutReportId =
      state?.archivedReportId || savedReportPackage?.reportId || null;
    if (checkoutReportId) {
      markCheckoutClicked({
        reportId: checkoutReportId,
        aboutMe: state?.aboutMe,
      }).catch(() => {});
    }

    redirectToWordPressCheckout(
      [
        {
          bundleNumber,
          hasDandruff,
          gender,
          wooProductId,
          quantity: 1,
        },
      ],
      state,
      {
        reportId: checkoutReportId,
        phone: state?.aboutMe?.whatsapp,
      }
    );
  };

  const handleBack = () => {
    if (setLoading) setLoading(false);
    if (setError) setError(null);
    if (prevStep) prevStep();
    else window.history.back();
  };

  const reportIdentityHash = useMemo(
    () => buildReportIdentityHash(state),
    [state?.aboutMe?.whatsapp, state?.aboutMe?.phone, state?.aboutMe?.mobile, state?.aboutMe?.email, state?.aboutMe?.countryCode]
  );

  // After Gemini analysis: PDF → VPS save → Sheets → return report to this page.
  const reportSubmitRef = useRef(false);
  const [reportSaveStatus, setReportSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [savedReportPackage, setSavedReportPackage] = useState(null);
  const [photoWaitExpired, setPhotoWaitExpired] = useState(false);

  // Display ID: archived deep-link, else server-assigned after submit.
  // NEVER invent TR-… IDs in localStorage (that caused veera/Pooja collisions).
  const provisionalMeta = useMemo(() => getProvisionalReportMeta(), []);
  const reportId =
    state?.archivedReportId || savedReportPackage?.reportId || null;
  const reportDate =
    state?.archivedReportDate ||
    savedReportPackage?.reportDate ||
    provisionalMeta.reportDate;

  const photosReady = hasEmbeddableScalpPhotos(state?.scalpImages);

  useEffect(() => {
    if (photosReady || state?.archivedReportId) {
      setPhotoWaitExpired(false);
      return undefined;
    }
    setPhotoWaitExpired(false);
    restorePhotosFromIdb?.();
    const timer = window.setTimeout(() => setPhotoWaitExpired(true), 2500);
    return () => window.clearTimeout(timer);
  }, [photosReady, restorePhotosFromIdb, state?.archivedReportId, reportIdentityHash]);

  useEffect(() => {
    // Reset only when contact identity (phone/email) changes — never when
    // photos hydrate or the user edits a quiz answer like stress.
    reportSubmitRef.current = false;
    setReportSaveStatus("idle");
    setSavedReportPackage(null);
  }, [reportIdentityHash]);

  useEffect(() => {
    if (reportSubmitRef.current) return;
    if (state?.archivedReportId) return;
    if (!state?.aboutMe || !rawAnalysis || analysisMissing) return;
    // Wait for IndexedDB photos so we don't save a no-image PDF, then a second with images.
    if (!photosReady && !photoWaitExpired) return;

    const submittedKey = `zylk_report_submitted_${reportIdentityHash}`;
    const inflightKey = `zylk_report_inflight_${reportIdentityHash}`;

    const existingId = readSubmittedEntry(submittedKey);
    const inflightActive = Boolean(window.localStorage.getItem(inflightKey));
    if (existingId || inflightActive) {
      reportSubmitRef.current = true;
      if (existingId && /^TR-/i.test(existingId)) {
        setSavedReportPackage((prev) =>
          prev?.reportId ? prev : { reportId: existingId, reportDate: provisionalMeta.reportDate }
        );
      }
      setReportSaveStatus("saved");
      return;
    }
    try {
      window.localStorage.setItem(inflightKey, "1");
    } catch {
      // ignore
    }

    reportSubmitRef.current = true;
    setReportSaveStatus("saving");

    const LIVE_DEFAULT = "https://quiz.zylkhealth.com/";
    const publicAppBase =
      (typeof import.meta !== "undefined" &&
        (import.meta.env?.VITE_PUBLIC_APP_URL || import.meta.env?.VITE_APP_ORIGIN)) ||
      LIVE_DEFAULT;
    // Do not invent a Report ID here — server allocates and returns it.
    const resultPageUrl =
      typeof window !== "undefined"
        ? (() => {
            const configured =
              publicAppBase && /^https?:\/\//i.test(publicAppBase) ? publicAppBase : "";
            const onLoopback = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
            const base = configured || (onLoopback ? LIVE_DEFAULT : window.location.href);
            const url = new URL(base, onLoopback ? LIVE_DEFAULT : window.location.origin);
            url.searchParams.delete("report");
            return url.toString();
          })()
        : null;
    const appOrigin =
      publicAppBase && /^https?:\/\//i.test(publicAppBase)
        ? publicAppBase
        : typeof window !== "undefined" &&
            !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
          ? `${window.location.origin}${window.location.pathname || "/"}`
          : LIVE_DEFAULT;

    // Stable Quiz ID for this submission attempt (VPS allocates Report ID separately).
    const quizId =
      (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

    submitAssessmentReport({
      quizId,
      aboutMe: {
        ...state.aboutMe,
        email: String(state.aboutMe?.email || "").trim(),
        whatsapp: normalizeLocalPhone(
          state.aboutMe?.whatsapp,
          state.aboutMe?.countryCode || "+91"
        ),
      },
      hairHealth: state.hairHealth || {},
      internalHealth: state.internalHealth || {},
      scalpAnalysis: rawAnalysis,
      scalpImages: (state.scalpImages || [])
        .filter((img) => img?.dataUrl || img?.previewUrl || img?.url)
        .map((img) => ({
          type: img.type,
          label: img.label || img.type,
          dataUrl: img.dataUrl || img.previewUrl || img.url || null,
        })),
      gender,
      // Server ignores this for allocation; kept only for debug logs
      clientReportId: null,
      clientReportDate: reportDate,
      contentHash: reportIdentityHash,
      appOrigin,
      resultPageUrl,
      reportMeta: {
        rootCauses,
        eligibilityTimeline,
        recommendedBundle: recommendedBundle
          ? {
              bundleId: recommendedBundle.bundleId,
              bundleTitle: kitDisplayName || recommendedBundle.bundleTitle,
              bundleNumber: recommendedBundle.bundleNumber,
              wooProductId: recommendedBundle.wooProductId || null,
              kitUrl: buildKitProductUrl(recommendedBundle.wooProductId),
              price: recommendedBundle.price,
              originalPrice: recommendedBundle.originalPrice,
              products: (kitSourceItems.length ? kitSourceItems : recommendedBundle.items || [])
                .filter((p) => {
                  const id = String(p.id || "").toLowerCase();
                  const name = String(p.name || "").toLowerCase();
                  return (
                    !id.includes("health-mix") &&
                    !id.startsWith("prod-supplements") &&
                    !name.includes("health mix")
                  );
                })
                .map((p) => {
                  const formatted = formatBundleProduct(p, isFemale);
                  return {
                    id: formatted?.catalogId || p.id,
                    name: formatted?.shortName || p.name,
                  };
                }),
            }
          : null,
      },
    })
      .then((data) => {
        // Pipeline returned the server-assigned report package
        setSavedReportPackage(data || null);
        setReportSaveStatus("saved");
        if (typeof window === "undefined") return;
        const id = data?.reportId;
        try {
          if (id) {
            writeSubmittedEntry(`zylk_report_submitted_${reportIdentityHash}`, id);
          }
          if (data?.pdfUrl && id) {
            window.localStorage.setItem(`zylk_report_pdf_${id}`, data.pdfUrl);
          }
          window.localStorage.removeItem(`zylk_report_inflight_${reportIdentityHash}`);
        } catch {
          // ignore
        }
        if (id) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set("report", id);
            window.history.replaceState({}, "", url);
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        // Allow a later retry if this submit failed
        reportSubmitRef.current = false;
        setReportSaveStatus("error");
        setSavedReportPackage(null);
        try {
          window.localStorage.removeItem(`zylk_report_inflight_${reportIdentityHash}`);
        } catch {
          // ignore
        }
        console.warn("[report] submit failed:", err?.message || err);
      });
  }, [
    state?.aboutMe,
    state?.hairHealth,
    state?.internalHealth,
    state?.scalpImages,
    state?.archivedReportId,
    rawAnalysis,
    analysisMissing,
    gender,
    reportDate,
    reportIdentityHash,
    provisionalMeta.reportDate,
    rootCauses,
    eligibilityTimeline,
    recommendedBundle,
    kitDisplayName,
    kitSourceItems,
    photosReady,
    photoWaitExpired,
    dandruffLevel,
    isFemale,
  ]);

  const confidencePhrase = (() => {
    if (analysisMissing || rawAnalysis.quotaFallback) return "moderate confidence";
    const c = Number(rawAnalysis.aiConfidence);
    if (Number.isNaN(c) || c >= 0.8) return "high confidence";
    if (c >= 0.65) return "good confidence";
    return "moderate confidence";
  })();

  return (
    <>
      <div className="min-h-screen bg-[#f0f7f4] -mx-4 md:-mx-8 -mt-8 pb-32 md:pb-10">
      <div className="max-w-lg md:max-w-6xl mx-auto px-3 md:px-6 pt-4 md:grid md:grid-cols-[1fr_380px] md:gap-6 md:items-start">
      {/* LEFT COLUMN — scrolls normally on desktop, single column on mobile */}
      <div className="space-y-4 md:min-w-0">
        {/* Hair Assessment Report intro + scalp overview */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-3.5 sm:p-5">
          <div className="flex flex-row gap-2.5 sm:gap-5 items-start">
            <div className="flex-1 min-w-0 text-left space-y-1.5 sm:space-y-3">
              <h1 className="text-[1.2rem] sm:text-[2.1rem] font-bold text-gray-900 leading-[1.15] tracking-tight">
                Hello {userName},
              </h1>

              {rawAnalysis?.duplicateImagesDetected && (
                <div className="mt-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs sm:text-sm font-medium leading-snug">
                  {rawAnalysis.duplicateImagesWarning ||
                    "Based on the images we can see that you have uploaded the same image for every angle. Your result may vary because the same photo was used."}
                </div>
              )}

              {/* Mobile: stacked title rows */}
              <div className="sm:hidden space-y-0.5">
                <p className="text-[0.95rem] font-bold leading-tight text-[#6f8f3d]">
                  Here is
                </p>
                <p className="text-[0.95rem] font-bold leading-tight text-gray-900">
                  Your personalised
                </p>
                <p className="text-[0.95rem] font-bold leading-tight text-[#6f8f3d]">
                  Hair assessment Report
                </p>
              </div>

              {/* Desktop: single-line title */}
              <h2 className="hidden sm:block text-[1.65rem] font-bold leading-[1.25] tracking-tight text-gray-900">
                <span className="text-[#6f8f3d]">Here is</span> your personalized{" "}
                <span className="text-[#6f8f3d]">Hair Assessment Report</span>
              </h2>

              <div className="inline-flex items-start gap-1.5 sm:gap-2 rounded-2xl sm:rounded-full bg-[#ececec] px-2.5 sm:px-3.5 py-1.5 max-w-full">
                <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center shrink-0 mt-0.5" aria-hidden="true">
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#6f8f3d]" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1.2l5.2 2.1v4.2c0 3.3-2.2 5.9-5.2 6.9-3-1-5.2-3.6-5.2-6.9V3.3L8 1.2z" />
                    <path d="M5.2 7.6l1.7 1.7 3.4-3.5" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[10px] sm:text-[12px] font-medium text-[#555555] leading-snug break-words">
                  {reportId
                    ? `Report ID: ${reportId} • ${reportDate}`
                    : `Report date: ${reportDate}`}
                  {reportSaveStatus === "saving" && " • Saving report…"}
                  {reportSaveStatus === "saved" && reportId && " • Saved"}
                  {reportSaveStatus === "error" && " • Report save pending — will retry"}
                </span>
              </div>

              <p className="text-[12px] sm:text-[15px] text-[#555555] leading-relaxed">
                Our AI scan + expert analysis of 14 key parameters gives us{" "}
                <span className="font-bold text-[#6f8f3d]">{confidencePhrase}</span> in this report.
              </p>
            </div>

            <div className="w-[84px] sm:w-[180px] shrink-0 rounded-xl sm:rounded-2xl border border-gray-100 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden">
              <p className="px-1 pt-1.5 pb-0.5 sm:px-3 sm:pt-3 sm:pb-2 text-[8px] sm:text-sm font-semibold text-gray-900 leading-tight text-center sm:text-left">
                Your Scalp Overview
              </p>
              <div className="px-1 pb-1 sm:px-3 sm:pb-3">
                <div className="relative w-full aspect-square rounded-md sm:rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={displayUserPhoto || AVATAR_FALLBACK}
                    alt="Your scalp overview"
                    className="absolute inset-0 h-full w-full object-contain object-center"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = AVATAR_FALLBACK;
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-gray-100 text-left">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#6f8f3d]">
              Your Assessment
            </p>
            <div className="mt-2 flex flex-nowrap items-center gap-1.5 sm:gap-2">
              <h3 className="min-w-0 text-[15px] sm:text-2xl font-bold text-gray-900 leading-tight">
                {getStageTitle()}
              </h3>
              {getScaleBadge() && (
                <span className="inline-flex items-center rounded-full bg-[#ececec] px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold text-[#555555] shrink-0 whitespace-nowrap">
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
                  onClick={handleBack}
                  className="mt-2 text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-3 py-1.5 rounded-full cursor-pointer"
                >
                  Retake Scalp Scan
                </button>
              </div>
            )}

           

            {!requiresDoctorConsultation && eligibilityTimeline.eligible !== false && (
              <div className="mt-4 bg-[#5a6b2e] rounded-full px-4 py-2 flex items-center justify-between text-white text-sm">
                <span className="font-bold">94% Saw Results*</span>
                <button type="button" className="text-white/90 text-xs font-semibold flex items-center gap-1">
                   
                </button>
              </div>
            )}

             

            <p className="text-[10px] text-gray-400 mt-3 italic">
              *Based on internal Zylk user outcomes for profiles matching your stage and age group.
            </p>
          </div>
        </section>

        {!requiresDoctorConsultation && (
          <>
            <div
              id="root-causes-section"
              ref={rootCausesRef}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left"
            >
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
          </>
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
              {testimonials.map((_, i) => (
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

        {!requiresDoctorConsultation && coreKitProducts.length > 0 && (
          <div className="md:hidden bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Start Your Journey With Just 1 Month Kit
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Personalized Zylk Health bundle for your stage
              </p>
              {kitDisplayName && (
                <p className="text-sm font-bold text-[#064e3b] mt-2">
                  {kitDisplayName}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {coreKitProducts.map((product, index) => {
                const isExpanded = expandedProductId === product.id;
                return (
                  <div key={product.id || index} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => openProductDrawer(product.id)}
                      className="w-full p-4 border border-gray-100 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-[#064e3b]/30 hover:shadow-md transition-all flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center flex-1 min-w-0 text-left">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden mr-4">
                          <ProductImage
                            src={product.imgUrl}
                            fallbacks={product.imgFallbacks}
                            alt={product.subtitle || product.shortName}
                            className="w-full h-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="flex-1 min-w-0 pr-2">
                          <h3 className="text-sm font-bold text-gray-800 leading-snug tracking-tight break-words">
                            {product.subtitle || product.shortName}
                          </h3>
                          {product.shortName && product.subtitle && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                              {product.shortName}
                            </p>
                          )}
                          {(product.price != null || product.originalPrice != null) && (
                            <p className="text-xs font-semibold text-[#064e3b] mt-1">
                              {Number(product.price) === 0 ? (
                                <>
                                  <span className="text-[#52b788]">FREE</span>
                                  {product.originalPrice > 0 && (
                                    <span className="text-gray-400 line-through font-medium ml-1.5">
                                      ₹{product.originalPrice}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  ₹{product.price}
                                  {product.originalPrice > product.price && (
                                    <span className="text-gray-400 line-through font-medium ml-1.5">
                                      ₹{product.originalPrice}
                                    </span>
                                  )}
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 border ${
                            Number(product.price) === 0
                              ? "text-white bg-[#52b788] border-[#52b788]"
                              : "text-emerald-800 bg-emerald-50 border-emerald-100/40"
                          }`}
                        >
                          {Number(product.price) === 0 ? "FREE" : "Included"}
                        </span>
                        <span className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-90 text-[#064e3b]" : ""}`}>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
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
              {testimonials.map((_, i) => (
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
            <p className="text-xl font-bold text-[#064e3b]">Verify Eligibility!</p>
            <p className="text-sm font-bold text-gray-600 mt-1">If you want to know if you are eligible for
money back guarantee contact our customer support</p>
            <div className="border-t border-dashed border-gray-200 my-4" />
             <div className="mt-2 flex justify-center">
               <a
                 href="https://wa.me/917603876811"
                 target="_blank"
                 rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 rounded-full border border-[#25D366] bg-[#E9F7EE] px-3 py-2 text-sm font-semibold text-[#075E54] hover:bg-[#d7f0de] transition-colors"
               >
                 <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white text-base">
                   W
                 </span>
                 WhatsApp
               </a>
             </div>
          </div>
        )}

         

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
      {!requiresDoctorConsultation && coreKitProducts.length > 0 && (
        <div className="hidden md:block md:sticky md:top-6">
          <div className="bg-white rounded-[32px] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-gray-100 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Start Your Journey With Just 1 Month Kit
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Personalized Zylk Health bundle for your stage
              </p>
              {kitDisplayName && (
                <p className="text-sm font-bold text-[#064e3b] mt-2">
                  {kitDisplayName}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {coreKitProducts.map((product, index) => {
                const isExpanded = expandedProductId === product.id;
                return (
                  <div key={product.id || index} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => openProductDrawer(product.id)}
                      className="w-full p-3 border border-gray-100 rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-[#064e3b]/30 hover:shadow-md transition-all flex items-center justify-between gap-3 group"
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
                        <div className="flex-1 min-w-0 pr-2 text-left">
                          <h3 className="text-xs font-bold text-gray-800 leading-snug tracking-tight break-words">
                            {product.subtitle || product.shortName}
                          </h3>
                          {product.shortName && product.subtitle && (
                            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">
                              {product.shortName}
                            </p>
                          )}
                          {(product.price != null || product.originalPrice != null) && (
                            <p className="text-xs font-semibold text-[#064e3b] mt-1">
                              {Number(product.price) === 0 ? (
                                <>
                                  <span className="text-[#52b788]">FREE</span>
                                  {product.originalPrice > 0 && (
                                    <span className="text-gray-400 line-through font-medium ml-1.5">
                                      ₹{product.originalPrice}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  ₹{product.price}
                                  {product.originalPrice > product.price && (
                                    <span className="text-gray-400 line-through font-medium ml-1.5">
                                      ₹{product.originalPrice}
                                    </span>
                                  )}
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 border ${
                            Number(product.price) === 0
                              ? "text-white bg-[#52b788] border-[#52b788]"
                              : "text-emerald-800 bg-emerald-50 border-emerald-100/40"
                          }`}
                        >
                          {Number(product.price) === 0 ? "FREE" : "Included"}
                        </span>
                        <span className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-90 text-[#064e3b]" : ""}`}>
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
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
                  </div>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3.5 px-5 rounded-lg tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-between group"
                  >
                    <span className="mx-auto pl-4 text-center"> Buy Now </span>
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

      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transform transition-transform duration-300 ease-in-out ${showStickyBar ? "translate-y-0" : "translate-y-full"}`}>
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
              </div>

              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full bg-gradient-to-r from-[#2e7d32] to-[#1b5e20] hover:from-[#1b5e20] hover:to-[#0c3810] text-white font-bold text-sm py-3 px-5 rounded-lg tracking-wide cursor-pointer transition-all shadow-md flex items-center justify-between group"
              >
                <span className="mx-auto pl-4 text-center">Buy Now</span>
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
    {expandedProductId && drawerProductDetails && (
      <>
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={closeProductDrawer}
        />
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-gray-200 overflow-y-auto transition-transform duration-300 ease-out">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-green-700 font-bold">Product Details</p>
              <h2 className="text-lg font-bold text-gray-900 mt-2">{drawerProductDetails.title}</h2>
            </div>
            <button
              type="button"
              onClick={closeProductDrawer}
              className="text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Close product details"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-[120px_1fr] items-start">
              <div className="w-full max-w-[120px] mx-auto">
                <div className="rounded-3xl overflow-hidden border border-gray-200 bg-gray-50">
                  <ProductImage
                    src={drawerProduct.imgUrl}
                    fallbacks={drawerProduct.imgFallbacks}
                    alt={drawerProduct.subtitle || drawerProduct.shortName}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-green-700 font-bold">Product</p>
                  <h2 className="text-xl font-bold text-gray-900 mt-2">
                    {drawerProduct.subtitle || drawerProductDetails.title}
                  </h2>
                  {drawerProduct.shortName && drawerProduct.subtitle && (
                    <p className="text-sm text-gray-500 mt-1">
                      {drawerProduct.shortName}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-3xl bg-[#f3f7f2] p-4 text-sm text-gray-700">
              <p className="font-semibold mb-2">Summary</p>
              <p>{drawerProductDetails.summary}</p>
            </div>
            <div className="rounded-3xl bg-[#f9fafb] p-4 text-sm text-gray-700">
              <p className="font-semibold mb-2">Ingredients</p>
              <ul className="list-disc list-inside space-y-1">
                {drawerProductDetails.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-[#f3f7f2] p-4 text-sm text-gray-700">
              <p className="font-semibold mb-2">Usage Instructions</p>
              <p>{drawerProductDetails.usage}</p>
            </div>
          </div>
        </div>
      </>
    )}
    </>
  );
}