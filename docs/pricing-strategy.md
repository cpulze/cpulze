# cpulze — Pricing Strategy
### Mentor Review Document | June 2026

---

## 1. Business Context

cpulze is an AI Narrative Management consultancy for independent hotels. The problem: when potential guests search for hotels on Perplexity, ChatGPT, or Gemini, AI engines synthesise narrative from aggregated reviews — and for most independent hotels, that narrative is unmanaged, often unfavourable, and invisible to the owner.

cpulze identifies those narratives, corrects them through structured counter-narrative infrastructure, and monitors them on an ongoing basis.

**Target client:** Independent hotels, 20–100 rooms, family-owned, UK / US / India.
**Business ambition:** 30 hotel relationships by end of Year 1, 60 by end of Year 2. Quality over volume — a 3-person team delivering meaningful outcomes, not a volume SaaS play.

---

## 2. Product Architecture

Four products, each with one job. Client-facing names replace the internal working names — built for hotel owners, not procurement teams.

| Internal Name | Client-Facing Name | What It Does | Type |
|---------------|---------------------|--------------|------|
| LOOK | **AI Mirror** | AI Narrative Scan — 3 engines × 8 themes + Narrative Risk Score. Shows the hotel exactly what AI is telling their guests. | One-time |
| FIX | **Owner Voice** | AI Mirror embedded + Recommendations + Narrative Ledger + Owner Voice entries. The only product that changes what AI says about the hotel. | Annual |
| COMPETE | **Who's Winning** | AI Mirror for the hotel + 2 competitors + comparative analysis. Shows which property AI is recommending over yours, and why. | One-time |
| WATCH | **Keep Vigil** | Monthly monitoring + alerts across AI engines. Tracks narrative shifts. Protects what Owner Voice builds. | Annual |

**Design principle:** Owner Voice is the bestseller and recurring revenue engine. AI Mirror is the entry product that converts to Owner Voice. Who's Winning and Keep Vigil are the intelligence and protection layers. Neither Who's Winning nor Keep Vigil changes anything on their own — only Owner Voice provides the infrastructure that AI engines can discover and cite as counter-narrative.

**Customer journey:**
```
AI Mirror  →  Owner Voice  →  Keep Vigil
                   ↕
              Who's Winning
```

---

## 3. Pricing Strategy

**Annual contracts, not monthly SaaS.** Independent hotel owners budget annually. Their OTA, PMS, and marketing relationships are all annual. Annual contracts mirror how they already buy and protect against churn.

**One price per country, no tiers.** A single median price targets the right segment (independent boutique, 30–70 rooms) without friction. Hotels that push back on price are not the right clients.

**Payment flexibility on annual products.** Monthly plan on a 12-month commitment for cash-conscious owners. Annual upfront at 20% off for owners who plan ahead — and for cpulze, stronger cash flow to fund the next hire.

---

## 4. Master Price Card

| Product | Type | UK | US | India | Delivery Frequency | Deliverable Contains |
|---------|------|----|----|-------|---------------------|------------------------|
| **AI Mirror** | One-time | £497 | $597 | ₹14,999 | Once, within 2 weeks | Narrative Risk Score (0–100), verbatim AI outputs across 3 engines, 8-theme breakdown, pattern identification, executive summary |
| **Owner Voice** | Annual | £97/mo or £930/yr | $117/mo or $1,120/yr | ₹2,999/mo or ₹28,999/yr | Recommendations + live Ledger in 4 weeks; monthly Ledger update + Owner Voice entry; full re-scan at Month 12 | Recommendations report, live Narrative Ledger page, monthly content update, Owner Voice entry, year-end narrative re-scan |
| **Who's Winning** | One-time | £997 | $1,197 | ₹29,999 | Once, within 3 weeks | Narrative Risk Score (your hotel vs 2 competitors), 8-theme side-by-side, AI citation gap analysis, opportunity map |
| **Keep Vigil** | Annual | £79/mo or £760/yr | $97/mo or $930/yr | ₹2,299/mo or ₹21,999/yr | Monthly report; real-time alerts as they occur | Narrative shift report across 3 engines, alert log, quarterly trend summary |

*Annual upfront saves 20% vs monthly plan. All annual products on 12-month commitment.*

---

## 5. Hotels vs Contracts

**30 hotels, not 30 contracts.** Track client relationships (hotels), not contract count. Each hotel relationship is anchored by one Owner Voice annual contract. Keep Vigil is a second contract within the same relationship. AI Mirror and Who's Winning are one-time transactions, not contracts.

So 30 hotels in Year 1 realistically means:
- 30 Owner Voice contracts
- ~9–10 Keep Vigil contracts (30% of hotels adding ongoing monitoring)
- 6–8 Who's Winning transactions
- 20–25 AI Mirror transactions (most hotels' entry point)

**For the mentor conversation:** position growth as hotel relationships, not contract count. Revenue per hotel grows as they add Keep Vigil and Who's Winning — the metric that matters is retention and expansion per hotel, not total contracts signed.

---

## 6. Revenue Model

| Milestone | Hotels | Estimated Annual Revenue |
|-----------|--------|----------------------------|
| End Year 1 | 30 | ~£35,000 |
| End Year 2 | 60 | ~£60,000 |

**Revenue mix at 60 hotels (Year 2):**

| Stream | Share |
|--------|-------|
| Owner Voice — renewals (30 existing) | ~39% |
| Owner Voice — new onboarding (30 new) | ~20% |
| Keep Vigil annual | ~17% |
| AI Mirror + Who's Winning | ~24% |

---

## 7. Renewal and Pre-Sales Machinery

The mentor will push on this. The answer needs to show it's systematic, not reactive.

**Three-stage renewal cycle, built into every Owner Voice engagement from Day 1:**

| Stage | Timing | Action |
|-------|--------|--------|
| **Proof of Value** | Month 10 (60 days before renewal) | Annual narrative re-scan delivered — shows before/after AI narrative shift. This is the renewal's justification, not a sales call. |
| **Renewal Conversation** | Month 11 (30 days before) | Review call: what changed, what Year 2 focuses on, renewal options presented (monthly or annual upfront). Keep Vigil upsell if not already on it. |
| **Invoice Issued** | Month 11.5 | Confirmed renewal invoiced. Non-renewal escalated with a final value summary. |

The hotel knows this cycle from the engagement letter on Day 1 — the Month 12 re-scan is a named deliverable in the contract, not a surprise. Renewal becomes a natural extension of that conversation, not a cold ask.

**Upsell triggers within the relationship:**

| Upsell | Trigger Point | What Prompts It |
|--------|---------------|-------------------|
| AI Mirror → Owner Voice | Within 90 days of AI Mirror delivery | The report shows the problem; a 90-day credit window (mirror cost applied against Year 1) creates urgency |
| Owner Voice → Keep Vigil | Month 3–4 | Ledger is live, first AI citation shifts visible — now there's something worth protecting |
| Owner Voice → Who's Winning | Month 6 or at renewal | "Your narrative is stabilising — which hotel is AI still recommending over yours?" |

This gives a natural 12-month engagement arc where every touchpoint either retains or expands the relationship.

---

## 8. Team Build

| Phase | Hotels | Team | Key Addition |
|-------|--------|------|----------------|
| Now – Month 6 | 0–10 | Founder only | — |
| Month 6–12 | 10–30 | 2 | AI Analyst, India-based |
| Month 12–18 | 30–45 | 3 | Ledger & Delivery, India-based |
| Month 18–24 | 45–60 | 3 (stable) | Team delivering at full capacity |

India-based hires (₹10–12L/year ≈ £9,500–£11,400) scale delivery without UK payroll pressure on the founder. By end of Year 2: founder owns strategy, sales, and client relationships; the two-person India team owns scan delivery, Ledger maintenance, and Keep Vigil reporting.

---

## 9. Strategic Bets

1. **Owner Voice is the recurring anchor.** Every other product exists to acquire or retain an Owner Voice client.
2. **The category is new.** Names and pricing must signal credibility without sounding like a generic audit firm — hence AI Mirror, Owner Voice, Who's Winning, Keep Vigil rather than clinical labels.
3. **Annual contracts protect the business.** Predictable revenue enables confident hiring.
4. **Quality at 60 clients beats volume at 600.** Reputation compounds in a niche market.
5. **India team scales delivery.** Founder leverage grows without proportional cost.
