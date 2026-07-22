import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import {
  loadScalpImagesFromIdb,
  clearScalpImagesIdb,
  mergeScalpImages,
  scalpImagesHaveData,
} from "../utils/quizImageStore";
import {
  INITIAL_QUIZ_STATE,
  CHECKOUT_RETURN_KEY,
  loadPersistedState,
  persistQuizStateNow,
  clearPersistedQuizState,
} from "../utils/quizPersistence";

// Re-export persistence helpers for callers that historically imported them from here.
export {
  persistQuizStateNow,
  markCheckoutReturn,
  clearPersistedQuizState,
} from "../utils/quizPersistence";

const QuizContext = createContext(null);

const INITIAL_STATE = INITIAL_QUIZ_STATE;

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
    setState((prev) => {
      const nextStepNum = prev.step + 1;
      // When entering a section forward, do not keep a stale high question index
      // that would skip unanswered questions. useSectionStep also clamps, but
      // resetting here makes forward entry always start from Q1 when incomplete.
      const sectionSteps = { ...prev.sectionSteps };
      if (nextStepNum === 1) sectionSteps.section1AboutMe = 0;
      if (nextStepNum === 2) {
        sectionSteps.section2Male = 0;
        sectionSteps.section2Female = 0;
      }
      if (nextStepNum === 3) {
        sectionSteps.section3Male = 0;
        sectionSteps.section3Female = 0;
      }
      if (nextStepNum === 4) sectionSteps.section4Scalp = "guide";

      return {
        ...prev,
        step: nextStepNum,
        navDirection: "forward",
        sectionSteps,
      };
    });
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
