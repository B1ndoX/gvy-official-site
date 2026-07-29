#!/bin/zsh
set -u

PUBLISHER_PROJECT_ROOT=${0:A:h:h:h}
PUBLISHER_RUNTIME_DIR="$PUBLISHER_PROJECT_ROOT/tools/gallery-publisher/.runtime"
PUBLISHER_LOG="$PUBLISHER_RUNTIME_DIR/launcher.log"

/bin/mkdir -p "$PUBLISHER_RUNTIME_DIR"
export GVY_PUBLISHER_PROJECT_ROOT="$PUBLISHER_PROJECT_ROOT"

exec /bin/zsh -lic '
  cd "$GVY_PUBLISHER_PROJECT_ROOT" || exit 1
  if [[ ! -x node_modules/.bin/vite ]]; then
    npm install --no-audit --no-fund || exit 1
  fi
  GVY_PUBLISHER_NO_OPEN=1 npm run gallery:publisher
' >> "$PUBLISHER_LOG" 2>&1
