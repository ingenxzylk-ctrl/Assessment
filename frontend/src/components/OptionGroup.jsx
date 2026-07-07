/**
 * Reusable question block.
 * mode: "single" | "multi"
 * value: string (single) | string[] (multi)
 * onChange: (newValue) => void
 */
export default function OptionGroup({ question, options, mode = "single", value, onChange }) {
  const isSelected = (opt) =>
    mode === "multi" ? Array.isArray(value) && value.includes(opt) : value === opt;

  const handleClick = (opt) => {
    if (mode === "multi") {
      const current = Array.isArray(value) ? value : [];
      const next = current.includes(opt)
        ? current.filter((v) => v !== opt)
        : [...current, opt];
      onChange(next);
    } else {
      onChange(opt);
    }
  };

  return (
    <div className="option-group">
      <p className="option-question">{question}</p>
      <div className="option-pills">
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            className={`option-pill ${isSelected(opt) ? "selected" : ""}`}
            onClick={() => handleClick(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
