# Google Sheets Connectors (Excel Apps)

Google Sheets connectors bind Gallery, Form, and DataTable controls to live spreadsheet rows in Google Drive via the Google Sheets API v4.

## Setup (local)

1. In Google Cloud Console, create an OAuth client (Web application).
2. Enable **Google Sheets API** and **Google Drive API**.
3. Add authorized redirect URI matching metadata:

   `http://localhost:8082/api/v1/connectors/oauth/callback`

4. Set credentials in the **repo root** [`platform/.env`](../.env.example) — this is what `pnpm dev` injects into metadata (not only `services/metadata/.env`):

```
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
OAUTH_CONNECTOR_REDIRECT_URI=http://localhost:8082/api/v1/connectors/oauth/callback
```

5. Apply metadata migrations (includes `000022` `google_sheets` type), then restart with `pnpm dev`.

OAuth uses PKCE plus Google `access_type=offline` and `prompt=consent` so a refresh token is stored.

The callback URL `GET /api/v1/connectors/oauth/callback` is **public** (no JWT / `X-Tenant-Id`) because Google redirects the browser there. Tenant/user come from the pending OAuth `state`.

Creating a Google Sheets connector without those env vars fails with a clear error pointing at this doc.

## Studio — connector path

1. **Connectors** → **+ New Connector** → type **Google Sheets (Excel Apps)**.
2. Enter connector name, sheet name, optional spreadsheet ID, and key column. Prefer **Connection scope → User**.
3. Open the connector detail page and click **Connect Google**.
4. Browse Drive (or paste Spreadsheet ID), pick the sheet tab, save. Use **Open spreadsheet in Google Sheets** when an ID is set.
5. Bind Gallery `items` or Form `dataSource` to the connector name.
6. Publish and open Runtime.

## Auth config

```json
{
  "type": "oauth_authorization_code",
  "spreadsheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "header_row": 1,
  "sheet_name": "Customers",
  "key_column": "Id",
  "connection_scope": "user"
}
```

## Discovery APIs

| Endpoint | Purpose |
|----------|---------|
| `GET /connectors/:id/google/files` | List spreadsheets in Drive |
| `GET /connectors/:id/google/sheets?spreadsheet_id=` | List worksheet tabs |
| `GET /connectors/:id/google/preview?sheet=` | Header row + sample rows |

## CRUD

Runtime `GoogleSheetsDataSource` implements the standard `DataSource` interface:

- **Query** — reads sheet values, applies in-memory filter/sort/paging
- **Create** — appends a row (auto-generates key if missing; header match is case-insensitive)
- **Update** — updates row by key column or row index
- **Delete** — removes row via Sheets `batchUpdate` (scaffold Delete uses `Remove(source, form.Item)`)

## Excel Apps wizard

**Manager → Excel Apps → New Excel App** runs a guided flow:

1. Connect Google OAuth (reuses a single bootstrap connector)
2. Pick spreadsheet from Drive
3. Select sheets and key columns (from preview headers)
4. Scaffold List + Edit screens on the canvas with Gallery/DataTable + Form (including Delete)

Scaffold API: `POST /api/v1/applications/excel-app-scaffold`

Bootstrap apps (`description: excel_app:bootstrap`) are hidden from the Excel Apps list.

When multiple sheets are selected, **List/Edit screens are generated only for the first selected sheet**; other sheets become bindable datasources in Studio.

## Manual E2E checklist

1. Set `GOOGLE_OAUTH_*` + `OAUTH_CONNECTOR_REDIRECT_URI` in **`platform/.env`**; restart with `pnpm dev`.
2. **Excel Apps** → **New Excel App** → Connect Google → pick spreadsheet → select a sheet with headers → Create.
3. Studio canvas shows Gallery + Form fields; save if needed.
4. Publish → open Runtime → complete OAuth banner if prompted → list rows → New / Edit / Submit / Delete against the live sheet.
5. Alternate: **Connectors** → New Google Sheets → Connect → Browse Drive → bind Gallery `items` to the connector name → publish → same CRUD.

## Known limitations

- **Single-writer** expectation for V1 (concurrent sheet edits can race).
- **Primary sheet screens only** — wizard scaffolds List/Edit for the first selected sheet; extra sheets are connectors/datasources without auto-generated screens.
- **Row identity** via `key_column` (stable `recordId`); missing/wrong key falls back to row index and is fragile after inserts/deletes.

See also: [Runtime data binding](./runtime-data-binding.md), [REST connectors](./rest-connectors.md).
