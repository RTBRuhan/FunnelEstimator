(function () {
    "use strict";

    var engine = window.CapitalEngine;
    if (!engine) {
        throw new Error("CapitalEngine failed to load.");
    }

    function $(id) {
        return document.getElementById(id);
    }

    function num(id, fallback) {
        var el = $(id);
        var value = el ? parseFloat(el.value) : NaN;
        return isFinite(value) ? value : fallback;
    }

    function checkedRadio(name) {
        var el = document.querySelector('input[name="' + name + '"]:checked');
        return el ? el.value : null;
    }

    function checkedFullTarget() {
        return checkedRadio("fullTargetType") || "ARR";
    }

    function formatNumber(value) {
        if (!isFinite(value)) return "—";
        var abs = Math.abs(value);
        if (abs >= 1e9) return (value / 1e9).toFixed(2) + "B";
        if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
        if (abs >= 1e3) return (value / 1e3).toFixed(1) + "K";
        return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));
    }

    function formatCurrency(value, digits) {
        if (!isFinite(value)) return "—";
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: digits == null ? 0 : digits,
            maximumFractionDigits: digits == null ? 0 : digits
        }).format(value);
    }

    function formatRatio(value, suffix) {
        if (value === Infinity) return "∞";
        if (!isFinite(value)) return "—";
        return value.toFixed(2) + (suffix || "x");
    }

    function formatPct(value) {
        if (!isFinite(value)) return "—";
        return (value * 100).toFixed(1) + "%";
    }

    function formatMonths(value) {
        if (value === Infinity) return ">120 mo";
        if (!isFinite(value)) return "—";
        return value.toFixed(1) + " mo";
    }

    function toneClass(tone) {
        if (tone === "danger" || tone === "good" || tone === "ok" || tone === "muted") return tone;
        return "";
    }

    function readExpenses() {
        var total = 0;
        var nodes = document.querySelectorAll("#expenseList .expense-cost");
        var i;
        var cost;
        for (i = 0; i < nodes.length; i++) {
            cost = parseFloat(nodes[i].value);
            if (isFinite(cost) && cost > 0) total += cost;
        }
        return total;
    }

    function readState() {
        return {
            startingCash: num("startingCash", engine.DEFAULTS.startingCash),
            startingMRR: num("startingMRR", engine.DEFAULTS.startingMRR),
            arpu: num("arpu", engine.DEFAULTS.arpu),
            grossMargin: num("grossMargin", 82) / 100,
            existingAge: num("existingAge", engine.DEFAULTS.existingAge),
            discountRateAnnual: num("discountRate", 10) / 100,
            targetType: checkedFullTarget(),
            targetValue: num("targetValue", engine.DEFAULTS.targetValue),
            horizonMonths: parseInt(checkedRadio("horizon") || "18", 10),
            sizeFunnelForOpex: $("sizeFunnelForOpex").checked,
            monthlyLeads: num("monthlyLeads", engine.DEFAULTS.monthlyLeads),
            leadGrowthRate: num("leadGrowthRate", 3) / 100,
            interestRate: num("interestRate", 12) / 100,
            conversionRate: num("conversionRate", 10) / 100,
            inboundMix: num("inboundMix", 45) / 100,
            inboundBaseCac: num("inboundBaseCac", engine.DEFAULTS.inboundBaseCac),
            inboundCapacity: num("inboundCapacity", engine.DEFAULTS.inboundCapacity),
            inboundElasticity: num("inboundElasticity", engine.DEFAULTS.inboundElasticity),
            inboundConversionDecay: num("inboundConversionDecay", engine.DEFAULTS.inboundConversionDecay),
            inboundCeiling: num("inboundCeiling", engine.DEFAULTS.inboundCeiling),
            paidBaseCac: num("paidBaseCac", engine.DEFAULTS.paidBaseCac),
            paidCapacity: num("paidCapacity", engine.DEFAULTS.paidCapacity),
            paidElasticity: num("paidElasticity", engine.DEFAULTS.paidElasticity),
            paidConversionDecay: num("paidConversionDecay", engine.DEFAULTS.paidConversionDecay),
            paidCeiling: num("paidCeiling", engine.DEFAULTS.paidCeiling),
            retentionCurve: checkedRadio("retentionCurve") || "weibull",
            weibullK: num("weibullK", engine.DEFAULTS.weibullK),
            weibullLambda: num("weibullLambda", engine.DEFAULTS.weibullLambda),
            lognormalFastWeight: num("lognormalFastWeight", engine.DEFAULTS.lognormalFastWeight),
            lognormalFastMu: num("lognormalFastMu", engine.DEFAULTS.lognormalFastMu),
            lognormalFastSigma: num("lognormalFastSigma", engine.DEFAULTS.lognormalFastSigma),
            lognormalSlowMu: num("lognormalSlowMu", engine.DEFAULTS.lognormalSlowMu),
            lognormalSlowSigma: num("lognormalSlowSigma", engine.DEFAULTS.lognormalSlowSigma),
            monthlyExpansion: num("monthlyExpansion", 3.2) / 100,
            monthlyContraction: num("monthlyContraction", 0.5) / 100,
            expansionCapMultiple: num("expansionCap", 2.5),
            fixedOpex: num("fixedOpex", engine.DEFAULTS.fixedOpex),
            otherOpex: readExpenses()
        };
    }

    function setText(id, text) {
        var el = $(id);
        if (el) el.textContent = text;
    }

    function setGrade(id, tone, label) {
        var el = $(id);
        if (!el) return;
        el.textContent = label;
        el.className = "kpi-grade " + toneClass(tone);
    }

    function svgEl(name, attrs) {
        var node = document.createElementNS("http://www.w3.org/2000/svg", name);
        var key;
        if (attrs) {
            for (key in attrs) {
                if (Object.prototype.hasOwnProperty.call(attrs, key)) {
                    node.setAttribute(key, attrs[key]);
                }
            }
        }
        return node;
    }

    function polyline(values, x0, y0, w, h, min, max) {
        var range = max - min || 1;
        return values.map(function (v, i) {
            var x = x0 + (values.length === 1 ? 0 : (i / (values.length - 1)) * w);
            var y = y0 + h - ((v - min) / range) * h;
            return x.toFixed(1) + "," + y.toFixed(1);
        }).join(" ");
    }

    function renderCashChart(result) {
        var host = $("cashChart");
        host.innerHTML = "";
        var cash = [result.config.startingCash].concat(result.months.map(function (m) { return m.cash; }));
        var width = 760;
        var height = 220;
        var padL = 54;
        var padR = 16;
        var padT = 16;
        var padB = 28;
        var plotW = width - padL - padR;
        var plotH = height - padT - padB;
        var min = Math.min.apply(null, cash.concat([0]));
        var max = Math.max.apply(null, cash.concat([0]));
        var svg = svgEl("svg", { viewBox: "0 0 " + width + " " + height, role: "img" });
        var pts = polyline(cash, padL, padT, plotW, plotH, min, max);
        var zeroY = padT + plotH - ((0 - min) / ((max - min) || 1)) * plotH;
        var area = "M" + pts.replace(/ /g, " L") + " L" + (padL + plotW) + "," + (padT + plotH) + " L" + padL + "," + (padT + plotH) + " Z";
        var troughIdx = result.metrics.cash.troughMonth;
        var troughVal = result.metrics.cash.troughCash;
        var troughX = padL + (troughIdx / (cash.length - 1)) * plotW;
        var troughY = padT + plotH - ((troughVal - min) / ((max - min) || 1)) * plotH;

        svg.appendChild(svgEl("line", { x1: padL, x2: padL + plotW, y1: zeroY, y2: zeroY, stroke: "rgba(217,83,79,0.45)", "stroke-dasharray": "4 4" }));
        svg.appendChild(svgEl("path", { d: area, fill: "rgba(74,144,226,0.12)" }));
        svg.appendChild(svgEl("polyline", { points: pts, fill: "none", stroke: "#4a90e2", "stroke-width": "2.2" }));
        svg.appendChild(svgEl("circle", { cx: troughX.toFixed(1), cy: troughY.toFixed(1), r: 5, fill: "#f0ad4e" }));
        var troughLabel = svgEl("text", { x: Math.min(troughX + 8, width - 120).toFixed(1), y: Math.max(troughY - 8, 14).toFixed(1), class: "chart-label" });
        troughLabel.textContent = "Trough " + formatCurrency(troughVal);
        svg.appendChild(troughLabel);
        var yMax = svgEl("text", { x: 6, y: padT + 10, class: "chart-label" });
        yMax.textContent = formatCurrency(max);
        svg.appendChild(yMax);
        var yMin = svgEl("text", { x: 6, y: padT + plotH, class: "chart-label" });
        yMin.textContent = formatCurrency(min);
        svg.appendChild(yMin);
        host.appendChild(svg);
    }

    function renderRetentionChart(result) {
        var host = $("retentionChart");
        host.innerHTML = "";
        var pts = result.retentionCurve;
        var width = 520;
        var height = 210;
        var padL = 36;
        var padR = 10;
        var padT = 12;
        var padB = 24;
        var plotW = width - padL - padR;
        var plotH = height - padT - padB;
        var svg = svgEl("svg", { viewBox: "0 0 " + width + " " + height });
        var xs = function (arr, key) {
            return polyline(arr.map(function (p) { return p[key]; }), padL, padT, plotW, plotH, 0, Math.max(1.4, Math.max.apply(null, arr.map(function (p) { return p.nrr; }))));
        };
        var maxNrr = Math.max(1.4, Math.max.apply(null, pts.map(function (p) { return p.nrr; })));
        svg.appendChild(svgEl("line", {
            x1: padL, x2: padL + plotW,
            y1: padT + plotH - (1 / maxNrr) * plotH,
            y2: padT + plotH - (1 / maxNrr) * plotH,
            stroke: "rgba(232,238,247,0.15)", "stroke-dasharray": "3 4"
        }));
        svg.appendChild(svgEl("polyline", { points: xs(pts, "survival"), fill: "none", stroke: "#007bff", "stroke-width": "2" }));
        svg.appendChild(svgEl("polyline", { points: xs(pts, "grr"), fill: "none", stroke: "#f0ad4e", "stroke-width": "2" }));
        svg.appendChild(svgEl("polyline", { points: xs(pts, "nrr"), fill: "none", stroke: "#4CAF50", "stroke-width": "2" }));
        var hundred = svgEl("text", { x: 4, y: padT + plotH - (1 / maxNrr) * plotH + 3, class: "chart-label" });
        hundred.textContent = "100%";
        svg.appendChild(hundred);
        host.appendChild(svg);
    }

    function renderFlags(result) {
        var list = $("flagList");
        list.innerHTML = "";
        result.flags.forEach(function (flag) {
            var li = document.createElement("li");
            li.className = "flag " + flag.severity;
            var valueText;
            if (flag.id === "nrr" || flag.id === "grr") valueText = formatPct(flag.value);
            else if (flag.id === "payback" || flag.id === "runway") valueText = formatMonths(flag.value);
            else if (flag.id === "defaultRisk") valueText = "M" + flag.value;
            else if (flag.id === "saturation") valueText = formatCurrency(flag.value);
            else valueText = formatRatio(flag.value);
            li.innerHTML =
                '<span class="flag-sev">' + (flag.severity === "pass" ? "Pass" : flag.severity) + "</span>" +
                "<div><h3>" + flag.name + "</h3><p>" + flag.message + "</p></div>" +
                '<span class="flag-value">' + valueText + "</span>";
            list.appendChild(li);
        });
        setText("auditKicker", result.diligence.verdict + " · " + result.diligence.red + " red · " + result.diligence.watch + " watch");
    }

    function renderFunnel(result) {
        var f = result.funnel;
        var last = result.months[result.months.length - 1];
        $("funnelSteps").innerHTML =
            '<li class="funnel-step"><span class="n">1</span><span class="label">Reach / leads</span><span class="value">' + formatNumber(f.requiredReach) + '</span></li>' +
            '<li class="funnel-step"><span class="n">2</span><span class="label">Free users</span><span class="value">' + formatNumber(f.requiredProspects) + '</span></li>' +
            '<li class="funnel-step"><span class="n">3</span><span class="label">Customers</span><span class="value">' + formatNumber(f.requiredCustomers) + '</span></li>' +
            '<li class="funnel-step"><span class="n">4</span><span class="label">' + (f.targetType === "Amount" ? "Amount" : "Target stock") + '</span><span class="value">' + formatCurrency(f.targetType === "ARR" ? f.targetValue : (f.targetMRR || f.targetValue)) + "</span></li>";

        var coverage = f.coverage == null ? "" : " Horizon coverage vs target: " + formatPct(f.coverage) + ".";
        var solve = result.leadSolve && !result.leadSolve.hitsTarget
            ? " To close the gap at month " + result.config.horizonMonths + " you need about " + formatNumber(result.leadSolve.monthlyLeads) + " baseline monthly leads after saturation."
            : (result.leadSolve && result.leadSolve.hitsTarget ? " Current lead plan is sufficient to hit the target inside the horizon." : "");
        var sat = result.metrics.saturationWarning ? " Paid and/or inbound volume is past baseline capacity — CAC is compounding." : "";
        setText("funnelNarrative",
            "M1 blended CAC " + formatCurrency(result.metrics.blendedCac) +
            " · M" + last.month + " blended CAC " + formatCurrency(result.metrics.horizonBlendedCac) +
            " · projected ending ARR " + formatCurrency(result.metrics.endingARR) +
            "." + coverage + solve + sat
        );
        setText("funnelKicker", result.months[0].newCustomers > 0
            ? "M1 mix " + formatNumber(result.months[0].inboundCustomers) + " inbound / " + formatNumber(result.months[0].paidCustomers) + " paid logos"
            : "Saturation-aware funnel");
    }

    function renderLedger(result) {
        var tbody = $("ledgerTable").querySelector("tbody");
        var trough = result.metrics.cash.troughMonth;
        tbody.innerHTML = result.months.map(function (m) {
            var leakage = m.churnedMRR + m.contractionMRR;
            var cashClass = m.cash < 0 ? "neg" : "";
            var burnClass = m.netBurn > 0 ? "neg" : "pos";
            var rowClass = m.month === trough ? "trough-row" : "";
            return "<tr class=\"" + rowClass + "\">" +
                "<td>" + m.month + (m.month === trough ? " ▾" : "") + "</td>" +
                "<td>" + formatNumber(m.leads) + "</td>" +
                "<td>" + formatNumber(m.newCustomers) + "</td>" +
                "<td>" + formatCurrency(m.endingMRR) + "</td>" +
                "<td>" + formatCurrency(m.newMRR) + "</td>" +
                "<td>" + formatCurrency(m.expansionMRR) + "</td>" +
                "<td>" + formatCurrency(leakage) + "</td>" +
                "<td>" + formatCurrency(m.smSpend) + "</td>" +
                "<td class=\"" + burnClass + "\">" + formatCurrency(m.netBurn) + "</td>" +
                "<td class=\"" + cashClass + "\">" + formatCurrency(m.cash) + "</td>" +
                "<td>" + (m.quickRatio === Infinity ? "∞" : formatRatio(m.quickRatio, "")) + "</td>" +
                "</tr>";
        }).join("");
    }

    function renderCashStats(result) {
        var c = result.metrics.cash;
        $("cashStats").innerHTML =
            '<div class="stat"><span>Cash trough</span><strong>' + formatCurrency(c.troughCash) + "</strong></div>" +
            '<div class="stat"><span>Trough month</span><strong>M' + c.troughMonth + "</strong></div>" +
            '<div class="stat"><span>Drawdown</span><strong>' + formatCurrency(c.troughDepth) + "</strong></div>" +
            '<div class="stat"><span>Min raise to clear trough</span><strong>' + formatCurrency(c.minVentureFunding) + "</strong></div>";
        var runwayText = c.survivesHorizon ? (result.config.horizonMonths + "+ mo") : formatMonths(c.runwayMonths);
        setText("troughKicker",
            "Runway " + runwayText +
            (c.cashFlowBreakevenMonth ? " · cash-flow breakeven M" + c.cashFlowBreakevenMonth : " · no CF breakeven in horizon") +
            " · 3-month burn buffer " + formatCurrency(c.safetyBuffer)
        );
    }

    function renderKpis(result) {
        var m = result.metrics;
        var c = m.cash;
        setText("kpiMagic", isFinite(m.magicNumber) ? m.magicNumber.toFixed(2) : "—");
        setGrade("kpiMagicGrade", m.magicGrade.tone, m.magicGrade.label);
        setText("kpiBurn", m.burnMultiple === Infinity ? "∞" : (isFinite(m.burnMultiple) ? m.burnMultiple.toFixed(2) + "x" : "—"));
        setGrade("kpiBurnGrade", m.burnGrade.tone, m.burnGrade.label);
        setText("kpiNrr", formatPct(m.nrr));
        setGrade("kpiNrrGrade", m.nrr >= 1 ? "good" : (m.nrr >= 0.9 ? "ok" : "danger"), "Modeled");
        setText("kpiGrr", formatPct(m.grr));
        setGrade("kpiGrrGrade", m.grr >= 0.85 ? "good" : "ok", "Modeled");
        setText("kpiQuick", m.quickRatio === Infinity ? "∞" : formatRatio(m.quickRatio, ""));
        setGrade("kpiQuickGrade", m.quickGrade.tone, m.quickGrade.label);
        setText("kpiLtvCac", m.ltvCac === Infinity ? "∞" : formatRatio(m.ltvCac));
        setGrade("kpiLtvCacGrade", isFinite(m.ltvCac) && m.ltvCac < 3 ? "danger" : "good", "GP LTV");
        setText("kpiPayback", formatMonths(m.paybackMonths));
        setGrade("kpiPaybackGrade", !isFinite(m.paybackMonths) || m.paybackMonths > 12 ? "danger" : "good", isFinite(m.paybackMonths) && m.paybackMonths <= 12 ? "Inside bar" : "Flag");
        var runwayLabel = c.survivesHorizon ? result.config.horizonMonths + "+" : c.runwayMonths.toFixed(1);
        setText("kpiRunway", runwayLabel + " mo");
        setGrade("kpiRunwayGrade", c.survivesHorizon ? "good" : "danger", "Trough " + formatCurrency(c.troughDepth));

        var pill = $("verdictPill");
        pill.textContent = result.diligence.verdict;
        pill.className = "verdict-pill " + (result.diligence.red ? "danger" : (result.diligence.watch ? "ok" : "good"));
    }

    function updateRetentionPreview(result) {
        var m = result.metrics;
        setText("retentionPreview",
            "Month-1 logo churn " + formatPct(m.m1LogoChurn) +
            " · month-3 logo retention " + formatPct(m.m3LogoRetention) +
            " · 12-mo logo retention " + formatPct(m.logoRetention12) +
            (m.realizedLegacyNrr != null ? " · realized book NRR " + formatPct(m.realizedLegacyNrr) : "") +
            "."
        );
    }

    function toggleCurveFields() {
        var curve = checkedRadio("retentionCurve");
        $("weibullFields").hidden = curve !== "weibull";
        $("lognormalFields").hidden = curve !== "lognormal";
    }

    function boardSnapshot(result) {
        var m = result.metrics;
        var lines = [
            "FUNNEL ESTIMATOR — BOARD SNAPSHOT",
            "Verdict: " + result.diligence.verdict,
            "Horizon: " + result.config.horizonMonths + " months",
            "",
            "CAPITAL EFFICIENCY",
            "  Magic Number     " + (isFinite(m.magicNumber) ? m.magicNumber.toFixed(2) : "n/a") + "  (" + m.magicGrade.label + ")",
            "  Burn Multiple    " + (isFinite(m.burnMultiple) ? m.burnMultiple.toFixed(2) + "x" : "n/a") + "  (" + m.burnGrade.label + ")",
            "  NRR / GRR        " + formatPct(m.nrr) + " / " + formatPct(m.grr),
            "  Quick Ratio      " + (m.quickRatio === Infinity ? "inf" : formatRatio(m.quickRatio, "")),
            "  LTV : CAC        " + formatRatio(m.ltvCac) + "   GP LTV " + formatCurrency(m.ltv) + " / CAC " + formatCurrency(m.blendedCac),
            "  CAC Payback      " + formatMonths(m.paybackMonths),
            "",
            "CASH",
            "  Starting / ending cash  " + formatCurrency(m.cash.startingCash) + " → " + formatCurrency(m.cash.endingCash),
            "  Trough                  " + formatCurrency(m.cash.troughCash) + " in month " + m.cash.troughMonth,
            "  Drawdown                " + formatCurrency(m.cash.troughDepth),
            "  Min raise to survive    " + formatCurrency(m.cash.minVentureFunding) + " (trough + 3 months peak burn)",
            "  Runway                  " + (m.cash.survivesHorizon ? result.config.horizonMonths + "+ months" : formatMonths(m.cash.runwayMonths)),
            "",
            "GROWTH",
            "  Starting ARR  " + formatCurrency(m.startingARR) + " → ending ARR " + formatCurrency(m.endingARR),
            "  M1 CAC " + formatCurrency(m.blendedCac) + " → horizon CAC " + formatCurrency(m.horizonBlendedCac),
            "",
            "DILIGENCE FLAGS"
        ];
        result.flags.forEach(function (flag) {
            lines.push("  [" + flag.severity.toUpperCase() + "] " + flag.name + " — " + flag.message);
        });
        return lines.join("\n");
    }

    function showToast(message) {
        var toast = $("toast");
        toast.textContent = message;
        toast.hidden = false;
        setTimeout(function () { toast.hidden = true; }, 1800);
    }

    function addExpenseItem(name, cost) {
        var list = $("expenseList");
        var row = document.createElement("div");
        row.className = "expense-item";
        row.innerHTML =
            '<input type="text" class="expense-name" placeholder="Item (e.g. contractors)" value="' + (name || "") + '">' +
            '<input type="number" class="expense-cost" min="0" step="100" placeholder="$/mo" value="' + (cost || "") + '">' +
            '<button type="button" class="remove-expense-btn" title="Remove">×</button>';
        row.querySelector(".expense-cost").addEventListener("input", recalculate);
        row.querySelector(".remove-expense-btn").addEventListener("click", function () {
            row.remove();
            recalculate();
        });
        list.appendChild(row);
    }

    var lastResult = null;
    var lastTargetType = checkedFullTarget();

    function convertTargetOnTypeChange() {
        var next = checkedFullTarget();
        var val = num("targetValue", 0);
        if (next !== lastTargetType && isFinite(val) && val > 0) {
            if (lastTargetType === "ARR" && next === "MRR") {
                $("targetValue").value = String(Math.round(val / 12));
            } else if (lastTargetType === "MRR" && next === "ARR") {
                $("targetValue").value = String(Math.round(val * 12));
            }
        }
        lastTargetType = next;
    }

    function recalculate() {
        convertTargetOnTypeChange();
        $("inboundMixLabel").textContent = Math.round(num("inboundMix", 45)) + "%";
        toggleCurveFields();
        lastResult = engine.simulate(readState());
        renderKpis(lastResult);
        renderFlags(lastResult);
        renderCashStats(lastResult);
        renderCashChart(lastResult);
        renderRetentionChart(lastResult);
        renderFunnel(lastResult);
        renderLedger(lastResult);
        updateRetentionPreview(lastResult);
    }

    function applyMode(isMinimal) {
        document.body.classList.toggle("minimal-mode", isMinimal);
        document.body.classList.toggle("full-mode", !isMinimal);
        $("minimalApp").hidden = !isMinimal;
        $("fullApp").hidden = isMinimal;
        $("helpMinimal").hidden = !isMinimal;
        $("helpFull").hidden = isMinimal;
        $("helpTitle").textContent = isMinimal ? "How to Use This Calculator" : "Methodology";
        $("minimalModeToggle").checked = isMinimal;
        try {
            localStorage.setItem("funnelEstimator.minimal", isMinimal ? "1" : "0");
        } catch (err) {
            /* ignore quota / private mode */
        }
        if (isMinimal && typeof window.calculatePath === "function") {
            window.calculatePath();
        } else if (!isMinimal) {
            recalculate();
        }
    }

    function bind() {
        var controls = $("controls");
        controls.addEventListener("input", recalculate);
        controls.addEventListener("change", recalculate);
        $("addExpenseBtn").addEventListener("click", function () {
            addExpenseItem("", "");
        });
        $("copyBoardBtn").addEventListener("click", function () {
            if (!lastResult) return;
            var text = boardSnapshot(lastResult);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    showToast("Board snapshot copied");
                }).catch(function () {
                    showToast("Copy failed");
                });
            } else {
                showToast("Clipboard unavailable");
            }
        });
        $("helpButton").addEventListener("click", function () {
            $("helpModal").hidden = false;
        });
        $("helpModal").querySelector(".close-help-button").addEventListener("click", function () {
            $("helpModal").hidden = true;
        });
        $("helpModal").addEventListener("click", function (event) {
            if (event.target === $("helpModal")) $("helpModal").hidden = true;
        });
        $("minimalModeToggle").addEventListener("change", function () {
            applyMode($("minimalModeToggle").checked);
        });
    }

    bind();
    var savedMinimal = false;
    try {
        savedMinimal = localStorage.getItem("funnelEstimator.minimal") === "1";
    } catch (err) {
        savedMinimal = false;
    }
    applyMode(savedMinimal);
})();
