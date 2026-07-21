
import { createContext, useContext, useState, useCallback } from "react";

const QuizContext = createContext();

const INITIAL_STATE = {
  step: 0,
  aboutMe: {
    fullName: "",
    whatsapp: "",
    email: "",
    countryCode: "+91",
    countryName: "India",
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

export function QuizProvider({ children }) {
  const [state, setState] = useState(INITIAL_STATE);

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
    setState(INITIAL_STATE);
  };

   const updateSectionStep = useCallback((section, targetStep) => {
    setState((prev) => {
      if (prev.sectionSteps[section] === targetStep) {
        return prev; // no change → no re-render
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
        updateSectionStep,
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