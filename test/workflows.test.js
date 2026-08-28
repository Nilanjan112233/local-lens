import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeliveryChecklist,
  buildProposalOptions,
  calculateCommercialScore,
} from "../server/workflows.js";

const lead = {
  id: "test-lead",
  name: "Example Dental Clinic",
  category: "Dentist",
  rating: 4.8,
  reviewCount: 180,
  phone: "+91 90000 00000",
  recommendation: {
    pages: ["Home", "Services", "About", "Contact", "Reviews"],
    features: ["Appointment enquiry", "Click to call"],
  },
};

test("commercial score rewards verified evidence without exceeding 100", () => {
  const unverified = calculateCommercialScore(lead);
  const verified = calculateCommercialScore(
    lead,
    { verdict: "confirmed_no_owned_website" },
    { websiteVerdict: "strong_opportunity" },
  );

  assert.ok(verified.score > unverified.score);
  assert.ok(verified.score <= 100);
  assert.equal(verified.tier, "priority");
  assert.ok(
    verified.factors.some((factor) => factor.label === "Verified web gap"),
  );
});

test("proposal options use configured prices and remain drafts", () => {
  const options = buildProposalOptions(lead, null, {
    defaultCurrency: "INR",
    packagePrices: { starter: 12000, growth: 25000, booking: 42000 },
  });

  assert.deepEqual(
    options.map(({ packageKey, amount }) => [packageKey, amount]),
    [
      ["starter", 12000],
      ["growth", 25000],
      ["booking", 42000],
    ],
  );
  assert.ok(options.every((option) => option.status === "draft"));
  assert.ok(
    options.every((option) =>
      option.terms.some((term) => /No guaranteed/.test(term)),
    ),
  );
});

test("delivery checklist makes external implementation explicit", () => {
  const tasks = buildDeliveryChecklist({ scope: { revisions: 2 } });

  assert.equal(tasks.length, 13);
  assert.ok(tasks.every((task) => task.completed === false));
  assert.ok(
    tasks.some(
      (task) =>
        task.phase === "External build" &&
        /outside LocalLens/i.test(task.label),
    ),
  );
});
