import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminGetApplication, adminDecideApplication, reviewClaim } from "../api";
import {
  ArrowLeft, CheckCircle2, XCircle, FileText, Loader2, Clock,
  Check, Edit, Flag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Attachment } from "@/components/ui/attachment";
import { ButtonGroup } from "@/components/ui/button-group";

const STATUS_STYLES = {
  submitted: { label: "Submitted", color: "var(--text-muted)", bg: "var(--bg-surface)" },
  ai_reviewing: { label: "AI Reviewing", color: "#f59e0b", bg: "#fef3c7" },
  admin_pending: { label: "Pending Review", color: "#3b82f6", bg: "#dbeafe" },
  approved: { label: "Approved", color: "var(--status-supported-text)", bg: "var(--status-supported-bg)" },
  denied: { label: "Denied", color: "var(--status-contradicted-text)", bg: "var(--status-contradicted-bg)" },
  sent_back_for_more_evidence: { label: "Awaiting Evidence", color: "#ec4899", bg: "#fce7f3" },
};

const VERDICT_STYLES = {
  supported: { color: "var(--status-supported-text)", bg: "var(--status-supported-bg)", label: "Supported" },
  contradicted: { color: "var(--status-contradicted-text)", bg: "var(--status-contradicted-bg)", label: "Contradicted" },
  missing_expected_evidence: { color: "var(--status-missing-text)", bg: "var(--status-missing-bg)", label: "Missing Evidence" },
  insufficient_evidence: { color: "var(--status-review-text)", bg: "var(--status-review-bg)", label: "Insufficient" },
  conflicting_evidence: { color: "#f59e0b", bg: "#fef3c7", label: "Conflicting" },
};

export default function AdminApplicationReview() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(""); // "approved" | "denied"
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [submittingReview, setSubmittingReview] = useState(false);
  const [activeFlaggingClaimId, setActiveFlaggingClaimId] = useState(null);
  const [flagNoteText, setFlagNoteText] = useState("");
  const [activeOverridingClaimId, setActiveOverridingClaimId] = useState(null);
  const [overrideVerdictText, setOverrideVerdictText] = useState("");
  const [overrideNoteText, setOverrideNoteText] = useState("");

  const [lightboxIdx, setLightboxIdx] = useState(null);

  const allEvidenceFiles = app ? [...(app.evidence_image_names || []), ...(app.evidence_document_names || [])] : [];
  const closeLightbox = () => setLightboxIdx(null);
  const nextLightbox = () => setLightboxIdx((prev) => (prev === null ? null : (prev + 1) % allEvidenceFiles.length));
  const prevLightbox = () => setLightboxIdx((prev) => (prev === null ? null : (prev - 1 + allEvidenceFiles.length) % allEvidenceFiles.length));

  const loadApp = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await adminGetApplication(caseId);
      setApp(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadApp(true);
  }, [caseId]);

  const handleDecide = async () => {
    if (!decision) { setSubmitError("Please select Approve or Deny."); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      await adminDecideApplication(caseId, decision, note);
      navigate("/admin");
    } catch (err) {
      setSubmitError(err.response?.data?.detail || err.message);
      setSubmitting(false);
    }
  };

  const handleAcceptClaim = async (claimId) => {
    setSubmittingReview(true);
    try {
      await reviewClaim(caseId, claimId, "accept", null, "");
      await loadApp();
    } catch (err) {
      alert("Error reviewing claim: " + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleFlagClaim = async (claimId) => {
    if (!flagNoteText.trim()) return;
    setSubmittingReview(true);
    try {
      await reviewClaim(caseId, claimId, "flag", null, flagNoteText);
      setActiveFlaggingClaimId(null);
      setFlagNoteText("");
      await loadApp();
    } catch (err) {
      alert("Error reviewing claim: " + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleOverrideClaim = async (claimId) => {
    setSubmittingReview(true);
    try {
      await reviewClaim(caseId, claimId, "override", overrideVerdictText, overrideNoteText);
      setActiveOverridingClaimId(null);
      setOverrideVerdictText("");
      setOverrideNoteText("");
      await loadApp();
    } catch (err) {
      alert("Error reviewing claim: " + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleResetClaimReview = async (claimId) => {
    setSubmittingReview(true);
    try {
      await reviewClaim(caseId, claimId, "accept", null, "");
      await loadApp();
    } catch (err) {
      alert("Error resetting review: " + (err.response?.data?.detail || err.message));
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: 16 }}>Loading application...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="container" style={{ padding: "32px 24px" }}>
        <p style={{ color: "var(--status-contradicted-text)" }}>{error || "Application not found."}</p>
        <Button variant="brandSecondary" onClick={() => navigate("/admin")} className="mt-3">
          ← Back to Admin
        </Button>
      </div>
    );
  }

  const st = STATUS_STYLES[app.application_status] || STATUS_STYLES.submitted;
  const catLabel = { car_insurance: "Car Insurance", health_insurance: "Health Insurance", loan_application: "Property / Home" };
  const alreadyDecided = ["approved", "denied", "sent_back_for_more_evidence"].includes(app.application_status);

  return (
    <div className="container" style={{ padding: "32px 24px", maxWidth: 880 }}>
      <Button variant="brandSecondary" onClick={() => navigate("/admin")} className="mb-6 gap-1.5 text-[13px]">
        <ArrowLeft size={14} /> Back to Queue
      </Button>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, gap: 16 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: "var(--accent)", marginBottom: 4 }}>
            {app.reference_number}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {catLabel[app.category] || app.category} · {app.company_name} · {app.document_name}
          </div>
        </div>
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: st.bg, color: st.color, borderColor: "transparent" }}>
          {st.label}
        </Badge>
      </div>

      {/* Submission info */}
      <Card style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "16px 20px", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>SUBMITTED</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            {new Date(app.submitted_at || app.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>USER ID</div>
          <div style={{ fontSize: 13, fontFamily: "monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>
            {app.applicant_user_id || "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>EVIDENCE FILES</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            {(app.evidence_image_names?.length || 0) + (app.evidence_document_names?.length || 0)} files
          </div>
        </div>
      </Card>

      {/* Deterministic Verification (Tiers 0 & 1) */}
      {app.tier_results && app.tier_results.length > 0 && (
        <Card style={{ padding: "20px 22px", marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            System Integrity & Business Rules
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-faint)" }}>
              (Tiers 0 & 1)
            </span>
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {app.tier_results.map((tr, i) => {
              const trColor = tr.passed ? "var(--status-supported-text)" : (tr.fatal ? "var(--status-contradicted-text)" : "var(--status-review-text)");
              const trBg = tr.passed ? "var(--status-supported-bg)" : (tr.fatal ? "var(--status-contradicted-bg)" : "var(--status-review-bg)");
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 16px",
                  background: "var(--bg-surface)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  borderLeft: `4px solid ${trColor}`
                }}>
                  <div style={{ fontSize: 18, marginTop: 2 }}>{tr.passed ? "✅" : (tr.fatal ? "❌" : "⚠️")}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{tr.name}</div>
                      <Badge variant="outline" style={{ background: trBg, color: trColor, borderColor: "transparent", fontSize: 10, padding: "0 6px", height: 18 }}>
                        Tier {tr.tier}
                      </Badge>
                      {!tr.passed && tr.fatal && (
                        <Badge variant="outline" style={{ background: "var(--destructive)", color: "white", borderColor: "transparent", fontSize: 10, padding: "0 6px", height: 18 }}>
                          FATAL
                        </Badge>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{tr.details}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Raw Image Detection Cache (Always visible if available) */}
      {app.generation_descriptions && app.generation_descriptions.length > 0 && (
        <Card style={{ padding: "20px 22px", marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            AI Evidence Detection
            <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-faint)" }}>
              (Raw Vision Output)
            </span>
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {app.generation_descriptions.map((desc, i) => (
              <div key={i} style={{ background: "var(--bg-surface)", padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span>{desc.filename || "Document Extract"}</span>
                  {desc.source === "document" && (
                    <Badge variant="outline" style={{ fontSize: 10, padding: "0 6px", height: 18 }}>Text Extracted</Badge>
                  )}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {desc.description}
                </div>
                {desc.visible_regions && desc.visible_regions.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {desc.visible_regions.map(r => (
                      <Badge key={r} variant="secondary" style={{ fontSize: 11, padding: "2px 8px", fontWeight: 500, background: "#f3f4f6", color: "#374151" }}>
                        {r}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* AI Analysis */}
      <Card style={{ padding: "20px 22px", marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          AI Analysis
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-faint)" }}>
            ({app.claims_checked?.length || 0} claims checked)
          </span>
        </h3>

        {(!app.claims_checked || app.claims_checked.length === 0) ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            AI analysis results are not yet available for this application.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {app.claims_checked.map((claim, i) => {
              const vs = VERDICT_STYLES[claim.final_verdict] || { color: "var(--text-muted)", bg: "var(--bg-surface)", label: "—" };
              return (
                <div
                  key={claim.claim_id || i}
                  style={{
                    borderLeft: `4px solid ${vs.color}`,
                    paddingLeft: 14,
                    paddingTop: 10,
                    paddingBottom: 10,
                    paddingRight: 12,
                    background: "var(--bg-surface)",
                    borderRadius: "8px",
                    borderWidth: "1px 1px 1px 4px",
                    borderColor: "var(--border) var(--border) var(--border) " + vs.color,
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* 1. Claim Statement */}
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
                        <span>Claim Statement</span>
                        {claim.reviewed_by_human && (
                          <Badge variant="outline" className="whitespace-nowrap text-[10px] font-semibold py-0" style={{ background: "#e0f2fe", color: "#0369a1", borderColor: "transparent", height: 18 }}>
                            Human Checked
                          </Badge>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{claim.claim_text}</div>
                    </div>

                    {/* 2. AI Evidence Description */}
                    {app.generation_descriptions?.find(d => d.filename === claim.evidence_image) && (
                      <div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>AI Evidence Description ({claim.evidence_image})</div>
                        <div style={{ fontSize: 13, background: "var(--bg-base)", padding: "8px 12px", borderRadius: 6, color: "var(--text)", border: "1px solid var(--border)" }}>
                          {app.generation_descriptions.find(d => d.filename === claim.evidence_image).description}
                        </div>
                      </div>
                    )}

                    {/* 3. Grounding Verdict */}
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Grounding Verdict</div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <Badge variant="outline" className="whitespace-nowrap text-[11px] font-semibold mt-0.5" style={{ background: vs.bg, color: vs.color, borderColor: "transparent" }}>
                          {vs.label}
                        </Badge>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", flex: 1, lineHeight: 1.4 }}>{claim.explanation || "No explanation provided."}</div>
                      </div>
                    </div>

                    {/* 4. Policy Reasoning */}
                    {claim.policy_decision && (
                      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                        <div style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>Policy Reasoning</span>
                          <Badge variant="outline" className="text-[10px] font-bold py-0" style={{ 
                            background: claim.policy_decision.status === 'accepted' ? 'var(--status-supported-bg)' : claim.policy_decision.status === 'rejected' ? 'var(--status-contradicted-bg)' : 'var(--status-review-bg)',
                            color: claim.policy_decision.status === 'accepted' ? 'var(--status-supported-text)' : claim.policy_decision.status === 'rejected' ? 'var(--status-contradicted-text)' : 'var(--status-review-text)',
                            borderColor: "transparent", border: "none", height: 18
                          }}>
                            {claim.policy_decision.status.toUpperCase()}
                          </Badge>
                        </div>
                        
                        {claim.policy_decision.layer_2_reasoning && (
                          <div style={{ fontSize: 13, color: "var(--text)", marginBottom: 12, fontStyle: "italic", background: "var(--bg-base)", padding: "8px 12px", borderRadius: 6, borderLeft: "3px solid var(--text-faint)" }}>
                            "{claim.policy_decision.layer_2_reasoning}"
                          </div>
                        )}
                        
                        {claim.policy_decision.rule_check_results?.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--bg-base)", padding: 12, borderRadius: 6, border: "1px solid var(--border)" }}>
                            {claim.policy_decision.rule_check_results.map((r, idx) => (
                              <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "flex-start" }}>
                                <span style={{ fontSize: 14, lineHeight: 1 }}>{r.passed ? "✅" : "❌"}</span>
                                <div>
                                  <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{r.rule_description}</div>
                                  <div style={{ color: "var(--text-faint)", fontSize: 11, fontFamily: "monospace" }}>Citation: {r.cited_clause}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* If human reviewed, show the details of the review */}
                  {claim.reviewed_by_human && (
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, padding: "8px 12px", background: "var(--bg-base)", borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        {claim.needs_more_evidence ? (
                          <span>🚩 <strong>Needs evidence:</strong> {claim.reviewer_note || "No note left."}</span>
                        ) : claim.reviewer_override && claim.reviewer_override !== "flagged" ? (
                          <span>✏️ <strong>Overridden to {VERDICT_STYLES[claim.reviewer_override]?.label || claim.reviewer_override}:</strong> {claim.reviewer_note || "No note left."}</span>
                        ) : (
                          <span>✅ <strong>AI Verdict Accepted</strong> {claim.reviewer_note && `· ${claim.reviewer_note}`}</span>
                        )}
                      </div>
                      {!alreadyDecided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{ height: "auto", padding: "2px 6px", fontSize: 10, color: "var(--text-faint)" }}
                          onClick={() => handleResetClaimReview(claim.claim_id)}
                          disabled={submittingReview}
                        >
                          Undo
                        </Button>
                      )}
                    </div>
                  )}

                  {/* If not decided yet and not reviewed by human, show review controls */}
                  {!alreadyDecided && !claim.reviewed_by_human && (
                    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <Button
                          variant="brandSecondary"
                          size="sm"
                          className="gap-1 px-2.5 py-1 text-xs font-semibold"
                          style={{ height: 28, background: "#f0fdf4", color: "#166534", border: "none" }}
                          onClick={() => handleAcceptClaim(claim.claim_id)}
                          disabled={submittingReview}
                        >
                          <Check size={12} /> Accept AI
                        </Button>
                        <Button
                          variant="brandSecondary"
                          size="sm"
                          className="gap-1 px-2.5 py-1 text-xs font-semibold"
                          style={{ height: 28, background: "#f5f3ff", color: "#5b21b6", border: "none" }}
                          onClick={() => {
                            setActiveOverridingClaimId(claim.claim_id);
                            setActiveFlaggingClaimId(null);
                            setOverrideVerdictText(claim.final_verdict);
                            setOverrideNoteText("");
                          }}
                          disabled={submittingReview}
                        >
                          <Edit size={12} /> Override
                        </Button>
                        <Button
                          variant="brandSecondary"
                          size="sm"
                          className="gap-1 px-2.5 py-1 text-xs font-semibold"
                          style={{ height: 28, background: "#fff5f9", color: "#be185d", border: "none" }}
                          onClick={() => {
                            setActiveFlaggingClaimId(claim.claim_id);
                            setActiveOverridingClaimId(null);
                            setFlagNoteText("");
                          }}
                          disabled={submittingReview}
                        >
                          <Flag size={12} /> Flag Evidence
                        </Button>
                      </div>

                      {/* Flag/Needs Info Input Form */}
                      {activeFlaggingClaimId === claim.claim_id && (
                        <div style={{ background: "var(--bg-base)", padding: 12, borderRadius: 6, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                          <Label htmlFor={`flag-note-${claim.claim_id}`} style={{ fontSize: 11, fontWeight: 600 }}>Specify what evidence is missing or requested:</Label>
                          <Textarea
                            id={`flag-note-${claim.claim_id}`}
                            value={flagNoteText}
                            onChange={(e) => setFlagNoteText(e.target.value)}
                            placeholder="Explain why this claim needs more proof..."
                            className="min-h-12 text-xs"
                          />
                          <div className="flex justify-end mt-2">
                            <ButtonGroup className="w-auto">
                              <Button size="xs" variant="brandSecondary" onClick={() => setActiveFlaggingClaimId(null)}>Cancel</Button>
                              <Button size="xs" variant="brand" onClick={() => handleFlagClaim(claim.claim_id)} disabled={!flagNoteText.trim()}>Save Flag</Button>
                            </ButtonGroup>
                          </div>
                        </div>
                      )}

                      {/* Override Select & Note Form */}
                      {activeOverridingClaimId === claim.claim_id && (
                        <div style={{ background: "var(--bg-base)", padding: 12, borderRadius: 6, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                          <Label htmlFor={`override-verdict-${claim.claim_id}`} style={{ fontSize: 11, fontWeight: 600 }}>Override Verdict to:</Label>
                          <select
                            id={`override-verdict-${claim.claim_id}`}
                            value={overrideVerdictText}
                            onChange={(e) => setOverrideVerdictText(e.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 12, width: "100%", background: "var(--bg-surface)", color: "var(--text)" }}
                          >
                            {Object.entries(VERDICT_STYLES).map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                          </select>
                          <Label htmlFor={`override-note-${claim.claim_id}`} style={{ fontSize: 11, fontWeight: 600 }}>Explain reason for override (optional):</Label>
                          <Textarea
                            id={`override-note-${claim.claim_id}`}
                            value={overrideNoteText}
                            onChange={(e) => setOverrideNoteText(e.target.value)}
                            placeholder="Adjuster note..."
                            className="min-h-12 text-xs"
                          />
                          <div className="flex justify-end mt-2">
                            <ButtonGroup className="w-auto">
                              <Button size="xs" variant="brandSecondary" onClick={() => setActiveOverridingClaimId(null)}>Cancel</Button>
                              <Button size="xs" variant="brand" onClick={() => handleOverrideClaim(claim.claim_id)}>Save Override</Button>
                            </ButtonGroup>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Evidence files */}
      {((app.evidence_image_names?.length > 0) || (app.evidence_document_names?.length > 0)) && (
        <Card style={{ padding: "20px 22px", marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16 }}>Evidence Files</h3>
          <div className="flex flex-wrap gap-4">
            {app.evidence_image_names?.map((f) => {
              const url = `http://localhost:8000/uploaded_cases/${app._id}/${f}`;
              const idx = allEvidenceFiles.indexOf(f);
              return (
                <Attachment key={f} file={f} url={url} isImage={true} onOpen={() => setLightboxIdx(idx)} />
              );
            })}
            {app.evidence_document_names?.map((f) => {
              const url = `http://localhost:8000/uploaded_cases/${app._id}/${f}`;
              const idx = allEvidenceFiles.indexOf(f);
              return (
                <Attachment key={f} file={f} url={url} isImage={false} onOpen={() => setLightboxIdx(idx)} />
              );
            })}
          </div>
        </Card>
      )}

      {/* Decision Panel */}
      {alreadyDecided ? (
        <Card style={{ padding: "20px 22px", borderLeft: `4px solid ${app.application_status === "approved" ? "var(--status-supported-text)" : app.application_status === "sent_back_for_more_evidence" ? "#ec4899" : "var(--status-contradicted-text)"}` }}>
          <h3 style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            {app.application_status === "approved" && <><CheckCircle2 size={18} color="var(--status-supported-text)" /> Approved</>}
            {app.application_status === "denied" && <><XCircle size={18} color="var(--status-contradicted-text)" /> Denied</>}
            {app.application_status === "sent_back_for_more_evidence" && <><Clock size={18} color="#ec4899" /> Info Requested</>}
          </h3>
          {app.admin_note && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{app.admin_note}</p>}
          <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8 }}>
            Decided on {new Date(app.admin_decided_at).toLocaleString()}
          </p>
        </Card>
      ) : (
        <Card style={{ padding: "22px 24px" }}>
          <h3 style={{ marginBottom: 16 }}>Make a Decision</h3>

          {/* Approve / Deny selector */}
          <ToggleGroup
            type="single"
            value={decision}
            onValueChange={(v) => v && setDecision(v)}
            aria-label="Decision"
            className="mb-4 grid grid-cols-3 gap-3"
          >
            <ToggleGroupItem
              value="approved"
              className="flex h-auto flex-col gap-1.5 rounded-[10px] border-2 py-3.5 data-[state=on]:border-[var(--status-supported-text)] data-[state=on]:bg-[var(--status-supported-bg)]"
            >
              <CheckCircle2 size={22} color={decision === "approved" ? "var(--status-supported-text)" : "var(--text-muted)"} />
              <span style={{ fontWeight: 600, fontSize: 14, color: decision === "approved" ? "var(--status-supported-text)" : "var(--text-muted)" }}>
                Approve
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="denied"
              className="flex h-auto flex-col gap-1.5 rounded-[10px] border-2 py-3.5 data-[state=on]:border-[var(--status-contradicted-text)] data-[state=on]:bg-[var(--status-contradicted-bg)]"
            >
              <XCircle size={22} color={decision === "denied" ? "var(--status-contradicted-text)" : "var(--text-muted)"} />
              <span style={{ fontWeight: 600, fontSize: 14, color: decision === "denied" ? "var(--status-contradicted-text)" : "var(--text-muted)" }}>
                Deny
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem
              value="demand_more_evidence"
              className="flex h-auto flex-col gap-1.5 rounded-[10px] border-2 py-3.5 data-[state=on]:border-[#ec4899] data-[state=on]:bg-[#fce7f3]"
            >
              <Clock size={22} color={decision === "demand_more_evidence" ? "#ec4899" : "var(--text-muted)"} />
              <span style={{ fontWeight: 600, fontSize: 14, color: decision === "demand_more_evidence" ? "#be185d" : "var(--text-muted)" }}>
                Request Info
              </span>
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Note */}
          <Label htmlFor="decision-note" className="mb-1.5 block text-[13px] font-semibold">
            Decision Note <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>(optional — sent to applicant)</span>
          </Label>
          <Textarea
            id="decision-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain the reason for your decision..."
            className="min-h-20"
          />

          {submitError && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Confirmation dialog gates the irreversible action */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="brand" className="mt-4 w-full py-3 text-[15px]" disabled={!decision}>
                {`Confirm ${decision === "approved" ? "Approval" : decision === "denied" ? "Denial" : "Info Request"}`}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {decision === "approved" ? "Confirm Approval" : decision === "denied" ? "Confirm Denial" : "Confirm Info Request"}
                </DialogTitle>
                <DialogDescription>
                  This finalizes the current review for claim <strong>{app.reference_number}</strong> and notifies the applicant. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="brandSecondary" disabled={submitting}>Cancel</Button>
                </DialogClose>
                <Button
                  variant="brand"
                  onClick={handleDecide}
                  disabled={submitting}
                  className="gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? "Submitting..." : `Yes, ${decision === "approved" ? "Approve" : decision === "denied" ? "Deny" : "Request Info"}`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      )}
      {/* ── Evidence Lightbox ── */}
      <Dialog open={lightboxIdx !== null} onOpenChange={(o) => !o && closeLightbox()}>
        <DialogContent className="max-w-3xl">
          {lightboxIdx !== null && allEvidenceFiles.length > 0 && (() => {
            const file = allEvidenceFiles[lightboxIdx];
            const previewUrl = `http://localhost:8000/uploaded_cases/${app._id}/${file}`;
            const isImg = /\.(jpg|jpeg|png)$/i.test(file);
            const isPdf = /\.pdf$/i.test(file);
            const ext = file.split('.').pop().toUpperCase();
            return (
              <div>
                <div className="mb-2 text-sm text-muted-foreground">{lightboxIdx + 1} / {allEvidenceFiles.length}</div>
                {isImg && previewUrl ? (
                  <img src={previewUrl} alt={file || "Evidence"} className="max-h-[60vh] w-full object-contain" />
                ) : isPdf && previewUrl ? (
                  <iframe src={previewUrl} style={{ width: "100%", height: "55vh", border: "1px solid var(--border)", borderRadius: 8 }} title={file || "PDF Document"} />
                ) : (
                  <div className="py-14 text-center">
                    <FileText size={56} className="mx-auto mb-4" color="var(--accent)" />
                    <div className="font-semibold text-lg mb-1">{file || "Document"}</div>
                    <div className="text-sm text-muted-foreground mb-5">{ext}</div>
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ textDecoration: "none", fontSize: 13, padding: "8px 20px", display: "inline-flex", borderRadius: 999, background: "var(--accent)", color: "white" }}
                      >
                        Open Document in New Tab
                      </a>
                    )}
                  </div>
                )}
                <Separator className="mt-4 mb-3" />
                <div className="flex items-center justify-between">
                  <Button variant="brandSecondary" onClick={prevLightbox} disabled={allEvidenceFiles.length < 2}>‹ Prev</Button>
                  <span className="truncate px-3 text-sm font-semibold">{file}</span>
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
