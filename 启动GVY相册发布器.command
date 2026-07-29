#!/bin/zsh
set -u

PUBLISHER_ROOT=${0:A:h}
exec "$PUBLISHER_ROOT/tools/gallery-publisher/launch-macos.zsh"
