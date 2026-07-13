---
name: revyl-vercel-sandbox-proof
description: Use for any iOS change in this starter and when the user asks for Revyl proof, preview, device validation, screenshot, design QA, PR proof, Vercel Sandbox, @vercel/sandbox, or sandbox proof.
---

# Revyl Vercel Sandbox Proof

Use this skill to prove changes to the Swift demo on a real Revyl cloud iOS simulator, with the Revyl CLI driven from inside an ephemeral Vercel Sandbox.

## Workflow

1. Check credentials are available (env vars, or `sandbox/.env.local` copied from `sandbox/.env.example` — the orchestrator auto-loads it):
   - `REVYL_API_KEY`
   - `VERCEL_OIDC_TOKEN`, or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`
2. Confirm the revision under proof is pushed to a git URL the sandbox can clone. The sandbox clones the repo; local uncommitted changes will not be in the proof.
3. Run the orchestrator:

   ```bash
   cd sandbox
   npm install
   node run-revyl-sandbox-proof.mjs
   ```

   Set `SANDBOX_GIT_REVISION` to the PR branch and, for private repos, `SANDBOX_GIT_PASSWORD` (or `GITHUB_TOKEN`).

4. As soon as `sandbox/artifacts/pr-proof-live.md` is written, post its contents to the PR.
5. When the script exits 0, replace the live block with `sandbox/artifacts/pr-proof-final.md`; it references the extracted screenshot at `sandbox/artifacts/proof-screen.png`.
6. Attach or reference `sandbox/artifacts/proof-summary.json` metadata: sandbox name, runtime, region, build version id, session id.

If you are already running inside a Vercel Sandbox with this repo checked out, skip the orchestrator and follow the manual steps in `docs/VERCEL_SANDBOX_PROOF.md` — they are the same commands the orchestrator runs.

## Failure Gates

Fail the proof, fix the issue, and rerun a fresh sandbox + fresh device session when:

- The orchestrator exits non-zero for any step.
- `launch_env_var_keys` is missing any of the four `REVYL_SWIFT_DEMO_TEST_*` keys.
- The app shows "Signed out demo state" or "Launch vars rejected".
- The focused validation returns false.
- No usable session id, viewer URL, report, screenshot, or video is available.
- The sandbox session timed out mid-loop. Never resume a stopped sandbox to finish a proof; the proof must come from one clean run.

## Guardrails

- Never paste raw launch-var values in docs, PR bodies, logs, or screenshots. Key names only.
- Never interpolate `REVYL_API_KEY` or Vercel tokens into command strings, logs, or artifacts; pass them through the environment.
- Create sandboxes with `persistent: false` for proof runs. A restored snapshot defeats the clean-machine claim.
- Do not use `revyl device extract` for normal proof. Use one focused validation and screenshots/report evidence.
- Close every session when the demo completes: the orchestrator stops the Revyl device session and the sandbox itself. If `KEEP_DEVICE_SESSION=1` was used for manual viewing, stop the device session afterward (`revyl device stop -s 0`) instead of leaving it to idle out.
- Run proof loops sequentially per Revyl org. Two device-consuming runs at once contend for iOS device slots and one will fail to provision.
- State in the PR that the proof ran from a Vercel Sandbox, and include the sandbox name and region from `proof-summary.json`.
