import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Database } from "lucide-react";
import {
  createEntity,
  deleteEntity,
  getAnalytics,
  getEntities,
  updateEntity,
} from "./api/client";
import "./styles/app.css";

const emptyEntity = {
  title: "",
  entity_type: "person",
  body: "",
  tags: [],
  locations: [],
  reputation: "",
  owner: "",
  imageUrls: [],
  videoUrls: [],
  audioUrls: [],
  documentUrls: [],
};

function App() {
  const [view, setView] = useState("analytics");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><img src="/happidost-logo.png" alt="HappiDost" /></div>
        <div className="nav-label">Vespa / DAS</div>
        <button className={view === "analytics" ? "active" : ""} onClick={() => setView("analytics")}><BarChart3 size={17} />Analytics</button>
        <button className={view === "entities" ? "active" : ""} onClick={() => setView("entities")}><Database size={17} />Entities</button>
      </aside>
      <main className="main">
        <header className="topbar">
          <h1>{view[0].toUpperCase() + view.slice(1)}</h1>
        </header>
        {view === "analytics" && <Analytics />}
        {view === "entities" && <Entities />}
      </main>
    </div>
  );
}

function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAnalytics().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <Notice tone="error" text={error} />;
  if (!data) return <Notice text="Loading analytics..." />;

  const total = data.total || 0;
  const pct = (n) => total ? `${Math.round((n / total) * 100)}%` : "0%";
  const kpis = [
    ["Total Entities", total],
    ["People", data.by_type?.person || 0],
    ["Businesses", data.by_type?.business || 0],
    ["With Tags", pct(data.completeness?.with_tags || 0)],
    ["With Location", pct(data.completeness?.with_location || 0)],
    ["With Media", pct(data.completeness?.with_media || 0)],
  ];

  return (
    <section className="content">
      <div className="kpi-grid">{kpis.map(([label, value]) => <div className="card kpi" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
      <div className="chart-grid">
        <BarList title="Top Tags" rows={(data.top_tags || []).map((x) => [x.tag, x.count])} />
        <BarList title="Top Locations" rows={(data.top_locations || []).map((x) => [x.location, x.count])} />
        <BarList title="Entity Types" rows={Object.entries(data.by_type || {})} />
        <BarList title="Top Introducers" rows={(data.top_owners || []).map((x) => [x.owner, x.count])} />
      </div>
    </section>
  );
}

function Entities() {
  const [entities, setEntities] = useState([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try { setEntities(await getEntities()); setSelected(new Set()); } catch (err) { setError(err.message); }
  }

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => entities.filter((e) => {
    if (type !== "all" && e.entity_type !== type) return false;
    const haystack = [e.title, e.id, e.body, e.owner, ...(e.tags || []), ...(e.locations || [])].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [entities, query, type]);

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
      refresh();
    } catch (err) {
      setDeleting(null);
      setError(err.message);
    }
  }

  async function bulkRemove() {
    setBulkDeleting(false);
    const ids = [...selected];
    const errors = [];
    for (const id of ids) {
      try { await deleteEntity(id); } catch (err) { errors.push(`${id}: ${err.message}`); }
    }
    if (errors.length) setError(`Failed to delete ${errors.length} entit${errors.length === 1 ? "y" : "ies"}: ${errors.join("; ")}`);
    refresh();
  }

  return (
    <section className="content">
      {error && <Notice tone="error" text={error} />}
      <div className="toolbar">
        <input placeholder="Search entities..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All Types</option><option value="person">People</option><option value="business">Businesses</option><option value="other">Other</option></select>
        <span className="toolbar-spacer" />
        {selected.size > 0 && <button className="danger-btn fit" onClick={() => setBulkDeleting(true)}>Delete {selected.size} selected</button>}
        <button className="primary fit" onClick={() => setEditing(emptyEntity)}>Add Entity</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th className="check-col"><input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} /></th><th>Name</th><th>Type</th><th>Tags</th><th>Location</th><th>Reputation</th><th>Owner</th><th></th></tr></thead>
          <tbody>{filtered.map((e) => <tr key={e.id} className={selected.has(e.id) ? "selected-row" : ""}>
            <td className="check-col"><input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSelect(e.id)} /></td>
            <td><strong>{e.title}</strong><small>{e.id}</small></td>
            <td>{e.entity_type}</td>
            <td>{(e.tags || []).join(", ")}</td>
            <td>{(e.locations || [])[0] || "-"}</td>
            <td>{e.reputation || "-"}</td>
            <td>{e.owner || "-"}</td>
            <td className="actions"><button onClick={() => setEditing(e)}>Edit</button><button className="danger" onClick={() => setDeleting(e)}>Delete</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {editing && <EntityModal entity={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {deleting && <ConfirmModal title="Delete Entity" message={`Delete "${deleting.title}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={() => remove(deleting.id)} onCancel={() => setDeleting(null)} />}
      {bulkDeleting && <ConfirmModal title="Delete Selected" message={`Delete ${selected.size} selected entit${selected.size === 1 ? "y" : "ies"}? This cannot be undone.`} confirmLabel={`Delete ${selected.size}`} onConfirm={bulkRemove} onCancel={() => setBulkDeleting(false)} />}
    </section>
  );
}

function EntityModal({ entity, onClose, onSaved }) {
  const [form, setForm] = useState(entity);
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const split = (value) => value.split(",").map((x) => x.trim()).filter(Boolean);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tags: form.tags || [], locations: form.locations || [], imageUrls: form.imageUrls || [] };
    if (entity.id) await updateEntity(entity.id, payload);
    else await createEntity(payload);
    onSaved();
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal card" onSubmit={submit}>
        <h2>{entity.id ? "Edit Entity" : "Add Entity"}</h2>
        <label>Name<input required value={form.title} onChange={(e) => set("title", e.target.value)} /></label>
        <label>Type<select value={form.entity_type} onChange={(e) => set("entity_type", e.target.value)}><option value="person">Person</option><option value="business">Business</option><option value="other">Other</option></select></label>
        <label>Bio<textarea value={form.body} onChange={(e) => set("body", e.target.value)} /></label>
        <label>Tags<input value={(form.tags || []).join(", ")} onChange={(e) => set("tags", split(e.target.value))} /></label>
        <label>Locations<input value={(form.locations || []).join(", ")} onChange={(e) => set("locations", split(e.target.value))} /></label>
        <label>Reputation<input value={form.reputation || ""} onChange={(e) => set("reputation", e.target.value)} /></label>
        <label>Introduced By<input value={form.owner || ""} onChange={(e) => set("owner", e.target.value)} /></label>
        <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary fit" disabled={saving}>{saving ? "Saving..." : "Save"}</button></div>
      </form>
    </div>
  );
}

function BarList({ title, rows }) {
  const max = Math.max(1, ...rows.map(([, value]) => Number(value)));
  return <div className="card chart"><h2>{title}</h2>{rows.length ? rows.map(([label, value]) => <div className="bar-row" key={label}><span>{label}</span><div><i style={{ width: `${(Number(value) / max) * 100}%` }} /></div><b>{value}</b></div>) : <p className="muted">No data</p>}</div>;
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal card confirm-modal">
        <h2>{title}</h2>
        <p className="confirm-message">{message}</p>
        <div className="modal-actions"><button onClick={onCancel}>Cancel</button><button className="danger-btn" onClick={onConfirm}>{confirmLabel}</button></div>
      </div>
    </div>
  );
}

function Notice({ text, tone }) {
  return <section className="content"><div className={`card notice ${tone || ""}`}>{text}</div></section>;
}

createRoot(document.getElementById("root")).render(<App />);
