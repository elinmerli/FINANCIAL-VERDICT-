
(function () {
    "use strict";

    const D = window.ArchiveData;

    if (!D) {
        console.error("ArchiveData was not loaded.");
        return;
    }

    const $ = id => document.getElementById(id);

    const charts = {};

    let selectedCurrency = "USD";
    let bitcoinHistory = [];

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function money(value, currency = selectedCurrency) {
        return D.formatMoney(value, currency);
    }

    function convertPLN(value) {
        return D.toDisplayCurrency(value, selectedCurrency);
    }

    function showError(id, message) {
        const element = $(id);
        if (element) {
            element.textContent = message;
            element.classList.add("error-text");
        }
    }

    function clearError(id) {
        const element = $(id);
        if (element) element.classList.remove("error-text");
    }

    function setPage(pageName) {
        document.querySelectorAll(".app-page").forEach(page => {
            page.classList.toggle("active", page.dataset.page === pageName);
        });

        document.querySelectorAll(".nav-link").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.pageTarget === pageName
            );
        });

        if (pageName === "globe") {
            window.ArchiveGlobe?.init();
        }

        if (pageName === "economy" && !$("economyGDP").dataset.loaded) {
            loadEconomyProfile($("economyCountry").value);
        }
    }

    function setupNavigation() {
        document.querySelectorAll("[data-page-target]").forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();

                setPage(button.dataset.pageTarget);

                $("sidebar").classList.remove("open");
                $("mobileOverlay").classList.remove("visible");
            });
        });

        $("mobileMenu").addEventListener("click", () => {
            $("sidebar").classList.toggle("open");
            $("mobileOverlay").classList.toggle("visible");
        });

        $("mobileOverlay").addEventListener("click", () => {
            $("sidebar").classList.remove("open");
            $("mobileOverlay").classList.remove("visible");
        });
    }

    function setupDate() {
        const now = new Date();

        setText("currentDate", now.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }));
    }

    function chartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#191815",
                    borderColor: "rgba(182,154,97,.35)",
                    borderWidth: 1,
                    titleColor: "#d1b77d",
                    bodyColor: "#e7dfce"
                }
            },
            scales: {
                x: {
                    grid: { color: "rgba(182,154,97,.08)" },
                    ticks: { color: "#928a79", maxTicksLimit: 7 }
                },
                y: {
                    grid: { color: "rgba(182,154,97,.08)" },
                    ticks: { color: "#928a79" }
                }
            }
        };
    }

    function drawLineChart(id, labels, values, label) {
        const canvas = $(id);

        if (!canvas || typeof Chart === "undefined") return;

        if (charts[id]) charts[id].destroy();

        charts[id] = new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label,
                    data: values,
                    borderColor: "#b69a61",
                    backgroundColor: "rgba(182,154,97,.10)",
                    fill: true,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2
                }]
            },
            options: chartOptions()
        });
    }

    function drawEconomyChart(id, labels, values, label) {
        const canvas = $(id);

        if (!canvas || typeof Chart === "undefined") return;

        if (charts[id]) charts[id].destroy();

        charts[id] = new Chart(canvas, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label,
                    data: values,
                    borderColor: "#b69a61",
                    backgroundColor: "rgba(182,154,97,.08)",
                    fill: true,
                    tension: 0.25,
                    pointRadius: 2
                }]
            },
            options: chartOptions()
        });
    }

    function updateCurrencyOptions() {
        const available = D.state.currencies.map(item => item.code);
        const common = ["USD", "EUR", "GBP", "CHF", "JPY", "PLN"];

        const options = [...new Set([...common, ...available])];

        ["convertFrom", "convertTo"].forEach(id => {
            const select = $(id);
            if (!select) return;

            const previous = select.value;

            select.innerHTML = "";

            options.forEach(code => {
                const option = document.createElement("option");
                option.value = code;
                option.textContent = code + " — " + (D.currencyNames[code] || code);
                select.appendChild(option);
            });

            if (options.includes(previous)) {
                select.value = previous;
            }
        });

        $("convertFrom").value = "USD";
        $("convertTo").value = selectedCurrency;
    }

    function renderCurrencyTable() {
        const rows = D.getCurrencyRows();
        const query = ($("currencySearch").value || "").trim().toLowerCase();
        const sort = $("currencySort").value;

        const filtered = rows.filter(item => {
            return item.code.toLowerCase().includes(query) ||
                item.name.toLowerCase().includes(query);
        });

        filtered.sort((a, b) => {
            if (sort === "name") return a.name.localeCompare(b.name);
            if (sort === "rate") return a.ratePLN - b.ratePLN;
            return a.code.localeCompare(b.code);
        });

        const body = $("currencyRows");
        body.innerHTML = "";

        filtered.forEach(item => {
            const tr = document.createElement("tr");

            const values = [
                item.code,
                item.name,
                D.formatNumber(item.ratePLN, 5),
                D.formatNumber(item.selectedRate, 5)
            ];

            values.forEach(value => {
                const td = document.createElement("td");
                td.textContent = value;
                tr.appendChild(td);
            });

            body.appendChild(tr);
        });

        setText("currencyCount", filtered.length + " currencies shown · Source: NBP");
        setText("currencySourceDate", "REFERENCE DATE: " + (D.state.rateDate || "—"));

        const overviewBody = $("overviewCurrencyRows");
        overviewBody.innerHTML = "";

        ["USD", "EUR", "GBP", "CHF", "JPY"].forEach(code => {
            const rate = D.convert(1, code, selectedCurrency);

            if (rate === null) return;

            const tr = document.createElement("tr");

            [code, D.currencyNames[code] || code, D.formatNumber(rate, 5)].forEach(value => {
                const td = document.createElement("td");
                td.textContent = value;
                tr.appendChild(td);
            });

            overviewBody.appendChild(tr);
        });

        const usd = D.convert(1, "USD", selectedCurrency);
        const eur = D.convert(1, "EUR", selectedCurrency);

        setText("overviewUSD", usd === null ? "Unavailable" : D.formatNumber(usd, 4));
        setText("overviewEUR", eur === null ? "Unavailable" : D.formatNumber(eur, 4));
    }

    async function refreshCurrencies(force = false) {
        try {
            await D.loadCurrencies(force);
            renderCurrencyTable();
            updateCurrencyOptions();
        } catch (error) {
            console.error("Currency data error:", error);
            showError("currencySourceDate", "Currency data temporarily unavailable");
        }
    }

    async function refreshGold(force = false) {
        try {
            const gold = await D.loadGold(force);
            const gram = convertPLN(gold.pricePLNPerGram);
            const ounce = gram === null ? null : gram * 31.1034768;

            setText("overviewGold", gram === null ? "Unavailable" : money(gram));
            setText("marketGoldGram", gram === null ? "Unavailable" : money(gram));
            setText("marketGoldOunce", ounce === null ? "Unavailable" : money(ounce));
            setText("marketGoldDate", "Observation date: " + D.formatDate(gold.date) + " · " + gold.source);
        } catch (error) {
            console.error("Gold data error:", error);
            setText("overviewGold", "Unavailable");
            setText("marketGoldGram", "Unavailable");
            setText("marketGoldOunce", "Unavailable");
            setText("marketGoldDate", "Gold data could not be retrieved.");
        }
    }

    async function refreshBitcoin(force = false) {
        try {
            const btc = await D.loadBitcoin(force);
            const price = D.convert(btc.usd, "USD", selectedCurrency);
            const cap = D.convert(btc.marketCapUSD, "USD", selectedCurrency);
            const volume = D.convert(btc.volumeUSD, "USD", selectedCurrency);
            const high = D.convert(btc.highUSD, "USD", selectedCurrency);
            const low = D.convert(btc.lowUSD, "USD", selectedCurrency);

            setText("overviewBitcoin", price === null ? "Unavailable" : money(price));
            setText("marketBitcoinPrice", price === null ? "Unavailable" : money(price));

            const change = Number(btc.change24h);
            const changeText = Number.isFinite(change)
                ? (change >= 0 ? "+" : "") + change.toFixed(2) + "% · 24h"
                : "Unavailable";

            setText("overviewBitcoinChange", changeText);
            setText("marketBitcoinChange", changeText);

            $("overviewBitcoinChange").className = "metric-foot " +
                (change >= 0 ? "positive" : "negative");

            $("marketBitcoinChange").className = "metric-foot " +
                (change >= 0 ? "positive" : "negative");

            setText("bitcoinMarketCap", cap === null ? "Unavailable" : money(cap, selectedCurrency, 0));
            setText("bitcoinVolume", volume === null ? "Unavailable" : money(volume, selectedCurrency, 0));
            setText("bitcoinHigh", high === null ? "Unavailable" : "High: " + money(high));
            setText("bitcoinLow", low === null ? "Unavailable" : "Low: " + money(low));
            setText("bitcoinSupply", D.formatNumber(btc.circulatingSupply, 0) + " BTC");
            setText("bitcoinUpdated", new Date(btc.updatedAt).toLocaleString());
            setText("lastUpdated", new Date().toLocaleTimeString());

            await refreshBitcoinChart(7);
        } catch (error) {
            console.error("Bitcoin data error:", error);
            setText("overviewBitcoin", "Unavailable");
            setText("marketBitcoinPrice", "Unavailable");
            setText("overviewBitcoinChange", "Market data unavailable");
            setText("marketBitcoinChange", "Market data unavailable");
        }
    }

    async function refreshBitcoinChart(days = 7) {
        try {
            bitcoinHistory = await D.loadBitcoinHistory(days, "usd");

            const labels = bitcoinHistory.map(point =>
                new Date(point.date).toLocaleDateString()
            );

            const values = bitcoinHistory.map(point =>
                D.convert(point.value, "USD", selectedCurrency)
            );

            drawLineChart("overviewBitcoinChart", labels, values, "Bitcoin");
            drawLineChart("marketBitcoinChart", labels, values, "Bitcoin");

            setText("bitcoinChartCaption", "CoinGecko historical prices · " + days + " day period");
            setText("marketChartNote", "CoinGecko historical prices · Displayed in " + selectedCurrency);
        } catch (error) {
            console.error("Bitcoin history error:", error);
            setText("bitcoinChartCaption", "Historical Bitcoin data is temporarily unavailable.");
            setText("marketChartNote", "Historical Bitcoin data is temporarily unavailable.");
        }
    }

    async function loadEconomyProfile(iso3) {
        setText("economyCountryStatus", "Retrieving published World Bank observations...");

        try {
            const data = await D.loadEconomy(iso3);

            const fields = [
                ["GDP", "economyGDP", "economyGDPYear", "%"],
                ["inflation", "economyInflation", "economyInflationYear", "%"],
                ["unemployment", "economyUnemployment", "economyUnemploymentYear", "%"]
            ];

            fields.forEach(([key, valueId, yearId, suffix]) => {
                const item = data[key];

                setText(valueId, item ? D.formatNumber(item.value, 2) + suffix : "Unavailable");
                setText(yearId, "Observation year: " + (item ? item.year : "Unavailable"));
            });

            $("economyGDP").dataset.loaded = "true";

            const population = data.population;
            setText(
                "economyCountryStatus",
                population
                    ? "Population record: " + D.formatNumber(population.value, 0) + " · " + population.year
                    : "Some indicators are not available for the latest reporting period."
            );

            const history = await D.loadEconomyHistory(iso3, "NY.GDP.MKTP.KD.ZG");

            drawEconomyChart(
                "economyChart",
                history.map(item => item.date),
                history.map(item => item.value),
                "GDP growth"
            );
        } catch (error) {
            console.error("Economy data error:", error);
            setText("economyCountryStatus", "Economic records could not be retrieved.");
            ["economyGDP", "economyInflation", "economyUnemployment"].forEach(id => {
                setText(id, "Unavailable");
            });
        }
    }

    async function loadCountryDossier(name, iso3) {
        setText("countryName", name);
        setText("countryIntro", "Retrieving published national economic records...");
        setText("countryCurrency", "—");
        setText("countryGDP", "Loading...");
        setText("countryInflation", "Loading...");
        setText("countryUnemployment", "Loading...");
        setText("countryPopulation", "Loading...");

        if (!iso3 || iso3 === "-99") {
            setText("countryIntro", "A country code could not be identified for this map feature.");
            return;
        }

        try {
            const data = await D.loadEconomy(iso3);

            setText("countryGDP", data.GDP ? D.formatNumber(data.GDP.value, 2) + "%" : "Unavailable");
            setText("countryInflation", data.inflation ? D.formatNumber(data.inflation.value, 2) + "%" : "Unavailable");
            setText("countryUnemployment", data.unemployment ? D.formatNumber(data.unemployment.value, 2) + "%" : "Unavailable");
            setText("countryPopulation", data.population ? D.formatNumber(data.population.value, 0) : "Unavailable");
            setText("countryCurrency", "Not supplied by this dataset");
            setText("countryIntro", "Available World Bank indicators. Each figure uses its own latest reported observation.");
            setText("countrySource", "Source: World Bank Open Data. Missing observations are shown as unavailable.");
        } catch (error) {
            setText("countryIntro", "Country economic data could not be retrieved.");
        }
    }

    function calculateConversion() {
        const amount = Number($("convertAmount").value);
        const from = $("convertFrom").value;
        const to = $("convertTo").value;

        if (!Number.isFinite(amount) || amount < 0) {
            setText("convertResult", "Please enter a valid non-negative amount.");
            return;
        }

        const result = D.convert(amount, from, to);

        if (result === null) {
            setText("convertResult", "A reference rate for this currency is unavailable.");
            return;
        }

        setText(
            "convertResult",
            D.formatNumber(amount, 2) + " " + from +
            " = " + D.formatNumber(result, 2) + " " + to
        );
    }

    function calculateCompound() {
        const principal = Number($("compoundPrincipal").value);
        const rate = Number($("compoundRate").value) / 100;
        const years = Number($("compoundYears").value);
        const frequency = Number($("compoundFrequency").value);

        if (principal < 0 || years < 0 || ![principal, rate, years, frequency].every(Number.isFinite) || frequency <= 0) {
            setText("compoundResult", "Please check the entered values.");
            return;
        }

        const total = principal * Math.pow(1 + rate / frequency, frequency * years);
        const interest = total - principal;

        setText(
            "compoundResult",
            "Final amount: " + D.formatNumber(total, 2) +
            "\nInterest earned: " + D.formatNumber(interest, 2)
        );
    }

    function calculateSimple() {
        const principal = Number($("simplePrincipal").value);
        const rate = Number($("simpleRate").value) / 100;
        const years = Number($("simpleYears").value);

        if (![principal, rate, years].every(Number.isFinite) || principal < 0 || years < 0) {
            setText("simpleResult", "Please check the entered values.");
            return;
        }

        const interest = principal * rate * years;
        const total = principal + interest;

        setText(
            "simpleResult",
            "Interest: " + D.formatNumber(interest, 2) +
            "\nFinal amount: " + D.formatNumber(total, 2)
        );
    }

    function calculateInflation() {
        const amount = Number($("inflationAmount").value);
        const rate = Number($("inflationRate").value) / 100;
        const years = Number($("inflationYears").value);

        if (![amount, rate, years].every(Number.isFinite) || amount < 0 || years < 0 || rate <= -1) {
            setText("inflationResult", "Please check the entered values.");
            return;
        }

        const futureCost = amount * Math.pow(1 + rate, years);
        const purchasingPower = amount / Math.pow(1 + rate, years);

        setText(
            "inflationResult",
            "Equivalent future cost: " + D.formatNumber(futureCost, 2) +
            "\nPurchasing power of the original amount: " + D.formatNumber(purchasingPower, 2)
        );
    }

    function setupCalculators() {
        $("convertButton").addEventListener("click", calculateConversion);
        $("compoundButton").addEventListener("click", calculateCompound);
        $("simpleButton").addEventListener("click", calculateSimple);
        $("inflationButton").addEventListener("click", calculateInflation);
    }

    async function loadHistoricalArchive() {
        const type = $("historyType").value;
        const period = Number($("historyPeriod").value);
        const currency = $("historyCurrency").value;

        $("historyRows").innerHTML = "";
        setText("historySource", "Loading historical observations...");

        try {
            let records = [];
            let source = "";

            if (type === "bitcoin") {
                records = await D.loadBitcoinHistory(period, currency.toLowerCase());
                source = "CoinGecko";
            } else if (type === "gold") {
                records = await D.loadGoldHistory();
                records = records.map(item => ({
                    date: item.date,
                    value: D.toDisplayCurrency(item.value, currency)
                }));
                source = "National Bank of Poland · gold prices in " + currency;
            } else if (type === "currency") {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - period);

                const code = currency === "PLN" ? "EUR" : currency;

                records = await D.loadCurrencyHistory(
                    code,
                    start.toISOString().slice(0, 10),
                    end.toISOString().slice(0, 10)
                );

                source = "National Bank of Poland · " + code + " in PLN";
            }

            const labels = records.map(item => {
                return typeof item.date === "string"
                    ? item.date
                    : new Date(item.date).toLocaleDateString();
            });

            const values = records.map(item => item.value);

            drawLineChart("historyChart", labels, values, type);

            const body = $("historyRows");
            body.innerHTML = "";

            records.slice().reverse().forEach(item => {
                const tr = document.createElement("tr");

                const date = document.createElement("td");
                date.textContent = typeof item.date === "string"
                    ? item.date
                    : D.formatDate(item.date);

                const value = document.createElement("td");
                value.textContent = D.formatNumber(item.value, 5);

                const provider = document.createElement("td");
                provider.textContent = source;

                tr.append(date, value, provider);
                body.appendChild(tr);
            });

            setText("historyChartTitle", type.toUpperCase() + " · " + period + " DAY PERIOD");
            setText("historySource", "Source: " + source + " · Records returned: " + records.length);

            if (!records.length) {
                body.innerHTML = "<tr><td colspan='3'>No historical observations were returned.</td></tr>";
            }
        } catch (error) {
            console.error("Historical archive error:", error);
            setText("historySource", "Historical records are temporarily unavailable.");
            $("historyRows").innerHTML =
                "<tr><td colspan='3'>The selected source did not return data.</td></tr>";
        }
    }

    function setupEvents() {
        $("displayCurrency").addEventListener("change", async event => {
            selectedCurrency = event.target.value;
            D.displayCurrency = selectedCurrency;

            await refreshAll(false);
            calculateConversion();
        });

        $("refreshData").addEventListener("click", async () => {
            D.clearCache();
            await refreshAll(true);
        });

        $("currencySearch").addEventListener("input", renderCurrencyTable);
        $("currencySort").addEventListener("change", renderCurrencyTable);

        $("economyCountry").addEventListener("change", event => {
            $("economyGDP").dataset.loaded = "";
            loadEconomyProfile(event.target.value);
        });

        $("bitcoinPeriod").addEventListener("change", event => {
            refreshBitcoinChart(Number(event.target.value));
        });

        $("historyType").addEventListener("change", () => {
            $("historyCurrencyWrap").style.display =
                $("historyType").value === "currency" ||
                $("historyType").value === "bitcoin" ||
                $("historyType").value === "gold"
                    ? "flex"
                    : "none";
        });

        $("loadHistory").addEventListener("click", loadHistoricalArchive);

        document.addEventListener("archive:country-selected", event => {
            const detail = event.detail;
            loadCountryDossier(detail.name, detail.iso3);
        });
    }

    async function refreshAll(force = false) {
        setText("lastUpdated", "Updating...");

        await Promise.allSettled([
            refreshCurrencies(force),
            refreshGold(force),
            refreshBitcoin(force)
        ]);

        renderCurrencyTable();
        setText("lastUpdated", new Date().toLocaleTimeString());
    }

    async function init() {
        setupDate();
        setupNavigation();
        setupCalculators();
        setupEvents();

        selectedCurrency = $("displayCurrency").value;
        D.displayCurrency = selectedCurrency;

        await refreshAll(false);

        $("historyType").dispatchEvent(new Event("change"));
        calculateConversion();

        loadEconomyProfile($("economyCountry").value);
    }

    document.addEventListener("DOMContentLoaded", init);
})();
