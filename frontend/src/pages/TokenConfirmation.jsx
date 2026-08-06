import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { CheckCircle, Copy, Check, ArrowRight, LayoutDashboard } from "lucide-react";

export default function TokenConfirmation() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state; // { reference_number, company_name, category, submitted_at, case_id }
  const [copied, setCopied] = useState(false);

  if (!data?.reference_number) {
    navigate("/dashboard");
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(data.reference_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const categoryLabel = {
    car_insurance: "Car Insurance",
    health_insurance: "Health Insurance",
    loan_application: "Property / Home",
  }[data.category] || data.category || "Insurance";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-surface) 100%)",
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 520,
          width: "100%",
          padding: "48px 40px",
          textAlign: "center",
          animation: "fadeInUp 0.5s ease-out",
        }}
      >
        {/* Success icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "var(--status-supported-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <CheckCircle size={40} color="var(--status-supported-text)" />
        </div>

        <h1 style={{ fontSize: 26, marginBottom: 8 }}>Application Submitted!</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 32 }}>
          Your claim has been received. Here is your reference number — keep it
          safe to track your application.
        </p>

        {/* Reference number block */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "2px dashed var(--border)",
            borderRadius: 12,
            padding: "20px 24px",
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-faint)", letterSpacing: 1, marginBottom: 6 }}>
            REFERENCE NUMBER
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: 2,
                color: "var(--accent)",
                fontFamily: "monospace",
              }}
            >
              {data.reference_number}
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                color: copied ? "var(--status-supported-text)" : "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                transition: "all 0.2s",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Details */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            marginBottom: 32,
            textAlign: "left",
          }}
        >
          {[
            { label: "Company", value: data.company_name },
            { label: "Category", value: categoryLabel },
            { label: "Status", value: "Submitted" },
            {
              label: "Submitted",
              value: new Date(data.submitted_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              }),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: "var(--bg-base)",
                borderRadius: 8,
                padding: "10px 14px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* What happens next */}
        <div
          style={{
            background: "var(--accent-soft)",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 28,
            textAlign: "left",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>
            What happens next?
          </div>
          {[
            "AI validates your claim against uploaded evidence",
            "Application is sent to the company admin",
            "Admin reviews and makes a decision",
            "You'll see the result in your dashboard",
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
          <Link
            to={`/applications/${data.reference_number}`}
            style={{ textDecoration: "none" }}
          >
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 15 }}
            >
              🔍 Track Application Status Live
            </button>
          </Link>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              to="/dashboard"
              style={{ textDecoration: "none", flex: 1 }}
            >
              <button
                className="btn btn-secondary"
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}
              >
                <LayoutDashboard size={15} />
                My Dashboard
              </button>
            </Link>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 13 }}
              onClick={() => navigate("/get-started")}
            >
              Submit Another
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
