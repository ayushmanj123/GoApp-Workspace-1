# External infrastructure references for GoApps Platform.
# These services are typically managed separately (managed DB, Redis, etc.).
# Deploy in-cluster only for development/staging overlays.
#
# - PostgreSQL: see managed RDS / Cloud SQL / in-cluster StatefulSet
# - Redis: see managed ElastiCache / in-cluster Deployment
# - MinIO: see S3-compatible object storage or in-cluster MinIO operator
# - Keycloak: see managed IdP or in-cluster Keycloak operator
