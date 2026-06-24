import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { useApplicationStore } from "./store/applicationStore";
import { useStudioStore } from "./store/studioStore";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__applicationStore =
    useApplicationStore;
  (window as unknown as Record<string, unknown>).__studioStore = useStudioStore;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
