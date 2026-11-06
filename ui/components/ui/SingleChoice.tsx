export function SingleChoice<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, l], i) => (
        <button
          key={v}
          disabled={disabled}
          role="radio"
          aria-checked={v === value}
          tabIndex={v === value ? 0 : -1}
          onClick={() => onChange(v)}
          onKeyDown={(e) => {
            const step =
              e.key === "ArrowRight" || e.key === "ArrowDown"
                ? 1
                : e.key === "ArrowLeft" || e.key === "ArrowUp"
                  ? -1
                  : 0;
            if (disabled || (!step && e.key !== "Home" && e.key !== "End"))
              return;
            e.preventDefault();
            const next =
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? options.length - 1
                  : (i + step + options.length) % options.length;
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
