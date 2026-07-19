# Storage Connectors (Phase 7.11 / 7.17)

S3-compatible object storage (MinIO locally). Gallery Items bind by connector name.
Runtime `StorageDataSource` lists objects (`key`, `size`, `last_modified`, `etag`).

## Studio

1. **Connectors** → **+ New Connector** → type **Storage (S3 / MinIO)**.
2. Enter endpoint (`localhost:9000`), bucket, access key ID, secret access key, optional prefix.
3. Bind Gallery Items to the connector name.
4. Publish and Open Runtime.

## Auth config

```json
{
  "type": "s3",
  "endpoint": "localhost:9000",
  "bucket": "orders-docs",
  "access_key_id": "minioadmin",
  "secret_id": "<uuid>",
  "use_ssl": false,
  "prefix": "invoices/"
}
```

`secret_access_key` is write-only; persisted as encrypted `secret_id`.

## Writes (Phase 7.17)

Upload and delete objects through Form / Patch / Remove (no Studio file picker; no presigned URLs).

### Create (upload)

Payload fields:

| Field | Required | Notes |
|-------|----------|--------|
| `key` | No | Object key; connector `prefix` is applied when the key does not already start with it. If omitted, a UUID key is generated. |
| `content` | Yes | UTF-8 text, or base64 when `content_encoding` is `base64`. |
| `content_type` | No | Defaults to `text/plain; charset=utf-8` (or `application/octet-stream` for base64). |
| `content_encoding` | No | Set to `base64` to decode `content` before `PutObject`. |

Examples:

```text
Patch(DocsBucket, { key: "a.txt", content: "hello" })
SubmitForm(Form1)   // Form Mode New with key/content fields bound to DocsBucket
```

Overwrite an existing key by creating again with the same `key` (`PutObject`). Form **Edit** mode is refused for storage (use Create overwrite or `Remove`).

### Delete

```text
Remove(DocsBucket, { key: "invoices/a.txt" })
Remove(DocsBucket, Gallery1.Selected)   // uses Selected.key or Selected.id
```

`Delete(recordID uuid)` still works for UUID-named objects (auto-generated keys).

### Update

Not supported. Use Create with the same key to replace object bytes.

## Validation

```bash
node infrastructure/scripts/validate-phase-7.11.mjs
node infrastructure/scripts/validate-phase-7.17.mjs
```

## Out of scope

- Presigned URLs
- Platform-default MinIO credentials (must be set per connector)
- Studio file-picker upload control / binary download streaming
