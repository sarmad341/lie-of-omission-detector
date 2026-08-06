import { Card } from "@/components/ui/card";

export default function StatCard({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: { bar: "var(--gradient-brand)", text: "var(--text)" },
    supported: {
      bar: "linear-gradient(90deg, #17803D, #4ADE80)",
      text: "var(--status-supported-text)",
    },
    contradicted: {
      bar: "linear-gradient(90deg, #C0362F, #F87171)",
      text: "var(--status-contradicted-text)",
    },
    missing: {
      bar: "linear-gradient(90deg, #A16207, #FBBF24)",
      text: "var(--status-missing-text)",
    },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <Card className="overflow-hidden p-0 text-center">
      <div style={{ height: 4, background: t.bar }} />
      <div style={{ padding: "18px 12px" }}>
        <div
          style={{ fontSize: 30, fontWeight: 800, color: t.text, lineHeight: 1 }}
        >
          {value}
        </div>
        <div className="label" style={{ marginTop: 8 }}>
          {label}
        </div>
      </div>
    </Card>
  );
}
