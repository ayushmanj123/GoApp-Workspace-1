# Storage Connectors (Phase 7.11)

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

## Validation

```bash
node infrastructure/scripts/validate-phase-7.11.mjs
```

## Out of scope

- Upload / delete from gallery
- Presigned URLs
- Platform-default MinIO credentials (must be set per connector)
