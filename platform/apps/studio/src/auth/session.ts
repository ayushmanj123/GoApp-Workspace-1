const STORAGE_KEY = "goapps.auth.session";

export type AuthMode = "development" | "keycloak";

export interface AuthSession {
  accessToken: string;
  tenantId: string;
  userId: string;
  email?: string;
  expiresAt?: number;
}

const DEV_TENANT = "00000000-0000-4000-8000-000000000001";
const DEV_USER = "00000000-0000-4000-8000-000000000002";

export function authMode(): AuthMode {
  const mode = (import.meta.env.VITE_AUTH_MODE as string | undefined)?.toLowerCase();
  return mode === "keycloak" ? "keycloak" : "development";
}

export function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.accessToken || !parsed?.tenantId || !parsed?.userId) return null;
    if (parsed.expiresAt && parsed.expiresAt * 1000 < Date.now()) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Development identity used when no Keycloak session is present. */
export function developmentSession(): AuthSession {
  const tenantId =
    (import.meta.env.VITE_TENANT_ID as string | undefined) ?? DEV_TENANT;
  const userId = (import.meta.env.VITE_USER_ID as string | undefined) ?? DEV_USER;
  return {
    accessToken: `dev:${tenantId}:${userId}:dev@example.com`,
    tenantId,
    userId,
    email: "dev@example.com",
  };
}

export function activeSession(): AuthSession | null {
  const stored = readSession();
  if (stored) return stored;
  if (authMode() === "development") return developmentSession();
  return null;
}

export function authHeaders(): Record<string, string> {
  const session = activeSession();
  if (!session) {
    return { "Content-Type": "application/json" };
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.accessToken}`,
    "X-Tenant-Id": session.tenantId,
    "X-User-Id": session.userId,
    ...(session.email ? { "X-User-Email": session.email } : {}),
  };
}

export function keycloakConfig() {
  return {
    url: (import.meta.env.VITE_KEYCLOAK_URL as string | undefined) ?? "http://localhost:8080",
    realm: (import.meta.env.VITE_KEYCLOAK_REALM as string | undefined) ?? "goapps",
    clientId:
      (import.meta.env.VITE_KEYCLOAK_CLIENT_ID as string | undefined) ?? "goapps-platform",
  };
}

function randomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function beginKeycloakLogin(redirectUri: string): Promise<void> {
  const cfg = keycloakConfig();
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);
  const state = randomString(24);
  sessionStorage.setItem("goapps.pkce.verifier", verifier);
  sessionStorage.setItem("goapps.pkce.state", state);
  sessionStorage.setItem("goapps.pkce.redirect", redirectUri);

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(
    `${cfg.url.replace(/\/$/, "")}/realms/${cfg.realm}/protocol/openid-connect/auth?${params}`,
  );
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) return {};
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "="));
  return JSON.parse(json) as Record<string, unknown>;
}

export async function completeKeycloakLogin(
  code: string,
  state: string,
  redirectUri: string,
): Promise<AuthSession> {
  const expectedState = sessionStorage.getItem("goapps.pkce.state");
  const verifier = sessionStorage.getItem("goapps.pkce.verifier");
  if (!expectedState || !verifier || state !== expectedState) {
    throw new Error("Invalid login state");
  }
  const cfg = keycloakConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const res = await fetch(
    `${cfg.url.replace(/\/$/, "")}/realms/${cfg.realm}/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Keycloak token exchange failed (${res.status})`);
  }
  const tokenBody = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const payload = decodeJwtPayload(tokenBody.access_token);
  const tenantId = String(
    payload.tenant_id ?? payload.goapps_tenant_id ?? DEV_TENANT,
  );
  const userId = String(payload.sub ?? "");
  if (!userId) {
    throw new Error("Token missing subject");
  }
  const session: AuthSession = {
    accessToken: tokenBody.access_token,
    tenantId,
    userId,
    email: typeof payload.email === "string" ? payload.email : undefined,
    expiresAt: tokenBody.expires_in
      ? Math.floor(Date.now() / 1000) + tokenBody.expires_in
      : undefined,
  };
  writeSession(session);
  sessionStorage.removeItem("goapps.pkce.verifier");
  sessionStorage.removeItem("goapps.pkce.state");
  sessionStorage.removeItem("goapps.pkce.redirect");
  return session;
}

export function logout(): void {
  clearSession();
  if (authMode() !== "keycloak") return;
  const cfg = keycloakConfig();
  const redirect = window.location.origin + "/studio";
  window.location.assign(
    `${cfg.url.replace(/\/$/, "")}/realms/${cfg.realm}/protocol/openid-connect/logout?client_id=${encodeURIComponent(cfg.clientId)}&post_logout_redirect_uri=${encodeURIComponent(redirect)}`,
  );
}
