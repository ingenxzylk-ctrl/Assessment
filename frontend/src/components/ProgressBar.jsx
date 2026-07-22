export default function ProgressBar({
  step = 1,
  questionNumber = 1,
  questionTotal = 1,
  sectionLabel,
}) {
  const steps = [
    { number: 1, label: "ABOUT YOU" },
    { number: 2, label: "HAIR" },
    { number: 3, label: "HEALTH" },
    { number: 4, label: "SCAN" },
  ];

  const currentStep = Math.min(Math.max(Number(step) || 1, 1), 4);
  const qNum = Math.min(Math.max(Number(questionNumber) || 1, 1), Math.max(Number(questionTotal) || 1, 1));
  const qTotal = Math.max(Number(questionTotal) || 1, 1);

  // Fill by completed sections + progress within the active section
  const progressPercentage = Math.min(
    100,
    Math.max(0, ((currentStep - 1) + qNum / qTotal) / 4) * 100
  );

  const resolvedSectionLabel = sectionLabel || `Section ${currentStep} of 4`;

  return (
    <div className="w-full max-w-2xl mx-auto px-1 sm:px-2 select-none">
      {/* Stepper */}
      <div className="relative flex justify-between items-start mb-5">
        {/* Dashed connectors between circles */}
        <div
          className="absolute top-4 left-[12%] right-[12%] border-t-2 border-dashed border-gray-300/90 pointer-events-none"
          aria-hidden
        />

        {steps.map((item) => {
          const isActive = currentStep === item.number;
          const isPast = currentStep > item.number;

          return (
            <div key={item.number} className="relative z-10 flex flex-col items-center flex-1">
              <div className="relative">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                    isActive
                      ? "bg-[#064e3b] text-white shadow-sm"
                      : isPast
                        ? "bg-white text-[#064e3b] border-2 border-[#064e3b]"
                        : "bg-white text-gray-400 border-2 border-gray-300",
                  ].join(" ")}
                >
                  {item.number}
                </div>

                {isPast && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#064e3b] text-white flex items-center justify-center shadow-sm"
                    aria-hidden
                  >
                    <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M2.5 6.2 4.8 8.5 9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </div>

              <span
                className={[
                  "text-[10px] sm:text-[11px] mt-2.5 tracking-[0.06em] uppercase text-center leading-tight px-0.5",
                  isActive || isPast ? "text-[#064e3b] font-bold" : "text-gray-400 font-medium",
                ].join(" ")}
              >
                {item.label}
              </span>

              {isActive && (
                <span className="mt-1.5 h-0.5 w-10 rounded-full bg-[#064e3b]" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress track */}
      <div className="h-1.5 bg-gray-200/90 rounded-full w-full overflow-hidden mb-3">
        <div
          className="h-full bg-[#064e3b] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Section / Question meta */}
      <div className="flex items-center justify-between gap-3 text-[12px] sm:text-[13px] text-gray-600 font-medium">
        <div className="inline-flex items-center gap-1.5 min-w-0">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 19V9M10 19V5M16 19v-6M22 19V8" strokeLinecap="round" />
          </svg>
          <span className="truncate">{resolvedSectionLabel}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 4h9a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" strokeLinejoin="round" />
            <path d="M10 9h6M10 13h6" strokeLinecap="round" />
          </svg>
          <span>
            Question {qNum} of {qTotal}
          </span>
        </div>
      </div>
    </div>
  );
}
