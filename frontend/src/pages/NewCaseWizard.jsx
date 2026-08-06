import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StepIndicator from "../components/StepIndicator";
import { extractPreview, confirmClaims, submitEvidence, listCompanies, submitApplication } from "../api";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import { Building2, CheckCircle2, FileText, Upload, X, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CATEGORIES = [
  { name: "Car Insurance", icon: "🚗", badge: "Vehicle & Collision", desc: "Vehicle damage, collision & comprehensive claims" },
  { name: "Health", icon: "🏥", badge: "Medical & Clinical", desc: "Diagnosis, treatments, procedures & hospital receipts" },
  { name: "Loan Application", icon: "🏠", badge: "Property & Asset", desc: "Collateral condition, property damage & asset verification" },
];

const CATEGORY_MAP = {
  "Car Insurance": "car_insurance",
  Health: "health_insurance",
  "Loan Application": "loan_application",
};

export default function NewCaseWizard() {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("Car Insurance");
  const [subCategory, setSubCategory] = useState("collision");
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [claimFile, setClaimFile] = useState(null);
  const [caseId, setCaseId] = useState(null);
  const [extractedClaims, setExtractedClaims] = useState([]);
  const [domainWarning, setDomainWarning] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const navigate = useNavigate();
  const { setGuarded, requestNavigation } = useNavigationGuard();

  // Activate / deactivate the navigation guard
  useEffect(() => {
    const isGuardedState = step >= 3 && !isSubmitted;
    setGuarded(isGuardedState);
    return () => setGuarded(false);
  }, [step, isSubmitted, setGuarded]);

  // Prompt on tab closing/reloads
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (step > 1 && !isSubmitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step, isSubmitted]);

  // Intercept browser back-button to open custom shadcn UI popup
  useEffect(() => {
    if (step <= 1 || isSubmitted) return;
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      requestNavigation(null);
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [step, isSubmitted, requestNavigation]);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const catKey = CATEGORY_MAP[category] || "car_insurance";
        const res = await listCompanies(catKey);
        setCompanies(res.data || []);
        if (res.data?.length > 0) setSelectedCompanyId(res.data[0]._id);
      } catch {
        // ignore
      }
    };
    loadCompanies();
  }, [category]);

  const handleExtract = async () => {
    if (!claimFile) {
      setError("Please upload your claim document first.");
      return;
    }
    setError("");
    setLoadingMsg("Reading your claim document...");
    try {
      const res = await extractPreview(category, claimFile, category === "Car Insurance" ? subCategory : null);
      if (res.data.domain_match === false || !res.data.claims || res.data.claims.length === 0) {
        const warning = res.data.domain_mismatch_warning || "Document content does not match the selected category.";
        setError(`${warning} Please try generating a claim from evidence first.`);
        setLoadingMsg("");
        return;
      }
      setCaseId(res.data.case_id);
      setExtractedClaims(res.data.claims);
      setDomainWarning(null);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setLoadingMsg("");
      return;
    }
    setLoadingMsg("");
    setStep(3);
  };

  const updateClaim = (i, field, value) => {
    const updated = [...extractedClaims];
    updated[i] = { ...updated[i], [field]: value };
    setExtractedClaims(updated);
  };
  const removeClaim = (i) => setExtractedClaims(extractedClaims.filter((_, idx) => idx !== i));

  const handleConfirmClaims = async () => {
    setError("");
    try {
      await confirmClaims(caseId, extractedClaims);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleStartScreening = async () => {
    if (!selectedCompanyId) {
      setError("Please select an insurance company to submit to.");
      return;
    }
    setError("");
    setLoadingMsg("Submitting application...");
    setStep(5);
    try {
      if (imageFiles.length > 0) await submitEvidence(caseId, imageFiles, []);
      setIsSubmitted(true);
      const appRes = await submitApplication(caseId, selectedCompanyId);
      const companyObj = companies.find((c) => c._id === selectedCompanyId);
      navigate("/apply-confirm", {
        state: {
          reference_number: appRes.data.reference_number,
          company_name: appRes.data.company_name || companyObj?.name || "",
          category: CATEGORY_MAP[category],
          submitted_at: appRes.data.submitted_at,
          case_id: caseId,
        },
      });
    } catch (err) {
      setIsSubmitted(false);
      setError(err.response?.data?.detail || err.message);
      setStep(4);
    } finally {
      setLoadingMsg("");
    }
  };

  return (
    <div className="container-narrow" style={{ padding: "48px 24px" }}>
      <StepIndicator
        current={step}
        steps={["Category", "Upload Document", "Confirm Claims", "Evidence & Provider"]}
      />

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ---- STEP 1: CATEGORY SELECTION ---- */}
      {step === 1 && (
        <Card className="card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Select Claim Category</h2>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 14 }}>
              Choose the category of insurance policy you are applying for.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Claim category"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.name;
              return (
                <button
                  type="button"
                  key={cat.name}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setCategory(cat.name)}
                  className={`category-card ${isSelected ? "selected" : ""}`}
                  style={{ textAlign: "left", font: "inherit" }}
                >
                  {isSelected && (
                    <div style={{ position: "absolute", top: 10, right: 10, background: "var(--accent)", color: "white", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CheckCircle2 size={13} />
                    </div>
                  )}
                  <div style={{ fontSize: 34, lineHeight: 1, background: isSelected ? "white" : "var(--bg)", width: 58, height: 58, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)" }}>
                    {cat.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{cat.name}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? "var(--accent)" : "var(--text-muted)", background: isSelected ? "white" : "var(--bg)", padding: "2px 8px", borderRadius: 999 }}>
                      {cat.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>{cat.desc}</div>
                </button>
              );
            })}
          </div>

          {category === "Car Insurance" && (
            <div style={{ 
              marginBottom: 28, 
              padding: "20px", 
              background: "var(--bg)", 
              borderRadius: 12, 
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
              animation: "fadeIn 0.3s ease-out"
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>
                Select Motor Policy Sub-Category
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {[
                  { id: "collision", label: "Collision / Accident", icon: "💥" },
                  { id: "theft", label: "Theft", icon: "🕵️" },
                  { id: "natural_disaster", label: "Natural Disaster", icon: "🌪️" }
                ].map(sub => (
                  <div 
                    key={sub.id} 
                    onClick={() => setSubCategory(sub.id)}
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: 12, 
                      padding: "14px 16px", 
                      borderRadius: 8,
                      border: subCategory === sub.id ? "2px solid var(--accent)" : "1px solid var(--border)",
                      background: subCategory === sub.id ? "var(--accent-soft)" : "white",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ fontSize: 24 }}>{sub.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: subCategory === sub.id ? "var(--accent)" : "var(--text)" }}>
                      {sub.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="brandSecondary" onClick={() => navigate("/get-started")}>Back</Button>
            <Button variant="brand" onClick={() => setStep(2)}>Continue to Upload</Button>
          </div>
        </Card>
      )}

      {/* ---- STEP 2: UPLOAD DOCUMENT ---- */}
      {step === 2 && (
        <Card className="card">
          <h2 style={{ marginTop: 0 }}>Upload Your Claim Document</h2>
          <p style={{ color: "var(--text-muted)", marginTop: -4, marginBottom: 24, fontSize: 14 }}>
            Upload your written claim file (.pdf, .docx, .txt, or scanned claim document) to proceed.
          </p>

          <Label
            htmlFor="claimFileInput"
            style={{ border: "2px dashed var(--border)", borderRadius: 12, padding: "40px 24px", textAlign: "center", background: "var(--bg-base)", cursor: "pointer", marginBottom: 20, display: "block" }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) { setClaimFile(e.dataTransfer.files[0]); setError(""); } }}
          >
            <input
              id="claimFileInput"
              type="file"
              accept=".pdf,.docx,.txt,.jpg,.png"
              className="sr-only"
              onChange={(e) => { if (e.target.files[0]) { setClaimFile(e.target.files[0]); setError(""); } }}
            />
            {claimFile ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <FileText size={40} color="var(--accent)" />
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)" }}>{claimFile.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{(claimFile.size / 1024).toFixed(1)} KB · Click to change file</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <Upload size={36} color="var(--text-faint)" />
                <div style={{ fontWeight: 600, fontSize: 14 }}>Click or drag your claim document here</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>Supports PDF, DOCX, TXT, or Image scans</div>
              </div>
            )}
          </Label>

          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            <Button variant="brandSecondary" onClick={() => setStep(1)}>Back</Button>
            <Button variant="brand" onClick={handleExtract} disabled={!claimFile || !!loadingMsg}>
              {loadingMsg || "Continue to Confirmation"}
            </Button>
          </div>
        </Card>
      )}

      {/* ---- STEP 3: CONFIRM CLAIMS ---- */}
      {step === 3 && (
        <Card className="card">
          <h2 style={{ marginTop: 0 }}>Here&apos;s what we found — please confirm</h2>
          <p style={{ color: "var(--text-muted)", marginTop: -8 }}>Review each item below. Edit anything that&apos;s incorrect.</p>

          {domainWarning && (
            <Alert className="mb-4" style={{ background: "var(--status-review-bg)", borderColor: "var(--status-review-border)" }}>
              <AlertDescription>{domainWarning}</AlertDescription>
            </Alert>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            {extractedClaims.map((c, i) => (
              <div key={i} style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>Extracted Statement #{i + 1}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Label htmlFor={`vis-${i}`} className="flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Checkbox
                        id={`vis-${i}`}
                        checked={c.is_visually_checkable}
                        onCheckedChange={(v) => updateClaim(i, "is_visually_checkable", v === true)}
                      />
                      <Camera size={13} /> Visually Checkable in Evidence
                    </Label>
                    <Button variant="ghost" size="sm" onClick={() => removeClaim(i)} className="h-auto gap-1 px-2 py-1 text-[13px]" style={{ color: "var(--status-contradicted-text)" }}>
                      <X size={14} /> Remove
                    </Button>
                  </div>
                </div>
                <Textarea
                  aria-label={`Extracted statement ${i + 1}`}
                  rows={Math.max(2, Math.ceil((c.claim_text || "").length / 65))}
                  value={c.claim_text}
                  onChange={(e) => updateClaim(i, "claim_text", e.target.value)}
                  className="bg-white"
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <Button variant="brandSecondary" onClick={() => setStep(2)}>Back</Button>
            <Button variant="brand" onClick={handleConfirmClaims}>Confirm &amp; Continue</Button>
          </div>
        </Card>
      )}

      {/* ---- STEP 4: EVIDENCE & PROVIDER ---- */}
      {step === 4 && (
        <Card className="card">
          <h2 style={{ marginTop: 0 }}>Upload evidence &amp; Select Insurance Provider</h2>

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>1. Supporting Evidence (Photos)</div>
          <Label
            htmlFor="evidenceInput"
            style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: 32, textAlign: "center", color: "var(--text-muted)", cursor: "pointer", marginBottom: 16, display: "block" }}
          >
            Drag photos here or click to browse
            <input id="evidenceInput" type="file" multiple accept="image/*" className="sr-only" onChange={(e) => setImageFiles(Array.from(e.target.files))} />
          </Label>
          {imageFiles.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {imageFiles.map((f, i) => (
                <div key={i} className="card" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Camera size={13} /> {f.name}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>2. Select Target Insurance Provider</div>
          <div role="radiogroup" aria-label="Insurance provider" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {companies.map((comp) => {
              const isSel = selectedCompanyId === comp._id;
              return (
                <button
                  type="button"
                  key={comp._id}
                  role="radio"
                  aria-checked={isSel}
                  onClick={() => setSelectedCompanyId(comp._id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 10, cursor: "pointer", border: `2px solid ${isSel ? "var(--accent)" : "var(--border)"}`, background: isSel ? "var(--accent-soft)" : "var(--bg-base)", font: "inherit", textAlign: "left" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Building2 size={18} color={isSel ? "var(--accent)" : "var(--text-muted)"} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{comp.name}</span>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${isSel ? "var(--accent)" : "var(--border)"}`, background: isSel ? "var(--accent)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isSel && <CheckCircle2 size={14} color="#fff" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            <Button variant="brandSecondary" onClick={() => setStep(3)}>Back</Button>
            <Button variant="brand" onClick={handleStartScreening}>Submit Application</Button>
          </div>
        </Card>
      )}

      {/* ---- STEP 5: SCREENING ---- */}
      {step === 5 && (
        <Card className="card" style={{ textAlign: "center", padding: 48 }}>
          <h2>{loadingMsg || "Screening in progress..."}</h2>
          <p style={{ color: "var(--text-muted)" }}>
            This can take a minute or two — checking each claim against your evidence.
          </p>
        </Card>
      )}
    </div>
  );
}
