import {
  saveScalpImagesToIdb,
  clearScalpImagesIdb,
} from "./quizImageStore";

export const STORAGE_KEY = "zylk_quiz_state_v1";
export const CHECKOUT_RETURN_KEY = "zylk_checkout_return";

export const INITIAL_QUIZ_STATE = {
  step: 0,
  aboutMe: {
    fullName: "",
    whatsapp: "",
    email: "",
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

    return {
      ...INITIAL_QUIZ_STATE,
      ...parsed,
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

export function clearPersistedQuizState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
  } catch {
    // ignore
  }
  clearScalpImagesIdb().catch(() => {});
}
