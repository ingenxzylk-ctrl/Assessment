import { useState, useEffect, useRef } from "react";
import { useQuiz } from "../context/QuizContext";

/**
 * Manages intra-section question index with persistence via QuizContext.sectionSteps.
 *
 * Rules:
 * - Backward into section → last question (then clamped to first unanswered if needed)
 * - Never restore/jump past the first unanswered question (prevents skipping)
 * - Advancing only allowed when the current step is answered, one step at a time
 *
 * @param {string} sectionKey
 * @param {number|string} lastStep
 * @param {number|string} forwardStep
 * @param {(step: number|string) => boolean} [isStepAnswered]
 */
export function useSectionStep(sectionKey, lastStep, forwardStep = 0, isStepAnswered) {
  const { state, updateSectionStep } = useQuiz();
  const navDirection = state.navDirection;
  const stored = state.sectionSteps?.[sectionKey];
  const isNumeric = typeof lastStep === "number";

  const answeredRef = useRef(isStepAnswered);
  answeredRef.current = isStepAnswered;

  const findFirstUnanswered = (checkFn = answeredRef.current) => {
    if (!isNumeric || typeof checkFn !== "function") {
      return stored !== undefined && stored !== null ? stored : forwardStep;
    }
    for (let i = 0; i <= lastStep; i += 1) {
      if (!checkFn(i)) return i;
    }
    return lastStep;
  };

  const resolveInitial = () => {
    if (!isNumeric) {
      if (stored !== undefined && stored !== null) return stored;
      return navDirection === "backward" ? lastStep : forwardStep;
    }

    const firstOpen = findFirstUnanswered(isStepAnswered);
    // Backward into a fully answered section lands on last (firstOpen === lastStep)
    if (navDirection === "backward") return firstOpen;
    if (stored === undefined || stored === null) return firstOpen;
    // Never restore past the first unanswered question
    return Math.min(Number(stored) || 0, firstOpen);
  };

  const [step, setStepInternal] = useState(resolveInitial);

  // Keep the visible question from jumping ahead of unanswered ones
  useEffect(() => {
    if (!isNumeric || typeof answeredRef.current !== "function") return;
    const firstOpen = findFirstUnanswered();
    setStepInternal((prev) => {
      if (prev <= firstOpen) return prev;
      if (updateSectionStep) updateSectionStep(sectionKey, firstOpen);
      return firstOpen;
    });
    // Re-check when quiz section remounts / gender or stored answers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.aboutMe?.gender, sectionKey]);

  const setStep = (value) => {
    setStepInternal((prev) => {
      let next = typeof value === "function" ? value(prev) : value;

      if (isNumeric && typeof answeredRef.current === "function" && typeof next === "number") {
        const check = answeredRef.current;
        if (next > prev) {
          // Must answer current question before moving forward
          if (!check(prev)) return prev;
          // Only one question at a time
          next = Math.min(next, prev + 1);
        }
      }

      if (updateSectionStep) updateSectionStep(sectionKey, next);
      return next;
    });
  };

  return [step, setStep];
}
