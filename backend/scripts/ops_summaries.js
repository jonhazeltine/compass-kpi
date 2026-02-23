#!/usr/bin/env node
/* eslint-disable no-console */
require("dotenv").config();
const { spawn } = require("child_process");

const BACKEND_URL = "http://127.0.0.1:4000";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function waitForHealth(timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const health = await request(`${BACKEND_URL}/health`);
      if (health.status === 200) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("backend health check timed out");
}

async function createAuthUser(email, password) {
  const create = await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert(create.status < 300, `create user failed: ${create.status}`);
  return create.data.id;
}

async function signIn(email, password) {
  const signInOut = await request(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: process.env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });
  assert(signInOut.status < 300, `sign in failed: ${signInOut.status}`);
  assert(signInOut.data.access_token, "missing access token");
  return signInOut.data.access_token;
}

async function main() {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const key of required) {
    assert(process.env[key], `${key} is required`);
  }

  const server = spawn("node", ["dist/index.js"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  let tempUserId = null;
  try {
    await waitForHealth();

    const email = `ops.summary.${Date.now()}@example.com`;
    const password = "TempPass!23456";
    tempUserId = await createAuthUser(email, password);
    const token = await signIn(email, password);

    const s1 = await request(`${BACKEND_URL}/ops/summary/sprint1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(s1.status === 200, `sprint1 summary failed: ${s1.status}`);

    const s2 = await request(`${BACKEND_URL}/ops/summary/sprint2`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(s2.status === 200, `sprint2 summary failed: ${s2.status}`);

    const s3 = await request(`${BACKEND_URL}/ops/summary/sprint3`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert(s3.status === 200, `sprint3 summary failed: ${s3.status}`);

    console.log("=== Sprint 1 Summary ===");
    console.log(JSON.stringify(s1.data, null, 2));
    console.log("\n=== Sprint 2 Summary ===");
    console.log(JSON.stringify(s2.data, null, 2));
    console.log("\n=== Sprint 3 Summary ===");
    console.log(JSON.stringify(s3.data, null, 2));
  } finally {
    if (tempUserId) {
      await request(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${tempUserId}`, {
        method: "DELETE",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
    server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
