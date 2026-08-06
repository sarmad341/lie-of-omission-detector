import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  RedirectToSignIn,
  useAuth,
} from "@clerk/clerk-react";
import { useEffect } from "react";
import Header from "./components/Header";
import LandingPage from "./pages/LandingPage";
import NewCaseWizard from "./pages/NewCaseWizard";
import CaseListPage from "./pages/CaseListPage";
import CaseDetailPage from "./pages/CaseDetailPage";
import GetStartedChoice from "./pages/GetStartedChoice";
import GenerateClaimWizard from "./pages/GenerateClaimWizard";
import TokenConfirmation from "./pages/TokenConfirmation";
import ApplicationDetailPage from "./pages/ApplicationDetailPage";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import AdminApplicationQueue from "./pages/AdminApplicationQueue";
import AdminPolicyRules from "./pages/AdminPolicyRules";
import AdminApplicationReview from "./pages/AdminApplicationReview";
import ApplyFromDraftPage from "./pages/ApplyFromDraftPage";
import ApplicationResubmitPage from "./pages/ApplicationResubmitPage";
import { attachAuthToken } from "./api";
import { NavigationGuardProvider } from "./context/NavigationGuardContext";

function Protected({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

export default function App() {
  const { getToken } = useAuth();

  useEffect(() => {
    attachAuthToken(getToken);
  }, [getToken]);

  return (
    <BrowserRouter>
      <NavigationGuardProvider>
      <Header />
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />

        {/* Omission Analysis Flow (existing) */}
        <Route path="/new-case" element={<Protected><NewCaseWizard /></Protected>} />
        <Route path="/cases/:caseId" element={<Protected><CaseDetailPage /></Protected>} />

        {/* User Dashboard — canonical path is /dashboard; redirect old /cases */}
        <Route path="/dashboard" element={<Protected><CaseListPage /></Protected>} />
        <Route path="/cases" element={<Navigate to="/dashboard" replace />} />

        {/* Get Started choice */}
        <Route path="/get-started" element={<Protected><GetStartedChoice /></Protected>} />

        {/* Generate Claim Wizard (Path B) */}
        <Route path="/generate-claim" element={<Protected><GenerateClaimWizard /></Protected>} />

        {/* Path A: Apply for Claim */}
        <Route path="/apply-confirm" element={<Protected><TokenConfirmation /></Protected>} />
        <Route path="/apply-from-draft/:caseId" element={<Protected><ApplyFromDraftPage /></Protected>} />

        {/* Application tracking (user) */}
        <Route path="/applications/:referenceNumber" element={<Protected><ApplicationDetailPage /></Protected>} />
        <Route path="/resubmit-evidence/:referenceNumber" element={<Protected><ApplicationResubmitPage /></Protected>} />

        {/* Admin Portal — nested routes */}
        <Route path="/admin" element={<Protected><AdminLayout /></Protected>}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="applications" element={<AdminApplicationQueue />} />
          <Route path="policy-rules" element={<AdminPolicyRules />} />
        </Route>
        
        {/* Admin Review details (uses full screen instead of AdminLayout sidebar) */}
        <Route path="/admin/applications/:caseId" element={<Protected><AdminApplicationReview /></Protected>} />
      </Routes>
      </NavigationGuardProvider>
    </BrowserRouter>
  );
}


