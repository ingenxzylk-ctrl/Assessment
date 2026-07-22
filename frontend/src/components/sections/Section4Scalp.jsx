import { useCallback, useRef, useState, useEffect } from "react";
import { useQuiz } from "../../context/QuizContext";
import { useSectionStep } from "../../hooks/useSectionStep";
import { compressImage } from "../../utils/compressImage";

const MALE_GUIDES = [
  {
    type: "front",
    label: "1. Front Area",
    desc: "Capture your full front hairline clearly from a direct forward perspective.",
    img: "/stages/front.png",
  },
  {
    type: "top",
    label: "2. Top Area",
    desc: "Tilt your head downward to expose your complete crown area view.",
    img: "/stages/top.png",
  },
];

const FEMALE_GUIDES = [
  {
    type: "front",
    label: "1. Front View",
    desc: "Face the camera directly. Pull hair back so your front hairline is visible.",
    img: "/guild/front.png",
  },
  {
    type: "side",
    label: "2. Side View (Ponytail)",
    desc: "Put hair in a ponytail. Turn head to show side profile — ear, temple, and side scalp visible.",
    img: "/guild/side.png",
  },
  {
    type: "back",
    label: "3. Back View (Ponytail Aside)",
    desc: "Keep ponytail and sweep it over one shoulder to the side. Tilt head so crown and back part-line show.",
    img: "/guild/back.png",
  },
];

const PHOTO_QUALITY_TIPS = [
  { label: "Dry hair", detail: "Avoid wet or freshly washed hair" },
  { label: "Good lighting", detail: "Face a window or bright light" },
  { label: "No hat", detail: "Remove hats, hoods, or coverings" },
  { label: "No filters", detail: "Turn off beauty filters / apps" },
];

function formatRejectionMessage(err) {
  const reasons = Array.isArray(err?.rejectionReasons) ? err.rejectionReasons.filter(Boolean) : [];
  if (reasons.length) {
    return `Photo rejected for AI processing — ${reasons.join("; ")}. Please retake clear, well-lit scalp photos without hats or filters.`;
  }
  return `${err?.message || "Invalid image."} Please upload clear photos of your own hair/scalp.`;
}

function buildImagesFromSaved(savedImages = []) {
  const map = { front: null, top: null, side: null, back: null };
  savedImages.forEach((img) => {
    if (img?.type && img?.dataUrl) map[img.type] = img.dataUrl;
  });
  return map;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#064e3b]" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" strokeLinecap="round" />
    </svg>
  );
}

function PhotoSlot({ title, hint, preview, onAdd, onRemove }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-4 flex flex-col text-center h-full">
      <p className="text-[11px] sm:text-xs font-bold tracking-[0.08em] text-gray-800 uppercase mb-3">
        {title}
      </p>
      {preview ? (
        <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-gray-50 border border-gray-100 mb-3">
          <img src={preview} alt={title} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onAdd}
            className="absolute top-2 right-2 bg-white/95 text-gray-700 text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm border border-gray-200 hover:bg-white cursor-pointer"
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="w-full aspect-[4/5] rounded-xl border-2 border-dashed border-gray-300 bg-[#f7f8f6] flex flex-col items-center justify-center gap-2 mb-3 cursor-pointer hover:border-[#064e3b]/40 hover:bg-[#f0f4ef] transition-colors"
        >
          <PhoneIcon />
          <span className="text-sm font-semibold text-gray-600">Add photo</span>
        </button>
      )}
      <p className="text-[11px] sm:text-xs text-gray-500 leading-snug px-1 mt-auto">{hint}</p>
    </div>
  );
}

export default function Section4ScalpAssessment({ onComplete, onBack }) {
  const { state, setScalpImages, setScalpAnalysis, setLoading } = useQuiz();

  const isFemale = state?.aboutMe?.gender === "female";
  const guideOptions = isFemale ? FEMALE_GUIDES : MALE_GUIDES;

  const [step, setStep] = useSectionStep("section4Scalp", "upload", "guide");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [activeCaptureType, setActiveCaptureType] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("Preparing images...");

  const [images, setImages] = useState(() => buildImagesFromSaved(state?.scalpImages));

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Keep local upload previews in sync when quiz state restores photos (e.g. cart return)
  useEffect(() => {
    const restored = buildImagesFromSaved(state?.scalpImages);
    const hasRestored = Object.values(restored).some(Boolean);
    if (!hasRestored) return;
    setImages((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(restored)) {
        if (restored[key] && !prev[key]) {
          next[key] = restored[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [state?.scalpImages]);

  // Legacy cache may still have section4Scalp === "analyzing" — never restore that screen
  useEffect(() => {
    if (step === "analyzing") {
      setStep("upload");
      if (setLoading) setLoading(false);
    }
  }, [step, setStep, setLoading]);

  useEffect(() => {
    if (useCamera) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: 480, height: 640 } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        })
        .catch(() => {
          setError("Could not access camera. Please upload a photo file instead.");
          setUseCamera(false);
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useCamera]);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;

        let targetType = activeCaptureType;
        if (!targetType) {
          if (!images.front) targetType = "front";
          else if (isFemale && !images.side) targetType = "side";
          else if (isFemale && !images.back) targetType = "back";
          else if (!isFemale && !images.top) targetType = "top";
        }

        if (targetType) {
          setImages((prev) => ({ ...prev, [targetType]: dataUrl }));
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [images, activeCaptureType, isFemale]
  );

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 480;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    const screenshot = canvas.toDataURL("image/jpeg");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    let target = activeCaptureType;
    if (!target) {
      if (!images.front) target = "front";
      else if (isFemale && !images.side) target = "side";
      else if (isFemale && !images.back) target = "back";
      else if (!isFemale && !images.top) target = "top";
    }

    if (target) {
      setImages((prev) => ({ ...prev, [target]: screenshot }));
    }
    setUseCamera(false);
  }, [images, activeCaptureType, isFemale]);

  const removeImage = (type) => {
    setError(null);
    setImages((prev) => ({ ...prev, [type]: null }));
  };

  const handleTriggerAnalysis = async () => {
    if (isFemale && (!images.front || !images.side || !images.back)) {
      setError("Please provide Front, Side (ponytail), and Back (ponytail aside) images.");
      return;
    }
    if (!isFemale && (!images.front || !images.top)) {
      setError("Please provide Front and Top images to proceed.");
      return;
    }
    await runAnalysis();
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    // Keep persisted step on upload so Back from Result never restores analyzing
    setStep("upload");
    setError(null);
    setAnalysisStatus("Compressing photos...");
    if (setLoading) setLoading(true);

    const timeoutId = setTimeout(() => {
      setError("Analysis is taking longer than expected. Please check your connection and try again.");
      setIsAnalyzing(false);
      setStep("upload");
      if (setLoading) setLoading(false);
    }, 180000);

    try {
      const { analyzeScalp } = await import("../../api/quizApi");

           const rawPayloads = isFemale
        ? [
            { type: "front", label: "front", dataUrl: images.front },
            { type: "side", label: "side", dataUrl: images.side },
            { type: "back", label: "back", dataUrl: images.back },
          ]
        : [
            { type: "front", label: "front", dataUrl: images.front },
            { type: "top", label: "top", dataUrl: images.top },
          ];

      const imagePayloads = await Promise.all(
        rawPayloads.map(async (img) => ({
          ...img,
          dataUrl: await compressImage(img.dataUrl, 1280, 0.88),
        }))
      );

      setAnalysisStatus("Uploading & running AI analysis (20–60 sec)...");
      const aiResponse = await analyzeScalp({
        gender: state?.aboutMe?.gender || "male",
        selfReportedStage: isFemale
          ? state?.hairHealth?.hair_fall_zone || "1"
          : state?.hairHealth?.norwood_stage || "1",
        images: imagePayloads,
      });

      clearTimeout(timeoutId);

      setScalpAnalysis(aiResponse);
      setScalpImages(imagePayloads);
      setIsAnalyzing(false);
      setStep("upload");
      if (setLoading) setLoading(false);
      if (onComplete) onComplete(aiResponse);
    } catch (err) {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
      if (setLoading) setLoading(false);
      console.error("AI diagnostics pipeline failed:", err);

      if (err.imageRejected) {
        setError(formatRejectionMessage(err));
      } else {
        setError("AI analysis failed: " + (err.message || "Server unreachable. Please try again."));
      }
      setStep("upload");
    }
  };

  const handleBackNavigation = () => {
    if (isAnalyzing) {
      // Don't cancel mid-flight via back; keep user on analyzing until done/error
      return;
    }
    if (step === "upload") {
      setStep("guide");
    } else if (onBack) {
      onBack();
    }
  };

  if (isAnalyzing) {
    return (
      <div className="max-w-xl mx-auto mt-6 px-4">
        <div className="bg-white rounded-[32px] p-12 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-[#e8eede]" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#064e3b] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🔬</div>
          </div>
          <div>
            <h3 className="font-bold text-xl text-gray-900">Analyzing Your Scalp Photos</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              {analysisStatus}
            </p>
            <p className="text-xs text-gray-400 mt-3">
              This usually takes 20–60 seconds. Please don't close the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === "guide") {
    return (
      <div className={`mx-auto mt-6 px-4 ${isFemale ? "max-w-4xl" : "max-w-xl"}`}>
        <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="mb-6 text-center">
            <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
              SCALP SCAN (1/2)
            </span>
            <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">
              {isFemale ? "Take clear scalp photos" : "Take two clear scalp photos"}
            </h2>
            <p className="text-gray-500 mt-2 text-base">
              {isFemale
                ? "Upload 3 photos: front, ponytail side profile, and ponytail swept aside. Clear photos are required for AI processing."
                : "Your photos help us assess visible thinning patterns. They are encrypted and used only for your assessment."}
            </p>
          </div>

          {isFemale && (
            <div className="mb-6 p-4 bg-[#f4f6f0] border border-[#064e3b]/10 rounded-2xl text-sm text-[#064e3b]">
              <strong>Ponytail method:</strong> Side view = ponytail + turn head sideways. Back view = ponytail pulled over one shoulder to expose crown/part-line.
            </div>
          )}

          <div className={`grid gap-4 mb-6 ${isFemale ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            {guideOptions.map((opt, index) => (
              <div
                key={index}
                className={`rounded-2xl border border-gray-200 bg-white p-4 text-center flex flex-col items-center justify-between shadow-2xs ${
                  isFemale && index === 2 ? "col-span-2 sm:col-span-1 max-w-xs mx-auto sm:max-w-none w-full" : ""
                }`}
              >
                <div className="w-full flex flex-col items-center">
                  <span className="text-xl block mb-1">📸</span>
                  <p className="text-sm font-bold text-gray-900 uppercase tracking-wide">{opt.label}</p>
                  <div className="w-full h-44 my-3 rounded-xl flex items-center justify-center bg-white relative p-1">
                    <img
                      src={opt.img}
                      alt={opt.label}
                      className="w-full h-full object-contain rounded-xl"
                      onError={(e) => {
                        e.target.src =
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80";
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 font-medium leading-relaxed px-1 mt-1">{opt.desc}</p>
              </div>
            ))}
          </div>

          <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PHOTO_QUALITY_TIPS.map((tip) => (
              <div
                key={tip.label}
                className="rounded-xl bg-[#f4f6f0] border border-[#064e3b]/10 px-3 py-2.5 text-center"
              >
                <p className="text-xs font-bold text-[#064e3b] flex items-center justify-center gap-1">
                  <span aria-hidden>✓</span> {tip.label}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{tip.detail}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-[11px] text-gray-400 mb-6">
            Encrypted · Used only for your assessment · Delete anytime
          </p>

          <div className="flex gap-4 max-w-md mx-auto">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="flex-1 h-14 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep("upload")}
              className="flex-[2] h-14 bg-[#064e3b] text-white rounded-xl font-semibold hover:bg-[#043427] transition-all shadow-sm text-base cursor-pointer"
            >
              Got It — Open Scanner
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto mt-6 px-4 ${isFemale ? "max-w-3xl" : "max-w-xl"}`}>
      <div className="bg-white rounded-[32px] p-6 sm:p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="mb-6 text-center">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            SCALP SCAN (2/2)
          </span>
          <h2 className="text-[26px] sm:text-[28px] font-bold text-gray-900 mt-4 leading-tight">
            Add your scalp photos
          </h2>
          <p className="text-gray-500 mt-2 text-sm sm:text-base max-w-md mx-auto">
            {isFemale
              ? "Use three clear photos so we can assess visible hair-loss patterns."
              : "Use two clear photos so we can assess visible hair-loss patterns."}
          </p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-medium rounded-2xl mb-5">
            {error}
          </div>
        )}

        {useCamera ? (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-w-sm mx-auto shadow-md mb-6">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-72 border-2 border-dashed border-white/70 rounded-[50%] shadow-[0_0_0_400px_rgba(0,0,0,0.4)]" />
            </div>
            <p className="absolute top-4 inset-x-0 text-center text-white text-xs font-medium">
              {activeCaptureType
                ? `Capturing ${activeCaptureType} view`
                : "Point camera at your scalp"}
            </p>
            <button
              type="button"
              onClick={captureFromCamera}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-[#064e3b] shadow-xl hover:scale-105 transition-transform cursor-pointer"
              aria-label="Capture photo"
            />
            <button
              type="button"
              onClick={() => setUseCamera(false)}
              className="absolute top-3 right-3 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div
              className={`grid gap-3 sm:gap-4 mb-6 ${
                isFemale ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              <PhotoSlot
                title="Front Hairline"
                hint="Show your full hairline in good lighting."
                preview={images.front}
                onAdd={() => {
                  setActiveCaptureType("front");
                  fileInputRef.current?.click();
                }}
                onRemove={() => removeImage("front")}
              />

              {isFemale ? (
                <>
                  <PhotoSlot
                    title="Side (Ponytail)"
                    hint="Ponytail profile — ear, temple, and side scalp visible."
                    preview={images.side}
                    onAdd={() => {
                      setActiveCaptureType("side");
                      fileInputRef.current?.click();
                    }}
                    onRemove={() => removeImage("side")}
                  />
                  <PhotoSlot
                    title="Back / Crown"
                    hint="Sweep ponytail aside so crown and part-line show."
                    preview={images.back}
                    onAdd={() => {
                      setActiveCaptureType("back");
                      fileInputRef.current?.click();
                    }}
                    onRemove={() => removeImage("back")}
                  />
                </>
              ) : (
                <PhotoSlot
                  title="Crown / Top"
                  hint="Tilt your head forward so the full crown is visible."
                  preview={images.top}
                  onAdd={() => {
                    setActiveCaptureType("top");
                    fileInputRef.current?.click();
                  }}
                  onRemove={() => removeImage("top")}
                />
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  let nextType = "front";
                  if (!images.front) nextType = "front";
                  else if (isFemale && !images.side) nextType = "side";
                  else if (isFemale && !images.back) nextType = "back";
                  else if (!isFemale && !images.top) nextType = "top";
                  else nextType = "front";
                  setActiveCaptureType(nextType);
                  setUseCamera(false);
                  fileInputRef.current?.click();
                }}
                className="h-12 w-full px-5 bg-[#064e3b] text-white font-semibold rounded-full hover:bg-[#043427] transition-all text-sm shadow-sm cursor-pointer"
              >
                Upload from device
              </button>
              <button
                type="button"
                onClick={() => {
                  let nextType = "front";
                  if (!images.front) nextType = "front";
                  else if (isFemale && !images.side) nextType = "side";
                  else if (isFemale && !images.back) nextType = "back";
                  else if (!isFemale && !images.top) nextType = "top";
                  setActiveCaptureType(nextType);
                  setUseCamera(true);
                }}
                className="h-12 w-full px-5 bg-[#111827] text-white font-semibold rounded-full hover:bg-black transition-all text-sm shadow-sm cursor-pointer"
              >
                Use camera
              </button>
            </div>

            <p className="text-center text-[11px] text-[#064e3b] bg-[#e8eede]/70 rounded-full py-2 px-3 mb-2">
              Encrypted · Used only for your assessment · Delete anytime
            </p>
          </>
        )}

        <div className="pt-4 border-t border-gray-100 flex items-center gap-3 sm:gap-4 w-full mt-4">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="flex-1 h-14 border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            disabled={
              isFemale
                ? !images.front || !images.side || !images.back
                : !images.front || !images.top
            }
            onClick={handleTriggerAnalysis}
            className="flex-[2] h-14 bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all text-sm sm:text-base disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer px-3"
          >
            {isFemale
              ? images.front && images.side && images.back
                ? "Create My Assessment"
                : "Continue after adding all photos"
              : images.front && images.top
                ? "Create My Assessment"
                : "Continue after adding both photos"}
          </button>
        </div>
      </div>
    </div>
  );
}