# Cloud Agent Proof Loop

This is the workflow a Cursor Cloud Agent should run for an iOS PR in this starter.

## 1. Check Revyl CLI

```bash
if ! command -v revyl >/dev/null 2>&1 || ! revyl build remote --help >/dev/null 2>&1; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
  export PATH="$HOME/.revyl/bin:$PATH"
fi

revyl --version
revyl auth status
revyl config show --json
```

Run `revyl config show --json` from `ios/`, because the starter's `.revyl/config.yaml` lives there.

## 2. Refresh Demo Launch Vars

```bash
node .agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json
```

The app unlocks the proof screen only when the fresh device session receives all four launch vars.

## 3. Build With Revyl Remote

```bash
cd ios
revyl build remote --platform ios --json
```

Record the build job id, build version id, app id, runner id, and phase timings if present.

## 4. Start Fresh Device Session

```bash
revyl device start --platform ios \
  --build-version-id <build-version-id> \
  --launch-var REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN \
  --launch-var REVYL_SWIFT_DEMO_TEST_UID_TOKEN \
  --timeout 900 --open=false --json
```

Immediately update the PR with the live `Open in Revyl` block from `.agents/skills/ios-revyl-pr-proof/references/pr-proof.md`.

## 5. Validate Outcome

```bash
revyl device validation -s 0 "The Revyl Swift Demo shows an authenticated cloud-agent proof screen" --json
revyl device report --session-id <session-id> --json
```

The proof fails if:

- The report omits any `REVYL_SWIFT_DEMO_TEST_*` launch-var key.
- The app shows signed-out or rejected launch-var state.
- The focused validation returns false.
- No usable viewer URL, report, video, or screenshot exists.

## 6. Post Final PR Proof

Use the final video proof or screenshot proof template. Include:

- Branch and commit
- Revyl build/app/session ids
- Device model and OS
- Launch-var key names only
- Short video or screenshot
- One `Open in Revyl` CTA

In Cursor Cloud Agent, update PRs with `ManagePullRequest`. Do not rely on `gh pr edit` if the agent token is read-only.

