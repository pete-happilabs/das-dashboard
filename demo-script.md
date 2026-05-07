# DAS Demo Script

**Duration:** 7–10 minutes
**Presenter:** Pete Royce Saldanha
**Audience:** Joy + team

---

## 1. Opening (30s)

"DAS — the DOST Agent Store — is our hybrid search engine that indexes every person and business in the DOST ecosystem. Currently 125 entities: 121 people, 3 businesses, 1 other. It runs on Vespa with OpenAI embeddings for semantic search.

This week I built an admin portal on top of it. Everything is now secured, manageable, and — importantly — any change made here propagates to every service that reads from the index."

---

## 2. Login & Security (45s)

> Open `http://localhost:8121/static/dashboard.html`
> Login screen is visible

"Previously, all DAS endpoints were public — anyone could query, add entities, or pull analytics with no auth. That's fixed now.

Every endpoint — search, introduce, analytics — requires a JWT token. The login uses bcrypt-hashed passwords. There's rate limiting on login attempts to prevent brute force — 5 per minute. CORS is locked down, and all responses include security headers."

> Enter admin / admin123 → Sign In

---

## 3. Dashboard — Analytics (1m)

> Vespa > DAS > Analytics is loaded

"The analytics view gives us a real-time picture of everything in our Vespa index.

Six KPI cards across the top: total entities, people count, businesses, and coverage percentages for tags, locations, and media. These tell us data quality at a glance — how complete our entity profiles actually are.

Below that, six charts:
- **Entity type breakdown** — donut showing the people/business split
- **Top tags** — what skills and services are most represented
- **Top locations** — where our entities are concentrated (mostly Bangalore neighbourhoods right now)
- **Reputation distribution** — star ratings across the index
- **Media coverage** — how many entities have images, videos, audio, documents attached
- **Top introducers** — who's been registering the most entities

All of this is client-side filtered. Watch —"

> Change the Type filter to "People"

"Instant. No API call. The data loads once, then every interaction is local. Change tags, location filters — same thing. Zero latency."

---

## 4. Entity Management (1.5m)

> Click Vespa > DAS > Entities

"This is the entity management view. Every entity in the Vespa index, in a searchable, paginated table.

Columns: name, type, tags, location, reputation, and who introduced them. 25 per page with pagination at the bottom."

> Type 'yoga' in the search bar

"Search is instant — filters across name, tags, locations. Debounced at 300ms so it doesn't fire on every keystroke."

> Click on a row (not the checkbox)

"Detail drawer slides in from the right. Full entity profile: ID, type, owner, reputation stars, bio, all tags, all locations, and any media files attached — images, documents, videos, audio. This is everything Vespa stores for this entity."

> Close the drawer

---

## 5. Bulk Actions (45s)

> Check 3-4 entity checkboxes

"Multi-select. The bulk toolbar appears — shows how many are selected. From here you can:

**Export as JSON** — downloads the selected entities as a file. Useful for data audits or sharing subsets.

**Delete** — wired and ready, waiting for the delete API endpoint from the backend team.

**Select all** on the current page with the header checkbox, or clear everything."

> Click Export JSON
> Click Clear

---

## 6. Add Entity (1m)

> Click "+ Add Entity" button

"This is the introduce flow — registering a new entity into the index. The form covers the core fields:

- **Name and Type** — person or business
- **Bio** — free text description
- **Tags** — comma-separated skills or services
- **Locations** — where they operate
- **Reputation** — clickable star picker, 1 to 5
- **Introduced by** — who's registering this entity
- **Image URLs** — profile photos

When you submit, this builds a DOST event — a standard `introduce_request` — and sends it to the `/introduce` endpoint with the auth token. The entity gets indexed in Vespa, and the table refreshes."

> Fill in a quick example if live Vespa is connected, or just show the form and cancel

---

## 7. Single Source of Truth (1m)

"I want to emphasise something about how this works. Vespa is the single source of truth. There's one index, and every service reads from it.

**When you add an entity here**, it's not just in the dashboard — it's immediately available to:
- The `/search` endpoint — both keyword and semantic search will find it
- The analytics — the KPI cards, charts, all update on the next load
- Any agent or service that queries DAS

**When we wire up delete**, same thing. Remove an entity from here, it's gone from search results, gone from analytics, gone from every agent's view. One action, full propagation.

**Edit and modify** will work the same way — update a tag, change a location, fix a bio — the change hits Vespa, and every downstream consumer sees it immediately. No sync jobs, no cache invalidation, no eventual consistency delays. Vespa serves reads directly from the index.

This is why the dashboard is powerful — it's not a reporting layer sitting on top. It's a direct control plane for the data that the entire DOST ecosystem relies on."

---

## 8. Architecture & Scalability (1m)

"Quick architecture overview:

- **Backend**: FastAPI on port 8121, talking to Vespa on EC2
- **Search**: Hybrid — 70% semantic (OpenAI text-embedding-3-small, 1536 dims) + 30% BM25 keyword matching
- **Auth**: JWT with HS256, bcrypt password hashing, 24h token expiry
- **Frontend**: Single HTML file — no build tools, no framework. Tailwind CDN + Chart.js. DOM-constructed with textContent, no innerHTML — XSS-safe by design
- **Tests**: 249 passing, including 29 new auth tests

On scalability — this is built to grow:

**Vespa scales horizontally.** Right now we're on a single EC2 node with 125 entities. The multi-node config is already prepared in the repo. When we go from hundreds to tens of thousands of entities, we add nodes — Vespa redistributes the data automatically. No code changes, no schema migration.

**The dashboard handles scale client-side.** Right now it loads all entities in one fetch. As we grow past a few thousand, we can add server-side pagination and search — the API already returns structured data that supports it. The client-side filtering pattern stays the same for the analytics view since aggregations are computed server-side.

**The sidebar is built for multi-service.** You'll notice the Vespa dropdown has DAS under it. When DPA is ready, it slots in as a second entry — same Vespa cluster, different schema, separate analytics and entity views. Same for any future DOST service that stores data in Vespa.

**Auth scales to multi-user.** Right now it's a single admin account. The JWT infrastructure supports multiple users and roles — we just need a user table when the time comes. The `require_auth` dependency doesn't change."

---

## 9. What's Next (30s)

"Four things on the immediate roadmap:

1. **Delete + Edit APIs** — backend endpoints for entity lifecycle management. The UI is already wired and waiting.
2. **DPA integration** — second entry under the Vespa dropdown. Same dashboard, separate data.
3. **Data quality pipeline** — automated completeness scoring from DOST activity, improving coverage percentages over time.
4. **Review-tag extraction** — pulling consensus tags from dost-reviews and pushing them into entity profiles here in DAS."

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Entities indexed | 125 |
| People | 121 |
| Businesses | 3 |
| Tests passing | 249 |
| Auth test cases | 29 |
| Embedding dimensions | 1,536 |
| Token expiry | 24 hours |
| Login rate limit | 5/min |
| Hybrid search split | 70% semantic / 30% keyword |
| Dashboard file size | Single HTML file, ~900 lines |
| Vespa nodes (current) | 1 (multi-node config ready) |
