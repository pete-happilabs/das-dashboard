const API_BASE_URL = (import.meta.env.VITE_DAS_API_URL || "http://65.1.11.185:8121/api/vespa").replace(/\/+$/, "");

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
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

function buildPayload(payload, docId) {
  const id = docId || payload.id || makeId(payload);
  return {
    ...payload,
    id,
    title: payload.title || payload.name || id,
    entity_type: payload.entity_type || typeFromId(id) || "other",
    body: payload.body || payload.bio || "",
    tags: payload.tags || [],
    locations: payload.locations || [],
    reputation: String(payload.reputation || ""),
    owner: payload.owner || "",
    imageUrls: payload.imageUrls || [],
    videoUrls: payload.videoUrls || [],
    audioUrls: payload.audioUrls || [],
    documentUrls: payload.documentUrls || [],
  };
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
  const data = await api("/documents");
  const items = data.items || [];
  return items.map(normalizeDocument);
}

export async function getAnalytics() {
  const entities = await getEntities();
  return buildAnalytics(entities);
}

export function createEntity(payload) {
  const doc = buildPayload(payload);
  return api("/documents", { method: "POST", body: JSON.stringify(doc) });
}

export function updateEntity(id, payload) {
  const doc = buildPayload(payload, id);
  return api(`/documents/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) });
}

export function deleteEntity(id) {
  return api(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" });
}
