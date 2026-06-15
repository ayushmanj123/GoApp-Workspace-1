#!/usr/bin/env bash
# Start local development infrastructure via Docker Compose.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/../docker"

echo "Starting GoApps Platform infrastructure..."
docker compose -f "${DOCKER_DIR}/docker-compose.yml" up -d

echo ""
echo "Infrastructure started. Services:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis:      localhost:6379"
echo "  MinIO:      http://localhost:9000 (console: http://localhost:9001)"
echo "  Keycloak:   http://localhost:8080"
