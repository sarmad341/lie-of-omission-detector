"""
Seed data for the `policy_rules` and `companies` collections — run once
to populate MongoDB with the structured rules and company profiles
derived from the real specimen policies (AIG Ireland, AXA UK, TAIPA Texas).

Usage:
    python pipeline/seed_policy_data.py
"""
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.db import get_db  # noqa: E402

POLICY_RULES = [
    {
        "rule_id": "wear_vs_accident",
        "description": "Damage must be from a sudden accident, not gradual wear/deterioration.",
        "source_clause": (
            "AIG Ireland: 'Wear and tear or depreciation' / 'any gradually operating cause' — excluded. "
            "AXA UK: identical wording, confirming this is standard industry language."
        ),
        "check_type": "deterministic",
        "logic_ref": "pipeline.policy_rules_engine.check_wear_vs_accident",
    },
    {
        "rule_id": "tyre_exclusion",
        "description": "Tyre-only damage (puncture/burst/brake wear) excluded unless tied to a covered accident.",
        "source_clause": (
            "AIG Ireland: 'Damage to tyres caused by braking or by punctures cuts or bursts' — excluded. "
            "AXA UK: same exclusion 'unless as a result of an accident'. "
            "Progressive: 'Damage to tyre(s) unless other parts are also damaged at the same time'."
        ),
        "check_type": "deterministic",
        "logic_ref": "pipeline.policy_rules_engine.check_tyre_exclusion",
    },
    {
        "rule_id": "unlocked_unattended_theft",
        "description": "Theft is excluded if the vehicle was left unattended while unlocked or with keys in/near the car.",
        "source_clause": (
            "Progressive Section D Exclusion 7: 'left unattended while unlocked or with ignition keys left in or on your car'. "
            "AIG Section 1B / AXA Part A: 'left unlocked or with keys/keyless entry system in your car'."
        ),
        "check_type": "deterministic",
        "logic_ref": "pipeline.policy_rules_engine.check_unlocked_unattended_theft",
    },
    {
        "rule_id": "unauthorized_intoxicated_driver",
        "description": "Excludes loss/damage if vehicle is driven by an unlicensed driver or driver under the influence of alcohol/drugs.",
        "source_clause": (
            "Progressive Section D Exclusions 1 & 2: unlicensed driver or under the influence of alcohol or drugs. "
            "AXA General Exclusion 6: driving over legal limit or unfit through drink/drugs."
        ),
        "check_type": "deterministic",
        "logic_ref": "pipeline.policy_rules_engine.check_unauthorized_intoxicated_driver",
    },
    {
        "rule_id": "region_visibility",
        "description": "The specific damage/region described in the claim must be visible in submitted evidence.",
        "source_clause": (
            "AIG / AXA / Progressive claims duty: 'Provide all reasonable evidence to support your claim.'"
        ),
        "check_type": "deterministic",
        "logic_ref": "pipeline.policy_rules_engine.check_region_visibility",
    },
    {
        "rule_id": "severity_consistency",
        "description": "Claimed severity/type of damage must match what evidence actually shows.",
        "source_clause": (
            "AXA UK / Progressive fraud provision: claim void if 'in any respect fraudulent' or if it "
            "'inflates or exaggerates' the claim beyond what evidence shows."
        ),
        "check_type": "deterministic",
        "logic_ref": "pipeline.policy_rules_engine.check_severity_consistency",
    },
]

COMPANIES = [
    {
        "name": "Meridian Auto Assurance",
        "category": "car_insurance",
        "summary": "Standard exclusions, 60% total-loss threshold, faster claims decision window.",
        "applicable_rule_ids": [
            "wear_vs_accident", "tyre_exclusion", "region_visibility", "severity_consistency",
        ],
        "parameters": {
            "total_loss_threshold_pct": 60,  # modeled on AIG's real 60% clause
            "excess_table": {
                "driver_25_plus_experienced": 100,
                "driver_21_24_experienced": 150,
                "driver_21_24_inexperienced": 200,
                "driver_17_20_all": 500,
            },
            "claim_ack_deadline_days": 15,
            "claim_decision_deadline_days": 15,
        },
    },
    {
        "name": "Northgate Motor Cover",
        "category": "car_insurance",
        "summary": "Stricter tyre/wear exclusions, standard 45-day decision window, protected no-claims option.",
        "applicable_rule_ids": [
            "wear_vs_accident", "tyre_exclusion", "region_visibility", "severity_consistency",
        ],
        "parameters": {
            "total_loss_threshold_pct": 50,
            "excess_table": {
                "driver_25_plus_experienced": 125,
                "driver_21_24_experienced": 175,
                "driver_21_24_inexperienced": 225,
                "driver_17_20_all": 550,
            },
            "claim_ack_deadline_days": 15,
            "claim_decision_deadline_days": 45,
        },
    },
    {
        "name": "Progressive International Insurance",
        "category": "car_insurance",
        "summary": "Strict security & keyless entry exclusions, 70% market valuation threshold, 30-day decision window.",
        "applicable_rule_ids": [
            "wear_vs_accident", "tyre_exclusion", "unlocked_unattended_theft",
            "unauthorized_intoxicated_driver", "region_visibility", "severity_consistency",
        ],
        "parameters": {
            "total_loss_threshold_pct": 70,  # Progressive 70% threshold
            "excess_table": {
                "driver_25_plus_experienced": 150,
                "driver_21_24_experienced": 200,
                "driver_21_24_inexperienced": 400,
                "driver_17_20_all": 500,
            },
            "claim_ack_deadline_days": 7,
            "claim_decision_deadline_days": 30,
        },
    },
]


def seed():
    db = get_db()
    now = datetime.now(timezone.utc)

    for rule in POLICY_RULES:
        db.policy_rules.update_one(
            {"rule_id": rule["rule_id"]},
            {"$set": {**rule, "updated_at": now}},
            upsert=True,
        )
    print(f"Seeded {len(POLICY_RULES)} policy rules.")

    for company in COMPANIES:
        db.companies.update_one(
            {"name": company["name"]},
            {"$set": {**company, "updated_at": now}},
            upsert=True,
        )
    print(f"Seeded {len(COMPANIES)} companies.")


if __name__ == "__main__":
    seed()