import React from "react";

export default function ProgressBar({ step }) {
  const steps = [
    { number: 1, label: "You" },
    { number: 2, label: "Hair" },
    { number: 3, label: "Health" },
    { number: 4, label: "Scan" },
  ];

  // Force safety boundaries for calculations
  const currentStep = Math.min(Math.max(step, 1), 4);
  const progressPercentage = (currentStep / 4) * 100;

  return (
    <div className="w-full max-w-xl mx-auto px-4 select-none">
      
      {/* 1. Top Section: Stepper Nodes with Text Labels */}
      <div className="relative flex justify-between items-center mb-6">
        
        {/* ✅ Horizontal gray line centered exactly between the middle of nodes (12.5% step offsets) */}
        <div className="absolute top-4 left-[12.5%] right-[12.5%] h-[2px] bg-gray-200/80 -z-10" />

        {steps.map((item) => {
          const isActive = currentStep === item.number;
          const isPast = currentStep > item.number;
          
          // ✅ Completely isolated class parameters to prevent layout string merging bugs
          let circleClass = "";
          let labelClass = "";
          
          if (isActive) {
            circleClass = "bg-[#064e3b] border-[#064e3b] text-white";
            labelClass = "text-[#064e3b] font-bold";
          } else if (isPast) {
            circleClass = "bg-[#064e3b] border-[#064e3b] text-white opacity-80";
            labelClass = "text-[#064e3b] font-semibold";
          } else {
            circleClass = "bg-[#f4f5f1] border-transparent text-gray-400";
            labelClass = "text-gray-400 font-medium";
          }

          return (
            <div key={item.number} className="flex flex-col items-center flex-1">
              {/* Step Node Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 shadow-sm border ${circleClass}`}
              >
                {item.number}
              </div>

              {/* Step Label */}
              <span
                className={`text-[11px] sm:text-xs mt-2 tracking-wider uppercase transition-colors duration-300 ${labelClass}`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 2. Bottom Section: Linear Progress Bar Track & Fractional Progress Counter */}
      <div className="flex items-center gap-4 w-full">
        <div className="h-1.5 bg-gray-200/80 rounded-full flex-1 overflow-hidden">
          <div
            className="h-full bg-[#064e3b] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[#064e3b] tracking-wider min-w-[24px] text-right">
          {currentStep}/4
        </span>
      </div>

    </div>
  );
}