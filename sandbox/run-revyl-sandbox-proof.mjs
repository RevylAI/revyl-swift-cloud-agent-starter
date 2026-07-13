#!/usr/bin/env node

// Runs the Revyl Swift Demo proof loop from inside an ephemeral Vercel Sandbox.
//
// The sandbox is a fresh Linux microVM with nothing on it, which is the point:
// it proves the Revyl CLI can be installed, authenticated, and driven through
// remote build + device proof from any disposable compute. The iOS build
// itself happens on Revyl's remote macOS runners, so the Linux sandbox never
// needs Xcode.
//
// Beyond running commands, the demo leans on the Sandbox SDK itself:
//   - a live status page is served from inside the microVM (ports + domain()
//     + writeFiles() + a detached command) so you can watch the proof run;
//   - the Revyl config is patched through the SDK filesystem API, not sed;
//   - the device screenshot is captured inside the VM and pulled out with
//     downloadFile();
//   - stop() telemetry (CPU time, network transfer) lands in the summary.
//
// Required env:
//   REVYL_API_KEY                 Revyl API key used inside the sandbox.
//   VERCEL_OIDC_TOKEN             (from `vercel env pull`)  -- or --
//   VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID
//
// Optional env:
//   SANDBOX_GIT_URL               Repo URL cloned into the sandbox. Defaults to
//                                 the local `origin` remote.
//   SANDBOX_GIT_REVISION          Branch, tag, or sha to clone. Defaults to main.
//   SANDBOX_GIT_USERNAME          Git username for private repos.
//   SANDBOX_GIT_PASSWORD          Git password/token for private repos
//                                 (GITHUB_TOKEN is used as a fallback).
//   SANDBOX_RUNTIME               Sandbox runtime image. Defaults to node22.
//   SANDBOX_VCPUS                 vCPUs for the sandbox. Defaults to 4.
//   SANDBOX_TIMEOUT_MINUTES       Sandbox session timeout. Defaults to 40.
//   REVYL_ORG_ID / REVYL_APP_ID   Patch the starter placeholders in
//                                 ios/.revyl/config.yaml after cloning.
//   REVYL_BUILD_IMAGE             Revyl build runner image, e.g.
//                                 ios-macos-26-xcode-26.2.
//   KEEP_DEVICE_SESSION=1         Leave the Revyl device session running for
//                                 manual viewing instead of stopping it.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Sandbox } from "@vercel/sandbox";
import ms from "ms";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const artifactsDir = resolve(scriptDir, "artifacts");

const launchVarKeys = [
  "REVYL_SWIFT_DEMO_TEST_LOGIN_TOKEN",
  "REVYL_SWIFT_DEMO_TEST_ACCESS_TOKEN",
  "REVYL_SWIFT_DEMO_TEST_REFRESH_TOKEN",
  "REVYL_SWIFT_DEMO_TEST_UID_TOKEN",
];

const validationPhrase =
  "The Revyl Swift Demo shows an authenticated cloud-agent proof screen";

// Falls back to the pre-cleanup path so older cloned revisions still work.
const preflightScript =
  ".agents/skills/revyl-vercel-sandbox-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs";
const legacyPreflightScript =
  ".agents/skills/ios-revyl-pr-proof/scripts/ensure-revyl-ios-auth-launch-vars.mjs";

const configPath = "ios/.revyl/config.yaml";
const screenshotSandboxPath = "/tmp/proof-screen.png";
const statusPort = 3000;

// grep -q on a live pipe SIGPIPEs the CLI under pipefail; buffer to a file.
const installRevylScript = `
has_remote_build() {
  revyl build --help > /tmp/revyl-build-help.txt 2>/dev/null || true
  grep -q -- --remote /tmp/revyl-build-help.txt
}
if ! command -v revyl >/dev/null 2>&1 || ! has_remote_build; then
  REVYL_NO_MODIFY_PATH=1 sh -c 'curl -fsSL https://revyl.com/install.sh | sh'
fi
revyl --version
has_remote_build
`;

const statusServerSource = `
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const dir = new URL(".", import.meta.url).pathname;

createServer(async (req, res) => {
  if (req.url.startsWith("/status.json")) {
    try {
      const body = await readFile(\`\${dir}status.json\`);
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "application/json" });
      res.end("{}");
    }
    return;
  }
  if (req.url.startsWith("/screen.png")) {
    try {
      const body = await readFile("${screenshotSandboxPath}");
      res.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
    return;
  }
  try {
    const html = await readFile(\`\${dir}index.html\`);
    res.writeHead(200, { "content-type": "text/html" });
    res.end(html);
  } catch {
    res.writeHead(500);
    res.end("status page missing");
  }
}).listen(${statusPort});
`;

const statusPageSource = `<!doctype html>
<html><head><meta charset="utf-8"><title>Revyl CLI in a Vercel Sandbox</title>
<style>
body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#0b1220;color:#e5e7eb;max-width:640px;margin:40px auto;padding:0 16px}
h1{font-size:20px;color:#fff}
.sub{color:#6b7280;font-size:12px;margin-bottom:20px}
.step{padding:7px 0;border-bottom:1px solid #1f2937;font-size:14px}
.pending{color:#6b7280}.running{color:#fbbf24}.ok{color:#34d399}.fail{color:#f87171}
img{max-width:280px;border:1px solid #374151;border-radius:10px;margin-top:18px;display:block}
a{color:#818cf8}
</style></head><body>
<h1>Revyl CLI in a Vercel Sandbox</h1>
<div class="sub" id="meta">connecting&hellip;</div>
<div id="steps"></div>
<div id="extra"></div>
<script>
const icons = { pending: "\\u25CB", running: "\\u25D0", ok: "\\u25CF", fail: "\\u2715" };
async function tick() {
  try {
    const s = await (await fetch("/status.json", { cache: "no-store" })).json();
    document.getElementById("meta").textContent =
      "sandbox " + s.sandbox + " \\u00B7 " + s.region + " \\u00B7 started " + s.startedAt;
    document.getElementById("steps").innerHTML = (s.steps || [])
      .map((t) => '<div class="step ' + t.state + '">' + (icons[t.state] || icons.pending) + " " + t.label + "</div>")
      .join("");
    let extra = "";
    if (s.viewerUrl) extra += '<p><a href="' + s.viewerUrl + '" target="_blank">Open live device in Revyl \\u2192</a></p>';
    if (s.screenshot) extra += '<img src="/screen.png?' + Date.now() + '" alt="device screenshot">';
    if (s.error) extra += '<p class="fail">' + s.error + "</p>";
    if (s.done) extra += '<p class="ok">Proof complete. Sandbox shutting down.</p>';
    document.getElementById("extra").innerHTML = extra;
    if (!s.done && !s.error) setTimeout(tick, 2000);
  } catch {
    setTimeout(tick, 2000);
  }
}
tick();
</script></body></html>
`;

function log(message) {
  console.log(`[sandbox-proof] ${message}`);
}

// Loads sandbox/.env.local (copy .env.example) so the demo is copy-fill-run.
// Values already present in the environment win.
function loadEnvFile() {
  let text;
  const envPath = resolve(scriptDir, ".env.local");
  try {
    text = readFileSync(envPath, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[0].trim().startsWith("#")) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined || rawValue === "") continue;
    process.env[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
  }
  log("Loaded environment from sandbox/.env.local.");
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} must be set.`);
  }
  return value;
}

function detectGitUrl() {
  if (process.env.SANDBOX_GIT_URL) {
    return process.env.SANDBOX_GIT_URL;
  }

  let origin;
  try {
    origin = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: scriptDir,
      encoding: "utf8",
    }).trim();
  } catch {
    throw new Error(
      "Could not read the origin remote; set SANDBOX_GIT_URL to the repo URL the sandbox should clone.",
    );
  }

  const sshMatch = origin.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}.git`;
  }
  return origin;
}

// Revyl `--json` output can carry log lines around the payload; grab the
// outermost JSON object rather than assuming the whole stream parses.
function parseJsonLoose(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function findByKey(value, keyPattern) {
  const queue = [value];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const [key, entry] of Object.entries(current)) {
      if (
        keyPattern.test(key) &&
        (typeof entry === "string" || typeof entry === "number")
      ) {
        return String(entry);
      }
      if (entry && typeof entry === "object") {
        queue.push(entry);
      }
    }
  }
  return null;
}

function findUrl(value) {
  const queue = [value];
  const seen = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const [key, entry] of Object.entries(current)) {
      if (
        typeof entry === "string" &&
        /^https?:\/\//.test(entry) &&
        /url|viewer|session|link/i.test(key)
      ) {
        return entry;
      }
      if (entry && typeof entry === "object") {
        queue.push(entry);
      }
    }
  }
  return null;
}

async function sh(sandbox, script, { env = {}, label, quiet = false } = {}) {
  log(`$ ${label ?? script.trim().split("\n")[0]}`);
  const result = await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      `set -euo pipefail\nexport PATH="$HOME/.revyl/bin:$PATH"\n${script}`,
    ],
    env,
  });
  const stdout = await result.stdout();
  const stderr = await result.stderr();
  if (stderr.trim() !== "") {
    process.stderr.write(stderr.endsWith("\n") ? stderr : `${stderr}\n`);
  }
  if (result.exitCode !== 0) {
    throw new Error(
      `Sandbox command failed with exit code ${result.exitCode}: ${label ?? script.trim()}\n${stdout}`,
    );
  }
  if (!quiet && stdout.trim() !== "") {
    process.stdout.write(stdout.endsWith("\n") ? stdout : `${stdout}\n`);
  }
  return stdout;
}

function livePrBlock({ viewerUrl, meta }) {
  return `### iOS Preview

<a href="${viewerUrl ?? "<revyl-session-url>"}">
  <img alt="Open in Revyl" src="https://img.shields.io/badge/Open%20in-Revyl-7C3AED?style=for-the-badge&labelColor=111827" />
</a>

Live Revyl session started from a Vercel Sandbox; final proof pending.

Metadata:
${metaLines(meta)}
`;
}

function finalPrBlock({ viewerUrl, meta }) {
  return `### iOS Preview

![Authenticated Revyl Swift Demo screen](sandbox/artifacts/proof-screen.png)

Done from an ephemeral Vercel Sandbox:
- Installed and authenticated the Revyl CLI inside a fresh Linux microVM.
- Built the Swift starter with Revyl remote iOS build.
- Started a fresh Revyl iOS simulator with the four demo launch vars.
- Validated the authenticated cloud-agent proof screen.
- Pulled the device screenshot out of the sandbox with the SDK filesystem API.

Metadata:
${metaLines(meta)}

<a href="${viewerUrl ?? "<revyl-session-url>"}">
  <img alt="Open in Revyl" src="https://img.shields.io/badge/Open%20in-Revyl-7C3AED?style=for-the-badge&labelColor=111827" />
</a>
`;
}

function metaLines(meta) {
  return [
    `- Branch/revision: \`${meta.revision}\``,
    `- Commit: \`${meta.commit ?? "<commit sha>"}\``,
    `- Build: \`${meta.buildVersionId ?? "<revyl build version id>"}\``,
    `- Session: \`${meta.sessionId ?? "<session id>"}\``,
    `- Sandbox: \`${meta.sandboxName}\` (Vercel Sandbox, ${meta.runtime}, ${meta.region ?? "unknown region"})`,
    `- Launch vars: ${launchVarKeys.map((key) => `\`${key}\``).join(", ")}`,
  ].join("\n");
}

async function main() {
  loadEnvFile();
  const revylApiKey = requiredEnv("REVYL_API_KEY");
  const gitUrl = detectGitUrl();
  const revision = process.env.SANDBOX_GIT_REVISION || "main";
  const runtime = process.env.SANDBOX_RUNTIME || "node22";
  const vcpus = Number.parseInt(process.env.SANDBOX_VCPUS || "4", 10);
  const timeoutMinutes = Number.parseInt(
    process.env.SANDBOX_TIMEOUT_MINUTES || "40",
    10,
  );

  const source = {
    type: "git",
    url: gitUrl,
    revision,
    depth: 1,
  };
  const gitPassword =
    process.env.SANDBOX_GIT_PASSWORD || process.env.GITHUB_TOKEN;
  if (gitPassword) {
    source.username = process.env.SANDBOX_GIT_USERNAME || "x-access-token";
    source.password = gitPassword;
  }

  // The SDK reads VERCEL_OIDC_TOKEN implicitly; access-token auth must be
  // passed explicitly as create params.
  const credentials =
    process.env.VERCEL_TOKEN &&
    process.env.VERCEL_TEAM_ID &&
    process.env.VERCEL_PROJECT_ID
      ? {
          token: process.env.VERCEL_TOKEN,
          teamId: process.env.VERCEL_TEAM_ID,
          projectId: process.env.VERCEL_PROJECT_ID,
        }
      : {};

  log(`Creating Vercel Sandbox (${runtime}, ${vcpus} vCPUs) from ${gitUrl}@${revision}.`);
  const sandbox = await Sandbox.create({
    ...credentials,
    source,
    runtime,
    resources: { vcpus },
    timeout: ms(`${timeoutMinutes}m`),
    ports: [statusPort],
    persistent: false,
    tags: { demo: "revyl-sandbox-proof" },
  });
  log(`Sandbox ${sandbox.name} is ${sandbox.status} in ${sandbox.region ?? "unknown region"}.`);

  // Live status page, served from inside the microVM.
  const status = {
    sandbox: sandbox.name,
    region: sandbox.region ?? "unknown region",
    startedAt: new Date().toISOString(),
    steps: [
      { id: "install", label: "Install + authenticate Revyl CLI", state: "pending" },
      { id: "config", label: "Patch Revyl config via SDK filesystem", state: "pending" },
      { id: "launch-vars", label: "Refresh demo launch vars", state: "pending" },
      { id: "build", label: "Remote iOS build (Revyl macOS runners)", state: "pending" },
      { id: "device", label: "Start fresh device session", state: "pending" },
      { id: "validation", label: "Validate authenticated proof screen", state: "pending" },
      { id: "screenshot", label: "Pull device screenshot out of the VM", state: "pending" },
      { id: "report", label: "Fetch device report", state: "pending" },
    ],
    viewerUrl: null,
    screenshot: false,
    done: false,
    error: null,
  };

  const pushStatus = async () => {
    await sandbox.writeFiles([
      {
        path: ".proof-status/status.json",
        content: Buffer.from(JSON.stringify(status)),
      },
    ]);
  };
  const setStep = async (id, state) => {
    const step = status.steps.find((entry) => entry.id === id);
    if (step) step.state = state;
    await pushStatus();
  };

  let sandboxStopped = false;
  try {
    await sandbox.writeFiles([
      { path: ".proof-status/server.mjs", content: Buffer.from(statusServerSource) },
      { path: ".proof-status/index.html", content: Buffer.from(statusPageSource) },
      { path: ".proof-status/status.json", content: Buffer.from(JSON.stringify(status)) },
    ]);
    await sandbox.runCommand({
      cmd: "node",
      args: [".proof-status/server.mjs"],
      detached: true,
    });
    log(`Live status page (served from inside the sandbox): ${sandbox.domain(statusPort)}`);

    // 1. Install and authenticate the Revyl CLI inside the sandbox.
    await setStep("install", "running");
    await sh(sandbox, installRevylScript, {
      label: "install revyl CLI",
      quiet: true,
    });
    await sh(sandbox, 'revyl auth login --api-key="$REVYL_API_KEY"', {
      env: { REVYL_API_KEY: revylApiKey },
      label: "revyl auth login --api-key <redacted>",
      quiet: true,
    });
    await sh(sandbox, "revyl auth status", {
      env: { REVYL_API_KEY: revylApiKey },
    });
    await setStep("install", "ok");

    // Patch the Revyl ids into config.yaml through the SDK filesystem API
    // when the cloned revision still has the starter placeholders, so
    // nothing needs to be pushed upstream.
    await setStep("config", "running");
    const orgId = process.env.REVYL_ORG_ID;
    const appId = process.env.REVYL_APP_ID;
    if (orgId || appId) {
      const configBuffer = await sandbox.readFileToBuffer({ path: configPath });
      if (!configBuffer) {
        throw new Error(`${configPath} not found in the cloned revision.`);
      }
      let config = configBuffer.toString("utf8");
      if (orgId) config = config.replace("REPLACE_WITH_REVYL_ORG_ID", orgId);
      if (appId) config = config.replace("REPLACE_WITH_REVYL_APP_ID", appId);
      await sandbox.writeFiles([
        { path: configPath, content: Buffer.from(config) },
      ]);
      log(`Patched ${configPath} via sandbox.writeFiles().`);
    }
    await setStep("config", "ok");

    // 2. Refresh the demo auth launch vars from inside the sandbox.
    await setStep("launch-vars", "running");
    await sh(
      sandbox,
      `if [ -f ${preflightScript} ]; then node ${preflightScript} --json; else node ${legacyPreflightScript} --json; fi`,
      {
        env: { REVYL_API_KEY: revylApiKey },
        label: "refresh demo launch vars",
      },
    );
    await setStep("launch-vars", "ok");

    const commit = (
      await sh(sandbox, "git rev-parse HEAD", { quiet: true })
    ).trim();

    // 3. Remote iOS build. Runs on Revyl's macOS runners; the sandbox only
    //    drives the CLI. REVYL_BUILD_IMAGE pins the runner image when the
    //    repo's .xcode-version is stricter than the default runner Xcode.
    await setStep("build", "running");
    const buildImage = process.env.REVYL_BUILD_IMAGE;
    const imageFlag = buildImage ? ` --image ${buildImage}` : "";
    const buildStdout = await sh(
      sandbox,
      `cd ios && revyl build --remote --platform ios${imageFlag} --json`,
      { env: { REVYL_API_KEY: revylApiKey }, label: "revyl build --remote" },
    );
    const buildPayload = parseJsonLoose(buildStdout);
    const buildVersionId =
      findByKey(buildPayload, /build.?version.?id/i) ??
      findByKey(buildPayload, /version.?id/i);
    if (!buildVersionId) {
      throw new Error(
        "Could not find a build version id in the revyl build --remote output.",
      );
    }
    log(`Remote build produced build version ${buildVersionId}.`);
    await setStep("build", "ok");

    // 4. Start a fresh device session with the four launch vars.
    await setStep("device", "running");
    const launchVarArgs = launchVarKeys
      .map((key) => `--launch-var ${key}`)
      .join(" ");
    const deviceStdout = await sh(
      sandbox,
      `cd ios && revyl device start --platform ios --build-version-id ${buildVersionId} ${launchVarArgs} --timeout 900 --open=false --json`,
      { env: { REVYL_API_KEY: revylApiKey }, label: "revyl device start" },
    );
    const devicePayload = parseJsonLoose(deviceStdout);
    const sessionId = findByKey(devicePayload, /session.?id/i);
    const viewerUrl =
      findUrl(devicePayload) ??
      (sessionId ? `https://app.revyl.ai/sessions/${sessionId}` : null);
    if (!sessionId) {
      throw new Error(
        "Could not find a session id in the revyl device start output.",
      );
    }
    log(`Device session ${sessionId} started.`);
    status.viewerUrl = viewerUrl;
    await setStep("device", "ok");

    const meta = {
      revision,
      commit,
      buildVersionId,
      sessionId,
      sandboxName: sandbox.name,
      runtime,
      region: sandbox.region,
    };

    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(
      resolve(artifactsDir, "pr-proof-live.md"),
      livePrBlock({ viewerUrl, meta }),
    );
    log("Live PR proof block written to sandbox/artifacts/pr-proof-live.md — post it now.");

    // 5. Validate the app outcome, not just that the session exists.
    await setStep("validation", "running");
    const validationStdout = await sh(
      sandbox,
      `cd ios && revyl device validation -s 0 "${validationPhrase}" --json`,
      { env: { REVYL_API_KEY: revylApiKey }, label: "revyl device validation" },
    );
    const validationPayload = parseJsonLoose(validationStdout);
    const validationText = JSON.stringify(validationPayload ?? validationStdout);
    const validationFailed = /"(passed|success|result|valid)"\s*:\s*false/i.test(
      validationText,
    );
    if (validationFailed) {
      throw new Error(
        "Focused validation returned false; the proof screen is not authenticated. Fix and rerun with a fresh session.",
      );
    }
    await setStep("validation", "ok");

    // Capture the proof screen inside the VM, then pull it out with the SDK.
    await setStep("screenshot", "running");
    await sh(
      sandbox,
      `cd ios && revyl device screenshot -s 0 --out ${screenshotSandboxPath}`,
      {
        env: { REVYL_API_KEY: revylApiKey },
        label: "revyl device screenshot",
        quiet: true,
      },
    );
    const screenshotLocalPath = await sandbox.downloadFile(
      { path: screenshotSandboxPath },
      { path: resolve(artifactsDir, "proof-screen.png") },
      { mkdirRecursive: true },
    );
    if (!screenshotLocalPath) {
      throw new Error("Device screenshot was not written inside the sandbox.");
    }
    log(`Screenshot pulled out of the sandbox to ${screenshotLocalPath}.`);
    status.screenshot = true;
    await setStep("screenshot", "ok");

    // 6. Fetch the report for the record.
    await setStep("report", "running");
    const reportStdout = await sh(
      sandbox,
      `cd ios && revyl device report --session-id ${sessionId} --json`,
      {
        env: { REVYL_API_KEY: revylApiKey },
        label: "revyl device report",
        quiet: true,
      },
    );
    const reportPayload = parseJsonLoose(reportStdout);
    const reportText = JSON.stringify(reportPayload ?? {});
    const missingKeys = launchVarKeys.filter(
      (key) => !reportText.includes(key),
    );
    if (missingKeys.length > 0) {
      log(
        `Warning: the device report does not mention ${missingKeys.join(", ")}; verify launch-var injection in the Revyl viewer.`,
      );
    }
    await setStep("report", "ok");

    // Stop the device session this run created rather than letting it idle
    // out. KEEP_DEVICE_SESSION=1 leaves it running so a human can watch the
    // proof screen in the Revyl viewer until the idle timeout reclaims it.
    if (process.env.KEEP_DEVICE_SESSION === "1") {
      log(`Device session left running for manual viewing: https://app.revyl.ai/sessions/${sessionId}`);
    } else {
      await sh(sandbox, "cd ios && revyl device stop -s 0", {
        env: { REVYL_API_KEY: revylApiKey },
        label: "revyl device stop",
        quiet: true,
      });
    }

    status.done = true;
    await pushStatus();

    writeFileSync(
      resolve(artifactsDir, "pr-proof-final.md"),
      finalPrBlock({ viewerUrl: findUrl(reportPayload) ?? viewerUrl, meta }),
    );

    // Stopping the sandbox returns lifecycle telemetry for the whole run.
    log(`Stopping sandbox ${sandbox.name}.`);
    const stopResult = await sandbox.stop();
    sandboxStopped = true;

    writeFileSync(
      resolve(artifactsDir, "proof-summary.json"),
      `${JSON.stringify(
        {
          completedAt: new Date().toISOString(),
          sandbox: {
            name: sandbox.name,
            runtime,
            region: sandbox.region,
            vcpus,
            activeCpuUsageMs: stopResult?.activeCpuUsageMs ?? null,
            networkTransfer: stopResult?.networkTransfer ?? null,
          },
          git: { url: gitUrl, revision, commit },
          revyl: { buildVersionId, sessionId, viewerUrl },
          launchVarKeys,
          validation: { phrase: validationPhrase, failed: false },
        },
        null,
        2,
      )}\n`,
    );

    log("Proof loop complete.");
    log("Artifacts: sandbox/artifacts/proof-summary.json, proof-screen.png, pr-proof-live.md, pr-proof-final.md.");
    console.log("");
    console.log(finalPrBlock({ viewerUrl, meta }));
  } catch (error) {
    status.error = error instanceof Error ? error.message : String(error);
    try {
      await pushStatus();
    } catch {
      // The sandbox may already be unreachable; the error below still surfaces.
    }
    throw error;
  } finally {
    if (!sandboxStopped) {
      log(`Stopping sandbox ${sandbox.name}.`);
      await sandbox.stop();
    }
  }
}

main().catch((error) => {
  console.error(
    `[sandbox-proof] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
