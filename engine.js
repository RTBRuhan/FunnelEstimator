/**
 * CapitalEngine — Institutional SaaS Capital Efficiency & Growth Modeler
 * Pure functions only. No DOM. Zero dependencies.
 *
 * Formulas are documented in README.md and CapitalEngine.FORMULAS.
 */
(function (root) {
    "use strict";

    var THRESHOLDS = {
        magicPoor: 0.75,
        magicEfficient: 1.0,
        burnMultipleFlag: 2.0,
        ltvCacMin: 3.0,
        cacPaybackMaxMonths: 12,
        quickRatioHealthy: 4.0,
        nrrHealthy: 1.0,
        grrHealthy: 0.85,
        runwayWatchMonths: 12
    };

    var DEFAULTS = {
        startingCash: 2000000,
        startingMRR: 40000,
        arpu: 250,
        grossMargin: 0.82,
        existingAge: 6,
        targetType: "ARR",
        targetValue: 2400000,
        monthlyLeads: 2500,
        interestRate: 0.12,
        conversionRate: 0.10,
        leadGrowthRate: 0.03,
        inboundMix: 0.45,
        inboundBaseCac: 220,
        inboundElasticity: 0.20,
        inboundConversionDecay: 0.10,
        inboundCapacity: 1000,
        inboundCeiling: 3,
        paidBaseCac: 1100,
        paidElasticity: 0.60,
        paidConversionDecay: 0.28,
        paidCapacity: 2000,
        paidCeiling: 15,
        retentionCurve: "weibull",
        weibullK: 0.62,
        weibullLambda: 90,
        lognormalFastWeight: 0.18,
        lognormalFastMu: 0.15,
        lognormalFastSigma: 0.45,
        lognormalSlowMu: 3.40,
        lognormalSlowSigma: 0.70,
        monthlyExpansion: 0.032,
        monthlyContraction: 0.005,
        fixedOpex: 95000,
        otherOpex: 0,
        horizonMonths: 18,
        discountRateAnnual: 0.10,
        sizeFunnelForOpex: false,
        ltvHorizonMonths: 60,
        expansionCapMultiple: 2.5
    };

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function round(value, digits) {
        if (!isFiniteNumber(value)) return value;
        var p = Math.pow(10, digits == null ? 2 : digits);
        return Math.round(value * p) / p;
    }

    /**
     * Abramowitz & Stegun 7.1.26 error function (max error < 1.5e-7).
     * Used for log-normal CDF.
     */
    function erf(x) {
        var sign = x < 0 ? -1 : 1;
        var ax = Math.abs(x);
        var a1 = 0.254829592;
        var a2 = -0.284496736;
        var a3 = 1.421413741;
        var a4 = -1.453152027;
        var a5 = 1.061405429;
        var p = 0.3275911;
        var t = 1 / (1 + p * ax);
        var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
        return sign * y;
    }

    function standardNormalCdf(z) {
        return 0.5 * (1 + erf(z / Math.SQRT2));
    }

    /**
     * Weibull survival: S(t) = exp(-(t / λ)^k)
     * k < 1 ⇒ decreasing hazard (steep early churn, then flattening).
     */
    function weibullSurvival(t, k, lambda) {
        if (t <= 0) return 1;
        if (!(k > 0) || !(lambda > 0)) return 1;
        return Math.exp(-Math.pow(t / lambda, k));
    }

    /**
     * Log-normal survival: S(t) = 1 - Φ((ln t - μ) / σ)
     */
    function lognormalSurvival(t, mu, sigma) {
        if (t <= 0) return 1;
        if (!(sigma > 0)) return 1;
        var z = (Math.log(t) - mu) / sigma;
        return 1 - standardNormalCdf(z);
    }

    /**
     * Mixture log-normal: fast-churn onboarding mass + long-lived core.
     * S(t) = w * S_fast(t) + (1 - w) * S_slow(t)
     */
    function mixtureLognormalSurvival(t, cfg) {
        var w = clamp(cfg.lognormalFastWeight, 0, 1);
        var fast = lognormalSurvival(t, cfg.lognormalFastMu, cfg.lognormalFastSigma);
        var slow = lognormalSurvival(t, cfg.lognormalSlowMu, cfg.lognormalSlowSigma);
        return w * fast + (1 - w) * slow;
    }

    function survival(t, cfg) {
        if (cfg.retentionCurve === "lognormal") {
            return mixtureLognormalSurvival(t, cfg);
        }
        return weibullSurvival(t, cfg.weibullK, cfg.weibullLambda);
    }

    /**
     * Discrete monthly logo retention from age t-1 → t:
     * r(t) = S(t) / S(t-1)
     */
    function monthlySurvivalRatio(ageEnd, cfg) {
        if (ageEnd <= 0) return 1;
        var s1 = survival(ageEnd, cfg);
        var s0 = survival(Math.max(0, ageEnd - 1), cfg);
        if (s0 <= 1e-12) return 0;
        return clamp(s1 / s0, 0, 1);
    }

    /**
     * Channel saturation.
     * excess s = max(0, (L - L0) / L0)
     * CAC(L) = CAC0 * exp(λ s)
     * CR(L)  = CR0  * exp(-μ s)
     * Leads capped at L0 * ceiling (unfilled demand beyond the ceiling).
     */
    function saturateChannel(leads, capacity, ceiling, baseCac, elasticity, conversionDecay, baseConversion) {
        var safeCapacity = Math.max(capacity, 1);
        var cap = safeCapacity * Math.max(ceiling, 1);
        var effectiveLeads = Math.min(Math.max(leads, 0), cap);
        var excess = Math.max(0, (effectiveLeads - safeCapacity) / safeCapacity);
        var cac = baseCac * Math.exp(elasticity * excess);
        var conversion = baseConversion * Math.exp(-conversionDecay * excess);
        return {
            requestedLeads: leads,
            effectiveLeads: effectiveLeads,
            spill: Math.max(0, leads - effectiveLeads),
            excess: excess,
            cac: cac,
            conversion: clamp(conversion, 0.0001, 1),
            saturated: excess > 0 || leads > cap
        };
    }

    function acquireFromLeads(totalLeads, cfg) {
        var mix = clamp(cfg.inboundMix, 0, 1);
        var inboundLeads = totalLeads * mix;
        var paidLeads = totalLeads * (1 - mix);

        var inbound = saturateChannel(
            inboundLeads,
            cfg.inboundCapacity,
            cfg.inboundCeiling,
            cfg.inboundBaseCac,
            cfg.inboundElasticity,
            cfg.inboundConversionDecay,
            cfg.conversionRate
        );
        var paid = saturateChannel(
            paidLeads,
            cfg.paidCapacity,
            cfg.paidCeiling,
            cfg.paidBaseCac,
            cfg.paidElasticity,
            cfg.paidConversionDecay,
            cfg.conversionRate
        );

        var inboundProspects = inbound.effectiveLeads * cfg.interestRate;
        var paidProspects = paid.effectiveLeads * cfg.interestRate;
        var inboundCustomers = inboundProspects * inbound.conversion;
        var paidCustomers = paidProspects * paid.conversion;
        var newCustomers = inboundCustomers + paidCustomers;
        var smSpend = inboundCustomers * inbound.cac + paidCustomers * paid.cac;
        var blendedCac = newCustomers > 0 ? smSpend / newCustomers : (mix * cfg.inboundBaseCac + (1 - mix) * cfg.paidBaseCac);

        return {
            totalLeads: totalLeads,
            inboundLeads: inbound.effectiveLeads,
            paidLeads: paid.effectiveLeads,
            inboundSpill: inbound.spill,
            paidSpill: paid.spill,
            inboundProspects: inboundProspects,
            paidProspects: paidProspects,
            prospects: inboundProspects + paidProspects,
            inboundCustomers: inboundCustomers,
            paidCustomers: paidCustomers,
            newCustomers: newCustomers,
            newMRR: newCustomers * cfg.arpu,
            inboundCac: inbound.cac,
            paidCac: paid.cac,
            inboundConversion: inbound.conversion,
            paidConversion: paid.conversion,
            smSpend: smSpend,
            blendedCac: blendedCac,
            inboundSaturated: inbound.saturated,
            paidSaturated: paid.saturated
        };
    }

    function targetToMonthlyMRR(targetType, targetValue) {
        switch (targetType) {
            case "Amount":
                return null;
            case "MRR":
                return targetValue;
            case "ARR":
                return targetValue / 12;
            default: {
                var _exhaustive = targetType;
                throw new Error("Unknown target type: " + _exhaustive);
            }
        }
    }

    function mergeConfig(input) {
        var cfg = {};
        var key;
        for (key in DEFAULTS) {
            if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
                cfg[key] = DEFAULTS[key];
            }
        }
        if (input) {
            for (key in input) {
                if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined && input[key] !== null && input[key] !== "") {
                    cfg[key] = input[key];
                }
            }
        }
        cfg.grossMargin = clamp(Number(cfg.grossMargin), 0, 1);
        cfg.interestRate = clamp(Number(cfg.interestRate), 0.0001, 1);
        cfg.conversionRate = clamp(Number(cfg.conversionRate), 0.0001, 1);
        cfg.inboundMix = clamp(Number(cfg.inboundMix), 0, 1);
        cfg.horizonMonths = clamp(Math.round(Number(cfg.horizonMonths)) || 18, 12, 24);
        cfg.monthlyExpansion = Math.max(0, Number(cfg.monthlyExpansion) || 0);
        cfg.monthlyContraction = clamp(Number(cfg.monthlyContraction) || 0, 0, 0.5);
        cfg.leadGrowthRate = Number(cfg.leadGrowthRate) || 0;
        cfg.arpu = Math.max(0, Number(cfg.arpu) || 0);
        cfg.startingMRR = Math.max(0, Number(cfg.startingMRR) || 0);
        cfg.startingCash = Number(cfg.startingCash) || 0;
        cfg.existingAge = Math.max(1, Number(cfg.existingAge) || 6);
        cfg.ltvHorizonMonths = Math.max(24, Number(cfg.ltvHorizonMonths) || 60);
        cfg.expansionCapMultiple = Math.max(1, Number(cfg.expansionCapMultiple) || 2.5);
        return cfg;
    }

    function expansionMultiple(cfg, months) {
        return Math.min(cfg.expansionCapMultiple, Math.pow(1 + cfg.monthlyExpansion, months));
    }

    /**
     * 12-month modeled NRR / GRR from the retention curve (forward looking).
     * GRR(t) = S(t) * (1 - c)^t
     * NRR(t) = S(t) * min(cap, (1 + e)^t) * (1 - c)^t
     * Expansion is capped so NRR>100% does not imply infinite LTV.
     */
    function modeledRetention(cfg, months) {
        var t = months == null ? 12 : months;
        var s = survival(t, cfg);
        var expand = expansionMultiple(cfg, t);
        var contract = Math.pow(1 - cfg.monthlyContraction, t);
        return {
            logoRetention: s,
            grr: s * contract,
            nrr: s * expand * contract
        };
    }

    /**
     * Cohort Gross-Profit LTV (discounted and undiscounted).
     * LTV = Σ_t ARPU * S(t) * (1+e)^t * (1-c)^t * GM / (1 + r/12)^t
     */
    function cohortLtv(cfg, cacForPayback) {
        var gm = cfg.grossMargin;
        var rMonthly = Math.pow(1 + cfg.discountRateAnnual, 1 / 12) - 1;
        var undiscounted = 0;
        var discounted = 0;
        var cumulativeContribution = 0;
        var paybackMonths = Infinity;
        var t;
        var dollars;
        var contrib;

        for (t = 1; t <= cfg.ltvHorizonMonths; t++) {
            dollars = cfg.arpu * survival(t, cfg) * expansionMultiple(cfg, t) * Math.pow(1 - cfg.monthlyContraction, t);
            contrib = dollars * gm;
            undiscounted += contrib;
            discounted += contrib / Math.pow(1 + rMonthly, t);
            cumulativeContribution += contrib;
            if (!isFinite(paybackMonths) && cacForPayback >= 0 && cumulativeContribution >= cacForPayback) {
                paybackMonths = t;
            }
        }

        return {
            undiscounted: undiscounted,
            discounted: discounted,
            paybackMonths: paybackMonths,
            cumulativeContribution: cumulativeContribution
        };
    }

    function emptyMonth() {
        return {
            month: 0,
            leads: 0,
            prospects: 0,
            beginningMRR: 0,
            newMRR: 0,
            expansionMRR: 0,
            contractionMRR: 0,
            churnedMRR: 0,
            endingMRR: 0,
            newCustomers: 0,
            inboundCustomers: 0,
            paidCustomers: 0,
            blendedCac: 0,
            inboundCac: 0,
            paidCac: 0,
            smSpend: 0,
            revenue: 0,
            grossProfit: 0,
            opex: 0,
            ebitda: 0,
            netBurn: 0,
            cash: 0,
            cumulativeFcf: 0,
            quickRatio: Infinity,
            inboundSaturated: false,
            paidSaturated: false
        };
    }

    function runSimulation(cfg) {
        var H = cfg.horizonMonths;
        var months = [];
        var cohorts = [];
        var existingCustomers = cfg.arpu > 0 ? cfg.startingMRR / cfg.arpu : 0;

        if (existingCustomers > 0 || cfg.startingMRR > 0) {
            cohorts.push({
                acquiredMonth: -cfg.existingAge,
                initialAge: cfg.existingAge,
                isLegacy: true,
                currentMRR: cfg.startingMRR,
                expansionFactor: 1
            });
        }

        var cash = cfg.startingCash;
        var cumulativeFcf = 0;
        var t;
        var ageEnd;
        var ratio;
        var survived;
        var churned;
        var expanded;
        var contracted;
        var beginningMRR;
        var expansionMRR;
        var contractionMRR;
        var churnedMRR;
        var i;
        var cohort;
        var rawLeads;
        var acq;
        var revenue;
        var grossProfit;
        var opex;
        var ebitda;
        var endingMRR;
        var qrDen;
        var row;

        for (t = 1; t <= H; t++) {
            beginningMRR = 0;
            expansionMRR = 0;
            contractionMRR = 0;
            churnedMRR = 0;

            for (i = 0; i < cohorts.length; i++) {
                cohort = cohorts[i];
                beginningMRR += cohort.currentMRR;
                ageEnd = t - cohort.acquiredMonth;
                ratio = monthlySurvivalRatio(ageEnd, cfg);
                survived = cohort.currentMRR * ratio;
                churned = Math.max(0, cohort.currentMRR - survived);
                var nextFactor = Math.min(
                    cfg.expansionCapMultiple,
                    cohort.expansionFactor * (1 + cfg.monthlyExpansion)
                );
                var expRate = cohort.expansionFactor > 0 ? (nextFactor / cohort.expansionFactor - 1) : 0;
                expanded = survived * expRate;
                cohort.expansionFactor = nextFactor;
                contracted = survived * cfg.monthlyContraction;
                cohort.currentMRR = Math.max(0, survived + expanded - contracted);
                expansionMRR += expanded;
                contractionMRR += contracted;
                churnedMRR += churned;
            }

            rawLeads = cfg.monthlyLeads * Math.pow(1 + cfg.leadGrowthRate, t - 1);
            acq = acquireFromLeads(rawLeads, cfg);

            if (acq.newMRR > 0) {
                cohorts.push({
                    acquiredMonth: t,
                    initialAge: 0,
                    isLegacy: false,
                    currentMRR: acq.newMRR,
                    expansionFactor: 1
                });
            }

            endingMRR = beginningMRR + acq.newMRR + expansionMRR - contractionMRR - churnedMRR;
            revenue = endingMRR;
            grossProfit = revenue * cfg.grossMargin;
            opex = cfg.fixedOpex + cfg.otherOpex + acq.smSpend;
            ebitda = grossProfit - opex;
            cash += ebitda;
            cumulativeFcf += ebitda;
            qrDen = contractionMRR + churnedMRR;

            row = emptyMonth();
            row.month = t;
            row.leads = acq.totalLeads;
            row.prospects = acq.prospects;
            row.beginningMRR = beginningMRR;
            row.newMRR = acq.newMRR;
            row.expansionMRR = expansionMRR;
            row.contractionMRR = contractionMRR;
            row.churnedMRR = churnedMRR;
            row.endingMRR = endingMRR;
            row.newCustomers = acq.newCustomers;
            row.inboundCustomers = acq.inboundCustomers;
            row.paidCustomers = acq.paidCustomers;
            row.blendedCac = acq.blendedCac;
            row.inboundCac = acq.inboundCac;
            row.paidCac = acq.paidCac;
            row.smSpend = acq.smSpend;
            row.revenue = revenue;
            row.grossProfit = grossProfit;
            row.opex = opex;
            row.ebitda = ebitda;
            row.netBurn = -ebitda;
            row.cash = cash;
            row.cumulativeFcf = cumulativeFcf;
            row.quickRatio = qrDen > 1e-9 ? (acq.newMRR + expansionMRR) / qrDen : Infinity;
            row.inboundSaturated = acq.inboundSaturated;
            row.paidSaturated = acq.paidSaturated;
            row.inboundLeads = acq.inboundLeads;
            row.paidLeads = acq.paidLeads;
            months.push(row);
        }

        return months;
    }

    function sumRange(months, startIdx, endIdx, field) {
        var total = 0;
        var i;
        for (i = startIdx; i <= endIdx; i++) {
            if (months[i]) total += months[i][field];
        }
        return total;
    }

    function lastCompleteQuarterMetrics(months) {
        var H = months.length;
        if (H < 6) {
            return { magicNumber: NaN, burnMultiple: NaN, netNewArr: NaN, smPrior: NaN, netBurnQ: NaN };
        }
        var end = H - 1;
        var startCurrent = end - 2;
        var startPrior = end - 5;
        var endPrior = end - 3;
        var mrrEnd = months[end].endingMRR;
        var mrrStart = months[startCurrent - 1] ? months[startCurrent - 1].endingMRR : months[startCurrent].beginningMRR;
        var netNewArr = 12 * (mrrEnd - mrrStart);
        var smPrior = sumRange(months, startPrior, endPrior, "smSpend");
        var netBurnQ = sumRange(months, startCurrent, end, "netBurn");
        var magicNumber = smPrior > 1e-6 ? netNewArr / smPrior : (netNewArr > 0 ? Infinity : NaN);
        var burnMultiple;
        if (netNewArr > 1e-6) {
            burnMultiple = netBurnQ / netNewArr;
        } else if (netBurnQ <= 0) {
            burnMultiple = 0;
        } else {
            burnMultiple = Infinity;
        }
        return {
            magicNumber: magicNumber,
            burnMultiple: burnMultiple,
            netNewArr: netNewArr,
            smPrior: smPrior,
            netBurnQ: netBurnQ,
            currentQuarter: [startCurrent + 1, end + 1],
            priorQuarter: [startPrior + 1, endPrior + 1]
        };
    }

    function cashPathStats(cfg, months) {
        var minCash = cfg.startingCash;
        var troughMonth = 0;
        var defaultMonth = null;
        var breakevenMonth = null;
        var peakBurn = 0;
        var i;
        var m;
        var runwayMonths;

        for (i = 0; i < months.length; i++) {
            m = months[i];
            if (m.cash < minCash) {
                minCash = m.cash;
                troughMonth = m.month;
            }
            if (defaultMonth === null && m.cash < 0) {
                defaultMonth = m.month;
            }
            if (breakevenMonth === null && m.ebitda >= 0) {
                breakevenMonth = m.month;
            }
            if (m.netBurn > peakBurn) peakBurn = m.netBurn;
        }

        if (defaultMonth === null) {
            runwayMonths = months.length + 1;
        } else if (defaultMonth === 1) {
            runwayMonths = cfg.startingCash > 0 && months[0].netBurn > 0
                ? cfg.startingCash / months[0].netBurn
                : 0;
        } else {
            var prevCash = defaultMonth === 1 ? cfg.startingCash : months[defaultMonth - 2].cash;
            var burn = months[defaultMonth - 1].netBurn;
            var frac = burn > 0 ? clamp(prevCash / burn, 0, 1) : 0;
            runwayMonths = (defaultMonth - 1) + frac;
        }

        var buffer = 3 * Math.max(peakBurn, 0);
        var additionalCapitalToAvoidDefault = Math.max(0, -minCash + buffer);
        var drawdown = cfg.startingCash - minCash;

        return {
            startingCash: cfg.startingCash,
            endingCash: months.length ? months[months.length - 1].cash : cfg.startingCash,
            troughCash: minCash,
            troughMonth: troughMonth,
            troughDepth: drawdown,
            defaultMonth: defaultMonth,
            cashFlowBreakevenMonth: breakevenMonth,
            peakMonthlyBurn: peakBurn,
            runwayMonths: runwayMonths,
            safetyBuffer: buffer,
            additionalCapitalRequired: additionalCapitalToAvoidDefault,
            minVentureFunding: additionalCapitalToAvoidDefault,
            survivesHorizon: defaultMonth === null
        };
    }

    function gradeMagicNumber(value) {
        if (!isFiniteNumber(value)) return { label: "N/A", tone: "muted" };
        if (value < THRESHOLDS.magicPoor) return { label: "Poor", tone: "danger" };
        if (value <= THRESHOLDS.magicEfficient) return { label: "Efficient", tone: "ok" };
        return { label: "High Growth", tone: "good" };
    }

    function gradeBurnMultiple(value) {
        if (!isFiniteNumber(value)) return { label: "N/A", tone: "muted" };
        if (value < 0) return { label: "Profitable", tone: "good" };
        if (value <= 1.0) return { label: "Amazing", tone: "good" };
        if (value <= 1.5) return { label: "Great", tone: "ok" };
        if (value <= 2.0) return { label: "Good", tone: "ok" };
        return { label: "Inefficient", tone: "danger" };
    }

    function gradeQuickRatio(value) {
        if (!isFiniteNumber(value)) {
            if (value === Infinity) return { label: "Excellent", tone: "good" };
            return { label: "N/A", tone: "muted" };
        }
        if (value >= THRESHOLDS.quickRatioHealthy) return { label: "Excellent", tone: "good" };
        if (value >= 2) return { label: "Healthy", tone: "ok" };
        return { label: "Weak", tone: "danger" };
    }

    function auditFlags(metrics) {
        var flags = [];

        flags.push({
            id: "ltvCac",
            name: "LTV : CAC",
            severity: isFiniteNumber(metrics.ltvCac) && metrics.ltvCac < THRESHOLDS.ltvCacMin ? "red" : "pass",
            threshold: "≥ 3.0x",
            value: metrics.ltvCac,
            message: isFiniteNumber(metrics.ltvCac) && metrics.ltvCac < THRESHOLDS.ltvCacMin
                ? "Gross-profit LTV does not cover 3x blended CAC. VCs will underwrite this as structurally unprofitable growth."
                : "Unit economics clear the 3.0x institutional floor."
        });

        flags.push({
            id: "payback",
            name: "CAC Payback",
            severity: isFiniteNumber(metrics.paybackMonths) && metrics.paybackMonths > THRESHOLDS.cacPaybackMaxMonths ? "red" : (isFinite(metrics.paybackMonths) ? "pass" : "red"),
            threshold: "≤ 12 months",
            value: metrics.paybackMonths,
            message: !isFinite(metrics.paybackMonths)
                ? "Cohort contribution never recovers CAC within the LTV horizon."
                : metrics.paybackMonths > THRESHOLDS.cacPaybackMaxMonths
                    ? "Payback exceeds 12 months. Seed / Series A bars typically require recovery inside one year."
                    : "CAC is recovered inside the 12-month board standard."
        });

        flags.push({
            id: "burnMultiple",
            name: "Burn Multiple",
            severity: !isFiniteNumber(metrics.burnMultiple) || metrics.burnMultiple > THRESHOLDS.burnMultipleFlag ? "red" : "pass",
            threshold: "≤ 2.0x",
            value: metrics.burnMultiple,
            message: !isFiniteNumber(metrics.burnMultiple)
                ? "Burn multiple is undefined (no net-new ARR in the last quarter)."
                : metrics.burnMultiple > THRESHOLDS.burnMultipleFlag
                    ? "More than $2 of net burn per $1 of net-new ARR. Capital efficiency will be a diligence blocker."
                    : "Burn multiple is inside the Bessemer 'good' band (≤ 2.0x)."
        });

        flags.push({
            id: "magicNumber",
            name: "SaaS Magic Number",
            severity: !isFiniteNumber(metrics.magicNumber) || metrics.magicNumber < THRESHOLDS.magicPoor ? "red" : "pass",
            threshold: "≥ 0.75",
            value: metrics.magicNumber,
            message: !isFiniteNumber(metrics.magicNumber)
                ? "Magic Number is undefined (insufficient S&M in the prior quarter)."
                : metrics.magicNumber < THRESHOLDS.magicPoor
                    ? "Sales efficiency is Poor. Prior-quarter S&M is not producing enough net-new ARR."
                    : "Magic Number clears the 0.75 efficiency floor."
        });

        if (isFiniteNumber(metrics.quickRatio) && metrics.quickRatio < THRESHOLDS.quickRatioHealthy) {
            flags.push({
                id: "quickRatio",
                name: "Quick Ratio",
                severity: metrics.quickRatio < 2 ? "red" : "watch",
                threshold: "> 4.0",
                value: metrics.quickRatio,
                message: metrics.quickRatio < 2
                    ? "New + expansion MRR is not covering contraction + churn. Growth is leaking."
                    : "Below the 4.0 VC health threshold. Growth quality is acceptable but not elite."
            });
        }

        if (isFiniteNumber(metrics.nrr) && metrics.nrr < THRESHOLDS.nrrHealthy) {
            flags.push({
                id: "nrr",
                name: "Net Revenue Retention",
                severity: metrics.nrr < 0.9 ? "red" : "watch",
                threshold: "≥ 100%",
                value: metrics.nrr,
                message: "Modeled 12-month NRR is below 100%. The book shrinks without new logos."
            });
        }

        if (metrics.cash.defaultMonth !== null) {
            flags.push({
                id: "defaultRisk",
                name: "Cash Default Risk",
                severity: "red",
                threshold: "Cash ≥ 0 over horizon",
                value: metrics.cash.defaultMonth,
                message: "Cash goes negative in month " + metrics.cash.defaultMonth + ". Raise at least "
                    + Math.round(metrics.cash.additionalCapitalRequired) + " before the trough, or cut burn."
            });
        } else if (metrics.cash.runwayMonths <= THRESHOLDS.runwayWatchMonths) {
            flags.push({
                id: "runway",
                name: "Runway",
                severity: "watch",
                threshold: "> 12 months",
                value: metrics.cash.runwayMonths,
                message: "Runway is inside 12 months. Boards typically require a financed 18-month plan."
            });
        }

        if (metrics.saturationWarning) {
            flags.push({
                id: "saturation",
                name: "Channel Saturation",
                severity: "watch",
                threshold: "Leads ≤ baseline capacity",
                value: metrics.horizonBlendedCac,
                message: "Lead volume exceeds baseline channel capacity. CAC is compounding and conversion is decaying."
            });
        }

        return flags;
    }

    function retentionCurvePoints(cfg, months) {
        var points = [];
        var t;
        var maxT = months || 24;
        for (t = 0; t <= maxT; t++) {
            points.push({
                t: t,
                survival: survival(t, cfg),
                grr: t === 0 ? 1 : survival(t, cfg) * Math.pow(1 - cfg.monthlyContraction, t),
                nrr: t === 0 ? 1 : survival(t, cfg) * expansionMultiple(cfg, t) * Math.pow(1 - cfg.monthlyContraction, t)
            });
        }
        return points;
    }

    function funnelRequirement(cfg, sim) {
        var last = sim[sim.length - 1];
        var first = sim[0];
        var targetMRR = targetToMonthlyMRR(cfg.targetType, cfg.targetValue);
        var requiredCustomers;
        var requiredProspects;
        var requiredReach;
        var opexCover = cfg.sizeFunnelForOpex ? (cfg.fixedOpex + cfg.otherOpex) : 0;

        if (cfg.targetType === "Amount") {
            var amount = cfg.targetValue + (cfg.sizeFunnelForOpex ? (cfg.fixedOpex + cfg.otherOpex) * cfg.horizonMonths : 0);
            requiredCustomers = cfg.arpu > 0 ? amount / cfg.arpu : Infinity;
            requiredProspects = requiredCustomers / cfg.conversionRate;
            requiredReach = requiredProspects / cfg.interestRate;
            return {
                targetType: cfg.targetType,
                targetValue: cfg.targetValue,
                targetMRR: null,
                requiredCustomers: requiredCustomers,
                requiredProspects: requiredProspects,
                requiredReach: requiredReach,
                projectedEndingMRR: last ? last.endingMRR : cfg.startingMRR,
                projectedEndingARR: last ? last.endingMRR * 12 : cfg.startingMRR * 12,
                coverage: null,
                gapMRR: null
            };
        }

        var effectiveTargetMRR = (targetMRR || 0) + opexCover;
        requiredCustomers = cfg.arpu > 0 ? effectiveTargetMRR / cfg.arpu : Infinity;
        var avgConversion = first ? ((first.inboundCustomers + first.paidCustomers) > 0
            ? (first.newCustomers / Math.max(first.prospects, 1e-9))
            : cfg.conversionRate) : cfg.conversionRate;
        requiredProspects = requiredCustomers / Math.max(avgConversion, 1e-9);
        requiredReach = requiredProspects / cfg.interestRate;

        return {
            targetType: cfg.targetType,
            targetValue: cfg.targetValue,
            targetMRR: effectiveTargetMRR,
            requiredCustomers: requiredCustomers,
            requiredProspects: requiredProspects,
            requiredReach: requiredReach,
            projectedEndingMRR: last.endingMRR,
            projectedEndingARR: last.endingMRR * 12,
            coverage: effectiveTargetMRR > 0 ? last.endingMRR / effectiveTargetMRR : null,
            gapMRR: effectiveTargetMRR - last.endingMRR
        };
    }

    /**
     * Bisection: monthly lead volume (period 1) that hits target ending MRR,
     * holding mix, growth rate, and retention constant.
     */
    function solveLeadsForTarget(cfg, maxIter) {
        var targetMRR = targetToMonthlyMRR(cfg.targetType, cfg.targetValue);
        if (targetMRR === null) return null;
        if (cfg.sizeFunnelForOpex) targetMRR += cfg.fixedOpex + cfg.otherOpex;

        var lo = 0;
        var hi = Math.max(cfg.monthlyLeads * 20, 50000);
        var iter;
        var mid;
        var trial;
        var sim;
        var end;
        var i;

        sim = runSimulation(cfg);
        end = sim[sim.length - 1].endingMRR;
        if (end >= targetMRR) {
            return { monthlyLeads: cfg.monthlyLeads, hitsTarget: true, endingMRR: end };
        }

        for (iter = 0; iter < 8 && runSimulation(Object.assign({}, cfg, { monthlyLeads: hi }))[cfg.horizonMonths - 1].endingMRR < targetMRR; iter++) {
            hi *= 2;
            if (hi > 5e7) break;
        }

        for (i = 0; i < (maxIter || 36); i++) {
            mid = (lo + hi) / 2;
            trial = Object.assign({}, cfg, { monthlyLeads: mid });
            sim = runSimulation(trial);
            end = sim[sim.length - 1].endingMRR;
            if (end >= targetMRR) hi = mid;
            else lo = mid;
        }

        return {
            monthlyLeads: hi,
            hitsTarget: runSimulation(Object.assign({}, cfg, { monthlyLeads: hi }))[cfg.horizonMonths - 1].endingMRR >= targetMRR * 0.995,
            endingMRR: runSimulation(Object.assign({}, cfg, { monthlyLeads: hi }))[cfg.horizonMonths - 1].endingMRR
        };
    }

    function headlineMetrics(cfg, months) {
        var q = lastCompleteQuarterMetrics(months);
        var last = months[months.length - 1];
        var first = months[0];
        var ret12 = modeledRetention(cfg, 12);
        var unit = cohortLtv(cfg, first.blendedCac);
        var cash = cashPathStats(cfg, months);
        var avgQuick = 0;
        var quickCount = 0;
        var i;
        for (i = 0; i < months.length; i++) {
            if (isFiniteNumber(months[i].quickRatio)) {
                avgQuick += months[i].quickRatio;
                quickCount += 1;
            }
        }

        var m1Churn = 1 - monthlySurvivalRatio(1, cfg);
        var m3Surv = survival(3, cfg);
        var realizedLegacyNrr = null;
        if (cfg.startingMRR > 0 && months.length >= 12) {
            var legacy = 0;
            var ageEnd;
            var mrr = cfg.startingMRR;
            var bookFactor = 1;
            for (i = 1; i <= 12; i++) {
                ageEnd = cfg.existingAge + i;
                mrr = mrr * monthlySurvivalRatio(ageEnd, cfg);
                var nextBook = Math.min(cfg.expansionCapMultiple, bookFactor * (1 + cfg.monthlyExpansion));
                mrr = mrr * (nextBook / bookFactor) * (1 - cfg.monthlyContraction);
                bookFactor = nextBook;
            }
            legacy = mrr;
            realizedLegacyNrr = legacy / cfg.startingMRR;
        }

        return {
            magicNumber: q.magicNumber,
            magicGrade: gradeMagicNumber(q.magicNumber),
            burnMultiple: q.burnMultiple,
            burnGrade: gradeBurnMultiple(q.burnMultiple),
            netNewArrLastQ: q.netNewArr,
            smPriorQ: q.smPrior,
            netBurnLastQ: q.netBurnQ,
            nrr: ret12.nrr,
            grr: ret12.grr,
            logoRetention12: ret12.logoRetention,
            realizedLegacyNrr: realizedLegacyNrr,
            quickRatio: last.quickRatio,
            quickRatioAvg: quickCount ? avgQuick / quickCount : NaN,
            quickGrade: gradeQuickRatio(last.quickRatio),
            blendedCac: first.blendedCac,
            horizonBlendedCac: last.blendedCac,
            ltv: unit.undiscounted,
            ltvDiscounted: unit.discounted,
            ltvCac: first.blendedCac > 0 ? unit.undiscounted / first.blendedCac : Infinity,
            paybackMonths: unit.paybackMonths,
            m1LogoChurn: m1Churn,
            m3LogoRetention: m3Surv,
            startingMRR: cfg.startingMRR,
            endingMRR: last.endingMRR,
            endingARR: last.endingMRR * 12,
            startingARR: cfg.startingMRR * 12,
            cash: cash,
            saturationWarning: months.some(function (row) { return row.inboundSaturated || row.paidSaturated; }),
            quarterWindow: q
        };
    }

    function simulate(input) {
        var cfg = mergeConfig(input);
        var months = runSimulation(cfg);
        var metrics = headlineMetrics(cfg, months);
        var funnel = funnelRequirement(cfg, months);
        var solved = null;
        try {
            solved = solveLeadsForTarget(cfg);
        } catch (err) {
            solved = null;
        }
        var flags = auditFlags(metrics);
        var redCount = flags.filter(function (f) { return f.severity === "red"; }).length;
        var watchCount = flags.filter(function (f) { return f.severity === "watch"; }).length;

        return {
            config: cfg,
            months: months,
            metrics: metrics,
            funnel: funnel,
            leadSolve: solved,
            flags: flags,
            diligence: {
                red: redCount,
                watch: watchCount,
                pass: redCount === 0,
                verdict: redCount === 0 ? (watchCount === 0 ? "Board-ready" : "Fundable with watch items") : "Fails VC diligence"
            },
            retentionCurve: retentionCurvePoints(cfg, Math.max(cfg.horizonMonths, 24)),
            thresholds: THRESHOLDS
        };
    }

    var FORMULAS = {
        magicNumber: "Net New ARR_Q / S&M_{Q-1} = 12 × (MRR_t − MRR_{t−3}) / Σ S&M_{t−5..t−3}",
        magicGrades: "< 0.75 Poor · 0.75–1.0 Efficient · > 1.0 High Growth",
        burnMultiple: "Net Burn_Q / Net New ARR_Q",
        nrr: "NRR(t) = S(t) × min(κ, (1+e)^t) × (1−c)^t",
        grr: "GRR(t) = S(t) × (1 − c)^t",
        quickRatio: "(New MRR + Expansion MRR) / (Contraction MRR + Churned MRR)",
        weibull: "S(t) = exp(−(t / λ)^k),  k < 1 decreasing hazard",
        lognormal: "S(t) = w S_fast(t) + (1 − w) S_slow(t),  S_i = 1 − Φ((ln t − μ_i) / σ_i)",
        monthlyChurn: "1 − S(t) / S(t − 1)",
        cacSaturation: "CAC(L) = CAC_0 × exp(λ × max(0, (L − L_0) / L_0))",
        conversionDecay: "CR(L) = CR_0 × exp(−μ × max(0, (L − L_0) / L_0))",
        ltv: "Σ_t ARPU × S(t) × min(κ, (1+e)^t) × (1−c)^t × GM   [60-month GP LTV, expansion capped]",
        payback: "min { T : Σ_{t=1..T} ARPU × S(t) × min(κ, (1+e)^t) × (1−c)^t × GM ≥ CAC }",
        cashTrough: "Trough = min_t Cash_t,  Cash_t = Cash_{t−1} + GM × MRR_t − (FixedOpEx + Other + S&M_t)",
        minFunding: "max(0, −min(Cash_t) + 3 × peak monthly burn)"
    };

    var api = {
        THRESHOLDS: THRESHOLDS,
        DEFAULTS: DEFAULTS,
        FORMULAS: FORMULAS,
        simulate: simulate,
        mergeConfig: mergeConfig,
        survival: survival,
        weibullSurvival: weibullSurvival,
        acquireFromLeads: acquireFromLeads,
        modeledRetention: modeledRetention,
        cohortLtv: cohortLtv,
        gradeMagicNumber: gradeMagicNumber,
        gradeBurnMultiple: gradeBurnMultiple,
        gradeQuickRatio: gradeQuickRatio,
        round: round,
        erf: erf
    };

    root.CapitalEngine = api;
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})(typeof window !== "undefined" ? window : globalThis);
