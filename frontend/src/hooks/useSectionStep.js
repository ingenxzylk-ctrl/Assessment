import { useState } from "react";
import { useQuiz } from "../context/QuizContext";

/**
 * Manages intra-section question index:
 * - Forward into section → first question
 * - Back from next section → last question
 */
export function useSectionStep(sectionKey, lastStep, forwardStep = 0) {
  const { state } = useQuiz();
  const navDirection = state.navDirection;

  const [step, setStep] = useState(() =>
    navDirection === "backward" ? lastStep : forwardStep
  );

  return [step, setStep];
}