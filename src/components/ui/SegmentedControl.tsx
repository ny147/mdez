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
    <div role="group" aria-label={label} className="inline-flex rounded border border-border bg-surface p-1 shadow-soft">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-sm font-bold transition active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent ${
            value === option.value ? "bg-accent text-accent-on shadow-soft" : "text-muted hover:bg-panel hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
