import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

// Each test file runs in its own process, so pointing the data directory at a
// temporary folder before importing the server keeps the real database untouched.
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locallens-api-"));
process.env.LOCALLENS_DATA_DIR = dataDirectory;
delete process.env.LOCALLENS_API_TOKEN;

let server;
let baseUrl;
let closeDatabase;

before(async () => {
  const { app } = await import("../server/index.js");
  ({ closeDatabase } = await import("../server/database.js"));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(dataDirectory, { recursive: true, force: true });
});

const post = (url, body, headers = {}) =>
  fetch(`${baseUrl}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("demo search diagnostics match the places actually returned", async () => {
  const response = await post("/api/search", {
    location: "Test City",
    category: "Cafe",
    minRating: 4.5,
    minReviews: 50,
    provider: "demo",
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.provider, "demo");
  assert.equal(result.diagnostics.uniquePlaces, result.searchedCount);
  assert.equal(result.diagnostics.rawResults, result.searchedCount);
  assert.equal(result.diagnostics.pagesFetched, 0);
});

test("demo phone numbers cannot belong to a real Indian subscriber", async () => {
  const response = await post("/api/search", {
    location: "Test City",
    category: "All businesses",
    minRating: 0,
    minReviews: 0,
    provider: "demo",
  });
  const { opportunities } = await response.json();
  assert.ok(opportunities.length > 0);
  for (const place of opportunities)
    assert.match(
      place.phone,
      /^\+91 0/,
      `${place.name} has a realistic number`,
    );
});

test("non-numeric qualification thresholds are rejected", async () => {
  const response = await post("/api/search", {
    location: "Test City",
    minRating: "high",
    provider: "demo",
  });
  assert.equal(response.status, 400);
});

test("settings ignore empty values and clamp out-of-range numbers", async () => {
  const response = await fetch(`${baseUrl}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dailyGeminiCallLimit: "",
      searchCacheHours: -5,
      defaultCurrency: "usd",
      packagePrices: { starter: 9000, growth: "not a price" },
      unknownSetting: true,
    }),
  });
  const { settings } = await response.json();
  assert.equal(settings.dailyGeminiCallLimit, 30, "empty value keeps default");
  assert.equal(settings.searchCacheHours, 1, "negative value is clamped");
  assert.equal(settings.defaultCurrency, "USD");
  assert.equal(settings.packagePrices.starter, 9000);
  assert.equal(settings.packagePrices.growth, 30000, "invalid price ignored");
  assert.equal("unknownSetting" in settings, false);
});

test("a disallowed browser origin gets a 403 JSON error without a stack trace", async () => {
  const response = await fetch(`${baseUrl}/api/leads`, {
    headers: { Origin: "http://not-allowed.example" },
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, "Origin is not allowed.");
});

test("updating a missing delivery task returns 404", async () => {
  const response = await fetch(`${baseUrl}/api/delivery-tasks/99999`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(response.status, 404);
});

test("saved leads keep their CRM fields across updates", async () => {
  const search = await post("/api/search", {
    location: "Test City",
    category: "Dentist",
    minRating: 4,
    minReviews: 10,
    provider: "demo",
  });
  const [lead] = (await search.json()).opportunities;
  const saved = await post("/api/leads", {
    lead,
    crm: { status: "qualified" },
  });
  assert.equal(saved.status, 200);

  const patched = await fetch(
    `${baseUrl}/api/leads/${encodeURIComponent(lead.id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "contacted", notes: "Called once" }),
    },
  );
  const { lead: updated } = await patched.json();
  assert.equal(updated.crm.status, "contacted");
  assert.equal(updated.crm.notes, "Called once");

  const detail = await (
    await fetch(`${baseUrl}/api/leads/${encodeURIComponent(lead.id)}`)
  ).json();
  assert.ok(detail.lead.commercialScore.score > 0);
  assert.ok(detail.activities.length >= 2);

  // The list view must show the same (current) score as the lead drawer.
  const { leads } = await (await fetch(`${baseUrl}/api/leads`)).json();
  const listed = leads.find((item) => item.id === lead.id);
  assert.equal(listed.commercialScore.score, detail.lead.commercialScore.score);
});
