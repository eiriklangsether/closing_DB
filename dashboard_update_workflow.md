# Dashboard Update Workflow — closing_DB
*Reference for Claude and Eirik. Use this before any update to ensure nothing is missed.*

---

## How to use this document — read before every update

Before touching `index.html`, read this document and run the checklist that matches the update type (Chargebee, P&L, or CAC). **Never update from memory.** Every update — no exceptions — ends with the **Final reconciliation check** at the bottom of this doc.

### Golden rules (apply to every update)

1. **Home labels every time.** Refresh the `LANDING_META` dates on every update: `chargebee.{no,se,us,plg}.date` on every CB export (even if no new period is added), `financial.date` on every P&L import, `cac.date` on every CAC update. These drive the Home tab freshness labels. Stale Home labels are the most common "it looks like it didn't update" complaint.
2. **Check the past, not just the new month.** On every new extract, diff all months earlier than the latest against the incoming data. If any figure changed: (a) notify Eirik with the specific before→after, and (b) add a `CHANGELOG` entry. Never silently overwrite history.
3. **Manual corrections are canonical facts.** Any correction already applied and logged is a fact. If a fresh export disagrees with a previously-applied manual correction (e.g. the Sparebank 1 split, a periodisation timing fix), do NOT overwrite it — flag the conflict to Eirik and reconcile before changing anything.
4. **Notify on new customers.** If a new CB customer appears, add it to `CUSTOMER_META` (and `NAME_OWNER_MAP`) and tell Eirik explicitly.
5. **One source of truth.** Every card and graph for a given period must trace back to the same underlying constants. Hardcoded values are the main risk — the Final reconciliation check exists to catch them.

---

## Data sources overview

| Source | How it enters the dashboard | Trigger |
|---|---|---|
| Chargebee (NO, SE, US, PLG) | Claude export → constants in `index.html` | New CB month available |
| Financial P&L (Conso_Reporting) | Claude manual entry → `renderFin` arrays | New closed month |
| CAC costs (CAC_calculation file) | Claude manual entry → `CAC_DATA` | New cost month available |
| Sales reports (SalesScreen export) | Claude manual entry → `CAC_DATA.customers` | New deals closed |
| Renewal pipeline (Chargebee contract terms) | Claude live CB pull → `RENEWAL_SUBS` constant | New CB month / ad hoc |
| Home page status dates | Claude manual entry → `LANDING_META` constant | After every data update |
| Closing checks | Claude API call → KV `/api/data` | Monthly close run |
| Owner overrides | User edits → KV `/api/overrides` | Ad hoc |
| CAC deal overrides | User edits → KV `/api/overrides-cac` | Ad hoc |

---

## Tab 0 — Home

The Home tab is the default landing page. It shows data freshness status for all four sources and brief method notes. All status dates are hardcoded in the `LANDING_META` constant near the top of the JS constants block in `index.html`.

**`LANDING_META` structure:**

```js
const LANDING_META = {
  chargebee: {
    no:  { date: "Jun 25 2026", period: "Jun 2026" },
    se:  { date: "Jun 25 2026", period: "Jun 2026" },
    us:  { date: "Jun 25 2026", period: "Jun 2026" },
    plg: { date: "Jun 25 2026", period: "Jun 2026" }
  },
  financial: {
    date: "Jun 14 2026",   // date you pushed the update
    period: "May 2026"     // last closed month included
  },
  cac: {
    date: "Jun 14 2026",   // date you pushed the update
    period: "Jun 2025 – May 2026"  // L12M window covered
  }
};
```

**Update rule:** Update the relevant fields every time you push new data. `date` = the calendar date you ran the update. `period` = last month of data included (or window, for CAC).

**What is NOT updated here:** The tab renders `renderHome()` once on first visit and caches the result in `el._rendered`. If you push new `LANDING_META` values, the new deploy will reset this — no extra action needed.

---

## Tab 1 — Monthly close

**Data source:** KV store (`/api/data`), written by Claude when running monthly controls.

**Fields updated per close run:**
- `d.period` — the period label shown top-left (e.g. "May 2026")
- `d.updatedAt` — timestamp shown in header
- `d.no.checks[]` — auto checks for Dogu SalesScreen AS (depreciations, salary, periodisering, attestation queue, voucher reception)
- `d.se.checks[]` — auto checks for SalesScreen AB
- `d.us.checks[]` — auto checks for SalesScreen Inc.
- `d.manualChecklist[]` — static list of manual checklist items (defined in code, not KV)
- `d.manualChecks{}` — which manual entity checks are ticked (persisted in KV)
- `d.manual{}` — which manual checklist items are ticked (persisted in KV)

**What is NOT updated here:** MRR, financial figures, CAC. Those are separate triggers.

**Dependency:** None. This tab is fully self-contained.

---

## Tab 2 — Business KPIs

All data is derived from JS constants baked into `index.html`. Nothing is fetched from KV.

### Section: Scale · [selectedMonth]

| Card | Source constant | Field |
|---|---|---|
| MRR (total) | `MRR_NO`, `MRR_SE`, `MRR_US` | `totals_usd[month]` |
| MoM change | Derived from `totals_usd` | prev month vs selected |
| ARR | Derived: MRR × 12 | — |
| Customer count | `MRR_NO/SE/US` | `customer_counts[month]` |
| MoM customer delta | Derived from `customer_counts` | — |
| MRR waterfall | `MRR_NO/SE/US` | `movements[month]` (new_total, churned_total, expansion_total, contraction_total, new[], churned[], expansions[], contractions[]) |
| SalesRabbit line | `SR_MONTHLY` (hardcoded near L1777) | keyed by month |

**When to update:** Every new Chargebee month. Update `MRR_NO`, `MRR_SE`, `MRR_US`, `MRR_PLG`, `SNAPSHOTS`, and `SR_MONTHLY` if SalesRabbit has a balance.

### Section: Retention, growth & unit economics · L12M

| Card | Source | How computed |
|---|---|---|
| ARR (All / ICP) | `SNAPSHOTS` + `CUSTOMER_META` | Start/end snapshots over `MRR_NO.months[0]` to `months[-1]` |
| GRR | Derived from SNAPSHOTS | Retained capped MRR ÷ start MRR |
| NRR | Derived from SNAPSHOTS | Retained end MRR ÷ start MRR |
| YoY Growth | Derived from SNAPSHOTS | (end MRR − start MRR) ÷ start MRR |
| LTV (removed from grid, now in CAC section) | Derived | ARPU ÷ monthly churn rate |

**ICP filter:** Driven by `CUSTOMER_META[id].icp === true`. Update `CUSTOMER_META` when ICP status changes.

**When to update:** Every new CB month — `SNAPSHOTS` must include the new month for all entities.

### Section: CAC & LTV · L12M

| Card | Source | How computed |
|---|---|---|
| LTV | Derived from SNAPSHOTS + CUSTOMER_META | Real-time from retention calc above |
| CAC | `CAC_DATA` | Total cost ÷ deals, last 12 entries in `CAC_DATA` |
| LTV/CAC ratio | Derived from above two | LTV ÷ CAC |

**CAC_DATA entry fields (per month):**
- `month` — label e.g. "Jun 2025"
- `total_usd` — sum of all components
- `non_sal_usd` — GL-based costs (NOK × 0.0990)
- `sal_usd` — salary (already USD)
- `comm_usd` — commissions (already USD)
- `sales_sal`, `mkt_sal`, `sales_comm`, `mkt_comm` — breakdown components
- `deals` — count of Quantity=1 rows from reports export (SAP excluded)
- `new_arr` — sum of ARR from same rows
- `customers[]` — array of `{name, added, manual}` per deal

**L12M window:** Derived from last 12 entries in `CAC_DATA` array — NOT from `MRR_NO.months`. Currently Jun 2025–May 2026.

**When to update:** When new cost file + new reports export available. New entry appended to `CAC_DATA`. Window rolls forward automatically.

### Section: Trends

| Chart | Source | Data |
|---|---|---|
| ARR line chart | `MRR_NO/SE/US` totals | `totals_usd` × 12 |
| MRR line chart | `MRR_NO/SE/US` totals | `totals_usd` |
| MRR waterfall | `MRR_NO/SE/US` movements | `movements[selectedMonth]` |
| PLG MRR | `MRR_PLG` | `totals_usd` |

**When to update:** Same as Scale section — every new CB month.

---

## Tab 3 — Financial KPIs

**ALL values are hardcoded arrays in `renderFin()`.** Nothing is derived from CB constants. Must be updated manually after each closed P&L.

| Variable | What it is | Current range |
|---|---|---|
| `months` | X-axis labels | May'25 – May'26 |
| `opIncome` | Total operating income (USD) | 13 values |
| `prodRevIncSR` | Product revenue incl. SalesRabbit | 13 values |
| `prodRevExcSR` | Product revenue excl. SalesRabbit | 13 values |
| `opExpenses` | Total operating expenses (USD, negative) | 13 values |
| `ebitdaVals` | EBITDA (USD) | 13 values |
| `ebitdacVals` | EBITDAC (USD) — EBITDA excl. R&D capitalisation | 13 values |
| `profitVals` | Profit after tax (USD) | 13 values |
| `arrVals` | ARR (USD) | 13 values |
| `ebitdacMargin` | EBITDAC margin % | 13 values |
| `arrMay25` | ARR at May 2025 (YoY base) | Single value |
| `arrMay26` | ARR at May 2026 (YoY end) | Single value |
| `ebitdacMrg` | L12M EBITDAC margin % (for Rule of 40) | Single value |

**Hardcoded KPI headline cards (also manually updated):**

| Card | Current value | Notes |
|---|---|---|
| Total Operating Income | $8,073,825 | L12M sum |
| Product Revenue excl. SR | $7,131,800 | L12M sum |
| Product Revenue incl. SR | $7,778,398 | L12M sum |
| Total Operating Expenses | $(6,693,998) | L12M sum |
| EBITDA | $1,189,365 (14.7%) | L12M |
| Profit After Tax | $35,371 (0.4%) | L12M |
| EBITDAC | $653,115 (8.1%) | L12M, excl. R&D cap |
| Rule of 40 score (standard) | 20.7 | ARR growth YoY + EBITDAC margin |
| Rule of 40 score (Viking) | 18.1 | Adds Δ deferred revenue |

**Rule of 40 references hardcoded period labels** — "May 25 → May 26" must be updated when the window rolls.

**When to update:** After each new closed month P&L from Conso_Reporting. Append one value to every array, update headline cards, update `arrMay26` and the period label in Rule of 40.

---

## Tab 4 — Customer metadata

**Source:** `CUSTOMER_META` constant (CB-keyed, one entry per CB customer ID).

**Entry fields:** `name`, `entity`, `currency`, `customer_id`, `icp`, `logo`, `sf_account_id`, `owner_name`, `in_sf`, `cb_url`, `sf_url`, `latest_mrr_usd`, `latest_month`, `first_month`, `mrr{}` (per-month MRR map).

**Owner overrides:** User edits in the card UI → saved to KV `/api/overrides` under key `meta-overrides`. Overrides `owner_name` field.

**When to update:** Every new CB month — `CUSTOMER_META` is regenerated from the CB export. `latest_mrr_usd` and `latest_month` advance. `mrr{}` gains a new month entry.

**`NAME_OWNER_MAP`:** Separate constant mapping company name → owner. Updated alongside `CUSTOMER_META` to keep owner display consistent.

---

## Tab 5 — Export

**Source:** Derived entirely from `CUSTOMER_META` + `SNAPSHOTS` + `MRR_NO/SE/US`. No independent data. Updates automatically when those constants are updated.

---

## Tab 6 — Change log

**Source:** `CHANGELOG` constant array in `index.html`.

**Entry fields:** `date`, `side` (chargebee/financial), `upload`, `period`, `entity`, `customer`/`gl`/`gl_name`, `before`, `after`, `note`.

**When to update:** Every time a prior-period correction is made. Append a new entry. Current-month changes are not logged until the month closes.

---

## Tab 7 — Renewal pipeline

**Data source:** `RENEWAL_SUBS` constant in `index.html` — a flat array of subscription-level rows pulled **live from Chargebee** (NO, SE, US), not derived from the MRR constants. Each row is one subscription.

**How it is built:**
1. Pull `list_subscriptions` for each site with `filters_json {"status":{"in":["active","non_renewing"]}}` and `include_fields_json` covering `mrr`, `current_term_end`, `next_billing_at`, `contract_term`, `subscription_items`. Paginate (NO is 3 pages; the MCP offset can stall at the 200-row boundary — if a page returns 0 new rows, fall back to the previously captured page).
2. **Flag supporters** from `subscription_items[].item_price_id` (prefix `supporter` / `salesscreen-supporters`). Supporters are almost all $0, but a few are tiny non-zero (e.g. Nova ehf EUR 4.90, Meglerhuset Nylander NOK 75.58) — detect by plan id, **not** by `mrr==0`. Several customers hold both a paid sub and a supporter sub; only the supporter sub is dropped.
3. **Exclude supporters entirely.**
4. Convert MRR to USD at fixed FX. Compute `cend` (= `contract_term.contract_end`, fallback `current_term_end`), `nba` (= `next_billing_at`), day-offsets from the as-of date, and a `notice` flag (inside the cancellation-notice window now = `contract_end − cancellation_cutoff_period ≤ today < contract_end`).

**Row fields:** `entity`, `company`, `ccy`, `mrr` (USD), `cend`, `cendDays`, `nba`, `nbaDays`, `action` (renew/cancel at term end), `status` (active/non_renewing), `notice`.

**Also update:** `RENEWAL_ASOF` (the as-of date string shown in the tab) and `LANDING_META.renewals` `{date, period}`.

**Two date bases (both shown):** contract end (cranberry) is the churn-decision point — when the customer can actually leave; next billing (teal) is cash timing. A multi-period contract billed more frequently sits on its renewal date, not its next invoice.

### MRR reconciliation — RED FLAG rule

The tab sums renewal-book MRR per entity (all active + non-renewing, supporters excluded) and compares it to **Business KPIs current-month MRR** (`MRR_{NO,SE,US}.totals_usd[latest month]`). This runs live in `rnRecon()` every render.

- Tolerance is **±0.5%** (`RENEWAL_TOL = 0.005`).
- Within tolerance → green "Reconciled" banner.
- Beyond tolerance on any entity → **red banner + red status dot**. This is a genuine flag: a missing entity, a stale/incorrect MRR constant, a Chargebee pull gap, or supporters not excluded correctly.
- Expected residual: SE and US reconcile to the dollar; NO carries a small (~0.05–0.10%) drift from snapshot timing and curation between the live pull and the monthly MRR export — this is normal and stays green. Supporters are excluded from the renewal book but are ~$0, so they do not move the reconciliation.

**When a real break appears, do not just widen the tolerance** — find the cause (most often a forgotten MRR constant update or an entity that failed to pull).

**When to update:** Every new Chargebee month, and any time the live book is re-pulled. The reconciliation makes a stale pull visible immediately.

---

## Complete update checklist — new Chargebee month

Run in this order. Do not skip the verify/notify steps.

- [ ] **1. Export CB** for all four sites (NO, SE, US, PLG) for the new month
- [ ] **2. Apply Sparebank 1 split** (NO only) — check if total changed vs prior month; if unchanged apply fixed split (LiveScreen NOK 490/mo, SalesScreen NOK 38,981.25/mo). If the total changed, ask Eirik for the new split before updating.
- [ ] **3. Check prior months for restatements** — diff every month earlier than the new one against the incoming export. If any MRR / customer / movement figure changed: **notify Eirik (before→after)** and add a `CHANGELOG` entry (side: chargebee). Do not silently overwrite history.
- [ ] **4. Update `MRR_NO`** — add new month to `months[]`, `totals_usd{}`, `customer_counts{}`, `movements{}` (churn/contraction stored **negative**)
- [ ] **5. Update `MRR_SE`** — same
- [ ] **6. Update `MRR_US`** — same
- [ ] **7. Update `MRR_PLG`** — same
- [ ] **8. Update `SNAPSHOTS`** — add new month snapshot for all four entities
- [ ] **9. Update `CUSTOMER_META`** — regenerate from new CB export (latest_mrr_usd, latest_month, mrr{} entry). **If any new customer appears: add it AND notify Eirik explicitly.**
- [ ] **10. Update `NAME_OWNER_MAP`** — add any new customers
- [ ] **11. Update `SR_MONTHLY`** — add new month (usually 0 from Dec 2025 onwards)
- [ ] **12. Update `LANDING_META.chargebee`** — set `date` to today and `period` to the new month for all four sites (NO, SE, US, PLG). Refresh the date on every export, even if no new period is added.
- [ ] **13. Refresh `RENEWAL_SUBS`** — re-pull active + non-renewing subs (NO, SE, US) live from Chargebee, exclude supporters by plan id, convert to USD; update `RENEWAL_ASOF` and `LANDING_META.renewals`
- [ ] **14. Log corrections** — confirm every restatement found in step 3 has a `CHANGELOG` entry
- [ ] **15. Verify Business KPIs tab** renders the new month across ALL of: MRR card, ARR card, Active customers card, all 8 cards under Retention/growth/unit economics, LTV & CAC (if a CAC month also landed), ARR graph, Monthly MRR graph, MRR waterfall **+ the MoM movement detail modal**, PLG graph
- [ ] **16. Verify** Retention grid L12M window has rolled correctly
- [ ] **17. Verify** Customer metadata tab shows new customers
- [ ] **18. Verify** Renewals tab MRR reconciliation is green for all entities (red = investigate, do not widen tolerance)
- [ ] **19. Verify** Home tab shows the correct updated dates
- [ ] **20. Run the Waterfall integrity check** (see section below)
- [ ] **21. Run the Final reconciliation check** (bottom of doc)

---

## Complete update checklist — new closed P&L month

Run after Chargebee update is complete.

- [ ] **1. Get new Conso_Reporting** with the closed month
- [ ] **2. Check prior months for restatements** — diff every month earlier than the new one against the incoming P&L. If any figure changed: **notify Eirik (before→after)** and add a `CHANGELOG` entry (side: financial).
- [ ] **3. Append to all `renderFin` arrays** (opIncome, prodRevIncSR, prodRevExcSR, opExpenses, ebitdaVals, ebitdacVals, profitVals, arrVals, ebitdacMargin)
- [ ] **4. Update `months` array** in renderFin — append new label e.g. "Jun'26"
- [ ] **5. Recalculate all General Group Performance / headline cards** — rolling L12M sum for each metric (Total Operating Income, Product Rev excl. SR, Product Rev incl. SR, Total Operating Expenses, EBITDA, Profit After Tax, EBITDAC) **and their margin subtitles**
- [ ] **6. Update `arrMay26`** (or equivalent YoY end value) and `ebitdacMrg` when the year/window rolls
- [ ] **7. Update Rule of 40 period label** ("May 25 → May 26") when window moves
- [ ] **8. Update BOTH Rule of 40 scores** — standard (ARR growth YoY + EBITDAC margin) and Viking (adds Δ deferred revenue). **If Eirik has not provided the deferred revenue numbers, remind him — the Viking score cannot be recomputed without them.**
- [ ] **9. Update `LANDING_META.financial`** — set `date` to today and `period` to the new closed month
- [ ] **10. Verify** Financial KPIs tab renders correctly
- [ ] **11. Verify** Home tab shows the correct financial date and period
- [ ] **12. Run the Final reconciliation check** (bottom of doc)

---

## Complete update checklist — new CAC month

- [ ] **1. Get updated cost file** (CAC_calculation_20XX.xlsx)
  - Non-salary: CAC pivots → Grand Total row → new month column (NOK × 0.0990)
  - Salary: Salary by market → row 7 (Field Sales total) + row 20 (Marketing total)
  - Commissions: Commissions tab → row 3 (Marketing) + row 10 (Sales)
- [ ] **2. Get new reports export** from SalesScreen — filter Quantity=1, exclude SAP
- [ ] **3. Append new entry to `CAC_DATA`** with all fields populated
- [ ] **4. Update `LANDING_META.cac`** — set `date` to today and `period` to the new L12M window (e.g. "Jul 2025 – Jun 2026")
- [ ] **5. Verify L12M window** — should now include the new month, dropping the oldest
- [ ] **6. Verify deal counts** match the reports export (Quantity=1 filter applied)
- [ ] **7. Update methodology note** if source file format changes
- [ ] **8. Verify** Home tab shows the correct CAC date and period

---

## Final reconciliation check — run at the END of every update

Purpose: guarantee every visible number traces back to the same data for the same period, and that no stale hardcoded value survived.

1. **Same-period trace.** For the newly added month, confirm the MRR card, ARR card, Active customers, ARR/MRR graphs and waterfall all read the updated `MRR_*` / `SNAPSHOTS` for that month — not a leftover value.
2. **Waterfall arithmetic.** Start + New + Expansion + Churn + Contraction = End `totals_usd` (churn & contraction negative). See Waterfall integrity check.
3. **CAC/LTV window.** Confirm CAC & LTV is exactly one month behind the MRR window (by design) and all its labels derive from `CAC_DATA.slice(-12)`.
4. **Hardcoded sweep — the main risk.** Re-verify every manual field, because none recompute themselves:
   - `renderFin` headline / General Group Performance card values and margin subtitles
   - Rule of 40 scores (standard + Viking) and the period label
   - `arrMay25` / `arrMay26`, `ebitdacMrg`
   - `SR_MONTHLY` new month
   - `LANDING_META.chargebee.{no,se,us,plg}`, `LANDING_META.financial`, `LANDING_META.cac`, `LANDING_META.renewals` — dates and periods
   - Any value hardcoded into `render()` on the Monthly Close tab (KV auth bypass)
5. **Cross-entity totals.** Group MRR total = NO + SE + US (+ PLG where shown). Confirm they reconcile; the Renewals tab reconciliation should be green.
6. **Mechanics.** `curl` / `git pull` the live file before editing so you never edit a stale copy; `node --check` the script block before committing; never push a dashboard where two cards disagree on the same metric.
7. If anything fails to reconcile, fix before pushing.

---

## Field dependency map

```
MRR_NO.totals_usd
  → Scale section MRR card
  → ARR card (× 12)
  → ARR line chart
  → MRR line chart
  → Retention grid (start/end snapshots via MRR_NO.months[0] and months[-1])
  → LTV calculation (ARPU from retention)

MRR_NO.movements
  → MRR waterfall chart
  → Waterfall detail modal (new/churned/expansion/contraction lists)

MRR_NO.customer_counts
  → Scale section customer count card
  → MoM customer delta

SNAPSHOTS[entity][month]
  → Retention grid (GRR, NRR, YoY)
  → LTV (ARPU, churn rate)
  → LTV modal churned/retained customer lists
  → Customer metadata tab (current MRR per customer)
  → Export tab

CUSTOMER_META
  → Customer metadata tab (all cards)
  → ICP filter on retention grid
  → ICP badge on CAC deals list
  → Owner display (with NAME_OWNER_MAP)
  → Mapping issues filter

CAC_DATA (last 12 entries)
  → CAC card (total cost ÷ deals)
  → LTV/CAC ratio (uses LTV from retention calc)
  → CAC modal: monthly summary, deals list, cost breakdown

renderFin arrays (opIncome, ebitdaVals, etc.)
  → Financial KPIs headline cards
  → Financial KPIs sparklines
  → Rule of 40 score
  → These are INDEPENDENT of MRR constants — must be updated separately

CHANGELOG
  → Change log tab only
  → No other component reads it
```

---

## Known manual fields (not derived)

These are hardcoded values that require explicit human input — they cannot be calculated from other constants:

| Field | Location | Notes |
|---|---|---|
| `renderFin` headline card values | L2214–2220 | L12M sums, recalculate from arrays |
| `renderFin` EBITDA/EBITDAC margin % subtitles | L2218–2220 | Must match array values |
| Rule of 40 score (20.7 / 18.1) | L2235, L2260 | Recalculate when new month added |
| Rule of 40 period label ("May 25 → May 26") | L2242 | Update when YoY window rolls |
| `arrMay25`, `arrMay26` | L2194–2195 | Update `arrMay26` each new month |
| `ebitdacMrg` (L12M margin %) | L2197 | Used in Rule of 40 |
| `SR_MONTHLY` values | L1777 | SalesRabbit monthly MRR |

---

## FX rates (fixed — never update unless LG rate policy changes)

| Pair | Rate |
|---|---|
| NOK → USD | 0.0990 |
| SEK → USD | 0.1056 |
| EUR → USD | 1.1658 |
| GBP → USD | 1.3390 |

Used in: `const FX` (MRR conversion), CAC non-salary conversion, CUSTOMER_META mrr_usd fields.

---

## Waterfall integrity check (run after every CB update)

The waterfall has a known historical sign convention bug (fixed Jun 2026) where contraction amounts were incorrectly added rather than subtracted. After every update, verify the waterfall is arithmetically correct:

**Manual check formula:**
```
End MRR = Start MRR + New + Expansion + Churn + Contraction
```
where Churn and Contraction are **negative numbers** stored in `movements[month].churned_total` and `contraction_total`.

**Verification step after each CB month update:**
1. Note the `totals_usd` for the period start month (e.g. Jan 2026 = $625,143)
2. Sum all movements for the intervening months (period start+1 through end)
3. Compute: Start + New + Expansion + Churn + Contraction
4. Result must match `totals_usd` for the period end month exactly (within $1 rounding)
5. If it doesn't: check sign convention — contractions must be negative in `movements[month].contraction_total`

**Root cause of the bug (for reference):**
L939 in renderMRR used `Math.abs(r.mrr)` on contraction rows during aggregation, flipping them positive. Since `drawWaterfall` does `startMRR + ... + conMRR` (addition, not subtraction), the contraction was being added instead of subtracted — inflating End MRR by exactly 2× total contraction. Fixed by removing `Math.abs()`.

**Quick console check:**
In browser console on the Business KPIs tab, after selecting a period:
```js
// Should equal totals_usd[periodEnd]
window._lastWaterfallCheck  // not yet implemented — add if needed
```
For now, verify manually using the formula above against the Scale section MRR card.

---

## Manual edits to CUSTOMER_META fields — downstream impact

Fields editable via the Customer Metadata tab UI are saved to KV `/api/overrides` and applied at runtime on top of the base `CUSTOMER_META` constant. The override takes precedence over the baked-in value.

### Logo field (`CUSTOMER_META[id].logo`)

The `logo` field groups multiple CB customers under a single company umbrella. It is used in **four distinct places** — editing it affects all of them:

| Where | What it affects |
|---|---|
| **Logo churn calculation** (LTV, retention grid) | `buildLogoMRR()` at L1090 groups customers by `c.logo \|\| cid`. A logo is churned only when ALL customers under that logo reach zero MRR. Changing a logo merges or splits groups — directly changes logo churn rate and therefore LTV. |
| **Customer metadata tab** | Logo/Group column shown in the card and search results. Search also matches against logo field. |
| **Export tab** | Logo / Group column included in the CSV export when at least one customer has a logo set. |
| **LTV modal churned/retained list** | Customers are shown individually, but the logo churn rate that feeds LTV is computed from the logo groupings above. |

**Rule:** If you edit a logo to merge two customers under one umbrella (e.g. two subsidiaries of the same company), the logo churn rate will only fire when both reach zero MRR — potentially reducing apparent churn and increasing LTV. This is intentional and correct behaviour, but always check LTV before and after a logo edit to confirm the impact.

**After any logo edit:**
- [ ] Verify retention grid GRR/NRR haven't shifted unexpectedly
- [ ] Verify logo churn LTV is still in a reasonable range
- [ ] If the edit merges accounts that were previously counted as separate churns, note this in the change log

### ICP field (`CUSTOMER_META[id].icp`)

| Where | What it affects |
|---|---|
| **Retention grid** | ICP row shows GRR/NRR/YoY/LTV for ICP-only customers |
| **CAC deals list** | ICP badge shown next to customer name in New Deals tab |
| **LTV/CAC section** | ICP segment toggle uses `c.icp === true` to filter |
| **Customer metadata tab** | ICP badge shown on customer card |

**After any ICP edit:** verify the ICP row in the retention grid and the ICP LTV card still reflect the intended universe.

### LiveScreen field (`CUSTOMER_META[id].livescreen`)

| Where | What it affects |
|---|---|
| **Logo churn / LTV** | LiveScreen customers excluded from all LTV and CAC calculations (`if c.livescreen === true return`) |
| **CAC deals list** | No direct effect — CAC deals are sourced from reports export, not CUSTOMER_META |

### Summary: fields that require a downstream check after manual edit

| Field edited | Check retention grid | Check LTV card | Check CAC deals | Check export |
|---|---|---|---|---|
| `logo` | ✅ | ✅ | ❌ | ✅ |
| `icp` | ✅ | ✅ | ✅ | ❌ |
| `livescreen` | ✅ | ✅ | ❌ | ❌ |
| `owner_name` | ❌ | ❌ | ❌ | ✅ |

---

## CAC & LTV period vs rest of Business KPIs — critical note

**The CAC & LTV section runs on a different period than the rest of the Business KPIs tab.** This is by design and must be maintained consistently.

### Why the periods differ
The rest of Business KPIs (Scale, Retention grid, Trends) follows the MRR months array — currently **Jul 2025 → Jun 2026**. This updates automatically every time a new CB month is added.

The CAC & LTV section is bounded by available CAC cost data. Since GL costs from the CAC pivots file lag by ~1 month, the CAC window always ends one month behind the MRR window. Currently **Jun 2025 → May 2026**.

### Where the period is displayed — must be updated together

Every time a new CAC month is added, check and update ALL of the following:

| Location | What shows the period | How it's set |
|---|---|---|
| Section heading | "CAC & LTV · Jun 2025 – May 2026" | Derived from `CAC_DATA.slice(-12)` — **updates automatically** |
| Toggle row (next to churn/ICP buttons) | "Jun 2025 – May 2026" | Derived from `months12` — **updates automatically** |
| LTV card modal subtitle | "LTV retention window: Jun 2025 → May 2026 · Gross margin excluded" | `_ltvData.startM` / `_ltvData.endM` — derived from `CAC_DATA` — **updates automatically** |
| CAC modal formula box | "Cost window: Jun 2025 → May 2026" | Derived from `months12` — **updates automatically** |

All four update automatically when a new entry is appended to `CAC_DATA`. No manual label changes needed.

### What does NOT automatically align

The **LTV value itself** is computed from SNAPSHOTS data using the MRR months array (Jul 2025 → Jun 2026), not the CAC window — because Jun 2025 snapshots are missing for NO and US entities. The period label shows Jun 2025 → May 2026 for consistency, but the underlying churn rate and ARPA use Jul 2025 → Jun 2026 snapshots.

**When Jun 2025 is added to SNAPSHOTS for all entities (NO, US):** update `_ltvData` computation to use the CAC window snapshots. Currently only SE has Jun 2025.

### Update sequence when a new CAC month arrives

1. Append new entry to `CAC_DATA` — section heading, toggle row, modal labels all update automatically
2. Verify the section heading shows the correct new window (e.g. "Jul 2025 – Jun 2026" once Jun 2026 costs land)
3. Verify the LTV modal subtitle matches
4. Verify the retention grid section heading still correctly reads "Retention, growth & unit economics · L12M" (it uses the MRR window — that's correct and intentional)
5. The two sections will always be one month offset from each other — this is expected

### Never do this
- Do not manually hardcode a date period string anywhere in the CAC & LTV section — all dates derive from `CAC_DATA` dynamically
- Do not update the CAC & LTV period label without also having the cost data to back it up — the label and the data must always be in sync
