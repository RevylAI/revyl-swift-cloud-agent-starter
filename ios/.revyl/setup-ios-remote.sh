#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

log() {
  printf '[revyl-setup] %s\n' "$*"
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
run_xcodegen --version >/dev/null
log "Setup complete."

