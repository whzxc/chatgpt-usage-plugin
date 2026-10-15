export function SingleChoice<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, l], i) => (
        <button
          key={v}
          role="radio"
          aria-checked={v === value}
          aria-pressed={v === value}
          tabIndex={v === value ? 0 : -1}
          onClick={() => onChange(v)}
          onKeyDown={(e) => {
            const step =
              e.key === "ArrowRight" || e.key === "ArrowDown"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? -1
                  : 0;
            if (!step) return;
            e.preventDefault();
            const next = (i + step + options.length) % options.length;
            onChange(options[next][0]);
            (
              e.currentTarget.parentElement?.children[next] as HTMLElement
            )?.focus();
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
