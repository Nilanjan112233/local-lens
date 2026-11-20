const CATEGORY_VALUE = {
  Dentist: 13,
  Clinic: 12,
  Contractor: 12,
  "Beauty salon": 10,
  Gym: 9,
  Photographer: 9,
  Restaurant: 8,
  Cafe: 7,
  Bakery: 7,
  "Furniture store": 9,
};

const GAP_VERDICTS = new Set([
  "confirmed_no_owned_website",
  "social_only",
  "broken_or_outdated_website",
]);
// Stages in which website verification is still deciding whether to pursue a lead.
const QUALIFYING_STAGES = new Set([
  "new",
  "verification_required",
  "qualified",
]);

/**
 * Pipeline stage after a website verification. A lead that has already moved
 * on (contacted, proposal sent, won, ...) keeps its stage, so re-running
 * verification can never undo CRM progress.
 */
export function statusAfterVerification(currentStatus = "new", verdict) {
  if (!QUALIFYING_STAGES.has(currentStatus)) return currentStatus;
  return GAP_VERDICTS.has(verdict) ? "qualified" : "verification_required";
}

export function calculateCommercialScore(
  lead,
  verification = null,
  analysis = null,
) {
  const categoryWeight =
    Object.entries(CATEGORY_VALUE).find(([key]) =>
      lead.category?.toLowerCase().includes(key.toLowerCase()),
    )?.[1] || 6;
  const factors = [
    {
      label: "Customer trust",
      points: Math.min(22, Math.max(0, (lead.rating - 4) * 22)),
      evidence: `${lead.rating} rating`,
    },
    {
      label: "Demand signal",
      points: Math.min(20, Math.log10((lead.reviewCount || 0) + 1) * 8),
      evidence: `${lead.reviewCount} reviews`,
    },
    {
      label: "Category website value",
      points: categoryWeight,
      evidence: lead.category,
    },
    {
      label: "Contactability",
      points: lead.phone ? 10 : 2,
      evidence: lead.phone ? "Phone available" : "No phone listed",
    },
    {
      label: "Verified web gap",
      points:
        verification?.verdict === "confirmed_no_owned_website"
          ? 22
          : verification?.verdict === "social_only"
            ? 18
            : verification?.verdict === "broken_or_outdated_website"
              ? 14
              : 5,
      evidence: verification?.verdict || "Not independently verified",
    },
    {
      label: "AI opportunity",
      points:
        analysis?.websiteVerdict === "strong_opportunity"
          ? 14
          : analysis?.websiteVerdict === "possible_opportunity"
            ? 9
            : 4,
      evidence: analysis?.websiteVerdict || "Not analyzed",
    },
  ];
  const score = Math.round(
    Math.min(
      100,
      factors.reduce((sum, factor) => sum + factor.points, 0),
    ),
  );
  return {
    score,
    tier:
      score >= 80
        ? "priority"
        : score >= 65
          ? "strong"
          : score >= 50
            ? "possible"
            : "low",
    factors: factors.map((factor) => ({
      ...factor,
      points: Math.round(factor.points),
    })),
  };
}

export function buildProposalOptions(lead, analysis, settings) {
  const recommended = analysis?.recommendedBuild || lead.recommendation || {};
  const pages = recommended.pages || ["Home", "Services", "About", "Contact"];
  const features = recommended.features || lead.recommendation?.features || [];
  const commonTerms = [
    "Client supplies or approves final business facts, pricing, images, policies, and legal text",
    "One project contact and written approval at milestones",
    "Domain, hosting, paid plugins, and third-party fees are separate unless explicitly included",
    "Work begins after written acceptance and deposit",
    "No guaranteed ranking, traffic, leads, or revenue claims",
  ];
  return [
    {
      packageKey: "starter",
      title: "Starter presence",
      amount: settings.packagePrices.starter,
      currency: settings.defaultCurrency,
      summary:
        "A focused owned web presence for trust, discovery, and direct enquiries.",
      scope: {
        pages: pages.slice(0, 4),
        features: features.slice(0, 3),
        revisions: 1,
      },
      terms: commonTerms,
    },
    {
      packageKey: "growth",
      title: "Growth website",
      amount: settings.packagePrices.growth,
      currency: settings.defaultCurrency,
      summary:
        "A fuller service-led website designed around customer questions and conversion.",
      scope: {
        pages: pages.slice(0, 7),
        features: features.slice(0, 6),
        revisions: 2,
      },
      terms: commonTerms,
    },
    {
      packageKey: "booking",
      title: "Booking or catalog package",
      amount: settings.packagePrices.booking,
      currency: settings.defaultCurrency,
      summary:
        "A higher-interaction website scope for appointments, enquiries, menus, or catalogs.",
      scope: {
        pages,
        features: [
          ...new Set([
            ...features,
            "Booking or structured enquiry workflow",
            "Analytics and conversion tracking",
          ]),
        ],
        revisions: 2,
      },
      terms: commonTerms,
    },
  ].map((proposal) => ({
    ...proposal,
    leadName: lead.name,
    status: "draft",
    createdAt: new Date().toISOString(),
  }));
}

export function buildDeliveryChecklist(proposal) {
  const base = [
    ["Agreement", "Written scope approved"],
    ["Agreement", "Deposit received"],
    ["Discovery", "Business goals and primary customer confirmed"],
    ["Content", "Business details, services, prices, and policies received"],
    ["Content", "Approved logo and image rights confirmed"],
    ["Content", "Domain and hosting ownership agreed"],
    ["External build", "Website implementation started outside LocalLens"],
    ["Review", "Client review link delivered"],
    [
      "Review",
      `Included revision rounds completed (${proposal.scope?.revisions || 1})`,
    ],
    ["Handover", "Final approval recorded"],
    ["Handover", "Domain, hosting, analytics, and admin access handed over"],
    ["Handover", "Backup and maintenance instructions delivered"],
    ["Maintenance", "Maintenance option accepted or declined"],
  ];
  return base.map(([phase, label]) => ({ phase, label, completed: false }));
}
