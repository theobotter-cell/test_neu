# Contact Insights

A Bitrix24 CRM application that embeds directly into the Contact detail card
(`CRM_CONTACT_DETAIL_TAB` placement) and shows a compact statistics panel for
the contact currently open — no manual contact ID entry, ever.

Deployed on [Vibecode](https://vibecode.bitrix24.com) Black Hole, using its
transparent per-user authorization (BFF) model: the browser never sees any
credential, and every Bitrix24 API call runs as the employee who opened the
tab, so CRM permissions are always respected.

## What it shows

| Card | Source |
|---|---|
| Created | `GET /v1/contacts/:id` → `createdTime` |
| Insights views | Our own durable counter — see below, **not** a native Bitrix24 view count |
| Incoming emails | `POST /v1/activities/aggregate`, `filter: { ownerTypeId: 3, ownerId, typeId: 4, direction: 1 }` |
| Outgoing emails | Same aggregate, `direction: 2` |
| Total emails | `incomingEmails + outgoingEmails`, computed server-side |
| Timeline comments | `POST /v1/timelines/search`, `filter: { entityType: "contact", entityId }`, read from `meta.total` |

### Why "Insights views", not "Contact views"

Bitrix24 does not expose a historical view/audit log for CRM contact cards
through the Vibecode API, and the Contact's `opened` field is a
visibility/availability flag ("available to everyone"), **not** a view
counter — using it as one would be actively misleading. Instead, the app
counts how many times employees have opened *this tab* since the app was
installed, and labels it honestly: **"Insights views"**, with a "Tracked
since `<install date>`" subtitle. This is the only view metric anyone here
implements — there is no dual "real vs. approximate" number to reconcile.

## Architecture

```
Browser (iframe inside Bitrix24)
   │  same-origin fetch only — no credentials, no vibe_session_* token
   ▼
Express server (this repo)
   │  reads X-Vibe-Authorization (Gateway-injected per-user session)
   │  forwards it + our own VIBE_APP_KEY (X-Api-Key) to Vibecode
   ▼
Vibecode V1 API → Bitrix24 CRM
```

- `src/vibeClient.ts` — thin fetch wrapper: auth headers, timeout, retry only
  on documented transient errors (429/502/503/504), Retry-After aware.
- `src/identity.ts` — extracts the Gateway-injected bearer token. No client
  secret ever reaches the browser; the app never runs its own OAuth screen.
- `src/contactStats.ts` — validates the contact ID, fetches contact +
  email counts + comment count + view count concurrently (`Promise.allSettled`),
  degrades gracefully if one statistic fails.
- `src/viewStore.ts` — durable, file-backed (JSON, atomic write) per-contact
  view counter, keyed by contact ID, deployed under a declared persistent
  `dataDirs` path so it survives redeploys. Idempotent per page-load nonce so
  a refresh or duplicate request never double-counts one tab opening.
- `src/errors.ts` — maps Vibecode/Bitrix24 error codes to safe, friendly
  messages (never raw upstream payloads or stack traces).
- `public/` — vanilla JS/HTML/CSS frontend (no build step, no framework):
  `placement.js` reads the contact ID from the placement URL,
  `api.js` talks only to our own backend, `render.js` draws skeleton /
  error / KPI states.

## API

`GET /api/contact-stats/:contactId`

```json
{
  "contact": { "id": 123, "name": "John Smith", "createdAt": "2024-04-15T12:26:17+02:00" },
  "statistics": {
    "incomingEmails": 24,
    "outgoingEmails": 17,
    "totalEmails": 41,
    "timelineComments": 12,
    "views": 37,
    "viewMetricType": "insights_views",
    "trackingSince": "2026-08-22T00:00:00.000Z"
  },
  "unavailable": []
}
```

`unavailable` lists any statistic that failed to load this time (e.g.
`["timelineComments"]`) — the rest of the response is still valid and the UI
renders those cards as "Unavailable" instead of failing the whole screen.

`POST /api/contact-stats/:contactId/view` `{ "nonce": "<per-page-load-uuid>" }`
Records one tab opening. Called exactly once per page load from the
frontend; safe to retry (idempotent per nonce).

## Configuration

| Env var | Required | Description |
|---|---|---|
| `VIBE_APP_KEY` | yes | The `vibe_app_*` OAuth application key. Server-side only — never in a source file, never sent to the browser. |
| `PORT` | no | Defaults to 3000 (platform-assigned on Vibecode). |
| `DATA_DIR` | no | Where `views.json` lives. Defaults to `/opt/data/state` in production (a declared persistent `dataDirs` path); use `./data` locally. |

## Local development

```bash
npm install
cp .env.example .env   # fill in VIBE_APP_KEY
npm run build && npm start
```

## Deployment

Built and deployed to Vibecode Black Hole (Node 20 runtime), bound to the
`CRM_CONTACT_DETAIL_TAB` placement. See the deployment report for the live
URL, verification steps, and known Bitrix24 limitations.
