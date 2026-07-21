import { useState, useEffect } from "react";
import { useQuiz } from "../context/QuizContext";

/**
 * Manages intra-section question index with persistence via QuizContext.sectionSteps.
 * - Forward into section → first question (or restored index)
 * - Back from next section → last question
 */
export function useSectionStep(sectionKey, lastStep, forwardStep = 0) {
  const { state, updateSectionStep } = useQuiz();
  const navDirection = state.navDirection;
  const stored = state.sectionSteps?.[sectionKey];

  const [step, setStepInternal] = useState(() => {
    if (stored !== undefined && stored !== null) return stored;
    return navDirection === "backward" ? lastStep : forwardStep;
  });

  // Keep local index aligned if persisted state restores after mount
  useEffect(() => {
    if (stored === undefined || stored === null) return;
    if (stored !== step) setStepInternal(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  const setStep = (value) => {
    setStepInternal((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      if (updateSectionStep) updateSectionStep(sectionKey, next);
      return next;
    });
  };

  return [step, setStep];
}
