#!/usr/bin/env bash
set -euo pipefail

echo "==> Setting up Sentinel Suite dev environment..."

# Ensure the sentinel-net Docker network exists (compose services use it)
docker network create sentinel-net 2>/dev/null || true

# If running inside a devcontainer, use Docker-network-aware env vars
if [ -n "${REMOTE_CONTAINERS:-}" ] || [ -n "${CODESPACES:-}" ] || [ -n "${DEVCONTAINER:-}" ]; then
  if [ -f .devcontainer/.env.devcontainer ]; then
    echo "==> Detected devcontainer — applying .env.devcontainer overrides"
    # Start from .env.example as base, then overlay devcontainer values
    if [ ! -f .env ]; then
      cp .env.example .env
    fi
    # Merge devcontainer overrides (lines starting with # are skipped)
    while IFS= read -r line; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      key="${line%%=*}"
      # Replace the line in .env if key exists, otherwise append
      if grep -q "^${key}=" .env 2>/dev/null; then
        sed -i "s|^${key}=.*|${line}|" .env
      else
        echo "$line" >> .env
      fi
    done < .devcontainer/.env.devcontainer
  fi
fi

# Install dependencies
echo "==> Installing dependencies..."
pnpm install

# Set up git hooks
echo "==> Setting up git hooks..."
pnpm exec husky || true

# Start core infrastructure (Postgres + Redis)
echo "==> Starting core infrastructure..."
docker compose -f docker/docker-compose.yml --profile core up -d

# Wait for Postgres to be ready
echo "==> Waiting for Postgres..."
timeout 30 bash -c 'until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U sentinel 2>/dev/null; do sleep 1; done' || echo "Warning: Postgres may not be ready yet"

# Run database migrations
echo "==> Running database migrations..."
pnpm --filter @sentinel/db run migrate || echo "Warning: Migrations may need to be run manually"

echo "==> Dev environment ready!"
