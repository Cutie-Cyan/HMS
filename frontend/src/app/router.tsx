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
      <div className="min-h-screen bg-[#f3f5f8]" aria-label="Loading HMS" role="status">
        <div className="flex min-h-screen animate-pulse">
          <aside className="hidden w-64 shrink-0 flex-col gap-5 bg-slate-900 p-5 lg:flex">
            <div className="flex h-14 items-center gap-3 border-b border-white/10 pb-4"><div className="size-10 rounded-xl bg-slate-700" /><div className="h-4 w-20 rounded bg-slate-700" /></div>
            <div className="space-y-3 pt-3">{[0,1,2,3,4,5,6,7].map((item) => <div key={item} className="h-10 rounded-xl bg-slate-800" />)}</div>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8"><div className="h-5 w-36 rounded bg-slate-200" /><div className="flex items-center gap-3"><div className="size-9 rounded-full bg-slate-200" /><div className="hidden space-y-2 sm:block"><div className="h-3 w-24 rounded bg-slate-200" /><div className="h-2.5 w-16 rounded bg-slate-100" /></div></div></header>
            <main className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><div className="h-7 w-52 rounded-lg bg-slate-200" /><div className="h-3 w-72 max-w-full rounded bg-slate-100" /></div><div className="h-10 w-32 rounded-xl bg-slate-200" /></div>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="h-5 w-44 rounded bg-slate-200" /><div className="h-10 w-56 rounded-xl bg-slate-100" /></div><div className="space-y-3">{[0,1,2,3,4,5].map((item) => <div key={item} className="flex gap-3 rounded-xl border border-slate-100 p-3"><div className="size-9 shrink-0 rounded-lg bg-slate-100" /><div className="flex-1 space-y-2 py-1"><div className="h-3 w-2/5 rounded bg-slate-100" /><div className="h-3 w-3/5 rounded bg-slate-100" /></div><div className="h-8 w-20 rounded-lg bg-slate-100" /></div>)}</div></section>
            </main>
          </div>
        </div>
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
      <div className="min-h-screen bg-[#f3f5f8]" aria-label="Loading HMS" role="status">
        <div className="flex min-h-screen animate-pulse">
          <aside className="hidden w-64 shrink-0 flex-col gap-5 bg-slate-900 p-5 lg:flex">
            <div className="flex h-14 items-center gap-3 border-b border-white/10 pb-4"><div className="size-10 rounded-xl bg-slate-700" /><div className="h-4 w-20 rounded bg-slate-700" /></div>
            <div className="space-y-3 pt-3">{[0,1,2,3,4,5,6,7].map((item) => <div key={item} className="h-10 rounded-xl bg-slate-800" />)}</div>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8"><div className="h-5 w-36 rounded bg-slate-200" /><div className="flex items-center gap-3"><div className="size-9 rounded-full bg-slate-200" /><div className="hidden space-y-2 sm:block"><div className="h-3 w-24 rounded bg-slate-200" /><div className="h-2.5 w-16 rounded bg-slate-100" /></div></div></header>
            <main className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-2"><div className="h-7 w-52 rounded-lg bg-slate-200" /><div className="h-3 w-72 max-w-full rounded bg-slate-100" /></div><div className="h-10 w-32 rounded-xl bg-slate-200" /></div>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div className="h-5 w-44 rounded bg-slate-200" /><div className="h-10 w-56 rounded-xl bg-slate-100" /></div><div className="space-y-3">{[0,1,2,3,4,5].map((item) => <div key={item} className="flex gap-3 rounded-xl border border-slate-100 p-3"><div className="size-9 shrink-0 rounded-lg bg-slate-100" /><div className="flex-1 space-y-2 py-1"><div className="h-3 w-2/5 rounded bg-slate-100" /><div className="h-3 w-3/5 rounded bg-slate-100" /></div><div className="h-8 w-20 rounded-lg bg-slate-100" /></div>)}</div></section>
            </main>
          </div>
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
    if (profile.role !== "nurse_station" || !profile.wardId) {
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
