import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCases, listMyApplications } from "../api";
import StatusBadge from "../components/StatusBadge";
import {
  FileText, Clock, Send, Loader2, ShieldCheck, LayoutDashboard, FilePlus, RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const APP_STEPS = ["Submitted", "AI Review", "Company Review", "Decision"];
const APP_STATUS_STEP = { submitted: 0, ai_reviewing: 1, admin_pending: 2, approved: 3, denied: 3, sent_back_for_more_evidence: 2 };
const APP_STATUS_LABEL = {
  submitted: { label: "Submitted", color: "var(--text-muted)", bg: "var(--bg-surface)" },
  ai_reviewing: { label: "AI Reviewing", color: "#f59e0b", bg: "#fef3c7" },
  admin_pending: { label: "Pending Review", color: "#3b82f6", bg: "#dbeafe" },
  approved: { label: "Decision Released", color: "var(--status-supported-text)", bg: "var(--status-supported-bg)" },
  denied: { label: "Rejected by Admin", color: "var(--status-contradicted-text)", bg: "var(--status-contradicted-bg)" },
  sent_back_for_more_evidence: { label: "Awaiting Your Response", color: "#ec4899", bg: "#fce7f3" },
};

function StatusPipeline({ status }) {
  const step = APP_STATUS_STEP[status] ?? 0;
  const isDenied = status === "denied";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 8 }}>
      {APP_STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const isLast = i === APP_STEPS.length - 1;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: isLast ? 0 : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: done || active ? (isDenied && isLast ? "var(--status-contradicted-bg)" : "var(--accent)") : "var(--bg-surface)",
                border: `2px solid ${done || active ? (isDenied && isLast ? "var(--status-contradicted-border)" : "var(--accent)") : "var(--border)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                color: done || active ? (isDenied && isLast ? "var(--status-contradicted-text)" : "#fff") : "var(--text-faint)",
                fontWeight: 700, flexShrink: 0, transition: "all 0.3s",
                animation: active ? "floatY 1.4s ease-in-out infinite" : "none",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, color: active ? "var(--accent)" : "var(--text-faint)", whiteSpace: "nowrap" }}>{s}</span>
            </div>
            {!isLast && <div style={{ height: 2, flex: 1, background: done ? "var(--accent)" : "var(--border)", margin: "0 2px", marginBottom: 16, transition: "background 0.3s" }} />}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <Card className="p-0 text-center" style={{ borderTop: `3px solid ${color || "var(--accent)"}` }}>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: color || "var(--accent)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>{label}</div>
      </div>
    </Card>
  );
}

export default function CaseListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("ongoing");
  const [applications, setApplications] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [appsRes, casesRes] = await Promise.all([listMyApplications(), listCases()]);
      setApplications(appsRes.data || []);
      setCases(casesRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const drafts = cases.filter((c) => c.source_type === "ai_generated" && !c.is_application && c.download_confirmed);
  const ongoingApps = applications.filter((a) =>
    ["submitted", "ai_reviewing", "admin_pending", "sent_back_for_more_evidence"].includes(a.application_status)
  );
  const resultApps = applications.filter((a) =>
    ["approved", "denied"].includes(a.application_status)
  );

  const stats = {
    total: applications.length,
    ongoing: ongoingApps.length,
    approved: applications.filter((a) => a.application_status === "approved").length,
    denied: applications.filter((a) => a.application_status === "denied").length,
  };

  return (
    <div className="container" style={{ padding: "32px 24px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LayoutDashboard size={24} /> Dashboard
          </h1>
          <p style={{ marginTop: 4, color: "var(--text-muted)" }}>Manage your claim applications and analyses.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="brandSecondary" onClick={load} className="gap-1.5"><RefreshCw size={14} /> Refresh</Button>
          <Button variant="brand" onClick={() => navigate("/get-started")} className="gap-1.5"><FilePlus size={14} /> New Claim</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <Stat label="Total Applications" value={stats.total} color="var(--accent)" />
        <Stat label="Ongoing" value={stats.ongoing} color="#f59e0b" />
        <Stat label="Approved" value={stats.approved} color="var(--status-supported-text)" />
        <Stat label="Denied" value={stats.denied} color="var(--status-contradicted-text)" />
      </div>

      {error && <Alert variant="destructive" className="mb-4"><AlertDescription>{error}</AlertDescription></Alert>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5">
          <TabsTrigger value="ongoing">Applications Ongoing ({ongoingApps.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafted Claims ({drafts.length})</TabsTrigger>
          <TabsTrigger value="results">Results ({resultApps.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
            <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ marginTop: 12 }}>Loading...</p>
          </div>
        ) : (
          <>
            <TabsContent value="ongoing">
              {ongoingApps.length === 0 ? (
                <EmptyState icon={<Send size={32} />} title="No ongoing applications" desc="Submit your first claim application to track it here." action={() => navigate("/get-started")} actionLabel="Apply for a Claim" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {ongoingApps.map((app) => (
                    <ApplicationCard key={app._id || app.reference_number} app={app} onClick={() => navigate(`/applications/${app.reference_number}`)} onNavigate={navigate} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="drafts">
              {drafts.length === 0 ? (
                <EmptyState icon={<FileText size={32} />} title="No drafts yet" desc="Use the Generate Claim wizard to create AI-assisted claim drafts." action={() => navigate("/generate-claim")} actionLabel="Generate a Claim" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {drafts.map((c) => <DraftCard key={c.case_id || c._id} draft={c} onNavigate={navigate} />)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="results">
              {resultApps.length === 0 ? (
                <EmptyState icon={<ShieldCheck size={32} />} title="No decided claims yet" desc="Your approved or denied claim applications will appear here once reviewed." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {resultApps.map((app) => (
                    <ApplicationCard key={app._id || app.reference_number} app={app} onClick={() => navigate(`/applications/${app.reference_number}`)} onNavigate={navigate} />
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function ApplicationCard({ app, onClick, onNavigate }) {
  const statusInfo = APP_STATUS_LABEL[app.application_status] || APP_STATUS_LABEL.submitted;
  const catLabel = { car_insurance: "Car Insurance", health_insurance: "Health Insurance", loan_application: "Property / Home" }[app.category] || app.category || "—";
  return (
    <Card
      className="card-hover cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{ padding: "20px 22px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Send size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, fontFamily: "monospace", color: "var(--accent)" }}>{app.reference_number}</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 1 }}>{app.company_name || "—"} · {catLabel}</div>
          </div>
        </div>
        <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: statusInfo.bg, color: statusInfo.color, borderColor: `${statusInfo.color}22` }}>
          {statusInfo.label}
        </Badge>
      </div>
      <StatusPipeline status={app.application_status} />
      <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-faint)", display: "flex", gap: 16 }}>
        <span>Submitted: {new Date(app.submitted_at || app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        {app.admin_decided_at && <span>Decided: {new Date(app.admin_decided_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
      </div>
      {app.application_status === "sent_back_for_more_evidence" && (
        <div style={{ marginTop: 14, padding: "10px 14px", background: "#fdf2f8", border: "1px solid #fbcfe8", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#be185d", fontWeight: 500 }}>The company requested additional evidence for this claim.</span>
          <Button variant="brand" size="sm" style={{ background: "#ec4899", border: "none", color: "#fff" }} onClick={(e) => { e.stopPropagation(); onNavigate(`/resubmit-evidence/${app.reference_number}`); }}>Add More Evidence</Button>
        </div>
      )}
    </Card>
  );
}

function DraftCard({ draft, onNavigate }) {
  const imageNames = draft.evidence_image_names || [];

  return (
    <Card className="card-hover" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--status-review-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <FileText size={18} color="var(--status-missing-text)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draft.document_name || "Generated Claim Draft"}</div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Clock size={12} />{new Date(draft.created_at).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="brandSecondary" size="sm" onClick={() => onNavigate(`/cases/${draft.case_id || draft._id}`)}>View</Button>
          <Button variant="brand" size="sm" onClick={() => onNavigate(`/apply-from-draft/${draft.case_id || draft._id}`)}>Apply →</Button>
        </div>
      </div>

      {imageNames.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          {imageNames.map((name, idx) => (
            <img
              key={idx}
              src={`http://127.0.0.1:8000/uploaded_cases/${draft.case_id || draft._id}/${name}`}
              alt={`Evidence ${idx + 1}`}
              style={{
                width: 48,
                height: 48,
                objectFit: "cover",
                borderRadius: 6,
                border: "1.5px solid var(--border)",
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function EmptyState({ icon, title, desc, action, actionLabel }) {
  return (
    <Card style={{ textAlign: "center", padding: "48px 32px", color: "var(--text-muted)" }}>
      <div style={{ marginBottom: 12, opacity: 0.4, display: "flex", justifyContent: "center" }}>{icon}</div>
      <h3 style={{ marginBottom: 8, color: "var(--text)" }}>{title}</h3>
      <p style={{ fontSize: 14, marginBottom: 20 }}>{desc}</p>
      {action && <Button variant="brand" onClick={action}>{actionLabel}</Button>}
    </Card>
  );
}
