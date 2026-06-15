#!/usr/bin/env bash
# Stop local development infrastructure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/../docker"

echo "Stopping GoApps Platform infrastructure..."
docker compose -f "${DOCKER_DIR}/docker-compose.yml" down
