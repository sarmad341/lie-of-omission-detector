import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: API_BASE });

// Call this once, from a component that has access to Clerk's session
// (see App.jsx wiring) — attaches the auth token to every request.
export function attachAuthToken(getToken) {
  api.interceptors.request.use(async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

export const CATEGORY_MAP = {
  "Car Insurance": "car_insurance",
  "Property / Home": "loan_application", // closest fit for now
  Health: "health_insurance",
  Other: "car_insurance",
};

// --- Entry Point A (legacy single-shot upload) ---

export const uploadCase = (documentFile, imageFiles) => {
  const formData = new FormData();
  formData.append("document", documentFile);
  imageFiles.forEach((f) => formData.append("images", f));
  return api.post("/cases", formData);
};

// --- Entry Point A (staged: extract -> confirm -> evidence) ---

export const extractPreview = (categoryLabel, claimFile, subCategory = null) => {
  const formData = new FormData();
  formData.append("category", CATEGORY_MAP[categoryLabel] || "car_insurance");
  if (subCategory) formData.append("sub_category", subCategory);
  formData.append("document", claimFile);
  return api.post("/cases/extract-preview", formData);
};

export const confirmClaims = (caseId, claims) =>
  api.post(`/cases/${caseId}/confirm-claims`, { confirmed_claims: claims });

export const submitEvidence = (caseId, imageFiles = [], documentFiles = []) => {
  const formData = new FormData();
  (imageFiles || []).forEach((f) => formData.append("images", f));
  (documentFiles || []).forEach((f) => formData.append("documents", f));
  return api.post(`/cases/${caseId}/evidence`, formData);
};

// --- Shared case routes ---

export const listCases = (limit = 20) => api.get(`/cases?limit=${limit}`);

export const getCase = (caseId) => api.get(`/cases/${caseId}`);

export const getReport = (caseId) => api.get(`/cases/${caseId}/report`);

export const reviewClaim = (caseId, claimId, action, overrideVerdict, note) =>
  api.post(`/cases/${caseId}/claims/${claimId}/review`, {
    action,
    override_verdict: overrideVerdict || null,
    reviewer_note: note || "",
  });

// --- Entry Point B: Claim Generator ---
// NOTE: category here is the raw backend value ("car_insurance"), not the
// display label — callers should pass CATEGORY_MAP[label] already resolved.

export const describeEvidence = (categoryLabel, companyId, files, subCategory = null) => {
  const formData = new FormData();
  formData.append("category", CATEGORY_MAP[categoryLabel] || "car_insurance");
  formData.append("company_id", companyId);
  if (subCategory) formData.append("sub_category", subCategory);
  files.forEach((f) => formData.append("files", f));
  return api.post("/claim-generator/describe", formData);
};

export const draftClaim = (caseId, answers, templateData) =>
  api.post(`/claim-generator/${caseId}/draft`, {
    answers,
    template_data: templateData,
  });

export const downloadClaimPdf = (caseId) =>
  api.get(`/claim-generator/${caseId}/pdf`, { responseType: "blob" });

export const updateClaims = (caseId, claims, templateData = null) =>
  api.patch(`/claim-generator/${caseId}/claims`, { claims, template_data: templateData });

export const confirmAndProcessGenerated = (caseId, confirmedClaims) =>
  api.post(`/claim-generator/${caseId}/confirm-and-process`, {
    confirmed_claims: confirmedClaims,
  });

// --- Policy Screening / Companies ---

export const listCompanies = (category) =>
  api.get(`/companies${category ? `?category=${category}` : ""}`);

export const screenCase = (caseId, companyId) =>
  api.post(`/cases/${caseId}/screen?company_id=${companyId}`);

// --- Applications (Path A submission & tracking) ---

export const submitApplication = (caseId, companyId) =>
  api.post("/applications/submit", { case_id: caseId, company_id: companyId });

export const submitFromGeneration = (caseId, companyId) =>
  api.post("/applications/submit-from-generation", { case_id: caseId, company_id: companyId });

export const listMyApplications = () => api.get("/applications/my");

export const getApplicationStatus = (referenceNumber) =>
  api.get(`/applications/${referenceNumber}/status`);

export const getApplicationResult = (referenceNumber) =>
  api.get(`/applications/${referenceNumber}/result`);

// --- Admin API ---

export const adminListApplications = (statusFilter = "", page = 1, limit = 20) => {
  const query = new URLSearchParams();
  if (statusFilter) query.append("status", statusFilter);
  query.append("page", page);
  query.append("limit", limit);
  return api.get(`/admin/applications?${query.toString()}`);
};

export const adminGetApplication = (caseId) =>
  api.get(`/admin/applications/${caseId}`);

export const adminDecideApplication = (caseId, decision, note) =>
  api.post(`/admin/applications/${caseId}/decide`, { decision, note });

export const adminGetAnalytics = () => api.get("/admin/analytics");

export const adminGetPolicyRules = () => api.get("/admin/policy-rules");

export const adminUpdatePolicyRules = (policyVersion, rules) =>
  api.put("/admin/policy-rules", { policy_version: policyVersion, rules });

export const resubmitApplication = (referenceNumber, imageFiles = [], documentFiles = []) => {
  const formData = new FormData();
  (imageFiles || []).forEach((f) => formData.append("images", f));
  (documentFiles || []).forEach((f) => formData.append("documents", f));
  return api.post(`/applications/${referenceNumber}/resubmit`, formData);
};

