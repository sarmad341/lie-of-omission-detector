import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StepIndicator from "../components/StepIndicator";
import {
  listCompanies,
  describeEvidence,
  draftClaim,
  updateClaims,
  confirmAndProcessGenerated,
  downloadClaimPdf,
  submitFromGeneration,
} from "../api";
import { useNavigationGuard } from "../context/NavigationGuardContext";
import { FileText, Building2, CheckCircle2, Upload, X, Camera, AlertCircle, Info, ChevronRight, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

const STEPS = ["Category", "Company", "Evidence", "Form Details", "Review Draft"];
const CATEGORIES = ["Car Insurance", "Health", "Loan Application"];
const CATEGORY_MAP = {
  "Car Insurance": "car_insurance",
  Health: "health_insurance",
  "Loan Application": "loan_application",
};
const REASON_LABELS = {
  laterality_conflict: "Left/right inconsistent across analysis",
  intact_near_damage: 'Claims "intact" near other visible damage',
};

import { getTemplateFields, getReviewSectionOrder } from "../utils/templateFields";

function groupBySection(fields) {
  return fields.reduce((acc, f) => {
    (acc[f.section] = acc[f.section] || []).push(f);
    return acc;
  }, {});
}

function autoResize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function buildTemplateData(answers, category, subCategory) {
  const data = {};
  
  // Inject discriminator type
  if (category === "Car Insurance") {
    data.type = subCategory === "natural_disaster" ? "natural_disaster" : subCategory === "theft" ? "theft" : "collision";
  } else {
    data.type = "legacy";
  }

  getTemplateFields(category, subCategory).forEach((f) => {
    if (f.type === "table") {
      data[f.id] = answers[f.id] || [];
    } else {
      data[f.id] = (answers[f.id] || "").trim();
    }
  });
  return data;
}

// Small reusable loading indicator — icon bobs using the existing
// floatY keyframe already defined in theme.css, no new CSS added.
function LoadingLabel({ icon, text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          display: "inline-block",
          animation: "floatY 1.4s ease-in-out infinite",
        }}
      >
        {icon}
      </span>
      {text}
    </span>
  );
}

export default function GenerateClaimWizard() {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("Car Insurance");
  const [subCategory, setSubCategory] = useState("collision");
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [caseId, setCaseId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [claims, setClaims] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [descriptions, setDescriptions] = useState([]);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [draftHeaderScrolled, setDraftHeaderScrolled] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null); // null = closed, number = open
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [allFilePreviews, setAllFilePreviews] = useState([]);
  const navigate = useNavigate();
  const { setGuarded, requestNavigation } = useNavigationGuard();

  // Activate / deactivate the navigation guard
  useEffect(() => {
    const isGuardedState = step >= 3 && !isSubmitted;
    setGuarded(isGuardedState);
    return () => setGuarded(false);
  }, [step, isSubmitted, setGuarded]);

  useEffect(() => {
    if (step !== 5) return;
    const onScroll = () => setDraftHeaderScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [step]);

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

  const setAnswer = (id, value) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const nonImageFiles = imageFiles.filter((f) => !f.type.startsWith("image/"));

  const irrelevantImageNames = imageFiles
    .filter((f) => f.type.startsWith("image/"))
    .filter((fileObj) => {
      const descObj = descriptions.find(d => d.filename === fileObj.name);
      return descObj && descObj.is_relevant === false;
    })
    .map(f => f.name);

  // Build a unified list of all evidence files for the lightbox.
  const allEvidenceFiles = [
    ...imageFiles.filter((f) => f.type.startsWith("image/")),
    ...nonImageFiles,
  ];

  useEffect(() => {
    const urls = allEvidenceFiles.map((file) => {
      if (file instanceof File || file instanceof Blob) {
        return URL.createObjectURL(file);
      }
      return null;
    });
    setAllFilePreviews(urls);
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [imageFiles]);

  const imagePreviews = allFilePreviews.slice(0, imageFiles.filter((f) => f.type.startsWith("image/")).length);

  const openLightbox = (idx) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const prevLightbox = () =>
    setLightboxIdx((i) => (i - 1 + allEvidenceFiles.length) % allEvidenceFiles.length);
  const nextLightbox = () =>
    setLightboxIdx((i) => (i + 1) % allEvidenceFiles.length);

  const renderEvidenceThumbnails = () =>
    (imagePreviews.length > 0 || nonImageFiles.length > 0) && (
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        {imagePreviews.map((src, i) => {
          const fileObj = imageFiles.filter((f) => f.type.startsWith("image/"))[i];
          const descObj = fileObj ? descriptions.find(d => d.filename === fileObj.name) : null;
          const isIrrelevant = descObj && descObj.is_relevant === false;

          return (
            <div key={`img-${i}`} style={{ position: "relative", display: "inline-block" }}>
              <img
                src={src}
                alt={`Evidence ${i + 1}`}
                onClick={() => openLightbox(i)}
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 8,
                  border: isIrrelevant ? "2px solid var(--destructive)" : "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  opacity: isIrrelevant ? 0.6 : 1,
                }}
                title={isIrrelevant ? `${fileObj.name} is analyzed as irrelevant to ${category}` : fileObj.name}
                onMouseEnter={(e) => { e.target.style.transform = "scale(1.08)"; e.target.style.boxShadow = "0 4px 14px rgba(0,0,0,0.18)"; }}
                onMouseLeave={(e) => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "none"; }}
              />
              {isIrrelevant && (
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: "var(--destructive)",
                    color: "white",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: "bold",
                    pointerEvents: "none",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                  }}
                  title="Not relevant to claim category"
                >
                  ⚠️
                </div>
              )}
            </div>
          );
        })}
        {nonImageFiles.map((f, i) => (
          <div
            key={`doc-${i}`}
            className="card"
            title={f.name}
            onClick={() => openLightbox(imagePreviews.length + i)}
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              padding: 4,
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.14)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            📄
          </div>
        ))}
      </div>
    );

  const handleCategoryNext = async () => {
    setError("");
    setLoadingMsg("Loading companies...");
    try {
      const res = await listCompanies(CATEGORY_MAP[category]);
      setCompanies(res.data);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoadingMsg("");
  };

  const handleEvidenceSubmit = async () => {
    if (imageFiles.length === 0) {
      setError("Upload at least one photo or document.");
      return;
    }
    setError("");
    setLoadingMsg("Analyzing your evidence...");
    try {
      const res = await describeEvidence(
        category,
        companyId,
        imageFiles,
        category === "Car Insurance" ? subCategory : null
      );
      setCaseId(res.data.case_id);
      setQuestions(res.data.questions || []);
      setDescriptions(res.data.descriptions || []);

      // If the backend extracted template field values from uploaded documents,
      // pre-fill those fields in the form — only for fields that aren't already set.
      const prefilled = res.data.prefilled_template || {};
      if (Object.keys(prefilled).length > 0) {
        setAnswers((prev) => {
          const merged = { ...prefilled };
          // User-entered values take priority — don't overwrite existing ones.
          Object.entries(prev).forEach(([k, v]) => {
            if (v && v.trim()) merged[k] = v;
          });
          return merged;
        });
      }

      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoadingMsg("");
  };

  const handleAnswersSubmit = async () => {
    setError("");
    setLoadingMsg("Drafting your claim...");
    try {
      const answerList = questions.map((q) => ({
        question: q,
        answer: answers[q] || "",
      }));
      const templateData = buildTemplateData(answers, category, subCategory);
      const res = await draftClaim(caseId, answerList, templateData);
      setClaims(res.data.claims);
      setSuggestions(res.data.suggestions || []);
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoadingMsg("");
  };

  const updateClaimText = (i, value) => {
    const updated = [...claims];
    updated[i] = { ...updated[i], claim_text: value };
    setClaims(updated);
  };

  const validateRequiredFields = () => {
    const required = [
      { id: "first_name", label: "First Name" },
      { id: "last_name", label: "Last Name" },
    ];
    if (category === "Car Insurance") {
      required.push(
        { id: "vehicle_vin", label: "VIN" },
        { id: "license_plate", label: "License Plate" }
      );
      if (subCategory === "collision") {
        required.push(
          { id: "policy_inception_date", label: "Policy Inception Date" },
          { id: "incident_date", label: "Date of Incident" },
          { id: "point_of_impact", label: "Point of Impact" },
          { id: "incident_circumstances", label: "Briefly describe the circumstances" }
        );
      }
      if (subCategory === "theft") {
        required.push(
          { id: "policy_inception_date", label: "Policy Inception Date" },
          { id: "theft_date", label: "Date of Theft" },
          { id: "theft_time", label: "Time of Theft" },
          { id: "date_reported", label: "Date Reported to Insurer" },
          { id: "theft_location", label: "Location of Theft" },
          { id: "stolen_articles", label: "Itemized Stolen Articles" },
          { id: "police_report_number", label: "Police Report Number" }
        );
      }
      if (subCategory === "natural_disaster") {
        required.push(
          { id: "peril_type", label: "Peril Type" },
          { id: "incident_date", label: "Date of Incident" },
          { id: "incident_time", label: "Time of Incident" },
          { id: "incident_location", label: "Location of Incident" },
          { id: "incident_circumstances", label: "Briefly describe the circumstances" }
        );
      }
    }
    const missing = required.filter(f => {
      const val = answers[f.id];
      if (f.id === "stolen_articles") {
        return !val || val.length === 0;
      }
      return !val || (typeof val === "string" && (!val.trim() || val === "Not provided" || val.includes("[Please Confirm]")));
    });
    if (missing.length > 0) {
      window.alert(`The following fields are required and must be filled:\n\n- ${missing.map(f => f.label).join("\n- ")}`);
      return false;
    }
    return true;
  };

  const handleConfirm = async () => {
    setError("");
    if (!validateRequiredFields()) return;
    setLoadingMsg("Submitting for review...");
    try {
      const templateData = buildTemplateData(answers, category, subCategory);
      if (claims && claims.length > 0) {
        await updateClaims(caseId, claims, templateData);
      }
      await confirmAndProcessGenerated(caseId, claims);
      setIsSubmitted(true);
      navigate(`/cases/${caseId}`);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setLoadingMsg("");
  };

  const handleApplyForClaim = async () => {
    setError("");
    if (!validateRequiredFields()) return;
    setLoadingMsg("Submitting claim application...");
    try {
      const templateData = buildTemplateData(answers, category, subCategory);
      if (claims && claims.length > 0) {
        await updateClaims(caseId, claims, templateData);
      }
      setIsSubmitted(true);
      const appRes = await submitFromGeneration(caseId, companyId);
      const companyObj = companies.find((c) => c._id === companyId);
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
    }
    setLoadingMsg("");
  };

  const handleDownload = async () => {
    setError("");
    if (!validateRequiredFields()) return;
    setDownloadingPdf(true);
    try {
      if (claims && claims.length > 0) {
        const templateData = buildTemplateData(answers, category, subCategory);
        await updateClaims(caseId, claims, templateData);
      }
      const res = await downloadClaimPdf(caseId);
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/pdf" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `claim-draft-${caseId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfDownloaded(true);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
    setDownloadingPdf(false);
  };

  const handleTableChange = (fieldId, rowIndex, colId, value) => {
    const list = [...(answers[fieldId] || [])];
    if (!list[rowIndex]) list[rowIndex] = {};
    list[rowIndex][colId] = value;
    setAnswers({ ...answers, [fieldId]: list });
  };
  
  const handleAddTableRow = (fieldId) => {
    const list = [...(answers[fieldId] || []), {}];
    setAnswers({ ...answers, [fieldId]: list });
  };
  
  const handleRemoveTableRow = (fieldId, rowIndex) => {
    const list = [...(answers[fieldId] || [])];
    list.splice(rowIndex, 1);
    setAnswers({ ...answers, [fieldId]: list });
  };

  const fields = getTemplateFields(category, subCategory);
  const templateBySection = groupBySection(fields);
  const reviewSectionOrder = getReviewSectionOrder(category, subCategory);

  return (
    <div className="container-narrow" style={{ padding: "48px 24px" }}>
      <StepIndicator current={step} steps={STEPS} />
      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Select Claim Category</h2>
            <p style={{ margin: "4px 0 0" }}>Choose the type of policy claim you are preparing.</p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: 16,
              marginBottom: 28,
            }}
          >
            {[
              {
                name: "Car Insurance",
                icon: "🚗",
                badge: "Vehicle & Collision",
                desc: "Vehicle damage, collision & comprehensive claims",
              },
              {
                name: "Health",
                icon: "🏥",
                badge: "Medical & Clinical",
                desc: "Diagnosis, treatments, procedures & hospital receipts",
              },
              {
                name: "Loan Application",
                icon: "🏠",
                badge: "Property & Asset",
                desc: "Collateral condition, property damage & asset verification",
              },
            ].map((cat) => {
              const isSelected = category === cat.name;
              return (
                <div
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className={`category-card ${isSelected ? "selected" : ""}`}
                >
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        background: "var(--accent)",
                        color: "white",
                        borderRadius: "50%",
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 34,
                      lineHeight: 1,
                      background: isSelected ? "white" : "var(--bg)",
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                      {cat.name}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isSelected ? "var(--accent)" : "var(--text-muted)",
                        background: isSelected ? "white" : "var(--bg)",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {cat.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {cat.desc}
                  </div>
                </div>
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

          <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => navigate("/get-started")}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCategoryNext}
              disabled={!!loadingMsg}
              style={{ padding: "12px 28px", fontSize: 15 }}
            >
              {loadingMsg ? (
                <LoadingLabel icon="🏢" text={loadingMsg} />
              ) : (
                "Continue to Companies →"
              )}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ marginTop: 0 }}>Select Insurance Provider</h2>
            <p style={{ margin: "4px 0 0" }}>
              Select the insurer to apply company policy screening rules.
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 14,
              marginBottom: 24,
            }}
          >
            {companies.map((c) => {
              const isSelected = companyId === c._id;
              return (
                <div
                  key={c._id}
                  onClick={() => setCompanyId(c._id)}
                  className={`company-card ${isSelected ? "selected" : ""}`}
                  style={{ height: "auto", minHeight: 88 }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: isSelected ? "var(--gradient-brand)" : "var(--accent-soft)",
                      color: isSelected ? "white" : "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    🏢
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span>{c.name}</span>
                      {isSelected && (
                        <span
                          style={{
                            background: "var(--accent)",
                            color: "white",
                            borderRadius: "50%",
                            width: 18,
                            height: 18,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    {c.summary ? (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.45, wordBreak: "break-word" }}>
                        {c.summary}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontWeight: 600 }}>
                        Policy rules available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setStep(3)}
              disabled={!companyId}
            >
              Continue to Evidence →
            </button>
          </div>
        </div>
      )}

      {step === 3 &&
        (loadingMsg ? (
          <div className="card" style={{ textAlign: "center", padding: 56 }}>
            <div
              style={{
                fontSize: 48,
                marginBottom: 16,
                display: "inline-block",
                animation: "floatY 2s ease-in-out infinite",
              }}
            >
              🔍
            </div>
            <h2 style={{ marginTop: 0, fontSize: 24 }}>{loadingMsg}</h2>
            <p style={{ color: "var(--text-muted)", maxWidth: 400, margin: "8px auto 0" }}>
              Our multimodal vision model is analyzing your uploaded photos and identifying visible regions...
            </p>
          </div>
        ) : (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Upload Evidence</h2>
            <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: 14 }}>
              Upload photos, PDFs, Word documents, or text files as supporting evidence.
              You can add as many files as needed.
            </p>

            {/* Drop zone */}
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 36,
                textAlign: "center",
                color: "var(--text-muted)",
                cursor: "pointer",
                background: "var(--bg)",
                transition: "border-color 0.2s ease, background 0.2s ease",
              }}
              onClick={() => document.getElementById("evidenceInput").click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = Array.from(e.dataTransfer.files);
                setImageFiles((prev) => {
                  const existing = new Set(prev.map((f) => f.name + f.size));
                  const fresh = dropped.filter((f) => !existing.has(f.name + f.size));
                  return [...prev, ...fresh];
                });
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                Click to browse or drag &amp; drop files here
              </div>
              <div style={{ fontSize: 12 }}>
                Images (JPG, PNG, WEBP) · PDF · DOCX · TXT
              </div>
              <input
                id="evidenceInput"
                type="file"
                multiple
                accept="image/*,.pdf,.docx,.doc,.txt"
                style={{ display: "none" }}
                onChange={(e) => {
                  const selected = Array.from(e.target.files);
                  setImageFiles((prev) => {
                    const existing = new Set(prev.map((f) => f.name + f.size));
                    const fresh = selected.filter((f) => !existing.has(f.name + f.size));
                    return [...prev, ...fresh];
                  });
                  // reset so same file can be re-added after removal
                  e.target.value = "";
                }}
              />
            </div>

            {/* File list with remove buttons */}
            {imageFiles.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-faint)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: 10,
                  }}
                >
                  Selected files ({imageFiles.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    let imgIdx = 0;
                    return imageFiles.map((file, idx) => {
                    const isImage = file.type.startsWith("image/");
                    const previewSrc = isImage ? imagePreviews[imgIdx++] : null;
                    const ext = file.name.split(".").pop().toUpperCase();
                    return (
                      <div
                        key={`${file.name}-${file.size}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          borderRadius: "var(--radius)",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {/* Thumbnail or icon */}
                        {isImage && previewSrc ? (
                          <img
                            src={previewSrc}
                            alt={file.name}
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: "cover",
                              borderRadius: 6,
                              border: "1px solid var(--border)",
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 6,
                              background: "var(--accent-soft)",
                              border: "1px solid var(--border)",
                              flexShrink: 0,
                              fontSize: 9,
                              fontWeight: 800,
                              color: "var(--accent)",
                              letterSpacing: "0.02em",
                              gap: 2,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>
                              {ext === "PDF" ? "📄" : ext === "DOCX" || ext === "DOC" ? "📝" : "📃"}
                            </span>
                            <span>{ext}</span>
                          </div>
                        )}

                        {/* File name + size */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--text)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {file.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                            {(file.size / 1024).toFixed(0)} KB
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() =>
                            setImageFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          title="Remove file"
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-faint)",
                            fontSize: 18,
                            lineHeight: 1,
                            padding: "2px 6px",
                            borderRadius: 4,
                            flexShrink: 0,
                            transition: "color 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.target.style.color = "#c0362f")}
                          onMouseLeave={(e) => (e.target.style.color = "var(--text-faint)")}
                        >
                          ×
                        </button>
                      </div>
                    );
                    });
                  })()}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEvidenceSubmit}
                disabled={imageFiles.length === 0}
              >
                Analyze Evidence →
              </button>
            </div>
          </div>
        ))}

      {step === 4 && (
        loadingMsg ? (
          <div className="drafting-loader-card">
            <div
              style={{
                fontSize: 54,
                marginBottom: 16,
                display: "inline-block",
                animation: "floatY 2s ease-in-out infinite",
              }}
            >
              ✍️
            </div>
            <h2
              style={{
                marginTop: 0,
                fontSize: 26,
                background: "var(--gradient-brand)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {loadingMsg}
            </h2>
            <p style={{ color: "var(--text-muted)", maxWidth: 440, margin: "12px auto 24px" }}>
              Synthesizing photo evidence descriptions and form entries into factual, atomic claim statements...
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <span className="pill" style={{ background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12 }}>
                🔍 Cross-Referencing Evidence
              </span>
              <span className="pill" style={{ background: "var(--gradient-brand-soft)", color: "var(--accent-2)", fontSize: 12 }}>
                ⚡ Formulating Atomic Claims
              </span>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ marginTop: 0 }}>Car Insurance Claim Form</h2>
              <p style={{ margin: "4px 0 0" }}>
                Please fill in the claim form details below to complete your claim draft.
              </p>
            </div>

            {irrelevantImageNames.length > 0 && (
              <Alert style={{ background: "var(--status-missing-bg)", border: "1px solid var(--status-missing-border)", color: "var(--status-missing-text)", marginBottom: 16 }}>
                <AlertDescription style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <strong style={{ display: "block", marginBottom: 2 }}>Irrelevant Photo Warning</strong>
                    One or more uploaded photos are not relevant to <strong>{category}</strong> and will be ignored during contradiction checking:
                    <span style={{ display: "block", fontWeight: 700, marginTop: 4, fontFamily: "monospace" }}>
                      {irrelevantImageNames.join(", ")}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Sticky Evidence Preview Bar - Freezes at top when scrolling */}
            {(imagePreviews.length > 0 || nonImageFiles.length > 0) && (
              <div className="sticky-evidence-bar">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "var(--accent)",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    📌 Attached Evidence
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      background: "var(--accent-soft)",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                  >
                    {imageFiles.length} file{imageFiles.length > 1 ? "s" : ""}
                  </span>
                </div>
                {renderEvidenceThumbnails()}
              </div>
            )}



            <div style={{ marginTop: 28, display: "flex", gap: 10, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <Button variant="brandSecondary" onClick={() => setStep(3)}>
                ← Back
              </Button>
              <Button
                variant="brand"
                onClick={handleAnswersSubmit}
                disabled={!!loadingMsg}
                style={{ padding: "12px 28px", fontSize: 15 }}
              >
                Draft My Claim →
              </Button>
            </div>
          </div>
        )
      )}

      {step === 5 && (
        <div>
          {/* ── Normal cards — shown at the top (before scrolling) ── */}
          <div
            className="card"
            style={{
              background: "var(--status-review-bg)",
              marginBottom: 16,
              border: "1px solid var(--status-review-border)",
            }}
          >
            <strong>AI-generated draft — not yet submitted or approved.</strong>{" "}
            Review and edit anything below before confirming.
          </div>

          {irrelevantImageNames.length > 0 && (
            <Alert style={{ background: "var(--status-missing-bg)", border: "1px solid var(--status-missing-border)", color: "var(--status-missing-text)", marginBottom: 16 }}>
              <AlertDescription style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <div>
                  <strong style={{ display: "block", marginBottom: 2 }}>Irrelevant Photo Warning</strong>
                  One or more uploaded photos are not relevant to <strong>{category}</strong> and will be ignored during contradiction checking:
                  <span style={{ display: "block", fontWeight: 700, marginTop: 4, fontFamily: "monospace" }}>
                    {irrelevantImageNames.join(", ")}
                  </span>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {(imagePreviews.length > 0 || nonImageFiles.length > 0) && (
            <div
              className="card"
              style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-faint)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                Evidence
              </span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {imagePreviews.map((src, i) => {
                  const fileObj = imageFiles.filter((f) => f.type.startsWith("image/"))[i];
                  const descObj = fileObj ? descriptions.find(d => d.filename === fileObj.name) : null;
                  const isIrrelevant = descObj && descObj.is_relevant === false;

                  return (
                    <div key={`img-${i}`} style={{ position: "relative", display: "inline-block" }}>
                      <img
                        src={src}
                        alt={`Evidence ${i + 1}`}
                        onClick={() => openLightbox(i)}
                        style={{
                          width: 52,
                          height: 52,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: isIrrelevant ? "2px solid var(--destructive)" : "1px solid var(--border)",
                          cursor: "pointer",
                          transition: "transform 0.15s ease",
                          opacity: isIrrelevant ? 0.6 : 1,
                        }}
                        title={isIrrelevant ? `${fileObj.name} is analyzed as irrelevant to ${category}` : fileObj.name}
                        onMouseEnter={(e) => (e.target.style.transform = "scale(1.1)")}
                        onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
                      />
                      {isIrrelevant && (
                        <div
                          style={{
                            position: "absolute",
                            top: -4,
                            right: -4,
                            background: "var(--destructive)",
                            color: "white",
                            borderRadius: "50%",
                            width: 16,
                            height: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            fontWeight: "bold",
                            pointerEvents: "none",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          }}
                          title="Not relevant to claim category"
                        >
                          ⚠️
                        </div>
                      )}
                    </div>
                  );
                })}
                {nonImageFiles.map((f, i) => (
                  <div
                    key={`doc-${i}`}
                    title={f.name}
                    onClick={() => openLightbox(imagePreviews.length + i)}
                    style={{
                      width: 52,
                      height: 52,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      borderRadius: 8,
                      border: "1.5px solid var(--border)",
                      background: "var(--bg)",
                      cursor: "pointer",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    📄
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <strong>💡 Suggestions (optional)</strong>
            {suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <p key={i} style={{ fontSize: 13, margin: "6px 0 0" }}>
                  {s.message}
                </p>
              ))
            ) : (
              <p style={{ fontSize: 13, margin: "6px 0 0", color: "var(--text-muted)" }}>
                No additional suggestions detected.
              </p>
            )}
          </div>

          {/* ── Fixed overlay bar — only visible when user has scrolled down ── */}
          <div className={`draft-sticky-overlay${draftHeaderScrolled ? " visible" : ""}`}>
            {/* Badge */}
            <span className="draft-sticky-badge">🤖 AI Draft</span>
            <span className="draft-sticky-sep">·</span>

            {/* Evidence thumbs */}
            {(imagePreviews.length > 0 || nonImageFiles.length > 0) && (
              <>
                <span className="draft-sticky-label">Evidence</span>
                <div className="draft-sticky-thumbs">
                  {imagePreviews.map((src, i) => {
                    const fileObj = imageFiles.filter((f) => f.type.startsWith("image/"))[i];
                    const descObj = fileObj ? descriptions.find(d => d.filename === fileObj.name) : null;
                    const isIrrelevant = descObj && descObj.is_relevant === false;

                    return (
                      <div key={`img-${i}`} style={{ position: "relative", display: "inline-block" }}>
                        <img
                          src={src}
                          alt={`Evidence ${i + 1}`}
                          className="draft-thumb-sm"
                          onClick={() => openLightbox(i)}
                          style={{
                            cursor: "pointer",
                            border: isIrrelevant ? "1.5px solid var(--destructive)" : "none",
                            opacity: isIrrelevant ? 0.6 : 1,
                          }}
                          title={isIrrelevant ? `${fileObj.name} is analyzed as irrelevant to ${category}` : fileObj.name}
                        />
                        {isIrrelevant && (
                          <div
                            style={{
                              position: "absolute",
                              top: -2,
                              right: -2,
                              background: "var(--destructive)",
                              color: "white",
                              borderRadius: "50%",
                              width: 12,
                              height: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 7,
                              fontWeight: "bold",
                              pointerEvents: "none",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                            }}
                          >
                            ⚠️
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {nonImageFiles.map((f, i) => (
                    <div
                      key={`doc-${i}`}
                      className="draft-thumb-sm draft-thumb-doc-sm"
                      title={f.name}
                      onClick={() => openLightbox(imagePreviews.length + i)}
                      style={{ cursor: "pointer" }}
                    >
                      📄
                    </div>
                  ))}
                </div>
                <span className="draft-sticky-sep">·</span>
              </>
            )}

            {/* Suggestions inline */}
            {suggestions.length > 0 ? (
              <span className="draft-sticky-hint">
                💡 {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""}
                {" — "}
                {suggestions[0].message}
                {suggestions.length > 1 && ` (+${suggestions.length - 1} more)`}
              </span>
            ) : (
              <span className="draft-sticky-hint">
                Not yet submitted — review before confirming.
              </span>
            )}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>{category} Claim Form — Draft</h2>

            <Accordion type="multiple" defaultValue={reviewSectionOrder} className="mb-6 mt-4">
              {reviewSectionOrder.map((section) => (
                <AccordionItem key={section} value={section}>
                  <AccordionTrigger className="text-[15px] font-semibold">{section}</AccordionTrigger>
                  <AccordionContent>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      {(templateBySection[section] || []).map((f) => {
                        const isReq = f.id === "first_name" || f.id === "last_name" || (category === "Car Insurance" && (f.id === "vehicle_vin" || f.id === "license_plate"));
                        
                        return (
                          <div key={f.id} style={{ marginBottom: 0, gridColumn: (f.type === "table" || f.id === "incident_circumstances" || f.id === "additional_information" || f.id === "injuries_description" || f.id === "damage_to_other_vehicle" || f.id === "medical_facilities_visited") ? "1 / -1" : "auto" }}>
                            <Label htmlFor={f.id} className="text-xs font-bold block mb-1" style={{ color: "var(--text-faint)" }}>
                              {f.label.toUpperCase()} {isReq && <span style={{ color: "var(--destructive)" }}>*</span>}
                            </Label>
                            {f.type === "dropdown" ? (
                              <select
                                id={f.id}
                                value={answers[f.id] || ""}
                                onChange={(e) => setAnswer(f.id, e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--bg-base)" }}
                              >
                                <option value="">Select...</option>
                                {f.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : f.type === "table" ? (
                              <div style={{ border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                  <thead>
                                    <tr style={{ background: "var(--bg-base)", borderBottom: "1px solid var(--border)" }}>
                                      {f.columns.map(col => <th key={col.id} style={{ padding: "8px 12px", textAlign: "left" }}>{col.label}</th>)}
                                      <th style={{ width: 40 }}></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(answers[f.id] || []).map((row, rIdx) => (
                                      <tr key={rIdx} style={{ borderBottom: "1px solid var(--border)" }}>
                                        {f.columns.map(col => (
                                          <td key={col.id} style={{ padding: "8px" }}>
                                            <Input 
                                              value={row[col.id] || ""} 
                                              placeholder={col.placeholder || ""} 
                                              onChange={(e) => handleTableChange(f.id, rIdx, col.id, e.target.value)}
                                              style={{ height: 32, fontSize: 13 }}
                                            />
                                          </td>
                                        ))}
                                        <td style={{ textAlign: "center" }}>
                                          <button onClick={() => handleRemoveTableRow(f.id, rIdx)} style={{ color: "var(--destructive)", padding: 4 }}>×</button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div style={{ padding: "8px", background: "var(--bg-base)" }}>
                                  <Button variant="outline" size="sm" onClick={() => handleAddTableRow(f.id)}>+ Add Item</Button>
                                </div>
                              </div>
                            ) : f.id.includes("date") ? (
                              <Input 
                                type="text"
                                id={f.id} 
                                value={answers[f.id] || ""} 
                                onChange={(e) => setAnswer(f.id, e.target.value)} 
                                placeholder="e.g. 2026-05-12"
                              />
                            ) : f.id === "incident_circumstances" || f.id === "additional_information" || f.id === "injuries_description" || f.id === "damage_to_other_vehicle" || f.id === "medical_facilities_visited" ? (
                              <Textarea
                                id={f.id} 
                                value={answers[f.id] || ""} 
                                onChange={(e) => setAnswer(f.id, e.target.value)} 
                                placeholder={f.placeholder || ""}
                                rows={3}
                              />
                            ) : (
                              <Input 
                                id={f.id} 
                                value={answers[f.id] || ""} 
                                onChange={(e) => setAnswer(f.id, e.target.value)} 
                                placeholder={f.placeholder || ""}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {subCategory !== "theft" && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 15, marginBottom: 10 }}>
                  Damage Assessment
                </h3>

                <Label
                  className="text-xs font-bold block mb-2"
                  style={{ color: "var(--text-faint)" }}
                >
                  DESCRIPTION OF DAMAGE TO YOUR VEHICLE (FROM EVIDENCE ANALYSIS)
                </Label>
                {(() => {
                  const renderClaim = (c, i) => {
                    const cleanText = (c.claim_text || "").replace(
                      /^\[UNVERIFIED\s*—\s*[^\]]+\]\s*/i,
                      ""
                    );
                    const needsReview =
                      c.needs_human_verification ||
                      (c.claim_text && c.claim_text.includes("[UNVERIFIED"));

                    return (
                      <div key={c.id || i} style={{ marginBottom: 14 }}>
                        <Textarea
                          ref={autoResize}
                          rows={1}
                          value={cleanText}
                          onChange={(e) => {
                            updateClaimText(i, e.target.value);
                            autoResize(e.target);
                          }}
                          style={{
                            resize: "none",
                            overflow: "hidden",
                            fontFamily: "inherit",
                            ...(needsReview
                              ? {
                                  borderColor: "var(--status-missing-border)",
                                  borderLeft: "4px solid var(--status-missing-text)",
                                  background: "var(--status-missing-bg)",
                                  fontWeight: 500,
                                }
                              : {}),
                          }}
                        />
                        {needsReview && (
                          <TooltipProvider>
                            <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Badge role="status" variant="outline" className="text-[11px] font-bold" style={{ background: "var(--status-missing-bg)", color: "var(--status-missing-text)", borderColor: "var(--status-missing-border)" }}>
                                Needs Review
                              </Badge>
                              {(c.verification_reasons || []).map((r) => (
                                <Tooltip key={r}>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="cursor-help text-[11px]" style={{ background: "white", color: "var(--status-missing-text)", borderColor: "var(--status-missing-border)" }}>
                                      {REASON_LABELS[r] || r}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{REASON_LABELS[r] || r}</TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          </TooltipProvider>
                        )}
                      </div>
                    );
                  };

                  if (subCategory === "collision") {
                    return ["Body work", "Chassis", "Accessories & Lamps", "Tyres"].map(group => {
                      const groupClaims = (claims || []).filter(c => c.component_category === group || (!c.component_category && group === "Body work"));
                      if (groupClaims.length === 0) return null;
                      return (
                        <div key={group} style={{ marginBottom: 20 }}>
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>{group}</h4>
                          {groupClaims.map(c => renderClaim(c, claims.indexOf(c)))}
                        </div>
                      );
                    });
                  } else {
                    return (claims || []).map((c, i) => renderClaim(c, i));
                  }
                })()}

              </div>
            )}

            {(templateBySection["Damage Assessment"] || []).map((f) => (
              <div key={f.id} style={{ marginBottom: 12, marginTop: 16 }}>
                <Label htmlFor={f.id} className="text-xs font-bold block mb-1" style={{ color: "var(--text-faint)" }}>
                  {f.label.toUpperCase()}
                </Label>
                <Input
                  id={f.id}
                  type="text"
                  value={answers[f.id] || ""}
                  onChange={(e) => setAnswer(f.id, e.target.value)}
                />
              </div>
            ))}

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>
                Additional Information
              </h3>
              {(templateBySection["Additional Information"] || []).map((f) => (
                <Textarea
                  key={f.id}
                  id={f.id}
                  rows={3}
                  value={answers[f.id] || ""}
                  onChange={(e) => setAnswer(f.id, e.target.value)}
                />
              ))}
            </div>

            <div
              className="card"
              style={{
                background: "var(--bg)",
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              <strong>Declaration:</strong> I declare that the information
              provided is true and accurate to the best of my knowledge. I
              understand that providing false information may result in the
              denial of my claim.
              <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
                Date: {new Date().toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="brandSecondary" onClick={() => setStep(4)}>
                ← Back
              </Button>
              <Button
                variant="brandSecondary"
                onClick={handleDownload}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <LoadingLabel icon="⬇️" text="Generating PDF..." />
                ) : (
                  "Download PDF"
                )}
              </Button>

              <Button
                variant="brand"
                onClick={handleApplyForClaim}
                disabled={!!loadingMsg || !pdfDownloaded}
              >
                {loadingMsg ? (
                  <LoadingLabel icon="📤" text={loadingMsg} />
                ) : (
                  "🚀 Apply for Claim Now"
                )}
              </Button>
            </div>
            {!pdfDownloaded && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 8,
                }}
              >
                Download your claim PDF before submitting.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Evidence Lightbox ── */}
      <Dialog open={lightboxIdx !== null} onOpenChange={(o) => !o && closeLightbox()}>
        <DialogContent className="max-w-3xl">

          {lightboxIdx !== null && allEvidenceFiles.length > 0 && (() => {
            const file = allEvidenceFiles[lightboxIdx];
            const previewUrl = allFilePreviews[lightboxIdx];
            const isImg = file?.type?.startsWith("image/");
            const isPdf = file?.type === "application/pdf";
            const ext = file?.name?.split(".").pop()?.toUpperCase() || "";
            return (
              <div>
                <div className="mb-2 text-sm text-muted-foreground">{lightboxIdx + 1} / {allEvidenceFiles.length}</div>
                {isImg && previewUrl ? (
                  <img src={previewUrl} alt={file?.name || "Evidence"} className="max-h-[60vh] w-full object-contain" />
                ) : isPdf && previewUrl ? (
                  <iframe src={previewUrl} style={{ width: "100%", height: "55vh", border: "1px solid var(--border)", borderRadius: 8 }} title={file?.name || "PDF Document"} />
                ) : (
                  <div className="py-14 text-center">
                    <FileText size={56} className="mx-auto mb-4" color="var(--accent)" />
                    <div className="font-semibold text-lg mb-1">{file?.name || "Document"}</div>
                    <div className="text-sm text-muted-foreground mb-5">{ext} · {file ? (file.size / 1024).toFixed(0) : 0} KB</div>
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ textDecoration: "none", fontSize: 13, padding: "8px 20px", display: "inline-flex", borderRadius: 999 }}
                      >
                        Open Document in New Tab
                      </a>
                    )}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <Button variant="brandSecondary" onClick={prevLightbox} disabled={allEvidenceFiles.length < 2}>‹ Prev</Button>
                  <span className="truncate px-3 text-sm font-semibold">{file?.name}</span>
                  <Button variant="brandSecondary" onClick={nextLightbox} disabled={allEvidenceFiles.length < 2}>Next ›</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
