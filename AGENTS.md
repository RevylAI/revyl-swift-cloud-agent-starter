# Agent Instructions

## Revyl Vercel Sandbox Proof

Use the `revyl-vercel-sandbox-proof` skill for any change under `ios/` or when the user asks for Revyl proof, preview, device validation, screenshot, design QA, or PR proof.

The preferred proof path is the sandbox orchestrator, which runs the whole loop inside an ephemeral Vercel Sandbox:

```bash
cd sandbox
npm install
node run-revyl-sandbox-proof.mjs
```

It requires `REVYL_API_KEY` plus Vercel credentials (`VERCEL_OIDC_TOKEN`, or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`). See `sandbox/README.md` for options, including `SANDBOX_GIT_REVISION` for proving a PR branch and `REVYL_BUILD_IMAGE` for pinning the build runner's Xcode.

If you are running the loop manually (locally or already inside a sandbox), the environment may not have the Revyl CLI installed, or may have an older cached CLI without remote builds. Start by checking:

```bash
if ! command -v revyl >/dev/null 2>&1; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
  export PATH="$HOME/.revyl/bin:$PATH"
fi
revyl --version
revyl auth status
revyl config show --json
```

For headless environments, authenticate with `revyl auth login --api-key="$REVYL_API_KEY"`.

Before every device proof, refresh the demo auth launch vars:

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json
```

Primary build path:

```bash
cd ios && revyl build --remote --platform ios --json
```

Start a fresh device session from the returned build version:

```bash
revyl device start --platform ios \
  --build-version-id <build-version-id> \
  --launch-var REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_UID_TOKEN \
  --timeout 900 --open=false --json
```

Validate the app outcome, not just authentication:

```bash
revyl device validation -s 0 "The Revyl Swift Demo shows an authenticated cloud-agent proof screen" --json
```

Always stop the device session once proof is captured (`revyl device stop -s 0`). Do not leave sessions running after the demo completes.

Never paste raw launch-var values into committed files, logs, screenshots, or PR bodies. Proof should list only launch-var key names.
