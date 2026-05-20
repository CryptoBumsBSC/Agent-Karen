#!/bin/bash
set -e

npm install
npm run db:push

push_to_github() {
  local repo_slug="$1"
  local remote_url="https://x-access-token:${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${repo_slug}.git"
  echo "Pushing HEAD to github.com/${repo_slug}..."
  if git push "$remote_url" "HEAD:refs/heads/main" --force 2>&1; then
    echo "Pushed to ${repo_slug} successfully."
  else
    echo "WARNING: Push to ${repo_slug} failed. Continuing." >&2
  fi
}

if [ -n "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  push_to_github "CryptoBumsBSC/Agent-Karen"
  push_to_github "astraark/KarenBotTemplate"
else
  echo "WARNING: GITHUB_PERSONAL_ACCESS_TOKEN not set; skipping GitHub sync." >&2
fi
