import { useNavigate } from "react-router-dom";

export default function GetStartedChoice() {
  const navigate = useNavigate();

  return (
    <div
      className="container-narrow"
      style={{ padding: "64px 24px", textAlign: "center" }}
    >
      <h2 style={{ marginBottom: 8, fontSize: 28 }}>How would you like to start?</h2>
      <p style={{ marginBottom: 36, color: "var(--text-muted)", fontSize: 15 }}>
        Choose the option that fits your current situation.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 36 }}>
        {/* Option 1: Generate Claim */}
        <div
          className="card card-hover"
          onClick={() => navigate("/generate-claim")}
          style={{
            padding: 32,
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid var(--border)",
            transition: "all 0.2s",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 32 }}>🖼️</div>
              <span style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>
                ⚡ ~2 MINS
              </span>
            </div>
            <h3 style={{ marginBottom: 8, fontSize: 18 }}>Generate Claim from Evidence</h3>
            <p style={{ fontSize: 13, margin: "0 0 16px 0", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Upload photos or documents — AI Vision drafts a claim form for you to review and apply.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 6 }}>HOW IT WORKS</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div>1. Select provider & upload photos</div>
              <div>2. AI analyzes damage & fills form</div>
              <div>3. Review & submit for VRT token</div>
            </div>
          </div>
        </div>

        {/* Option 2: Apply directly */}
        <div
          className="card card-hover"
          onClick={() => navigate("/new-case")}
          style={{
            padding: 32,
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid var(--border)",
            transition: "all 0.2s",
          }}
        >
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 32 }}>📄</div>
              <span style={{ background: "#e7f6ec", color: "#17803d", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>
                📄 ~1 MIN
              </span>
            </div>
            <h3 style={{ marginBottom: 8, fontSize: 18 }}>Apply for a Claim Directly</h3>
            <p style={{ fontSize: 13, margin: "0 0 16px 0", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Already have a written claim document ready? Submit directly to get your reference token.
            </p>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", marginBottom: 6 }}>HOW IT WORKS</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 }}>
              <div>1. Paste or upload claim document</div>
              <div>2. Select insurance company</div>
              <div>3. Instant VRT reference token</div>
            </div>
          </div>
        </div>
      </div>

      <button
        className="btn btn-secondary"
        onClick={() => navigate("/")}
        style={{ padding: "10px 24px", fontSize: 14 }}
      >
        ← Back to Home
      </button>
    </div>
  );
}

