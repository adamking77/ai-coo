#!/usr/bin/env bash

set -euo pipefail

if [[ "$OSTYPE" != "darwin"* ]]; then
	echo "Error: this installer is for macOS only."
	exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="Sogo.app"
SRC_APP="$ROOT/.build/electron/$APP_NAME"
DEST_APP="/Applications/$APP_NAME"
DEST_RESOURCES="$DEST_APP/Contents/Resources"
DEST_APP_ENTRY="$DEST_RESOURCES/app"
DEST_MACOS="$DEST_APP/Contents/MacOS"
DEST_EXEC="$DEST_MACOS/Sogo"
DEST_EXEC_BIN="$DEST_MACOS/Sogo-bin"

if [[ ! -d "$SRC_APP" ]]; then
	echo "Error: built app shell not found:"
	echo "  $SRC_APP"
	echo
	echo "Build and launch once first:"
	echo "  cd \"$ROOT\""
	echo "  ./scripts/code.sh"
	exit 1
fi

echo "Installing $APP_NAME to /Applications..."
rm -rf "$DEST_APP"
ditto "$SRC_APP" "$DEST_APP"

echo "Linking app source so Finder launch opens Sogo (not Electron demo)..."
rm -rf "$DEST_APP_ENTRY"
ln -s "$ROOT" "$DEST_APP_ENTRY"

echo "Creating Finder-safe launcher wrapper..."
if [[ ! -x "$DEST_EXEC" ]]; then
	echo "Error: expected executable missing at:"
	echo "  $DEST_EXEC"
	exit 1
fi

mv "$DEST_EXEC" "$DEST_EXEC_BIN"
cat > "$DEST_EXEC" <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

APP_CONTENTS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ENTRY="$APP_CONTENTS/Resources/app"
APP_BIN="$APP_CONTENTS/MacOS/Sogo-bin"
USER_DATA_DIR="${SOGO_USER_DATA_DIR:-$HOME/.sogo-data}"
EXTENSIONS_DIR="${SOGO_EXTENSIONS_DIR:-$HOME/.sogo-extensions}"
DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"

# Prevent inherited shells from forcing Electron to run as plain Node.js.
unset ELECTRON_RUN_AS_NODE
export NODE_ENV=development
export VSCODE_DEV=1
export VSCODE_CLI=1
export ELECTRON_ENABLE_STACK_DUMPING=1
export ELECTRON_ENABLE_LOGGING=1

if [[ -f "$APP_ENTRY/.env.local" ]]; then
	set -a
	# shellcheck source=/dev/null
	source "$APP_ENTRY/.env.local"
	set +a
fi

exec "$APP_BIN" "$APP_ENTRY" \
	"$DISABLE_TEST_EXTENSION" \
	--user-data-dir "$USER_DATA_DIR" \
	--extensions-dir "$EXTENSIONS_DIR" \
	"$@"
EOF
chmod +x "$DEST_EXEC"

echo "Install complete."
echo
echo "Launch with:"
echo "  open -a Sogo"
echo
echo "Tip: Pin it in Dock (right-click icon -> Options -> Keep in Dock)."
