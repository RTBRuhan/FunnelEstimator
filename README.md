# Funnel Estimator — Capital Efficiency & Growth Modeler

Institutional-grade SaaS capital-efficiency modeler for VC-backed founders preparing Seed and Series A/B board packs. Vanilla HTML, CSS, and JavaScript. Zero dependencies. All math runs in the browser.

Open `index.html` locally, or use any static host.

## What it models

- SaaS Magic Number, Burn Multiple, NRR, GRR, Quick Ratio
- Channel-segmented CAC with exponential saturation and conversion decay
- 12–24 month cash path, cash trough, and minimum venture funding to avoid default
- Weibull or mixture log-normal cohort retention (steep months 1–3, then flattening)
- Board diligence flags: LTV:CAC, CAC payback, burn multiple, Magic Number

---

## Mathematical specification

Notation: \(t\) in months. \(e\) monthly expansion. \(c\) monthly contraction. \(GM\) gross margin. ARPU is monthly average revenue per paying customer.

### 1. Cohort survival

**Weibull** (default). Shape \(k < 1\) is a decreasing hazard — steep early logo loss, then a flattening tail:

\[
S(t) = \exp\left(-\left(\frac{t}{\lambda}\right)^{k}\right), \quad S(0) = 1
\]

Monthly logo retention from age \(t-1\) to \(t\):

\[
r(t) = \frac{S(t)}{S(t-1)}, \qquad \text{churn}(t) = 1 - r(t)
\]

**Mixture log-normal** (onboarding mass + long-lived core):

\[
S(t) = w\,S_{\text{fast}}(t) + (1-w)\,S_{\text{slow}}(t)
\]

\[
S_i(t) = 1 - \Phi\left(\frac{\ln t - \mu_i}{\sigma_i}\right)
\]

\(\Phi\) is the standard normal CDF, evaluated with the Abramowitz–Stegun erf approximation.

### 2. NRR and GRR

On surviving dollars, expansion and contraction compound independently of logo survival:

\[
\mathrm{GRR}(t) = S(t)\,(1-c)^{t}
\]

\[
\mathrm{NRR}(t) = S(t)\,\min(\kappa,(1+e)^{t})\,(1-c)^{t}
\]

\(\kappa\) is the expansion cap (default \(2.5\times\) starting ARPU) so NRR above 100% does not imply infinite LTV.

Headline NRR/GRR are the modeled 12-month cohort values (what a diligence model will underwrite). The ledger also reports realized monthly New / Expansion / Contraction / Churned MRR on the live book.

### 3. SaaS Magic Number

Last complete quarter in the horizon, versus prior-quarter sales & marketing:

\[
\text{Magic Number} = \frac{\text{Net New ARR}_Q}{\text{S\&M}_{Q-1}} = \frac{12 \times (\mathrm{MRR}_t - \mathrm{MRR}_{t-3})}{\sum_{i=t-5}^{t-3} \mathrm{S\&M}_i}
\]

| Value | Grade |
| --- | --- |
| \(< 0.75\) | Poor |
| \(0.75\)–\(1.0\) | Efficient |
| \(> 1.0\) | High Growth |

### 4. Burn Multiple

\[
\text{Burn Multiple} = \frac{\text{Net Burn}_Q}{\text{Net New ARR}_Q}
\]

Net burn in a month is \(-\mathrm{EBITDA}_t\). Negative burn (profit) is reported as \(0\) when net-new ARR is non-positive. Flagged above \(2.0\times\).

### 5. Quick Ratio

\[
\text{Quick Ratio}_t = \frac{\text{New MRR}_t + \text{Expansion MRR}_t}{\text{Contraction MRR}_t + \text{Churned MRR}_t}
\]

VC health threshold: \(> 4.0\). Undefined denominator (no leakage) is treated as \(\infty\).

### 6. Dynamic CAC and non-linear conversion

Each channel (Inbound/PLG vs Outbound/Paid) has baseline capacity \(L_0\), elasticity \(\lambda\), conversion decay \(\mu\), and a hard ceiling \(L_0 \times \kappa\).

\[
s = \max\left(0,\ \frac{L - L_0}{L_0}\right)
\]

\[
\mathrm{CAC}(L) = \mathrm{CAC}_0 \cdot e^{\lambda s}, \qquad \mathrm{CR}(L) = \mathrm{CR}_0 \cdot e^{-\mu s}
\]

Leads above the ceiling are unfilled demand (saturation). Inbound defaults: low \(\lambda\), tight \(\kappa\). Paid defaults: higher \(\lambda\), farther \(\kappa\) — linear until capacity, then diminishing returns.

New logos and S&M:

\[
\text{Prospects}_c = L_c \times \text{interest rate}
\]
\[
\text{Customers}_c = \text{Prospects}_c \times \mathrm{CR}_c(L)
\]
\[
\mathrm{S\&M} = \sum_c \text{Customers}_c \times \mathrm{CAC}_c(L)
\]

Blended CAC is S&M / new logos.

### 7. Gross-profit LTV and CAC payback

Undiscounted 60-month cohort LTV (headline) and discounted LTV (WACC \(r\)). Expansion is capped at \(\kappa\):

\[
\mathrm{LTV} = \sum_{t=1}^{60} \mathrm{ARPU}\cdot S(t)\cdot\min(\kappa,(1+e)^{t})\cdot(1-c)^{t}\cdot GM
\]

\[
\mathrm{LTV}_{\text{DCF}} = \sum_{t=1}^{60} \frac{\mathrm{ARPU}\cdot S(t)\cdot\min(\kappa,(1+e)^{t})\cdot(1-c)^{t}\cdot GM}{(1+r_{\text{m}})^{t}}
\]

where \(r_{\text{m}} = (1+r)^{1/12}-1\).

\[
\text{Payback} = \min\left\{ T : \sum_{t=1}^{T} \mathrm{ARPU}\cdot S(t)\cdot\min(\kappa,(1+e)^{t})\cdot(1-c)^{t}\cdot GM \ge \mathrm{CAC} \right\}
\]

### 8. Cash, trough, and minimum venture funding

\[
\mathrm{EBITDA}_t = GM \cdot \mathrm{MRR}_t - (\text{Fixed OpEx} + \text{Other} + \mathrm{S\&M}_t)
\]

\[
\mathrm{Cash}_t = \mathrm{Cash}_{t-1} + \mathrm{EBITDA}_t
\]

**Cash trough** = \(\min_t \mathrm{Cash}_t\) — the deepest cash position on the path (maximum cumulative deficit relative to start is the drawdown \(\mathrm{Cash}_0 - \min \mathrm{Cash}\)).

**Minimum raise to survive payback delay without default:**

\[
\text{Min funding} = \max\bigl(0,\ -\min_t \mathrm{Cash}_t + 3 \times \text{peak monthly burn}\bigr)
\]

The three-month peak-burn term is the working-capital buffer. Runway is months until cash crosses zero, interpolated inside the defaulting month.

### 9. Diligence gates (red)

| Gate | Fail if |
| --- | --- |
| LTV : CAC | \(< 3.0\times\) |
| CAC payback | \(> 12\) months |
| Burn multiple | \(> 2.0\times\) |
| Magic Number | \(< 0.75\) |

Watch items (not automatic fails): Quick Ratio \(< 4\), NRR \(< 100\%\), runway \(\le 12\) months, channel saturation, cash default inside the horizon.

---

## State architecture

```
DOM inputs  →  readState()  →  CapitalEngine.simulate(config)
                                      │
                                      ├─ mergeConfig
                                      ├─ runSimulation (cohort ledger)
                                      ├─ headlineMetrics (quarter identities)
                                      ├─ auditFlags
                                      └─ retentionCurve / funnel / leadSolve
                                              │
                                              ▼
                                   controller renderers (KPI, SVG, table)
```

- `engine.js` — pure functions, no DOM. Also `module.exports` for headless checks.
- `script.js` — DOM controller. Stateless except for the last result used by Copy Board Snapshot.
- Config is a flat object (`CapitalEngine.DEFAULTS`). Each month stores a cohort array: legacy book plus one new-logo cohort per period.

## How to use

1. Set starting cash, starting MRR, ARPU, and gross margin.
2. Choose an ARR/MRR target and a 12 / 18 / 24 month horizon.
3. Split inbound vs paid and set each channel’s capacity and elasticities.
4. Tune Weibull \(k, \lambda\) (or the log-normal mix) until month-1 to month-3 churn matches your onboarding reality.
5. Read the diligence desk. Copy the board snapshot into the appendix of the deck.

## Author

[RTBRuhan](https://rtbruhan.github.io)
