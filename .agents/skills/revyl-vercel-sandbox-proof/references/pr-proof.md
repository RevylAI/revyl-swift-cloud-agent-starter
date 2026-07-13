# Revyl Vercel Sandbox PR Proof Templates

PR proof templates with a `Sandbox` metadata line so the PR shows the proof came from ephemeral Vercel Sandbox compute. The orchestrator renders these automatically into `sandbox/artifacts/`.

## Live Session

```markdown
### iOS Preview

<a href="<revyl-session-url>">
  <img alt="Open in Revyl" src="https://img.shields.io/badge/Open%20in-Revyl-7C3AED?style=for-the-badge&labelColor=111827" />
</a>

Live Revyl session started from a Vercel Sandbox; final proof pending.

Metadata:
- Branch: `<branch>`
- Commit: `<commit sha>`
- Build: `<revyl build id or version>`
- App: `<revyl app id>`
- Session: `<session id>`
- Device: `<device model>`
- OS: `<os version>`
- Sandbox: `<sandbox name>` (Vercel Sandbox, `<runtime>`, `<region>`)
- Launch vars: `REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN`, `REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN`, `REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN`, `REVYL_SWIFT_DEMO_TEST_UID_TOKEN`
```

## Final Video Proof

```markdown
### iOS Preview

<video src="<presentable-mp4-artifact-path>" controls></video>

Done from an ephemeral Vercel Sandbox:
- Installed and authenticated the Revyl CLI inside a fresh Linux microVM.
- Built the Swift starter with Revyl remote iOS build.
- Started a fresh Revyl iOS simulator with the four demo launch vars.
- Validated the authenticated cloud-agent proof screen.

Metadata:
- Branch: `<branch>`
- Commit: `<commit sha>`
- Build: `<revyl build id or version>`
- App: `<revyl app id>`
- Session: `<session id>`
- Device: `<device model>`
- OS: `<os version>`
- Sandbox: `<sandbox name>` (Vercel Sandbox, `<runtime>`, `<region>`)
- Launch vars: `REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN`, `REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN`, `REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN`, `REVYL_SWIFT_DEMO_TEST_UID_TOKEN`

<a href="<revyl-session-url>">
  <img alt="Open in Revyl" src="https://img.shields.io/badge/Open%20in-Revyl-7C3AED?style=for-the-badge&labelColor=111827" />
</a>
```

## Screenshot Proof

```markdown
### iOS Preview

Done from an ephemeral Vercel Sandbox:
- Installed and authenticated the Revyl CLI inside a fresh Linux microVM.
- Built the Swift starter with Revyl remote iOS build.
- Started a fresh Revyl iOS simulator with the four demo launch vars.
- Validated the authenticated cloud-agent proof screen.

![Authenticated Revyl Swift Demo screen](<uploaded-screenshot-artifact-path>)

Metadata:
- Branch: `<branch>`
- Commit: `<commit sha>`
- Build: `<revyl build id or version>`
- App: `<revyl app id>`
- Session: `<session id>`
- Device: `<device model>`
- OS: `<os version>`
- Sandbox: `<sandbox name>` (Vercel Sandbox, `<runtime>`, `<region>`)
- Launch vars: `REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN`, `REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN`, `REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN`, `REVYL_SWIFT_DEMO_TEST_UID_TOKEN`

<a href="<revyl-session-url>">
  <img alt="Open in Revyl" src="https://img.shields.io/badge/Open%20in-Revyl-7C3AED?style=for-the-badge&labelColor=111827" />
</a>
```
