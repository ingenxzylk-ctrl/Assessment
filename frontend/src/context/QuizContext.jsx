import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import {
  saveScalpImagesToIdb,
  loadScalpImagesFromIdb,
  clearScalpImagesIdb,
  mergeScalpImages,
  scalpImagesHaveData,
} from "../utils/quizImageStore";

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
    // Keep compressed data URLs so Result/PDF still work after reload when possible
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

function loadPersistedState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const sectionSteps = {
      ...INITIAL_STATE.sectionSteps,
      ...(parsed.sectionSteps || {}),
    };
    // Never restore the transient analyzing screen from cache
    if (sectionSteps.section4Scalp === "analyzing") {
      sectionSteps.section4Scalp = "upload";
    }

    return {
      ...INITIAL_STATE,
      ...parsed,
      aboutMe: { ...INITIAL_STATE.aboutMe, ...(parsed.aboutMe || {}) },
      hairHealth: { ...INITIAL_STATE.hairHealth, ...(parsed.hairHealth || {}) },
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

  // Always try to keep photos in IndexedDB (survives WP cart round-trip)
  saveScalpImagesToIdb(state.scalpImages).catch(() => {});

  try {
    // Prefer light localStorage write so quota is not blown by data URLs
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializeState(state, { keepImageData: false }))
    );
  } catch (err) {
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

export function QuizProvider({ children }) {
  const [state, setState] = useState(() => loadPersistedState() || INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Rehydrate scalp photos from IndexedDB after mount / checkout return
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const idbImages = await loadScalpImagesFromIdb();
      if (cancelled || !idbImages.length) return;
      setState((prev) => {
        const merged = mergeScalpImages(idbImages, prev.scalpImages);
        const mergedHasUrl = merged.some((i) => i?.dataUrl);
        if (!mergedHasUrl) return prev;
        return { ...prev, scalpImages: merged };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every meaningful state change so reload / WP-cart return can resume
  useEffect(() => {
    persistQuizStateNow(state);
  }, [state]);

  // Browser back from WordPress may restore via bfcache — rehydrate from storage + IDB
  useEffect(() => {
    const rehydrate = async () => {
      const restored = loadPersistedState();
      const idbImages = await loadScalpImagesFromIdb();
      setState((prev) => {
        const base = restored || prev;
        const mergedImages = mergeScalpImages(
          idbImages,
          mergeScalpImages(base.scalpImages, prev.scalpImages)
        );
        return {
          ...base,
          scalpImages: mergedImages,
          isLoading: false,
          error: null,
        };
      });
    };

    const onPageShow = () => {
      rehydrate();
    };
    const onFocus = () => {
      // Returning from WP cart in some browsers fires focus without bfcache pageshow
      try {
        if (window.sessionStorage.getItem(CHECKOUT_RETURN_KEY) === "1") {
          window.sessionStorage.removeItem(CHECKOUT_RETURN_KEY);
          rehydrate();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const nextStep = () => {
    setState((prev) => ({
      ...prev,
      step: prev.step + 1,
      navDirection: "forward",
    }));
  };

  const prevStep = () => {
    setState((prev) => {
      const nextStepNum = Math.max(0, prev.step - 1);
      const next = {
        ...prev,
        step: nextStepNum,
        navDirection: "backward",
        isLoading: false,
      };

      // Result → scalp scan: always land on photo upload, never the analyzing screen
      if (prev.step === 5 && nextStepNum === 4) {
        next.sectionSteps = {
          ...prev.sectionSteps,
          section4Scalp: "upload",
        };
      }

      return next;
    });
  };

  const goToStep = (targetStep, direction = "forward") => {
    setState((prev) => ({
      ...prev,
      step: targetStep,
      navDirection: direction,
    }));
  };

  const updateAboutMe = (data) => {
    setState((prev) => {
      const nextAbout = { ...prev.aboutMe, ...data };
      const genderChanged =
        Boolean(data?.gender) &&
        Boolean(prev.aboutMe?.gender) &&
        data.gender !== prev.aboutMe.gender;

      if (!genderChanged) {
        return { ...prev, aboutMe: nextAbout };
      }

      // Changing male ↔ female invalidates the rest of the quiz + prior AI result
      clearScalpImagesIdb().catch(() => {});
      try {
        window.dispatchEvent(new CustomEvent("zylk:gender-changed"));
      } catch {
        // ignore
      }

      return {
        ...prev,
        aboutMe: nextAbout,
        hairHealth: { ...INITIAL_STATE.hairHealth },
        internalHealth: {},
        scalpAnalysis: null,
        scalpImages: [],
        archivedReportId: null,
        archivedReportDate: null,
        sectionSteps: {
          ...INITIAL_STATE.sectionSteps,
          section1AboutMe: prev.sectionSteps?.section1AboutMe ?? 0,
        },
        error: null,
        isLoading: false,
      };
    });
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

  const hydrateFromReport = useCallback((report, { preferLocalPhotos = true } = {}) => {
    if (!report || typeof report !== "object") return;

    const apply = (photoSources = []) => {
      setState((prev) => {
        const archiveImages = Array.isArray(report.scalpImages) ? report.scalpImages : [];
        const mergedImages = preferLocalPhotos
          ? mergeScalpImages(
              mergeScalpImages(photoSources, prev.scalpImages),
              archiveImages
            )
          : mergeScalpImages(archiveImages, mergeScalpImages(photoSources, prev.scalpImages));

        return {
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
          scalpAnalysis: report.scalpAnalysis || prev.scalpAnalysis || null,
          scalpImages: mergedImages,
          archivedReportId: report.reportId || null,
          archivedReportDate: report.reportDate || null,
          isLoading: false,
          error: null,
          navDirection: "forward",
        };
      });
    };

    // Merge IndexedDB photos so archive metadata never blanks the Result overview
    loadScalpImagesFromIdb()
      .then((idbImages) => apply(idbImages))
      .catch(() => apply([]));
  }, []);

  const restorePhotosFromIdb = useCallback(async () => {
    const idbImages = await loadScalpImagesFromIdb();
    if (!scalpImagesHaveData(idbImages)) return false;
    setState((prev) => ({
      ...prev,
      scalpImages: mergeScalpImages(idbImages, prev.scalpImages),
    }));
    return true;
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
        restorePhotosFromIdb,
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
