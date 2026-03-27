#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PERSONA="admin"
WEB_PORT="8082"
source "$ROOT/ops/scripts/dev-common.sh"
cleanup() {
  log "Shutting down web dev session..."
  cleanup_dev_children
  reset_dev_processes
}
trap cleanup INT TERM

log "Resetting stale web processes..."
reset_dev_processes
start_backend
configure_dev_persona "${1:-$DEFAULT_PERSONA}"
set_env_value EXPO_PUBLIC_API_URL "http://127.0.0.1:$BACKEND_PORT"
start_expo_web

echo ""
log "Web admin/coach session is ready."
echo ""
echo "  App root:        http://localhost:$WEB_PORT"
echo "  Admin shell:     http://localhost:$WEB_PORT/?path=/admin"
echo "  Admin users:     http://localhost:$WEB_PORT/?path=/admin/users"
echo "  Admin kpis:      http://localhost:$WEB_PORT/?path=/admin/kpis"
echo "  Coach portal:    http://localhost:$WEB_PORT/?path=/coach/journeys"
echo "  Coach library:   http://localhost:$WEB_PORT/?path=/coach/library"
echo ""
echo "  Logs:            /tmp/compass-backend.log, /tmp/compass-expo-web.log"
echo ""
open "http://localhost:$WEB_PORT/?path=/admin" >/dev/null 2>&1 || true
tail -f /tmp/compass-expo-web.log
