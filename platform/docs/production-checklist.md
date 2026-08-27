# Production checklist

Short pre-deploy checks for GoApps platform (gateway + metadata + runtime + publish).

- [ ] `AUTH_MODE=keycloak` on all production services (development headers disabled)
- [ ] `SECRETS_MASTER_KEY` set and rotated; never commit plaintext secrets
- [ ] `CORS_ALLOW_ORIGINS` allowlist matches Studio/Runtime origins only
- [ ] MinIO (or S3-compatible) reachable for publish artifacts; bucket + credentials configured
- [ ] `SESSION_MAX` (or equivalent session limits) sized for expected concurrent users
- [ ] Runtime single-replica until Redis-backed session/cache sharing is in place
- [ ] PlatformAdmin (or equivalent admin role) assigned only to operators who need ALM mutate routes
- [ ] Gateway is the only public edge; metadata/runtime/publish stay internal
