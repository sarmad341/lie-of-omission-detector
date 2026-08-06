import React from 'react';
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

// Icon component for contact details
const InfoIcon = ({ type }) => {
    const icons = {
        website: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" x2="22" y1="12" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
        ),
        phone: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
        ),
        address: (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
        ),
    };
    return <div className="mr-2 flex-shrink-0">{icons[type]}</div>;
};

function DashboardPreview() {
  return (
    <Card className="w-full rounded-xl border bg-card p-6 shadow-2xl text-left border-slate-200 bg-white/95 backdrop-blur-sm relative overflow-hidden">
      {/* Absolute background card accent glow */}
      <div style={{ position: "absolute", top: 0, right: 0, width: 90, height: 90, background: "radial-gradient(circle, rgba(37,99,235,0.06), transparent 70%)", pointerEvents: "none" }} />
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--gradient-brand)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13 }}>
            V
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Verity Audit Console</span>
        </div>
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50/50 border-emerald-200">
          ● ENGINE ONLINE
        </Badge>
      </div>

      {/* Meta Statistics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, background: "#f8fafc", border: "1px solid var(--border)", padding: "10px 8px", borderRadius: 8, marginBottom: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Integrity</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--accent)", marginTop: 2 }}>74.2%</div>
        </div>
        <div style={{ textAlign: "center", borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Omissions</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--status-contradicted-text)", marginTop: 2 }}>1 Flagged</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 8, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Verdicts</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--status-supported-text)", marginTop: 2 }}>2 Made</div>
        </div>
      </div>

      {/* AI Alignment Score Indicator */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontWeight: 800, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          <span>AI Alignment Confidence</span>
          <span>74.2% Match</span>
        </div>
        <div style={{ height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: "74.2%", height: "100%", background: "var(--gradient-brand)", borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Document analysis box */}
        <div style={{ border: "1px solid var(--border)", background: "var(--bg)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-faint)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
            Scanned Text Grounding
          </div>
          <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.4, background: "white", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
            "The vehicle sustained damage on the <span style={{ background: "#dcfce7", borderBottom: "1.5px solid #22c55e", fontWeight: 600, padding: "0px 2px" }}>front right bumper</span>. No pre-existing scratches on <span style={{ background: "#fee2e2", borderBottom: "1.5px solid #ef4444", fontWeight: 600, padding: "0px 2px" }}>rear bumper</span>."
          </div>
        </div>

        {/* Verification Grounding box */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "start", gap: 8, background: "#f8fafc", border: "1px solid var(--border)", padding: "8px 10px", borderRadius: 8 }}>
            <CheckCircle2 size={14} color="var(--status-supported-text)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--status-supported-text)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Supported Claim</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Bumper damage matches photos (IMG_4908.jpg).</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "start", gap: 8, background: "#f8fafc", border: "1px solid var(--border)", padding: "8px 10px", borderRadius: 8 }}>
            <AlertTriangle size={14} color="var(--status-contradicted-text)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--status-contradicted-text)", textTransform: "uppercase", letterSpacing: "0.02em" }}>Contradiction Found</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>Scratches detected on rear bumper in photos (IMG_4912.jpg).</div>
            </div>
          </div>
        </div>

        {/* Policy screen checklist */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <ShieldCheck size={13} color="var(--accent)" /> Policy Compliance Rules
            </div>
            <span style={{ fontSize: 9, color: "var(--text-faint)", fontFamily: "monospace" }}>ruleset_v2.5</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--status-supported-text)", fontWeight: 700 }}>
              <CheckCircle2 size={11} /> POL-001 Reporting
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--status-contradicted-text)", fontWeight: 700 }}>
              <AlertTriangle size={11} /> POL-014 Prior Damage
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

const HeroSection = React.forwardRef(
  ({ className, logo, slogan, title, subtitle, callToAction, backgroundImage, contactInfo, ...props }, ref) => {
    
    // Animation variants for the container to orchestrate children animations
    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.15,
          delayChildren: 0.2,
        },
      },
    };

    // Animation variants for individual text/UI elements
    const itemVariants = {
      hidden: { y: 20, opacity: 0 },
      visible: {
        y: 0,
        opacity: 1,
        transition: {
          duration: 0.5,
          ease: "easeOut",
        },
      },
    };
    
    return (
      <motion.section
        ref={ref}
        className={cn(
          "relative flex w-full flex-col overflow-hidden bg-background text-foreground md:flex-row border-b border-slate-200",
          className
        )}
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        {...props}
      >
        {/* Left Side: Content */}
        <div className="flex w-full flex-col justify-between p-8 md:w-1/2 md:p-12 lg:w-3/5 lg:p-16">
            {/* Top Section: Logo & Main Content */}
            <div>
                <motion.header className="mb-12" variants={itemVariants}>
                    {logo && (
                        <div className="flex items-center">
                            {logo.url ? (
                              <img src={logo.url} alt={logo.alt} className="mr-3 h-8" />
                            ) : (
                              <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
                                V
                              </span>
                            )}
                            <div>
                                {logo.text && <p className="text-lg font-bold text-foreground leading-none">{logo.text}</p>}
                                {slogan && <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">{slogan}</p>}
                            </div>
                        </div>
                    )}
                </motion.header>

                <motion.main variants={containerVariants}>
                    <motion.h1 className="text-4xl font-bold leading-tight text-foreground md:text-5xl" variants={itemVariants}>
                        {title}
                    </motion.h1>
                    <motion.div className="my-6 h-1 w-20 bg-primary" variants={itemVariants}></motion.div>
                    <motion.p className="mb-8 max-w-md text-base text-muted-foreground" variants={itemVariants}>
                        {subtitle}
                    </motion.p>
                    <motion.div variants={itemVariants}>
                      <a href={callToAction.href} className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                        {callToAction.text}
                      </a>
                    </motion.div>
                </motion.main>
            </div>

            {/* Bottom Section: Footer Info */}
            <motion.footer className="mt-12 w-full border-t border-slate-100 pt-6" variants={itemVariants}>
                <div className="grid grid-cols-1 gap-6 text-xs text-muted-foreground sm:grid-cols-3">
                    <div className="flex items-center">
                        <InfoIcon type="website" />
                        <span>{contactInfo.website}</span>
                    </div>
                    <div className="flex items-center">
                        <InfoIcon type="phone" />
                        <span>{contactInfo.phone}</span>
                    </div>
                    <div className="flex items-center">
                        <InfoIcon type="address" />
                        <span>{contactInfo.address}</span>
                    </div>
                </div>
            </motion.footer>
        </div>

        {/* Right Side: Image with Clip Path Animation & Dashboard Overlay */}
        <motion.div 
          className="w-full min-h-[450px] bg-cover bg-center md:w-1/2 md:min-h-full lg:w-2/5 relative flex items-center justify-center p-8"
          style={{ 
            backgroundImage: `url(${backgroundImage})`,
          }}
          initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
          animate={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
          transition={{ duration: 1.2, ease: "circOut" }}
        >
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"></div>
          <div className="relative z-10 w-full max-w-sm drop-shadow-2xl">
            <DashboardPreview />
          </div>
        </motion.div>
      </motion.section>
    );
  }
);

HeroSection.displayName = "HeroSection";

export { HeroSection };
