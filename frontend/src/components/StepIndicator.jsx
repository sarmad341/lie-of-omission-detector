import { Progress } from "@/components/ui/progress";

const DEFAULT_STEPS = [
  "Category",
  "Claim Details",
  "Confirm",
  "Evidence",
  "Screening",
];

export default function StepIndicator({ current, steps = DEFAULT_STEPS }) {
  const progressPct = ((current - 1) / (steps.length - 1)) * 100;

  return (
    <div style={{ marginBottom: 40 }}>
      <Progress
        value={progressPct}
        aria-label={`Step ${current} of ${steps.length}: ${steps[current - 1]}`}
        className="mb-3.5 h-1 bg-[var(--border)] [&>[data-slot=progress-indicator]]:bg-[image:var(--gradient-brand)] [&>[data-slot=progress-indicator]]:transition-all [&>[data-slot=progress-indicator]]:duration-300"
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const active = stepNum === current;
          const done = stepNum < current;
          return (
            <div
              key={label}
              style={{
                textAlign:
                  i === 0 ? "left" : i === steps.length - 1 ? "right" : "center",
                flex: 1,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: active
                    ? "var(--accent)"
                    : done
                      ? "var(--text)"
                      : "var(--text-faint)",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
