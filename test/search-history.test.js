import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("recent searches are returned newest first and respect the limit", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "locallens-searches-"),
  );
  process.env.LOCALLENS_DATA_DIR = directory;
  const database = await import(`../server/database.js?test=${Date.now()}`);

  database.recordSearch(
    {
      location: "Kolkata",
      category: "Cafes",
      minRating: 4.5,
      minReviews: 50,
      depth: "quick",
    },
    { uniquePlaces: 4 },
    "demo",
    false,
  );
  database.recordSearch(
    {
      location: "Howrah",
      category: "Dentists",
      minRating: 4.3,
      minReviews: 20,
      depth: "standard",
    },
    { uniquePlaces: 7 },
    "google",
    true,
  );

  const searches = database.listRecentSearches(1);
  assert.equal(searches.length, 1);
  assert.equal(searches[0].query.location, "Howrah");
  assert.equal(searches[0].provider, "google");
  assert.equal(searches[0].cacheHit, true);

  database.closeDatabase();
  fs.rmSync(directory, { recursive: true, force: true });
});
