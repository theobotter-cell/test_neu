# Invoice Tier Discount

Background app (no UI) that keeps exactly one tiered discount row on Bitrix24
Smart Invoices (CRM entity type 31), deployed on Vibecode Black Hole.

| Net total of all other rows | Discount row |
|---|---|
| > €2,000.00 | `Rabatt 5 %`, qty 1, net price −(net × 5 %) |
| > €1,000.00 and ≤ €2,000.00 | `Rabatt 3 %`, qty 1, net price −(net × 3 %) |
| ≤ €1,000.00 | none (an existing one is removed) |

The discount row is a free-form row (no catalog product), 19 % VAT, tax not included.

## How it works

- **Trigger: polling, not events.** Vibecode event subscriptions require a
  `vibe_app_` OAuth key; this app runs unattended on a `vibe_api_` key, so it
  polls `POST /v1/invoices/search` every 20 s for invoices whose
  `updatedTime` moved (product-row changes bump it, verified). Filter bounds
  are converted to the portal's wall-clock time zone (`PORTAL_TIMEZONE`),
  because Bitrix24 ignores offsets in date filters. A 5-minute overlap plus a
  per-invoice "already reconciled at this `updatedTime`" marker makes it
  robust against clock skew and second-precision timestamps.
- **No retroactive run.** On first start the app records `installedAt`;
  invoices whose last change is older are ignored until they are next modified.
- **Net total** = Σ `priceExclusive × quantity` over all rows except our own.
  (Bitrix24 stores `price` as the gross unit price; `priceExclusive` is net,
  after any row discount.) To get a net discount of −45.00 at 19 % the app
  writes gross `price = −53.55`.
- **Own-row identification:** stored mapping invoice ID → row ID in
  `DATA_DIR/state.json`, with the name pattern `Rabatt X %` as fallback.
  Duplicates are removed.
- **Idempotent, no loops:** the target state is computed from the current
  rows; nothing is written when it already holds. A tier change (3 % ↔ 5 %) is
  "add new row, then delete old one" (row names cannot be PATCHed); a
  same-tier amount change is a PATCH. Other rows are never written.
- **Errors** are logged per invoice with `invoiceId` and retried on the next
  poll (up to 5 times); other invoices continue. The process never exits on
  API errors.

Only `/v1/invoices/*` endpoints are called — no other CRM entity is touched.

## Files

- `src/discount.mjs` — pure calculation / reconciliation plan (unit-tested)
- `src/worker.mjs` — poll loop, per-invoice processing, JSON logs
- `src/vibe.mjs` — Vibecode API client (retries 429/5xx, honors Retry-After)
- `src/state.mjs` — atomic JSON state file
- `src/server.mjs` — entry point; `GET /health`, `GET /status` (counters + last 100 log events)

## Configuration

| Env var | Default | |
|---|---|---|
| `VIBE_API_KEY` | — | `vibe_api_…` key with `crm` scope (never commit it) |
| `DATA_DIR` | `./data` | `/opt/data/state` in production (declared `dataDirs`, survives redeploys) |
| `PORTAL_TIMEZONE` | `Europe/Berlin` | Bitrix24 account time zone |
| `POLL_INTERVAL_MS` | `20000` | |

## Test & deploy

```bash
npm test   # unit tests + mock-API integration test, no dependencies
```

Deployed with `POST /v1/infra/servers/:id/deploy` (`runtime: node20`,
`start: cd /opt/app && node src/server.mjs`, `healthPath: /health`,
`dataDirs: ["/opt/data/state"]`), auto-sleep disabled
(`PATCH /v1/infra/servers/:id/sleep {"sleepAfterMinutes": null}`) so the
poller runs 24/7.
