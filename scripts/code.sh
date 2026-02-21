#!/usr/bin/env bash

set -e

if [[ "$OSTYPE" == "darwin"* ]]; then
	realpath() { [[ $1 = /* ]] && echo "$1" || echo "$PWD/${1#./}"; }
	ROOT=$(dirname "$(dirname "$(realpath "$0")")")
else
	ROOT=$(dirname "$(dirname "$(readlink -f $0)")")
	# If the script is running in Docker using the WSL2 engine, powershell.exe won't exist
	if grep -qi Microsoft /proc/version && type powershell.exe > /dev/null 2>&1; then
		IN_WSL=true
	fi
fi

function ensure_node_version() {
	local required_node_file="$ROOT/.nvmrc"
	if [[ ! -f "$required_node_file" ]]; then
		return 0
	fi

	local required_node
	required_node=$(tr -d '[:space:]' < "$required_node_file")
	if [[ -z "$required_node" ]]; then
		return 0
	fi

	local current_node
	if ! current_node=$(node -p "process.versions.node" 2>/dev/null); then
		echo "Error: Node.js is required but was not found."
		echo "Install and use Node.js v$required_node or later."
		return 1
	fi

	if ! node -e "const [current, required] = process.argv.slice(1).map(v => v.split('.').map(n => Number(n) || 0)); const len = Math.max(current.length, required.length); for (let i = 0; i < len; i++) { const c = current[i] ?? 0; const r = required[i] ?? 0; if (c > r) process.exit(0); if (c < r) process.exit(1); } process.exit(0);" "$current_node" "$required_node"; then
		echo "Error: Node.js v$required_node or later is required. Current version: v$current_node."
		echo "Run:"
		echo "  nvm install $required_node"
		echo "  nvm use $required_node"
		return 1
	fi
}

function code() {
	ensure_node_version
	cd "$ROOT"

	local ENV_FILE="$ROOT/.env.local"
	if [[ -f "$ENV_FILE" ]]; then
		set -a
		# shellcheck source=/dev/null
		source "$ENV_FILE"
		set +a
	fi

	CODE=""
	resolve_code_binary() {
		if [[ "$OSTYPE" == "darwin"* ]]; then
			local NAME EXE_NAME CANDIDATE FALLBACK_APP FALLBACK_BIN
			NAME=`node -p "require('./product.json').nameLong"`
			EXE_NAME=`node -p "require('./product.json').nameShort"`
			CANDIDATE="./.build/electron/$NAME.app/Contents/MacOS/$EXE_NAME"
			if [[ -x "$CANDIDATE" ]]; then
				CODE="$CANDIDATE"
				return 0
			fi
			FALLBACK_APP=$(find "./.build/electron" -maxdepth 1 -type d -name "*.app" | head -n 1)
			if [[ -n "$FALLBACK_APP" ]]; then
				FALLBACK_BIN=$(find "$FALLBACK_APP/Contents/MacOS" -maxdepth 1 -type f | head -n 1)
				if [[ -n "$FALLBACK_BIN" && -x "$FALLBACK_BIN" ]]; then
					CODE="$FALLBACK_BIN"
					return 0
				fi
			fi
			CODE="$CANDIDATE"
			return 0
		fi

		local NAME
		NAME=`node -p "require('./product.json').applicationName"`
		CODE=".build/electron/$NAME"
		return 0
	}

	# Get electron, compile, built-in extensions
	if [[ -z "${VSCODE_SKIP_PRELAUNCH}" ]]; then
		if ! node build/lib/preLaunch.ts; then
			echo
			echo "Prelaunch failed."
			echo "Common fixes:"
			echo "  1) Ensure Node.js matches .nvmrc"
			echo "  2) Run: npm ci"
			echo "  3) Retry: ./scripts/code.sh"
			return 1
		fi
	fi

	resolve_code_binary

	# Manage built-in extensions
	if [[ "$1" == "--builtin" ]]; then
		exec "$CODE" build/builtin
		return
	fi

	# Configuration
	export NODE_ENV=development
	export VSCODE_DEV=1
	export VSCODE_CLI=1
	export ELECTRON_ENABLE_STACK_DUMPING=1
	export ELECTRON_ENABLE_LOGGING=1
	# Prevent inherited shells from forcing Electron to run as plain Node.js.
	unset ELECTRON_RUN_AS_NODE

	DISABLE_TEST_EXTENSION="--disable-extension=vscode.vscode-api-tests"
	if [[ "$@" == *"--extensionTestsPath"* ]]; then
		DISABLE_TEST_EXTENSION=""
	fi

	# Launch Code
	exec "$CODE" . $DISABLE_TEST_EXTENSION "$@"
}

function code-wsl()
{
	HOST_IP=$(echo "" | powershell.exe -noprofile -Command "& {(Get-NetIPAddress | Where-Object {\$_.InterfaceAlias -like '*WSL*' -and \$_.AddressFamily -eq 'IPv4'}).IPAddress | Write-Host -NoNewline}")
	export DISPLAY="$HOST_IP:0"

	# in a wsl shell
	local WIN_EXE_NAME
	WIN_EXE_NAME=`node -p "require('./product.json').nameShort"`
	ELECTRON="$ROOT/.build/electron/$WIN_EXE_NAME.exe"
	if [ -f "$ELECTRON"  ]; then
		local CWD=$(pwd)
		cd $ROOT
		export WSLENV=ELECTRON_RUN_AS_NODE/w:VSCODE_DEV/w:$WSLENV
		local WSL_EXT_ID="ms-vscode-remote.remote-wsl"
		local WSL_EXT_WLOC=$(echo "" | VSCODE_DEV=1 ELECTRON_RUN_AS_NODE=1 "$ELECTRON" "out/cli.js" --locate-extension $WSL_EXT_ID)
		cd $CWD
		if [ -n "$WSL_EXT_WLOC" ]; then
			# replace \r\n with \n in WSL_EXT_WLOC
			local WSL_CODE=$(wslpath -u "${WSL_EXT_WLOC%%[[:cntrl:]]}")/scripts/wslCode-dev.sh
			$WSL_CODE "$ROOT" "$@"
			exit $?
		else
			echo "Remote WSL not installed, trying to run VSCode in WSL."
		fi
	fi
}

if [ "$IN_WSL" == "true" ] && [ -z "$DISPLAY" ]; then
	code-wsl "$@"
elif [ -f /mnt/wslg/versions.txt ]; then
	code --disable-gpu "$@"
elif [ -f /.dockerenv ]; then
	# Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=1263267
	# Chromium does not release shared memory when streaming scripts
	# which might exhaust the available resources in the container environment
	# leading to failed script loading.
	code --disable-dev-shm-usage "$@"
else
	code "$@"
fi

exit $?
