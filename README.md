# Usage Metering & Billing System

A backend system for metering usage events and generating period-based invoices. Built to demonstrate correctness engineering for billing systems: idempotency, concurrency safety, and transactional consistency.

**Live demo:** https://billing-system-s195.onrender.com

This runs on Render's free tier, so two things to know: the service spins down when idle, so the first request after inactivity can take about a minute to wake up. Also the free Postgres instance expires 90 days after creation, so if the link stops responding, that's probably why.

---

## Features

- **Idempotent event ingestion.** Sending the same `event_id` twice never creates a duplicate row.
- **Concurrency-safe usage counter.** Increments happen atomically at the database level, so simultaneous requests can't stomp on each other and lose updates.
- **Period-based invoice generation.** Invoices are computed straight from the raw event log for a given date range, and generating the same invoice twice returns a 409 instead of a duplicate.
- **Late-event correction handling.** If usage shows up after its period has already been invoiced, it gets picked up in a separate correction invoice rather than getting dropped or double-billed.
- **Transactional consistency.** Invoice creation and event linking happen in one transaction, so a failure partway through can't leave things half-updated.

---

## Architecture

```
customers            usage_events (source of truth)      invoices
----------            ----------------------------        --------
id                    id, event_id (unique)                id
name                  customer_id (FK)                     customer_id (FK)
price_per_event       event_type                            period_start/end
                      occurred_at / received_at              event_count, amount
                      invoice_id (FK, nullable)               invoice_type
                                                               correction_sequence

customer_usage_counts (fast-read cache, kept in sync via atomic upsert)
```

`usage_events` is always the source of truth for billing. `customer_usage_counts` is just a cache for quick reads and is never trusted for actual billing math.

**Tech stack:** Node.js + Express (ES Modules), PostgreSQL.

---

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/usage-events` | Ingest a usage event (idempotent) |
| POST | `/customer-usage-counts/:customerID/increment` | Atomic counter increment |
| POST | `/invoices` | Generate an invoice for a billing period |
| POST | `/invoices/corrections` | Generate a correction invoice for late-arriving usage |

### Try the live demo
There's a demo customer (`customerID: 1`) seeded with 5 usage events in March 2026.

```bash
curl https://billing-system-s195.onrender.com/health

curl -X POST https://billing-system-s195.onrender.com/invoices \
  -H "Content-Type: application/json" \
  -d '{"customerID": 1, "period_start": "2026-03-01", "period_end": "2026-04-01"}'
```
You should get back `event_count: 5` and `amount: "0.05"`. Run it a second time and it'll return 409 with the existing invoice instead of creating a new one.

---

## Running it locally

```bash
git clone <repo-url>
cd billing-system
npm install
# set DATABASE_URL in .env to a local Postgres instance
node scripts/migrate.js
node --watch src/index.js
```

---

## Notes

This is built with synthetic test data. It's meant to demonstrate correctness engineering patterns, not to process real customers or handle real money.

A more detailed write-up covering the bugs found along the way, the reasoning behind each design decision, and the load test results lives in `ENGINEERING_NOTES.md`.