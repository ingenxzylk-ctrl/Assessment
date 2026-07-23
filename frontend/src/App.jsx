import { useEffect, useState } from "react";
import { QuizProvider, useQuiz } from "./context/QuizContext";
import { CartProvider } from "./context/CartContext";
import CartDrawer from "./components/ui/CartDrawer";
import ProgressBar from "./components/ProgressBar";
import Home from "./components/Home";
import Section1AboutMe from "./components/sections/Section1AboutMe";
import Section2Male from "./components/sections/Section2Male";
import Section2Female from "./components/sections/Section2Female";
import Section3Male from "./components/sections/Section3Male";
import Section3Female from "./components/sections/Section3Female";
import Section4Scalp from "./components/sections/Section4Scalp";
import Result from "./components/Result";
import Section0Consent from "./components/sections/Section0Consent";
import { fetchAssessmentReport } from "./api/quizApi";
import {
  loadScalpImagesFromIdb,
  scalpImagesHaveData,
  mergeScalpImages,
} from "./utils/quizImageStore";
import "./styles/index.css";

const ABOUT_STEPS = 4;
const HAIR_STEPS_MALE = 7;
const HAIR_STEPS_FEMALE = 6;
const HEALTH_MALE_STEPS = 8;
const HEALTH_FEMALE_STEPS = 10;
const SCAN_STEPS = 2;

function getQuizProgressMeta(state) {
  const step = Number(state?.step) || 0;
  const gender = state?.aboutMe?.gender;
  const ss = state?.sectionSteps || {};

  if (step === 1) {
    return {
      questionNumber: Number(ss.section1AboutMe ?? 0) + 1,
      questionTotal: ABOUT_STEPS,
      sectionLabel: "Section 1 of 4",
    };
  }

  if (step === 2) {
    const key = gender === "female" ? "section2Female" : "section2Male";
    return {
      questionNumber: Number(ss[key] ?? 0) + 1,
      questionTotal: gender === "female" ? HAIR_STEPS_FEMALE : HAIR_STEPS_MALE,
      sectionLabel: "Section 2 of 4",
    };
  }

  if (step === 3) {
    if (gender === "female") {
      return {
        questionNumber: Number(ss.section3Female ?? 0) + 1,
        questionTotal: HEALTH_FEMALE_STEPS,
        sectionLabel: "Section 3 of 4 — Health & Lifestyle",
      };
    }
    return {
      questionNumber: Number(ss.section3Male ?? 0) + 1,
      questionTotal: HEALTH_MALE_STEPS,
      sectionLabel: "Section 3 of 4 — Health & Lifestyle",
    };
  }

  if (step === 4) {
    const scalp = ss.section4Scalp || "guide";
    const questionNumber = scalp === "upload" || scalp === "analyzing" ? 2 : 1;
    return {
      questionNumber,
      questionTotal: SCAN_STEPS,
      sectionLabel: "Section 4 of 4 — Scalp Scan",
    };
  }

  return {
    questionNumber: 1,
    questionTotal: 1,
    sectionLabel: `Section ${Math.min(Math.max(step, 1), 4)} of 4`,
  };
}

function QuizFlow() {
  const {
    state,
    nextStep,
    prevStep,
    goToStep,
    hydrateFromReport,
    restorePhotosFromIdb,
    setScalpImages,
    setError,
  } = useQuiz();
  const { step, aboutMe, isLoading } = state;
  const [reportBoot, setReportBoot] = useState(() => {
    if (typeof window === "undefined") return { status: "idle" };
    const id = new URLSearchParams(window.location.search).get("report");
    return id ? { status: "loading", reportId: id } : { status: "idle" };
  });

  useEffect(() => {
    if (reportBoot.status !== "loading" || !reportBoot.reportId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const idbImages = await loadScalpImagesFromIdb();
        const localHasPhotos =
          scalpImagesHaveData(state.scalpImages) || scalpImagesHaveData(idbImages);
        const localHasResult =
          state.step === 5 && Boolean(state.scalpAnalysis?.aiPredictedStage);

        // Returning from WP cart / same session: keep local Result + restore photos.
        // Do NOT overwrite with the archived JSON (archive strips image data URLs).
        if (localHasResult && localHasPhotos) {
          if (scalpImagesHaveData(idbImages) && setScalpImages) {
            setScalpImages(mergeScalpImages(idbImages, state.scalpImages));
          }
          if (cancelled) return;
          setReportBoot({ status: "ready", reportId: reportBoot.reportId });
          return;
        }

        const data = await fetchAssessmentReport(reportBoot.reportId);
        if (cancelled) return;

        hydrateFromReport(data, { preferLocalPhotos: true });
        // Extra pass in case hydrate raced before IDB resolved
        await restorePhotosFromIdb?.();
        if (cancelled) return;
        setReportBoot({ status: "ready", reportId: data.reportId });
      } catch (err) {
        if (cancelled) return;
        // Soft-fallback: if we still have a local result, show it instead of an error page
        if (state.step === 5 && state.scalpAnalysis) {
          await restorePhotosFromIdb?.();
          setReportBoot({ status: "ready", reportId: reportBoot.reportId });
          return;
        }
        setError(err?.message || "Could not open this assessment report.");
        setReportBoot({
          status: "error",
          reportId: reportBoot.reportId,
          message: err?.message || "Report not found.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally depend on reportBoot only — local state is read at effect start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportBoot.status, reportBoot.reportId, hydrateFromReport, restorePhotosFromIdb, setError]);

  const isMale = aboutMe?.gender === "male";

  let content;

  if (reportBoot.status === "loading") {
    content = (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xs text-center border border-gray-100 max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#064e3b] border-gray-100 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-gray-900">Opening your report</h3>
        <p className="text-xs text-gray-400 mt-2">Loading assessment {reportBoot.reportId}…</p>
      </div>
    );
  } else if (reportBoot.status === "error") {
    content = (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xs text-center border border-gray-100 max-w-md mx-auto my-12">
        <h3 className="text-lg font-bold text-gray-900">Report unavailable</h3>
        <p className="text-sm text-gray-500 mt-2">{reportBoot.message}</p>
        <button
          type="button"
          className="mt-6 px-5 py-2.5 rounded-full bg-[#064e3b] text-white text-sm font-semibold"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete("report");
            window.history.replaceState({}, "", url);
            setReportBoot({ status: "idle" });
            goToStep(0);
          }}
        >
          Start a new assessment
        </button>
      </div>
    );
  } else if (isLoading && step === 5) {
    content = (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl shadow-xs text-center border border-gray-100 max-w-md mx-auto my-12 animate-[fadeIn_0.2s_ease-out]">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#064e3b] border-gray-100 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-gray-900">Processing Scalp Metrics</h3>
        <p className="text-xs text-gray-400 mt-2">Our computer vision system is calculating density variations and mapping root coverage fields...</p>
      </div>
    );
  } else {
    switch (step) {
      case 0:
        content = <Home onStart={() => goToStep(0.5)} />;
        break;
      case 0.5:
        content = <Section0Consent onComplete={() => goToStep(1)} onBack={() => goToStep(0)} />;
        break;
      case 1:
        content = <Section1AboutMe onComplete={nextStep} onBack={() => goToStep(0.5)} />;
        break;
      case 2:
        if (aboutMe?.gender === "female") {
          content = <Section2Female onComplete={nextStep} onBack={prevStep} />;
        } else {
          content = <Section2Male onComplete={nextStep} onBack={prevStep} />;
        }
        break;
      case 3:
        content = isMale ? (
          <Section3Male onComplete={nextStep} onBack={prevStep} />
        ) : (
          <Section3Female onComplete={nextStep} onBack={prevStep} />
        );
        break;
      case 4:
        content = <Section4Scalp onComplete={nextStep} onBack={prevStep} />;
        break;
      case 5:
        content = <Result />;
        break;
      default:
        content = <Home onStart={() => goToStep(0.5)} />;
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f6f0] text-gray-900 px-4 md:px-8 pb-16 antialiased">
      <header className="max-w-6xl mx-auto flex items-center justify-between py-5 border-b border-gray-200/60 mb-8">
        <div
          className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
          onClick={() => window.location.reload()}
        >
          <div className="w-8 h-8 rounded-full bg-[#064e3b] flex items-center justify-center text-white text-xs font-serif shadow-sm">✦</div>
          <span className="text-xl font-bold tracking-tight text-[#064e3b] font-serif">Zylk Health</span>
        </div>
      </header>

      {step >= 1 && step <= 4 && reportBoot.status !== "loading" && reportBoot.status !== "error" && (
        <div className="max-w-2xl mx-auto mb-8">
          <ProgressBar step={step} {...getQuizProgressMeta(state)} />
        </div>
      )}

      <main className={`mx-auto flex justify-center items-start ${step === 0 ? "max-w-6xl" : "max-w-4xl"}`}>
        <div className="w-full">{content}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <QuizProvider>
        <QuizFlow />
        <CartDrawer />
      </QuizProvider>
    </CartProvider>
  );
}
