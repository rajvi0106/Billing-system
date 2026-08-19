# Usage Metering & Billing System

A backend system demonstrating **billing/usage-metering correctness
engineering** — idempotent event ingestion, race-condition-safe counters,
period-based invoice generation, and late-event correction handling.
---

## Tech stack

- Node.js + Express (ES Modules)
- PostgreSQL
- Testing: custom Node scripts using native `fetch` + `Promise.all` for
  concurrent load testing.

---

## Architecture overview

```
customers                usage_events                  invoices
----------                ------------                  --------
id                        id                             id
name                      event_id (UNIQUE)              customer_id (FK)
price_per_event           customer_id (FK)                period_start (date)
created_at                event_type                      period_end (date)
                          occurred_at (timestamptz)        event_count
                          received_at (timestamptz)        amount
                          created_at (timestamptz)          generated_at
                          invoice_id (nullable FK)          invoice_type
                                                             correction_sequence

customer_usage_counts
----------------------
customer_id (PK, FK)
total_count
```

**`usage_events` is the source of truth.** All billing calculations
recompute directly from this table. `customer_usage_counts` is a
**cache** — a fast-read running total — kept in sync via an atomic
upsert on every new event, but never trusted for billing math.

---

## Phase-by-phase summary

### Phase 1 — Idempotent event ingestion
`POST /usage-events` inserts using `INSERT ... ON CONFLICT (event_id) DO
NOTHING RETURNING *`. Sending the same `event_id` twice results in exactly
one row — verified directly via SQL, not just by trusting the API
response.

### Phase 2 — Concurrency-safe counter (the core correctness demo)
**Broke it first, on purpose.** Built a naive counter increment: read
current count → add 1 in JS → write back — three separate steps, not
atomic.

**Measured result under 50 concurrent requests:**
| | Expected | Actual |
|---|---|---|
| Naive (read-modify-write) | 50 | **1** (49/50 updates lost) |

**Fixed it** with a single atomic SQL statement:
```sql
UPDATE customer_usage_counts SET total_count = total_count + 1
WHERE customer_id = $1 RETURNING total_count
```
Re-ran the identical 50-concurrent-request test after resetting the
counter to 0:

| | Expected | Actual |
|---|---|---|
| Atomic UPDATE | 50 | **50** (0 lost) |

**Why it works:** the naive version exposed a read-then-write gap to
application code — two requests could both read the same stale value
before either wrote back. The atomic version does the entire
read-modify-write as one indivisible statement inside Postgres, which
takes a row-level lock for the duration — there is no window where two
requests can act on the same stale value.

**Later in the project**, this counter was wired to real event ingestion
(`POST /usage-events` now calls an atomic upsert on `customer_usage_counts`
after every new — non-duplicate — event) using:
```sql
INSERT INTO customer_usage_counts (customer_id, total_count)
VALUES ($1, 1)
ON CONFLICT (customer_id) DO UPDATE
SET total_count = customer_usage_counts.total_count + 1
```
This is deliberately **not** wrapped in a transaction with the
`usage_events` insert. Reasoning: `usage_events` is the source of truth —
if the counter upsert fails independently, the event itself is still
safely recorded, and the cache can always be recomputed later via
`SELECT COUNT(*) FROM usage_events WHERE customer_id = ...`. This is a
different risk profile from Phase 4's invoice/event linking (see below),
where a missed link would have no independent record to recover from —
that case *does* use a transaction.

### Phase 3 — Billing period + invoice generation
`POST /invoices` — body `{customerID, period_start, period_end}`.

- Bills from `usage_events.occurred_at` (when usage happened), never
  `received_at` (when the server got it) — a client offline for a day
  shouldn't have its usage silently reassigned to the wrong billing
  period.
- Period boundaries: `occurred_at >= period_start AND occurred_at <
  period_end` (start inclusive, end exclusive) — verified with a 5-row
  test dataset deliberately spanning the boundary (events at start,
  middle, end-of-day, exact boundary, and just-before), confirming
  exactly the expected 3/5 events matched.
- Duplicate invoice attempts for the same period return **409 Conflict**
  with the existing invoice in the response body, detected via Postgres
  error code `23505` (not a generic catch-all).
- Zero-usage periods are allowed to generate a $0.00 invoice — every
  customer/period pair gets exactly one invoice record, for audit
  completeness.
- Rejects invoice generation for a `period_end` in the future (**422**,
  not 400 — the request is well-formed, just semantically premature given
  the period hasn't ended).
  
### Phase 4 — Late-event handling
"Late" is **derived, not flagged** — an event with `invoice_id IS NULL`
whose `occurred_at` falls inside a period that already has an invoice is
implicitly late. No ingestion-time detection logic; kept deliberately
simple.

**Design chosen:** accept late events (never reject — the usage genuinely
happened), and support **correction invoices** rather than editing
already-generated invoices (real invoicing systems don't edit invoices
that have already been issued).

**Schema:**
- `usage_events.invoice_id` — nullable FK, chosen over a boolean
  `billed` flag specifically for traceability (which invoice billed this
  event, not just whether it was billed).
- `invoices.invoice_type` (`'original'` | `'correction'`) and
  `invoices.correction_sequence` (0 for originals; 1, 2, 3... for
  successive corrections per period) — the UNIQUE constraint was widened
  to `(customer_id, period_start, period_end, correction_sequence)` to
  allow multiple corrections per period without colliding with each
  other or the original.

**`createInvoice` was upgraded to a real DB transaction** (`BEGIN` /
`COMMIT` / `ROLLBACK`, single checked-out client) wrapping both the
invoice INSERT and the `usage_events.invoice_id` UPDATE — because a crash
between those two steps would leave an invoice that exists but doesn't
correctly reflect which events it covers, corrupting the very `invoice_id
IS NULL` signal the late-event logic depends on.

**Correction endpoint:** `POST /invoices/corrections` — finds unbilled
events in the period, computes count/amount directly from the fetched
rows (not a second query, avoiding a race between "what I counted" and
"what I link"), computes the next `correction_sequence`, and inserts +
links inside the same transactional pattern.

**Verified end-to-end (clean state):** 3 on-time events → original
invoice (`event_count=3`) → all 3 confirmed linked. 1 late event
inserted after invoicing → confirmed as the only unbilled row in the
period → correction invoice (`event_count=1, correction_sequence=1`) →
event confirmed linked. Re-running the correction endpoint with nothing
new to correct correctly returns 400, not a duplicate/empty invoice.

### Phase 5 — Load testing invoice generation under concurrency
**Hypothesis, reasoned through before testing (not guessed):** unlike the
naive Phase 2 counter, `createInvoice` never reads the `invoices` table
before attempting its INSERT — there's no read-then-write gap for two
concurrent requests to exploit. The UNIQUE constraint is enforced by
Postgres itself, at write time, so only one concurrent INSERT for the
same period can ever succeed, regardless of timing.

**Test:** fired 20 concurrent `POST /invoices` requests for the same
unbilled period.

**Result — hypothesis confirmed:**
| | Result |
|---|---|
| 201 Created | **1** |
| 409 Conflict | **19** |
| Other | **0** |

Verified both at the API layer (response counts) and the database layer
(`SELECT COUNT(*) FROM invoices WHERE ...` → exactly 1 row).

This test was designed to **validate an existing safety guarantee**, not
discover a bug — a deliberately different posture from Phase 2, where the
naive version was built and tested specifically *expecting* it to fail.

---

## Known limitations (explicitly accepted, not oversights)

1. **`correction_sequence` assignment is read-then-write, not atomic.**
   `SELECT MAX(correction_sequence)` happens before the transaction, not
   inside it. Two concurrent correction requests for the same period
   could theoretically compute the same next sequence number and one
   would fail on the UNIQUE constraint. Same race-condition class as the
   original Phase 2 bug — deliberately left unfixed here (would need a DB
   sequence or advisory lock) and documented rather than silently
   ignored, since corrections for the same period arriving concurrently
   is an unlikely scenario for this project's scope.
2. **`customer_usage_counts` is eventually consistent with
   `usage_events`, not transactionally guaranteed.** If the upsert fails
   independently of the event insert, the cache can drift briefly. This
   is an accepted tradeoff specifically because `usage_events` remains
   the recoverable source of truth.

---

## API summary

| Method | Path | Purpose |
|---|---|---|
| POST | `/usage-events` | Ingest a usage event (idempotent) |
| POST | `/customer-usage-counts/:customerID/increment` | Atomic counter increment (demo/test endpoint) |
| POST | `/invoices` | Generate an invoice for a billing period |
| POST | `/invoices/corrections` | Generate a correction invoice for late events in an already-invoiced period |

---

## Running the tests

```bash
# Phase 2 — counter concurrency (expects N succeeded, 0 failed at HTTP level;
# verify final total_count in DB separately)
node scripts/load_tests.js [num_requests] [customerID]

# Phase 5 — invoice generation race test (expects 1 x 201, N-1 x 409)
node scripts/invoice_race_test.js [customerID]
```
