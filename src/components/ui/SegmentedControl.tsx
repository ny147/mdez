type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border-2 border-white/70 bg-white/10 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
            value === option.value ? "bg-ice text-abyss" : "text-cream/80 hover:bg-white/10 hover:text-cream"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
