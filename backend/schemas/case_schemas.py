"""
Pydantic models for API request/response shapes.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel

VerdictCategory = Literal[
    "supported",
    "contradicted",
    "missing_expected_evidence",
    "insufficient_evidence",
    "conflicting_evidence",
]

CaseCategory = Literal["car_insurance", "health_insurance", "loan_application"]
CarInsuranceSubCategory = Literal["collision", "theft", "natural_disaster"]

CaseStatus = Literal[
    "pending_confirmation",
    "awaiting_evidence",
    "awaiting_generation_answers",   # Entry Point B, waiting on gap-question answers
    "processing",
    "pending_admin_review",          # set by confirm_and_process_generated_case
    "completed",
    "failed",
]

# Separate from CaseStatus — tracks the formal application lifecycle
ApplicationStatus = Literal[
    "submitted",       # user submitted, waiting for AI validation
    "ai_reviewing",    # AI pipeline is running
    "admin_pending",   # AI done, in company admin queue
    "approved",        # admin approved the claim
    "denied",          # admin denied the claim
    "sent_back_for_more_evidence", # admin sent back to user
]

AdminDecision = Literal["approved", "denied", "demand_more_evidence"]

SourceType = Literal["user_provided", "ai_generated"]
PolicyDecisionStatus = Literal["accepted", "rejected", "needs_review"]


class ExtractedClaim(BaseModel):
    id: str
    claim_text: str
    is_visually_checkable: bool = True
    needs_human_verification: bool = False
    verification_reasons: list[str] = []


class SkippedClaim(BaseModel):
    id: str
    claim_text: str
    is_visually_checkable: bool = False


class RuleCheckResult(BaseModel):
    rule_id: str
    rule_description: str
    passed: bool
    cited_clause: str


class PolicyDecision(BaseModel):
    status: PolicyDecisionStatus
    rule_check_results: list[RuleCheckResult] = []
    layer_2_reasoning: Optional[str] = None
    stability: Optional[Literal["agreed", "disagreed"]] = None


class VerdictOut(BaseModel):
    claim_id: str
    claim_text: str
    final_verdict: Optional[VerdictCategory] = None
    evidence_image: Optional[str] = None
    explanation: Optional[str] = None
    confidence: Optional[str] = None
    all_image_results: dict[str, str] = {}
    reviewed_by_human: bool = False
    reviewer_override: Optional[str] = None
    reviewer_note: Optional[str] = None
    needs_more_evidence: bool = False
    policy_decision: Optional[PolicyDecision] = None


class TierResult(BaseModel):
    tier: int
    name: str
    passed: bool
    details: str
    fatal: bool = False


class CaseSummary(BaseModel):
    case_id: str
    status: CaseStatus
    category: Optional[CaseCategory] = None
    sub_category: Optional[CarInsuranceSubCategory] = None
    document_name: str
    created_at: datetime
    claims_checked_count: int = 0
    source_type: Optional[SourceType] = None
    download_confirmed: bool = False
    evidence_image_names: list[str] = []
    # Application fields — populated only when a formal claim was submitted
    reference_number: Optional[str] = None
    application_status: Optional[ApplicationStatus] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    admin_decision: Optional[AdminDecision] = None
    admin_note: Optional[str] = None
    admin_decided_at: Optional[datetime] = None
    is_application: bool = False  # True if this case was formally submitted as a claim
    tier_results: list[TierResult] = []


class PaginatedApplications(BaseModel):
    data: list[CaseSummary]
    total: int
    page: int
    limit: int
    total_pages: int


class GenerationQA(BaseModel):
    question: str
    answer: str


class EvidenceDescription(BaseModel):
    filename: Optional[str] = None
    is_relevant: bool = True
    visible_regions: list[str] = []
    description: str = ""
    not_visible: list[str] = []
    stability: Literal["agreed", "disagreed"]
    raw_attempts: list[list[str]] = []
    laterality_conflicts: list[str] = []


class EvidenceSuggestion(BaseModel):
    reason: str           # e.g. "region_unclear", "missing_expected_evidence", "low_stability"
    message: str           # plain-language suggestion shown to the user


class ClaimTemplateDataBase(BaseModel):
    # Policyholder Information
    first_name: str = ""
    last_name: str = ""
    street_address: str = ""
    street_address_2: str = ""
    city: str = ""
    state: str = ""
    postal_code: str = ""
    phone: str = ""
    email: str = ""
    date_of_birth: str = ""
    occupation: str = ""
    policy_inception_date: str = ""
    # Vehicle Information
    vehicle_make: str = ""
    vehicle_model: str = ""
    vehicle_year: str = ""
    vehicle_vin: str = ""
    license_plate: str = ""
    current_mileage: str = ""
    # Shared Incident
    incident_circumstances: str = ""


class CollisionTemplateData(ClaimTemplateDataBase):
    type: Literal["collision"] = "collision"
    # Incident Details
    incident_date: str = ""
    incident_time: str = ""
    incident_location: str = ""
    point_of_impact: str = ""
    correct_side_of_road: str = ""
    estimated_speed: str = ""
    police_report_filed: str = ""
    police_report_number: str = ""
    driven_or_towed: str = ""
    # Vehicle Info (Extensions)
    driver_license_number: str = ""
    driver_license_expiry: str = ""
    driver_license_class: str = ""
    # Damage Assessment
    damage_body_work: str = ""
    damage_chassis: str = ""
    damage_accessories_lamps: str = ""
    damage_tyres: str = ""
    # Witnesses
    witnesses: list[dict] = []
    # Injuries and Medical Treatment
    injuries_description: str = ""
    medical_facilities_visited: str = ""
    medical_expenses: str = ""
    # Additional
    damage_to_other_vehicle: str = ""
    estimated_repair_cost: str = ""
    additional_information: str = ""


class StolenArticle(BaseModel):
    date_of_purchase: str = ""
    particulars: str = ""
    value: str = ""
    condition: str = ""


class TheftTemplateData(ClaimTemplateDataBase):
    type: Literal["theft"] = "theft"
    # Theft Details
    theft_date: str = ""
    theft_time: str = ""
    date_reported: str = ""
    theft_location: str = ""
    was_attended: str = ""
    attended_by: str = ""
    time_parked_before_theft: str = ""
    witnesses: list[dict] = []
    police_station: str = ""
    police_report_number: str = ""
    later_recovered: str = ""
    # Stolen Articles
    stolen_articles: list[StolenArticle] = []


class DisasterTemplateData(ClaimTemplateDataBase):
    type: Literal["natural_disaster"] = "natural_disaster"
    # Incident Details
    peril_type: str = ""
    incident_date: str = ""
    incident_time: str = ""
    incident_location: str = ""
    # Damage Assessment
    damage_body_work: str = ""
    damage_chassis: str = ""
    damage_accessories_lamps: str = ""
    damage_tyres: str = ""
    estimated_repair_cost: str = ""
    additional_information: str = ""


class LegacyTemplateData(ClaimTemplateDataBase):
    type: Literal["legacy"] = "legacy"
    incident_date: str = ""
    incident_time: str = ""
    incident_location: str = ""
    police_report_filed: str = ""
    police_report_number: str = ""
    incident_circumstances: str = ""
    injuries_description: str = ""
    medical_facilities_visited: str = ""
    medical_expenses: str = ""
    damage_to_other_vehicle: str = ""
    estimated_repair_cost: str = ""
    additional_information: str = ""


from typing import Annotated, Union
from pydantic import Field

ClaimTemplateData = Annotated[
    Union[CollisionTemplateData, TheftTemplateData, DisasterTemplateData, LegacyTemplateData],
    Field(discriminator="type")
]


class SubmissionHistoryEntry(BaseModel):
    version: int
    submitted_at: datetime
    claims_checked: list[VerdictOut] = []
    evidence_image_names: list[str] = []
    evidence_document_names: list[str] = []
    admin_decision: Optional[str] = None
    admin_note: Optional[str] = None
    admin_decided_at: Optional[datetime] = None


class CaseDetail(CaseSummary):
    raw_extracted_claims: list[ExtractedClaim] = []
    confirmed_claims: Optional[list[ExtractedClaim]] = None
    domain_match: Optional[bool] = None
    domain_mismatch_warning: Optional[str] = None
    evidence_image_names: list[str] = []
    evidence_document_names: list[str] = []
    claims_checked: list[VerdictOut] = []
    claims_skipped_administrative: list[SkippedClaim] = []
    report_markdown: Optional[str] = None
    source_type: Optional[SourceType] = None
    company_id: Optional[str] = None
    generation_qa: list[GenerationQA] = []
    pipeline_log_id: Optional[str] = None
    template_data: Optional[ClaimTemplateData] = None
    submission_history: list[SubmissionHistoryEntry] = []
    tier_results: list[TierResult] = []


class ExtractPreviewResponse(BaseModel):
    case_id: str
    claims: list[ExtractedClaim]
    domain_match: bool
    domain_mismatch_warning: Optional[str] = None


class ConfirmClaimsRequest(BaseModel):
    confirmed_claims: list[ExtractedClaim]


class ConfirmAndProcessRequest(BaseModel):
    confirmed_claims: list[ExtractedClaim]


class ReviewRequest(BaseModel):
    action: Literal["accept", "override", "flag"]
    override_verdict: Optional[VerdictCategory] = None
    reviewer_note: Optional[str] = None


class DashboardSummary(BaseModel):
    total_cases: int
    verdict_distribution: dict[str, int]
    cases_awaiting_review: int
    average_confidence: Optional[str] = None


# --- Application submission schemas ---

class SubmitApplicationRequest(BaseModel):
    """Body for POST /applications/submit — links a completed case to a company
    as a formal claim application."""
    case_id: str
    company_id: str


class ApplicationTokenResponse(BaseModel):
    """Returned immediately on successful submission."""
    reference_number: str
    case_id: str
    company_id: str
    company_name: str
    application_status: ApplicationStatus
    submitted_at: datetime


class ApplicationStatusResponse(BaseModel):
    """Returned by GET /applications/{ref}/status."""
    reference_number: str
    case_id: str
    application_status: ApplicationStatus
    company_name: str
    category: Optional[CaseCategory] = None
    submitted_at: datetime
    admin_decided_at: Optional[datetime] = None
    admin_decision: Optional[AdminDecision] = None
    admin_note: Optional[str] = None
    tier_results: list[TierResult] = []


# --- Admin decision schemas ---

class AdminDecideRequest(BaseModel):
    decision: AdminDecision
    note: str = ""


class AdminApplicationSummary(BaseModel):
    """Row in the admin applications list."""
    case_id: str
    reference_number: str
    applicant_user_id: str
    category: Optional[CaseCategory] = None
    company_id: str
    application_status: ApplicationStatus
    submitted_at: datetime
    admin_decided_at: Optional[datetime] = None
    document_name: str
    claims_checked_count: int = 0
    tier_results: list[TierResult] = []


class AdminAnalytics(BaseModel):
    company_id: str
    company_name: str
    total_applications: int
    pending_review: int
    approved: int
    denied: int
    ai_reviewing: int


class DescribeEvidenceResponse(BaseModel):
    case_id: str
    company_id: Optional[str] = None
    descriptions: list[EvidenceDescription]
    questions: list[str]
    prefilled_template: dict[str, str] = {}  # field_id -> extracted value from documents


class SubmitAnswersRequest(BaseModel):
    answers: list[GenerationQA]
    template_data: Optional[ClaimTemplateData] = None


class DraftClaimResponse(BaseModel):
    case_id: str
    claims: list[ExtractedClaim]
    suggestions: list[EvidenceSuggestion] = []


class UpdateClaimsRequest(BaseModel):
    claims: list[ExtractedClaim]
    template_data: Optional[ClaimTemplateData] = None