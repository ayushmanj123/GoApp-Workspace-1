/**
 * Generates docs/architecture.pdf from the GoApps platform architecture document.
 * Usage: node infrastructure/scripts/generate-architecture-pdf.mjs
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");
const outputPdf = path.join(workspaceRoot, "docs", "architecture.pdf");
const tempHtml = path.join(__dirname, ".architecture-pdf-temp.html");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GoApps Platform Architecture</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    @page { margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #1a1a2e;
      line-height: 1.5;
      font-size: 11pt;
      max-width: 100%;
      margin: 0;
      padding: 24px 32px;
    }
    h1 { font-size: 22pt; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin-top: 0; }
    h2 { font-size: 15pt; color: #1e40af; margin-top: 28px; page-break-after: avoid; }
    h3 { font-size: 12pt; color: #334155; margin-top: 18px; page-break-after: avoid; }
    p { margin: 8px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 20px;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #eff6ff; font-weight: 600; }
    tr:nth-child(even) td { background: #f8fafc; }
    .mermaid { margin: 16px 0; page-break-inside: avoid; }
    .meta { color: #64748b; font-size: 9pt; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 600; }
    .done { background: #dcfce7; color: #166534; }
    .partial { background: #fef9c3; color: #854d0e; }
    .planned { background: #f1f5f9; color: #475569; }
    ul { margin: 8px 0; padding-left: 20px; }
    li { margin: 4px 0; }
    pre.flow {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 12px;
      font-size: 9pt;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <h1>GoApps Platform — Architecture</h1>
  <p class="meta">Cloud-native low-code platform monorepo · Generated ${new Date().toISOString().slice(0, 10)}</p>

  <p><strong>GoApps Platform</strong> is a cloud-native low-code monorepo for building, publishing, and running applications.
  Users design apps in <strong>Studio</strong>, store definitions in <strong>Metadata</strong>, publish via <strong>Publish</strong>,
  and execute them through the <strong>Runtime</strong> (browser + Go backend).</p>

  <h2>1. High-Level System Architecture</h2>
  <div class="mermaid">
flowchart TB
    subgraph Clients["Client Layer"]
        Browser["Web Browser"]
        Studio["Studio App\\nReact + TS + Vite\\n:5173"]
        RuntimeFE["Runtime App\\nReact + TS + Vite\\n:5174"]
    end
    subgraph Edge["API Edge"]
        Gateway["Gateway Service\\nGo + Fiber\\n:8090"]
    end
    subgraph Backend["Backend Microservices - Go + Fiber"]
        Auth["auth :8081"]
        Metadata["metadata :8082"]
        RuntimeBE["runtime :8083"]
        Connector["connector :8084"]
        Publish["publish :8085"]
        Environment["environment :8086"]
        Audit["audit :8087"]
        Search["search :8088"]
    end
    subgraph Formula["Formula Engine"]
        PowerFx["GoApps.PowerFx\\n.NET 8 + Power Fx\\n:8085 dev"]
    end
    subgraph Infra["Infrastructure"]
        PG[("PostgreSQL 17")]
        Redis[("Redis 7")]
        MinIO[("MinIO")]
        Keycloak["Keycloak 26"]
    end
    Browser --> Studio
    Browser --> RuntimeFE
    Studio -->|"dev /api proxy"| Metadata
    Studio -->|"dev /publish-api"| Publish
    Studio -->|"dev /formula-api"| PowerFx
    RuntimeFE --> Gateway
    Studio --> Gateway
    Gateway --> Metadata
    Gateway --> Publish
    Gateway --> RuntimeBE
    Metadata --> PG
    RuntimeBE --> PG
    Keycloak --> PG
    Auth -.-> Keycloak
    Connector -.-> Redis
    Search -.-> Redis
    Publish -.-> MinIO
  </div>

  <h2>2. Monorepo Structure &amp; Languages</h2>
  <div class="mermaid">
flowchart LR
    subgraph Root["platform/ monorepo"]
        GW["go.work - Go 1.25"]
        PNPM["pnpm 9 + Node 20+"]
    end
    subgraph Apps["apps/ - TypeScript"]
        S["@goapps/studio"]
        R["@goapps/runtime"]
    end
    subgraph Services["services/ - Go"]
        SVC["9 Go modules\\ncmd/server + internal/"]
    end
    subgraph Packages["packages/"]
        TS["TS: shared sdk ui config formula"]
        GO["Go: shared/go"]
        DOTNET["C#: GoApps.PowerFx"]
    end
    subgraph Infra2["infrastructure/"]
        Docker["Docker Compose"]
        K8s["Kubernetes Kustomize"]
        Scripts["dev + validation scripts"]
    end
    Root --> Apps
    Root --> Services
    Root --> Packages
    Root --> Infra2
  </div>

  <table>
    <tr><th>Layer</th><th>Path</th><th>Languages</th><th>Tooling</th></tr>
    <tr><td>Frontend apps</td><td>apps/studio, apps/runtime</td><td>TypeScript, React 18</td><td>Vite 6, ESLint 9</td></tr>
    <tr><td>Backend services</td><td>services/*</td><td>Go 1.22+ (workspace 1.25)</td><td>Fiber v2, go work</td></tr>
    <tr><td>Shared TS libs</td><td>packages/shared, sdk, ui, config, formula</td><td>TypeScript 5.7</td><td>tsc, pnpm workspaces</td></tr>
    <tr><td>Shared Go lib</td><td>packages/shared/go</td><td>Go</td><td>Fiber, slog, caarlos0/env</td></tr>
    <tr><td>Formula engine</td><td>packages/formula/dotnet</td><td>C# / .NET 8</td><td>Microsoft.PowerFx.Interpreter 1.3.1</td></tr>
    <tr><td>Infrastructure</td><td>infrastructure/</td><td>YAML, SQL, Shell, Node</td><td>Docker Compose, Kustomize</td></tr>
    <tr><td>CI/CD</td><td>.github/workflows/</td><td>—</td><td>GitHub Actions</td></tr>
  </table>

  <h2 class="page-break">3. Backend Services</h2>
  <table>
    <tr><th>Service</th><th>Port</th><th>Module</th><th>Status</th><th>Responsibility</th></tr>
    <tr><td>gateway</td><td>8090</td><td>services/gateway</td><td><span class="badge done">Implemented</span></td><td>Auth middleware, reverse proxy</td></tr>
    <tr><td>auth</td><td>8081</td><td>services/auth</td><td><span class="badge planned">Scaffold</span></td><td>Keycloak/OAuth2 integration (future)</td></tr>
    <tr><td>metadata</td><td>8082</td><td>services/metadata</td><td><span class="badge done">Implemented</span></td><td>App definitions, screens, controls, entities</td></tr>
    <tr><td>runtime</td><td>8083</td><td>services/runtime</td><td><span class="badge done">Implemented</span></td><td>Session kernel, state, formulas, records, reactive</td></tr>
    <tr><td>connector</td><td>8084</td><td>services/connector</td><td><span class="badge planned">Scaffold</span></td><td>External integrations</td></tr>
    <tr><td>publish</td><td>8085</td><td>services/publish</td><td><span class="badge partial">Partial</span></td><td>Publishing proxy to metadata</td></tr>
    <tr><td>environment</td><td>8086</td><td>services/environment</td><td><span class="badge planned">Scaffold</span></td><td>Env config &amp; secrets</td></tr>
    <tr><td>audit</td><td>8087</td><td>services/audit</td><td><span class="badge planned">Scaffold</span></td><td>Audit trail recording</td></tr>
    <tr><td>search</td><td>8088</td><td>services/search</td><td><span class="badge planned">Scaffold</span></td><td>Search indexing &amp; queries</td></tr>
  </table>

  <h3>Go Dependencies (by service)</h3>
  <table>
    <tr><th>Library</th><th>Used by</th></tr>
    <tr><td>github.com/gofiber/fiber/v2</td><td>All services</td></tr>
    <tr><td>github.com/goapps-platform/shared</td><td>All services (local replace)</td></tr>
    <tr><td>gorm.io/gorm + gorm.io/driver/postgres</td><td>metadata, runtime</td></tr>
    <tr><td>github.com/golang-migrate/migrate/v4</td><td>metadata</td></tr>
    <tr><td>github.com/go-playground/validator/v10</td><td>metadata</td></tr>
    <tr><td>github.com/google/uuid</td><td>metadata, runtime, gateway</td></tr>
  </table>

  <h3>Shared Go Package (packages/shared/go)</h3>
  <table>
    <tr><th>Package</th><th>Purpose</th></tr>
    <tr><td>auth</td><td>JWT validation stub, AuthContext, dev tokens, middleware</td></tr>
    <tr><td>config</td><td>Base service configuration</td></tr>
    <tr><td>errors</td><td>Typed AppError</td></tr>
    <tr><td>health</td><td>/health, /ready endpoints</td></tr>
    <tr><td>logging</td><td>Structured slog (JSON prod / text dev)</td></tr>
    <tr><td>middleware</td><td>Request ID, logging, error handler, tenant extraction</td></tr>
    <tr><td>response</td><td>Standard JSON API envelope</td></tr>
    <tr><td>server</td><td>Fiber server bootstrap</td></tr>
    <tr><td>tenant</td><td>Multi-tenant context</td></tr>
  </table>

  <h2 class="page-break">4. Runtime Service — Internal Architecture</h2>
  <div class="mermaid">
flowchart TB
    subgraph HTTP["HTTP Layer - Fiber"]
        AuthMW["auth.Middleware"]
        CacheMW["databinding.RequestCacheMiddleware"]
        Routes["/api/* routes"]
    end
    subgraph Kernel["Runtime Kernel"]
        RK["RuntimeKernel"]
        Reg["Session Registry - 30min TTL"]
        MetaLoader["PostgresMetadataLoader"]
    end
    subgraph Modules["Internal Modules"]
        State["state - variables collections"]
        Formula["formula - evaluation"]
        DBind["databinding - entity datasources"]
        Reactive["reactive - events navigation"]
        Records["records - entity_records CRUD"]
        Gallery["gallery - gallery endpoints"]
    end
    DB[("PostgreSQL")]
    Routes --> AuthMW --> CacheMW
    CacheMW --> Kernel
    CacheMW --> State
    CacheMW --> Reactive
    CacheMW --> Formula
    CacheMW --> Records
    CacheMW --> DBind
    RK --> State
    RK --> Formula
    RK --> DBind
    RK --> Reactive
    RK --> Reg
    RK --> MetaLoader
    Records --> DB
    DBind --> DB
    MetaLoader --> DB
  </div>

  <h2>5. Gateway &amp; Authentication Flow</h2>
  <div class="mermaid">
sequenceDiagram
    participant Client
    participant Gateway as Gateway :8090
    participant Auth as auth.Middleware
    participant Meta as metadata :8082
    participant Pub as publish :8085
    participant RT as runtime :8083
    Client->>Gateway: HTTP /api/*
    Gateway->>Auth: Validate token / dev headers
    Auth-->>Gateway: AuthContext
    alt runtime or entity records route
        Gateway->>RT: Proxy + X-Tenant-Id X-User-Id
    else publish or versions route
        Gateway->>Pub: Proxy + identity headers
    else default
        Gateway->>Meta: Proxy + identity headers
    end
  </div>
  <p><strong>Auth modes:</strong> Development uses X-Tenant-Id headers or Bearer dev:&lt;tenant&gt;:&lt;user&gt; tokens.
  Production (planned) uses Keycloak JWT via JWKS (AUTH_MODE=keycloak — stub).</p>

  <h2 class="page-break">6. Frontend Architecture</h2>
  <h3>Studio (@goapps/studio — port 5173)</h3>
  <div class="mermaid">
flowchart TB
    subgraph StudioUI["Studio UI"]
        Layout["StudioLayout - Allotment panels"]
        Canvas["Canvas - Konva + react-konva"]
        Monaco["Formula Editor - Monaco"]
        Panels["Explorer Property Toolbox"]
        Preview["RuntimePreviewModal"]
    end
    subgraph State["Client State"]
        Zustand["Zustand stores"]
        RQ["TanStack React Query"]
    end
    subgraph APIs["API Clients"]
        MetaAPI["metadata APIs"]
        PubAPI["publish-api"]
        FormulaAPI["formula-api to Power Fx"]
    end
    StudioUI --> State
    StudioUI --> APIs
    MetaAPI --> Metadata
    PubAPI --> Publish
    FormulaAPI --> PowerFx
  </div>
  <p><strong>Libraries:</strong> React Router 6, Konva 9, Monaco 0.55, Zustand 5, TanStack Query 5, Allotment 1.20.</p>

  <h3>Runtime (@goapps/runtime — port 5174)</h3>
  <div class="mermaid">
flowchart TB
    subgraph RuntimeUI["Runtime Shell"]
        AppPage["ApplicationPage"]
        ScreenPage["ScreenPage"]
        Renderer["control-renderer"]
        Components["Button Label TextInput Dropdown\\nContainer Gallery Form Timer"]
    end
    subgraph FormulaFE["Client Formula Execution"]
        ExecActions["execute-navigate set collect submit-form"]
        Stores["variable collection navigation stores"]
        Engine["@goapps/formula engines"]
    end
    subgraph Registry["Component Registry"]
        UIReg["packages/ui registry"]
        Bridge["registry-bridge.tsx"]
    end
    RuntimeUI --> FormulaFE
    Bridge --> UIReg
    Components --> Registry
    Engine --> PowerFx
    RuntimeUI --> Gateway
  </div>

  <h2>7. Shared TypeScript Packages</h2>
  <table>
    <tr><th>Package</th><th>Description</th></tr>
    <tr><td>@goapps/shared</td><td>API envelope types, tenant context</td></tr>
    <tr><td>@goapps/sdk</td><td>HTTP client skeleton</td></tr>
    <tr><td>@goapps/ui</td><td>Component registry, property/event definitions</td></tr>
    <tr><td>@goapps/config</td><td>ESLint, Prettier, tsconfig shared config</td></tr>
    <tr><td>@goapps/formula</td><td>FormulaEngine abstraction (Literal, Remote, PowerFx)</td></tr>
  </table>

  <h3>Formula Engines</h3>
  <table>
    <tr><th>Engine</th><th>Language</th><th>Use case</th></tr>
    <tr><td>LiteralFormulaEngine</td><td>TypeScript</td><td>Static property values</td></tr>
    <tr><td>PowerFxEngine</td><td>TS wrapper → .NET API</td><td>Power Fx expressions</td></tr>
    <tr><td>RemoteFormulaEngine</td><td>TypeScript</td><td>Calls runtime Go formula API</td></tr>
    <tr><td>GoApps.PowerFx</td><td>C# / .NET 8</td><td>Microsoft.PowerFx.Interpreter HTTP server</td></tr>
  </table>

  <h2 class="page-break">8. Infrastructure &amp; Deployment</h2>
  <h3>Local Dev (Docker Compose)</h3>
  <table>
    <tr><th>Container</th><th>Image</th><th>Port</th><th>Purpose</th></tr>
    <tr><td>goapps-postgres</td><td>postgres:17-alpine</td><td>5432</td><td>App DB + Keycloak DB</td></tr>
    <tr><td>goapps-redis</td><td>redis:7-alpine</td><td>6379</td><td>Cache / event bus (future)</td></tr>
    <tr><td>goapps-minio</td><td>minio/minio:latest</td><td>9000/9001</td><td>Object storage (future)</td></tr>
    <tr><td>goapps-keycloak</td><td>keycloak:26.0</td><td>8080</td><td>Identity provider</td></tr>
  </table>

  <h3>Kubernetes (infrastructure/kubernetes/)</h3>
  <ul>
    <li><strong>Namespace:</strong> goapps-platform</li>
    <li><strong>Tooling:</strong> Kustomize</li>
    <li><strong>Deployed:</strong> auth, metadata, runtime, connector, publish, environment, audit, search</li>
    <li><strong>Not yet in K8s:</strong> gateway, studio, runtime frontend, formula API</li>
  </ul>

  <h3>CI/CD (GitHub Actions)</h3>
  <table>
    <tr><th>Workflow</th><th>Triggers</th><th>Steps</th></tr>
    <tr><td>ci-go.yml</td><td>services/**, packages/shared/go/**</td><td>go work sync, vet, test, build</td></tr>
    <tr><td>ci-ts.yml</td><td>apps/**, packages/**</td><td>pnpm install, typecheck, lint, build</td></tr>
  </table>

  <h2>9. End-to-End Request Flows</h2>
  <h3>A. Build an app (Studio)</h3>
  <pre class="flow">Developer → Studio (:5173)
  → Canvas (Konva) edits controls
  → Property/Formula panels (Monaco + @goapps/formula)
  → REST → Metadata (:8082)
  → Publish → Publish service (:8085) → Metadata</pre>

  <h3>B. Run a published app (Runtime)</h3>
  <pre class="flow">End user → Runtime FE (:5174)
  → Load metadata (gateway → metadata)
  → POST /api/runtime/session (gateway → runtime kernel)
  → Client formula actions (navigate, set, collect)
  → Poll /api/runtime/events/poll/{sessionId}
  → Entity CRUD → /api/entities/{id}/records</pre>

  <h3>C. Formula evaluation</h3>
  <pre class="flow">Studio/Runtime → /formula-api → GoApps.PowerFx (.NET :8085)
  OR
Runtime FE → RemoteFormulaEngine → Runtime Go formula module (:8083)</pre>

  <h2 class="page-break">10. Cross-Cutting Concerns</h2>
  <table>
    <tr><th>Concern</th><th>Implementation</th></tr>
    <tr><td>Multi-tenancy</td><td>X-Tenant-Id, X-User-Id, X-Organization-Id, X-Request-ID; PostgreSQL RLS</td></tr>
    <tr><td>API contract</td><td>Uniform JSON envelope (success, data, error, meta)</td></tr>
    <tr><td>Logging</td><td>Go log/slog structured JSON</td></tr>
    <tr><td>Health</td><td>/health, /ready, /live on gateway &amp; runtime</td></tr>
    <tr><td>Package manager</td><td>pnpm 9 workspaces</td></tr>
    <tr><td>Go workspace</td><td>go.work links all service modules + shared Go</td></tr>
  </table>

  <h2>11. Implementation Maturity</h2>
  <table>
    <tr><th>Area</th><th>Status</th></tr>
    <tr><td>Monorepo scaffold</td><td><span class="badge done">Complete</span></td></tr>
    <tr><td>Docker infra (PG, Redis, MinIO, Keycloak)</td><td><span class="badge done">Complete</span></td></tr>
    <tr><td>Metadata CRUD + migrations</td><td><span class="badge done">Implemented</span></td></tr>
    <tr><td>Runtime kernel, state, reactive, records</td><td><span class="badge done">Implemented</span></td></tr>
    <tr><td>Gateway + dev auth</td><td><span class="badge done">Implemented</span></td></tr>
    <tr><td>Studio canvas + Monaco formulas</td><td><span class="badge done">Implemented</span></td></tr>
    <tr><td>Runtime component rendering</td><td><span class="badge done">Implemented</span></td></tr>
    <tr><td>Power Fx (.NET) formula API</td><td><span class="badge done">Implemented</span></td></tr>
    <tr><td>auth, connector, audit, search, environment</td><td><span class="badge planned">Scaffold</span></td></tr>
    <tr><td>Keycloak JWT production auth</td><td><span class="badge planned">Stub</span></td></tr>
    <tr><td>Redis / MinIO service integration</td><td><span class="badge planned">Planned</span></td></tr>
    <tr><td>K8s gateway + frontends</td><td><span class="badge planned">Not in manifests</span></td></tr>
  </table>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: "default", securityLevel: "loose" });
  </script>
</body>
</html>`;

mkdirSync(path.dirname(outputPdf), { recursive: true });
writeFileSync(tempHtml, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file:///${tempHtml.replace(/\\/g, "/")}`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelectorAll(".mermaid svg").length >= 6, null, {
  timeout: 60000,
});
await page.pdf({
  path: outputPdf,
  format: "A4",
  printBackground: true,
  margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
});
await browser.close();

console.log(`Wrote ${outputPdf}`);
