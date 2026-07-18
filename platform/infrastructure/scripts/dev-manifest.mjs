/**
 * Single source of truth for local development services.
 * Add or adjust entries here when ports, commands, or dependencies change.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://goapps:changeme@localhost:5432/goapps?sslmode=disable";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** @typedef {'studio' | 'full'} DevProfile */

/**
 * @typedef {object} DevService
 * @property {string} id
 * @property {string} label
 * @property {DevProfile[]} profiles
 * @property {'go' | 'pnpm' | 'docker'} kind
 * @property {number} [port]
 * @property {string} [healthPath]
 * @property {string} cwd
 * @property {string} [command]
 * @property {string[]} [args]
 * @property {string} [pnpmScript]
 * @property {Record<string, string>} [env]
 * @property {string[]} [dependsOn] service ids that should be healthy first
 * @property {string} [url] human-readable URL shown in the ready banner
 */

/** @type {DevService[]} */
export const devServices = [
  {
    id: "auth",
    label: "Auth",
    profiles: ["full"],
    kind: "go",
    port: 8081,
    healthPath: "/health",
    cwd: "services/auth",
    env: {
      SERVICE_NAME: "auth-service",
      PORT: "8081",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
      KEYCLOAK_URL: "http://localhost:8080",
      KEYCLOAK_REALM: "goapps",
    },
    url: "http://localhost:8081",
  },
  {
    id: "metadata",
    label: "Metadata",
    profiles: ["studio", "full"],
    kind: "go",
    port: 8082,
    healthPath: "/health",
    cwd: "services/metadata",
    env: {
      SERVICE_NAME: "metadata-service",
      PORT: "8082",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
    },
    url: "http://localhost:8082",
  },
  {
    id: "runtime",
    label: "Runtime",
    profiles: ["studio", "full"],
    kind: "go",
    port: 8083,
    healthPath: "/health",
    cwd: "services/runtime",
    dependsOn: ["metadata"],
    env: {
      SERVICE_NAME: "runtime-service",
      PORT: "8083",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
      METRICS_ENABLED: "true",
    },
    url: "http://localhost:8083",
  },
  {
    id: "connector",
    label: "Connector",
    profiles: ["full"],
    kind: "go",
    port: 8084,
    healthPath: "/health",
    cwd: "services/connector",
    env: {
      SERVICE_NAME: "connector-service",
      PORT: "8084",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
    },
    url: "http://localhost:8084",
  },
  {
    id: "publish",
    label: "Publish",
    profiles: ["studio", "full"],
    kind: "go",
    port: 8085,
    healthPath: "/health",
    cwd: "services/publish",
    dependsOn: ["metadata"],
    env: {
      SERVICE_NAME: "publish-service",
      PORT: "8085",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      METADATA_SERVICE_URL: "http://localhost:8082",
    },
    url: "http://localhost:8085",
  },
  {
    id: "environment",
    label: "Environment",
    profiles: ["full"],
    kind: "go",
    port: 8086,
    healthPath: "/health",
    cwd: "services/environment",
    env: {
      SERVICE_NAME: "environment-service",
      PORT: "8086",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
    },
    url: "http://localhost:8086",
  },
  {
    id: "audit",
    label: "Audit",
    profiles: ["full"],
    kind: "go",
    port: 8087,
    healthPath: "/health",
    cwd: "services/audit",
    env: {
      SERVICE_NAME: "audit-service",
      PORT: "8087",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
    },
    url: "http://localhost:8087",
  },
  {
    id: "search",
    label: "Search",
    profiles: ["full"],
    kind: "go",
    port: 8088,
    healthPath: "/health",
    cwd: "services/search",
    env: {
      SERVICE_NAME: "search-service",
      PORT: "8088",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      DATABASE_URL,
      REDIS_URL,
    },
    url: "http://localhost:8088",
  },
  {
    id: "gateway",
    label: "Gateway",
    profiles: ["studio", "full"],
    kind: "go",
    port: 8090,
    healthPath: "/health",
    cwd: "services/gateway",
    dependsOn: ["metadata", "publish", "runtime"],
    env: {
      SERVICE_NAME: "gateway-service",
      PORT: "8090",
      APP_ENV: "development",
      LOG_LEVEL: "debug",
      AUTH_MODE: "development",
      KEYCLOAK_URL: "http://localhost:8080",
      KEYCLOAK_REALM: "goapps",
      KEYCLOAK_CLIENT_ID: "goapps-platform",
      KEYCLOAK_AUDIENCE: "goapps-platform",
      METADATA_SERVICE_URL: "http://localhost:8082",
      PUBLISH_SERVICE_URL: "http://localhost:8085",
      RUNTIME_SERVICE_URL: "http://localhost:8083",
    },
    url: "http://localhost:8090",
  },
  {
    id: "formula-api",
    label: "Formula API",
    profiles: ["studio", "full"],
    kind: "pnpm",
    port: 8091,
    healthPath: "/health",
    cwd: ".",
    pnpmScript: "dev:formula-api",
    env: {
      FORMULA_API_PORT: "8091",
    },
    url: "http://localhost:8091",
  },
  {
    id: "studio",
    label: "Studio",
    profiles: ["studio", "full"],
    kind: "pnpm",
    port: 5173,
    cwd: ".",
    pnpmScript: "dev:studio",
    dependsOn: ["gateway"],
    url: "http://localhost:5173",
  },
  {
    id: "runtime-app",
    label: "Runtime App",
    profiles: ["studio", "full"],
    kind: "pnpm",
    port: 5174,
    cwd: ".",
    pnpmScript: "dev:runtime",
    dependsOn: ["metadata", "runtime"],
    url: "http://localhost:5174",
  },
];

export const infraComposeFile = "infrastructure/docker/docker-compose.yml";

export const infraEndpoints = [
  { label: "PostgreSQL", url: "postgres://goapps:changeme@localhost:5432/goapps" },
  { label: "Redis", url: "redis://localhost:6379" },
  { label: "MinIO API", url: "http://localhost:9000" },
  { label: "MinIO Console", url: "http://localhost:9001" },
  { label: "Keycloak", url: "http://localhost:8080" },
];

/**
 * @param {DevProfile} profile
 * @param {string[] | undefined} onlyIds
 */
export function selectServices(profile, onlyIds) {
  let selected = devServices.filter((service) => service.profiles.includes(profile));
  if (onlyIds?.length) {
    const wanted = new Set(onlyIds.map((id) => id.trim().toLowerCase()));
    selected = devServices.filter((service) => wanted.has(service.id));
  }
  return selected;
}
