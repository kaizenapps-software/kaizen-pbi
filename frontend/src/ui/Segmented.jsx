export default function Segmented({ items = [], value, onChange, className = "" }) {
  return (
    <div
      role="tablist"
      aria-label="switch"
      className={
        "inline-flex items-center rounded-2xl border border-border bg-panel/70 backdrop-blur-sm " +
        "shadow-soft px-1 py-1 " + className
      }
      style={{ borderColor: "var(--color-border)" }}
    >
      {items.map(({ value: v, label }) => {
        const active = v === value
        return (
          <button
            key={v}
            role="tab"
            aria-pressed={active}
            onClick={() => onChange?.(v)}
            className={
              "px-3 py-1.5 text-sm rounded-xl transition hover-lift pressable " +
              (active
                ? "bg-foreground/10"
                : "opacity-80 hover:opacity-100")
            }
            style={{
              color: "var(--color-foreground)",
              borderColor: "transparent",
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
