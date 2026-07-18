import { Navigate, Outlet, useLocation } from "react-router-dom";
import { readSession, authMode } from "./session";

/** Guards app routes. Keycloak mode requires an explicit stored session. */
export function RequireAuth() {
  const location = useLocation();
  if (authMode() === "keycloak" && !readSession()) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
        state={{ from: location }}
      />
    );
  }
  return <Outlet />;
}
