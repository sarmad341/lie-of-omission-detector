import StatusBadge from "./StatusBadge";
import StatCard from "./StatCard";
import { ShieldAlert, ShieldCheck } from "lucide-react";

const REVIEW_VERDICTS = [
  "contradicted",
  "missing_expected_evidence",
  "insufficient_evidence",
  "conflicting_evidence",
];

export default function ReportView({ caseData }) {
  const claims = caseData.claims_checked || [];
  const skipped = caseData.claims_skipped_administrative || [];

  const counts = {
    supported: claims.filter((c) => c.final_verdict === "supported").length,
    contradicted: claims.filter((c) => c.final_verdict === "contradicted")
      .length,
    missing: claims.filter(
      (c) => c.final_verdict === "missing_expected_evidence",
    ).length,
  };
  const needsReview = claims.filter((c) =>
    REVIEW_VERDICTS.includes(c.final_verdict),
  );

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="label">Compliance review report</div>
        <h2 style={{ margin: "6px 0 16px" }}>{caseData.document_name}</h2>
        <div
          style={{
            display: "flex",
            gap: 28,
            fontSize: 13,
            color: "var(--text-muted)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span className="label">Category</span>
            <br />
            {(caseData.category || "—").replace("_", " ")}
          </div>
          <div>
            <span className="label">Generated</span>
            <br />
            {new Date(caseData.created_at).toLocaleString()}
          </div>
          <div>
            <span className="label">Evidence</span>
            <br />
            {
              (caseData.evidence_image_names || caseData.image_names || [])
                .length
            }{" "}
            image(s)
          </div>
          <div>
            <span className="label">Status</span>
            <br />
            {caseData.status}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard label="Total claims" value={claims.length} />
        <StatCard label="Supported" value={counts.supported} tone="supported" />
        <StatCard
          label="Contradicted"
          value={counts.contradicted}
          tone="contradicted"
        />
        <StatCard
          label="Missing evidence"
          value={counts.missing}
          tone="missing"
        />
      </div>

      {needsReview.length > 0 ? (
        <div
          className="card"
          style={{
            background: "var(--status-review-bg)",
            border: "1px solid var(--status-review-border)",
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <ShieldAlert size={18} /> {needsReview.length} claim(s) need human
            review
          </h3>
          <p style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
            Contradicted, missing, uncertain, or conflicting findings — confirm
            these before treating them as final.
          </p>
          {needsReview.map((c) => (
            <ReportClaimRow key={c.claim_id} claim={c} />
          ))}
        </div>
      ) : (
        <div
          className="card"
          style={{
            background: "var(--status-supported-bg)",
            marginBottom: 24,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <ShieldCheck size={20} color="var(--status-supported-text)" />
          <h3 style={{ color: "var(--status-supported-text)", margin: 0 }}>
            No claims flagged for review
          </h3>
        </div>
      )}

      <h3 style={{ marginBottom: 12 }}>All claims</h3>
      {claims.map((c) => (
        <ReportClaimRow key={c.claim_id} claim={c} />
      ))}

      {skipped.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ marginBottom: 8 }}>Not visually checkable</h3>
          <div
            className="card"
            style={{
              background: "var(--bg)",
              border: "1px dashed var(--border)",
            }}
          >
            {skipped.map((c, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  padding: "4px 0",
                }}
              >
                {c.claim_text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Read-only — result + explanation only, no interactive controls.
function ReportClaimRow({ claim }) {
  return (
    <div
      className="card"
      style={{ marginBottom: 10, background: "white", padding: 16 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <p style={{ margin: 0, fontWeight: 500 }}>{claim.claim_text}</p>
        <StatusBadge verdict={claim.final_verdict} />
      </div>
      <p
        style={{
          fontSize: 13,
          marginTop: 8,
          marginBottom: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {claim.explanation}
      </p>
    </div>
  );
}
