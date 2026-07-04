#!/bin/sh
set -eu

PACKAGE_NAME="${CHANGE_EVIDENCE_PACKAGE:-change-evidence}"
PACKAGE_VERSION="${CHANGE_EVIDENCE_VERSION:-latest}"
GIT_INSTALL_SPEC="${CHANGE_EVIDENCE_GIT:-git+https://github.com/qcodingdev/change-evidence.git}"
MIN_NODE_MAJOR=20

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'change-evidence installer: %s\n' "$*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

read_tty() {
  prompt="$1"
  default="$2"

  if [ ! -r /dev/tty ] || [ ! -w /dev/tty ]; then
    printf '%s' "$default"
    return
  fi

  printf '%s' "$prompt" > /dev/tty
  IFS= read -r answer < /dev/tty || answer=""
  if [ -z "$answer" ]; then
    printf '%s' "$default"
  else
    printf '%s' "$answer"
  fi
}

need_cmd node
need_cmd npm

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])" 2>/dev/null || printf '0')"
if [ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  fail "Node.js $MIN_NODE_MAJOR+ is required. Current version: $(node -v 2>/dev/null || printf 'unknown')"
fi

INSTALL_SPEC="${PACKAGE_NAME}@${PACKAGE_VERSION}"

say "Installing ${INSTALL_SPEC} globally with npm..."
if ! npm install -g "$INSTALL_SPEC"; then
  say "npm package ${INSTALL_SPEC} is not available yet."
  say "Installing from GitHub instead: ${GIT_INSTALL_SPEC}"
  need_cmd git
  npm install -g "$GIT_INSTALL_SPEC"
fi

if command -v ce >/dev/null 2>&1; then
  CE_BIN="ce"
elif command -v change-evidence >/dev/null 2>&1; then
  CE_BIN="change-evidence"
else
  GLOBAL_BIN="$(npm prefix -g 2>/dev/null)/bin"
  fail "installed, but ce is not on PATH. Add ${GLOBAL_BIN} to PATH and run: ce --help"
fi

say "Installed Change Evidence. Try: $CE_BIN --help"

if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  say "This directory is a git repository."
  say "Starting optional hook setup. You can choose language and decline hook installation in the prompts."
  if [ -r /dev/tty ]; then
    "$CE_BIN" install-hook < /dev/tty
  else
    "$CE_BIN" install-hook
  fi
else
  say "Run 'ce install-hook' inside a git repo to enable the optional pre-commit hook."
fi
