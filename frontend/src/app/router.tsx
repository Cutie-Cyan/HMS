import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { AccessDeniedPage } from "../components/feedback/AccessDeniedPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SetupPasswordPage } from "../features/auth/SetupPasswordPage";
import { useAuth } from "../features/auth/AuthProvider";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PatientWorkspace } from "../features/patients/PatientWorkspace";
import { PatientRegistrationWorkspace } from "../features/patients/PatientRegistrationWorkspace";
import { PublicPatientRegistrationPage } from "../features/patients/PublicPatientRegistrationPage";
import { PatientPortalPage } from "../features/patients/PatientPortalPage";
import { DoctorFormPage } from "../features/encounters/DoctorFormPage";
import { NurseStationERPage } from "../features/encounters/NurseStationERPage";
import { AvailableDoctorsWorkspace } from "../features/encounters/AvailableDoctorsWorkspace";
import { RequestsWorkspace } from "../features/requests/RequestsWorkspace";
import { InventoryWorkspace } from "../features/inventory/InventoryWorkspace";
import { WardsWorkspace } from "../features/wards/WardsWorkspace";
import { BillingWorkspace } from "../features/billing/BillingWorkspace";
import { StaffAdminWorkspace } from "../features/admin/StaffAdminWorkspace";
import { AuditWorkspace } from "../features/admin/AuditWorkspace";
import {
  canAccessModule,
  homePathForRole,
  type HmsModule,
} from "../lib/permissions";

function SessionGate() {
  const { session, profile, loading, profileLoading, configured, error } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-sm text-slate-500">
        Verifying staff access…
      </div>
    );
  if (!configured)
    return (
      <AccessDeniedPage
        title="HMS configuration required"
        description="Supabase is not configured. Add the project URL and public anon/publishable key to the local environment before staff sign-in."
      />
    );
  if (!session)
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (profileLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" aria-hidden="true" />
          Verifying your staff access…
        </div>
      </div>
    );
  if (!profile)
    return (
      <AccessDeniedPage
        title="Staff access not approved"
        description={
          error ??
          "This account does not have an active staff profile. Contact the HMS administrator."
        }
      />
    );
  return <Outlet />;
}

function RoleGate({ module }: { module: HmsModule }) {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/login" replace />;
  if (!canAccessModule(profile.role, module)) {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }
  if (module === "dashboard") return <DashboardPage />;
  if (module === "patients") return <PatientWorkspace />;
  if (module === "patient-registration") return <PatientRegistrationWorkspace />;
  if (module === "encounters") return <DoctorFormPage />;
  if (module === "triage") {
    if (profile.role !== "nurse_station" || profile.wardId !== "e073038e-a976-4c7a-88ca-eb5c3418d287") {
      return <Navigate to={homePathForRole(profile.role)} replace />;
    }
    return <NurseStationERPage />;
  }
  if (module === "available-doctors") return <AvailableDoctorsWorkspace />;
  if (module === "requests") return <RequestsWorkspace />;
  if (module === "cbc") return <RequestsWorkspace mode="cbc" />;
  if (module === "billing") return <BillingWorkspace />;
  if (module === "inventory" || module === "medicine-stock" || module === "profit-inventory" || module === "medicine-requests" || module === "lab-supplies" || module === "lab-requests" || module === "lab-results" || module === "lab-profit-inventory") return <InventoryWorkspace />;
  if (module === "wards") return <WardsWorkspace />;
  if (module === "staff") return <StaffAdminWorkspace />;
  if (module === "audit") return <AuditWorkspace />;
  return <AccessDeniedPage title="Module unavailable" description="This module is not available for this account." />;
}

function RoleHomeRedirect() {
  const { profile } = useAuth();
  return (
    <Navigate to={profile ? homePathForRole(profile.role) : "/login"} replace />
  );
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/patient-registration", element: <PublicPatientRegistrationPage /> },
  { path: "/patient-portal", element: <PatientPortalPage /> },
  { path: "/setup-password", element: <SetupPasswordPage /> },
  {
    element: <SessionGate />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <RoleHomeRedirect /> },
          { path: "overview", element: <RoleGate module="dashboard" /> },
          { path: "patients", element: <RoleGate module="patients" /> },
          { path: "patient-registration-workspace", element: <RoleGate module="patient-registration" /> },
          { path: "encounters", element: <RoleGate module="encounters" /> },
          { path: "nurse-station-er", element: <RoleGate module="triage" /> },
          { path: "available-doctors", element: <RoleGate module="available-doctors" /> },
          { path: "requests", element: <RoleGate module="requests" /> },
          { path: "cbc", element: <RoleGate module="cbc" /> },
          { path: "wards", element: <RoleGate module="wards" /> },
          { path: "billing", element: <RoleGate module="billing" /> },
          { path: "inventory", element: <Navigate to="/lab-inventory" replace /> },
          { path: "lab-inventory", element: <RoleGate module="inventory" /> },
          { path: "lab-supplies", element: <RoleGate module="lab-supplies" /> },
          { path: "lab-requests", element: <RoleGate module="lab-requests" /> },
          { path: "lab-results", element: <RoleGate module="lab-results" /> },
          { path: "lab-profit-inventory", element: <RoleGate module="lab-profit-inventory" /> },
          { path: "medicine-stock", element: <RoleGate module="medicine-stock" /> },
          { path: "medicine-requests", element: <RoleGate module="medicine-requests" /> },
          { path: "profit-inventory", element: <RoleGate module="profit-inventory" /> },
          { path: "staff", element: <RoleGate module="staff" /> },
          { path: "audit", element: <RoleGate module="audit" /> },
          {
            path: "*",
            element: (
              <AccessDeniedPage
                title="Page not found"
                description="This HMS page does not exist or is not available."
              />
            ),
          },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" });
