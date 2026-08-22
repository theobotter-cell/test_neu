# Deal Change History

A Bitrix24 CRM application that embeds directly into the Deal detail card
(`CRM_DEAL_DETAIL_TAB` placement) and shows the Deal's native stage/status
change history — no manual Deal ID entry, ever.

Deployed on [Vibecode](https://vibecode.bitrix24.com) Black Hole, using its
transparent per-user authorization (BFF) model: the browser never sees any
credential, and every Bitrix24 API call runs as the employee who opened the
tab, so CRM permissions are always respected.

## What it shows — and what it deliberately doesn't

Vibecode's V1 API surface was verified live against `GET /v1/guide` and
`GET /v1/openapi.json?scope=crm` before writing any code. That surface
exposes **one** history source for deals:

| Source | Verified as |
|---|---|
| `GET /v1/stage-history?entityType=deal&ownerId=<id>` | Equivalent of Bitrix24's `crm.stagehistory.list` |

There is **no** equivalent of `crm.item.history.list` (full field-value
change history) on this platform — confirmed by reading the full `entities`,
`crmExtras`, `timelines`/`timelineLogs`, and `knownIssues` sections of the
guide, and by the OpenAPI schema. So this app shows **stage and pipeline
transitions only**, not arbitrary field edits. That is a platform
limitation, not a shortcut: the UI states this honestly ("This view shows
stage and pipeline change history available from Bitrix24. It does not
include other field edits or general timeline activities.") rather than
implying a completeness it cannot deliver.

Every `/v1/stage-history` record carries both `stageId` **and**
`categoryId` (verified live), so a pipeline move is detected the same way
a stage move is: when a record's `categoryId` differs from the
immediately-preceding record's. Since Bitrix24 snapshots both fields
together in one record, a pipeline move and its accompanying stage move
render as two adjacent rows sharing the same timestamp — confirmed against
two real deals that actually changed pipeline (`#1569`: Default pipeline →
Neukunden; `#1485`: Testpipeline / Entwicklung → Flight Inquiry).
`categoryId 0` is Bitrix24's built-in default pipeline, which never has its
own row in `GET /v1/deal-categories` — shown as "Default pipeline" rather
than left unresolved.

Two further limitations, both verified against a real portal
(`linxys-demo.bitrix24.de`) rather than assumed:

- **No actor per stage-history record.** The endpoint's rows carry no
  "changed by" field at all. The Deal's own `movedBy`/`movedTime` describe
  only the single most recent move, so only the latest transition can ever
  be attributed (matched by timestamp, see `attachMoverToLatest` in
  `src/format.ts`) — every earlier row honestly shows "User unavailable"
  rather than guessing.
- **No previous-stage field.** Each row marks entry *into* a stage; there is
  no from/to pair. "Previous stage" is derived as the stage the
  immediately-earlier chronological record entered (`deriveTransitions`).
  The first-ever record for a deal has no previous stage and says so
  ("Previous stage unavailable") instead of inventing one.
- **Deleted/renamed stages.** Historical `stageId`s can reference stages no
  longer in the portal's current stage list (verified live: deal #368's
  2020 history references `"1"` and `"PREPARATION"`, neither of which
  exists in the portal's current `DEAL_STAGE` list today). These render as
  `Unknown stage (<code>)` rather than a fabricated label.

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
- `src/format.ts` — **pure** normalization layer (no network calls): sorts
  history chronologically, derives previous-stage, attributes the one
  actor we can honestly attribute, resolves stage labels with fallbacks,
  paginates. Unit tested (`test/format.test.ts`) including against the
  exact live response shape for deal #368.
- `src/dealHistory.ts` — I/O layer: fetches the deal, fetches the deal's
  full stage history (bounded, per-deal — never a portal-wide scan),
  resolves stage labels (`/v1/statuses/search`, entity `DEAL_STAGE` or
  `DEAL_STAGE_{categoryId}`) and the one resolvable actor's name
  (`/v1/users/:id`), then slices the result into UI pages.
- `src/errors.ts` — maps Vibecode/Bitrix24 error codes to safe, friendly
  messages (never raw upstream payloads or stack traces).
- `public/` — vanilla JS/HTML/CSS frontend (no build step, no framework):
  `placement.js` reads the Deal ID from the placement URL, `api.js` talks
  only to our own backend, `render.js` draws the list/skeleton/error/empty
  states with an oldest/newest toggle and "Load more" pagination.

## API

`GET /api/deal-history/:dealId?order=asc|desc&offset=0&limit=50`

```json
{
  "deal": { "id": 1485, "title": "Sprach Lead (Kopie)", "currentStageLabel": "New inquiry", "currentPipelineLabel": "Flight Inquiry" },
  "entries": [
    {
      "stableId": "stage-<id>",
      "changedAt": "2025-11-06T22:34:47+03:00",
      "changedById": null,
      "changedByName": null,
      "fieldId": "stageId",
      "fieldLabel": "Stage",
      "oldValue": { "raw": "NEW", "label": "Eingang" },
      "newValue": { "raw": "UC_...", "label": "New inquiry" },
      "kind": "stage",
      "semantics": "P"
    },
    {
      "stableId": "pipeline-<id>",
      "changedAt": "2025-11-06T22:34:47+03:00",
      "changedById": null,
      "changedByName": null,
      "fieldId": "categoryId",
      "fieldLabel": "Pipeline",
      "oldValue": { "raw": "205", "label": "Testpipeline / Entwicklung" },
      "newValue": { "raw": "229", "label": "Flight Inquiry" },
      "kind": "pipeline",
      "semantics": "P"
    }
  ],
  "order": "asc",
  "loaded": 3,
  "hasMore": false,
  "nextOffset": null,
  "totalKnown": 3,
  "warnings": []
}
```

Verified live: deal `#1485` really did move pipelines, and the stage + pipeline
rows above share that record's exact timestamp — this is real production data,
not a constructed example.

`order` defaults to `asc` (oldest first). `totalKnown` is the exact count
(this app fetches a deal's full stage history server-side, bounded at 2000
records, to compute chronological order and previous-stage correctly) —
it becomes `null` only if that bound was hit, at which point `warnings`
explains the history may be incomplete.

## Configuration

| Env var | Required | Description |
|---|---|---|
| `VIBE_APP_KEY` | yes | The `vibe_app_*` OAuth application key. Server-side only — never in a source file, never sent to the browser. |
| `PORT` | no | Defaults to 3000 (platform-assigned on Vibecode). |

No persistent storage is used — every request reads live from Bitrix24.

## Local development

```bash
npm install
cp .env.example .env   # fill in VIBE_APP_KEY
npm run build && npm start
```

## Tests

```bash
npm test        # pure normalization/pagination logic, node:test
npm run typecheck
npm run build
```

## Deployment

Built and deployed to Vibecode Black Hole (Node 20 runtime), bound to the
`CRM_DEAL_DETAIL_TAB` placement. See the deployment report delivered with
this change for the live URL, verification steps, and known Bitrix24
history/retention limitations.
