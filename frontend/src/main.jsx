import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Database, Menu, X, RefreshCw, Users, Building2, Tag, MapPin, Image, Hash, Star, ChevronUp, ChevronDown } from "lucide-react";
import {
  createEntity,
  deleteEntity,
  getAnalytics,
  getEntities,
  updateEntity,
} from "./api/client";
import "./styles/app.css";

const PAGE_SIZE = 25;
const POLL_INTERVAL = 30000;

const emptyEntity = {
  title: "",
  entity_type: "person",
  body: "",
  tags: [],
  locations: [],
  reputation: "",
  owner: "",
  imageUrls: [],
  profileEndpoint: "",
  url: "",
  actions_json: "",
};

/* ── Shared small components ── */

function useToast() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);
  const show = useCallback((message, variant = "success") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.variant}`}>{t.message}</div>
      ))}
    </div>
  );
}

function Spinner() {
  return <div className="spinner"><div /><div /><div /></div>;
}

function TypeBadge({ type }) {
  const t = type || "other";
  const label = t === "person" ? "Person" : t === "business" ? "Business" : "Other";
  return <span className={`type-badge ${t}`}>{label}</span>;
}

function TagChips({ tags, max = 3 }) {
  if (!tags || !tags.length) return <span className="muted">-</span>;
  const shown = tags.slice(0, max);
  const rest = tags.length - max;
  return (
    <div className="tag-chips">
      {shown.map((t) => <span key={t} className="tag-chip">{t}</span>)}
      {rest > 0 && <span className="tag-overflow">+{rest}</span>}
    </div>
  );
}

function StarRating({ value }) {
  const num = parseFloat(value);
  if (!value || isNaN(num)) return <span className="muted">-</span>;
  const full = Math.round(num);
  return (
    <span className="stars" title={String(value)}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} className={`star${i <= full ? " filled" : ""}`}>&#9733;</span>
      ))}
    </span>
  );
}

function Avatar({ imageUrls, title, size = 34 }) {
  const src = (imageUrls || [])[0];
  const initials = (title || "?").slice(0, 2);
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img className="entity-avatar" src={src} alt="" style={{ width: size, height: size }} onError={() => setFailed(true)} />;
  }
  return <div className="entity-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials}</div>;
}

function StatusDot({ endpoint }) {
  return <span className={`status-dot ${endpoint ? "online" : "offline"}`} title={endpoint || "No endpoint"} />;
}

/* ── App ── */
function App() {
  const [view, setView] = useState("entities");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [entityCount, setEntityCount] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastUpdatedText, setLastUpdatedText] = useState("");
  const { toasts, show: showToast } = useToast();
  const refreshRef = useRef(null);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
      if (seconds < 5) setLastUpdatedText("just now");
      else if (seconds < 60) setLastUpdatedText(`${seconds}s ago`);
      else setLastUpdatedText(`${Math.floor(seconds / 60)}m ago`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [lastUpdated]);

  function handleNav(v) {
    setView(v);
    setSidebarOpen(false);
  }

  return (
    <div className="shell">
      <button className="hamburger" onClick={() => setSidebarOpen((o) => !o)} aria-label="Menu">
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="brand">
          <img
            src="/happidost-logo.png"
            alt="HappiDost"
            onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "block"; }}
          />
          <span className="brand-fallback">HappiDost</span>
        </div>
        <div className="nav-label">Vespa / DAS</div>
        <button className={view === "analytics" ? "active" : ""} onClick={() => handleNav("analytics")}>
          <BarChart3 size={17} />Analytics
        </button>
        <button className={view === "entities" ? "active" : ""} onClick={() => handleNav("entities")}>
          <Database size={17} />Entities
          {entityCount !== null && <span className="nav-badge">{entityCount}</span>}
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1>{view === "analytics" ? "Analytics" : "Entities"}</h1>
          <div className="topbar-right">
            {lastUpdatedText && <span className="last-updated">Updated {lastUpdatedText}</span>}
            <button className="ghost topbar-refresh" onClick={() => refreshRef.current?.()}>
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </header>
        {view === "analytics" && (
          <Analytics
            refreshRef={refreshRef}
            onDataLoaded={setEntityCount}
            onRefreshed={() => setLastUpdated(Date.now())}
            showToast={showToast}
          />
        )}
        {view === "entities" && (
          <Entities
            refreshRef={refreshRef}
            onCountChanged={setEntityCount}
            onRefreshed={() => setLastUpdated(Date.now())}
            showToast={showToast}
          />
        )}
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  );
}

/* ── Analytics ── */

function DonutChart({ segments, size = 140, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} />
      {segments.map((seg) => {
        const len = (seg.value / total) * circumference;
        const gap = total > 1 ? 3 : 0;
        const el = (
          <circle
            key={seg.label}
            cx={size/2} cy={size/2} r={radius} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${Math.max(0, len - gap)} ${circumference}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function ProgressBar({ label, value, max, color = "#4f6ef7" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress-row">
      <div className="progress-label">
        <span>{label}</span>
        <span className="progress-pct">{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="progress-count">{value}/{max}</span>
    </div>
  );
}

function Analytics({ refreshRef, onDataLoaded, onRefreshed }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const callbacksRef = useRef({ onDataLoaded, onRefreshed });
  callbacksRef.current = { onDataLoaded, onRefreshed };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const result = await getAnalytics();
      setData(result);
      callbacksRef.current.onDataLoaded(result.total || 0);
      callbacksRef.current.onRefreshed();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { refreshRef.current = load; return () => { refreshRef.current = null; }; }, [load, refreshRef]);
  useEffect(() => { const iv = setInterval(load, POLL_INTERVAL); return () => clearInterval(iv); }, [load]);

  if (error && !data) return (
    <section className="content">
      <div className="card notice error">{error}</div>
      <button className="primary fit" style={{ marginTop: 12 }} onClick={load}>Retry</button>
    </section>
  );

  if (loading && !data) return (
    <section className="content"><div className="card notice loading-notice"><Spinner /> Loading analytics...</div></section>
  );

  const total = data.total || 0;
  const people = data.by_type?.person || 0;
  const businesses = data.by_type?.business || 0;
  const other = data.by_type?.other || 0;
  const comp = data.completeness || {};

  const typeSegments = [
    { label: "People", value: people, color: "#a855f7" },
    { label: "Businesses", value: businesses, color: "#3b82f6" },
    { label: "Other", value: other, color: "#6b7280" },
  ].filter((s) => s.value > 0);

  const completenessItems = [
    { label: "Has Bio", value: comp.with_tags || 0, color: "#22c55e" },
    { label: "Has Tags", value: comp.with_tags || 0, color: "#3b82f6" },
    { label: "Has Location", value: comp.with_location || 0, color: "#f59e0b" },
    { label: "Has Media", value: comp.with_media || 0, color: "#ef4444" },
    { label: "Has Reputation", value: comp.with_reputation || 0, color: "#a855f7" },
  ];

  return (
    <section className="content">
      {error && (
        <div className="card notice error" style={{ marginBottom: 12 }}>
          {error}
          <button className="ghost" style={{ marginLeft: 8 }} onClick={load}>Retry</button>
        </div>
      )}

      {/* Hero KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="card kpi kpi-accent">
          <div className="kpi-header"><Hash size={20} className="kpi-icon" /></div>
          <strong>{total}</strong>
          <span>Total Entities</span>
        </div>
        <div className="card kpi">
          <div className="kpi-header"><Users size={20} className="kpi-icon" style={{ color: "#a855f7" }} /></div>
          <strong>{people}</strong>
          <span>People</span>
        </div>
        <div className="card kpi">
          <div className="kpi-header"><Building2 size={20} className="kpi-icon" style={{ color: "#3b82f6" }} /></div>
          <strong>{businesses}</strong>
          <span>Businesses</span>
        </div>
        <div className="card kpi">
          <div className="kpi-header"><Star size={20} className="kpi-icon" style={{ color: "#f59e0b" }} /></div>
          <strong>{Math.round(((comp.with_tags || 0) / total) * 100)}%</strong>
          <span>Profile Complete</span>
        </div>
      </div>

      {/* Row 2: Type Distribution + Data Quality */}
      <div className="chart-grid" style={{ marginBottom: 12 }}>
        <div className="card chart donut-card">
          <h2>Entity Distribution</h2>
          <div className="donut-layout">
            <DonutChart segments={typeSegments} />
            <div className="donut-legend">
              {typeSegments.map((s) => (
                <div key={s.label} className="donut-legend-item">
                  <span className="donut-dot" style={{ background: s.color }} />
                  <span className="donut-legend-label">{s.label}</span>
                  <strong>{s.value}</strong>
                  <span className="muted">({Math.round((s.value / total) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card chart">
          <h2>Data Quality</h2>
          {completenessItems.map((item) => (
            <ProgressBar key={item.label} label={item.label} value={item.value} max={total} color={item.color} />
          ))}
        </div>
      </div>

      {/* Row 3: Tags + Locations */}
      <div className="chart-grid" style={{ marginBottom: 12 }}>
        <BarList title="Top Tags" rows={(data.top_tags || []).slice(0, 12).map((x) => [x.tag, x.count])} color="#3b82f6" />
        <BarList title="Top Locations" rows={(data.top_locations || []).map((x) => [x.location, x.count])} color="#22c55e" />
      </div>

      {/* Row 4: Owners + Types breakdown */}
      <div className="chart-grid">
        <BarList title="Top Introducers" rows={(data.top_owners || []).slice(0, 10).map((x) => [x.owner, x.count])} color="#a855f7" />
        <BarList title="Entity Types" rows={Object.entries(data.by_type || {})} color="#f59e0b" />
      </div>
    </section>
  );
}

/* ── Entities ── */
function Entities({ refreshRef, onCountChanged, onRefreshed, showToast }) {
  const [entities, setEntities] = useState([]);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("title");
  const [sortDir, setSortDir] = useState("asc");
  const callbacksRef = useRef({ onCountChanged, onRefreshed });
  callbacksRef.current = { onCountChanged, onRefreshed };

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(rawQuery); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getEntities();
      setEntities(data);
      setSelected(new Set());
      callbacksRef.current.onCountChanged(data.length);
      callbacksRef.current.onRefreshed();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshRef.current = refresh; return () => { refreshRef.current = null; }; }, [refresh, refreshRef]);
  useEffect(() => { const iv = setInterval(refresh, POLL_INTERVAL); return () => clearInterval(iv); }, [refresh]);

  const filtered = useMemo(() => {
    let list = entities.filter((e) => {
      if (type !== "all" && e.entity_type !== type) return false;
      const haystack = [e.title, e.id, e.body, e.owner, ...(e.tags || []), ...(e.locations || [])].join(" ").toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    // Sort
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === "title") { av = (a.title || "").toLowerCase(); bv = (b.title || "").toLowerCase(); }
      else if (sortKey === "type") { av = a.entity_type || ""; bv = b.entity_type || ""; }
      else if (sortKey === "reputation") { av = parseFloat(a.reputation) || 0; bv = parseFloat(b.reputation) || 0; }
      else if (sortKey === "owner") { av = (a.owner || "").toLowerCase(); bv = (b.owner || "").toLowerCase(); }
      else if (sortKey === "tags") { av = (a.tags || []).length; bv = (b.tags || []).length; }
      else { av = ""; bv = ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [entities, query, type, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, filtered.length);
  const paged = filtered.slice(pageStart, pageEnd);

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortHeader({ label, sKey }) {
    const active = sortKey === sKey;
    const Icon = active && sortDir === "desc" ? ChevronDown : ChevronUp;
    return (
      <th className={`sortable${active ? " sort-active" : ""}`} onClick={() => handleSort(sKey)}>
        {label}<Icon size={12} className="sort-arrow" />
      </th>
    );
  }

  function toggleSelect(id) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  }

  async function remove(id) {
    try {
      await deleteEntity(id);
      setDeleting(null);
      showToast("Entity deleted");
      setEntities((prev) => prev.filter((e) => e.id !== id));
      setTimeout(refresh, 800);
    } catch (err) {
      setDeleting(null);
      showToast(err.message, "error");
    }
  }

  async function bulkRemove() {
    setBulkDeleting(false);
    const ids = [...selected];
    const errors = [];
    for (const id of ids) {
      try { await deleteEntity(id); } catch (err) { errors.push(id); }
    }
    if (errors.length) showToast(`Failed to delete ${errors.length} entit${errors.length === 1 ? "y" : "ies"}`, "error");
    else showToast(`Deleted ${ids.length} entit${ids.length === 1 ? "y" : "ies"}`);
    const failedSet = new Set(errors);
    setEntities((prev) => prev.filter((e) => !ids.includes(e.id) || failedSet.has(e.id)));
    setSelected(new Set());
    setTimeout(refresh, 800);
  }

  if (error && !entities.length) return (
    <section className="content">
      <div className="card notice error">{error}</div>
      <button className="primary fit" style={{ marginTop: 12 }} onClick={refresh}>Retry</button>
    </section>
  );

  if (loading && !entities.length) return (
    <section className="content"><div className="card notice loading-notice"><Spinner /> Loading entities...</div></section>
  );

  return (
    <section className="content">
      {error && (
        <div className="card notice error" style={{ marginBottom: 12 }}>
          {error}
          <button className="ghost" style={{ marginLeft: 8 }} onClick={refresh}>Retry</button>
        </div>
      )}
      <div className="toolbar">
        <input placeholder="Search entities..." value={rawQuery} onChange={(e) => setRawQuery(e.target.value)} />
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
          <option value="all">All Types</option>
          <option value="person">People</option>
          <option value="business">Businesses</option>
          <option value="other">Other</option>
        </select>
        <span className="toolbar-spacer" />
        {selected.size > 0 && <button className="danger-btn fit" onClick={() => setBulkDeleting(true)}>Delete {selected.size} selected</button>}
        <button className="primary fit" onClick={() => setEditing(emptyEntity)}>Add Entity</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check-col"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} /></th>
              <SortHeader label="Name" sKey="title" />
              <SortHeader label="Type" sKey="type" />
              <SortHeader label="Tags" sKey="tags" />
              <th>Location</th>
              <SortHeader label="Reputation" sKey="reputation" />
              <SortHeader label="Owner" sKey="owner" />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 && (
              <tr><td colSpan={8} className="empty-state">{query || type !== "all" ? "No matching entities found" : "No entities found"}</td></tr>
            )}
            {paged.map((e) => (
              <tr key={e.id} className={selected.has(e.id) ? "selected-row" : ""}>
                <td className="check-col"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
                <td>
                  <div className="entity-name-cell">
                    <Avatar imageUrls={e.imageUrls} title={e.title} />
                    <div className="entity-name-text">
                      <strong onClick={() => setViewing(e)}>{e.title}</strong>
                      <small><StatusDot endpoint={e.profileEndpoint} />{e.id}</small>
                    </div>
                  </div>
                </td>
                <td><TypeBadge type={e.entity_type} /></td>
                <td><TagChips tags={e.tags} /></td>
                <td>{(e.locations || []).join(", ") || "-"}</td>
                <td><StarRating value={e.reputation} /></td>
                <td>{e.owner || "-"}</td>
                <td className="actions">
                  <button onClick={() => setViewing(e)}>View</button>
                  <button onClick={() => setEditing(e)}>Edit</button>
                  <button className="danger" onClick={() => setDeleting(e)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > PAGE_SIZE && (
        <div className="pagination">
          <span className="pagination-info">Showing {pageStart + 1}&ndash;{pageEnd} of {filtered.length} entities</span>
          <div className="pagination-controls">
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      )}
      {viewing && (
        <EntityDetail
          entity={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setViewing(null); setEditing(viewing); }}
        />
      )}
      {editing && (
        <EntityModal
          entity={editing}
          onClose={() => setEditing(null)}
          onSaved={(isNew) => { setEditing(null); showToast(isNew ? "Entity created" : "Entity updated"); setTimeout(refresh, 500); }}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete Entity"
          message={`Delete "${deleting.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={() => remove(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
      {bulkDeleting && (
        <ConfirmModal
          title="Delete Selected"
          message={`Delete ${selected.size} selected entit${selected.size === 1 ? "y" : "ies"}? This cannot be undone.`}
          confirmLabel={`Delete ${selected.size}`}
          onConfirm={bulkRemove}
          onCancel={() => setBulkDeleting(false)}
        />
      )}
    </section>
  );
}

/* ── Entity Detail Panel ── */
function EntityDetail({ entity, onClose, onEdit }) {
  const e = entity;
  let actionsFormatted = "";
  try { actionsFormatted = e.actions_json ? JSON.stringify(JSON.parse(e.actions_json), null, 2) : ""; } catch { actionsFormatted = e.actions_json || ""; }

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-panel">
        <div className="detail-header">
          <h2>Entity Details</h2>
          <button className="ghost" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="detail-body">
          <div className="detail-hero">
            <Avatar imageUrls={e.imageUrls} title={e.title} size={64} />
            <div className="detail-hero-info">
              <h3>{e.title}</h3>
              <p><StatusDot endpoint={e.profileEndpoint} />{e.id}</p>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-label">Type</div>
            <div className="detail-value"><TypeBadge type={e.entity_type} /></div>
          </div>

          {e.body && (
            <div className="detail-section">
              <div className="detail-label">Bio</div>
              <div className="detail-value">{e.body}</div>
            </div>
          )}

          {(e.tags || []).length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Tags</div>
              <div className="detail-value"><TagChips tags={e.tags} max={50} /></div>
            </div>
          )}

          {(e.locations || []).length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Locations</div>
              <div className="detail-value">{e.locations.join(", ")}</div>
            </div>
          )}

          {e.reputation && (
            <div className="detail-section">
              <div className="detail-label">Reputation</div>
              <div className="detail-value"><StarRating value={e.reputation} /> <span className="muted">({e.reputation})</span></div>
            </div>
          )}

          {e.profileEndpoint && (
            <div className="detail-section">
              <div className="detail-label">Profile Endpoint</div>
              <div className="detail-value"><code>{e.profileEndpoint}</code></div>
            </div>
          )}

          {e.url && (
            <div className="detail-section">
              <div className="detail-label">URL</div>
              <div className="detail-value">{e.url.startsWith("http") ? <a href={e.url} target="_blank" rel="noreferrer">{e.url}</a> : e.url}</div>
            </div>
          )}

          {e.owner && (
            <div className="detail-section">
              <div className="detail-label">Owner</div>
              <div className="detail-value">{e.owner}</div>
            </div>
          )}

          {(e.imageUrls || []).length > 0 && (
            <div className="detail-section">
              <div className="detail-label">Images</div>
              <div className="detail-value" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {e.imageUrls.map((url, i) => (
                  <img key={i} src={url} alt="" style={{ maxWidth: 120, maxHeight: 80, borderRadius: 6, background: "#1e293b" }} />
                ))}
              </div>
            </div>
          )}

          {actionsFormatted && (
            <div className="detail-section">
              <div className="detail-label">Actions</div>
              <div className="detail-value"><pre>{actionsFormatted}</pre></div>
            </div>
          )}
        </div>
        <div className="detail-actions">
          <button className="primary fit" onClick={onEdit}>Edit Entity</button>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

/* ── Entity Modal ── */
function EntityModal({ entity, onClose, onSaved }) {
  const [form, setForm] = useState(entity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const split = (value) => value.split(",").map((x) => x.trim()).filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, tags: form.tags || [], locations: form.locations || [], imageUrls: form.imageUrls || [] };
      if (entity.id) await updateEntity(entity.id, payload);
      else await createEntity(payload);
      onSaved(!entity.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <h2>{entity.id ? "Edit Entity" : "Add Entity"}</h2>
        <label>Name<input required value={form.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label>Type<select value={form.entity_type} onChange={(e) => set("entity_type", e.target.value)}><option value="person">Person</option><option value="business">Business</option><option value="other">Other</option></select></label>
        <label>Bio<textarea value={form.body} onChange={(e) => set("body", e.target.value)} /></label>
        <label>Tags<input value={(form.tags || []).join(", ")} onChange={(e) => set("tags", split(e.target.value))} placeholder="comma separated" /></label>
        <label>Locations<input value={(form.locations || []).join(", ")} onChange={(e) => set("locations", split(e.target.value))} placeholder="comma separated" /></label>
        <label>Profile Endpoint<input value={form.profileEndpoint || ""} onChange={(e) => set("profileEndpoint", e.target.value)} placeholder="ws://host:port/talk" /></label>
        <label>URL<input value={form.url || ""} onChange={(e) => set("url", e.target.value)} placeholder="Website or address" /></label>
        <label>Image URLs<input value={(form.imageUrls || []).join(", ")} onChange={(e) => set("imageUrls", split(e.target.value))} placeholder="comma separated" /></label>
        <label>Actions JSON<textarea value={form.actions_json || ""} onChange={(e) => set("actions_json", e.target.value)} placeholder='[{"command":"CHAT","displayText":"Talk","data":"ws://..."}]' style={{ fontFamily: "monospace", fontSize: 12 }} /></label>
        <label>Reputation<input value={form.reputation || ""} onChange={(e) => set("reputation", e.target.value)} /></label>
        <label>Owner<input value={form.owner || ""} onChange={(e) => set("owner", e.target.value)} /></label>
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary fit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </div>
      </form>
    </div>
  );
}

/* ── Bar chart ── */
function BarList({ title, rows, color }) {
  const max = Math.max(1, ...rows.map(([, value]) => Number(value)));
  const barStyle = color ? { background: color, opacity: 0.85 } : {};
  return (
    <div className="card chart">
      <h2>{title}</h2>
      {rows.length
        ? rows.map(([label, value]) => (
          <div className="bar-row" key={label}>
            <span title={label}>{label}</span>
            <div><i style={{ width: `${(Number(value) / max) * 100}%`, ...barStyle }} /></div>
            <b>{value}</b>
          </div>
        ))
        : <p className="muted">No data available</p>
      }
    </div>
  );
}

/* ── Confirm dialog ── */
function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal card confirm-modal">
        <h2>{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="danger-btn" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
