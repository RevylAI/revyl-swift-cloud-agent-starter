# Vercel Sandbox Proof Loop

The proof loop runs the Revyl CLI from inside an ephemeral Vercel Sandbox: a fresh Linux microVM that starts with nothing, produces the device proof, and is destroyed afterward. There are two ways to run it.

## Orchestrated (recommended)

Run the orchestrator from any machine with Vercel and Revyl credentials:

```bash
cd sandbox
npm install

export REVYL_API_KEY=<revyl api key>
# plus VERCEL_OIDC_TOKEN, or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID

node run-revyl-sandbox-proof.mjs
```

The script creates a fresh non-persistent sandbox, clones this repo into it, and drives steps 1–6 below inside the microVM. See [sandbox/README.md](../sandbox/README.md) for options and outputs.

## Manual (already inside a sandbox)

If you are an agent already running inside a Vercel Sandbox with this repo checked out, run the steps directly. The sandbox is Linux; that is fine because `revyl build --remote` builds on Revyl's macOS runners.

### 1. Install and authenticate the Revyl CLI

```bash
if ! command -v revyl >/dev/null 2>&1 || ! revyl build --help 2>/dev/null | grep -q -- --remote; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
  export PATH="$HOME/.revyl/bin:$PATH"
fi

revyl --version
revyl auth login --api-key="$REVYL_API_KEY"
revyl auth status
```

Run `revyl config show --json` from `ios/`, because the starter's `.revyl/config.yaml` lives there.

### 2. Refresh demo launch vars

```bash
node .agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json
```

### 3. Build with Revyl remote

```bash
cd ios
revyl build --remote --platform ios --json
# add --image ios-macos-26-xcode-26.2 if the default runner Xcode
# does not match .xcode-version

```

Record the build version id.

### 4. Start a fresh device session

```bash
revyl device start --platform ios \
  --build-version-id <build-version-id> \
  --launch-var REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_UID_TOKEN \
  --timeout 900 --open=false --json
```

Immediately update the PR with the live block from `.agents/skills/revyl-vercel-sandbox-proof/references/pr-proof.md`.

### 5. Validate outcome and clean up

```bash
revyl device validation -s 0 "The Revyl Swift Demo shows an authenticated cloud-agent proof screen" --json
revyl device report --session-id <session-id> --json
revyl device stop -s 0
```

Always stop the device session once proof is captured; never leave sessions running after the demo completes.

### 6. Post final PR proof

Use the final proof template. Include the sandbox name, runtime, and region alongside the usual Revyl build/session ids so the PR shows the proof came from a disposable Vercel Sandbox.

## Failure gates

- The report omits any `REVYL_SWIFT_DEMO_TEST_*` launch-var key.
- The app shows signed-out or rejected launch-var state.
- The focused validation returns false.
- No usable viewer URL, report, video, or screenshot exists.

Plus one sandbox-specific gate: if the sandbox session times out mid-loop, do not resume it — start a fresh sandbox so the proof still begins from a clean machine.
