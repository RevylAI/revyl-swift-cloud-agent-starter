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
