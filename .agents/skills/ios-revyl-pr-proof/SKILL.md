---
name: ios-revyl-pr-proof
description: Use for any iOS change in this starter. Trigger for files under ios/ and when the user says revyl, preview, device, verify, screenshot, design QA, proof, PR proof, or asks to validate the Swift demo on a Revyl device.
---

# iOS Revyl PR Proof

Use this skill to prove changes to the Swift demo on a real Revyl cloud iOS simulator.

## Workflow

1. Inspect the Swift change and run local checks when useful.
2. Ensure `revyl` is installed, current enough for `build remote`, and authenticated:

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

3. Refresh the demo launch vars:

   ```bash
   node .agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs --json
   ```

4. Build with Revyl remote build:

   ```bash
   cd ios && revyl build remote --platform ios --json
   ```

5. Start a fresh device from the returned build version:

   ```bash
   revyl device start --platform ios \
     --build-version-id <build-version-id> \
     --launch-var REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN \
     --launch-var REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN \
     --launch-var REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN \
     --launch-var REVYL_SWIFT_DEMO_TEST_UID_TOKEN \
     --timeout 900 --open=false --json
   ```

6. As soon as the device returns a viewer URL, update the PR with the live proof block from `references/pr-proof.md`. In Cursor Cloud Agent, use `ManagePullRequest`, not `gh pr edit`.
7. Validate the exact starter outcome:

   ```bash
   revyl device validation -s 0 "The Revyl Swift Demo shows an authenticated cloud-agent proof screen" --json
   ```

8. Fetch the report:

   ```bash
   revyl device report --session-id <session-id> --json
   ```

9. Replace the live PR block with final video or screenshot proof.

## Failure Gates

Fail the proof, fix the issue, and rerun a fresh session when:

- `launch_env_var_keys` is missing any of the four `REVYL_SWIFT_DEMO_TEST_*` keys.
- The app shows "Signed out demo state" or "Launch vars rejected".
- The focused validation returns false.
- No usable session id, viewer URL, report, screenshot, or video is available.

## Backup Build

Use the GitHub Actions upload only when Revyl remote build capacity is unavailable:

```bash
revyl build list --app <REVYL_APP_ID> --json
```

Pick the newest build for the PR or commit, then start the device with the same four launch vars. Always state when proof used the backup CI build rather than `revyl build remote`.

## Guardrails

- Never paste raw launch-var values in docs, PR bodies, logs, or screenshots.
- Mention only launch-var key names in PR proof.
- Do not use `revyl device extract` for normal proof. Use one focused validation and screenshots/report evidence.
- The demo JWTs are not real auth. They exist only to make expiry and refresh behavior easy to see in the starter.
