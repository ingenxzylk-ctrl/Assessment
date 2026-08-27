import {
  saveScalpImagesToIdb,
  clearScalpImagesIdb,
} from "./quizImageStore";

export const STORAGE_KEY = "zylk_quiz_state_v1";
export const CHECKOUT_RETURN_KEY = "zylk_checkout_return";

export const INITIAL_QUIZ_STATE = {
  step: 0.5,
  aboutMe: {
    fullName: "",
    whatsapp: "",
    email: "",
    city: "",
    pincode: "",
    state: "",
    countryCode: "+91",
    countryName: "India",
    age: "",
    ageRange: "",
    gender: "",
    scalpConsent: false,
  },
  hairHealth: {
    norwood_stage: "",
    hair_fall_zone: "",
    hair_loss_area: "",
    daily_loss_amount: "",
    dandruff_experience: "",
    scalp_symptoms: [],
    family_history: "",
    loss_duration: "",
    shedding_amount: "",
  },
  internalHealth: {},
  scalpAnalysis: null,
  scalpImages: [],
  /** When set, Result was opened from an archived `?report=` link — skip re-PDF. */
  archivedReportId: null,
  archivedReportDate: null,
  sectionSteps: {
    section1AboutMe: 0,
    section2Male: 0,
    section2Female: 0,
    section3Male: 0,
    section3Female: 0,
    section4Scalp: "guide",
  },
  navDirection: "forward",
  isLoading: false,
  error: null,
};

function stripHeavyImageData(images = []) {
  return (Array.isArray(images) ? images : []).map((img) => ({
    type: img?.type,
    label: img?.label || img?.type,
    dataUrl: img?.dataUrl || img?.previewUrl || img?.url || null,
  }));
}

/** localStorage payload keeps image metadata; full data URLs live in IndexedDB. */
function lightImagesForLocalStorage(images = []) {
  return (Array.isArray(images) ? images : []).map((img) => ({
    type: img?.type,
    label: img?.label || img?.type,
    hasImage: Boolean(img?.dataUrl || img?.previewUrl || img?.url),
    dataUrl: null,
  }));
}

function serializeState(state, { keepImageData = false } = {}) {
  const sectionSteps = { ...(state.sectionSteps || {}) };
  if (sectionSteps.section4Scalp === "analyzing") {
    sectionSteps.section4Scalp = "upload";
  }
  return {
    ...state,
    sectionSteps,
    isLoading: false,
    error: null,
    scalpImages: keepImageData
      ? stripHeavyImageData(state.scalpImages)
      : lightImagesForLocalStorage(state.scalpImages),
  };
}

export function loadPersistedState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const sectionSteps = {
      ...INITIAL_QUIZ_STATE.sectionSteps,
      ...(parsed.sectionSteps || {}),
    };
    if (sectionSteps.section4Scalp === "analyzing") {
      sectionSteps.section4Scalp = "upload";
    }

    const restoredStep = parsed.step === 0 ? 0.5 : parsed.step;

    return {
      ...INITIAL_QUIZ_STATE,
      ...parsed,
      step: restoredStep,
      aboutMe: { ...INITIAL_QUIZ_STATE.aboutMe, ...(parsed.aboutMe || {}) },
      hairHealth: { ...INITIAL_QUIZ_STATE.hairHealth, ...(parsed.hairHealth || {}) },
      internalHealth: { ...(parsed.internalHealth || {}) },
      sectionSteps,
      scalpImages: Array.isArray(parsed.scalpImages) ? parsed.scalpImages : [],
      archivedReportId: parsed.archivedReportId || null,
      archivedReportDate: parsed.archivedReportDate || null,
      isLoading: false,
      error: null,
    };
  } catch {
    return null;
  }
}

export function persistQuizStateNow(state) {
  if (typeof window === "undefined" || !state) return;

  saveScalpImagesToIdb(state.scalpImages).catch(() => {});

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializeState(state, { keepImageData: false }))
    );
  } catch {
    try {
      const light = {
        ...serializeState(state, { keepImageData: false }),
        scalpImages: lightImagesForLocalStorage(state.scalpImages),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch {
      // ignore
    }
  }
}

export function markCheckoutReturn() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHECKOUT_RETURN_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Remove every report-submission-tracking key this app has ever written
 * (zylk_report_submitted_<hash>, zylk_report_inflight_<hash>, zylk_report_pdf_<id>).
 *
 * These are keyed by a content hash of the quiz answers, not by quiz attempt.
 * Left alone, they (a) accumulate forever in localStorage, and (b) can — in the
 * rare case a retake produces byte-identical content (shared device, identical
 * test/demo answers) — cause the next attempt to silently reuse a stale report
 * instead of submitting fresh data. Sweeping them on every reset closes that gap.
 */
function clearReportSubmissionKeys() {
  if (typeof window === "undefined") return;
  try {
    const toRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("zylk_report_")) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}

export function clearPersistedQuizState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
  } catch {
    // ignore
  }
  clearReportSubmissionKeys();
  clearScalpImagesIdb().catch(() => {});
}