# Agent Instructions

## iOS Revyl Proof

Use the `ios-revyl-pr-proof` skill for any change under `ios/` or when the user asks for Revyl proof, preview, device validation, screenshot, design QA, or PR proof.

Cursor Cloud Agent VMs are ephemeral and may not have the Revyl CLI installed, or may have an older cached CLI without `revyl build remote`. Start by checking:

```bash
if ! command -v revyl >/dev/null 2>&1 || ! revyl build remote --help >/dev/null 2>&1; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
  export PATH="$HOME/.revyl/bin:$PATH"
fi
revyl --version
revyl build remote --help >/dev/null
revyl auth status
revyl config show --json
```

Before every device proof, refresh the demo auth launch vars:

```bash
node .agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json
```

The script shells out to `revyl`; if you are testing a locally built CLI,
point it there with `REVYL_BIN=/path/to/revyl` so the vars land in the same
org/context the dev loop uses.

Primary build path:

```bash
cd ios && revyl build remote --platform ios --json
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

For PR updates in Cursor Cloud Agent, use Cursor's `ManagePullRequest` tool. Do not use `gh pr create` or `gh pr edit` when the Cloud Agent token is read-only.

Never paste raw launch-var values into committed files, logs, screenshots, or PR bodies. Proof should list only launch-var key names.

<!-- revyl:agents:start -->
## Revyl — run this app on a cloud device

Use the Revyl CLI to build, run, and verify app changes on a cloud device.
Revyl viewer URLs are live device streams — share them with the user as soon
as you have one.

The Revyl project lives in `ios/` — run all revyl commands from that directory (`cd ios`), or pass `-C ios`.

On a local machine the CLI opens the live viewer in the user's browser
automatically when the session is ready (check "opened_browser" in the
handshake; --no-open disables it). ALWAYS also post viewer_url as a clickable
markdown link — that is the fallback on cloud VMs — and never try to open a
browser yourself.

One-time setup (ephemeral shells may lack the CLI):

```bash
if ! command -v revyl >/dev/null 2>&1; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
  export PATH="$HOME/.revyl/bin:$PATH"
fi
revyl auth status || revyl auth login --token "$REVYL_API_KEY"
```

Dev loop (run from the app directory containing .revyl/config.yaml):

```bash
# Start in the background. Returns JSON as soon as the simulator is watchable;
# the build keeps running behind it. Share viewer_url with the user right away.
revyl dev --remote --detach --json

# Watch the build until the app is installed and launched.
revyl dev status            # state: building -> idle; last_rebuild.status: running -> success
revyl dev logs --build --follow

# After each code change:
revyl dev rebuild --wait --json
```

Verify like a user (separate short-lived commands; never in the loop terminal):

```bash
revyl device screenshot --out screen.png
revyl device validation -s 0 "<expected user-visible outcome>" --json
revyl device report --session-id <session-id> --json
```

Auth: when .revyl/config.yaml has an auth_bypass section, sessions launch
authenticated automatically (launch vars + deep link are applied for you). If
the app ever shows a logged-out state mid-session (expired token), re-mint the
launch vars with this repo's own mint script (if it has one), then re-fire the
auth deep link:

```bash
revyl dev auth refresh
```

Stop with `revyl dev stop` when done. Never paste launch-var values or
tokens into code, logs, screenshots, or PRs — reference key names only.
<!-- revyl:agents:end -->
