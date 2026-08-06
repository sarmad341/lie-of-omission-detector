import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCase, listCompanies, submitFromGeneration } from "../api";
import { ArrowLeft, Send, Building2, Loader2, CheckCircle2 } from "lucide-react";

export default function ApplyFromDraftPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const cRes = await getCase(caseId);
        setCaseData(cRes.data);
        const category = cRes.data?.category || "car_insurance";
        const compRes = await listCompanies(category);
        setCompanies(compRes.data || []);
        if (compRes.data?.length > 0) {
          setSelectedCompanyId(compRes.data[0]._id);
        }
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [caseId]);

  const handleSubmit = async () => {
    if (!selectedCompanyId) {
      setError("Please select an insurance company.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await submitFromGeneration(caseId, selectedCompanyId);
      const chosenCompany = companies.find((c) => c._id === selectedCompanyId);
      navigate("/apply-confirm", {
        state: {
          reference_number: res.data.reference_number,
          company_name: res.data.company_name || chosenCompany?.name || "",
          category: caseData?.category || "car_insurance",
          submitted_at: res.data.submitted_at,
          case_id: caseId,
        },
      });
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: 16 }}>Loading draft details...</p>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="container" style={{ padding: "32px 24px" }}>
        <p style={{ color: "var(--status-contradicted-text)", marginBottom: 16 }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const selectedCompany = companies.find((c) => c._id === selectedCompanyId);

  return (
    <div className="container" style={{ padding: "32px 24px", maxWidth: 720 }}>
      {/* Back button */}
      <button
        className="btn btn-secondary"
        onClick={() => navigate("/dashboard")}
        style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13 }}
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </button>

      <h1 style={{ marginBottom: 8 }}>Select Insurance Provider</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 28 }}>
        Choose the company you want to submit this claim application to.
      </p>

      {error && (
        <div
          style={{
            background: "var(--status-contradicted-bg)",
            color: "var(--status-contradicted-text)",
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Claim Summary snippet */}
      <div className="card" style={{ padding: "16px 20px", marginBottom: 28, background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: 0.5, marginBottom: 4 }}>DRAFT CLAIM</div>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{caseData.document_name || "Generated Claim Draft"}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          Category: {caseData.category || "Car Insurance"} · {caseData.confirmed_claims?.length || caseData.raw_extracted_claims?.length || 0} claim items
        </div>
      </div>

      {/* Company cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
        {companies.map((comp) => {
          const isSelected = selectedCompanyId === comp._id;
          return (
            <div
              key={comp._id}
              onClick={() => setSelectedCompanyId(comp._id)}
              className="card card-hover"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "20px 24px",
                cursor: "pointer",
                border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                background: isSelected ? "var(--accent-soft)" : "var(--bg-base)",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: isSelected ? "var(--accent)" : "var(--bg-surface)",
                    color: isSelected ? "#fff" : "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 18,
                  }}
                >
                  <Building2 size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{comp.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                    {comp.applicable_rule_ids?.length || 0} active policies
                  </div>
                </div>
              </div>

              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                  background: isSelected ? "var(--accent)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && <CheckCircle2 size={16} color="#fff" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action button */}
      <button
        className="btn btn-primary"
        style={{ width: "100%", padding: "14px", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        onClick={handleSubmit}
        disabled={submitting || !selectedCompanyId}
      >

        {submitting ? (
          <>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            Submitting Claim...
          </>
        ) : (
          <>
            <Send size={18} />
            Submit Claim to {selectedCompany?.name || "Selected Company"}
          </>
        )}
      </button>
    </div>
  );
}
