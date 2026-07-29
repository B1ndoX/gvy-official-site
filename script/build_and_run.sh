#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="GVY相册发布器"
APP_BUNDLE="$ROOT_DIR/$APP_NAME.app"
APP_SOURCE="$ROOT_DIR/tools/gallery-publisher/macos-launcher.applescript"
RUNTIME_DIR="$ROOT_DIR/tools/gallery-publisher/.runtime"
PID_FILE="$RUNTIME_DIR/publisher.pid"
HEALTH_URL="http://127.0.0.1:4179/api/health"

stop_existing() {
  local app_pid
  while IFS= read -r app_pid; do
    [[ -n "$app_pid" ]] && kill -TERM "$app_pid" >/dev/null 2>&1 || true
  done < <(/bin/ps ax -o pid=,command= | /usr/bin/awk -v app="$APP_BUNDLE/Contents/MacOS/applet" '$0 ~ app {print $1}')

  if [[ -f "$PID_FILE" ]]; then
    local publisher_pid publisher_pgid publisher_group
    publisher_pid="$(/bin/cat "$PID_FILE" 2>/dev/null || true)"
    if [[ "$publisher_pid" =~ ^[0-9]+$ ]]; then
      publisher_pgid="$(/bin/ps -p "$publisher_pid" -o pgid= 2>/dev/null | /usr/bin/tr -d ' ' || true)"
      if [[ "$publisher_pgid" =~ ^[0-9]+$ ]]; then
        publisher_group="$(/bin/ps ax -o pgid=,command= | /usr/bin/awk -v pgid="$publisher_pgid" '$1 == pgid {print}')"
        if [[ "$publisher_group" == *"gallery-publisher"* ]]; then
          kill -TERM -- "-$publisher_pgid" >/dev/null 2>&1 || true
        fi
      fi
    fi
  fi

  for _ in {1..50}; do
    if ! /usr/sbin/lsof -tiTCP:4179 -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    /bin/sleep 0.2
  done
}

set_plist_value() {
  local plist="$1" key="$2" type="$3" value="$4"
  /usr/libexec/PlistBuddy -c "Add :$key $type $value" "$plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Set :$key $value" "$plist"
}

build_app() {
  local build_dir compiled_app previous_app info_plist
  build_dir="$(/usr/bin/mktemp -d '/tmp/gvy-publisher-build.XXXXXX')"
  compiled_app="$build_dir/$APP_NAME.app"
  previous_app="$build_dir/previous.app"
  info_plist="$compiled_app/Contents/Info.plist"

  /usr/bin/osacompile -o "$compiled_app" "$APP_SOURCE"
  set_plist_value "$info_plist" CFBundleDisplayName string 'GVY 相册发布器'
  set_plist_value "$info_plist" CFBundleName string 'GVY 相册发布器'
  set_plist_value "$info_plist" CFBundleIdentifier string 'vip.gvyvoyagers.gallery-publisher'
  set_plist_value "$info_plist" CFBundleShortVersionString string '1.0'
  set_plist_value "$info_plist" CFBundleVersion string '4'
  set_plist_value "$info_plist" LSUIElement bool 'true'
  set_plist_value "$info_plist" LSMinimumSystemVersion string '12.0'
  /usr/bin/codesign --force --deep --sign - "$compiled_app"

  if [[ -e "$APP_BUNDLE" ]]; then
    /bin/mv "$APP_BUNDLE" "$previous_app"
  fi
  /bin/mv "$compiled_app" "$APP_BUNDLE"
  /usr/bin/codesign --verify --deep --strict "$APP_BUNDLE"
  /bin/rm -rf "$build_dir"
}

launch_app() {
  /usr/bin/open "$APP_BUNDLE"
}

verify_launch() {
  for _ in {1..60}; do
    if /usr/bin/curl --max-time 1 -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      printf 'GVY 相册发布器启动验证通过：%s\n' "$HEALTH_URL"
      return 0
    fi
    /bin/sleep 0.5
  done
  printf 'GVY 相册发布器启动验证失败。\n' >&2
  return 1
}

stop_existing
build_app

case "$MODE" in
  run)
    launch_app
    ;;
  --debug|debug)
    /usr/bin/lldb -- "$APP_BUNDLE/Contents/MacOS/applet"
    ;;
  --logs|logs)
    launch_app
    verify_launch
    /usr/bin/tail -f "$RUNTIME_DIR/launcher.log"
    ;;
  --telemetry|telemetry)
    launch_app
    /usr/bin/log stream --info --style compact --predicate 'process == "applet" OR eventMessage CONTAINS[c] "vip.gvyvoyagers.gallery-publisher"'
    ;;
  --verify|verify)
    launch_app
    verify_launch
    ;;
  *)
    printf 'usage: %s [run|--debug|--logs|--telemetry|--verify]\n' "$0" >&2
    exit 2
    ;;
esac
