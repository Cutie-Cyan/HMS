import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { FeaturePlaceholder } from "../components/feedback/FeaturePlaceholder";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "patients", element: <FeaturePlaceholder title="Patients" description="Patient registration and demographics will be implemented in the Information Officer workflow." /> },
      { path: "encounters", element: <FeaturePlaceholder title="Clinical encounters" description="Emergency Nurse findings, recommendations, doctor records, and admission decisions will be implemented here." /> },
      { path: "requests", element: <FeaturePlaceholder title="Requests" description="Medicine and laboratory requests, payment status, and fulfillment will be implemented with role-specific access." /> },
      { path: "wards", element: <FeaturePlaceholder title="Wards and beds" description="Four-ward bed availability, room configuration, and admission assignment will be connected to the guarded database functions." /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
