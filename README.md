# Revyl Swift Sandbox Starter

This repo is a minimal native SwiftUI starter that demonstrates an end-to-end Revyl proof loop driven from an ephemeral [Vercel Sandbox](https://vercel.com/docs/sandbox):

1. An orchestrator creates a fresh Linux microVM and clones this repo into it.
2. The sandbox serves a live status page so you can watch the proof run.
3. Inside the sandbox, the `revyl` CLI is installed from scratch and authenticated headlessly.
4. The sandbox refreshes demo auth launch variables in Revyl.
5. Revyl runs a remote iOS simulator build on its macOS runners (the Linux sandbox never needs Xcode).
6. The sandbox starts a fresh Revyl device with those launch vars.
7. The SwiftUI app unlocks an authenticated proof screen only when all four launch vars are present and valid.
8. The proof screen is validated, the device screenshot is pulled out of the microVM, and the sandbox is destroyed.

The demo intentionally has no backend. `.agents/skills/revyl-vercel-sandbox-proof/scripts/ios-login-tokens.mjs` creates JWT-shaped demo values with `exp` claims so the preflight and app-side expiry checks behave like the real workflow. Replace that file when adopting the pattern for a real app.

## Layout

```text
.
├── AGENTS.md
├── docs/
├── .agents/skills/revyl-vercel-sandbox-proof/
├── .github/workflows/ios-build.yml
├── sandbox/                 # Vercel Sandbox orchestrator
└── ios/
    ├── RevylSwiftDemo/
    └── .revyl/
```

## Docs

- [Setup Guide](docs/SETUP.md) walks through Revyl auth, app/org IDs, local build checks, and launch-var preflight.
- [Vercel Sandbox Proof Loop](docs/VERCEL_SANDBOX_PROOF.md) is the exact workflow for producing proof from a sandbox.
- [Sandbox Orchestrator](sandbox/README.md) documents the one-command demo and its options.
- [PR Proof Templates](.agents/skills/revyl-vercel-sandbox-proof/references/pr-proof.md) contains live and final GitHub PR blocks.

## One-Command Demo

```bash
cd sandbox
npm install

cp .env.example .env.local   # fill in Revyl + Vercel credentials and ids
node run-revyl-sandbox-proof.mjs
```

The script auto-loads `sandbox/.env.local` and prints a live status page URL served from inside the sandbox. See [sandbox/README.md](sandbox/README.md) for how to find each id, all options, and troubleshooting.

## One-Time Setup

Install and authenticate Revyl locally (for manual runs and preflight):

```bash
if ! command -v revyl >/dev/null 2>&1; then
  curl -fsSL https://revyl.com/install.sh | sh
  export PATH="$HOME/.revyl/bin:$PATH"
fi
revyl auth login
revyl auth status
```

Fill in `ios/.revyl/config.yaml` (the orchestrator can also patch these inside the sandbox via `REVYL_ORG_ID` / `REVYL_APP_ID`):

```yaml
project:
  org_id: <your Revyl org id>

build:
  platforms:
    ios:
      app_id: <your Revyl iOS app id>
```

For GitHub Actions fallback upload, set:

- Repository secret `REVYL_API_KEY`
- Repository variable `REVYL_APP_ID`

## Local Build Check

The build scripts use XcodeGen. If `xcodegen` is not installed, they use Mint when available, then Homebrew as a fallback.

```bash
cd ios
bash .revyl/setup-ios-remote.sh
bash .revyl/build-ios-remote.sh
ls build/RevylSwiftDemo.app.zip
```

If your installed Xcode differs from `.xcode-version` during local testing:

```bash
REVYL_ALLOW_XCODE_VERSION_MISMATCH=1 bash .revyl/build-ios-remote.sh
```

## Launch Var Preflight

Read-only check:

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --check --json
```

Create or refresh the four Revyl org launch vars:

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --force --json
```

Launch vars created by the script:

```text
REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN=true
REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN=<demo JWT>
REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN=<demo opaque value>
REVYL_SWIFT_DEMO_TEST_UID_TOKEN=<demo JWT>
```

The preflight output never prints raw values. The standalone mint script does print demo values because it is the mint boundary; do not paste those values into PRs or committed docs.

## Manual Proof Loop

The orchestrator runs these for you inside the sandbox; run them yourself from any machine with the CLI:

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json

cd ios
revyl build --remote --platform ios --json
# add --image ios-macos-26-xcode-26.2 if the default runner Xcode
# does not match .xcode-version
```

Use the returned build version id:

```bash
revyl device start --platform ios \
  --build-version-id <build-version-id> \
  --launch-var REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_UID_TOKEN \
  --timeout 900 --open=false --json
```

Validate the proof screen, fetch the report, and stop the session when done:

```bash
revyl device validation -s 0 "The Revyl Swift Demo shows an authenticated cloud-agent proof screen" --json
revyl device report --session-id <session-id> --json
revyl device stop -s 0
```

The app shows a signed-out screen unless those launch vars are injected. That makes the device proof obvious and hard to fake.

## PR Proof

Use `.agents/skills/revyl-vercel-sandbox-proof/references/pr-proof.md` for the live and final PR blocks. The orchestrator renders both into `sandbox/artifacts/`. The final proof should include:

- Branch and commit
- Revyl app, build version, and session id
- Sandbox name, runtime, and region
- Device model and OS
- Launch-var key names only
- Screenshot or video proof
- One `Open in Revyl` CTA

## Replacing Demo Auth

For a real app, keep the surrounding contract and replace only the demo mint/app auth internals:

- Replace `ios-login-tokens.mjs` with a backend token mint for a safe test account.
- Replace `DemoAuthState` with the app's real session manager.
- Keep the four launch-var names stable or update `AGENTS.md`, the skill, and the Swift app together.
