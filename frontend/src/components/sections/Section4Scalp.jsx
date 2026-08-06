import { useCallback, useRef, useState, useEffect } from "react";
import { useQuiz } from "../../context/QuizContext";
import { compressImage } from "../../utils/compressImage";
import { precheckPhotoQuality } from "../../utils/photoQualityPrecheck";

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
    desc: "Face camera directly. Pull hair back so hairline is visible.",
    img: "/guild/front.png",
  },
  {
    type: "side",
    label: "2. Side View (Ponytail)",
    desc: "Put hair in ponytail. Turn to show side profile — ear and temple visible.",
    img: "/guild/side.png",
  },
  {
    type: "back",
    label: "3. Back View (Ponytail Aside)",
    desc: "Sweep ponytail over one shoulder. Tilt head to show crown/part-line.",
    img: "/guild/back.png",
  },
];

const PHOTO_QUALITY_TIPS = [
  { label: "Dry hair", detail: "Avoid wet/washed hair", key: "wetHair" },
  { label: "Good lighting", detail: "Face a window or bright light", key: "insufficientLight" },
  { label: "No hat", detail: "Remove hats or coverings", key: "hatOrCovering" },
  { label: "No filters", detail: "Turn off beauty apps", key: "filtersApplied" },
];

function formatRejectionMessage(err) {
  const reasons = Array.isArray(err?.rejectionReasons) ? err.rejectionReasons.filter(Boolean) : [];
  if (reasons.length) {
    return `Please upload a proper image. ${reasons.join("; ")}. Photos must be clear with dry hair, good lighting, no hat, and no filters.`;
  }
  return "Please upload a proper image: clear, well-lit scalp photos with dry hair, no hat, and no filters.";
}

function imageFingerprint(dataUrl) {
  const s = String(dataUrl || "");
  if (!s) return "";
  const mid = Math.floor(s.length / 2);
  return `${s.length}:${s.slice(22, 86)}:${s.slice(mid, mid + 64)}:${s.slice(-48)}`;
}

function detectDuplicateUploads(images, isFemale) {
  const slots = isFemale
    ? [
        ["front", images.front],
        ["side", images.side],
        ["back", images.back],
      ]
    : [
        ["front", images.front],
        ["top", images.top],
      ];
  const present = slots.filter(([, url]) => Boolean(url));
  if (present.length < 2) return { allSame: false, message: null };

  const prints = present.map(([, url]) => imageFingerprint(url));
  const allSame = prints.every((p) => p && p === prints[0]);
  if (!allSame) return { allSame: false, message: null };

  return {
    allSame: true,
    message:
      "You have uploaded the same image for multiple angles. Please upload a distinct photo for each view for an accurate assessment.",
  };
}

function PhotoQualityTips({ failedKeys = [] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
      {PHOTO_QUALITY_TIPS.map((tip) => {
        const failed = failedKeys.includes(tip.key);
        return (
          <div
            key={tip.label}
            className={`rounded-xl border px-3 py-2 text-center flex flex-col items-center justify-center transition-all ${
              failed ? "bg-red-50 border-red-200 shadow-xs" : "bg-[#f8faf7] border-[#064e3b]/10 hover:border-[#064e3b]/30"
            }`}
          >
            <p className={`text-xs font-bold flex items-center gap-1 ${failed ? "text-red-700" : "text-[#064e3b]"}`}>
              <span>{failed ? "✕" : "✓"}</span> {tip.label}
            </p>
            <p className={`text-[10px] mt-0.5 leading-tight ${failed ? "text-red-600" : "text-gray-500"}`}>
              {tip.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
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
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#064e3b]" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M11 18.5h2" strokeLinecap="round" />
    </svg>
  );
}

function PhotoSlot({ title, hint, preview, onAdd, onRemove }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 flex flex-col text-center h-full shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold tracking-wider text-gray-800 uppercase">{title}</span>
        {preview && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Uploaded
          </span>
        )}
      </div>

      {preview ? (
        <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 mb-3 group">
          <img src={preview} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onRemove) onRemove();
            }}
            className="absolute top-2.5 right-2.5 bg-white/95 text-red-600 text-[11px] font-semibold px-3 py-1 rounded-full shadow-md border border-red-100 hover:bg-red-50 cursor-pointer transition-colors"
          >
            Change / Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="w-full aspect-[4/5] rounded-xl border-2 border-dashed border-gray-300 bg-[#fafbf9] flex flex-col items-center justify-center gap-2.5 mb-3 cursor-pointer hover:border-[#064e3b] hover:bg-[#f0f4ef] transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-[#e8eede] flex items-center justify-center group-hover:scale-110 transition-transform">
            <PhoneIcon />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-700 block">Add photo</span>
            <span className="text-[10px] text-gray-400">Click to browse or snap</span>
          </div>
        </button>
      )}
      <p className="text-[11px] text-gray-500 leading-snug mt-auto">{hint}</p>
    </div>
  );
}

export default function Section4ScalpAssessment({ onComplete, onBack }) {
  const { state, setScalpImages, setScalpAnalysis, setLoading } = useQuiz();

  const isFemale = state?.aboutMe?.gender === "female";
  const guideOptions = isFemale ? FEMALE_GUIDES : MALE_GUIDES;

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [failedQualityKeys, setFailedQualityKeys] = useState([]);
  const [useCamera, setUseCamera] = useState(false);
  const [activeCaptureType, setActiveCaptureType] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("Preparing images...");
  const [duplicateImageWarning, setDuplicateImageWarning] = useState(null);
  const [showGuidesModal, setShowGuidesModal] = useState(false);

  const [images, setImages] = useState(() => buildImagesFromSaved(state?.scalpImages));

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    if (useCamera) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: 720, height: 960 } })
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

  const acceptPhoto = useCallback(async (dataUrl, targetType) => {
    if (!targetType || !dataUrl) return;
    setError(null);
    setFailedQualityKeys([]);

    const check = await precheckPhotoQuality(dataUrl);
    if (!check.ok) {
      setFailedQualityKeys(["wetHair", "insufficientLight", "hatOrCovering", "filtersApplied"]);
      setError(check.message || "Please upload a clear, well-lit photo.");
      return;
    }

    setImages((prev) => ({ ...prev, [targetType]: dataUrl }));
    setDuplicateImageWarning(null);
  }, []);

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
        await acceptPhoto(dataUrl, targetType);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [images, activeCaptureType, isFemale, acceptPhoto]
  );

  const captureFromCamera = useCallback(async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    const width = videoRef.current.videoWidth || 720;
    const height = videoRef.current.videoHeight || 960;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, width, height);

    const screenshot = canvas.toDataURL("image/jpeg", 0.9);

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

    setUseCamera(false);
    await acceptPhoto(screenshot, target);
  }, [images, activeCaptureType, isFemale, acceptPhoto]);

  const removeImage = (type) => {
    setError(null);
    setFailedQualityKeys([]);
    setDuplicateImageWarning(null);
    setImages((prev) => {
      const next = { ...prev, [type]: null };
      if (setScalpImages) {
        const payloads = Object.entries(next)
          .filter(([, dataUrl]) => Boolean(dataUrl))
          .map(([t, dataUrl]) => ({ type: t, label: t, dataUrl }));
        setScalpImages(payloads);
      }
      return next;
    });
  };

  const photosComplete = isFemale
    ? Boolean(images.front && images.side && images.back)
    : Boolean(images.front && images.top);

  useEffect(() => {
    if (!photosComplete) {
      setDuplicateImageWarning(null);
      return;
    }
    const dup = detectDuplicateUploads(images, isFemale);
    setDuplicateImageWarning(dup.allSame ? dup.message : null);
  }, [images, isFemale, photosComplete]);

  const handleTriggerAnalysis = async () => {
    if (isFemale && (!images.front || !images.side || !images.back)) {
      setError("Please provide Front, Side, and Back images.");
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
    setError(null);
    setAnalysisStatus("Compressing photos...");
    if (setLoading) setLoading(true);

    const timeoutId = setTimeout(() => {
      setError("Analysis is taking longer than expected. Please try again.");
      setIsAnalyzing(false);
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

      setAnalysisStatus("Running AI diagnostics (20–60 sec)...");
      const aiResponse = await analyzeScalp({
        gender: state?.aboutMe?.gender || "male",
        selfReportedStage: isFemale
          ? state?.hairHealth?.hair_fall_zone || "1"
          : state?.hairHealth?.norwood_stage || "1",
        images: imagePayloads,
      });

      clearTimeout(timeoutId);

      const dup = detectDuplicateUploads(images, isFemale);
      const analysisPayload = dup.allSame
        ? {
            ...aiResponse,
            duplicateImagesDetected: true,
            duplicateImagesWarning: dup.message,
          }
        : aiResponse;

      setScalpAnalysis(analysisPayload);
      setScalpImages(imagePayloads);
      setIsAnalyzing(false);
      if (setLoading) setLoading(false);
      if (onComplete) onComplete(analysisPayload);
    } catch (err) {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
      if (setLoading) setLoading(false);

      if (err.imageRejected) {
        const checks = err.qualityChecks || err.photoQualityAssessment?.qualityChecks || {};
        const keys = Object.entries(checks)
          .filter(([, failed]) => Boolean(failed))
          .map(([key]) => key);
        setFailedQualityKeys(keys.length ? keys : ["wetHair", "insufficientLight", "hatOrCovering", "filtersApplied"]);
        setError(formatRejectionMessage(err));
      } else {
        setFailedQualityKeys([]);
        setError("AI analysis failed: " + (err.message || "Server unreachable. Please try again."));
      }
    }
  };

  if (isAnalyzing) {
    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white rounded-[32px] p-10 shadow-xl border border-gray-100 text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-[#e8eede]" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#064e3b] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🔬</div>
          </div>
          <div>
            <h3 className="font-bold text-xl text-gray-900">Analyzing Your Scalp Photos</h3>
            <p className="text-sm text-gray-500 mt-2">{analysisStatus}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-6 px-4 pb-16">
      <div className="bg-white rounded-[32px] p-6 sm:p-10 shadow-[0_4px_30px_rgba(0,0,0,0.05)] border border-gray-100">
        
        {/* Header Section - Fixed Mobile Alignment & Spacing */}
        <div className="flex flex-col items-start md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-gray-100">
          <div className="w-full md:w-auto">
            <span className="inline-block text-[11px] sm:text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full mb-3">
              AI Scalp Assessment
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight leading-tight">
              Upload & Scan Your Scalp
            </h2>
            <p className="text-gray-500 text-sm mt-1.5 leading-normal">
              {isFemale ? "Provide 3 angles for accurate AI diagnostic evaluation." : "Provide 2 angles for accurate AI diagnostic evaluation."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuidesModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#064e3b] bg-[#f4f6f0] hover:bg-[#e8eede] px-4 py-3 sm:py-2.5 rounded-xl transition-colors cursor-pointer border border-[#064e3b]/10 shrink-0"
          >
            <span>💡 View Photo Guidelines</span>
          </button>
        </div>

        {/* Quality Check Banner Tips */}
        <div className="mb-6">
          <PhotoQualityTips failedKeys={failedQualityKeys} />
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-medium rounded-2xl mb-6 flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div>{error}</div>
          </div>
        )}

        {duplicateImageWarning && (
          <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 text-sm font-medium">
            {duplicateImageWarning}
          </div>
        )}

        {/* Camera Overlay View / Upload Grid */}
        {useCamera ? (
          <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] max-w-md mx-auto shadow-2xl mb-8">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-60 h-80 border-2 border-dashed border-white/80 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
            <p className="absolute top-4 inset-x-0 text-center text-white text-xs font-medium px-4 bg-black/30 py-1">
              {activeCaptureType ? `Capturing: ${activeCaptureType.toUpperCase()} view` : "Align scalp inside guide"}
            </p>
            <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-4 px-6">
              <button
                type="button"
                onClick={() => setUseCamera(false)}
                className="bg-white/20 hover:bg-white/30 text-white text-xs px-4 py-2.5 rounded-full backdrop-blur-md cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={captureFromCamera}
                className="w-16 h-16 bg-white rounded-full border-4 border-[#064e3b] shadow-2xl hover:scale-105 transition-transform cursor-pointer"
                aria-label="Capture photo"
              />
            </div>
          </div>
        ) : (
          <>
            {/* Desktop & Mobile Responsive Grid for Upload Slots */}
            <div className={`grid gap-4 sm:gap-6 mb-8 ${isFemale ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              <PhotoSlot
                title="1. Front Hairline"
                hint="Direct forward view showing full hairline."
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
                    title="2. Side Profile"
                    hint="Hair in ponytail, turned sideways (ear/temple visible)."
                    preview={images.side}
                    onAdd={() => {
                      setActiveCaptureType("side");
                      fileInputRef.current?.click();
                    }}
                    onRemove={() => removeImage("side")}
                  />
                  <PhotoSlot
                    title="3. Crown / Back"
                    hint="Ponytail swept over shoulder, crown & part-line visible."
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
                  title="2. Crown / Top View"
                  hint="Head tilted slightly forward exposing top crown area."
                  preview={images.top}
                  onAdd={() => {
                    setActiveCaptureType("top");
                    fileInputRef.current?.click();
                  }}
                  onRemove={() => removeImage("top")}
                />
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            {/* Redesigned Full-Width Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-8">
              <button
                type="button"
                onClick={() => {
                  let nextType = "front";
                  if (!images.front) nextType = "front";
                  else if (isFemale && !images.side) nextType = "side";
                  else if (isFemale && !images.back) nextType = "back";
                  else if (!isFemale && !images.top) nextType = "top";
                  setActiveCaptureType(nextType);
                  setUseCamera(false);
                  fileInputRef.current?.click();
                }}
                className="w-full h-14 px-6 bg-[#064e3b] text-white font-semibold rounded-2xl hover:bg-[#043427] transition-all text-base shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>📁</span> Upload from Device
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
                className="w-full h-14 px-6 bg-[#111827] text-white font-semibold rounded-2xl hover:bg-black transition-all text-base shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>📸</span> Use Live Camera
              </button>
            </div>
          </>
        )}

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-32 h-14 border border-gray-200 text-gray-600 rounded-2xl font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer order-2 sm:order-1"
          >
            Back
          </button>
          <button
            type="button"
            disabled={!photosComplete}
            onClick={handleTriggerAnalysis}
            className="w-full sm:flex-1 h-14 bg-[#064e3b] text-white rounded-2xl font-semibold hover:bg-[#043427] transition-all text-sm sm:text-base disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md px-4 order-1 sm:order-2"
          >
            {photosComplete ? "Create My Assessment →" : "Add all required photos to continue"}
          </button>
        </div>
      </div>

      {/* Guidelines Modal popup */}
      {showGuidesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Photo Angle Reference Guide</h3>
              <button
                type="button"
                onClick={() => setShowGuidesModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm mb-6">Follow these visual examples to ensure high diagnostic precision.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {guideOptions.map((opt, idx) => (
                <div key={idx} className="bg-[#f8faf7] border border-gray-200/60 rounded-2xl p-3 text-center flex flex-col">
                  <span className="text-xs font-bold text-[#064e3b] uppercase mb-2">{opt.label}</span>
                  <div className="aspect-[3/4] bg-white rounded-xl overflow-hidden mb-2 border border-gray-100 flex items-center justify-center">
                    <img src={opt.img} alt={opt.label} className="w-full h-full object-contain p-1" />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-auto">{opt.desc}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowGuidesModal(false)}
              className="w-full h-12 bg-[#064e3b] text-white font-semibold rounded-xl hover:bg-[#043427] cursor-pointer"
            >
              Got it, back to scanner
            </button>
          </div>
        </div>
      )}
    </div>
  );
}