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
import { DoctorFormPage } from "../features/encounters/DoctorFormPage";
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
  const { session, profile, loading, configured, error } = useAuth();
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
  if (module === "available-doctors") return <AvailableDoctorsWorkspace />;
  if (module === "requests") return <RequestsWorkspace />;
  if (module === "billing") return <BillingWorkspace />;
  if (module === "inventory") return <InventoryWorkspace />;
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
          { path: "available-doctors", element: <RoleGate module="available-doctors" /> },
          { path: "requests", element: <RoleGate module="requests" /> },
          { path: "wards", element: <RoleGate module="wards" /> },
          { path: "billing", element: <RoleGate module="billing" /> },
          { path: "inventory", element: <RoleGate module="inventory" /> },
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
