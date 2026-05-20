#!/bin/bash
set -e

npm install
npm run db:push

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

push_to_github() {
  local repo_slug="$1"
  local remote_url="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${repo_slug}.git"
  local push_output
  local push_status
  echo "Pushing HEAD to github.com/${repo_slug}..."
  push_output=$(git push "$remote_url" "HEAD:refs/heads/main" --force 2>&1) && push_status=0 || push_status=$?
  # Strip the token from any output before printing or notifying.
  local sanitized_output
  sanitized_output=$(printf '%s' "$push_output" | sed "s|${GITHUB_PERSONAL_ACCESS_TOKEN}|***|g")
  if [ "$push_status" -eq 0 ]; then
    printf '%s\n' "$sanitized_output"
    echo "Pushed to ${repo_slug} successfully."
  else
    printf '%s\n' "$sanitized_output" >&2
    echo "WARNING: Push to ${repo_slug} failed. Continuing." >&2
    bash "$SCRIPT_DIR/notify-owner.sh" \
      "⚠️ GitHub auto-sync FAILED for ${repo_slug}

$sanitized_output" || true
  fi
}

if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  push_to_github "CryptoBumsBSC/Agent-Karen"
  push_to_github "astraark/KarenBotTemplate"
else
  echo "WARNING: GITHUB_PERSONAL_ACCESS_TOKEN not set; skipping GitHub sync." >&2
  bash "$SCRIPT_DIR/notify-owner.sh" \
    "⚠️ GitHub auto-sync SKIPPED — GITHUB_PERSONAL_ACCESS_TOKEN is not set in the environment." || true
fi
