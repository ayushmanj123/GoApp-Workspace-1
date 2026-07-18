import { Navigate, Outlet, useLocation } from "react-router-dom";
import { activeSession, authMode } from "./session";

export function RequireAuth() {
  const location = useLocation();
  const session = activeSession();
  if (!session && authMode() === "keycloak") {
    return <Navigate to="/studio/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
