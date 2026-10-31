import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import assert from "node:assert/strict";

const port = Number(process.env.SMOKE_TEST_PORT || 31987);
const baseUrl = `http://127.0.0.1:${port}`;

async function waitUntilReady(process, timeoutMs = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (process.exitCode !== null) throw Error("Next.js exited before readiness.");
    try {
      const response = await fetch(baseUrl + "/login", { signal: AbortSignal.timeout(3_000) });
      if (response.status === 200) return;
      throw Error(`Login page returned HTTP ${response.status}.`);
    } catch (error) {
      if (error.message.includes("Login page returned")) throw error;
    }
    await delay(400);
  }
  throw Error("Next.js application did not become ready within 45 seconds.");
}

/**
 * Real built Next.js HTTP checks; no test user, Cosmos mutations, or Azure
 * email sends. All requests to protected endpoints omit credentials.
 */
test("production server: public onboarding and recovery pages load; APIs require authorization", { timeout: 90_000 }, async (t) => {
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  let logs = "";
  const collect = (chunk) => { logs = (logs + String(chunk)).slice(-12_000); };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);

  try {
    await waitUntilReady(server);

    await t.test("public pages render over HTTP without authentication", async () => {
      for (const pathname of ["/", "/login", "/register", "/resume-registration"]) {
        const response = await fetch(baseUrl + pathname, { signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200, `${pathname} returned ${response.status}: ${logs.slice(-1_000)}`);
        assert.match(response.headers.get("content-type") || "", /text\/html/, pathname);
      }
    });

    await t.test("registration and consent mutations reject missing App Check", async () => {
      for (const pathname of [
        "/api/register",
        "/api/register/recover",
        "/api/consent/approve",
      ]) {
        const response = await fetch(baseUrl + pathname, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "unrecognized@example.test" }),
          signal: AbortSignal.timeout(10_000),
        });
        assert.equal(response.status, 401, `${pathname} should require App Check, got ${response.status}`);
      }
    });

    await t.test("student-specific mission and reflection endpoints reject anonymous callers", async () => {
      for (const pathname of [
        "/api/gamification/focus",
        "/api/gamification/reflect",
      ]) {
        const response = await fetch(baseUrl + pathname, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questId: "first-steps", registrationId: "any" }),
          signal: AbortSignal.timeout(10_000),
        });
        assert.equal(response.status, 401, `${pathname} should require sign-in, got ${response.status}`);
      }
    });
  } catch (error) {
    throw Error(`${error.message}\nServer log tail:\n${logs.slice(-4_000)}`);
  } finally {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => server.once("exit", resolve)),
      delay(5_000).then(() => server.kill("SIGKILL")),
    ]);
  }
});
