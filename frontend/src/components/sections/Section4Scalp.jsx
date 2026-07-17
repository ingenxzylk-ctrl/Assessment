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
    img: "/stages/female_front_guide.png",
  },
  {
    type: "side",
    label: "2. Side View (Ponytail)",
    desc: "Put hair in a ponytail. Turn head to show side profile — ear, temple, and side scalp visible.",
    img: "/stages/female_side_guide.png",
  },
  {
    type: "back",
    label: "3. Back View (Ponytail Aside)",
    desc: "Keep ponytail and sweep it over one shoulder to the side. Tilt head so crown and back part-line show.",
    img: "/stages/female_back_guide.png",
  },
];

function buildImagesFromSaved(savedImages = []) {
  const map = { front: null, top: null, side: null, back: null };
  savedImages.forEach((img) => {
    if (img?.type && img?.dataUrl) map[img.type] = img.dataUrl;
  });
  return map;
}

export default function Section4ScalpAssessment({ onComplete, onBack }) {
  const { state, setScalpImages, setScalpAnalysis, setLoading } = useQuiz();

  const isFemale = state?.aboutMe?.gender === "female";
  const guideOptions = isFemale ? FEMALE_GUIDES : MALE_GUIDES;

  const [step, setStep] = useSectionStep("section4Scalp", "upload", "guide");
  const [error, setError] = useState(null);
  const [useCamera, setUseCamera] = useState(false);
  const [activeCaptureType, setActiveCaptureType] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("Preparing images...");

  const [images, setImages] = useState(() => buildImagesFromSaved(state?.scalpImages));

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

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
    setStep("analyzing");
    await runAnalysis();
  };

  const runAnalysis = async () => {
    setStep("analyzing");
    setError(null);
    setAnalysisStatus("Compressing photos...");
    if (setLoading) setLoading(true);

    const timeoutId = setTimeout(() => {
      setError("Analysis is taking longer than expected. Please check your connection and try again.");
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
      if (setLoading) setLoading(false);
      if (onComplete) onComplete(aiResponse);
    } catch (err) {
      clearTimeout(timeoutId);
      if (setLoading) setLoading(false);
      console.error("AI diagnostics pipeline failed:", err);

      if (err.imageRejected) {
        setError(
          `⚠️ ${err.message || "Invalid image."} Please upload photos of your own hair/scalp. Ponytail side photos are accepted.`
        );
      } else {
        setError("AI analysis failed: " + (err.message || "Server unreachable. Please try again."));
      }
      setStep("upload");
    }
  };

  const handleBackNavigation = () => {
    if (step === "upload") {
      setStep("guide");
    } else if (step === "analyzing") {
      setStep("upload");
    } else if (onBack) {
      onBack();
    }
  };

  if (step === "guide") {
    return (
      <div className={`mx-auto mt-6 px-4 ${isFemale ? "max-w-4xl" : "max-w-xl"}`}>
        <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="mb-6 text-center">
            <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
              SCALP SCAN (1/2)
            </span>
            <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">Photo Guidelines</h2>
            <p className="text-gray-500 mt-2 text-base">
              {isFemale
                ? "Upload 3 photos: front, ponytail side profile, and ponytail swept aside."
                : "Upload 2 photos: front hairline and top/crown view."}
            </p>
          </div>

          {isFemale && (
            <div className="mb-6 p-4 bg-[#f4f6f0] border border-[#064e3b]/10 rounded-2xl text-sm text-[#064e3b]">
              <strong>Ponytail method:</strong> Side view = ponytail + turn head sideways. Back view = ponytail pulled over one shoulder to expose crown/part-line.
            </div>
          )}

          <div className={`grid gap-4 mb-8 ${isFemale ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
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

  if (step === "analyzing") {
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

  return (
    <div className={`mx-auto mt-6 px-4 ${isFemale ? "max-w-3xl" : "max-w-xl"}`}>
      <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
        <div className="mb-6 text-center">
          <span className="text-xs font-bold tracking-[0.1em] text-[#064e3b] uppercase bg-[#e8eede] px-3 py-1 rounded-full">
            SCALP SCAN (2/2)
          </span>
          <h2 className="text-[28px] font-bold text-gray-900 mt-4 leading-tight">Final Scalp Photo Selection</h2>
          <p className="text-gray-500 mt-2 text-base">Ensure clear snapshots are provided for all slots.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm font-medium rounded-2xl mb-5 flex gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {isFemale && (
          <p className="text-[11px] text-gray-500 text-center leading-relaxed px-2 mb-4">
            Side = ponytail profile. Back = ponytail swept to one side showing crown/part-line.
          </p>
        )}

        {useCamera ? (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] max-w-sm mx-auto shadow-md mb-6">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-72 border-2 border-dashed border-white/70 rounded-[50%] shadow-[0_0_0_400px_rgba(0,0,0,0.4)]" />
            </div>
            <button
              type="button"
              onClick={captureFromCamera}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full border-4 border-[#064e3b] shadow-xl hover:scale-105 transition-transform cursor-pointer"
            />
          </div>
        ) : (
          <div>
            <div className={`grid gap-4 mb-6 ${isFemale ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              <div className="rounded-2xl border border-gray-200 p-2.5 text-center flex flex-col items-center shadow-sm bg-white h-52 justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase">Front View</span>
                {images.front ? (
                  <div className="w-full h-36 rounded-xl overflow-hidden border border-gray-100 relative bg-gray-50 flex items-center justify-center">
                    <img src={images.front} alt="Front preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => removeImage("front")}
                      className="absolute top-1 right-1 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md hover:bg-red-600 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCaptureType("front");
                      fileInputRef.current?.click();
                    }}
                    className="w-full h-36 border border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-100/50"
                  >
                    <span className="text-lg opacity-40">📸</span>
                    <span className="text-[10px] text-gray-400 font-semibold px-1">Add Front</span>
                  </button>
                )}
              </div>

              {isFemale ? (
                <>
                  <div className="rounded-2xl border border-gray-200 p-2.5 text-center flex flex-col items-center shadow-sm bg-white h-52 justify-between">
                    <span className="text-xs font-bold text-gray-700 uppercase">Side (Ponytail)</span>
                    {images.side ? (
                      <div className="w-full h-36 rounded-xl overflow-hidden border border-gray-100 relative bg-gray-50 flex items-center justify-center">
                        <img src={images.side} alt="Side preview" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => removeImage("side")}
                          className="absolute top-1 right-1 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md hover:bg-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCaptureType("side");
                          fileInputRef.current?.click();
                        }}
                        className="w-full h-36 border border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-100/50"
                      >
                        <span className="text-lg opacity-40">📸</span>
                        <span className="text-[10px] text-gray-400 font-semibold px-1">Add Side</span>
                      </button>
                    )}
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-2.5 text-center flex flex-col items-center shadow-sm bg-white h-52 justify-between col-span-2 sm:col-span-1 max-w-xs mx-auto sm:max-w-none w-full">
                    <span className="text-xs font-bold text-gray-700 uppercase">Back (Ponytail Aside)</span>
                    {images.back ? (
                      <div className="w-full h-36 rounded-xl overflow-hidden border border-gray-100 relative bg-gray-50 flex items-center justify-center">
                        <img src={images.back} alt="Back preview" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => removeImage("back")}
                          className="absolute top-1 right-1 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md hover:bg-red-600 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCaptureType("back");
                          fileInputRef.current?.click();
                        }}
                        className="w-full h-36 border border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-100/50"
                      >
                        <span className="text-lg opacity-40">📸</span>
                        <span className="text-[10px] text-gray-400 font-semibold px-1">Add Back</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-gray-200 p-2.5 text-center flex flex-col items-center shadow-sm bg-white h-52 justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase">Top View</span>
                  {images.top ? (
                    <div className="w-full h-36 rounded-xl overflow-hidden border border-gray-100 relative bg-gray-50 flex items-center justify-center">
                      <img src={images.top} alt="Top preview" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeImage("top")}
                        className="absolute top-1 right-1 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md hover:bg-red-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCaptureType("top");
                        fileInputRef.current?.click();
                      }}
                      className="w-full h-36 border border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-100/50"
                    >
                      <span className="text-lg opacity-40">📸</span>
                      <span className="text-[10px] text-gray-400 font-semibold px-1">Add Top</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

            {((isFemale && (!images.front || !images.side || !images.back)) ||
              (!isFemale && (!images.front || !images.top))) && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
                <button
                  type="button"
                  onClick={() => {
                    // Fill the next empty slot (front → side/top → back)
                    let nextType = "front";
                    if (!images.front) nextType = "front";
                    else if (isFemale && !images.side) nextType = "side";
                    else if (isFemale && !images.back) nextType = "back";
                    else if (!isFemale && !images.top) nextType = "top";
                    setActiveCaptureType(nextType);
                    setUseCamera(false);
                    fileInputRef.current?.click();
                  }}
                  className="h-12 w-full sm:w-auto px-6 bg-[#064e3b] text-white font-semibold rounded-full hover:bg-[#043427] transition-all text-sm shadow-sm cursor-pointer"
                >
                  Upload Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCaptureType("");
                    setUseCamera(true);
                  }}
                  className="h-12 w-full sm:w-auto px-6 bg-gray-800 text-white font-semibold rounded-full hover:bg-gray-900 transition-all text-sm shadow-sm cursor-pointer"
                >
                  Use Live Camera Feed
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 flex items-center gap-4 w-full">
          <button
            type="button"
            onClick={handleBackNavigation}
            className="flex-1 h-14 border border-gray-200 text-gray-600 rounded-full font-semibold hover:bg-gray-50 transition-colors text-base cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            disabled={isFemale ? !images.front || !images.side || !images.back : !images.front || !images.top}
            onClick={handleTriggerAnalysis}
            className="flex-[2] h-14 bg-[#064e3b] text-white rounded-full font-semibold hover:bg-[#043427] transition-all text-base disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Proceed to AI Analysis
          </button>
        </div>
      </div>
    </div>
  );
}