export type LeadStatus =
  | "new"
  | "verification_required"
  | "qualified"
  | "contacted"
  | "replied"
  | "meeting_scheduled"
  | "proposal_draft"
  | "proposal_sent"
  | "deposit_received"
  | "building"
  | "client_review"
  | "delivered"
  | "maintenance"
  | "won"
  | "lost"
  | "archived";

export interface CrmFields {
  status: LeadStatus;
  saved: boolean;
  contactPerson: string;
  contactMethod: string;
  contactValue: string;
  notes: string;
  doNotContact: boolean;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  proposalAmount: number | null;
  proposalCurrency: string;
  outcomeReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  phone: string | null;
  website: string | null;
  address: string;
  location: { lat: number; lng: number };
  mapsUrl: string;
  opportunityScore: number;
  websiteEvidence: "not_listed" | "listed";
  verificationStatus: "needs_verification" | "not_needed";
  recommendation: { type: string; features: string[]; angle: string };
  reasons: string[];
  rejectionReasons: string[];
  querySources?: string[];
  crm?: CrmFields;
  commercialScore?: {
    score: number;
    tier: "priority" | "strong" | "possible" | "low";
    factors: Array<{ label: string; points: number; evidence: string }>;
  };
}

export interface BusinessAnalysis {
  executiveSummary: string;
  confidence: "low" | "medium" | "high";
  websiteVerdict:
    | "strong_opportunity"
    | "possible_opportunity"
    | "verify_first"
    | "not_recommended";
  digitalMaturity:
    "minimal" | "basic" | "developing" | "established" | "unknown";
  targetCustomers: string[];
  businessStrengths: string[];
  digitalGaps: string[];
  competitors: Array<{
    name: string;
    digitalAdvantage: string;
    lesson: string;
  }>;
  opportunities: Array<{
    title: string;
    impact: "high" | "medium" | "low";
    rationale: string;
  }>;
  recommendedBuild: {
    type: string;
    goal: string;
    pages: string[];
    features: string[];
    integrations: string[];
    localSeoTopics: string[];
    contentNeeded: string[];
  };
  priorityActions: Array<{ priority: number; action: string; reason: string }>;
  outreachAngle: string;
  caveats: string[];
  sources: Array<{ title: string; url: string; placeId?: string | null }>;
  grounded: boolean;
  model: string;
  providerSource: string;
  generatedAt: string;
  durationMs: number;
}

export interface WebsiteVerification {
  verdict:
    | "confirmed_no_owned_website"
    | "social_only"
    | "broken_or_outdated_website"
    | "owned_website_found"
    | "manual_verification_required";
  confidence: "low" | "medium" | "high";
  officialWebsiteFound: boolean;
  officialWebsiteUrl: string | null;
  summary: string;
  candidatePresences: Array<{
    url: string;
    classification: string;
    rationale: string;
  }>;
  evidence: string[];
  riskFlags: string[];
  recommendedNextStep: string;
  sources: Array<{ title: string; url: string }>;
  grounded: boolean;
  model: string;
  generatedAt: string;
  durationMs: number;
}

export interface OutreachDrafts {
  emailSubject: string;
  emailBody: string;
  whatsappMessage: string;
  phoneOpening: string;
  followUpMessage: string;
  meetingQuestions: string[];
  objectionResponses: Array<{ objection: string; response: string }>;
  claimsToAvoid: string[];
}

export interface Proposal {
  id?: number;
  leadId?: string;
  packageKey: string;
  title: string;
  amount: number;
  currency: string;
  summary: string;
  scope: { pages: string[]; features: string[]; revisions: number };
  terms: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Activity {
  id: number;
  leadId: string;
  type: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
export interface DeliveryTask {
  id: number;
  leadId: string;
  label: string;
  phase: string;
  completed: boolean;
}

export interface LeadDetail {
  lead: Opportunity;
  analysis: BusinessAnalysis | null;
  verification: WebsiteVerification | null;
  activities: Activity[];
  proposals: Proposal[];
  deliveryTasks: DeliveryTask[];
}

export interface SearchResponse {
  query: {
    location: string;
    category: string;
    minRating: number;
    minReviews: number;
    depth: "quick" | "standard" | "deep";
  };
  provider: "demo" | "google";
  providerLabel: string;
  searchedCount: number;
  excludedCount: number;
  opportunities: Opportunity[];
  notice: string;
  diagnostics: {
    queriesExecuted: number;
    pagesFetched: number;
    rawResults: number;
    uniquePlaces: number;
    noWebsiteCandidates: number;
    queryPlan: Array<{ query: string; results: number; pages: number }>;
    rejectionSummary: Record<string, number>;
    cacheHit: boolean;
    durationMs: number;
  };
}

export interface RecentSearch {
  id: number;
  query: SearchResponse["query"];
  diagnostics: Partial<SearchResponse["diagnostics"]>;
  provider: "demo" | "google";
  cacheHit: boolean;
  createdAt: string;
}

export interface WorkspaceSummary {
  totalLeads: number;
  byStatus: Record<string, number>;
  dueFollowUps: number;
  doNotContact: number;
  proposals: Array<{ status: string; count: number; amount: number }>;
  usage: Record<string, { units: number; estimatedCostUsd: number }>;
  settings: {
    dailyPlacesRequestLimit: number;
    dailyGeminiCallLimit: number;
    searchCacheHours: number;
    defaultCurrency: string;
    packagePrices: { starter: number; growth: number; booking: number };
    followUpDays: number;
  };
}
