# Setup Guide

This starter is intentionally small: one SwiftUI app, one Revyl build target, one Vercel Sandbox orchestrator with its proof skill, and one demo auth preflight.

## Prerequisites

- Node.js 20+ for the sandbox orchestrator and preflight scripts
- Revyl CLI authenticated against the org that owns your demo iOS app slot
- Vercel credentials for the sandbox demo (`VERCEL_OIDC_TOKEN`, or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`)
- Optional, for local build validation only: macOS with Xcode, plus `xcodegen`, Mint, or Homebrew. The build scripts try them in that order.

## Configure Revyl IDs

Edit `ios/.revyl/config.yaml`:

```yaml
project:
  org_id: <your Revyl org id>

build:
  platforms:
    ios:
      app_id: <your Revyl iOS app id>
```

Leave `scheme`, `setup`, `command`, and `output` unchanged for the starter.

## Install Or Upgrade Revyl

The proof loop requires `revyl build --remote`. If your local CLI is old, reinstall:

```bash
if ! command -v revyl >/dev/null 2>&1; then
  curl -fsSL https://revyl.com/install.sh | sh
  export PATH="$HOME/.revyl/bin:$PATH"
fi

revyl --version
revyl auth status
```

For headless agents or CI:

```bash
revyl auth login --api-key="$REVYL_API_KEY"
```

## Local Build Smoke

```bash
cd ios
bash .revyl/setup-ios-remote.sh
bash .revyl/build-ios-remote.sh
ls -lh build/RevylSwiftDemo.app.zip
```

The generated Xcode project and build products are ignored:

```text
ios/.revyl/RevylSwiftDemo.xcodeproj/
ios/build/
```

## Launch-Var Preflight

Read-only check:

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --check --json
```

Create or refresh the demo variables:

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --force --json
```

The script creates these Revyl org launch vars:

```text
REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN
REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN
REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN
REVYL_SWIFT_DEMO_TEST_UID_TOKEN
```

Only key names should appear in PR proof. Raw values stay out of docs, logs, screenshots, and PR bodies.

## GitHub Actions Fallback

Set these in the GitHub repo:

- Secret: `REVYL_API_KEY`
- Variable: `REVYL_APP_ID`

The fallback workflow builds `ios/build/RevylSwiftDemo.app.zip` and uploads it to Revyl. Use it only when `revyl build remote` is unavailable or you need a CI-produced comparison build.

