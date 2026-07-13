# Revyl CLI in Vercel Sandboxes

This demo runs the starter's full Revyl proof loop from inside an ephemeral [Vercel Sandbox](https://vercel.com/docs/sandbox): a fresh Linux microVM that starts with nothing, produces the device proof, and is destroyed afterward.

`run-revyl-sandbox-proof.mjs` uses the `@vercel/sandbox` SDK to:

1. Create a fresh Linux microVM and clone this repo into it.
2. Serve a **live status page from inside the microVM** — the script uploads a tiny HTTP server with `sandbox.writeFiles()`, runs it as a `detached` command on an exposed port, and prints the public `sandbox.domain()` URL. Open it in a browser to watch each proof step tick off, follow the link to the live Revyl device, and see the device screenshot appear.
3. Install the `revyl` CLI inside the sandbox and authenticate with `REVYL_API_KEY`.
4. Patch the Revyl org/app ids into `ios/.revyl/config.yaml` through the SDK filesystem API (`readFileToBuffer` + `writeFiles`) — no shelling out, nothing pushed upstream.
5. Refresh the four demo auth launch vars using the existing preflight script.
6. Run `revyl build --remote --platform ios` from the sandbox. The iOS build happens on Revyl's remote macOS runners, so the Linux sandbox never needs Xcode.
7. Start a fresh Revyl iOS simulator with the four launch vars.
8. Run the focused validation, capture the device screenshot inside the VM, and pull it out with `sandbox.downloadFile()` into `sandbox/artifacts/proof-screen.png`.
9. Fetch the device report, write PR proof blocks and a machine-readable summary to `sandbox/artifacts/`, then stop the sandbox — recording the `sandbox.stop()` telemetry (active CPU time, network transfer) in the summary.

The sandbox is created with `persistent: false`, so every proof run starts from a clean machine. That mirrors the point of the original demo: the proof is only convincing when the environment starts with nothing.

## Prerequisites

- Node.js 20+
- A Vercel account with Sandbox access
- A Revyl account with an org and an iOS app slot
- This repo reachable at a git URL the sandbox can clone (it is by default; `ios/.revyl/config.yaml` placeholders are patched in-sandbox via env vars)

## Quickstart from zero

```bash
git clone https://github.com/RevylAI/revyl-swift-cloud-agent-starter.git
cd revyl-swift-cloud-agent-starter/sandbox
npm install

cp .env.example .env.local   # fill it in; see "Finding your ids" below
node run-revyl-sandbox-proof.mjs
```

The orchestrator auto-loads `sandbox/.env.local` (gitignored). It prints a live status page URL served from inside the sandbox — open it to watch the run.

## Finding your ids

**Revyl** (install: `curl -fsSL https://revyl.com/install.sh | sh`):

```bash
revyl auth login                 # browser login; org id is in `revyl auth status`
revyl app list --json            # existing iOS app slots
revyl app create --name "revyl-swift-demo" --platform ios --json   # or create one
```

The API key comes from app.revyl.ai → Settings → API keys (after a browser login it is also in `~/.revyl/credentials.json`).

**Vercel**: create an access token at vercel.com → Account Settings → Tokens, then:

```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/teams
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v9/projects?teamId=$VERCEL_TEAM_ID"
```

Any project id in the team works — it only scopes the sandbox. Alternatively skip the token entirely: `vercel link && vercel env pull` in a linked project yields a `VERCEL_OIDC_TOKEN` (expires after 12 hours).

## Options

| Env var | Default | Purpose |
| --- | --- | --- |
| `SANDBOX_GIT_URL` | local `origin` remote | Repo URL the sandbox clones |
| `SANDBOX_GIT_REVISION` | `main` | Branch, tag, or sha to clone |
| `SANDBOX_GIT_USERNAME` | `x-access-token` | Git username for private repos |
| `SANDBOX_GIT_PASSWORD` | `GITHUB_TOKEN` | Git password/token for private repos |
| `SANDBOX_RUNTIME` | `node22` | Sandbox runtime image |
| `SANDBOX_VCPUS` | `4` | Sandbox vCPUs |
| `SANDBOX_TIMEOUT_MINUTES` | `40` | Sandbox session timeout |
| `REVYL_BUILD_IMAGE` | runner default | Revyl build runner image, e.g. `ios-macos-26-xcode-26.2` to match `.xcode-version` |
| `REVYL_ORG_ID` / `REVYL_APP_ID` | unset | Patch the starter placeholders in `ios/.revyl/config.yaml` inside the sandbox after cloning |
| `KEEP_DEVICE_SESSION` | unset | Set to `1` to leave the Revyl device session running after the proof for manual viewing (reclaimed by its idle timeout) |

## Outputs

- A live status page URL (printed at start) served from inside the sandbox for the duration of the run.
- `sandbox/artifacts/pr-proof-live.md` — post to the PR as soon as the device session starts.
- `sandbox/artifacts/proof-screen.png` — the device screenshot, extracted from the microVM via the SDK.
- `sandbox/artifacts/pr-proof-final.md` — final proof block referencing the screenshot.
- `sandbox/artifacts/proof-summary.json` — sandbox, git, and Revyl session metadata, plus sandbox CPU/network telemetry.

The proof fails, and the script exits non-zero, when the focused validation returns false, the build or session output has no usable ids, or any sandbox command fails.

## Troubleshooting

Failure modes seen in real runs, and what they mean:

- **"Could not get credentials from OIDC context"** — the SDK found no auth. Set `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` (all three; the token alone is not enough), or provide `VERCEL_OIDC_TOKEN`.
- **Remote build fails in `setup-ios-remote.sh` with an Xcode version mismatch** — the default Revyl runner ships a newer Xcode than the repo's `.xcode-version` pin. Set `REVYL_BUILD_IMAGE=ios-macos-26-xcode-26.2` (already in `.env.example`).
- **"Could not find a session id in the revyl device start output"** — Revyl could not provision a device (transient capacity, or another session in your org grabbed the iOS slots). Run proof loops **sequentially per org** — never two device-consuming runs at once — and rerun; the orchestrator already tore the sandbox down.
- **Validation returns false after changing the app's on-screen text** — the validation phrase must match the app *as built from the cloned revision*. If you change `ContentView.swift`, push the branch and set `SANDBOX_GIT_REVISION` to it (and update the phrase in the orchestrator if you changed that sentence).

To prove local app changes without pushing anything: build locally and upload, then start a device against that build.

```bash
cd ios
REVYL_ALLOW_XCODE_VERSION_MISMATCH=1 bash .revyl/setup-ios-remote.sh
REVYL_ALLOW_XCODE_VERSION_MISMATCH=1 bash .revyl/build-ios-remote.sh
revyl build upload --file build/RevylSwiftDemo.app.zip --app "$REVYL_APP_ID" --yes --json
```

## Guardrails

Same as the rest of the starter:

- Launch-var values never appear in output, artifacts, or PR bodies — key names only.
- `REVYL_API_KEY` is passed to sandbox commands via the environment, never interpolated into command strings or logs.
- Every run uses a fresh sandbox and a fresh Revyl device session.
