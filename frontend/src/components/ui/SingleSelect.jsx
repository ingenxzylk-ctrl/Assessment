export default function SingleSelect({ options, value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {options.map((opt) => {
        const isSelected = value === opt.id || value === opt.label;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`w-full h-14 px-5 flex items-center justify-between border rounded-2xl transition-all font-medium text-base text-left cursor-pointer ${
              isSelected
                ? "border-[#064e3b] bg-[#064e3b]/5 text-[#064e3b] ring-1 ring-[#064e3b]"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span>{opt.label}</span>
            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? "border-[#064e3b] bg-[#064e3b]" : "border-gray-300"}`}>
              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}