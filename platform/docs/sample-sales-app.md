# Sample Sales Pipeline App

Metadata-seeded sample that exercises a Dynamics-inspired **Lead → Qualify → Account/Contact + Opportunity → Quote → Order → Invoice → Won/Lost** path on existing Gallery/Form/Navigate/SubmitForm machinery. It is a **validation harness**, not a CRM product.

## Purpose

Prove that a multi-entity canvas app can:

- Seed entities with text/number/lookup fields
- Scaffold List/Edit screens per entity (`CreateCRUDApp` + `Columns`)
- Navigate from a Hub across entity lists
- Qualify a Lead (submit + navigate) and advance Opportunity `Stage` to Won/Lost
- Use stub Quote/Order/Invoice screens with parent lookup UUIDs

## Seed source

`services/metadata/internal/seed/sales_app.go` — called from `seed.Run` after Customer Management.

Dogfood hardening (`seedSalesDogfoodHardening`) also:

- Tall Lead/Opportunity forms + Qualify/hints below action buttons
- Status default `If(ThisItem.Status, ThisItem.Status, "Open")` (Stage → `Identify`)
- Gallery `lblRecordId` with `ThisItem.recordId` for lookup copy-paste
- Runtime package screens sorted by `display_order` so **SalesHub** is `screens[0]`

### Application identifiers

| Resource | ID |
|----------|-----|
| Application | `00000000-0000-4000-8000-000000000070` |
| SalesHub screen | `00000000-0000-4000-8000-000000000071` |
| Lead entity | `00000000-0000-4000-8000-000000000073` |
| Account entity | `00000000-0000-4000-8000-000000000074` |
| Contact entity | `00000000-0000-4000-8000-000000000075` |
| Opportunity entity | `00000000-0000-4000-8000-000000000076` |
| Quote entity | `00000000-0000-4000-8000-000000000077` |
| Order entity | `00000000-0000-4000-8000-000000000078` |
| Invoice entity | `00000000-0000-4000-8000-000000000079` |

## Pipeline flow

```text
SalesHub
  → LeadList / LeadEdit  (Status: Open | Qualified | Disqualified)
       Qualify → AccountList
  → AccountList / AccountEdit
  → ContactList / ContactEdit  (AccountId = Account record UUID)
  → OpportunityList / OpportunityEdit
       Stage: Identify → Develop → Propose → Present → Close → Won | Lost
  → Quote / Order / Invoice stubs (parent lookup UUID + Status)
```

### Qualify behavior

Qualify uses Wave 5 three-arg `Patch` plus an Account create stub:

```text
Patch(Lead, formLead.Item, { Status: "Qualified" }); Patch(Account, { Name: formLead.Item.Company }); Navigate(AccountList)
```

Open the Lead in **Edit** so `formLead.Item` is loaded (and fill **Company** for the Account name). Contact/Opportunity still use pasted `recordId` lookups.

## Entities (summary)

| Entity | Required / notable fields |
|--------|---------------------------|
| Lead | Name, Status; Company, Email, Source, Budget, Timeline, Notes |
| Account | Name; Industry, Phone, Website |
| Contact | Name; Email, Phone, AccountId (lookup→Account) |
| Opportunity | Name, Stage; EstimatedRevenue, Probability, AccountId, ContactId, LeadId, Notes |
| Quote | Name, Status; OpportunityId, Amount |
| Order | Name, Status; QuoteId, Amount |
| Invoice | Name, Status; OrderId, Amount |

Suggested Status / Stage text values are documented on edit screens and in this file; they are plain text (no choice control type).

## Screens

| Screen | Role |
|--------|------|
| SalesHub | Start screen (`display_order` 0); Navigate to each `*List` |
| `{Entity}List` / `{Entity}Edit` | Gallery ↔ Form CRUD for each of the seven entities |

Hub buttons: Leads, Accounts, Contacts, Opportunities, Quotes, Orders, Invoices. List screens include a **Hub** button back to `SalesHub`.

## Runtime URL (draft)

Sales Pipeline seeds as **draft**. Open Runtime with the draft channel:

`http://localhost:5174/apps/00000000-0000-4000-8000-000000000070?channel=draft`

Studio App Manager **Draft preview** appends `?channel=draft` the same way. Without the query, Runtime defaults to **published** and will not load this app until publish.

## Dogfood path

1. Run metadata seed; open the draft Runtime URL above (or Studio Preview) — starts on SalesHub.
2. Leads → New → Status defaults to `Open` → Submit.
3. Edit Lead → set Status `Qualified` → **Qualify** → Accounts.
4. Create Account → copy `recordId` from gallery → Contact (`AccountId`) → Opportunity (lookups + Stage defaults `Identify`).
5. Advance Opportunity Stage to `Won` or `Lost`.
6. Optionally create Quote → Order → Invoice with parent lookup IDs.

### Walkthrough checklist

| Step | Expected |
|------|----------|
| Open app (`?channel=draft`) | Lands on SalesHub |
| New Lead | Status shows Open |
| Qualify | Sets Status=Qualified, stubs Account from Company, lands on AccountList |
| Gallery rows | Name + recordId visible |
| Opportunity | Stage defaults Identify; can set Won/Lost |

## Dogfood results (runnable pass)

| Check | Result |
|-------|--------|
| Static + live validator (`validate-sample-sales-app.mjs`) | **32/32 PASS** with metadata `:8082` + runtime `:8083` |
| Hub `btnNavLeads` OnSelect → Navigate(LeadList) | **PASS** (property `{formula}` promoted into package Formulas + kernel fallback) |
| Draft Runtime URL | `?channel=draft` loads Sales Pipeline without publish |
| Hub → Won path | Lead Status=Qualified → Account → Contact (AccountId paste) → Opportunity Stage=Won verified via Runtime entity API + Hub Navigate smoke |
| Qualify button | `Patch(Lead, formLead.Item, {Status})` + `Patch(Account, {Name: Company})` + Navigate; requires Edit form Item |
| Start screen | Package assembler + Runtime client sort by `display_order` → SalesHub first |
| Lookup UX | `lblRecordId` / `ThisItem.recordId` under each entity gallery |

## Constraints / known limitations

- Contact/Opportunity (and Quote/Order/Invoice) still created manually with pasted lookup UUIDs
- Lookups are UUID strings (no join/expand UI)
- No products, price lists, activities, or business-process stage gates
- No entity record rows in the metadata seed — create data via Runtime Preview / Record API
- DataCards for form columns use scaffold-generated IDs (re-seed may add duplicate cards under forms)

## Validation

```bash
node infrastructure/scripts/validate-sample-sales-app.mjs
```

Static checks always run. Live metadata checks run when `:8082` is up. Runtime HTTP smoke (create Lead, draft session on SalesHub, galleryLeads, Hub→Leads Navigate) runs when `:8083` is up.
