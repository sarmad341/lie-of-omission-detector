import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getApplicationStatus, getApplicationResult, resubmitApplication } from "../api";
import {
  ArrowLeft, Camera, Upload, AlertCircle, Loader2, FileText, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ApplicationResubmitPage() {
  const { referenceNumber } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [documentFiles, setDocumentFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getApplicationStatus(referenceNumber);
        setApp(res.data);
        if (res.data.application_status !== "sent_back_for_more_evidence") {
          setError("This application is not awaiting more evidence.");
          setLoading(false);
          return;
        }

        const rRes = await getApplicationResult(referenceNumber);
        setResult(rRes.data);
      } catch (err) {
        setError(err.response?.data?.detail || err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [referenceNumber]);

  const handleResubmit = async () => {
    if (imageFiles.length === 0 && documentFiles.length === 0) {
      setSubmitError("Please select at least one evidence image or document file to upload.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await resubmitApplication(referenceNumber, imageFiles, documentFiles);
      navigate(`/applications/${referenceNumber}`);
    } catch (err) {
      setSubmitError(err.response?.data?.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeImage = (index) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const removeDoc = (index) => {
    setDocumentFiles(documentFiles.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80, color: "var(--text-muted)" }}>
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ marginTop: 16 }}>Loading application details...</p>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="container" style={{ padding: "32px 24px", maxWidth: 600 }}>
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Application not found."}</AlertDescription>
        </Alert>
        <Button variant="brandSecondary" onClick={() => navigate("/dashboard")}>
          ← Back to Dashboard
        </Button>
      </div>
    );
  }

  const flaggedClaims = result?.claims_checked?.filter((c) => c.needs_more_evidence) || [];

  return (
    <div className="container" style={{ padding: "32px 24px", maxWidth: 680 }}>
      {/* Back button */}
      <Button
        variant="brandSecondary"
        onClick={() => navigate(`/applications/${referenceNumber}`)}
        className="mb-6 gap-1.5 text-[13px]"
      >
        <ArrowLeft size={14} /> Back to Details
      </Button>

      <div style={{ marginBottom: 24 }}>
        <h1>Submit Additional Evidence</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
          Application Reference: <strong style={{ fontFamily: "monospace", color: "var(--accent)" }}>{referenceNumber}</strong>
        </p>
      </div>

      {app.admin_note && (
        <Card style={{ padding: 18, marginBottom: 24, borderLeft: "4px solid #ec4899", background: "#fff5f9" }}>
          <div style={{ fontSize: 11, color: "#be185d", fontWeight: 700, marginBottom: 4 }}>COMPANY REQUEST NOTE</div>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text)" }}>{app.admin_note}</p>
        </Card>
      )}

      {/* Flagged Claims List */}
      <Card style={{ padding: "20px 22px", marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Flagged Claims Requiring Evidence</h3>
        {flaggedClaims.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No individual claims were flagged as needing evidence. You can resubmit general evidence files below.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {flaggedClaims.map((claim, idx) => (
              <div key={idx} style={{ borderLeft: "3px solid #ec4899", paddingLeft: 14, py: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{claim.claim_text}</div>
                  <Badge style={{ background: "#fce7f3", color: "#ec4899", border: "none", fontSize: 10, flexShrink: 0 }}>
                    Evidence Needed
                  </Badge>
                </div>
                {claim.reviewer_note && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, background: "var(--bg-base)", padding: "8px 12px", borderRadius: 6 }}>
                    <strong>Adjuster feedback:</strong> {claim.reviewer_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Evidence uploads */}
      <Card style={{ padding: "20px 22px", marginBottom: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16 }}>Upload New Evidence Files</h3>

        {/* Photos */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>1. Photos (e.g. damage, scene evidence)</div>
          <Label
            htmlFor="imageInput"
            style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", cursor: "pointer", display: "block" }}
          >
            <Upload size={20} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
            Click to browse new image evidence
            <input id="imageInput" type="file" multiple accept="image/*" className="sr-only" onChange={(e) => setImageFiles(Array.from(e.target.files))} />
          </Label>
          {imageFiles.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {imageFiles.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
                  <Camera size={12} /> {f.name}
                  <button onClick={() => removeImage(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} aria-label={`Remove image ${f.name}`}><X size={12} /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>2. Documents (e.g. quotes, reports)</div>
          <Label
            htmlFor="docInput"
            style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", cursor: "pointer", display: "block" }}
          >
            <Upload size={20} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
            Click to browse new supporting documents
            <input id="docInput" type="file" multiple accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => setDocumentFiles(Array.from(e.target.files))} />
          </Label>
          {documentFiles.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              {documentFiles.map((f, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
                  <FileText size={12} /> {f.name}
                  <button onClick={() => removeDoc(i)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} aria-label={`Remove document ${f.name}`}><X size={12} /></button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {submitError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12 }}>
        <Button variant="brandSecondary" onClick={() => navigate(`/applications/${referenceNumber}`)}>Cancel</Button>
        <Button variant="brand" onClick={handleResubmit} disabled={submitting} className="gap-2">
          {submitting ? (
            <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Submitting...</>
          ) : (
            "Resubmit Claim Application"
          )}
        </Button>
      </div>
    </div>
  );
}
