import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = path.resolve(process.env.LOCALLENS_DATA_DIR || "data");
fs.mkdirSync(dataDirectory, { recursive: true });
export const databasePath = path.join(dataDirectory, "locallens.db");
const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    saved INTEGER NOT NULL DEFAULT 1,
    contact_person TEXT DEFAULT '',
    contact_method TEXT DEFAULT '',
    contact_value TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    do_not_contact INTEGER NOT NULL DEFAULT 0,
    last_contacted_at TEXT,
    next_follow_up_at TEXT,
    proposal_amount REAL,
    proposal_currency TEXT DEFAULT 'INR',
    outcome_reason TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS analyses (
    lead_id TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS verifications (
    lead_id TEXT PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL,
    confidence TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    package_key TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'draft',
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS delivery_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    phase TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS search_cache (
    cache_key TEXT PRIMARY KEY,
    payload_json TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS searches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_json TEXT NOT NULL,
    diagnostics_json TEXT NOT NULL,
    provider TEXT NOT NULL,
    cache_hit INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS usage_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    units INTEGER NOT NULL DEFAULT 1,
    estimated_cost_usd REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads(next_follow_up_at);
  CREATE INDEX IF NOT EXISTS idx_activities_lead_created ON activities(lead_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_usage_provider_created ON usage_events(provider, created_at DESC);
`);

const now = () => new Date().toISOString();
/** YYYY-MM-DD in the server's local time zone (follow-up dates are local). */
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const DEFAULT_SETTINGS = {
  dailyPlacesRequestLimit: 75,
  dailyGeminiCallLimit: 30,
  searchCacheHours: 24,
  defaultCurrency: "INR",
  packagePrices: { starter: 15000, growth: 30000, booking: 50000 },
  followUpDays: 3,
};

function rowToLead(row) {
  if (!row) return null;
  return {
    ...parse(row.payload_json, {}),
    crm: {
      status: row.status,
      saved: Boolean(row.saved),
      contactPerson: row.contact_person,
      contactMethod: row.contact_method,
      contactValue: row.contact_value,
      notes: row.notes,
      doNotContact: Boolean(row.do_not_contact),
      lastContactedAt: row.last_contacted_at,
      nextFollowUpAt: row.next_follow_up_at,
      proposalAmount: row.proposal_amount,
      proposalCurrency: row.proposal_currency,
      outcomeReason: row.outcome_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

export function upsertLead(lead, changes = {}) {
  const timestamp = now();
  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(lead.id);
  const crm = {
    ...(existing ? rowToLead(existing).crm : {}),
    ...(lead.crm || {}),
    ...changes,
  };
  db.prepare(
    `INSERT INTO leads (id,payload_json,status,saved,contact_person,contact_method,contact_value,notes,do_not_contact,last_contacted_at,next_follow_up_at,proposal_amount,proposal_currency,outcome_reason,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,status=excluded.status,saved=excluded.saved,contact_person=excluded.contact_person,contact_method=excluded.contact_method,contact_value=excluded.contact_value,notes=excluded.notes,do_not_contact=excluded.do_not_contact,last_contacted_at=excluded.last_contacted_at,next_follow_up_at=excluded.next_follow_up_at,proposal_amount=excluded.proposal_amount,proposal_currency=excluded.proposal_currency,outcome_reason=excluded.outcome_reason,updated_at=excluded.updated_at`,
  ).run(
    lead.id,
    JSON.stringify({ ...lead, crm: undefined }),
    crm.status || "new",
    crm.saved === false ? 0 : 1,
    crm.contactPerson || "",
    crm.contactMethod || "",
    crm.contactValue || "",
    crm.notes || "",
    crm.doNotContact ? 1 : 0,
    crm.lastContactedAt || null,
    crm.nextFollowUpAt || null,
    crm.proposalAmount ?? null,
    crm.proposalCurrency || "INR",
    crm.outcomeReason || "",
    existing?.created_at || timestamp,
    timestamp,
  );
  return getLead(lead.id);
}

export function getLead(id) {
  return rowToLead(db.prepare("SELECT * FROM leads WHERE id = ?").get(id));
}
export function listLeads() {
  return db
    .prepare("SELECT * FROM leads WHERE saved = 1 ORDER BY updated_at DESC")
    .all()
    .map(rowToLead);
}
export function updateLead(id, changes) {
  const lead = getLead(id);
  if (!lead) return null;
  return upsertLead(lead, changes);
}
export function deleteLead(id) {
  return db.prepare("DELETE FROM leads WHERE id = ?").run(id).changes > 0;
}

export function saveAnalysis(lead, analysis) {
  upsertLead(lead);
  db.prepare(
    "INSERT INTO analyses (lead_id,payload_json,created_at) VALUES (?,?,?) ON CONFLICT(lead_id) DO UPDATE SET payload_json=excluded.payload_json,created_at=excluded.created_at",
  ).run(lead.id, JSON.stringify(analysis), now());
  return analysis;
}
export function getAnalysis(id) {
  const row = db
    .prepare("SELECT payload_json FROM analyses WHERE lead_id = ?")
    .get(id);
  return row ? parse(row.payload_json) : null;
}
export function saveVerification(lead, verification) {
  upsertLead(lead);
  db.prepare(
    "INSERT INTO verifications (lead_id,verdict,confidence,payload_json,created_at) VALUES (?,?,?,?,?) ON CONFLICT(lead_id) DO UPDATE SET verdict=excluded.verdict,confidence=excluded.confidence,payload_json=excluded.payload_json,created_at=excluded.created_at",
  ).run(
    lead.id,
    verification.verdict,
    verification.confidence,
    JSON.stringify(verification),
    now(),
  );
  return verification;
}
export function getVerification(id) {
  const row = db
    .prepare("SELECT payload_json FROM verifications WHERE lead_id = ?")
    .get(id);
  return row ? parse(row.payload_json) : null;
}

export function addActivity(leadId, type, note = "", metadata = {}) {
  const createdAt = now();
  const result = db
    .prepare(
      "INSERT INTO activities (lead_id,type,note,metadata_json,created_at) VALUES (?,?,?,?,?)",
    )
    .run(leadId || null, type, note, JSON.stringify(metadata), createdAt);
  return {
    id: Number(result.lastInsertRowid),
    leadId,
    type,
    note,
    metadata,
    createdAt,
  };
}
export function listActivities(leadId = null, limit = 100) {
  const rows = leadId
    ? db
        .prepare(
          "SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC LIMIT ?",
        )
        .all(leadId, limit)
    : db
        .prepare("SELECT * FROM activities ORDER BY created_at DESC LIMIT ?")
        .all(limit);
  return rows.map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    type: row.type,
    note: row.note,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
  }));
}

export function saveProposal(lead, proposal) {
  upsertLead(lead);
  const timestamp = now();
  if (proposal.id) {
    db.prepare(
      "UPDATE proposals SET title=?,package_key=?,amount=?,currency=?,status=?,payload_json=?,updated_at=? WHERE id=? AND lead_id=?",
    ).run(
      proposal.title,
      proposal.packageKey,
      proposal.amount,
      proposal.currency,
      proposal.status || "draft",
      JSON.stringify(proposal),
      timestamp,
      proposal.id,
      lead.id,
    );
    return getProposal(proposal.id);
  }
  const result = db
    .prepare(
      "INSERT INTO proposals (lead_id,title,package_key,amount,currency,status,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    )
    .run(
      lead.id,
      proposal.title,
      proposal.packageKey,
      proposal.amount,
      proposal.currency,
      proposal.status || "draft",
      JSON.stringify(proposal),
      timestamp,
      timestamp,
    );
  return getProposal(Number(result.lastInsertRowid));
}
export function getProposal(id) {
  const row = db.prepare("SELECT * FROM proposals WHERE id=?").get(id);
  return row
    ? {
        ...parse(row.payload_json, {}),
        id: row.id,
        leadId: row.lead_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}
export function listProposals(leadId) {
  return db
    .prepare("SELECT * FROM proposals WHERE lead_id=? ORDER BY updated_at DESC")
    .all(leadId)
    .map((row) => ({
      ...parse(row.payload_json, {}),
      id: row.id,
      leadId: row.lead_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

export function replaceDeliveryTasks(leadId, tasks) {
  db.prepare("DELETE FROM delivery_tasks WHERE lead_id=?").run(leadId);
  const insert = db.prepare(
    "INSERT INTO delivery_tasks (lead_id,label,phase,completed,created_at,updated_at) VALUES (?,?,?,?,?,?)",
  );
  const timestamp = now();
  for (const task of tasks)
    insert.run(
      leadId,
      task.label,
      task.phase,
      task.completed ? 1 : 0,
      timestamp,
      timestamp,
    );
  return listDeliveryTasks(leadId);
}
export function listDeliveryTasks(leadId) {
  return db
    .prepare("SELECT * FROM delivery_tasks WHERE lead_id=? ORDER BY id")
    .all(leadId)
    .map((row) => ({
      id: row.id,
      leadId: row.lead_id,
      label: row.label,
      phase: row.phase,
      completed: Boolean(row.completed),
    }));
}
export function updateDeliveryTask(id, completed) {
  db.prepare(
    "UPDATE delivery_tasks SET completed=?,updated_at=? WHERE id=?",
  ).run(completed ? 1 : 0, now(), id);
  const row = db.prepare("SELECT * FROM delivery_tasks WHERE id=?").get(id);
  return row
    ? {
        id: row.id,
        leadId: row.lead_id,
        label: row.label,
        phase: row.phase,
        completed: Boolean(row.completed),
      }
    : null;
}

export function getCached(key) {
  const row = db
    .prepare(
      "SELECT payload_json,expires_at FROM search_cache WHERE cache_key=?",
    )
    .get(key);
  if (!row || new Date(row.expires_at) <= new Date()) {
    if (row) db.prepare("DELETE FROM search_cache WHERE cache_key=?").run(key);
    return null;
  }
  return parse(row.payload_json);
}
export function setCached(key, payload, hours) {
  const createdAt = now();
  const expiresAt = new Date(Date.now() + hours * 3600000).toISOString();
  db.prepare(
    "INSERT INTO search_cache (cache_key,payload_json,expires_at,created_at) VALUES (?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload_json=excluded.payload_json,expires_at=excluded.expires_at,created_at=excluded.created_at",
  ).run(key, JSON.stringify(payload), expiresAt, createdAt);
}
export function recordSearch(query, diagnostics, provider, cacheHit) {
  db.prepare(
    "INSERT INTO searches (query_json,diagnostics_json,provider,cache_hit,created_at) VALUES (?,?,?,?,?)",
  ).run(
    JSON.stringify(query),
    JSON.stringify(diagnostics),
    provider,
    cacheHit ? 1 : 0,
    now(),
  );
}

export function listRecentSearches(limit = 8) {
  const safeLimit = Math.min(25, Math.max(1, Number(limit) || 8));
  return db
    .prepare(
      "SELECT id,query_json,diagnostics_json,provider,cache_hit,created_at FROM searches ORDER BY created_at DESC LIMIT ?",
    )
    .all(safeLimit)
    .map((row) => ({
      id: row.id,
      query: parse(row.query_json, {}),
      diagnostics: parse(row.diagnostics_json, {}),
      provider: row.provider,
      cacheHit: Boolean(row.cache_hit),
      createdAt: row.created_at,
    }));
}

export function recordUsage(
  provider,
  operation,
  units = 1,
  estimatedCostUsd = 0,
) {
  db.prepare(
    "INSERT INTO usage_events (provider,operation,units,estimated_cost_usd,created_at) VALUES (?,?,?,?,?)",
  ).run(provider, operation, units, estimatedCostUsd, now());
}
export function usageToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rows = db
    .prepare(
      "SELECT provider,SUM(units) units,SUM(estimated_cost_usd) cost FROM usage_events WHERE created_at>=? GROUP BY provider",
    )
    .all(start.toISOString());
  return Object.fromEntries(
    rows.map((row) => [
      row.provider,
      { units: Number(row.units), estimatedCostUsd: Number(row.cost) },
    ]),
  );
}

export function getSettings() {
  const rows = db.prepare("SELECT key,value_json FROM settings").all();
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(rows.map((row) => [row.key, parse(row.value_json)])),
  };
}
const INTEGER_SETTINGS = {
  dailyPlacesRequestLimit: [1, 10000],
  dailyGeminiCallLimit: [1, 10000],
  searchCacheHours: [1, 24 * 30],
  followUpDays: [1, 365],
};

function toBoundedInteger(value, [min, max]) {
  const number = Number(value);
  if (value === "" || value === null || !Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Validates a settings patch. Invalid values are dropped (the stored value is
 * kept) instead of being saved, so an empty form field cannot silently set a
 * daily limit to 0 and block every provider call.
 */
export function sanitizeSettings(patch = {}) {
  const clean = {};
  for (const [key, range] of Object.entries(INTEGER_SETTINGS)) {
    if (!(key in patch)) continue;
    const value = toBoundedInteger(patch[key], range);
    if (value !== null) clean[key] = value;
  }
  if (typeof patch.defaultCurrency === "string") {
    const currency = patch.defaultCurrency.trim().toUpperCase().slice(0, 5);
    if (/^[A-Z]{3,5}$/.test(currency)) clean.defaultCurrency = currency;
  }
  if (patch.packagePrices && typeof patch.packagePrices === "object") {
    const prices = {};
    for (const key of Object.keys(DEFAULT_SETTINGS.packagePrices)) {
      const value = toBoundedInteger(patch.packagePrices[key], [0, 1e9]);
      if (value !== null) prices[key] = value;
    }
    if (Object.keys(prices).length) clean.packagePrices = prices;
  }
  return clean;
}

export function saveSettings(patch) {
  const statement = db.prepare(
    "INSERT INTO settings (key,value_json,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at",
  );
  const current = getSettings();
  const clean = sanitizeSettings(patch);
  if (clean.packagePrices)
    clean.packagePrices = { ...current.packagePrices, ...clean.packagePrices };
  for (const [key, value] of Object.entries(clean))
    statement.run(key, JSON.stringify(value), now());
  return getSettings();
}
export function assertWithinBudget(provider, additionalUnits = 1) {
  const settings = getSettings();
  const usage = usageToday();
  const limit =
    provider === "google_places"
      ? settings.dailyPlacesRequestLimit
      : settings.dailyGeminiCallLimit;
  const used = usage[provider]?.units || 0;
  if (used + additionalUnits > limit)
    throw new Error(
      `${provider === "google_places" ? "Google Places" : "Gemini"} daily limit would be exceeded (${used}/${limit}). Adjust it in Settings.`,
    );
}

export function dashboardSummary() {
  const leads = listLeads();
  const today = localDate();
  const proposals = db
    .prepare(
      "SELECT status,COUNT(*) count,SUM(amount) amount FROM proposals GROUP BY status",
    )
    .all();
  return {
    totalLeads: leads.length,
    byStatus: leads.reduce(
      (counts, lead) => ({
        ...counts,
        [lead.crm.status]: (counts[lead.crm.status] || 0) + 1,
      }),
      {},
    ),
    dueFollowUps: leads.filter(
      (lead) =>
        lead.crm.nextFollowUpAt &&
        lead.crm.nextFollowUpAt.slice(0, 10) <= today &&
        !["won", "lost", "archived"].includes(lead.crm.status),
    ).length,
    doNotContact: leads.filter((lead) => lead.crm.doNotContact).length,
    proposals: proposals.map((row) => ({
      status: row.status,
      count: Number(row.count),
      amount: Number(row.amount || 0),
    })),
    usage: usageToday(),
    settings: getSettings(),
  };
}

export function exportAllData() {
  const leads = listLeads();
  return {
    exportedAt: now(),
    version: 1,
    settings: getSettings(),
    leads: leads.map((lead) => ({
      lead,
      analysis: getAnalysis(lead.id),
      verification: getVerification(lead.id),
      activities: listActivities(lead.id),
      proposals: listProposals(lead.id),
      deliveryTasks: listDeliveryTasks(lead.id),
    })),
  };
}

export function createBackup() {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  const backupDirectory = path.join(dataDirectory, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const filename = `locallens-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}.db`;
  const destination = path.join(backupDirectory, filename);
  fs.copyFileSync(databasePath, destination);
  return { filename, path: destination, size: fs.statSync(destination).size };
}

export function closeDatabase() {
  db.close();
}
