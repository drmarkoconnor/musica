import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { dispatchLessonTranscription } from "./transcription-dispatch";
import backgroundHandler from "../../../netlify/functions/transcribe-lesson-background";

const previousFetch = globalThis.fetch;
const previousEnv = { ...process.env };
afterEach(() => {
  globalThis.fetch = previousFetch;
  for (const key of ["DEPLOY_URL", "DEPLOY_PRIME_URL", "URL", "TRANSCRIPTION_PASSWORD"]) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});

test("continuation dispatch uses the current deployment and a bounded native background request", async () => {
  process.env.DEPLOY_URL = "https://current-deployment.example";
  process.env.URL = "https://production.example";
  let seen = false;
  globalThis.fetch = async (url, init) => {
    seen = true;
    assert.equal(String(url), "https://current-deployment.example/.netlify/functions/transcribe-lesson-background");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { jobId: "job", token: "fixture-token" });
    assert.ok(init?.signal instanceof AbortSignal);
    return new Response(null, { status: 202 });
  };
  await dispatchLessonTranscription({ jobId: "job", token: "fixture-token" });
  assert.ok(seen);
});

test("a routed app shell is a dispatch failure, and an unconfigured server cannot leak the worker token to a supplied host", async () => {
  process.env.DEPLOY_URL = "https://deployment.example";
  globalThis.fetch = async () => new Response("app shell", { headers: { "Content-Type": "text/html" } });
  await assert.rejects(dispatchLessonTranscription({ jobId: "job", token: "fixture-token" }), /did not start/);
  delete process.env.DEPLOY_URL; delete process.env.DEPLOY_PRIME_URL; delete process.env.URL;
  globalThis.fetch = async () => { throw new Error("No unconfigured request should be sent"); };
  await assert.rejects(dispatchLessonTranscription({ jobId: "job", token: "fixture-token", requestUrl: "https://untrusted-host.example" }), /not configured/);
});

test("modern background function validates native Request auth and job input before DB access", async () => {
  process.env.TRANSCRIPTION_PASSWORD = "fixture-token";
  const request = (body: unknown) => new Request("https://deployment.example/.netlify/functions/transcribe-lesson-background", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await backgroundHandler(new Request("https://deployment.example"))).status, 405);
  assert.equal((await backgroundHandler(request(null))).status, 400);
  assert.equal((await backgroundHandler(request({ token: "wrong", jobId: "job" }))).status, 401);
  assert.equal((await backgroundHandler(request({ token: "fixture-token", jobId: "bad-id" }))).status, 400);
});
