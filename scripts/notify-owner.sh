#!/bin/bash
# Sends a Telegram DM to the global owner. Used to surface post-merge GitHub
# push failures so mirror drift gets noticed immediately.
#
# Usage: notify-owner.sh "<message text>"
# Requires: TELEGRAM_BOT_TOKEN and GLOBAL_OWNER_USER_ID in the environment.

set -u

MESSAGE="${1:-}"

if [ -z "$MESSAGE" ]; then
  echo "notify-owner.sh: no message provided; skipping." >&2
  exit 0
fi

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${GLOBAL_OWNER_USER_ID:-}" ]; then
  echo "notify-owner.sh: TELEGRAM_BOT_TOKEN or GLOBAL_OWNER_USER_ID not set; cannot notify owner." >&2
  exit 0
fi

response=$(curl -sS -o /tmp/notify-owner-resp.txt -w "%{http_code}" \
  -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${GLOBAL_OWNER_USER_ID}" \
  --data-urlencode "text=${MESSAGE}" \
  --data-urlencode "disable_web_page_preview=true" \
  || echo "000")

if [ "$response" != "200" ]; then
  echo "notify-owner.sh: Telegram API returned HTTP ${response}." >&2
  cat /tmp/notify-owner-resp.txt >&2 2>/dev/null || true
  echo >&2
fi

rm -f /tmp/notify-owner-resp.txt
exit 0
