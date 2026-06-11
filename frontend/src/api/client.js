const API_BASE_URL = (import.meta.env.VITE_DAS_API_URL || "/api/vespa").replace(/\/+$/, "");

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Request timed out — check if DAS is running");
    throw new Error("API unreachable — check if DAS is running");
  } finally {
    clearTimeout(timer);
  }
}

async function retryFetch(url, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");

  const response = await retryFetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function typeFromId(id) {
  if (id.startsWith("hum.")) return "person";
  if (id.startsWith("com.")) return "business";
  if (id) return "other";
  return "other";
}

function normalizeDocument(doc) {
  const id = doc.id || doc.doc_id || "";
  const entityType = doc.entity_type || typeFromId(id) || doc.type || "other";
  return {
    ...doc,
    id,
    title: doc.title || doc.name || id || "Untitled",
    entity_type: entityType,
    body: doc.body || doc.bio || doc.description || "",
    tags: doc.tags || [],
    locations: doc.locations || doc.location || [],
    reputation: String(doc.reputation || doc.reputation_label || ""),
    owner: doc.owner || doc.introduced_by || "",
    imageUrls: doc.imageUrls || doc.image_urls || [],
    videoUrls: doc.videoUrls || doc.video_urls || [],
    audioUrls: doc.audioUrls || doc.audio_urls || [],
    documentUrls: doc.documentUrls || doc.document_urls || [],
  };
}

function makeId(payload) {
  const prefix = payload.entity_type === "business" ? "com" : "hum";
  const title = (payload.title || payload.name || "entity").toLowerCase();
  const slug = title.replace(/[^a-z0-9]/g, ".").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "") || "entity";
  return `${prefix}.${slug}`;
}

// Vespa msmarco schema fields (excluding embedding which is server-managed)
const VESPA_FIELDS = new Set([
  "id", "title", "url", "body", "source", "owner", "profileEndpoint",
  "tags", "type", "actions_json", "pricing_json", "reputation",
  "locations_json", "locations", "name_tokens",
  "imageUrls", "imageDescriptions", "videoUrls", "audioUrls",
  "documentUrls", "documentTexts",
]);

function buildPayload(payload, docId) {
  const id = docId || payload.id || makeId(payload);
  const entityType = payload.entity_type || payload.type || typeFromId(id) || "other";

  const merged = {
    ...payload,
    id,
    title: payload.title || payload.name || id,
    type: entityType,
    source: payload.source || entityType,
    body: payload.body || payload.bio || "",
    tags: payload.tags || [],
    owner: payload.owner || "",
    imageUrls: payload.imageUrls || [],
  };

  // Auto-sync profileEndpoint and actions_json
  // If profileEndpoint changed, update the CHAT action URL in actions_json too
  if (merged.profileEndpoint) {
    try {
      const actions = merged.actions_json ? JSON.parse(merged.actions_json) : [];
      const chatAction = actions.find((a) => a.command === "CHAT");
      if (chatAction) {
        chatAction.data = merged.profileEndpoint;
        merged.actions_json = JSON.stringify(actions);
      } else if (actions.length === 0) {
        merged.actions_json = JSON.stringify([{ command: "CHAT", displayText: "Talk", data: merged.profileEndpoint }]);
      }
    } catch { /* leave actions_json as-is if unparseable */ }
  }

  // Strip any fields not in the Vespa schema
  const doc = {};
  for (const [k, v] of Object.entries(merged)) {
    if (VESPA_FIELDS.has(k)) doc[k] = v;
  }
  return doc;
}

export function buildAnalytics(documents) {
  const total = documents.length;
  const byType = { person: 0, business: 0, other: 0 };
  const tags = {};
  const locations = {};
  const owners = {};
  const reputation = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unrated: 0 };
  const media = { images: 0, videos: 0, audio: 0, documents: 0 };
  let withTags = 0, withLocation = 0, withMedia = 0, withReputation = 0;

  for (const d of documents) {
    byType[d.entity_type] = (byType[d.entity_type] || 0) + 1;

    for (const tag of d.tags || []) tags[tag] = (tags[tag] || 0) + 1;
    for (const loc of d.locations || []) locations[loc] = (locations[loc] || 0) + 1;

    const owner = d.owner || "unknown";
    owners[owner] = (owners[owner] || 0) + 1;

    const rep = String(d.reputation || "unrated");
    reputation[rep] = (reputation[rep] || 0) + 1;

    if (d.tags?.length) withTags++;
    if (d.locations?.length) withLocation++;
    if (d.reputation) withReputation++;
    if (d.imageUrls?.length || d.videoUrls?.length || d.audioUrls?.length || d.documentUrls?.length) withMedia++;
    if (d.imageUrls?.length) media.images++;
    if (d.videoUrls?.length) media.videos++;
    if (d.audioUrls?.length) media.audio++;
    if (d.documentUrls?.length) media.documents++;
  }

  const topN = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

  return {
    total,
    by_type: byType,
    completeness: { with_tags: withTags, with_location: withLocation, with_media: withMedia, with_reputation: withReputation },
    top_tags: topN(tags, 20).map(([tag, count]) => ({ tag, count })),
    top_locations: topN(locations, 10).map(([location, count]) => ({ location, count })),
    reputation_distribution: reputation,
    media_coverage: media,
    top_owners: topN(owners, 10).map(([owner, count]) => ({ owner, count })),
    documents,
  };
}

export async function getEntities() {
  const PAGE_LIMIT = 50;
  let allItems = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const data = await api(`/documents?offset=${offset}&limit=${PAGE_LIMIT}`);
    const items = data.items || [];
    allItems = allItems.concat(items);
    total = data.total ?? items.length;
    offset += PAGE_LIMIT;
    if (items.length < PAGE_LIMIT) break;
  }

  return allItems.map(normalizeDocument);
}

export async function getAnalytics() {
  const entities = await getEntities();
  return buildAnalytics(entities);
}

export function createEntity(payload) {
  const doc = buildPayload(payload);
  return api("/documents", { method: "POST", body: JSON.stringify(doc) });
}

export async function updateEntity(id, payload) {
  // Fetch existing doc first to prevent wiping unedited fields (Vespa PUT replaces entire doc)
  const existing = await api(`/documents/${encodeURIComponent(id)}`);
  const merged = { ...existing, ...payload };
  const doc = buildPayload(merged, id);
  return api(`/documents/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) });
}

export function deleteEntity(id) {
  return api(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}
