# Revyl Swift Cloud Agent Starter

This repo is a minimal native SwiftUI starter that demonstrates an end-to-end Cursor Cloud Agent proof loop with Revyl:

1. A cloud agent installs and authenticates the `revyl` CLI.
2. The agent refreshes demo auth launch variables in Revyl.
3. Revyl runs a remote iOS simulator build.
4. The agent starts a fresh Revyl device with those launch vars.
5. The SwiftUI app unlocks an authenticated proof screen only when all four launch vars are present and valid.
6. The agent posts an `Open in Revyl` CTA and final PR proof.

The demo intentionally has no backend. `.agents/skills/ios-revyl-pr-proof/scripts/ios-login-tokens.mjs` creates JWT-shaped demo values with `exp` claims so the preflight and app-side expiry checks behave like the real workflow. Replace that file when adopting the pattern for a real app.

## Layout

```text
.
├── AGENTS.md
├── docs/
├── .agents/skills/ios-revyl-pr-proof/
├── .github/workflows/ios-build.yml
└── ios/
    ├── RevylSwiftDemo/
    └── .revyl/
```

## Docs

- [Setup Guide](docs/SETUP.md) walks through Revyl auth, app/org IDs, local build checks, and launch-var preflight.
- [Cloud Agent Proof Loop](docs/CLOUD_AGENT_PROOF.md) is the exact workflow a Cursor Cloud Agent should follow to produce PR proof.
- [PR Proof Templates](.agents/skills/ios-revyl-pr-proof/references/pr-proof.md) contains live and final GitHub PR blocks.

## One-Time Setup

Install and authenticate Revyl:

```bash
if ! command -v revyl >/dev/null 2>&1 || ! revyl build remote --help >/dev/null 2>&1; then
  curl -fsSL https://revyl.com/install.sh | sh
  export PATH="$HOME/.revyl/bin:$PATH"
fi
revyl build remote --help >/dev/null
revyl auth login
revyl auth status
revyl config show --json
```

Fill in `ios/.revyl/config.yaml`:

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

For headless Cloud Agent startup, use:

```bash
if ! command -v revyl >/dev/null 2>&1 || ! revyl build remote --help >/dev/null 2>&1; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
  export PATH="$HOME/.revyl/bin:$PATH"
fi
revyl auth login --token "$REVYL_API_KEY"
```

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
node .agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --check --json
```

Create or refresh the four Revyl org launch vars:

```bash
node .agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --force --json
```

Launch vars created by the script:

```text
REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN=true
REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN=<demo JWT>
REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN=<demo opaque value>
REVYL_SWIFT_DEMO_TEST_UID_TOKEN=<demo JWT>
```

The preflight output never prints raw values. The standalone mint script does print demo values because it is the mint boundary; do not paste those values into PRs or committed docs.

## Primary Revyl Proof Loop

```bash
node .agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json

cd ios
revyl build remote --platform ios --json
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

Validate the proof screen:

```bash
revyl device validation -s 0 "The Revyl Swift Demo shows an authenticated cloud-agent proof screen" --json
revyl device report --session-id <session-id> --json
```

The app shows a signed-out screen unless those launch vars are injected. That makes the device proof obvious and hard to fake.

## PR Proof

Use `.agents/skills/ios-revyl-pr-proof/references/pr-proof.md` for the live and final PR blocks. The final proof should include:

- Branch and commit
- Revyl app, build version, and session id
- Device model and OS
- Launch-var key names only
- Short video or screenshot proof
- One `Open in Revyl` CTA

## Replacing Demo Auth

For a real app, keep the surrounding contract and replace only the demo mint/app auth internals:

- Replace `ios-login-tokens.mjs` with a backend token mint for a safe test account.
- Replace `DemoAuthState` with the app's real session manager.
- Keep the four launch-var names stable or update `AGENTS.md`, the skill, and the Swift app together.
