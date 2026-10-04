import "dotenv/config";
import crypto from "node:crypto";
import cors from "cors";
import express from "express";
import { qualifyAndRecommend } from "./agent.js";
import {
  analyzeBusiness,
  generateOutreachDrafts,
  verifyWebsitePresence,
} from "./gemini.js";
import { geminiProviderStatus } from "./novelforge-provider.js";
import {
  buildSearchPlan,
  demoSearch,
  googlePlacesSearch,
} from "./providers.js";
import {
  addActivity,
  assertWithinBudget,
  createBackup,
  dashboardSummary,
  deleteLead,
  exportAllData,
  getAnalysis,
  getCached,
  getLead,
  getProposal,
  getSettings,
  getVerification,
  listActivities,
  listDeliveryTasks,
  listLeads,
  listProposals,
  listRecentSearches,
  recordSearch,
  recordUsage,
  replaceDeliveryTasks,
  saveAnalysis,
  saveProposal,
  saveSettings,
  saveVerification,
  setCached,
  updateDeliveryTask,
  updateLead,
  upsertLead,
} from "./database.js";
import {
  buildDeliveryChecklist,
  buildProposalOptions,
  calculateCommercialScore,
} from "./workflows.js";
import { generatePdf } from "./pdf.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const allowedOrigins = new Set(
  (
    process.env.LOCALLENS_ALLOWED_ORIGINS ||
    "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
app.disable("x-powered-by");
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed."));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));

const apiToken = String(process.env.LOCALLENS_API_TOKEN || "").trim();
app.use("/api", (req, res, next) => {
  if (!apiToken || req.path === "/health") return next();
  const supplied = Buffer.from(String(req.get("x-locallens-token") || ""));
  const expected = Buffer.from(apiToken);
  if (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  )
    return next();
  return res.status(401).json({ error: "Authentication required." });
});

function cleanPlace(place) {
  if (!place?.id || !place?.name || !place?.category || !place?.address)
    throw new Error("A valid business place is required.");
  return {
    ...place,
    id: String(place.id).slice(0, 200),
    name: String(place.name).slice(0, 200),
    category: String(place.category).slice(0, 120),
    address: String(place.address).slice(0, 400),
    rating: Number(place.rating || 0),
    reviewCount: Number(place.reviewCount || 0),
    phone: place.phone ? String(place.phone).slice(0, 80) : null,
    website: place.website ? String(place.website).slice(0, 500) : null,
    mapsUrl: place.mapsUrl ? String(place.mapsUrl).slice(0, 1000) : null,
    location:
      place.location && Number.isFinite(Number(place.location.lat))
        ? { lat: Number(place.location.lat), lng: Number(place.location.lng) }
        : null,
    crm: undefined,
  };
}

function leadDetail(id) {
  const lead = getLead(id);
  if (!lead) return null;
  const analysis = getAnalysis(id);
  const verification = getVerification(id);
  return {
    lead: {
      ...lead,
      commercialScore: calculateCommercialScore(lead, verification, analysis),
    },
    analysis,
    verification,
    activities: listActivities(id),
    proposals: listProposals(id),
    deliveryTasks: listDeliveryTasks(id),
  };
}

app.get("/api/health", async (_req, res) =>
  res.json({
    ok: true,
    liveProviderConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    ai: await geminiProviderStatus(),
    storage: "SQLite",
  }),
);

app.post("/api/search", async (req, res) => {
  const location = String(req.body.location || "").trim();
  const category = String(req.body.category || "local businesses").trim();
  const minRating = Number(req.body.minRating ?? 4.5);
  const minReviews = Number(req.body.minReviews ?? 50);
  const depth = ["quick", "standard", "deep"].includes(req.body.depth)
    ? req.body.depth
    : "standard";
  const requestedProvider =
    req.body.provider === "google"
      ? "google"
      : req.body.provider === "demo"
        ? "demo"
        : "auto";
  if (!location)
    return res.status(400).json({ error: "A location is required." });
  if (minRating < 0 || minRating > 5 || minReviews < 0)
    return res.status(400).json({ error: "Invalid qualification thresholds." });
  const canUseGoogle = Boolean(process.env.GOOGLE_PLACES_API_KEY);
  const provider =
    requestedProvider === "google" && !canUseGoogle
      ? null
      : requestedProvider === "demo"
        ? "demo"
        : canUseGoogle
          ? "google"
          : "demo";
  if (!provider)
    return res.status(503).json({
      error:
        "Google Places is not configured. Add GOOGLE_PLACES_API_KEY or use demo mode.",
    });

  try {
    const startedAt = Date.now();
    const settings = getSettings();
    const cacheKey = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          location: location.toLowerCase(),
          category: category.toLowerCase(),
          depth,
          provider,
        }),
      )
      .digest("hex");
    let providerResult = provider === "google" ? getCached(cacheKey) : null;
    const cacheHit = Boolean(providerResult);
    if (!providerResult) {
      if (provider === "google") {
        const plan = buildSearchPlan(category, depth);
        assertWithinBudget(
          "google_places",
          plan.queries.length * plan.pagesPerQuery,
        );
        providerResult = await googlePlacesSearch({
          location,
          category,
          apiKey: process.env.GOOGLE_PLACES_API_KEY,
          depth,
        });
        recordUsage(
          "google_places",
          "text_search",
          providerResult.diagnostics.pagesFetched,
        );
        setCached(cacheKey, providerResult, settings.searchCacheHours);
      } else
        providerResult = {
          places: demoSearch({ location, category }),
          diagnostics: {
            queriesExecuted: 1,
            pagesFetched: 1,
            rawResults: 8,
            uniquePlaces: 8,
            queryPlan: [{ query: "demo", results: 8, pages: 1 }],
          },
        };
    }
    const evaluated = providerResult.places.map((place) =>
      qualifyAndRecommend(place, { minRating, minReviews }),
    );
    const opportunities = evaluated
      .filter((place) => place.qualifies)
      .map((place) => ({
        ...place,
        commercialScore: calculateCommercialScore(place),
      }))
      .sort((a, b) => b.commercialScore.score - a.commercialScore.score);
    const rejectionSummary = evaluated
      .flatMap((place) => place.rejectionReasons)
      .reduce(
        (counts, reason) => ({
          ...counts,
          [reason]: (counts[reason] || 0) + 1,
        }),
        {},
      );
    const noWebsiteCandidates = evaluated.filter(
      (place) => place.websiteEvidence === "not_listed",
    ).length;
    const query = { location, category, minRating, minReviews, depth };
    const diagnostics = {
      ...providerResult.diagnostics,
      noWebsiteCandidates,
      rejectionSummary,
      cacheHit,
      durationMs: Date.now() - startedAt,
    };
    recordSearch(query, diagnostics, provider, cacheHit);
    res.json({
      query,
      provider,
      providerLabel:
        provider === "google" ? "Google Places API (New)" : "Demo dataset",
      searchedCount: providerResult.places.length,
      excludedCount: evaluated.length - opportunities.length,
      opportunities,
      diagnostics,
      notice:
        provider === "demo"
          ? "Demonstration results are fictional. Configure Google Places for live discovery."
          : `Missing listing website is a lead signal, not final proof. ${cacheHit ? "Results came from the local cache." : "Verify independently before outreach."}`,
    });
  } catch (error) {
    console.error("[search]", error.message);
    res
      .status(502)
      .json({ error: error.message || "The place provider request failed." });
  }
});

app.get("/api/searches", (req, res) =>
  res.json({ searches: listRecentSearches(req.query.limit) }),
);

app.get("/api/leads", (_req, res) => res.json({ leads: listLeads() }));
app.post("/api/leads", (req, res) => {
  try {
    const lead = upsertLead(cleanPlace(req.body.lead), req.body.crm || {});
    addActivity(lead.id, "saved", "Lead saved to the local workspace");
    res.json({ lead });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post("/api/leads/import", (req, res) => {
  try {
    const imported = (req.body.leads || [])
      .slice(0, 1000)
      .map((lead) => upsertLead(cleanPlace(lead), lead.crm || {}));
    res.json({ imported: imported.length, leads: imported });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.get("/api/leads/:id", (req, res) => {
  const detail = leadDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: "Lead not found." });
  res.json(detail);
});
app.patch("/api/leads/:id", (req, res) => {
  const allowed = [
    "status",
    "saved",
    "contactPerson",
    "contactMethod",
    "contactValue",
    "notes",
    "doNotContact",
    "lastContactedAt",
    "nextFollowUpAt",
    "proposalAmount",
    "proposalCurrency",
    "outcomeReason",
  ];
  const patch = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowed.includes(key)),
  );
  const lead = updateLead(req.params.id, patch);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  addActivity(
    lead.id,
    "lead_updated",
    req.body.activityNote || "Lead details updated",
    patch,
  );
  res.json({ lead });
});
app.delete("/api/leads/:id", (req, res) =>
  res.json({ deleted: deleteLead(req.params.id) }),
);
app.get("/api/leads/:id/activities", (req, res) =>
  res.json({ activities: listActivities(req.params.id) }),
);
app.post("/api/leads/:id/activities", (req, res) => {
  if (!getLead(req.params.id))
    return res.status(404).json({ error: "Lead not found." });
  res.json({
    activity: addActivity(
      req.params.id,
      String(req.body.type || "note").slice(0, 50),
      String(req.body.note || "").slice(0, 2000),
      req.body.metadata || {},
    ),
  });
});

app.post("/api/analyze", async (req, res) => {
  try {
    const place = cleanPlace(req.body?.place);
    assertWithinBudget("gemini", 2);
    const analysis = await analyzeBusiness(place);
    recordUsage("gemini", "business_analysis", analysis.callCount || 2);
    saveAnalysis(place, analysis);
    addActivity(place.id, "ai_analysis", "Gemini business strategy generated", {
      model: analysis.model,
      grounded: analysis.grounded,
    });
    res.json({
      analysis,
      commercialScore: calculateCommercialScore(
        place,
        getVerification(place.id),
        analysis,
      ),
    });
  } catch (error) {
    console.error("[analysis]", error.message);
    res
      .status(502)
      .json({ error: error.message || "Gemini business analysis failed." });
  }
});
app.post("/api/verify", async (req, res) => {
  try {
    const place = cleanPlace(req.body?.place);
    assertWithinBudget("gemini", 2);
    const verification = await verifyWebsitePresence(place);
    recordUsage("gemini", "website_verification", verification.callCount || 2);
    saveVerification(place, verification);
    const suggestedStatus = [
      "confirmed_no_owned_website",
      "social_only",
      "broken_or_outdated_website",
    ].includes(verification.verdict)
      ? "qualified"
      : "verification_required";
    updateLead(place.id, { status: suggestedStatus });
    addActivity(place.id, "website_verification", verification.summary, {
      verdict: verification.verdict,
      confidence: verification.confidence,
    });
    res.json({
      verification,
      lead: getLead(place.id),
      commercialScore: calculateCommercialScore(
        place,
        verification,
        getAnalysis(place.id),
      ),
    });
  } catch (error) {
    console.error("[verification]", error.message);
    res
      .status(502)
      .json({ error: error.message || "Website verification failed." });
  }
});
app.post("/api/leads/:id/outreach", async (req, res) => {
  try {
    const lead = getLead(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    if (lead.crm.doNotContact)
      return res
        .status(409)
        .json({ error: "This lead is marked do not contact." });
    assertWithinBudget("gemini", 1);
    const drafts = await generateOutreachDrafts(
      lead,
      getAnalysis(lead.id),
      getVerification(lead.id),
    );
    recordUsage("gemini", "outreach_drafts", drafts.callCount || 1);
    addActivity(
      lead.id,
      "outreach_drafts",
      "Manual-review outreach drafts generated",
      drafts,
    );
    res.json({ drafts });
  } catch (error) {
    res
      .status(502)
      .json({ error: error.message || "Outreach draft generation failed." });
  }
});

app.get("/api/leads/:id/proposals/options", (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  res.json({
    options: buildProposalOptions(lead, getAnalysis(lead.id), getSettings()),
  });
});
app.get("/api/leads/:id/proposals", (req, res) =>
  res.json({ proposals: listProposals(req.params.id) }),
);
app.post("/api/leads/:id/proposals", (req, res) => {
  const lead = getLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  const proposal = saveProposal(lead, req.body.proposal);
  updateLead(lead.id, {
    status: "proposal_draft",
    proposalAmount: proposal.amount,
    proposalCurrency: proposal.currency,
  });
  addActivity(
    lead.id,
    "proposal_saved",
    `${proposal.title} proposal draft saved`,
    {
      proposalId: proposal.id,
      amount: proposal.amount,
      currency: proposal.currency,
    },
  );
  res.json({ proposal });
});
app.post("/api/leads/:id/delivery-checklist", (req, res) => {
  const proposal = getProposal(Number(req.body.proposalId));
  if (!proposal || proposal.leadId !== req.params.id)
    return res.status(404).json({ error: "Proposal not found." });
  const tasks = replaceDeliveryTasks(
    req.params.id,
    buildDeliveryChecklist(proposal),
  );
  addActivity(
    req.params.id,
    "delivery_checklist",
    "External website delivery checklist created",
    { proposalId: proposal.id },
  );
  res.json({ tasks });
});
app.patch("/api/delivery-tasks/:id", (req, res) =>
  res.json({
    task: updateDeliveryTask(
      Number(req.params.id),
      Boolean(req.body.completed),
    ),
  }),
);

app.get("/api/dashboard", (_req, res) => res.json(dashboardSummary()));
app.get("/api/settings", (_req, res) => res.json({ settings: getSettings() }));
app.put("/api/settings", (req, res) =>
  res.json({ settings: saveSettings(req.body || {}) }),
);
app.post("/api/backup", (_req, res) => res.json({ backup: createBackup() }));
app.get("/api/export", (_req, res) => {
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="locallens-backup-${new Date().toISOString().slice(0, 10)}.json"`,
  );
  res.json(exportAllData());
});
app.get("/api/leads/:id/dossier.pdf", (req, res) => {
  try {
    const detail = leadDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "Lead not found." });
    const document = generatePdf("dossier", {
      ...detail,
      commercialScore: detail.lead.commercialScore,
    });
    addActivity(
      req.params.id,
      "dossier_exported",
      "Opportunity dossier PDF generated",
      { filename: document.filename },
    );
    res.download(document.outputPath, document.filename);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/proposals/:id/proposal.pdf", (req, res) => {
  try {
    const proposal = getProposal(Number(req.params.id));
    if (!proposal)
      return res.status(404).json({ error: "Proposal not found." });
    const lead = getLead(proposal.leadId);
    const document = generatePdf("proposal", { lead, proposal });
    addActivity(lead.id, "proposal_exported", "Proposal PDF generated", {
      proposalId: proposal.id,
      filename: document.filename,
    });
    res.download(document.outputPath, document.filename);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, host, () =>
  console.log(`LocalLens API listening on http://${host}:${port}`),
);
