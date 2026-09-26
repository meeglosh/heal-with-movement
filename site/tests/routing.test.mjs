import { test } from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/_middleware.js";

test("www POST redirects to apex with 308 while preserving the URL", async () => {
  let continued = false;
  const request = new Request(
    "https://www.healwithmovement.com/api/portal/start?from=mail",
    { method: "POST", body: "{}" },
  );
  const response = await onRequest({
    request,
    next: async () => {
      continued = true;
      return new Response("page");
    },
  });

  assert.equal(response.status, 308);
  assert.equal(continued, false);
  assert.equal(
    response.headers.get("location"),
    "https://healwithmovement.com/api/portal/start?from=mail",
  );
});

test("existing intake redirects and private-route headers remain intact", async () => {
  const intake = await onRequest({
    request: new Request("https://healwithmovement.com/intake"),
    next: async () => new Response("unexpected"),
  });
  assert.equal(intake.status, 303);
  assert.equal(intake.headers.get("location"), "/book.html");
  assert.equal(intake.headers.get("cache-control"), "no-store");

  const secured = await onRequest({
    request: new Request("https://healwithmovement.com/api/auth/get-session"),
    next: async () => new Response("ok"),
  });
  assert.equal(secured.headers.get("cache-control"), "no-store");
  assert.equal(secured.headers.get("referrer-policy"), "same-origin");

  const publicPage = await onRequest({
    request: new Request("https://healwithmovement.com/about"),
    next: async () => new Response("ok"),
  });
  assert.equal(publicPage.headers.get("cache-control"), null);
  assert.equal(publicPage.headers.get("referrer-policy"), null);
});
