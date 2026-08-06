import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CONFIG = {
  supported: {
    label: "Supported",
    Icon: CheckCircle2,
    bg: "var(--status-supported-bg)",
    text: "var(--status-supported-text)",
    border: "var(--status-supported-border)",
  },
  contradicted: {
    label: "Contradicted",
    Icon: XCircle,
    bg: "var(--status-contradicted-bg)",
    text: "var(--status-contradicted-text)",
    border: "var(--status-contradicted-border)",
  },
  missing_expected_evidence: {
    label: "Missing evidence",
    Icon: HelpCircle,
    bg: "var(--status-missing-bg)",
    text: "var(--status-missing-text)",
    border: "var(--status-missing-border)",
  },
  insufficient_evidence: {
    label: "Insufficient evidence",
    Icon: AlertTriangle,
    bg: "var(--status-missing-bg)",
    text: "var(--status-missing-text)",
    border: "var(--status-missing-border)",
  },
  conflicting_evidence: {
    label: "Conflicting evidence",
    Icon: AlertTriangle,
    bg: "var(--status-missing-bg)",
    text: "var(--status-missing-text)",
    border: "var(--status-missing-border)",
  },
};

export default function StatusBadge({ verdict, size = "md" }) {
  const c = CONFIG[verdict] || {
    label: verdict,
    Icon: HelpCircle,
    bg: "#eee",
    text: "#333",
    border: "#ddd",
  };
  const iconSize = size === "sm" ? 13 : 15;

  return (
    <Badge
      role="status"
      variant="outline"
      className="gap-1.5 rounded-full border px-3 py-1 font-semibold"
      style={{
        background: c.bg,
        color: c.text,
        borderColor: c.border,
        fontSize: size === "sm" ? 12 : 13,
      }}
    >
      <c.Icon size={iconSize} strokeWidth={2.5} />
      {c.label}
    </Badge>
  );
}
