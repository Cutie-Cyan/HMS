import {
  createBrowserRouter,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { AccessDeniedPage } from "../components/feedback/AccessDeniedPage";
import { FeaturePlaceholder } from "../components/feedback/FeaturePlaceholder";
import { LoginPage } from "../features/auth/LoginPage";
import { useAuth } from "../features/auth/AuthProvider";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { PatientWorkspace } from "../features/patients/PatientWorkspace";
import { DoctorFormPage } from "../features/encounters/DoctorFormPage";
import { RequestsWorkspace } from "../features/requests/RequestsWorkspace";
import { InventoryWorkspace } from "../features/inventory/InventoryWorkspace";
import { WardsWorkspace } from "../features/wards/WardsWorkspace";
import { BillingWorkspace } from "../features/billing/BillingWorkspace";
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
  if (!canAccessModule(profile.role, module)) return <AccessDeniedPage />;
  if (module === "dashboard") return <DashboardPage />;
  if (module === "patients") return <PatientWorkspace />;
  if (module === "encounters") return <DoctorFormPage />;
  if (module === "requests") return <RequestsWorkspace />;
  if (module === "billing") return <BillingWorkspace />;
  if (module === "inventory") return <InventoryWorkspace />;
  if (module === "wards") return <WardsWorkspace />;
  const descriptions: Record<
    Exclude<HmsModule, "dashboard">,
    { title: string; description: string }
  > = {
    patients: {
      title: "Patients",
      description:
        "Patient registration and demographic records for authorized staff.",
    },
    encounters: {
      title: "Clinical encounters",
      description:
        "Emergency Nurse findings, recommendations, doctor records, and admission decisions.",
    },
    requests: {
      title: "Requests",
      description:
        "Medicine and laboratory request queues, payment status, and fulfillment.",
    },
    wards: {
      title: "Wards and beds",
      description:
        "Four-ward bed availability, room configuration, admission assignment, and ward transfers.",
    },
    billing: {
      title: "Billing",
      description:
        "Request payments, final bill review, and discharge processing.",
    },
    inventory: {
      title: "Inventory",
      description:
        "Department-specific stock, fulfillment, and laboratory results.",
    },
    staff: {
      title: "Staff administration",
      description:
        "Manage authorized staff profiles and role assignments. Staff-management operations are not enabled yet.",
    },
    audit: {
      title: "Audit log",
      description:
        "Review administrative audit events. The audit viewer is not enabled yet.",
    },
  };
  const item = descriptions[module];
  return (
    <FeaturePlaceholder title={item.title} description={item.description} />
  );
}

function RoleHomeRedirect() {
  const { profile } = useAuth();
  return (
    <Navigate to={profile ? homePathForRole(profile.role) : "/login"} replace />
  );
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
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
          { path: "encounters", element: <RoleGate module="encounters" /> },
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
]);
