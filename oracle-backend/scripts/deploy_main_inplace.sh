#!/usr/bin/env bash
set -euo pipefail

# Manual production deploy helper for Oracle VM.
# Preserves the current image under a rollback tag and recreates only the backend service.

REPO_URL="${REPO_URL:-https://github.com/adhamhaithameid/Classroom-Quick-Downloader.git}"
REPO_DIR="${REPO_DIR:-$HOME/Classroom-Quick-Downloader}"
LEGACY_DIR="${LEGACY_DIR:-$HOME/oracle-backend}"
TARGET_REF="${TARGET_REF:-origin/main}"
CREDS_STORE_DIR="${CREDS_STORE_DIR:-$HOME/.config/cqd}"

echo "📦 Starting Oracle deploy (in-place recreate)"
echo "   repo: $REPO_DIR"
echo "   target: $TARGET_REF"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "🔧 Cloning repository into $REPO_DIR"
  git clone "$REPO_URL" "$REPO_DIR"
fi

# Carry forward production-only files from legacy folder once.
if [[ -f "$LEGACY_DIR/.env" && ! -f "$REPO_DIR/oracle-backend/.env" ]]; then
  echo "📥 Copying legacy .env into monorepo oracle-backend/.env"
  cp "$LEGACY_DIR/.env" "$REPO_DIR/oracle-backend/.env"
fi
if [[ -f "$LEGACY_DIR/google-credentials.json" ]]; then
  mkdir -p "$CREDS_STORE_DIR"
  if [[ ! -f "$CREDS_STORE_DIR/google-credentials.json" ]]; then
    echo "📥 Copying legacy google-credentials.json into external secrets dir: $CREDS_STORE_DIR"
    cp "$LEGACY_DIR/google-credentials.json" "$CREDS_STORE_DIR/google-credentials.json"
    chmod 600 "$CREDS_STORE_DIR/google-credentials.json"
  fi
fi

cd "$REPO_DIR"
git fetch --prune origin main

if ! git rev-parse --verify "$TARGET_REF^{commit}" >/dev/null 2>&1; then
  echo "⚠️ Target '$TARGET_REF' not found. Falling back to origin/main"
  TARGET_REF="origin/main"
fi

git checkout -f "$TARGET_REF"
git reset --hard "$TARGET_REF"

DEPLOYED_SHA="$(git rev-parse HEAD)"
export GIT_COMMIT="$DEPLOYED_SHA"
export DEPLOY_TIME="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

cd oracle-backend

# Persist deploy metadata into .env so dashboard status survives manual restarts.
ENV_FILE=".env"
touch "$ENV_FILE"
TMP_ENV="$(mktemp)"
grep -Ev '^(GIT_COMMIT|DEPLOY_TIME)=' "$ENV_FILE" >"$TMP_ENV" || true
cat "$TMP_ENV" >"$ENV_FILE"
rm -f "$TMP_ENV"
printf 'GIT_COMMIT=%s\n' "$GIT_COMMIT" >>"$ENV_FILE"
printf 'DEPLOY_TIME=%s\n' "$DEPLOY_TIME" >>"$ENV_FILE"
if [[ -f "$CREDS_STORE_DIR/google-credentials.json" ]]; then
  printf 'GOOGLE_CREDS_PATH=%s\n' "/run/secrets/google-credentials.json" >>"$ENV_FILE"
  printf 'GOOGLE_CREDS_PATH_HOST=%s\n' "$CREDS_STORE_DIR/google-credentials.json" >>"$ENV_FILE"
fi

ROLLBACK_TAG=""
if docker inspect cqd-oracle-backend >/dev/null 2>&1; then
  CURRENT_IMAGE_ID="$(docker inspect --format '{{.Image}}' cqd-oracle-backend || true)"
  if [[ -n "$CURRENT_IMAGE_ID" ]]; then
    ROLLBACK_TAG="cqd-oracle-backend:rollback-$(date -u +"%Y%m%dT%H%M%SZ")"
    docker tag "$CURRENT_IMAGE_ID" "$ROLLBACK_TAG" || true
    echo "💾 Preserved current image as $ROLLBACK_TAG"
  fi
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_BIN=(docker compose)
else
  COMPOSE_BIN=(docker-compose)
fi

"${COMPOSE_BIN[@]}" build oracle-backend
"${COMPOSE_BIN[@]}" up -d --build --no-deps --force-recreate oracle-backend

echo "✅ Verifying health..."
for attempt in {1..12}; do
  if curl -sf "http://localhost:8080/health" >/dev/null; then
    echo "✅ Health check passed"
    break
  fi
  sleep 5
done
curl -sf "http://localhost:8080/health" >/dev/null

echo "🎉 Deployment complete"
echo "   commit: $DEPLOYED_SHA"
echo "   deploy_time: $DEPLOY_TIME"
if [[ -n "$ROLLBACK_TAG" ]]; then
  echo "   rollback_image: $ROLLBACK_TAG"
fi
