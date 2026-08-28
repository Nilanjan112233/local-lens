import { GoogleGenAI } from "@google/genai";
import { resolveGeminiProvider } from "./novelforge-provider.js";

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    websiteVerdict: {
      type: "string",
      enum: [
        "strong_opportunity",
        "possible_opportunity",
        "verify_first",
        "not_recommended",
      ],
    },
    digitalMaturity: {
      type: "string",
      enum: ["minimal", "basic", "developing", "established", "unknown"],
    },
    targetCustomers: { type: "array", items: { type: "string" } },
    businessStrengths: { type: "array", items: { type: "string" } },
    digitalGaps: { type: "array", items: { type: "string" } },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          digitalAdvantage: { type: "string" },
          lesson: { type: "string" },
        },
        required: ["name", "digitalAdvantage", "lesson"],
      },
    },
    opportunities: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          rationale: { type: "string" },
        },
        required: ["title", "impact", "rationale"],
      },
    },
    recommendedBuild: {
      type: "object",
      properties: {
        type: { type: "string" },
        goal: { type: "string" },
        pages: { type: "array", items: { type: "string" } },
        features: { type: "array", items: { type: "string" } },
        integrations: { type: "array", items: { type: "string" } },
        localSeoTopics: { type: "array", items: { type: "string" } },
        contentNeeded: { type: "array", items: { type: "string" } },
      },
      required: [
        "type",
        "goal",
        "pages",
        "features",
        "integrations",
        "localSeoTopics",
        "contentNeeded",
      ],
    },
    priorityActions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          priority: { type: "integer" },
          action: { type: "string" },
          reason: { type: "string" },
        },
        required: ["priority", "action", "reason"],
      },
    },
    outreachAngle: { type: "string" },
    caveats: { type: "array", items: { type: "string" } },
  },
  required: [
    "executiveSummary",
    "confidence",
    "websiteVerdict",
    "digitalMaturity",
    "targetCustomers",
    "businessStrengths",
    "digitalGaps",
    "competitors",
    "opportunities",
    "recommendedBuild",
    "priorityActions",
    "outreachAngle",
    "caveats",
  ],
};

function cleanJson(text) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

function groundingSources(response) {
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  return chunks.flatMap((chunk) => {
    const source = chunk.maps;
    if (!source?.uri || seen.has(source.uri)) return [];
    seen.add(source.uri);
    return [
      {
        title: source.title || "Google Maps source",
        url: source.uri,
        placeId: source.placeId || null,
      },
    ];
  });
}

function promptFor(place) {
  return `You are a local-business digital strategy analyst. Analyze this exact business and produce a practical, evidence-conscious opportunity brief for a web design and digital growth team.

Business listing supplied by the application:
${JSON.stringify({ name: place.name, category: place.category, address: place.address, rating: place.rating, reviewCount: place.reviewCount, phone: place.phone, websiteListed: Boolean(place.website), googleMapsUrl: place.mapsUrl })}

Use Google Maps grounding to identify the correct place, understand public customer signals, offerings, operational context, and up to three relevant nearby competitors with a stronger digital presence. Never claim that the business has no website solely because the listing field is empty. Distinguish facts from recommendations. Do not invent revenue, owner identity, email, prices, or precise demand. Recommend only capabilities that fit this category and observed evidence.

Return JSON only. The JSON must match the requested schema. Keep array items concrete and concise. Include website scope, conversion features, local SEO subjects, content needed from the owner, priority actions, caveats, and a respectful outreach angle.`;
}

const VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: [
        "confirmed_no_owned_website",
        "social_only",
        "broken_or_outdated_website",
        "owned_website_found",
        "manual_verification_required",
      ],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    officialWebsiteFound: { type: "boolean" },
    officialWebsiteUrl: { type: ["string", "null"] },
    summary: { type: "string" },
    candidatePresences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          classification: {
            type: "string",
            enum: [
              "official",
              "possible_official",
              "social",
              "directory",
              "marketplace",
              "unrelated",
            ],
          },
          rationale: { type: "string" },
        },
        required: ["url", "classification", "rationale"],
      },
    },
    evidence: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    recommendedNextStep: { type: "string" },
  },
  required: [
    "verdict",
    "confidence",
    "officialWebsiteFound",
    "officialWebsiteUrl",
    "summary",
    "candidatePresences",
    "evidence",
    "riskFlags",
    "recommendedNextStep",
  ],
};

const OUTREACH_SCHEMA = {
  type: "object",
  properties: {
    emailSubject: { type: "string" },
    emailBody: { type: "string" },
    whatsappMessage: { type: "string" },
    phoneOpening: { type: "string" },
    followUpMessage: { type: "string" },
    meetingQuestions: { type: "array", items: { type: "string" } },
    objectionResponses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          objection: { type: "string" },
          response: { type: "string" },
        },
        required: ["objection", "response"],
      },
    },
    claimsToAvoid: { type: "array", items: { type: "string" } },
  },
  required: [
    "emailSubject",
    "emailBody",
    "whatsappMessage",
    "phoneOpening",
    "followUpMessage",
    "meetingQuestions",
    "objectionResponses",
    "claimsToAvoid",
  ],
};

function webGroundingSources(response) {
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();
  return chunks.flatMap((chunk) => {
    const source = chunk.web;
    if (!source?.uri || seen.has(source.uri)) return [];
    seen.add(source.uri);
    return [{ title: source.title || "Web source", url: source.uri }];
  });
}

export async function verifyWebsitePresence(place) {
  const provider = await resolveGeminiProvider();
  const ai = new GoogleGenAI({ apiKey: provider.apiKey });
  const startedAt = Date.now();
  let research = null;
  try {
    research = await ai.models.generateContent({
      model: provider.model,
      contents: `Find the official online presence for this exact local business: ${place.name}, ${place.address}, phone ${place.phone || "not supplied"}. Search by name, address, and phone. Determine whether it has an independently owned official domain. Separate official sites from Facebook, Instagram, Google Maps, directories, marketplaces, similarly named businesses, and abandoned domains. Do not guess. Summarize evidence and candidate URLs.`,
      config: { temperature: 0.1, tools: [{ googleSearch: {} }] },
    });
  } catch (error) {
    console.warn(
      "[verification] Google Search grounding unavailable:",
      error.message,
    );
  }
  const sources = research ? webGroundingSources(research) : [];
  const response = await ai.models.generateContent({
    model: provider.model,
    contents: `Classify the website presence of this exact business using only the supplied listing and research notes.
Listing: ${JSON.stringify({ name: place.name, address: place.address, phone: place.phone, websiteListed: place.website || null, mapsUrl: place.mapsUrl })}
Grounded research notes: ${research?.text || "Unavailable"}
Source titles: ${sources.map((source) => source.title).join(", ") || "none"}
An empty Maps website field is not proof. Use manual_verification_required when evidence is insufficient. Return strict JSON.`,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseJsonSchema: VERIFICATION_SCHEMA,
    },
  });
  return {
    ...JSON.parse(cleanJson(response.text || "{}")),
    sources,
    grounded: sources.length > 0,
    model: provider.model,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    callCount: research ? 2 : 1,
  };
}

export async function generateOutreachDrafts(place, analysis, verification) {
  const provider = await resolveGeminiProvider();
  const ai = new GoogleGenAI({ apiKey: provider.apiKey });
  const response = await ai.models.generateContent({
    model: provider.model,
    contents: `Prepare respectful, individualized outreach drafts for a freelance website professional contacting a local business. The operator will review and manually send any message. Never shame the owner, imply guaranteed revenue, claim an existing relationship, or invent facts. Mention one genuine strength before the digital opportunity. Keep WhatsApp concise and the email under 170 words. Include an easy opt-out.
Business: ${JSON.stringify({ name: place.name, category: place.category, address: place.address, rating: place.rating, reviewCount: place.reviewCount })}
Verification: ${JSON.stringify(verification || {})}
Strategy: ${JSON.stringify({ summary: analysis?.executiveSummary, gaps: analysis?.digitalGaps, build: analysis?.recommendedBuild, angle: analysis?.outreachAngle })}
Return strict JSON.`,
    config: {
      temperature: 0.35,
      responseMimeType: "application/json",
      responseJsonSchema: OUTREACH_SCHEMA,
    },
  });
  return {
    ...JSON.parse(cleanJson(response.text || "{}")),
    model: provider.model,
    generatedAt: new Date().toISOString(),
    callCount: 1,
  };
}

export async function analyzeBusiness(place) {
  const provider = await resolveGeminiProvider();
  const ai = new GoogleGenAI({ apiKey: provider.apiKey });
  const startedAt = Date.now();
  let groundedResponse = null;
  let groundedResearch = "";
  try {
    groundedResponse = await ai.models.generateContent({
      model: provider.model,
      contents: `Research the exact business "${place.name}" at "${place.address}" using Google Maps. Identify the matching place, then summarize public evidence relevant to its services, customer needs, differentiators, reputation themes, operating context, and digital opportunities. Do not infer an official website from absence alone. If the exact place cannot be identified, say so. Use Google Maps evidence and clearly mark uncertainty.`,
      config: {
        temperature: 0.25,
        tools: [{ googleMaps: {} }],
        toolConfig: place.location?.lat
          ? {
              retrievalConfig: {
                latLng: {
                  latitude: place.location.lat,
                  longitude: place.location.lng,
                },
              },
            }
          : undefined,
      },
    });
    groundedResearch = groundedResponse.text || "";
  } catch (error) {
    console.warn(
      "[analysis] Google Maps grounding unavailable; using listing data only:",
      error.message,
    );
  }
  const sources = groundedResponse ? groundingSources(groundedResponse) : [];
  const synthesisPrompt = `${promptFor(place)}

${groundedResearch ? `Google Maps grounded research notes:\n${groundedResearch}` : "Google Maps grounding was unavailable. Base the analysis only on supplied listing data and add that limitation to caveats."}

Source names available to the operator: ${sources.map((source) => source.title).join(", ") || "none"}.
Now synthesize the final strategy as strict JSON. Do not add claims beyond the supplied listing and grounded notes.`;
  const response = await ai.models.generateContent({
    model: provider.model,
    contents: synthesisPrompt,
    config: {
      temperature: 0.25,
      responseMimeType: "application/json",
      responseJsonSchema: ANALYSIS_SCHEMA,
    },
  });
  const analysis = JSON.parse(cleanJson(response.text || "{}"));
  return {
    ...analysis,
    sources,
    grounded: sources.length > 0,
    model: provider.model,
    providerSource: provider.source,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  };
}
