/**
 * Sales Pipeline sample app validation (static + optional live metadata/runtime).
 * Run: node infrastructure/scripts/validate-sample-sales-app.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.resolve(ROOT, ".validation-sample-sales");
const LOG_FILE = path.join(OUT_DIR, "validation.log");

const METADATA_API = "http://localhost:8082/api/v1";
const RUNTIME_API = "http://localhost:8083/api";
const TENANT = "00000000-0000-4000-8000-000000000001";
const USER = "00000000-0000-4000-8000-000000000002";
const AUTH = `Bearer dev:${TENANT}:${USER}:dev@example.com`;
const SALES_APP_ID = "00000000-0000-4000-8000-000000000070";
const SALES_LEAD_ENTITY_ID = "00000000-0000-4000-8000-000000000073";

const REQUIRED_SCREENS = [
  "SalesHub",
  "LeadList",
  "LeadEdit",
  "AccountList",
  "ContactList",
  "OpportunityList",
  "QuoteList",
  "OrderList",
  "InvoiceList",
];

const REQUIRED_ENTITIES = [
  "Lead",
  "Account",
  "Contact",
  "Opportunity",
  "Quote",
  "Order",
  "Invoice",
];

const results = [];

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  appendFileSync(LOG_FILE, `${msg}\n`);
}

function record(test, passed, detail, optional = false) {
  results.push({ test, passed, detail, optional });
  const label = passed ? "PASS" : optional ? "SKIP" : "FAIL";
  log(`${label} — ${test}: ${detail}`);
}

function checkSeedSource() {
  const seedPath = path.join(ROOT, "services/metadata/internal/seed/sales_app.go");
  const seedGo = path.join(ROOT, "services/metadata/internal/seed/seed.go");
  const assemblerPath = path.join(
    ROOT,
    "services/metadata/internal/services/runtime_assembler.go",
  );
  const scaffoldPath = path.join(ROOT, "services/metadata/internal/scaffold/scaffold.go");
  const runtimeProvider = path.join(ROOT, "apps/runtime/src/runtime-provider.tsx");
  const customerSeed = path.join(ROOT, "services/metadata/internal/seed/customer_app.go");

  if (!existsSync(seedPath)) {
    record("Seed source — sales_app.go", false, "file missing");
    return;
  }
  const src = readFileSync(seedPath, "utf8");
  const wired = readFileSync(seedGo, "utf8");

  record(
    "Seed source — sales_app.go",
    src.includes("SeedSalesApp") && src.includes(`"Sales Pipeline"`),
    "SeedSalesApp + app name present",
  );
  record(
    "Seed wire-up — seed.Run calls SeedSalesApp",
    /SeedSalesApp\(/.test(wired),
    wired.includes("SeedSalesApp") ? "called from seed.go" : "missing",
  );
  record(
    "Seed source — Qualify uses Patch + Navigate",
    src.includes("Patch(Lead, formLead.Item") &&
      src.includes(`Status: "Qualified"`) &&
      src.includes("Patch(Account") &&
      src.includes("Navigate(AccountList)"),
    "Qualify formula present",
  );
  record(
    "Seed source — dogfood hardening",
    src.includes("seedSalesDogfoodHardening") &&
      src.includes("ThisItem.recordId") &&
      src.includes("If(ThisItem.%s"),
    "recordId labels + Status/Stage If default formula",
  );

  if (existsSync(scaffoldPath)) {
    const scaffoldSrc = readFileSync(scaffoldPath, "utf8");
    record(
      "Scaffold — form height from columns",
      scaffoldSrc.includes("scaffoldFormHeight") && scaffoldSrc.includes("deterministicChildID"),
      "sized forms + stable DataCard IDs",
    );
  } else {
    record("Scaffold — form height from columns", false, "scaffold.go missing");
  }

  if (existsSync(customerSeed)) {
    const customerSrc = readFileSync(customerSeed, "utf8");
    record(
      "Customer seed — Columns for form fields",
      customerSrc.includes(`Columns:`) &&
        customerSrc.includes(`"Name"`) &&
        customerSrc.includes(`"Email"`) &&
        customerSrc.includes(`"Phone"`) &&
        customerSrc.includes(`"Status"`),
      "Customer CRUD has DataCard columns",
    );
  } else {
    record("Customer seed — Columns for form fields", false, "customer_app.go missing");
  }

  for (const name of REQUIRED_SCREENS) {
    record(
      `Seed source — screen ${name}`,
      src.includes(name),
      src.includes(name) ? "referenced" : "missing",
    );
  }
  for (const name of REQUIRED_ENTITIES) {
    record(
      `Seed source — entity ${name}`,
      src.includes(`"${name}"`),
      src.includes(`"${name}"`) ? "referenced" : "missing",
    );
  }

  const assembler = existsSync(assemblerPath) ? readFileSync(assemblerPath, "utf8") : "";
  record(
    "Package loader — screens sorted by display_order",
    assembler.includes("sort.SliceStable") && assembler.includes("DisplayOrder"),
    "runtime_assembler sorts screens",
  );

  const provider = existsSync(runtimeProvider) ? readFileSync(runtimeProvider, "utf8") : "";
  record(
    "Runtime client — start screen by display_order",
    provider.includes("orderedScreens") && provider.includes("display_order"),
    "runtime-provider sorts before navigate",
  );

  record(
    "Docs — sample-sales-app.md",
    existsSync(path.join(ROOT, "docs/sample-sales-app.md")),
    "docs present",
  );
}

async function waitForService(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304 || res.status === 401 || res.status === 404) {
        return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function metadataFetch(apiPath) {
  const res = await fetch(`${METADATA_API}${apiPath}`, {
    headers: {
      "Content-Type": "application/json",
      "X-Tenant-Id": TENANT,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function runtimeFetch(apiPath, options = {}) {
  const res = await fetch(`${RUNTIME_API}${apiPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH,
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function checkMetadataLive() {
  const up = await waitForService(`${METADATA_API}/applications/${SALES_APP_ID}`);
  if (!up) {
    record(
      "Metadata — Sales app seeded",
      true,
      "metadata :8082 not running (optional live check skipped)",
      true,
    );
    return false;
  }

  try {
    const { res, body } = await metadataFetch(`/applications/${SALES_APP_ID}`);
    const name = body.data?.name ?? body.data?.application?.name ?? "";
    record(
      "Metadata — Sales app seeded",
      res.ok && name === "Sales Pipeline",
      `name=${name}`,
    );

    const { res: screensRes, body: screensBody } = await metadataFetch(
      `/applications/${SALES_APP_ID}/screens`,
    );
    const screens = screensBody.data?.items ?? screensBody.data ?? [];
    const screenNames = Array.isArray(screens) ? screens.map((s) => s.name) : [];
    const missingScreens = REQUIRED_SCREENS.filter((n) => !screenNames.includes(n));
    record(
      "Metadata — key screens",
      screensRes.ok && missingScreens.length === 0,
      missingScreens.length === 0
        ? `screens=${screenNames.length}`
        : `missing=${missingScreens.join(",")}`,
    );

    if (Array.isArray(screens) && screens.length > 0) {
      const ordered = [...screens].sort((a, b) => {
        const ao = a.display_order ?? 0;
        const bo = b.display_order ?? 0;
        return ao - bo;
      });
      record(
        "Metadata — SalesHub is lowest display_order",
        ordered[0]?.name === "SalesHub",
        `first=${ordered[0]?.name} order=${ordered[0]?.display_order}`,
      );
    }

    const { res: entityRes, body: entityBody } = await metadataFetch(
      `/applications/${SALES_APP_ID}/entities`,
    );
    const entities = entityBody.data?.items ?? entityBody.data ?? [];
    const entityNames = Array.isArray(entities) ? entities.map((e) => e.name) : [];
    const missingEntities = REQUIRED_ENTITIES.filter((n) => !entityNames.includes(n));
    record(
      "Metadata — entities",
      entityRes.ok && missingEntities.length === 0,
      missingEntities.length === 0
        ? `entities=${entityNames.join(",")}`
        : `missing=${missingEntities.join(",")}`,
    );
    return res.ok && name === "Sales Pipeline";
  } catch (err) {
    record("Metadata — Sales app seeded", false, err.message);
    return false;
  }
}

async function checkRuntimeSmoke() {
  const live = await waitForService("http://localhost:8083/live");
  if (!live) {
    record(
      "Runtime HTTP — service available",
      true,
      "runtime :8083 not running (optional live flow skipped)",
      true,
    );
    return;
  }
  record("Runtime HTTP — service available", true, "runtime :8083 live");

  let sessionId = null;
  let recordId = null;
  try {
    const createRes = await runtimeFetch(`/entities/${SALES_LEAD_ENTITY_ID}/records`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          Name: "Validation Lead",
          Status: "Open",
          Company: "Acme",
          Source: "Website",
        },
      }),
    });
    recordId = createRes.body.data?.recordId ?? createRes.body.data?.id;
    record(
      "Runtime HTTP — create Lead record",
      createRes.res.ok && !!recordId,
      createRes.body.error?.message ?? `recordId=${recordId}`,
    );

    const sessionRes = await runtimeFetch("/runtime/session", {
      method: "POST",
      body: JSON.stringify({
        appId: SALES_APP_ID,
        channel: "draft",
        screen: "SalesHub",
      }),
    });
    sessionId = sessionRes.body.data?.sessionId;
    record(
      "Runtime HTTP — start session on SalesHub",
      sessionRes.res.ok && !!sessionId,
      sessionRes.body.error?.message ?? `sessionId=${sessionId}`,
    );
    if (!sessionId) return;

    const galleryRes = await runtimeFetch(
      `/runtime/session/${sessionId}/gallery/galleryLeads`,
    );
    const items = galleryRes.body.data?.items ?? [];
    record(
      "Runtime HTTP — galleryLeads loads",
      galleryRes.res.ok && items.length >= 1,
      `count=${items.length}`,
    );

    const navRes = await runtimeFetch(`/runtime/session/${sessionId}/event`, {
      method: "POST",
      body: JSON.stringify({
        appId: SALES_APP_ID,
        screen: "SalesHub",
        controlId: "btnNavLeads",
        event: "OnSelect",
      }),
    });
    record(
      "Runtime HTTP — Hub Navigate(LeadList)",
      navRes.res.ok,
      navRes.body.error?.message ?? "navigated",
    );

    // Form CRUD smoke: New mode → update fields → submit (Postgres entity_records)
    const modeRes = await runtimeFetch(`/runtime/session/${sessionId}/form/formLead/mode`, {
      method: "POST",
      body: JSON.stringify({ appId: SALES_APP_ID, mode: "New" }),
    });
    record(
      "Runtime HTTP — formLead New mode",
      modeRes.res.ok && (modeRes.body.data?.mode === "New" || modeRes.body.data?.form?.mode === "New"),
      modeRes.body.error?.message ?? `mode=${modeRes.body.data?.mode ?? modeRes.body.data?.form?.mode}`,
    );

    const updateRes = await runtimeFetch(`/runtime/session/${sessionId}/form/formLead/update`, {
      method: "POST",
      body: JSON.stringify({
        appId: SALES_APP_ID,
        fields: {
          Name: "Form Smoke Lead",
          Status: "Open",
          Company: "SmokeCo",
        },
      }),
    });
    record(
      "Runtime HTTP — formLead update fields",
      updateRes.res.ok,
      updateRes.body.error?.message ?? "updated",
    );

    const submitRes = await runtimeFetch(`/runtime/session/${sessionId}/form/formLead/submit`, {
      method: "POST",
      body: JSON.stringify({ appId: SALES_APP_ID }),
    });
    const submittedId =
      submitRes.body.data?.lastSubmit?.recordId ??
      submitRes.body.data?.form?.lastSubmit?.recordId ??
      submitRes.body.data?.currentRecord?.recordId ??
      submitRes.body.data?.form?.currentRecord?.recordId;
    record(
      "Runtime HTTP — formLead SubmitForm create",
      submitRes.res.ok && !!submittedId,
      submitRes.body.error?.message ?? `recordId=${submittedId}`,
    );
    if (submittedId && submittedId !== recordId) {
      try {
        await runtimeFetch(`/entities/${SALES_LEAD_ENTITY_ID}/records/${submittedId}`, {
          method: "DELETE",
        });
      } catch {
        /* best effort */
      }
    }  } catch (err) {
    record("Runtime HTTP — smoke flow", false, err.message);
  } finally {
    if (recordId) {
      try {
        await runtimeFetch(`/entities/${SALES_LEAD_ENTITY_ID}/records/${recordId}`, {
          method: "DELETE",
        });
      } catch {
        /* best effort */
      }
    }
  }
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(LOG_FILE, "");
  log("Sample Sales Pipeline validation starting");

  checkSeedSource();
  await checkMetadataLive();
  await checkRuntimeSmoke();

  const passed = results.filter((r) => r.passed).length;
  const required = results.filter((r) => !r.optional);
  const requiredPassed = required.filter((r) => r.passed).length;
  log(`\n=== ${passed}/${results.length} checks passed (${requiredPassed}/${required.length} required) ===`);
  for (const r of results) {
    const label = r.passed ? "PASS" : r.optional ? "SKIP" : "FAIL";
    console.log(`${label} — ${r.test}: ${r.detail}`);
  }
  process.exit(requiredPassed === required.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
