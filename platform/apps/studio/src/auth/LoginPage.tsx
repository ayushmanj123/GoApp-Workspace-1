import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  activeSession,
  authMode,
  beginKeycloakLogin,
  completeKeycloakLogin,
  developmentSession,
  writeSession,
} from "./session";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mode = authMode();

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state || mode !== "keycloak") return;
    const redirectUri = `${window.location.origin}/studio/login`;
    setBusy(true);
    void completeKeycloakLogin(code, state, redirectUri)
      .then(() => navigate("/studio", { replace: true }))
      .catch((err: Error) => {
        setError(err.message);
        setBusy(false);
      });
  }, [params, mode, navigate]);

  useEffect(() => {
    if (mode === "development" && activeSession()) {
      navigate("/studio", { replace: true });
    }
  }, [mode, navigate]);

  const handleDevContinue = () => {
    writeSession(developmentSession());
    navigate("/studio", { replace: true });
  };

  const handleKeycloak = () => {
    setBusy(true);
    void beginKeycloakLogin(`${window.location.origin}/studio/login`).catch(
      (err: Error) => {
        setError(err.message);
        setBusy(false);
      },
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--color-bg-muted, #f5f5f7)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          background: "var(--color-bg-surface, #fff)",
          border: "1px solid var(--color-border, #e5e5ea)",
          borderRadius: 12,
          padding: 28,
        }}
      >
        <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>Sign in to GoApps</h1>
        <p style={{ margin: "0 0 20px", color: "var(--color-text-muted, #6e6e73)" }}>
          {mode === "keycloak"
            ? "Authenticate with Keycloak to open Studio."
            : "Development mode uses a local tenant identity. Switch VITE_AUTH_MODE=keycloak for production login."}
        </p>
        {error ? (
          <p style={{ color: "var(--color-danger, #ff3b30)", marginBottom: 12 }}>
            {error}
          </p>
        ) : null}
        {mode === "keycloak" ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleKeycloak}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--color-primary, #5856d6)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {busy ? "Signing in…" : "Continue with Keycloak"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDevContinue}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--color-primary, #5856d6)",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Continue as Development User
          </button>
        )}
      </div>
    </div>
  );
}
