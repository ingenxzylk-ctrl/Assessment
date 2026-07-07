import { createContext, useContext, useState } from "react";

// Create the context instance
const QuizContext = createContext();

export function QuizProvider({ children }) {
  const [state, setState] = useState({
    step: 0,
    aboutMe: {
      fullName: "",
      whatsapp: "",
      email: "",
      countryCode: "+91",
      ageRange: "",
      gender: "",
      scalpConsent: false
    },
    hairHealth: {
      norwood_stage: "",
      hair_fall_zone: "",
      daily_loss_amount: "",
      dandruff_experience: "",
      family_history: "",
      loss_duration: ""
    },
    sectionSteps: {
      section4Scalp: "consent"
    },
    isLoading: false
  });

  const nextStep = () => {
    setState((prev) => ({ ...prev, step: prev.step + 1 }));
  };

  const prevStep = () => {
    setState((prev) => ({ ...prev, step: Math.max(0, prev.step - 1) }));
  };

  const goToStep = (targetStep) => {
    setState((prev) => ({ ...prev, step: targetStep }));
  };

  const updateAboutMe = (data) => {
    setState((prev) => ({
      ...prev,
      aboutMe: { ...prev.aboutMe, ...data }
    }));
  };

  const updateHairHealth = (data) => {
    setState((prev) => ({
      ...prev,
      hairHealth: { ...prev.hairHealth, ...data }
    }));
  };

  const updateSectionStep = (section, targetStep) => {
    setState((prev) => ({
      ...prev,
      sectionSteps: {
        ...prev.sectionSteps,
        [section]: targetStep
      }
    }));
  };

  return (
    <QuizContext.Provider 
      value={{ 
        state, 
        nextStep, 
        prevStep, 
        goToStep, 
        updateAboutMe, 
        updateHairHealth,
        updateSectionStep
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

// 自由 export standard named hook constraint rule configurations
// 🟢 THIS IS THE EXACT EXPORT LINE VITE WAS MISSING:
export function useQuiz() {
  const context = useContext(QuizContext);
  if (!context) {
    throw new Error("useQuiz must be wrapped within a clear structural QuizProvider element block.");
  }
  return context;
}