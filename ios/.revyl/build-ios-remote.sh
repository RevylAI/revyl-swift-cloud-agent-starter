#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="RevylSwiftDemo"
PROJECT_DIR=".revyl"
PROJECT_PATH="${PROJECT_DIR}/${APP_NAME}.xcodeproj"
SCHEME="RevylSwiftDemo"
BUILD_DIR="${PWD}/build"
DERIVED_DATA_DIR="${REVYL_DERIVED_DATA_DIR:-${BUILD_DIR}/DerivedData}"
RESULT_BUNDLE="${BUILD_DIR}/${APP_NAME}.xcresult"
ZIP_PATH="${BUILD_DIR}/${APP_NAME}.app.zip"

log() {
  printf '[revyl-build] %s\n' "$*"
}

repo_xcode_version() {
  if [[ -f .xcode-version ]]; then
    tr -d '[:space:]' < .xcode-version
  elif [[ -f ../.xcode-version ]]; then
    tr -d '[:space:]' < ../.xcode-version
  else
    printf ''
  fi
}

select_repo_xcode() {
  local expected
  expected="$(repo_xcode_version)"
  if [[ -z "$expected" ]]; then
    log "No .xcode-version found; using the active Xcode."
    return 0
  fi

  local active
  active="$(xcodebuild -version | awk '/Xcode/{print $2}')"
  if [[ "$active" == "$expected" ]]; then
    log "Active Xcode matches .xcode-version ($expected)."
    return 0
  fi

  local candidate
  for candidate in /Applications/Xcode*.app; do
    [[ -d "$candidate" ]] || continue
    local version
    version="$(DEVELOPER_DIR="$candidate/Contents/Developer" xcodebuild -version 2>/dev/null | awk '/Xcode/{print $2}' || true)"
    if [[ "$version" == "$expected" ]]; then
      export DEVELOPER_DIR="$candidate/Contents/Developer"
      log "Selected Xcode $expected at $candidate."
      return 0
    fi
  done

  if [[ "${REVYL_ALLOW_XCODE_VERSION_MISMATCH:-}" == "1" ]]; then
    log "Expected Xcode $expected but active Xcode is $active; continuing because REVYL_ALLOW_XCODE_VERSION_MISMATCH=1."
    return 0
  fi

  printf 'Expected Xcode %s but active Xcode is %s. Set REVYL_ALLOW_XCODE_VERSION_MISMATCH=1 to continue for a one-off debug run.\n' "$expected" "$active" >&2
  return 1
}

run_xcodegen() {
  if command -v xcodegen >/dev/null 2>&1; then
    xcodegen "$@"
    return
  fi

  if command -v mint >/dev/null 2>&1; then
    mint run yonaskolb/XcodeGen@2.43.0 xcodegen "$@"
    return
  fi

  if command -v brew >/dev/null 2>&1; then
    log "Installing XcodeGen with Homebrew."
    brew install xcodegen
    xcodegen "$@"
    return
  fi

  printf 'XcodeGen is required. Install it with `brew install xcodegen` or install Mint.\n' >&2
  return 1
}

select_repo_xcode
mkdir -p "$BUILD_DIR"

log "Generating ${PROJECT_PATH}."
run_xcodegen generate --spec .revyl/project-revyl.yml --project "$PROJECT_DIR"

if [[ ! -f "${PROJECT_PATH}/project.pbxproj" ]]; then
  printf 'XcodeGen did not create %s.\n' "$PROJECT_PATH" >&2
  exit 1
fi

rm -rf "$RESULT_BUNDLE"
log "Building simulator app."
xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$DERIVED_DATA_DIR" \
  -resultBundlePath "$RESULT_BUNDLE" \
  -resultBundleVersion 3 \
  -quiet \
  build \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=- \
  CODE_SIGN_STYLE=Manual \
  COMPILER_INDEX_STORE_ENABLE=NO \
  ENABLE_DEBUG_DYLIB=NO

APP_PATH="$(find "${DERIVED_DATA_DIR}/Build/Products/Debug-iphonesimulator" -maxdepth 1 -type d -name "${APP_NAME}.app" | head -n 1)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  printf 'Could not find %s.app under DerivedData products.\n' "$APP_NAME" >&2
  exit 1
fi

rm -f "$ZIP_PATH"
log "Zipping ${APP_PATH} to ${ZIP_PATH}."
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

if [[ ! -f "$ZIP_PATH" ]]; then
  printf 'Expected output missing: %s\n' "$ZIP_PATH" >&2
  exit 1
fi

log "Built ${ZIP_PATH}."

