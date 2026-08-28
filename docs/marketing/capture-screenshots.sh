#!/usr/bin/env bash
#
# capture-screenshots.sh — orchestrate Playwright screenshot capture for
# Dead Air Radio. Starts the Expo Web dev server, waits for it to be ready,
# runs capture.js against the 6 core screens from docs/store/screenshots.md,
# then stops Expo.
#
# Prereqs (install once, outside the project package.json):
#   npm install -g playwright
#   npx playwright install chromium
#
# Usage:
#   cd marketing && ./capture-screenshots.sh
#   cd marketing && ./capture-screenshots.sh --viewports apple
#   cd marketing && ./capture-screenshots.sh --base http://localhost:8081
#
# Any unknown args after our flags are forwarded to capture.js.

set -euo pipefail

# ===== Resolve repo root from script location =====
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_DIR="${SCRIPT_DIR}/screenshots"
EXP_PORT="${EXP_PORT:-8081}"
EXP_HOST="${EXP_HOST:-localhost}"
EXP_URL="http://${EXP_HOST}:${EXP_PORT}"
EXPO_PID=""
FORWARD_ARGS=()
MODE="both"

usage() {
  cat <<'USAGE' >&2
Usage: ./capture-screenshots.sh [--base URL] [--out DIR] [--viewports apple|android|both] [--help]

  --base URL         Expo web URL to capture (default http://localhost:8081)
  --out DIR          Output directory (default ./screenshots)
  --viewports MODE   Which device classes to capture (default: both)
  --help             Show this help text

Captures the 6 core screens listed in docs/store/screenshots.md as PNGs
named {NN}-{screen}-{WxH}.png. iPhone 1290x2796 + Android 1080x1920 by default.
USAGE
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      EXP_URL="$2"; shift 2 ;;
    --out)
      OUT_DIR="$2"; shift 2 ;;
    --viewports)
      MODE="$2"; shift 2 ;;
    --help|-h)
      usage 0 ;;
    *)
      FORWARD_ARGS+=("$1"); shift ;;
  esac
done

if [[ "$MODE" != "apple" && "$MODE" != "android" && "$MODE" != "both" ]]; then
  echo "error: --viewports must be apple, android, or both (got: $MODE)" >&2
  usage 1
fi

# ===== Sanity checks =====
if ! command -v npx >/dev/null 2>&1; then
  echo "error: npx not found on PATH. Install Node.js ≥ 18." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found on PATH. Install Node.js ≥ 18." >&2
  exit 1
fi

# Check Playwright availability without polluting the repo's package.json.
# We accept a global install or a local node_modules/.bin in the script dir.
if ! node -e "require('playwright')" >/dev/null 2>&1; then
  echo "Playwright not found. Installing globally (this won't touch repo package.json)..."
  if ! npm install -g playwright; then
    echo "error: global playwright install failed. Run: npm install -g playwright && npx playwright install chromium" >&2
    exit 2
  fi
  if ! npx playwright install chromium; then
    echo "error: chromium install failed. Run: npx playwright install chromium" >&2
    exit 2
  fi
fi

mkdir -p "$OUT_DIR"

# ===== Start Expo Web (project dependency) =====
start_expo() {
  echo "Starting Expo Web dev server from ${REPO_ROOT} → ${EXP_URL}"
  # Run Expo from the repo root so it picks up app.json and app/ routes.
  # Use --port and --no-dev to keep CI runners quiet.
  # We pipe stdout/stderr to a log file in case capture hits trouble.
  rm -f "${SCRIPT_DIR}/expo-capture.log"
  ( cd "$REPO_ROOT" && npx expo start --web --port "$EXP_PORT" --no-dev \
      >"${SCRIPT_DIR}/expo-capture.log" 2>&1 & echo $! >"${SCRIPT_DIR}/expo.pid" )
  EXPO_PID="$(cat "${SCRIPT_DIR}/expo.pid" 2>/dev/null || true)"
  echo "Expo PID: ${EXPO_PID}"
}

wait_for_expo() {
  echo "Waiting for dev server..."
  local waited=0
  local max_wait=120
  while [[ $waited -lt $max_wait ]]; do
    if curl -fsS -o /dev/null "${EXP_URL}" 2>/dev/null; then
      echo "Dev server up after ${waited}s"
      return 0
    fi
    if [[ -z "$EXPO_PID" ]] || ! kill -0 "$EXPO_PID" 2>/dev/null; then
      echo "error: Expo died during startup. See expo-capture.log:" >&2
      tail -n 50 "${SCRIPT_DIR}/expo-capture.log" >&2 || true
      exit 3
    fi
    sleep 2
    waited=$((waited + 2))
  done
  echo "error: dev server did not come up after ${max_wait}s. See expo-capture.log:" >&2
  tail -n 50 "${SCRIPT_DIR}/expo-capture.log" >&2 || true
  exit 3
}

stop_expo() {
  if [[ -n "$EXPO_PID" ]] && kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "Stopping Expo (PID ${EXPO_PID})"
    kill "$EXPO_PID" 2>/dev/null || true
    wait "$EXPO_PID" 2>/dev/null || true
  fi
  # Also clean up any expo metro child that survived the kill.
  pkill -f "metro" -P "$EXPO_PID" 2>/dev/null || true
  rm -f "${SCRIPT_DIR}/expo.pid"
}
trap stop_expo EXIT INT TERM

start_expo
wait_for_expo

# ===== Run capture =====
echo "Capturing screenshots → ${OUT_DIR}"
set +e
node "${SCRIPT_DIR}/capture.js" \
  --base "$EXP_URL" \
  --out "$OUT_DIR" \
  --viewports "$MODE" \
  "${FORWARD_ARGS[@]}"
CAPTURE_EXIT=$?
set -e

if [[ $CAPTURE_EXIT -ne 0 ]]; then
  echo "error: capture.js exited ${CAPTURE_EXIT}. See expo-capture.log for server output." >&2
  tail -n 20 "${SCRIPT_DIR}/expo-capture.log" >&2 || true
  exit $CAPTURE_EXIT
fi

echo
echo "Done. Screenshots saved to ${OUT_DIR}/"
ls -lh "${OUT_DIR}/"*.png 2>/dev/null || echo "  (no PNGs produced — check logs)"
