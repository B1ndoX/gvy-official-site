#!/bin/zsh
set -u

PUBLISHER_PROJECT_ROOT=${0:A:h:h:h}
PUBLISHER_URL="http://127.0.0.1:4179/"
PUBLISHER_HEALTH_URL="http://127.0.0.1:4179/api/health"
PUBLISHER_RUNTIME_DIR="$PUBLISHER_PROJECT_ROOT/tools/gallery-publisher/.runtime"
PUBLISHER_LOG="$PUBLISHER_RUNTIME_DIR/launcher.log"
PUBLISHER_RUNNER="$PUBLISHER_PROJECT_ROOT/tools/gallery-publisher/run-server-macos.zsh"
PUBLISHER_PID_FILE="$PUBLISHER_RUNTIME_DIR/publisher.pid"

/bin/mkdir -p "$PUBLISHER_RUNTIME_DIR"

open_publisher_page() {
  if [[ "${GVY_PUBLISHER_NO_OPEN:-0}" == "1" ]]; then
    return 0
  fi
  /usr/bin/open "$PUBLISHER_URL"
  /usr/bin/osascript -e 'display notification "发布器已在运行，浏览器已打开" with title "GVY 相册发布器"' >/dev/null 2>&1 || true
}

if /usr/bin/curl --max-time 1 -fsS "$PUBLISHER_HEALTH_URL" >/dev/null 2>&1; then
  open_publisher_page
  exit 0
fi

print -r -- "[$(/bin/date '+%Y-%m-%d %H:%M:%S')] 启动 GVY 相册发布器" >> "$PUBLISHER_LOG"
/usr/bin/nohup /bin/zsh "$PUBLISHER_RUNNER" </dev/null >/dev/null 2>&1 &
PUBLISHER_PID=$!
print -r -- "$PUBLISHER_PID" > "$PUBLISHER_PID_FILE"
disown "$PUBLISHER_PID" 2>/dev/null || true

for attempt in {1..240}; do
  if /usr/bin/curl --max-time 1 -fsS "$PUBLISHER_HEALTH_URL" >/dev/null 2>&1; then
    open_publisher_page
    exit 0
  fi
  /bin/sleep 0.5
done

/bin/kill "$PUBLISHER_PID" >/dev/null 2>&1 || true
/bin/rm -f "$PUBLISHER_PID_FILE"
print -u2 -r -- "GVY 相册发布器启动失败。日志：$PUBLISHER_LOG"
/usr/bin/tail -n 24 "$PUBLISHER_LOG" >&2
/usr/bin/osascript -e 'display alert "GVY 相册发布器启动失败" message "请把 launcher.log 交给 Codex 检查。" as critical' >/dev/null 2>&1 || true
/usr/bin/open -R "$PUBLISHER_LOG" >/dev/null 2>&1 || true
exit 1
