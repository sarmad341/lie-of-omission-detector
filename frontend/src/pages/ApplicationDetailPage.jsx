import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getApplicationStatus, getApplicationResult } from "../api";
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2,
  RefreshCw, FileText,
} from "lucide-react";

const APP_STEPS = ["Submitted", "AI Review", "Company Review", "Decision"];

const APP_STATUS_STEP = {
  submitted: 0,
  ai_reviewing: 1,
  admin_pending: 2,
  approved: 3,
  denied: 3,
};

const APP_STATUS_LABEL = {
  submitted: { label: "Submitted", color: "var(--text-muted)", bg: "var(--bg-surface)" },
  ai_reviewing: { label: "AI Reviewing", color: "#f59e0b", bg: "#fef3c7" },
  admin_pending: { label: "Pending Review", color: "#3b82f6", bg: "#dbeafe" },
  approved: { label: "Approved", color: "var(--status-supported-text)", bg: "var(--status-supported-bg)" },
  denied: { label: "Denied", color: "var(--status-contradicted-text)", bg: "var(--status-contradicted-bg)" },
};

const VERDICT_STYLES = {
  supported: { color: "var(--status-supported-text)", bg: "var(--status-supported-bg)", label: "Supported" },
  contradicted: { color: "var(--status-contradicted-text)", bg: "var(--status-contradicted-bg)", label: "Contradicted" },
  missing_expected_evidence: { color: "var(--status-missing-text)", bg: "var(--status-missing-bg)", label: "Missing Evidence" },
  insufficient_evidence: { color: "var(--status-review-text)", bg: "var(--status-review-bg)", label: "Insufficient" },
  conflicting_evidence: { color: "#f59e0b", bg: "#fef3c7", label: "Conflicting" },
};

function StatusPipeline({ status, large }) {
  const step = APP_STATUS_STEP[status] ?? 0;
  const isDenied = status === "denied";
  const dotSize = large ? 36 : 24;
  const lineH = large ? 3 : 2;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: large ? 16 : 8 }}>
      {APP_STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const isLast = i === APP_STEPS.length - 1;

        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: done || active
                    ? (isDenied && isLast ? "var(--status-contradicted-bg)" : "var(--accent)")
                    : "var(--bg-surface)",
                  border: `2px solid ${done || active ? (isDenied && isLast ? "var(--status-contradicted-border)" : "var(--accent)") : "var(--border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: large ? 14 : 10,
                  color: done || active ? (isDenied && isLast ? "var(--status-contradicted-text)" : "#fff") : "var(--text-faint)",
                  fontWeight: 700,
                  flexShrink: 0,
                  transition: "all 0.3s",
                }}
              >
                {done ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: large ? 12 : 9,
                color: active ? "var(--accent)" : "var(--text-faint)",
                whiteSpace: "nowrap",
                fontWeight: active ? 600 : 400,
              }}>
                {s}
              </span>
            </div>
            {!isLast && (
              <div
                style={{
                  height: lineH,
                  flex: 1,
                  background: done ? "var(--accent)" : "var(--border)",
                  margin: "0 4px",
                  marginBottom: large ? 24 : 16,
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ApplicationDetailPage() {
  const { referenceNumber } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadStatus = async () => {
    try {
      const res = await getApplicationStatus(referenceNumber);
      setStatus(res.data);
      setLastUpdated(new Date());

      // If decided or awaiting evidence, load full result
      if (["approved", "denied", "sent_back_for_more_evidence"].includes(res.data.application_status)) {
        try {
          const rRes = await getApplicationResult(referenceNumber);
          setResult(rRes.data);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [referenceNumber]);

  // Auto-refresh every 30s while pending
  useEffect(() => {
    if (!status) return;
    const isPending = ["submitted", "ai_reviewing", "admin_pending"].includes(status.application_status);
    if (!isPending) return;
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [status?.application_status]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: 16 }}>Loading application...</p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="container" style={{ padding: "32px 24px" }}>
        <p style={{ color: "var(--status-contradicted-text)", marginBottom: 12 }}>{error || "Application not found."}</p>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const st = APP_STATUS_LABEL[status.application_status] || APP_STATUS_LABEL.submitted;
  const catLabel = { car_insurance: "Car Insurance", health_insurance: "Health Insurance", loan_application: "Property / Home" };
  const isDecided = ["approved", "denied"].includes(status.application_status);

  return (
    <div className="container" style={{ padding: "32px 24px", maxWidth: 760 }}>
      {/* Back */}
      <button
        className="btn btn-secondary"
        onClick={() => navigate("/dashboard")}
        style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 28, fontSize: 13 }}
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "monospace", fontSize: 28, color: "var(--accent)", marginBottom: 4 }}>
            {status.reference_number}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {catLabel[status.category] || status.category} · {status.company_name}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 14px",
              borderRadius: 20,
              background: st.bg,
              color: st.color,
              border: `1px solid ${st.color}33`,
            }}
          >
            {st.label}
          </span>
          <button
            onClick={loadStatus}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-faint)",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <RefreshCw size={11} />
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Refresh"}
          </button>
        </div>
      </div>

      {/* Progress Pipeline */}
      <div className="card" style={{ padding: "20px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Application Progress</div>
        <StatusPipeline status={status.application_status} large />

        {!isDecided && (
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 16, textAlign: "center" }}>
            🔄 Auto-refreshing every 30 seconds. You'll see your result here once the company admin makes a decision.
          </p>
        )}
      </div>

      {/* Metadata */}
      <div
        className="card"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "16px 20px", marginBottom: 24 }}
      >
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>SUBMITTED</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            {new Date(status.submitted_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>COMPANY</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{status.company_name}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>CATEGORY</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{catLabel[status.category] || status.category || "—"}</div>
        </div>
      </div>

      {status.application_status === "sent_back_for_more_evidence" && (
        <div
          className="card"
          style={{
            padding: "20px 22px",
            marginBottom: 24,
            borderLeft: "4px solid #ec4899",
            background: "#fff5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Clock size={24} color="#ec4899" />
            <h3 style={{ margin: 0, color: "#be185d" }}>
              Action Required: Additional Evidence Requested
            </h3>
          </div>
          {status.admin_note && (
            <div style={{ background: "#fff", border: "1px solid #fbcfe8", borderRadius: 8, padding: "12px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#be185d", fontWeight: 600, marginBottom: 4 }}>ADJUSTER'S REQUEST</div>
              <p style={{ fontSize: 14, margin: 0 }}>{status.admin_note}</p>
            </div>
          )}
          <button
            className="btn"
            style={{ background: "#ec4899", color: "#fff", width: "100%", padding: "10px", fontWeight: 600 }}
            onClick={() => navigate(`/resubmit-evidence/${status.reference_number}`)}
          >
            Submit Additional Evidence →
          </button>
        </div>
      )}

      {/* Decision Result */}
      {isDecided && (
        <div
          className="card"
          style={{
            padding: "20px 22px",
            marginBottom: 24,
            borderLeft: `4px solid ${status.application_status === "approved" ? "var(--status-supported-text)" : "var(--status-contradicted-text)"}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            {status.application_status === "approved"
              ? <CheckCircle2 size={24} color="var(--status-supported-text)" />
              : <XCircle size={24} color="var(--status-contradicted-text)" />
            }
            <h3 style={{ margin: 0 }}>
              {status.application_status === "approved" ? "Your Claim was Approved" : "Your Claim was Denied"}
            </h3>
          </div>

          {status.admin_note && (
            <div style={{ background: "var(--bg-base)", borderRadius: 8, padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 4 }}>DECISION NOTE</div>
              <p style={{ fontSize: 14, margin: 0 }}>{status.admin_note}</p>
            </div>
          )}

          {status.admin_decided_at && (
            <p style={{ fontSize: 12, color: "var(--text-faint)", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={12} />
              Decision made {new Date(status.admin_decided_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* AI Analysis (if result loaded) */}
      {result?.claims_checked?.length > 0 && (
        <div className="card" style={{ padding: "20px 22px" }}>
          <h3 style={{ marginBottom: 16 }}>🤖 AI Analysis</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.claims_checked.map((claim, i) => {
              const vs = VERDICT_STYLES[claim.final_verdict] || { color: "var(--text-muted)", bg: "var(--bg-surface)", label: "—" };
              return (
                <div
                  key={i}
                  style={{ borderLeft: `3px solid ${vs.color}`, paddingLeft: 14, paddingTop: 6, paddingBottom: 6 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ fontSize: 14, flex: 1 }}>{claim.claim_text}</div>
                    <span
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 12,
                        background: vs.bg, color: vs.color, whiteSpace: "nowrap", flexShrink: 0,
                      }}
                    >
                      {vs.label}
                    </span>
                  </div>
                  {claim.explanation && (
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>{claim.explanation}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
