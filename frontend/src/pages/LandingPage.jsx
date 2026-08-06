import { HeroSection } from "@/components/ui/hero-section-2";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ShieldCheck, Image, CheckCircle2 } from "lucide-react";

const STEPS = [
  { label: "Submit claim", emoji: "📄" },
  { label: "Confirm facts", emoji: "✅" },
  { label: "Upload evidence", emoji: "🖼️" },
  { label: "Get report", emoji: "📋" },
];

const TWINKLES = [
  { top: "12%", left: "6%", size: 10 },
  { top: "22%", left: "88%", size: 14 },
  { top: "68%", left: "4%", size: 8 },
  { top: "78%", left: "92%", size: 12 },
  { top: "5%", left: "45%", size: 6 },
  { top: "60%", left: "50%", size: 8 },
];

export default function LandingPage() {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {TWINKLES.map((t, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="twinkle-dot"
          style={{
            top: t.top,
            left: t.left,
            width: t.size,
            height: t.size,
            animationDelay: `${i * 0.6}s`,
          }}
        />
      ))}

      <HeroSection
        logo={{
          url: "", // Built-in text & icon logo will render
          alt: "Verity Logo",
          text: "Verity"
        }}
        slogan="Compliance Intelligence"
        title={
          <>
            See what the <br />
            <span className="gradient-text">evidence</span> actually shows.
          </>
        }
        subtitle="Verity reviews claims against photo evidence automatically — catching contradictions and missing evidence before a human reviewer has to."
        callToAction={{
          text: "GET STARTED NOW",
          href: "/get-started",
        }}
        backgroundImage="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop"
        contactInfo={{
          website: "verity-claims.com",
          phone: "+1 (800) 555-0199",
          address: "100 Corporate Pkwy, GA",
        }}
      />

      <StepFlow />

      <div
        style={{
          textAlign: "center",
          padding: "24px",
          color: "var(--text-faint)",
          fontSize: 13,
          position: "relative",
          zIndex: 1,
        }}
      >
        Verity — compliance document review
      </div>
    </div>
  );
}

function StepFlow() {
  const stepsData = [
    {
      num: "01",
      title: "Submit Claim",
      desc: "Provide the claim text outlining damaged items and occurrence context.",
      icon: <FileText className="h-5 w-5 text-blue-600" />,
      color: "bg-blue-50/50 border-blue-100",
    },
    {
      num: "02",
      title: "Confirm Facts",
      desc: "AI splits the claim narrative into single verifiable assertions.",
      icon: <ShieldCheck className="h-5 w-5 text-amber-600" />,
      color: "bg-amber-50/50 border-amber-100",
    },
    {
      num: "03",
      title: "Upload Evidence",
      desc: "Attach high-resolution photos and documents to back your statements.",
      icon: <Image className="h-5 w-5 text-emerald-600" />,
      color: "bg-emerald-50/50 border-emerald-100",
    },
    {
      num: "04",
      title: "Get Report",
      desc: "Verity compiles a comprehensive audit highlighting contradictions.",
      icon: <CheckCircle2 className="h-5 w-5 text-indigo-600" />,
      color: "bg-indigo-50/50 border-indigo-100",
    },
  ];

  return (
    <div style={{ position: "relative" }} className="mt-20 py-16 border-t border-slate-200">
      <div className="container">
        {/* Header Title */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <Badge className="mb-3 px-3 py-0.5 text-[10px] font-bold tracking-widest bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
            SYSTEM WORKFLOW
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
            How Verity Audits Claims
          </h2>
          <p className="mt-2 text-slate-500 max-w-lg mx-auto text-sm leading-relaxed">
            Verity parses claim statements and grounds each factual assertion directly against corroborating metadata and evidence files.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {stepsData.map((s) => (
            <Card key={s.num} className="p-6 relative flex flex-col justify-between border-slate-200 hover:border-slate-300 transition-colors shadow-sm bg-white rounded-xl">
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${s.color}`}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 24, fontWeight: 900, color: "var(--text-faint)", opacity: 0.4 }}>
                    {s.num}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
