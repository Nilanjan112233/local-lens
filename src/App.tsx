import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  BrainCircuit,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Download,
  ExternalLink,
  FileText,
  Globe2,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquareText,
  Phone,
  Radar,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import type {
  Activity,
  BusinessAnalysis,
  CrmFields,
  DeliveryTask,
  LeadDetail,
  LeadStatus,
  Opportunity,
  OutreachDrafts,
  Proposal,
  RecentSearch,
  SearchResponse,
  WebsiteVerification,
  WorkspaceSummary,
} from "./types";

type View =
  "today" | "discover" | "pipeline" | "saved" | "analytics" | "settings";
type DrawerTab =
  | "overview"
  | "verification"
  | "strategy"
  | "crm"
  | "outreach"
  | "proposal"
  | "delivery";

const categories = [
  "All businesses",
  "Restaurant",
  "Cafe",
  "Salon",
  "Dentist",
  "Clinic",
  "Gym",
  "Contractor",
  "Store",
  "Photographer",
  "Event planner",
  "Pet groomer",
];
const stages: Array<{ value: LeadStatus; label: string }> = [
  ["new", "New"],
  ["verification_required", "Verification required"],
  ["qualified", "Qualified"],
  ["contacted", "Contacted"],
  ["replied", "Replied"],
  ["meeting_scheduled", "Meeting scheduled"],
  ["proposal_draft", "Proposal draft"],
  ["proposal_sent", "Proposal sent"],
  ["deposit_received", "Deposit received"],
  ["building", "Building externally"],
  ["client_review", "Client review"],
  ["delivered", "Delivered"],
  ["maintenance", "Maintenance"],
  ["won", "Won"],
  ["lost", "Lost"],
  ["archived", "Archived"],
].map(([value, label]) => ({ value: value as LeadStatus, label }));

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function MapFocus({ lead }: { lead: Opportunity | null }) {
  const map = useMap();
  useEffect(() => {
    if (lead?.location?.lat)
      map.flyTo([lead.location.lat, lead.location.lng], 15, { duration: 0.8 });
  }, [lead, map]);
  return null;
}

function Score({ value }: { value: number }) {
  return (
    <div
      className="score-ring"
      style={{ "--score": `${value * 3.6}deg` } as React.CSSProperties}
    >
      <span>{value}</span>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <Search size={28} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("discover");
  const [location, setLocation] = useState("Kolkata, India");
  const [category, setCategory] = useState("All businesses");
  const [minRating, setMinRating] = useState(4.5);
  const [minReviews, setMinReviews] = useState(50);
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("overview");
  const [crmDraft, setCrmDraft] = useState<Partial<CrmFields>>({});
  const [outreach, setOutreach] = useState<OutreachDrafts | null>(null);
  const [proposalOptions, setProposalOptions] = useState<Proposal[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<
    WorkspaceSummary["settings"] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [leadFilter, setLeadFilter] = useState("");
  const [leadSort, setLeadSort] = useState<
    "score" | "rating" | "reviews" | "followup"
  >("score");

  async function refreshWorkspace() {
    const [leadData, dashboard, searchData] = await Promise.all([
      api<{ leads: Opportunity[] }>("/api/leads"),
      api<WorkspaceSummary>("/api/dashboard"),
      api<{ searches: RecentSearch[] }>("/api/searches?limit=6"),
    ]);
    setLeads(leadData.leads);
    setSummary(dashboard);
    setSettingsDraft(dashboard.settings);
    setRecentSearches(searchData.searches);
  }

  useEffect(() => {
    (async () => {
      try {
        const legacy = JSON.parse(
          localStorage.getItem("locallens-saved") || "{}",
        );
        if (
          !localStorage.getItem("locallens-sqlite-migrated") &&
          Object.keys(legacy).length
        ) {
          await api("/api/leads/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leads: Object.values(legacy) }),
          });
          localStorage.setItem("locallens-sqlite-migrated", "true");
        }
        await refreshWorkspace();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Workspace loading failed",
        );
      }
    })();
  }, []);

  async function searchPlaces(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setSelected(null);
    try {
      const data = await api<SearchResponse>("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          category,
          minRating,
          minReviews,
          depth,
          provider: "auto",
        }),
      });
      setResult(data);
      const searchData = await api<{ searches: RecentSearch[] }>(
        "/api/searches?limit=6",
      );
      setRecentSearches(searchData.searches);
      setView("discover");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function repeatSearch(search: RecentSearch) {
    setLocation(search.query.location);
    setCategory(search.query.category);
    setMinRating(search.query.minRating);
    setMinReviews(search.query.minReviews);
    setDepth(search.query.depth);
    setNotice("Previous search loaded. Review the limits, then run it again.");
  }

  async function selectLead(lead: Opportunity) {
    setSelected(lead);
    setDrawerTab("overview");
    setOutreach(null);
    setProposalOptions([]);
    setError("");
    const saved = leads.find((item) => item.id === lead.id);
    if (!saved) {
      setDetail({
        lead,
        analysis: null,
        verification: null,
        activities: [],
        proposals: [],
        deliveryTasks: [],
      });
      setCrmDraft({ status: "new", saved: true });
      return;
    }
    try {
      const data = await api<LeadDetail>(
        `/api/leads/${encodeURIComponent(lead.id)}`,
      );
      setDetail(data);
      setCrmDraft(data.lead.crm || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lead details failed");
    }
  }

  async function reloadSelected(id = selected?.id) {
    if (!id) return;
    const data = await api<LeadDetail>(`/api/leads/${encodeURIComponent(id)}`);
    setDetail(data);
    setSelected(data.lead);
    setCrmDraft(data.lead.crm || {});
    await refreshWorkspace();
  }

  async function saveLead(lead = selected) {
    if (!lead) return;
    setActionLoading("save");
    try {
      await api("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, crm: crmDraft }),
      });
      await reloadSelected(lead.id);
      setNotice("Lead saved to SQLite.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setActionLoading("");
    }
  }

  async function saveCrm(changes: Partial<CrmFields> = crmDraft) {
    if (!selected) return;
    if (!leads.some((lead) => lead.id === selected.id))
      await saveLead(selected);
    setActionLoading("crm");
    try {
      await api(`/api/leads/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...changes,
          activityNote: "CRM details updated",
        }),
      });
      await reloadSelected();
      setNotice("CRM and follow-up details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CRM update failed");
    } finally {
      setActionLoading("");
    }
  }

  async function verifySelected() {
    if (!selected) return;
    setActionLoading("verify");
    setError("");
    try {
      await api("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place: selected }),
      });
      await reloadSelected();
      setDrawerTab("verification");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setActionLoading("");
    }
  }

  async function analyzeSelected() {
    if (!selected) return;
    setActionLoading("analysis");
    setError("");
    try {
      await api("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place: selected }),
      });
      await reloadSelected();
      setDrawerTab("strategy");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setActionLoading("");
    }
  }

  async function generateOutreach() {
    if (!selected) return;
    if (!leads.some((lead) => lead.id === selected.id))
      await saveLead(selected);
    setActionLoading("outreach");
    setError("");
    try {
      const data = await api<{ drafts: OutreachDrafts }>(
        `/api/leads/${encodeURIComponent(selected.id)}/outreach`,
        { method: "POST" },
      );
      setOutreach(data.drafts);
      setDrawerTab("outreach");
      await reloadSelected();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Outreach generation failed",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function loadProposalOptions() {
    if (!selected) return;
    if (!leads.some((lead) => lead.id === selected.id))
      await saveLead(selected);
    setActionLoading("proposal");
    try {
      const data = await api<{ options: Proposal[] }>(
        `/api/leads/${encodeURIComponent(selected.id)}/proposals/options`,
      );
      setProposalOptions(data.options);
      setDrawerTab("proposal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proposal options failed");
    } finally {
      setActionLoading("");
    }
  }

  async function saveProposalOption(proposal: Proposal) {
    if (!selected) return;
    setActionLoading(`proposal-${proposal.packageKey}`);
    try {
      await api(`/api/leads/${encodeURIComponent(selected.id)}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      await reloadSelected();
      setNotice(
        "Proposal saved. Review it before presenting it to the client.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Proposal save failed");
    } finally {
      setActionLoading("");
    }
  }

  async function createChecklist(proposal: Proposal) {
    if (!selected || !proposal.id) return;
    setActionLoading("checklist");
    try {
      await api(
        `/api/leads/${encodeURIComponent(selected.id)}/delivery-checklist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId: proposal.id }),
        },
      );
      await reloadSelected();
      setDrawerTab("delivery");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Checklist creation failed",
      );
    } finally {
      setActionLoading("");
    }
  }

  async function toggleTask(task: DeliveryTask) {
    await api(`/api/delivery-tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    await reloadSelected();
  }

  async function markContacted() {
    const next = new Date(
      Date.now() + (summary?.settings.followUpDays || 3) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    await saveCrm({
      ...crmDraft,
      status: "contacted",
      lastContactedAt: new Date().toISOString(),
      nextFollowUpAt: next,
    });
  }

  async function saveWorkspaceSettings() {
    if (!settingsDraft) return;
    setActionLoading("settings");
    try {
      const data = await api<{ settings: WorkspaceSummary["settings"] }>(
        "/api/settings",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settingsDraft),
        },
      );
      setSettingsDraft(data.settings);
      await refreshWorkspace();
      setNotice("Local limits and package defaults saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settings save failed");
    } finally {
      setActionLoading("");
    }
  }

  const displayedLeads = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (view === "discover") return result?.opportunities || [];
    if (view === "today")
      return leads.filter(
        (lead) =>
          (lead.crm?.nextFollowUpAt &&
            lead.crm.nextFollowUpAt.slice(0, 10) <= today) ||
          ["verification_required", "qualified", "replied"].includes(
            lead.crm?.status || "",
          ),
      );
    if (view === "pipeline")
      return leads.filter(
        (lead) => !["archived", "lost"].includes(lead.crm?.status || "new"),
      );
    return leads;
  }, [view, result, leads]);

  const visibleLeads = useMemo(() => {
    const term = leadFilter.trim().toLowerCase();
    const filtered = term
      ? displayedLeads.filter((lead) =>
          [
            lead.name,
            lead.category,
            lead.address,
            lead.crm?.status,
            lead.crm?.contactPerson,
            lead.crm?.contactValue,
            lead.crm?.notes,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term)),
        )
      : displayedLeads;
    return [...filtered].sort((a, b) => {
      if (leadSort === "rating") return b.rating - a.rating;
      if (leadSort === "reviews") return b.reviewCount - a.reviewCount;
      if (leadSort === "followup")
        return String(a.crm?.nextFollowUpAt || "9999").localeCompare(
          String(b.crm?.nextFollowUpAt || "9999"),
        );
      return (
        (b.commercialScore?.score || b.opportunityScore) -
        (a.commercialScore?.score || a.opportunityScore)
      );
    });
  }, [displayedLeads, leadFilter, leadSort]);

  const averageRating = visibleLeads.length
    ? visibleLeads.reduce((sum, lead) => sum + lead.rating, 0) /
      visibleLeads.length
    : 0;
  const center = visibleLeads[0]?.location || { lat: 22.5726, lng: 88.3639 };
  const usesGoogleData =
    result?.provider === "google" ||
    visibleLeads.some((lead) => !lead.id.startsWith("demo-"));
  const viewTitle =
    view === "today"
      ? ["TODAY'S WORK", "Follow up on the right opportunities."]
      : view === "discover"
        ? ["OPPORTUNITY DISCOVERY", "Find businesses worth helping."]
        : view === "pipeline"
          ? ["QUALIFICATION PIPELINE", "Move evidence into action."]
          : view === "saved"
            ? ["SAVED RESEARCH", "Your private opportunity library."]
            : view === "analytics"
              ? ["INCOME WORKFLOW", "Measure activity, not vanity."]
              : ["LOCAL SETTINGS", "Control cost, packages, and backups."];

  function exportCsv() {
    if (!visibleLeads.length) return;
    const rows = [
      [
        "Business",
        "Category",
        "Rating",
        "Reviews",
        "Phone",
        "Address",
        "Score",
        "Status",
        "Follow up",
      ],
      ...visibleLeads.map((lead) => [
        lead.name,
        lead.category,
        lead.rating,
        lead.reviewCount,
        lead.phone || "",
        lead.address,
        lead.commercialScore?.score || lead.opportunityScore,
        lead.crm?.status || "new",
        lead.crm?.nextFollowUpAt || "",
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "locallens-opportunities.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Radar size={21} />
          </div>
          <span>LocalLens</span>
        </div>
        <button className="nav-close" onClick={() => setMobileNav(false)}>
          <X />
        </button>
        <nav>
          <button
            className={`nav-item ${view === "today" ? "active" : ""}`}
            onClick={() => setView("today")}
          >
            <CalendarClock size={19} /> Today{" "}
            <span className="nav-count">{summary?.dueFollowUps || 0}</span>
          </button>
          <button
            className={`nav-item ${view === "discover" ? "active" : ""}`}
            onClick={() => setView("discover")}
          >
            <LayoutDashboard size={19} /> Discover
          </button>
          <button
            className={`nav-item ${view === "pipeline" ? "active" : ""}`}
            onClick={() => setView("pipeline")}
          >
            <Target size={19} /> Pipeline{" "}
            <span className="nav-count">
              {
                leads.filter(
                  (lead) =>
                    !["archived", "lost"].includes(lead.crm?.status || "new"),
                ).length
              }
            </span>
          </button>
          <button
            className={`nav-item ${view === "saved" ? "active" : ""}`}
            onClick={() => setView("saved")}
          >
            <Building2 size={19} /> Saved places{" "}
            <span className="nav-count">{leads.length}</span>
          </button>
          <button
            className={`nav-item ${view === "analytics" ? "active" : ""}`}
            onClick={() => setView("analytics")}
          >
            <BarChart3 size={19} /> Analytics
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            <Settings size={19} /> Settings
          </button>
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={18} />
          <strong>Personal research only</strong>
          <p>
            LocalLens verifies, plans, and tracks. It never creates the client
            website or sends outreach automatically.
          </p>
        </div>
        <div className="profile">
          <div className="avatar">NS</div>
          <div>
            <strong>Private workspace</strong>
            <span>SQLite on this computer</span>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div>
            <span className="eyebrow">{viewTitle[0]}</span>
            <h1>{viewTitle[1]}</h1>
          </div>
          <button
            className="export-button"
            onClick={exportCsv}
            disabled={!visibleLeads.length}
          >
            <Download size={17} /> Export view
          </button>
        </header>
        {error && (
          <div className="error-banner global-banner">
            {error}
            <button onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        {notice && (
          <div className="success-banner">
            {notice}
            <button onClick={() => setNotice("")}>
              <X />
            </button>
          </div>
        )}

        {view === "discover" && (
          <section className="search-panel">
            <form onSubmit={searchPlaces}>
              <label className="location-field">
                <MapPin size={19} />
                <span>
                  <small>Search location</small>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </span>
              </label>
              <label>
                <small>Business type</small>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="compact-field">
                <small>Min. rating</small>
                <select
                  value={minRating}
                  onChange={(e) => setMinRating(Number(e.target.value))}
                >
                  <option>4</option>
                  <option>4.3</option>
                  <option>4.5</option>
                  <option>4.7</option>
                </select>
              </label>
              <label className="compact-field">
                <small>Min. reviews</small>
                <input
                  type="number"
                  min="0"
                  value={minReviews}
                  onChange={(e) => setMinReviews(Number(e.target.value))}
                />
              </label>
              <label className="compact-field">
                <small>Scan depth</small>
                <select
                  value={depth}
                  onChange={(e) => setDepth(e.target.value as typeof depth)}
                >
                  <option value="quick">Quick</option>
                  <option value="standard">Standard</option>
                  <option value="deep">Deep</option>
                </select>
              </label>
              <button className="search-button" disabled={loading}>
                <Search size={18} />
                {loading ? "Scanning…" : "Find opportunities"}
              </button>
            </form>
            {!!recentSearches.length && (
              <div className="recent-searches" aria-label="Recent searches">
                <span>Recent</span>
                {recentSearches.map((search) => (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => repeatSearch(search)}
                    title={`Load search from ${new Date(search.createdAt).toLocaleString()}`}
                  >
                    {search.query.category} · {search.query.location} ·{" "}
                    {search.diagnostics.uniquePlaces ?? 0} places
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {view !== "settings" && (
          <section className="metrics">
            <article>
              <div className="metric-icon mint">
                <Target />
              </div>
              <div>
                <span>
                  {view === "discover" ? "Opportunities" : "Leads in view"}
                </span>
                <strong>{visibleLeads.length || "—"}</strong>
                <small>
                  {view === "discover"
                    ? "commercially ranked"
                    : "stored locally"}
                </small>
              </div>
            </article>
            <article>
              <div className="metric-icon amber">
                <Star />
              </div>
              <div>
                <span>Average rating</span>
                <strong>
                  {averageRating ? averageRating.toFixed(1) : "—"}
                </strong>
                <small>customer proof</small>
              </div>
            </article>
            <article>
              <div className="metric-icon coral">
                <CalendarClock />
              </div>
              <div>
                <span>Follow-ups due</span>
                <strong>{summary?.dueFollowUps ?? "—"}</strong>
                <small>need your attention</small>
              </div>
            </article>
            <article>
              <div className="metric-icon violet">
                <CircleDollarSign />
              </div>
              <div>
                <span>Proposal value</span>
                <strong>
                  {summary
                    ? `${summary.settings.defaultCurrency} ${summary.proposals.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}`
                    : "—"}
                </strong>
                <small>recorded pipeline</small>
              </div>
            </article>
          </section>
        )}

        {view === "analytics" ? (
          <Analytics summary={summary} leads={leads} />
        ) : view === "settings" ? (
          <SettingsView
            summary={summary}
            draft={settingsDraft}
            setDraft={setSettingsDraft}
            save={saveWorkspaceSettings}
            loading={actionLoading === "settings"}
          />
        ) : (
          <section className="workspace-grid">
            <div className="results-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "discover"
                      ? "Best opportunities"
                      : view === "today"
                        ? "What should I do today?"
                        : view === "pipeline"
                          ? "Active pipeline"
                          : "Saved businesses"}
                  </h2>
                  <p>
                    {view === "discover" && result
                      ? `${result.diagnostics.uniquePlaces} unique · ${result.diagnostics.noWebsiteCandidates} no-site · ${result.diagnostics.cacheHit ? "cached" : "live"}`
                      : `${displayedLeads.length} businesses`}
                  </p>
                </div>
                <span className={`source-badge ${result?.provider || ""}`}>
                  <span />
                  {view === "discover"
                    ? result?.providerLabel || "Waiting"
                    : "Local SQLite"}
                </span>
              </div>
              <div className="lead-tools">
                <input
                  value={leadFilter}
                  onChange={(event) => setLeadFilter(event.target.value)}
                  placeholder="Filter by business, category, place, or status"
                  aria-label="Filter visible leads"
                />
                <select
                  value={leadSort}
                  onChange={(event) =>
                    setLeadSort(event.target.value as typeof leadSort)
                  }
                  aria-label="Sort visible leads"
                >
                  <option value="score">Best score</option>
                  <option value="rating">Highest rating</option>
                  <option value="reviews">Most reviews</option>
                  <option value="followup">Next follow-up</option>
                </select>
              </div>
              {view === "discover" && result && (
                <>
                  <div className="notice">
                    <Sparkles size={16} />
                    {result.notice}
                  </div>
                  <div className="funnel">
                    <span>
                      <strong>{result.diagnostics.rawResults}</strong> raw
                    </span>
                    <ChevronRight />
                    <span>
                      <strong>{result.diagnostics.uniquePlaces}</strong> unique
                    </span>
                    <ChevronRight />
                    <span>
                      <strong>{result.diagnostics.noWebsiteCandidates}</strong>{" "}
                      no-site
                    </span>
                    <ChevronRight />
                    <span className="success">
                      <strong>{result.opportunities.length}</strong> qualified
                    </span>
                  </div>
                </>
              )}
              <div className="lead-list">
                {loading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <div className="lead-card skeleton" key={index} />
                    ))
                  : visibleLeads.map((lead, index) => (
                      <article
                        className={`lead-card ${selected?.id === lead.id ? "selected" : ""}`}
                        key={lead.id}
                        onClick={() => selectLead(lead)}
                      >
                        <div className="rank">
                          {String(index + 1).padStart(2, "0")}
                        </div>
                        <div className="lead-main">
                          <div className="lead-title">
                            <h3>{lead.name}</h3>
                            <span>{lead.category}</span>
                          </div>
                          <p>
                            <MapPin size={14} />
                            {lead.address}
                          </p>
                          <div className="lead-stats">
                            <span className="rating">
                              <Star size={14} fill="currentColor" />
                              {lead.rating}
                            </span>
                            <span>
                              {lead.reviewCount.toLocaleString()} reviews
                            </span>
                            {lead.crm?.status && (
                              <span className="status-mini">
                                {lead.crm.status.replaceAll("_", " ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="lead-gap">
                          <span>
                            <Globe2 size={14} />
                            {lead.crm?.nextFollowUpAt
                              ? `Follow up ${lead.crm.nextFollowUpAt.slice(0, 10)}`
                              : "Verify web gap"}
                          </span>
                          <small>
                            {lead.crm?.contactPerson || "Evidence first"}
                          </small>
                        </div>
                        <Score
                          value={
                            lead.commercialScore?.score || lead.opportunityScore
                          }
                        />
                        <ChevronRight className="chevron" size={20} />
                      </article>
                    ))}
                {!loading && !visibleLeads.length && (
                  <Empty
                    title={
                      view === "discover"
                        ? "No matches yet"
                        : "Nothing requires attention"
                    }
                    text={
                      view === "discover"
                        ? "Run a Standard search or adjust the thresholds."
                        : "Save and qualify discovered businesses to populate this view."
                    }
                  />
                )}
              </div>
            </div>
            <div className="map-panel">
              {usesGoogleData ? (
                <div className="google-map-view">
                  <iframe
                    title={`Google map of ${location}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(selected?.address || location)}&z=13&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="provider-map-note">
                    <Globe2 />
                    <div>
                      <strong>Google-rendered source view</strong>
                      <span>
                        Open a source listing for the exact business profile.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <MapContainer
                  key={`${center.lat}-${center.lng}`}
                  center={[center.lat, center.lng]}
                  zoom={14}
                  className="map"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapFocus lead={selected} />
                  {visibleLeads.map(
                    (lead) =>
                      lead.location?.lat && (
                        <CircleMarker
                          key={lead.id}
                          center={[lead.location.lat, lead.location.lng]}
                          radius={selected?.id === lead.id ? 12 : 9}
                          pathOptions={{
                            color: "#fff",
                            weight: 3,
                            fillColor:
                              selected?.id === lead.id ? "#ff8f70" : "#167c68",
                            fillOpacity: 1,
                          }}
                          eventHandlers={{ click: () => selectLead(lead) }}
                        >
                          <Popup>
                            <strong>{lead.name}</strong>
                            <br />
                            {lead.rating} stars · {lead.reviewCount} reviews
                          </Popup>
                        </CircleMarker>
                      ),
                  )}
                </MapContainer>
              )}
              <div className="map-overlay">
                <span>
                  <Radar /> Research area
                </span>
                <strong>{selected?.name || location}</strong>
              </div>
            </div>
          </section>
        )}
      </main>

      {selected && detail && (
        <LeadDrawer
          lead={selected}
          detail={detail}
          tab={drawerTab}
          setTab={setDrawerTab}
          crmDraft={crmDraft}
          setCrmDraft={setCrmDraft}
          outreach={outreach}
          proposals={proposalOptions}
          loading={actionLoading}
          close={() => setSelected(null)}
          saveLead={saveLead}
          saveCrm={saveCrm}
          markContacted={markContacted}
          verify={verifySelected}
          analyze={analyzeSelected}
          generateOutreach={generateOutreach}
          loadProposalOptions={loadProposalOptions}
          saveProposal={saveProposalOption}
          createChecklist={createChecklist}
          toggleTask={toggleTask}
          isSaved={leads.some((lead) => lead.id === selected.id)}
        />
      )}
    </div>
  );
}

function Analytics({
  summary,
  leads,
}: {
  summary: WorkspaceSummary | null;
  leads: Opportunity[];
}) {
  const statuses = summary?.byStatus || {};
  return (
    <section className="analytics-grid">
      <article className="analytics-card wide">
        <span className="eyebrow">PIPELINE DISTRIBUTION</span>
        <h2>Where opportunities currently stand</h2>
        <div className="stage-bars">
          {Object.entries(statuses).map(([status, count]) => (
            <div key={status}>
              <span>{status.replaceAll("_", " ")}</span>
              <div>
                <i
                  style={{
                    width: `${Math.max(5, (count / Math.max(1, leads.length)) * 100)}%`,
                  }}
                />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      </article>
      <article className="analytics-card">
        <WalletCards />
        <span>Google Places today</span>
        <strong>
          {summary?.usage.google_places?.units || 0} /{" "}
          {summary?.settings.dailyPlacesRequestLimit || 0}
        </strong>
        <small>requests against your local limit</small>
      </article>
      <article className="analytics-card">
        <BrainCircuit />
        <span>Gemini calls today</span>
        <strong>
          {summary?.usage.gemini?.units || 0} /{" "}
          {summary?.settings.dailyGeminiCallLimit || 0}
        </strong>
        <small>verification, analysis, and drafts</small>
      </article>
      <article className="analytics-card wide">
        <span className="eyebrow">PERSONAL INCOME DISCIPLINE</span>
        <h2>Track what leads to paid work</h2>
        <p>
          Record contact, replies, meetings, proposals, deposits, delivery, and
          maintenance. LocalLens reports recorded pipeline value only; it never
          predicts or guarantees revenue.
        </p>
        <div className="analytics-facts">
          <span>
            <strong>{summary?.totalLeads || 0}</strong> saved leads
          </span>
          <span>
            <strong>
              {summary?.proposals.reduce((sum, item) => sum + item.count, 0) ||
                0}
            </strong>{" "}
            proposals
          </span>
          <span>
            <strong>{statuses.deposit_received || 0}</strong> deposits
          </span>
          <span>
            <strong>{statuses.delivered || 0}</strong> delivered
          </span>
        </div>
      </article>
    </section>
  );
}

function SettingsView({
  summary,
  draft,
  setDraft,
  save,
  loading,
}: {
  summary: WorkspaceSummary | null;
  draft: WorkspaceSummary["settings"] | null;
  setDraft: (value: WorkspaceSummary["settings"]) => void;
  save: () => void;
  loading: boolean;
}) {
  if (!draft)
    return (
      <Empty
        title="Settings unavailable"
        text="The local database has not finished loading."
      />
    );
  return (
    <section className="settings-layout">
      <article className="settings-card">
        <span className="eyebrow">COST CONTROLS</span>
        <h2>Daily provider limits</h2>
        <p>
          Requests stop before these local limits are exceeded. Provider billing
          and quotas remain controlled by Google.
        </p>
        <label>
          Google Places requests
          <input
            type="number"
            min="1"
            value={draft.dailyPlacesRequestLimit}
            onChange={(e) =>
              setDraft({
                ...draft,
                dailyPlacesRequestLimit: Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Gemini model calls
          <input
            type="number"
            min="1"
            value={draft.dailyGeminiCallLimit}
            onChange={(e) =>
              setDraft({
                ...draft,
                dailyGeminiCallLimit: Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Search cache lifetime (hours)
          <input
            type="number"
            min="1"
            value={draft.searchCacheHours}
            onChange={(e) =>
              setDraft({ ...draft, searchCacheHours: Number(e.target.value) })
            }
          />
        </label>
      </article>
      <article className="settings-card">
        <span className="eyebrow">PROPOSAL DEFAULTS</span>
        <h2>Editable package starting points</h2>
        <p>
          These are private defaults, not market promises. Every proposal
          remains editable.
        </p>
        <label>
          Currency
          <input
            value={draft.defaultCurrency}
            onChange={(e) =>
              setDraft({
                ...draft,
                defaultCurrency: e.target.value.slice(0, 5).toUpperCase(),
              })
            }
          />
        </label>
        {Object.entries(draft.packagePrices).map(([key, amount]) => (
          <label key={key}>
            {key} package
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  packagePrices: {
                    ...draft.packagePrices,
                    [key]: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        ))}
      </article>
      <article className="settings-card">
        <span className="eyebrow">WORKSPACE SAFETY</span>
        <h2>Back up your private data</h2>
        <p>
          SQLite is stored on this computer. Create database snapshots and
          download a complete JSON archive regularly.
        </p>
        <div className="settings-actions">
          <button
            onClick={async () => {
              await api("/api/backup", { method: "POST" });
              alert("Database backup created in data/backups.");
            }}
          >
            <Database />
            Create database backup
          </button>
          <a href="/api/export" target="_blank">
            <Download />
            Download JSON archive
          </a>
        </div>
        <label>
          Default follow-up interval
          <input
            type="number"
            min="1"
            value={draft.followUpDays}
            onChange={(e) =>
              setDraft({ ...draft, followUpDays: Number(e.target.value) })
            }
          />
        </label>
      </article>
      <button className="settings-save" onClick={save} disabled={loading}>
        <Save />
        {loading ? "Saving…" : "Save all settings"}
      </button>
      <p className="settings-footnote">
        LocalLens does not generate websites, send messages, collect payments,
        or guarantee client results.
      </p>
    </section>
  );
}

interface DrawerProps {
  lead: Opportunity;
  detail: LeadDetail;
  tab: DrawerTab;
  setTab: (tab: DrawerTab) => void;
  crmDraft: Partial<CrmFields>;
  setCrmDraft: (value: Partial<CrmFields>) => void;
  outreach: OutreachDrafts | null;
  proposals: Proposal[];
  loading: string;
  close: () => void;
  saveLead: () => void;
  saveCrm: () => void;
  markContacted: () => void;
  verify: () => void;
  analyze: () => void;
  generateOutreach: () => void;
  loadProposalOptions: () => void;
  saveProposal: (proposal: Proposal) => void;
  createChecklist: (proposal: Proposal) => void;
  toggleTask: (task: DeliveryTask) => void;
  isSaved: boolean;
}

function LeadDrawer(props: DrawerProps) {
  const {
    lead,
    detail,
    tab,
    setTab,
    crmDraft,
    setCrmDraft,
    outreach,
    proposals,
    loading,
    close,
    saveLead,
    saveCrm,
    markContacted,
    verify,
    analyze,
    generateOutreach,
    loadProposalOptions,
    saveProposal,
    createChecklist,
    toggleTask,
    isSaved,
  } = props;
  const analysis = detail.analysis as BusinessAnalysis | null;
  const verification = detail.verification as WebsiteVerification | null;
  const groupedTasks = detail.deliveryTasks.reduce<
    Record<string, DeliveryTask[]>
  >((groups, task) => {
    (groups[task.phase] ||= []).push(task);
    return groups;
  }, {});
  const tabs: Array<[DrawerTab, string]> = [
    ["overview", "Overview"],
    ["verification", "Verify"],
    ["strategy", "AI strategy"],
    ["crm", "CRM"],
    ["outreach", "Outreach"],
    ["proposal", "Proposal"],
    ["delivery", "Delivery"],
  ];
  return (
    <div className="drawer-backdrop" onClick={close}>
      <aside
        className="detail-drawer expanded"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="drawer-close" onClick={close}>
          <X />
        </button>
        <span className="eyebrow">PRIVATE OPPORTUNITY WORKSPACE</span>
        <div className="drawer-title">
          <div>
            <h2>{lead.name}</h2>
            <p>
              {lead.category} · {lead.address}
            </p>
          </div>
          <Score
            value={
              detail.lead.commercialScore?.score ||
              lead.commercialScore?.score ||
              lead.opportunityScore
            }
          />
        </div>
        <div className="proof-strip">
          <span>
            <Star fill="currentColor" />
            {lead.rating}
          </span>
          <span>{lead.reviewCount.toLocaleString()} reviews</span>
          <span className="gap">
            <Globe2 />
            {verification
              ? verification.verdict.replaceAll("_", " ")
              : "Unverified web gap"}
          </span>
          {detail.lead.crm?.status && (
            <span>{detail.lead.crm.status.replaceAll("_", " ")}</span>
          )}
        </div>
        <div className="drawer-tabs">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="drawer-section">
            <section className="agent-card">
              <div className="agent-label">
                <Sparkles />
                CATEGORY PLAYBOOK
              </div>
              <h3>{lead.recommendation.type}</h3>
              <p>{lead.recommendation.angle}</p>
              <div className="feature-grid">
                {lead.recommendation.features.map((feature) => (
                  <span key={feature}>
                    <Check />
                    {feature}
                  </span>
                ))}
              </div>
            </section>
            <h3>Commercial score</h3>
            {detail.lead.commercialScore?.factors.map((factor) => (
              <div className="score-factor" key={factor.label}>
                <span>
                  {factor.label}
                  <small>{factor.evidence}</small>
                </span>
                <strong>+{factor.points}</strong>
              </div>
            ))}
            <div className="drawer-primary-actions">
              {!isSaved && (
                <button onClick={saveLead}>
                  <Bookmark />
                  {loading === "save" ? "Saving…" : "Save opportunity"}
                </button>
              )}
              <button onClick={verify}>
                <ShieldCheck />
                {loading === "verify"
                  ? "Verifying…"
                  : "Verify website presence"}
              </button>
              <button onClick={analyze}>
                <BrainCircuit />
                {loading === "analysis" ? "Analyzing…" : "Run AI strategy"}
              </button>
            </div>
          </div>
        )}
        {tab === "verification" && (
          <div className="drawer-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">INDEPENDENT VERIFICATION</span>
                <h3>Does an owned website actually exist?</h3>
              </div>
              <button onClick={verify} disabled={loading === "verify"}>
                {loading === "verify"
                  ? "Checking…"
                  : verification
                    ? "Refresh"
                    : "Run verification"}
              </button>
            </div>
            {verification ? (
              <>
                <div className={`verdict-card ${verification.confidence}`}>
                  <ShieldCheck />
                  <div>
                    <strong>{verification.verdict.replaceAll("_", " ")}</strong>
                    <span>{verification.confidence} confidence</span>
                  </div>
                </div>
                <p>{verification.summary}</p>
                {verification.officialWebsiteUrl && (
                  <a
                    className="evidence-link"
                    href={verification.officialWebsiteUrl}
                    target="_blank"
                  >
                    <ExternalLink />
                    Open possible official website
                  </a>
                )}
                <h4>Candidate presences</h4>
                {verification.candidatePresences.map((item) => (
                  <article className="evidence-item" key={item.url}>
                    <span>{item.classification.replaceAll("_", " ")}</span>
                    <a href={item.url} target="_blank">
                      {item.url}
                    </a>
                    <p>{item.rationale}</p>
                  </article>
                ))}
                <h4>Evidence sources</h4>
                {verification.sources.map((source) => (
                  <a
                    className="source-row"
                    href={source.url}
                    key={source.url}
                    target="_blank"
                  >
                    <ExternalLink />
                    {source.title}
                  </a>
                ))}
                <div className="caution-box">
                  {verification.recommendedNextStep}
                </div>
              </>
            ) : (
              <Empty
                title="Not independently verified"
                text="Run verification before contacting the business. A missing Maps website field is not proof."
              />
            )}
          </div>
        )}
        {tab === "strategy" && (
          <div className="drawer-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">GEMINI STRATEGY</span>
                <h3>Business and opportunity analysis</h3>
              </div>
              <button onClick={analyze} disabled={loading === "analysis"}>
                {loading === "analysis"
                  ? "Analyzing…"
                  : analysis
                    ? "Refresh"
                    : "Analyze"}
              </button>
            </div>
            {analysis ? (
              <>
                <p className="analysis-summary">{analysis.executiveSummary}</p>
                <div className="analysis-kpis">
                  <span>
                    <ShieldCheck />
                    Digital maturity<strong>{analysis.digitalMaturity}</strong>
                  </span>
                  <span>
                    <TrendingUp />
                    Opportunities
                    <strong>{analysis.opportunities.length}</strong>
                  </span>
                  <span>
                    <Target />
                    Confidence<strong>{analysis.confidence}</strong>
                  </span>
                </div>
                <h4>Digital gaps</h4>
                {analysis.digitalGaps.map((gap) => (
                  <p className="check-row" key={gap}>
                    <Check />
                    {gap}
                  </p>
                ))}
                <h4>Competitor lessons</h4>
                {analysis.competitors.length ? (
                  analysis.competitors.map((item) => (
                    <article className="evidence-item" key={item.name}>
                      <strong>{item.name}</strong>
                      <p>{item.digitalAdvantage}</p>
                      <small>{item.lesson}</small>
                    </article>
                  ))
                ) : (
                  <p className="muted-copy">
                    No grounded competitor evidence was available.
                  </p>
                )}
                <div className="build-blueprint">
                  <span className="eyebrow">
                    SCOPE FOR DISCUSSION - NOT GENERATED
                  </span>
                  <h4>{analysis.recommendedBuild.type}</h4>
                  <p>{analysis.recommendedBuild.goal}</p>
                  <div className="blueprint-columns">
                    <div>
                      <strong>Potential pages</strong>
                      {analysis.recommendedBuild.pages.map((item) => (
                        <span key={item}>
                          <Check />
                          {item}
                        </span>
                      ))}
                    </div>
                    <div>
                      <strong>Potential features</strong>
                      {analysis.recommendedBuild.features.map((item) => (
                        <span key={item}>
                          <Check />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <h4>Sources</h4>
                {analysis.sources.map((source) => (
                  <a
                    className="source-row"
                    href={source.url}
                    key={source.url}
                    target="_blank"
                  >
                    <ExternalLink />
                    <span translate="no">Google Maps</span> · {source.title}
                  </a>
                ))}
              </>
            ) : (
              <Empty
                title="No AI strategy yet"
                text="Analyze only after confirming this is the correct business."
              />
            )}
          </div>
        )}
        {tab === "crm" && (
          <div className="drawer-section">
            <span className="eyebrow">PERSONAL CRM</span>
            <h3>Contact, follow-up, and outcome</h3>
            <div className="crm-grid">
              <label>
                Pipeline stage
                <select
                  value={crmDraft.status || "new"}
                  onChange={(e) =>
                    setCrmDraft({
                      ...crmDraft,
                      status: e.target.value as LeadStatus,
                    })
                  }
                >
                  {stages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact person
                <input
                  value={crmDraft.contactPerson || ""}
                  onChange={(e) =>
                    setCrmDraft({ ...crmDraft, contactPerson: e.target.value })
                  }
                />
              </label>
              <label>
                Contact method
                <select
                  value={crmDraft.contactMethod || ""}
                  onChange={(e) =>
                    setCrmDraft({ ...crmDraft, contactMethod: e.target.value })
                  }
                >
                  <option value="">Not selected</option>
                  <option>Phone</option>
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>In person</option>
                </select>
              </label>
              <label>
                Contact value
                <input
                  value={crmDraft.contactValue || ""}
                  onChange={(e) =>
                    setCrmDraft({ ...crmDraft, contactValue: e.target.value })
                  }
                />
              </label>
              <label>
                Next follow-up
                <input
                  type="date"
                  value={crmDraft.nextFollowUpAt?.slice(0, 10) || ""}
                  onChange={(e) =>
                    setCrmDraft({ ...crmDraft, nextFollowUpAt: e.target.value })
                  }
                />
              </label>
              <label>
                Proposal amount
                <input
                  type="number"
                  min="0"
                  value={crmDraft.proposalAmount || ""}
                  onChange={(e) =>
                    setCrmDraft({
                      ...crmDraft,
                      proposalAmount: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="full">
                Notes
                <textarea
                  value={crmDraft.notes || ""}
                  onChange={(e) =>
                    setCrmDraft({ ...crmDraft, notes: e.target.value })
                  }
                />
              </label>
              <label className="full checkbox-label">
                <input
                  type="checkbox"
                  checked={Boolean(crmDraft.doNotContact)}
                  onChange={(e) =>
                    setCrmDraft({ ...crmDraft, doNotContact: e.target.checked })
                  }
                />
                Do not contact this business
              </label>
            </div>
            <div className="drawer-primary-actions">
              <button onClick={saveCrm}>
                <Save />
                {loading === "crm" ? "Saving…" : "Save CRM"}
              </button>
              <button
                onClick={markContacted}
                disabled={Boolean(crmDraft.doNotContact)}
              >
                <MessageSquareText />
                Mark manually contacted
              </button>
            </div>
            <h4>Activity history</h4>
            <div className="activity-list">
              {detail.activities.map((activity: Activity) => (
                <div key={activity.id}>
                  <ActivityIcon />
                  <span>
                    <strong>{activity.type.replaceAll("_", " ")}</strong>
                    {activity.note}
                    <small>
                      {new Date(activity.createdAt).toLocaleString()}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "outreach" && (
          <div className="drawer-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">MANUAL OUTREACH ASSISTANT</span>
                <h3>Draft, review, and send yourself</h3>
              </div>
              <button
                onClick={generateOutreach}
                disabled={
                  loading === "outreach" ||
                  Boolean(detail.lead.crm?.doNotContact)
                }
              >
                {loading === "outreach"
                  ? "Drafting…"
                  : outreach
                    ? "Refresh"
                    : "Generate drafts"}
              </button>
            </div>
            <div className="caution-box">
              LocalLens never sends messages. Check every fact, personalize the
              draft, respect opt-outs, and avoid repeated unsolicited contact.
            </div>
            {outreach ? (
              <div className="outreach-sections">
                <label>
                  Email subject
                  <textarea readOnly value={outreach.emailSubject} />
                </label>
                <label>
                  Email
                  <textarea readOnly value={outreach.emailBody} />
                </label>
                <label>
                  WhatsApp
                  <textarea readOnly value={outreach.whatsappMessage} />
                </label>
                <label>
                  Phone opening
                  <textarea readOnly value={outreach.phoneOpening} />
                </label>
                <label>
                  Follow-up
                  <textarea readOnly value={outreach.followUpMessage} />
                </label>
                <h4>Meeting questions</h4>
                {outreach.meetingQuestions.map((item) => (
                  <p className="check-row" key={item}>
                    <Check />
                    {item}
                  </p>
                ))}
              </div>
            ) : (
              <Empty
                title="No drafts generated"
                text="Complete verification and strategy first for a more accurate message."
              />
            )}
          </div>
        )}
        {tab === "proposal" && (
          <div className="drawer-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PROPOSAL BUILDER</span>
                <h3>Editable scope and price options</h3>
              </div>
              <button
                onClick={loadProposalOptions}
                disabled={loading === "proposal"}
              >
                {loading === "proposal" ? "Preparing…" : "Prepare options"}
              </button>
            </div>
            <div className="caution-box">
              These are proposal starting points, not generated websites.
              Confirm requirements, taxes, costs, deposit, schedule, and
              responsibilities yourself.
            </div>
            {proposals.map((proposal) => (
              <article className="proposal-card" key={proposal.packageKey}>
                <span>{proposal.packageKey}</span>
                <h4>{proposal.title}</h4>
                <strong>
                  {proposal.currency} {proposal.amount.toLocaleString()}
                </strong>
                <p>{proposal.summary}</p>
                <small>
                  {proposal.scope.pages.length} pages ·{" "}
                  {proposal.scope.features.length} features ·{" "}
                  {proposal.scope.revisions} revision round(s)
                </small>
                <button onClick={() => saveProposal(proposal)}>
                  {loading === `proposal-${proposal.packageKey}`
                    ? "Saving…"
                    : "Save this proposal"}
                </button>
              </article>
            ))}
            <h4>Saved proposals</h4>
            {detail.proposals.map((proposal) => (
              <div className="saved-proposal" key={proposal.id}>
                <span>
                  <strong>{proposal.title}</strong>
                  {proposal.currency} {proposal.amount.toLocaleString()}
                </span>
                <div>
                  <a
                    href={`/api/proposals/${proposal.id}/proposal.pdf`}
                    target="_blank"
                  >
                    <FileText />
                    PDF
                  </a>
                  <button onClick={() => createChecklist(proposal)}>
                    <ClipboardCheck />
                    Delivery checklist
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "delivery" && (
          <div className="drawer-section">
            <span className="eyebrow">EXTERNAL DELIVERY TRACKER</span>
            <h3>Track work performed outside LocalLens</h3>
            <div className="caution-box">
              LocalLens does not perform these website tasks. This checklist
              records your separate agreement and delivery process.
            </div>
            {detail.deliveryTasks.length ? (
              Object.entries(groupedTasks).map(([phase, tasks]) => (
                <div className="task-phase" key={phase}>
                  <h4>{phase}</h4>
                  {tasks.map((task) => (
                    <label key={task.id}>
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task)}
                      />
                      <span>{task.label}</span>
                    </label>
                  ))}
                </div>
              ))
            ) : (
              <Empty
                title="No delivery checklist"
                text="Save a proposal and create its checklist after the client accepts the scope."
              />
            )}
          </div>
        )}
        <div className="drawer-footer">
          <a href={lead.mapsUrl} target="_blank">
            <ExternalLink />
            Source listing
          </a>
          {isSaved && (
            <a
              href={`/api/leads/${encodeURIComponent(lead.id)}/dossier.pdf`}
              target="_blank"
            >
              <FileText />
              Dossier PDF
            </a>
          )}
          <button onClick={close}>Close</button>
        </div>
      </aside>
    </div>
  );
}

export default App;
