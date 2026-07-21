import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

const QuizContext = createContext();

const STORAGE_KEY = "zylk_quiz_state_v1";
const CHECKOUT_RETURN_KEY = "zylk_checkout_return";

const INITIAL_STATE = {
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
    daily_loss_amount: "",
    dandruff_experience: "",
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
    // Keep compressed data URLs so Result/PDF still work after reload when possible
    dataUrl: img?.dataUrl || img?.previewUrl || img?.url || null,
  }));
}

function serializeState(state) {
  return {
    ...state,
    isLoading: false,
    error: null,
    scalpImages: stripHeavyImageData(state.scalpImages),
  };
}

function loadPersistedState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    return {
      ...INITIAL_STATE,
      ...parsed,
      aboutMe: { ...INITIAL_STATE.aboutMe, ...(parsed.aboutMe || {}) },
      hairHealth: { ...INITIAL_STATE.hairHealth, ...(parsed.hairHealth || {}) },
      internalHealth: { ...(parsed.internalHealth || {}) },
      sectionSteps: { ...INITIAL_STATE.sectionSteps, ...(parsed.sectionSteps || {}) },
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
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState(state)));
  } catch (err) {
    // Quota exceeded — retry without image payloads
    try {
      const light = {
        ...serializeState(state),
        scalpImages: (state.scalpImages || []).map((img) => ({
          type: img?.type,
          label: img?.label || img?.type,
          dataUrl: null,
        })),
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
}

export function QuizProvider({ children }) {
  const [state, setState] = useState(() => loadPersistedState() || INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Persist on every meaningful state change so reload / WP-cart return can resume
  useEffect(() => {
    persistQuizStateNow(state);
  }, [state]);

  // Browser back from WordPress may restore via bfcache — rehydrate from storage
  useEffect(() => {
    const onPageShow = (event) => {
      if (!event.persisted) return;
      const restored = loadPersistedState();
      if (restored) setState(restored);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const nextStep = () => {
    setState((prev) => ({
      ...prev,
      step: prev.step + 1,
      navDirection: "forward",
    }));
  };

  const prevStep = () => {
    setState((prev) => ({
      ...prev,
      step: Math.max(0, prev.step - 1),
      navDirection: "backward",
    }));
  };

  const goToStep = (targetStep, direction = "forward") => {
    setState((prev) => ({
      ...prev,
      step: targetStep,
      navDirection: direction,
    }));
  };

  const updateAboutMe = (data) => {
    setState((prev) => ({
      ...prev,
      aboutMe: { ...prev.aboutMe, ...data },
    }));
  };

  const updateHairHealth = (data) => {
    setState((prev) => ({
      ...prev,
      hairHealth: { ...prev.hairHealth, ...data },
    }));
  };

  const updateInternalHealth = (data) => {
    setState((prev) => ({
      ...prev,
      internalHealth: { ...prev.internalHealth, ...data },
    }));
  };

  const setScalpAnalysis = (analysis) => {
    setState((prev) => ({
      ...prev,
      scalpAnalysis: analysis,
      isLoading: false,
      error: null,
    }));
  };

  const setScalpImages = (images) => {
    setState((prev) => ({
      ...prev,
      scalpImages: images,
    }));
  };

  const setLoading = (isLoading) => {
    setState((prev) => ({ ...prev, isLoading }));
  };

  const setError = (error) => {
    setState((prev) => ({ ...prev, error, isLoading: false }));
  };

  const resetQuiz = () => {
    clearPersistedQuizState();
    setState(INITIAL_STATE);
  };

  const hydrateFromReport = useCallback((report) => {
    if (!report || typeof report !== "object") return;
    setState((prev) => ({
      ...prev,
      step: 5,
      aboutMe: {
        ...INITIAL_STATE.aboutMe,
        ...(report.aboutMe || {}),
      },
      hairHealth: {
        ...INITIAL_STATE.hairHealth,
        ...(report.hairHealth || {}),
      },
      internalHealth: { ...(report.internalHealth || {}) },
      scalpAnalysis: report.scalpAnalysis || null,
      scalpImages: Array.isArray(report.scalpImages) ? report.scalpImages : [],
      archivedReportId: report.reportId || null,
      archivedReportDate: report.reportDate || null,
      isLoading: false,
      error: null,
      navDirection: "forward",
    }));
  }, []);

  const flushPersistence = useCallback(() => {
    persistQuizStateNow(stateRef.current);
  }, []);

  const updateSectionStep = useCallback((section, targetStep) => {
    setState((prev) => {
      if (prev.sectionSteps[section] === targetStep) {
        return prev;
      }
      return {
        ...prev,
        sectionSteps: {
          ...prev.sectionSteps,
          [section]: targetStep,
        },
      };
    });
  }, []);

  return (
    <QuizContext.Provider
      value={{
        state,
        nextStep,
        prevStep,
        goToStep,
        updateAboutMe,
        updateHairHealth,
        updateInternalHealth,
        setScalpAnalysis,
        setScalpImages,
        setLoading,
        setError,
        resetQuiz,
        hydrateFromReport,
        updateSectionStep,
        flushPersistence,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error("useQuiz must be used within QuizProvider.");
  }
  return context;
}
