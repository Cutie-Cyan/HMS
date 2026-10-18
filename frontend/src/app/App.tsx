import { RouterProvider } from "react-router-dom";
import { Providers } from "./Providers";
import { AppErrorBoundary } from "../components/feedback/AppErrorBoundary";
import { router } from "./router";

export function App() {
  return (
    <AppErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </AppErrorBoundary>
  );
}
