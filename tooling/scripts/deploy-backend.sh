#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PROJECT_ID="text-a-story"
REGION="us-east1"
SERVICE="family-api"
IMAGE_REPO="us-east1-docker.pkg.dev/${PROJECT_ID}/family-api/family-api"
ALLOWED_ORIGINS="https://family.calebtonkinson.com"

CONFIG_PATH="/tmp/cloudbuild.family-api.yaml"

if [ ! -f "$CONFIG_PATH" ]; then
  cat > "$CONFIG_PATH" <<'YAML'
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'apps/server/Dockerfile', '-t', 'us-east1-docker.pkg.dev/text-a-story/family-api/family-api', '.']
images:
  - 'us-east1-docker.pkg.dev/text-a-story/family-api/family-api'
YAML
fi

gcloud builds submit --project "$PROJECT_ID" --config "$CONFIG_PATH" .

IMAGE_DIGEST=$(gcloud builds list --project "$PROJECT_ID" --limit 1 --format='value(id)' \
  | xargs -I{} gcloud builds describe {} --project "$PROJECT_ID" --format='value(results.images[0].digest)')

if [ -z "$IMAGE_DIGEST" ]; then
  echo "Failed to resolve image digest from Cloud Build." >&2
  exit 1
fi

gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "${IMAGE_REPO}@${IMAGE_DIGEST}" \
  --allow-unauthenticated \
  --set-env-vars "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,DBOS_DATABASE_URL=DBOS_DATABASE_URL:latest,NEXTAUTH_SECRET=NEXTAUTH_SECRET:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,VAPID_PUBLIC_KEY=VAPID_PUBLIC_KEY:latest,VAPID_PRIVATE_KEY=VAPID_PRIVATE_KEY:latest"

SERVICE_URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')
echo "Deployed to: ${SERVICE_URL}"
