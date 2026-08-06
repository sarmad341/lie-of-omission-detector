import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCase, reviewClaim, listCompanies, screenCase } from "../api";
import StatusBadge from "../components/StatusBadge";
import ReportView from "../components/ReportView";
import { CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const POLICY_STATUS_STYLES = {
  accepted: { bg: "var(--status-supported-bg)", text: "var(--status-supported-text)", border: "var(--status-supported-border)" },
  rejected: { bg: "var(--status-contradicted-bg)", text: "var(--status-contradicted-text)", border: "var(--status-contradicted-border)" },
  needs_review: { bg: "var(--status-review-bg)", text: "var(--status-missing-text)", border: "var(--status-review-border)" },
};

function PolicyStatusPill({ status }) {
  const s = POLICY_STATUS_STYLES[status] || POLICY_STATUS_STYLES.needs_review;
  const labels = { accepted: "Accepted", rejected: "Rejected", needs_review: "Needs Review" };
  return (
    <Badge role="status" variant="outline" className="rounded-full px-3 py-1 font-semibold" style={{ background: s.bg, color: s.text, borderColor: s.border }}>
      {labels[status] || status}
    </Badge>
  );
}

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("report");
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewStatus, setReviewStatus] = useState({});
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [screening, setScreening] = useState(false);
  const [screeningError, setScreeningError] = useState("");

  const loadCase = async () => {
    try {
      const res = await getCase(caseId);
      setCaseData(res.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  useEffect(() => { loadCase(); }, [caseId]);

  useEffect(() => {
    if (tab === "screening" && companies.length === 0 && caseData && !caseData.company_id) {
      listCompanies(caseData.category)
        .then((res) => setCompanies(res.data))
        .catch((err) => setScreeningError(err.response?.data?.detail || err.message));
    }
  }, [tab, caseData]);

  const handleReview = async (claimId, action) => {
    try {
      await reviewClaim(caseId, claimId, action, null, reviewNotes[claimId] || "");
      setReviewStatus({ ...reviewStatus, [claimId]: `${action} saved` });
    } catch (err) {
      setReviewStatus({ ...reviewStatus, [claimId]: `failed: ${err.message}` });
    }
  };

  const handleScreen = async () => {
    if (!selectedCompany) { setScreeningError("Choose a company first."); return; }
    setScreeningError("");
    setScreening(true);
    try {
      await screenCase(caseId, selectedCompany);
      await loadCase();
    } catch (err) {
      setScreeningError(err.response?.data?.detail || err.message);
    } finally {
      setScreening(false);
    }
  };

  if (error) return <div className="container" style={{ padding: 24 }}><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>;
  if (!caseData) return <div className="container" style={{ padding: 24 }}>Loading...</div>;

  return (
    <div className="container" style={{ padding: "32px 24px" }}>
      <h2 style={{ marginBottom: 4 }}>{caseData.document_name}</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>Case ID: {caseId}</p>

      <Tabs value={tab} onValueChange={setTab}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <TabsList>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="review">Review &amp; approve</TabsTrigger>
            <TabsTrigger value="screening">Policy Screening</TabsTrigger>
          </TabsList>
          <Button variant="brandSecondary" size="sm" onClick={loadCase} style={{ marginLeft: "auto" }}>Refresh</Button>
        </div>

        <TabsContent value="report">
          <ReportView caseData={caseData} />
        </TabsContent>

        <TabsContent value="review">
          {(caseData.claims_checked || []).map((c) => (
            <Card key={c.claim_id} style={{ marginBottom: 12, padding: 20 }}>
              <p style={{ marginTop: 0 }}><b>[{c.claim_id}]</b> {c.claim_text}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <StatusBadge verdict={c.final_verdict} />
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>confidence: {c.confidence}</span>
              </div>
              <Label htmlFor={`note-${c.claim_id}`} className="sr-only">Reviewer note for {c.claim_id}</Label>
              <Textarea
                id={`note-${c.claim_id}`}
                placeholder="Reviewer note"
                rows={2}
                value={reviewNotes[c.claim_id] || ""}
                onChange={(e) => setReviewNotes({ ...reviewNotes, [c.claim_id]: e.target.value })}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <Button variant="brandSecondary" size="sm" onClick={() => handleReview(c.claim_id, "approve")}>Approve</Button>
                <Button variant="brandSecondary" size="sm" onClick={() => handleReview(c.claim_id, "override")}>Flag / Override</Button>
                {reviewStatus[c.claim_id] && (
                  <span role="status" aria-live="polite" style={{ fontSize: 13, color: "var(--text-muted)" }}>{reviewStatus[c.claim_id]}</span>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="screening">
          {(caseData.claims_checked || []).length === 0 && (
            <Card style={{ padding: 20 }}>
              <p style={{ margin: 0 }}>Evidence grounding hasn&apos;t run for this case yet — screening needs checked claims first.</p>
            </Card>
          )}

          {(caseData.claims_checked || []).length > 0 && !caseData.company_id && (
            <Card style={{ padding: 20 }}>
              <h3 style={{ marginTop: 0 }}>Choose a company to screen against</h3>
              {screeningError && <Alert variant="destructive" className="mb-3"><AlertDescription>{screeningError}</AlertDescription></Alert>}
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="mb-4 max-w-xs"><SelectValue placeholder="Select a company..." /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div>
                <Button variant="brand" onClick={handleScreen} disabled={screening}>
                  {screening ? "Screening..." : "Screen Claim"}
                </Button>
              </div>
            </Card>
          )}

          {caseData.company_id && (caseData.claims_checked || []).map((c) => (
            <Card key={c.claim_id} style={{ marginBottom: 12, padding: 20 }}>
              <p style={{ marginTop: 0 }}><b>[{c.claim_id}]</b> {c.claim_text}</p>
              {c.policy_decision ? (
                <>
                  <div style={{ marginBottom: 10 }}><PolicyStatusPill status={c.policy_decision.status} /></div>
                  {(c.policy_decision.rule_check_results || []).map((r) => (
                    <div key={r.rule_id} style={{ fontSize: 13, padding: "8px 0", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                      {r.passed ? <CheckCircle2 size={16} color="var(--status-supported-text)" style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={16} color="var(--status-contradicted-text)" style={{ flexShrink: 0, marginTop: 1 }} />}
                      <div>
                        {r.rule_description}
                        <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{r.cited_clause}</div>
                      </div>
                    </div>
                  ))}
                  {c.policy_decision.layer_2_reasoning && (
                    <p style={{ fontSize: 13, marginTop: 10, marginBottom: 0, fontStyle: "italic" }}>{c.policy_decision.layer_2_reasoning}</p>
                  )}
                </>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Not screened.</p>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
