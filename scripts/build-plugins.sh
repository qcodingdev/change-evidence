#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
VSCODE_DIR="$REPO_ROOT/plugins/vscode"
INTELLIJ_DIR="$REPO_ROOT/plugins/intellij"
ARTIFACT_DIR="$REPO_ROOT/release-artifacts"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/change-evidence-plugins.XXXXXX")

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT HUP INT TERM

if ! command -v npm >/dev/null 2>&1; then
  echo "error: npm is required to build the VS Code plugin" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js 20 or newer is required" >&2
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "error: Node.js 20 or newer is required; active major version is $NODE_MAJOR" >&2
  exit 1
fi

JAVA_MAJOR=""
if command -v java >/dev/null 2>&1; then
  JAVA_MAJOR=$(
    java -XshowSettings:properties -version 2>&1 |
      awk -F'= ' '/java.specification.version/ { print $2; exit }'
  )
fi

# macOS often has several JDKs installed while `java` points at an older one.
# Select JDK 21 automatically when the standard launcher can locate it.
if [ "$JAVA_MAJOR" != "21" ] && [ -x /usr/libexec/java_home ]; then
  JAVA_21_HOME=$(/usr/libexec/java_home -v 21 2>/dev/null || true)
  if [ -n "$JAVA_21_HOME" ]; then
    JAVA_HOME=$JAVA_21_HOME
    PATH="$JAVA_HOME/bin:$PATH"
    export JAVA_HOME PATH
    JAVA_MAJOR=$(
      java -XshowSettings:properties -version 2>&1 |
        awk -F'= ' '/java.specification.version/ { print $2; exit }'
    )
  fi
fi

if [ "$JAVA_MAJOR" != "21" ]; then
  echo "error: JDK 21 is required; active Java specification version is ${JAVA_MAJOR:-unknown}" >&2
  exit 1
fi

if [ ! -f "$REPO_ROOT/package-lock.json" ]; then
  echo "error: missing root package-lock.json" >&2
  exit 1
fi

if [ ! -f "$INTELLIJ_DIR/gradlew" ]; then
  echo "error: missing plugins/intellij/gradlew" >&2
  exit 1
fi

VS_VERSION=$(node -p "require(process.argv[1]).version" "$VSCODE_DIR/package.json")
IDEA_VERSION=$(
  sed -n 's/^pluginVersion=//p' "$INTELLIJ_DIR/gradle.properties" |
    sed -n '1p'
)

if [ -z "$VS_VERSION" ] || [ -z "$IDEA_VERSION" ]; then
  echo "error: unable to resolve plugin versions" >&2
  exit 1
fi

VSIX_NAME="ai-change-radar-$VS_VERSION.vsix"
IDEA_ZIP_NAME="ai-change-radar-intellij-$IDEA_VERSION.zip"
VSIX_BUILD="$TEMP_DIR/$VSIX_NAME"
IDEA_ZIP_BUILD="$INTELLIJ_DIR/build/distributions/$IDEA_ZIP_NAME"

echo "Verifying shared core..."
npm --prefix "$REPO_ROOT" ci
npm --prefix "$REPO_ROOT" run typecheck
npm --prefix "$REPO_ROOT" test

echo "Building VS Code plugin..."
npm --prefix "$VSCODE_DIR" ci
npm --prefix "$VSCODE_DIR" run check
npm --prefix "$VSCODE_DIR" run package -- --out "$VSIX_BUILD"

if [ ! -s "$VSIX_BUILD" ]; then
  echo "error: VS Code package was not created at $VSIX_BUILD" >&2
  exit 1
fi

echo "Building IntelliJ IDEA plugin..."
(
  cd "$INTELLIJ_DIR"
  if [ -d "/Applications/IntelliJ IDEA.app" ]; then
    sh ./gradlew --no-daemon clean test buildPlugin verifyPluginProjectConfiguration verifyPluginStructure verifyPlugin \
      "-PlocalIdeaPath=/Applications/IntelliJ IDEA.app"
  else
    sh ./gradlew --no-daemon clean test buildPlugin verifyPluginProjectConfiguration verifyPluginStructure verifyPlugin
  fi
)

if [ ! -s "$IDEA_ZIP_BUILD" ]; then
  echo "error: IntelliJ package was not created at $IDEA_ZIP_BUILD" >&2
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"
cp "$VSIX_BUILD" "$ARTIFACT_DIR/$VSIX_NAME"
cp "$IDEA_ZIP_BUILD" "$ARTIFACT_DIR/$IDEA_ZIP_NAME"

echo "Plugin artifacts:"
echo "  $ARTIFACT_DIR/$VSIX_NAME"
echo "  $ARTIFACT_DIR/$IDEA_ZIP_NAME"
