import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlaybook,
  qualifyAndRecommend,
  scoreOpportunity,
} from "../server/agent.js";

const strongLead = {
  rating: 4.8,
  reviewCount: 250,
  phone: "123",
  businessStatus: "OPERATIONAL",
  category: "Dentist",
  website: null,
};

test("qualifies a well-reviewed business with no listed website", () => {
  const result = qualifyAndRecommend(strongLead, {
    minRating: 4.5,
    minReviews: 50,
  });
  assert.equal(result.qualifies, true);
  assert.equal(result.websiteEvidence, "not_listed");
  assert.equal(result.verificationStatus, "needs_verification");
});

test("excludes a business that already lists a website", () => {
  const result = qualifyAndRecommend(
    { ...strongLead, website: "https://example.com" },
    { minRating: 4.5, minReviews: 50 },
  );
  assert.equal(result.qualifies, false);
});

test("selects an industry-specific recommendation", () => {
  assert.match(getPlaybook("Cosmetic Dentist").type, /healthcare/i);
});

test("opportunity score stays within 0-100", () => {
  assert.ok(scoreOpportunity(strongLead) <= 100);
  assert.ok(scoreOpportunity({ rating: 0, reviewCount: 0 }) >= 0);
});
