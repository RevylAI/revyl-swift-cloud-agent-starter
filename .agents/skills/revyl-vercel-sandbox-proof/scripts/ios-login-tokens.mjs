#!/usr/bin/env node

import crypto from "node:crypto";

const prefix = "REVYL_SWIFT_DEMO";
const ttlSeconds = Number.parseInt(
  process.env.REVYL_SWIFT_DEMO_DEMO_TOKEN_TTL_SECONDS || "86400",
  10,
);

if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
  console.error("REVYL_SWIFT_DEMO_DEMO_TOKEN_TTL_SECONDS must be a positive integer.");
  process.exit(1);
}

const nowSeconds = Math.floor(Date.now() / 1000);
const expSeconds = nowSeconds + ttlSeconds;

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function demoJwt(kind) {
  const header = {
    alg: "none",
    typ: "JWT",
  };
  const payload = {
    aud: "revyl-swift-cloud-agent-starter",
    exp: expSeconds,
    iat: nowSeconds,
    iss: "revyl-swift-demo-local-mint",
    kind,
    sub: "demo-user",
  };

  return `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}.demo`;
}

const tokens = {
  [`${prefix}_TEST_LOGIN_TOKEN`]: "true",
  [`${prefix}_TEST_ACCESS_TOKEN`]: demoJwt("access"),
  [`${prefix}_TEST_REFRESH_TOKEN`]: `demo-refresh-${crypto.randomUUID()}`,
  [`${prefix}_TEST_UID_TOKEN`]: demoJwt("uid"),
};

console.log(JSON.stringify(tokens, null, 2));

