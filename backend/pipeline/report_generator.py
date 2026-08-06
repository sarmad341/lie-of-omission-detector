"""
Report generation (PDR: audit report generator deliverable). Turns a saved
case (as returned by pipeline.persistence.get_case) into a clean,
human-readable Markdown report — grouped by verdict, with a "needs review"
section surfaced at the top for anything a human should look at first.

Also renders Policy Screening results (policy_decision per claim) when
present — cases from the original flow won't have this field at all, so
those sections are simply omitted rather than shown empty.
"""

# Verdicts that should never be silently accepted without a human looking —
# either because they represent genuine disagreement, or because the model
# itself wasn't confident.
NEEDS_REVIEW_VERDICTS = {"conflicting_evidence", "insufficient_evidence", "contradicted"}

VERDICT_LABELS = {
    "supported": "✅ Supported",
    "contradicted": "❌ Contradicted",
    "missing_expected_evidence": "❔ Missing Expected Evidence",
    "insufficient_evidence": "⚠️ Insufficient Evidence",
    "conflicting_evidence": "⚠️ Conflicting Evidence",
}

POLICY_STATUS_LABELS = {
    "accepted": "✅ Accepted",
    "rejected": "❌ Rejected",
    "needs_review": "⚠️ Needs Review",
}


def _needs_review(claim: dict) -> bool:
    # NOTE: "contradicted" is always flagged, regardless of the model's
    # self-reported confidence. Direct testing showed the same claim/image
    # pair can flip between "contradicted" and "insufficient_evidence"
    # across repeated calls while BOTH runs report "confidence: high" — so
    # the model's confidence field is not a trustworthy signal for whether
    # a contradicted verdict is actually correct. A false "contradicted" is
    # also the highest-stakes mistake this system can make (it accuses the
    # claim of being disproven), so it gets the strictest treatment.
    return claim["final_verdict"] in NEEDS_REVIEW_VERDICTS


def generate_markdown_report(case: dict) -> str:
    claims = case.get("claims_checked", [])
    skipped = case.get("claims_skipped_administrative", [])

    review_needed = [c for c in claims if _needs_review(c)]
    by_verdict: dict = {}
    for c in claims:
        by_verdict.setdefault(c["final_verdict"], []).append(c)

    # Policy Screening may not have run yet (or this may be a case from the
    # original flow that never goes through Policy Screening at all) — only
    # render policy-related sections if at least one claim actually has one.
    has_policy_decisions = any(c.get("policy_decision") for c in claims)
    by_policy_status: dict = {}
    if has_policy_decisions:
        for c in claims:
            pd = c.get("policy_decision")
            if pd:
                by_policy_status.setdefault(pd["status"], []).append(c)

    lines = []
    lines.append(f"# Compliance Review Report")
    lines.append("")
    lines.append(f"**Case ID:** `{case.get('_id', 'unsaved')}`  ")
    lines.append(f"**Document:** {case.get('document_name', 'unknown')}  ")
    lines.append(
        f"**Evidence images:** "
        f"{', '.join(case.get('image_names') or case.get('evidence_image_names', []))}  "
    )
    lines.append(f"**Generated:** {case.get('created_at', 'unknown')}  ")
    lines.append(f"**Review status:** {case.get('review_status', 'pending')}")
    if case.get("company_id"):
        lines.append(f"**Screened against company:** `{case['company_id']}`")
    lines.append("")

    lines.append("## Summary")
    lines.append("")
    lines.append(f"- **{len(claims)}** claims checked against evidence")
    lines.append(f"- **{len(skipped)}** administrative claims skipped (not visually checkable)")
    for verdict, group in by_verdict.items():
        label = VERDICT_LABELS.get(verdict, verdict)
        lines.append(f"- {label}: **{len(group)}**")

    if has_policy_decisions:
        lines.append("")
        lines.append("**Policy Screening results:**")
        for status, group in by_policy_status.items():
            label = POLICY_STATUS_LABELS.get(status, status)
            lines.append(f"- {label}: **{len(group)}**")
    lines.append("")

    if review_needed:
        lines.append("## ⚠️ Needs Human Review")
        lines.append("")
        lines.append(
            "These claims have conflicting evidence across photos, insufficient "
            "evidence to judge confidently, or a 'contradicted' verdict. "
            "**All contradicted verdicts are flagged regardless of the system's "
            "reported confidence** — testing has shown the same claim can receive "
            "different verdicts across repeated runs while still reporting high "
            "confidence each time, so confidence alone should not be trusted for "
            "a contradicted call. Review these before treating them as final."
        )
        lines.append("")
        for c in review_needed:
            lines.append(f"### [{c['claim_id']}] {c['claim_text']}")
            lines.append(f"**Verdict:** {VERDICT_LABELS.get(c['final_verdict'], c['final_verdict'])} "
                         f"(confidence: {c.get('confidence', 'unknown')})")
            lines.append("")
            lines.append(c.get("explanation", "").replace("\n", "  \n"))
            lines.append("")
    else:
        lines.append("## ✅ No claims flagged for review")
        lines.append("")
        lines.append("Every claim reached a confident, unconflicted verdict.")
        lines.append("")

    if has_policy_decisions:
        policy_flagged = [
            c for c in claims
            if c.get("policy_decision") and c["policy_decision"]["status"] != "accepted"
        ]
        if policy_flagged:
            lines.append("## 🚫 Policy Screening — Not Accepted")
            lines.append("")
            lines.append(
                "These claims did not pass policy screening, or require human "
                "review before a final eligibility decision. Each cites the "
                "specific rule/clause it's based on."
            )
            lines.append("")
            for c in policy_flagged:
                pd = c["policy_decision"]
                lines.append(f"### [{c['claim_id']}] {c['claim_text']}")
                lines.append(f"**Policy decision:** {POLICY_STATUS_LABELS.get(pd['status'], pd['status'])}")
                lines.append("")
                for rule in pd.get("rule_check_results", []):
                    status_icon = "✅" if rule["passed"] else "❌"
                    lines.append(f"- {status_icon} **{rule['rule_description']}**")
                    lines.append(f"  {rule['cited_clause']}")
                if pd.get("layer_2_reasoning"):
                    lines.append("")
                    lines.append(f"*AI reasoning: {pd['layer_2_reasoning']}*")
                lines.append("")

    lines.append("## Full Claim-by-Claim Results")
    lines.append("")
    for c in claims:
        lines.append(f"### [{c['claim_id']}] {c['claim_text']}")
        lines.append(f"**Verdict:** {VERDICT_LABELS.get(c['final_verdict'], c['final_verdict'])}  ")
        lines.append(f"**Evidence image:** {c.get('evidence_image') or 'multiple (see breakdown)'}  ")
        lines.append(f"**Confidence:** {c.get('confidence', 'unknown')}")

        pd = c.get("policy_decision")
        if pd:
            lines.append(f"**Policy decision:** {POLICY_STATUS_LABELS.get(pd['status'], pd['status'])}")

        lines.append("")
        lines.append(c.get("explanation", "").replace("\n", "  \n"))
        lines.append("")
        per_image = c.get("all_image_results", {})
        if per_image:
            lines.append("| Image | Result |")
            lines.append("|---|---|")
            for image_name, verdict in per_image.items():
                lines.append(f"| {image_name} | {VERDICT_LABELS.get(verdict, verdict)} |")
            lines.append("")

    if skipped:
        lines.append("## Skipped Administrative Claims")
        lines.append("")
        lines.append("Not visually checkable — informational only, not evaluated against evidence.")
        lines.append("")
        for c in skipped:
            lines.append(f"- {c['claim_text']}")
        lines.append("")

    return "\n".join(lines)