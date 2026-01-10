#!/usr/bin/env bash
# Usage: NETLIFY_SITE_ID=your_site_id ./scripts/push-env-to-netlify.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/my-task-app/.env"

if ! command -v netlify >/dev/null 2>&1; then
  echo "netlify CLI not found. Install with: npm i -g netlify-cli" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Env file not found: $ENV_FILE" >&2
  echo "Create your env file or copy from .env.example" >&2
  exit 1
fi

if [ -z "${NETLIFY_SITE_ID:-}" ]; then
  echo "Please set NETLIFY_SITE_ID environment variable to your Netlify site id." >&2
  echo "Example: NETLIFY_SITE_ID=your_site_id netlify login && NETLIFY_SITE_ID=your_site_id ./scripts/push-env-to-netlify.sh" >&2
  exit 1
fi

echo "Pushing env vars from $ENV_FILE to Netlify site $NETLIFY_SITE_ID"

while IFS= read -r line || [ -n "$line" ]; do
  # skip comments and empty lines
  trimmed="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [ -z "$trimmed" ] || [[ "$trimmed" == \#* ]]; then
    continue
  fi
  key="${trimmed%%=*}"
  value="${trimmed#*=}"
  if [ -z "$key" ]; then
    continue
  fi
  echo "Setting $key on Netlify..."
  netlify env:set "$key" "$value" --site "$NETLIFY_SITE_ID"
done < "$ENV_FILE"

echo "Done. Trigger a deploy from Netlify dashboard or run: netlify deploy --prod --site $NETLIFY_SITE_ID"
