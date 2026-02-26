#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

if command -v nvm >/dev/null 2>&1; then
  nvm use >/dev/null
elif [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
  nvm use >/dev/null
fi

node_version=$(node -v || true)
if [[ -n "$node_version" ]]; then
  node_major=${node_version#v}
  node_major=${node_major%%.*}
  if (( node_major < 18 )); then
    echo "Node >= 18 is required. Current: $node_version"
    exit 1
  fi
fi

args=(vercel deploy --prod --confirm)
if [[ -n "${VERCEL_SCOPE:-}" ]]; then
  args+=(--scope "$VERCEL_SCOPE")
fi

"${args[@]}"
