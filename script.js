
/* =========================================================
   THE MONETARY ARCHIVE
   MAIN APPLICATION
   ========================================================= */

(function () {
    "use strict";

    const DATA = window.ArchiveData;

    const state = {
        country: "PL",
        currency: "USD",
        activePage: "dashboard",
        activeChart: "currencies",
        chartPeriod: "30d",
        charts: {},
        dashboard: null,
        rates: null,
        lastUpdate: null,
        settings: {
            autoRefresh: true,
            refreshInterval: 300000,
            animations: true,
            currency: "USD"
        }
    };


    const FLAGS = {
        USD: "🇺🇸",
        EUR: "🇪🇺",
        GBP: "🇬🇧",
        CHF: "🇨🇭",
        PLN: "🇵🇱",
        JPY: "🇯🇵",
        CAD: "🇨🇦",
        AUD: "🇦🇺",
        CNY: "🇨🇳",
        INR: "🇮🇳",
        BRL: "🇧🇷",
        SEK: "🇸🇪",
        NOK: "🇳🇴",
        DKK: "🇩🇰",
        CZK: "🇨🇿",
        HUF: "🇭🇺"
    };


    const CURRENCY_NAMES = {
        USD: "US Dollar",
        EUR: "Euro",
        GBP: "Pound Sterling",
        CHF: "Swiss Franc",
        PLN: "Polish Zloty",
        JPY: "Japanese Yen",
        CAD: "Canadian Dollar",
        AUD: "Australian Dollar",
        CNY: "Chinese Yuan",
        INR: "Indian Rupee",
        BRL: "Brazilian Real",
        SEK: "Swedish Krona",
        NOK: "Norwegian Krone",
        DKK: "Danish Krone",
        CZK: "Czech Koruna",
        HUF: "Hungarian Forint"
    };


    const COUNTRY_NAMES = {
        PL: "Poland",
        US: "United States",
        GB: "United Kingdom",
        DE: "Germany",
        FR: "France",
        CH: "Switzerland",
        JP: "Japan",
        CN: "China",
        IN: "India",
        BR: "Brazil",
        CA: "Canada",
        AU: "Australia",
        IT: "Italy",
        ES: "Spain",
        NL: "Netherlands",
        SE: "Sweden",
        NO: "Norway",
        DK: "Denmark",
        CZ: "Czechia",
        HU: "Hungary"
    };


    const WORLD_BANK_COUNTRIES = [
        "PL", "US", "GB", "DE", "FR",
        "CH", "JP", "CN", "IN", "BR",
        "CA", "AU", "IT", "ES", "NL"
    ];


    /* =====================================================
       DOM HELPERS
    ===================================================== */

    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }


    function $all(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }


    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }


    function showNotification(message, type = "info") {
        const container = $("#notificationContainer");

        if (!container) return;

        const notification = document.createElement("div");

        notification.className = `notification ${type}`;
        notification.textContent = message;

        container.appendChild(notification);

        window.setTimeout(function () {
            notification.remove();
        }, 4500);
    }


    function setApplicationStatus(message) {
        setText("applicationStatus", message);
    }


    function setConnectionStatus(online, message) {
        const indicator = $("#connectionStatus");

        if (!indicator) return;

        indicator.classList.toggle("offline", !online);

        setText(
            "connectionText",
            message || (online ? "Connected" : "Unavailable")
        );
    }


    function safeNumber(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }


    function formatMoney(value, currency = state.currency) {
        const number = safeNumber(value);

        if (number === null) return "Unavailable";

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: currency,
                maximumFractionDigits: currency === "JPY" ? 0 : 2
            }).format(number);

        } catch (_) {
            return `${number.toLocaleString()} ${currency}`;
        }
    }


    function formatCompact(value, currency = state.currency) {
        const number = safeNumber(value);

        if (number === null) return "Unavailable";

        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: currency,
                notation: "compact",
                maximumFractionDigits: 2
            }).format(number);

        } catch (_) {
            return `${number.toLocaleString()} ${currency}`;
        }
    }


    function formatPercent(value) {
        const number = safeNumber(value);

        return number === null
            ? "Unavailable"
            : `${number.toFixed(2)}%`;
    }


    function formatDate(value) {
        if (!value) return "Unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString();
    }


    function formatDateTime(value) {
        if (!value) return "Unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Unavailable";
        }

        return date.toLocaleString();
    }


    function latestValue(values) {
        if (!Array.isArray(values) || !values.length) {
            return null;
        }

        return values[values.length - 1];
    }


    function safeLatest(values) {
        const item = latestValue(values);

        return item && safeNumber(item.value) !== null
            ? item
            : null;
    }


    function setChange(element, value, suffix = "%") {
        if (!element) return;

        const number = safeNumber(value);

        if (number === null) {
            element.textContent = "Unavailable";
            element.className = "metric-change";
            return;
        }

        const positive = number >= 0;

        element.textContent =
            `${positive ? "▲" : "▼"} ${Math.abs(number).toFixed(2)}${suffix}`;

        element.className = `metric-change ${positive ? "positive" : "negative"}`;
    }


    function showValue(value, formatter = String) {
        return value === null || value === undefined
            ? "Unavailable"
            : formatter(value);
    }


    /* =====================================================
       NAVIGATION
    ===================================================== */

    function openPage(pageName) {
        const page = document.querySelector(
            `[data-section="${pageName}"]`
        );

        if (!page) {
            showNotification("This section does not exist.", "error");
            return;
        }

        state.activePage = pageName;

        $all(".page-section").forEach(function (section) {
            section.classList.toggle(
                "active",
                section.dataset.section === pageName
            );
        });

        $all(".nav-item").forEach(function (button) {
            button.classList.toggle(
                "active",
                button.dataset.page === pageName
            );
        });

        if (pageName === "globe") {
            if (window.ArchiveGlobe) {
                window.ArchiveGlobe.init();
            }
        }

        if (pageName === "currencies") {
            renderCurrenciesTable();
        }

        if (pageName === "gold") {
            loadGoldPage();
        }

        if (pageName === "bitcoin") {
            loadBitcoinPage();
        }

        if (pageName === "inflation") {
            loadInflationPage();
        }

        if (pageName === "economy") {
            loadEconomyPage();
        }

        if (pageName === "history") {
            renderHistory();
        }

        if (pageName === "settings") {
            renderSettings();
        }

        window.scrollTo({
            top: 0,
            behavior: state.settings.animations ? "smooth" : "auto"
        });
    }


    function installNavigation() {
        $all(".nav-item").forEach(function (button) {
            button.addEventListener("click", function () {
                openPage(button.dataset.page);
            });
        });
    }


    /* =====================================================
       CLOCK
    ===================================================== */

    function updateClock() {
        const now = new Date();

        setText(
            "currentDate",
            now.toLocaleDateString()
        );

        setText(
            "currentTime",
            now.toLocaleTimeString()
        );
    }


    /* =====================================================
       DASHBOARD
    ===================================================== */

    async function loadDashboard() {
        setApplicationStatus("Loading financial information...");

        try {
            const dashboard = await DATA.loadDashboard(
                state.country,
                state.currency
            );

            state.dashboard = dashboard;
            state.rates = dashboard.rates;

            const usable = [
                dashboard.rates,
                dashboard.gold,
                dashboard.bitcoin,
                dashboard.economy
            ].some(item => item && !item.error);

            setConnectionStatus(
                usable,
                usable ? "Connected" : "Data unavailable"
            );

            await renderDashboard(dashboard);

            state.lastUpdate = new Date();

            setText(
                "footerUpdateTime",
                `Last update: ${state.lastUpdate.toLocaleTimeString()}`
            );

            setApplicationStatus(
                "Archive ready. Data availability depends on source."
            );

        } catch (error) {
            console.error("[Archive] Dashboard error:", error);

            setConnectionStatus(false, "Unavailable");

            setApplicationStatus("Could not load dashboard.");

            showNotification(
                "Some financial data could not be loaded.",
                "error"
            );
        }
    }


    async function renderDashboard(data) {
        await Promise.allSettled([
            renderDashboardRates(data.rates),
            renderDashboardGold(data.gold),
            renderDashboardBitcoin(data.bitcoin),
            renderDashboardEconomy(data.economy),
            renderDashboardIndicators(data.economy),
            renderMarketOverview(data.bitcoin)
        ]);

        renderCalendarUnavailable();

        renderDashboardChart();
    }


    /* =====================================================
       DASHBOARD EXCHANGE RATES
    ===================================================== */

    async function renderDashboardRates(rates) {
        const container = $("#dashboardExchangeRates");

        if (!container) return;

        if (!rates || !Array.isArray(rates.rows)) {
            container.innerHTML =
                '<div class="empty-state">Exchange rates unavailable.</div>';

            return;
        }

        const preferred = ["USD", "EUR", "GBP", "CHF"];

        const rows = preferred.map(code =>
            rates.rows.find(item => item.code === code)
        ).filter(Boolean);

        container.replaceChildren();

        rows.forEach(function (item) {
            const row = document.createElement("div");

            row.className = "exchange-row";

            const flag = document.createElement("span");
            flag.className = "exchange-flag";
            flag.textContent = FLAGS[item.code] || "🌐";

            const code = document.createElement("span");
            code.className = "exchange-code";
            code.textContent = item.code;

            const value = document.createElement("strong");
            value.className = "exchange-value";
            value.textContent = item.rate.toFixed(4);

            const change = document.createElement("span");
            change.className = "exchange-change";

            if (item.change === null) {
                change.textContent = "—";
            } else {
                change.textContent =
                    `${item.change >= 0 ? "▲" : "▼"} ${Math.abs(item.change).toFixed(2)}%`;

                change.classList.add(
                    item.change >= 0 ? "positive" : "negative"
                );
            }

            row.append(flag, code, value, change);
            container.appendChild(row);
        });

        setText(
            "ratesUpdated",
            `NBP observation: ${rates.date || "Unavailable"}`
        );
    }


    /* =====================================================
       GOLD
    ===================================================== */

    async function renderDashboardGold(gold) {
        if (!gold || gold.pricePerGramPLN === null) {
            setText("dashboardGoldPrice", "Unavailable");
            setText("goldUpdated", "No data");
            return;
        }

        try {
            const converted = await DATA.convertPLNValue(
                gold.pricePerGramPLN,
                state.currency
            );

            setText(
                "dashboardGoldPrice",
                formatMoney(converted, state.currency)
            );

            setText(
                "goldUpdated",
                formatDate(gold.date)
            );

            setText(
                "goldSource",
                gold.source
            );

            const ouncePLN = gold.pricePerGramPLN * 31.1034768;

            const ounce = await DATA.convertPLNValue(
                ouncePLN,
                state.currency
            );

            setText(
                "goldGramPrice",
                formatMoney(converted, state.currency)
            );

            setText(
                "goldOuncePrice",
                formatMoney(ounce, state.currency)
            );

            setChange($("#dashboardGoldChange"), null);

            renderGoldMiniChart();

        } catch (error) {
            console.error(error);

            setText("dashboardGoldPrice", "Unavailable");
        }
    }


    async function loadGoldPage() {
        try {
            const gold = await DATA.fetchGoldCurrent();

            await renderDashboardGold(gold);

            const currency = $("#goldHistoryCurrency")?.value || state.currency;

            await renderGoldHistoryChart(currency, 30);

        } catch (error) {
            showNotification("Gold data is temporarily unavailable.", "error");
        }
    }


    async function renderGoldMiniChart() {
        try {
            const history = await DATA.fetchGoldHistory(30);

            createChart("goldMiniChart", {
                type: "line",
                labels: history.map(item => item.date),
                values: history.map(item => item.value),
                color: "#e5aa54",
                compact: true
            });

        } catch (error) {
            console.warn("Gold mini chart unavailable:", error);
        }
    }


    async function renderGoldHistoryChart(currency, days) {
        const history = await DATA.fetchGoldHistory(days);

        const converted = await Promise.all(
            history.map(item =>
                DATA.convertPLNValue(item.value, currency)
            )
        );

        createChart("goldHistoryChart", {
            type: "line",
            labels: history.map(item => item.date),
            values: converted,
            color: "#e5aa54"
        });
    }


    /* =====================================================
       BITCOIN
    ===================================================== */

    async function renderDashboardBitcoin(bitcoin) {
        if (!bitcoin || bitcoin.price === null) {
            setText("dashboardBitcoinPrice", "Unavailable");
            setText("bitcoinUpdated", "No data");
            return;
        }

        setText(
            "dashboardBitcoinPrice",
            formatMoney(bitcoin.price, bitcoin.currency)
        );

        setText(
            "dashboardBitcoinChange",
            bitcoin.change24h === null
                ? "Unavailable"
                : `${bitcoin.change24h >= 0 ? "▲" : "▼"} ${Math.abs(bitcoin.change24h).toFixed(2)}%`
        );

        setChange(
            $("#dashboardBitcoinChange"),
            bitcoin.change24h
        );

        setText(
            "bitcoinUpdated",
            formatDateTime(bitcoin.timestamp)
        );

        renderBitcoinMiniChart();
    }


    async function loadBitcoinPage() {
        const currency =
            $("#bitcoinCurrency")?.value.toLowerCase() ||
            state.currency.toLowerCase();

        try {
            const bitcoin = await DATA.fetchBitcoinCurrent(currency);

            setText(
                "bitcoinPrice",
                formatMoney(bitcoin.price, currency.toUpperCase())
            );

            setText(
                "bitcoinChange",
                formatPercent(bitcoin.change24h)
            );

            setText(
                "bitcoinMarketCap",
                formatCompact(bitcoin.marketCap, currency.toUpperCase())
            );

            setText(
                "bitcoinVolume",
                formatCompact(bitcoin.volume24h, currency.toUpperCase())
            );

            await renderBitcoinHistoryChart(currency, 7);

            const market = $("#detailedMarketData");

            if (market) {
                market.innerHTML = `
                    <div class="market-item">
                        <span>Bitcoin</span>
                        <strong>${formatMoney(bitcoin.price, currency.toUpperCase())}</strong>
                        <small>${bitcoin.source}</small>
                    </div>
                    <div class="market-item">
                        <span>Market capitalization</span>
                        <strong>${formatCompact(bitcoin.marketCap, currency.toUpperCase())}</strong>
                        <small>Reported market value</small>
                    </div>
                    <div class="market-item">
                        <span>24-hour volume</span>
                        <strong>${formatCompact(bitcoin.volume24h, currency.toUpperCase())}</strong>
                        <small>Reported trading volume</small>
                    </div>
                `;
            }

        } catch (error) {
            console.error(error);

            showNotification(
                "Bitcoin data is temporarily unavailable.",
                "error"
            );
        }
    }


    async function renderBitcoinMiniChart() {
        try {
            const history = await DATA.fetchBitcoinHistory(
                state.currency.toLowerCase(),
                7
            );

            createChart("bitcoinMiniChart", {
                type: "line",
                labels: history.map(item => item.date),
                values: history.map(item => item.value),
                color: "#e5aa54",
                compact: true
            });

        } catch (error) {
            console.warn(error);
        }
    }


    async function renderBitcoinHistoryChart(currency, days) {
        const history = await DATA.fetchBitcoinHistory(currency, days);

        createChart("bitcoinHistoryChart", {
            type: "line",
            labels: history.map(item => item.date),
            values: history.map(item => item.value),
            color: "#e5aa54"
        });
    }


    /* =====================================================
       ECONOMY
    ===================================================== */

    async function renderDashboardEconomy(economy) {
        if (!economy || economy.error) {
            setText("dashboardInflation", "Unavailable");
            setText("dashboardGDP", "Unavailable");
            setText("inflationUpdated", "No data");
            setText("gdpUpdated", "No data");
            return;
        }

        const inflation = safeLatest(economy.inflation);
        const gdp = safeLatest(economy.gdp);
        const unemployment = safeLatest(economy.unemployment);

        setText(
            "dashboardInflation",
            inflation ? formatPercent(inflation.value) : "Unavailable"
        );

        setText(
            "dashboardGDP",
            gdp ? formatPercent(gdp.value) : "Unavailable"
        );

        setText(
            "inflationCountryLabel",
            COUNTRY_NAMES[state.country] || state.country
        );

        setText(
            "gdpCountryLabel",
            COUNTRY_NAMES[state.country] || state.country
        );

        setText(
            "inflationUpdated",
            inflation ? inflation.year : "Unavailable"
        );

        setText(
            "gdpUpdated",
            gdp ? gdp.year : "Unavailable"
        );

        setText(
            "economyGDP",
            gdp ? formatPercent(gdp.value) : "Unavailable"
        );

        setText(
            "economyInflation",
            inflation ? formatPercent(inflation.value) : "Unavailable"
        );

        setText(
            "economyUnemployment",
            unemployment
                ? formatPercent(unemployment.value)
                : "Unavailable"
        );

        const gdpPerCapita = safeLatest(economy.gdpPerCapita);

        setText(
            "economyGDPPerCapita",
            gdpPerCapita
                ? formatMoney(gdpPerCapita.value, "USD")
                : "Unavailable"
        );

        if (inflation) {
            createChart("inflationMiniChart", {
                labels: economy.inflation.map(item => item.year),
                values: economy.inflation.map(item => item.value),
                color: "#9bd5df",
                compact: true
            });
        }

        if (gdp) {
            createChart("gdpMiniChart", {
                labels: economy.gdp.map(item => item.year),
                values: economy.gdp.map(item => item.value),
                color: "#e6ae5d",
                compact: true,
                type: "bar"
            });
        }
    }


    async function renderDashboardIndicators(economy) {
        const container = $("#dashboardIndicators");

        if (!container) return;

        const indicators = [
            {
                name: "Unemployment Rate",
                data: economy?.unemployment,
                unit: "%"
            },
            {
                name: "Industrial Production",
                data: null,
                unit: ""
            },
            {
                name: "Retail Sales",
                data: null,
                unit: ""
            },
            {
                name: "GDP Growth",
                data: economy?.gdp,
                unit: "%"
            }
        ];

        container.replaceChildren();

        indicators.forEach(function (indicator) {
            const item = safeLatest(indicator.data);

            const box = document.createElement("div");
            box.className = "indicator-item";

            const label = document.createElement("span");
            label.textContent = indicator.name;

            const value = document.createElement("strong");
            value.textContent = item
                ? `${item.value.toFixed(2)}${indicator.unit}`
                : "Unavailable";

            const year = document.createElement("small");
            year.textContent = item ? String(item.year) : "No data";
            year.className = "muted";

            box.append(label, value, year);
            container.appendChild(box);
        });
    }


    async function loadInflationPage() {
        const country = $("#inflationCountry")?.value || state.country;

        try {
            const history = await DATA.fetchWorldBankIndicator(
                country,
                "inflation",
                2000
            );

            const current = latestValue(history);
            const previous = history.length > 1
                ? history[history.length - 2]
                : null;

            setText(
                "inflationCurrent",
                current ? formatPercent(current.value) : "Unavailable"
            );

            setText(
                "inflationPrevious",
                previous ? formatPercent(previous.value) : "Unavailable"
            );

            setText(
                "inflationYear",
                current ? current.year : "Unavailable"
            );

            createChart("inflationHistoryChart", {
                labels: history.map(item => item.year),
                values: history.map(item => item.value),
                color: "#a7dce5"
            });

            await renderInflationComparison();

        } catch (error) {
            console.error(error);

            showNotification("Inflation data unavailable.", "error");
        }
    }


    async function renderInflationComparison() {
        const body = $("#inflationComparisonBody");

        if (!body) return;

        body.innerHTML =
            '<tr><td colspan="5">Loading country data...</td></tr>';

        const results = await Promise.allSettled(
            WORLD_BANK_COUNTRIES.map(async function (code) {
                const history = await DATA.fetchWorldBankIndicator(
                    code,
                    "inflation",
                    2015
                );

                return {
                    code,
                    latest: latestValue(history),
                    previous: history.length > 1
                        ? history[history.length - 2]
                        : null
                };
            })
        );

        body.replaceChildren();

        results.forEach(function (result, index) {
            const row = document.createElement("tr");

            const data = result.status === "fulfilled"
                ? result.value
                : null;

            const code = WORLD_BANK_COUNTRIES[index];

            const values = [
                COUNTRY_NAMES[code] || code,
                data?.latest
                    ? formatPercent(data.latest.value)
                    : "Unavailable",
                data?.previous
                    ? formatPercent(data.previous.value)
                    : "Unavailable",
                data?.latest
                    ? data.latest.year
                    : "Unavailable",
                "World Bank"
            ];

            values.forEach(function (value) {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            body.appendChild(row);
        });
    }


    async function loadEconomyPage() {
        const country = $("#economyCountry")?.value || state.country;
        const indicator = $("#economyIndicator")?.value || "gdp";

        try {
            const economy = await DATA.fetchCountryEconomy(country);

            const selected = economy[indicator] || [];

            createChart("economyHistoryChart", {
                labels: selected.map(item => item.year),
                values: selected.map(item => item.value),
                color: "#d9a85d"
            });

            await renderEconomyComparison();

        } catch (error) {
            showNotification("Economic data unavailable.", "error");
        }
    }


    async function renderEconomyComparison() {
        const body = $("#economyComparisonBody");

        if (!body) return;

        body.innerHTML =
            '<tr><td colspan="5">Loading country comparisons...</td></tr>';

        const results = await DATA.fetchCountryComparisons(
            WORLD_BANK_COUNTRIES
        );

        body.replaceChildren();

        results.forEach(function (country) {
            const row = document.createElement("tr");

            const values = [
                country.name,
                safeLatest(country.economy.gdp),
                safeLatest(country.economy.inflation),
                safeLatest(country.economy.unemployment),
                safeLatest(country.economy.gdpPerCapita)
            ];

            values.forEach(function (item, index) {
                const cell = document.createElement("td");

                if (index === 0) {
                    cell.textContent = item;
                } else if (!item) {
                    cell.textContent = "Unavailable";
                } else if (index === 4) {
                    cell.textContent = formatMoney(item.value, "USD");
                } else {
                    cell.textContent = formatPercent(item.value);
                }

                row.appendChild(cell);
            });

            body.appendChild(row);
        });
    }


    /* =====================================================
       ECONOMIC CALENDAR
    ===================================================== */

    function renderCalendarUnavailable() {
        const container = $("#economicCalendar");

        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                No verified calendar feed is connected.
                Economic events are not invented.
            </div>
        `;
    }


    /* =====================================================
       MARKET OVERVIEW
    ===================================================== */

    async function renderMarketOverview(bitcoin) {
        const container = $("#marketOverview");

        if (!container) return;

        container.innerHTML = `
            <div class="market-item">
                <span>Bitcoin</span>
                <strong>
                    ${bitcoin && bitcoin.price !== null
                        ? formatMoney(bitcoin.price, bitcoin.currency)
                        : "Unavailable"}
                </strong>
                <small>CoinGecko</small>
            </div>

            <div class="market-item">
                <span>S&P 500</span>
                <strong>Unavailable</strong>
                <small>No live index feed connected</small>
            </div>

            <div class="market-item">
                <span>DAX</span>
                <strong>Unavailable</strong>
                <small>No live index feed connected</small>
            </div>
        `;
    }


    /* =====================================================
       CURRENCY TABLE
    ===================================================== */

    async function renderCurrenciesTable() {
        const body = $("#currenciesTableBody");

        if (!body) return;

        body.innerHTML =
            '<tr><td colspan="6">Loading currency rates...</td></tr>';

        try {
            const rates = await DATA.getExchangeRates();

            state.rates = rates;

            const display =
                $("#currencyDisplay")?.value || state.currency;

            const search =
                ($("#currencySearch")?.value || "").trim().toLowerCase();

            const sort = $("#currencySort")?.value || "code";

            const displayRate = rates.values[display];

            let rows = rates.rows.map(function (item) {
                const value = displayRate
                    ? item.rate / displayRate
                    : null;

                const previous = item.previousRate && displayRate
                    ? item.previousRate / displayRate
                    : null;

                return {
                    ...item,
                    displayRate: value,
                    displayPrevious: previous
                };
            });

            rows = rows.filter(function (item) {
                const name = CURRENCY_NAMES[item.code] || "";

                return (
                    item.code.toLowerCase().includes(search) ||
                    name.toLowerCase().includes(search)
                );
            });

            rows.sort(function (a, b) {
                if (sort === "rate-asc") {
                    return (a.displayRate || 0) - (b.displayRate || 0);
                }

                if (sort === "rate-desc") {
                    return (b.displayRate || 0) - (a.displayRate || 0);
                }

                if (sort === "name") {
                    return (CURRENCY_NAMES[a.code] || a.code)
                        .localeCompare(CURRENCY_NAMES[b.code] || b.code);
                }

                return a.code.localeCompare(b.code);
            });

            body.replaceChildren();

            rows.forEach(function (item) {
                const row = document.createElement("tr");

                const values = [
                    `${FLAGS[item.code] || "🌐"} ${CURRENCY_NAMES[item.code] || item.code}`,
                    item.code,
                    item.displayRate === null
                        ? "Unavailable"
                        : item.displayRate.toFixed(5),
                    item.displayPrevious === null
                        ? "Unavailable"
                        : item.displayPrevious.toFixed(5),
                    item.change === null
                        ? "Unavailable"
                        : `${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)}%`,
                    item.source
                ];

                values.forEach(function (value, index) {
                    const cell = document.createElement("td");
                    cell.textContent = value;

                    if (index === 4 && item.change !== null) {
                        cell.classList.add(
                            item.change >= 0 ? "positive" : "negative"
                        );
                    }

                    row.appendChild(cell);
                });

                body.appendChild(row);
            });

            setText("currencyBase", display);
            setText("currencyCount", rows.length);
            setText("currencyLastUpdate", rates.date || "Unavailable");

        } catch (error) {
            console.error(error);

            body.innerHTML =
                '<tr><td colspan="6">Currency data unavailable.</td></tr>';
        }
    }


    /* =====================================================
       CURRENCY CONVERTER
    ===================================================== */

    async function convertFromForm() {
        const amount = safeNumber($("#converterFromAmount")?.value);
        const from = $("#converterFrom")?.value;
        const to = $("#converterTo")?.value;

        if (amount === null || amount < 0) {
            showNotification("Enter a valid amount.", "error");
            return;
        }

        try {
            const result = await DATA.convertValue(amount, from, to);

            setText(
                "converterResult",
                formatMoney(result, to)
            );

            const rate = await DATA.getCurrencyRate(from, to);

            setText(
                "converterRate",
                `1 ${from} = ${rate.toFixed(6)} ${to}`
            );

        } catch (error) {
            setText("converterResult", "Unavailable");

            setText(
                "converterRate",
                error.message
            );

            showNotification(error.message, "error");
        }
    }


    async function convertQuickCalculator() {
        const amount = safeNumber($("#calcCurrencyAmount")?.value);
        const from = $("#calcCurrencyFrom")?.value;
        const to = $("#calcCurrencyTo")?.value;

        if (amount === null || amount < 0) {
            showNotification("Enter a valid amount.", "error");
            return;
        }

        try {
            const result = await DATA.convertValue(amount, from, to);

            setText(
                "calcCurrencyResult",
                formatMoney(result, to)
            );

        } catch (error) {
            setText("calcCurrencyResult", error.message);
        }
    }


    function swapCurrencies() {
        const from = $("#converterFrom");
        const to = $("#converterTo");

        if (!from || !to) return;

        const oldFrom = from.value;

        from.value = to.value;
        to.value = oldFrom;

        convertFromForm();
    }


    /* =====================================================
       CHART ENGINE
    ===================================================== */

    function createChart(canvasId, options) {
        const canvas = document.getElementById(canvasId);

        if (!canvas || !window.Chart) return null;

        const context = canvas.getContext("2d");

        if (state.charts[canvasId]) {
            state.charts[canvasId].destroy();
        }

        const labels = options.labels || [];
        const values = options.values || [];
        const color = options.color || "#d7a45e";

        const gradient = context.createLinearGradient(0, 0, 0, 280);

        gradient.addColorStop(0, `${color}66`);
        gradient.addColorStop(1, `${color}00`);

        state.charts[canvasId] = new Chart(context, {
            type: options.type || "line",

            data: {
                labels: labels,

                datasets: [{
                    label: options.label || "Value",
                    data: values,

                    borderColor: color,
                    backgroundColor: options.compact ? color : gradient,

                    borderWidth: options.compact ? 1.8 : 2.5,

                    fill: options.type !== "bar",

                    tension: 0.32,

                    pointRadius: options.compact ? 0 : 2,
                    pointHoverRadius: 5,

                    borderRadius: options.type === "bar" ? 3 : 0
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                animation: {
                    duration: state.settings.animations ? 450 : 0
                },

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        enabled: true,

                        backgroundColor: "#171a22",
                        titleColor: "#f1c47d",
                        bodyColor: "#eeeeee",

                        borderColor: "#92632d",
                        borderWidth: 1
                    }
                },

                scales: options.compact
                    ? {
                        x: {
                            display: false
                        },
                        y: {
                            display: false
                        }
                    }
                    : {
                        x: {
                            grid: {
                                color: "rgba(255,255,255,0.055)"
                            },
                            ticks: {
                                color: "#a0a0a8",
                                maxTicksLimit: 9
                            }
                        },

                        y: {
                            grid: {
                                color: "rgba(255,255,255,0.07)"
                            },
                            ticks: {
                                color: "#a0a0a8"
                            }
                        }
                    }
            }
        });

        return state.charts[canvasId];
    }


    async function renderDashboardChart() {
        const type = state.activeChart;

        try {
            if (type === "currencies") {
                await renderCurrencyTrendChart();
            }

            if (type === "gold") {
                await renderGoldDashboardChart();
            }

            if (type === "bitcoin") {
                await renderBitcoinDashboardChart();
            }

            if (type === "inflation" || type === "gdp") {
                await renderEconomyDashboardChart(type);
            }

        } catch (error) {
            console.error("Dashboard chart error:", error);

            showNotification(
                "The selected historical chart is unavailable.",
                "error"
            );
        }
    }


    async function renderCurrencyTrendChart() {
        const currency =
            $("#trendCurrency")?.value || "USD";

        const days = state.chartPeriod === "7d"
            ? 7
            : state.chartPeriod === "90d"
                ? 90
                : state.chartPeriod === "1y"
                    ? 365
                    : 30;

        const history = await fetchNBPCurrencyHistory(currency, days);

        createChart("dashboardMainChart", {
            labels: history.map(item => item.date),
            values: history.map(item => item.value),
            color: "#e6ad5e",
            label: `${currency}/PLN`
        });
    }


    async function fetchNBPCurrencyHistory(currency, days) {
        const count = Math.max(1, Math.min(365, Number(days)));

        const url =
            `https://api.nbp.pl/api/exchangerates/rates/A/${currency}/last/${count}/?format=json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`NBP history error: ${response.status}`);
        }

        const data = await response.json();

        return data.rates.map(item => ({
            date: item.effectiveDate,
            value: item.mid
        }));
    }


    async function renderGoldDashboardChart() {
        const days = periodToDays(state.chartPeriod);

        const history = await DATA.fetchGoldHistory(days);

        const values = await Promise.all(
            history.map(item =>
                DATA.convertPLNValue(item.value, state.currency)
            )
        );

        createChart("dashboardMainChart", {
            labels: history.map(item => item.date),
            values: values,
            color: "#e6ad5e",
            label: `Gold / ${state.currency}`
        });
    }


    async function renderBitcoinDashboardChart() {
        const days = periodToDays(state.chartPeriod);

        const history = await DATA.fetchBitcoinHistory(
            state.currency.toLowerCase(),
            days
        );

        createChart("dashboardMainChart", {
            labels: history.map(item => formatDate(item.date)),
            values: history.map(item => item.value),
            color: "#e6ad5e",
            label: `BTC / ${state.currency}`
        });
    }


    async function renderEconomyDashboardChart(type) {
        const history = await DATA.fetchWorldBankIndicator(
            state.country,
            type,
            2000
        );

        createChart("dashboardMainChart", {
            labels: history.map(item => item.year),
            values: history.map(item => item.value),
            color: type === "inflation" ? "#8fc9db" : "#e6ad5e",
            label: type
        });
    }


    function periodToDays(period) {
        const periods = {
            "24h": 1,
            "7d": 7,
            "30d": 30,
            "90d": 90,
            "1y": 365,
            "5y": 365
        };

        return periods[period] || 30;
    }


    /* =====================================================
       CHART CONTROLS
    ===================================================== */

    function installChartControls() {
        $all(".chart-tab").forEach(function (button) {
            button.addEventListener("click", function () {
                $all(".chart-tab").forEach(item =>
                    item.classList.remove("active")
                );

                button.classList.add("active");

                state.activeChart = button.dataset.chart;

                renderDashboardChart();
            });
        });

        $all("[data-chart-periods] button").forEach(function (button) {
            button.addEventListener("click", function () {
                $all("[data-chart-periods] button").forEach(item =>
                    item.classList.remove("active")
                );

                button.classList.add("active");

                state.chartPeriod = button.dataset.period;

                renderDashboardChart();
            });
        });

        const trendCurrency = $("#trendCurrency");

        if (trendCurrency) {
            trendCurrency.addEventListener("change", renderDashboardChart);
        }

        $("#currencyHistoryCode")?.addEventListener(
            "change",
            renderCurrencyHistoryPage
        );

        $("#currencyHistoryPeriod")?.addEventListener(
            "change",
            renderCurrencyHistoryPage
        );

        $("#goldHistoryCurrency")?.addEventListener(
            "change",
            loadGoldPage
        );

        $("#bitcoinCurrency")?.addEventListener(
            "change",
            loadBitcoinPage
        );

        $("#inflationCountry")?.addEventListener(
            "change",
            loadInflationPage
        );

        $("#economyCountry")?.addEventListener(
            "change",
            loadEconomyPage
        );

        $("#economyIndicator")?.addEventListener(
            "change",
            loadEconomyPage
        );
    }


    async function renderCurrencyHistoryPage() {
        const code = $("#currencyHistoryCode")?.value || "USD";

        const period = $("#currencyHistoryPeriod")?.value || "30d";

        try {
            const days = periodToDays(period);

            const history = await fetchNBPCurrencyHistory(code, days);

            createChart("currencyHistoryChart", {
                labels: history.map(item => item.date),
                values: history.map(item => item.value),
                color: "#e5aa54",
                label: `${code}/PLN`
            });

        } catch (error) {
            showNotification("Currency history unavailable.", "error");
        }
    }


    /* =====================================================
       CALCULATORS
    ===================================================== */

    function readPositive(id, label, allowZero = true) {
        const value = safeNumber(document.getElementById(id)?.value);

        if (
            value === null ||
            (allowZero ? value < 0 : value <= 0)
        ) {
            throw new Error(`Enter a valid ${label}.`);
        }

        return value;
    }


    function calculateCompound() {
        try {
            const principal = readPositive("compoundPrincipal", "amount");
            const rate = readPositive("compoundRate", "interest rate");
            const years = readPositive("compoundYears", "number of years");
            const frequency = readPositive("compoundFrequency", "frequency", false);

            const finalValue = principal *
                Math.pow(
                    1 + (rate / 100) / frequency,
                    frequency * years
                );

            const interest = finalValue - principal;

            setText(
                "compoundResult",
                `Final value: ${formatMoney(finalValue, state.currency)} · Interest: ${formatMoney(interest, state.currency)}`
            );

        } catch (error) {
            setText("compoundResult", error.message);
        }
    }


    function calculateSimple() {
        try {
            const principal = readPositive("simplePrincipal", "amount");
            const rate = readPositive("simpleRate", "interest rate");
            const years = readPositive("simpleYears", "number of years");

            const interest = principal * (rate / 100) * years;
            const total = principal + interest;

            setText(
                "simpleResult",
                `Total: ${formatMoney(total, state.currency)} · Interest: ${formatMoney(interest, state.currency)}`
            );

        } catch (error) {
            setText("simpleResult", error.message);
        }
    }


    function calculateInflation() {
        try {
            const amount = readPositive("inflationAmount", "amount");
            const rate = safeNumber($("#inflationRateInput")?.value);
            const years = readPositive("inflationYears", "number of years");

            if (rate === null || rate <= -100) {
                throw new Error("Inflation rate must be greater than -100%.");
            }

            const futureCost = amount *
                Math.pow(1 + rate / 100, years);

            const purchasingPower = amount /
                Math.pow(1 + rate / 100, years);

            setText(
                "inflationResult",
                `Equivalent future cost: ${formatMoney(futureCost, state.currency)} · Present purchasing power: ${formatMoney(purchasingPower, state.currency)}`
            );

        } catch (error) {
            setText("inflationResult", error.message);
        }
    }


    function calculateFuture() {
        try {
            const present = readPositive("futurePresentValue", "amount");
            const rate = safeNumber($("#futureRate")?.value);
            const years = readPositive("futureYears", "number of years");

            if (rate === null || rate <= -100) {
                throw new Error("Growth rate must be greater than -100%.");
            }

            const future = present *
                Math.pow(1 + rate / 100, years);

            setText(
                "futureResult",
                formatMoney(future, state.currency)
            );

        } catch (error) {
            setText("futureResult", error.message);
        }
    }


    function installCalculatorControls() {
        $("#calculateCompound")?.addEventListener(
            "click",
            calculateCompound
        );

        $("#calculateSimple")?.addEventListener(
            "click",
            calculateSimple
        );

        $("#calculateInflation")?.addEventListener(
            "click",
            calculateInflation
        );

        $("#calculateFuture")?.addEventListener(
            "click",
            calculateFuture
        );

        $("#calculateCurrency")?.addEventListener(
            "click",
            convertQuickCalculator
        );

        $all("[data-calculator]").forEach(function (button) {
            button.addEventListener("click", function () {
                openPage("calculators");

                const type = button.dataset.calculator;

                const mapping = {
                    compound: "compoundPrincipal",
                    simple: "simplePrincipal",
                    inflation: "inflationAmount",
                    future: "futurePresentValue"
                };

                const target = document.getElementById(mapping[type]);

                if (target) {
                    target.focus();
                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });
                }
            });
        });
    }


    /* =====================================================
       HISTORICAL ARCHIVE
    ===================================================== */

    async function renderHistory() {
        const category = $("#historyCategory")?.value || "currencies";

        const body = $("#historicalTableBody");

        if (!body) return;

        body.innerHTML =
            '<tr><td colspan="5">Loading archive data...</td></tr>';

        try {
            let rows = [];

            if (category === "gold") {
                const history = await DATA.fetchGoldHistory(365);

                rows = history.map(item => ({
                    date: item.date,
                    category: "Gold",
                    value: item.value,
                    unit: "PLN / gram",
                    source: "NBP"
                }));
            }

            if (category === "bitcoin") {
                const history = await DATA.fetchBitcoinHistory("usd", 365);

                rows = history.map(item => ({
                    date: formatDate(item.date),
                    category: "Bitcoin",
                    value: item.value,
                    unit: "USD",
                    source: "CoinGecko"
                }));
            }

            if (category === "currencies") {
                const history = await fetchNBPCurrencyHistory("USD", 365);

                rows = history.map(item => ({
                    date: item.date,
                    category: "USD/PLN",
                    value: item.value,
                    unit: "PLN",
                    source: "NBP"
                }));
            }

            if (category === "inflation" || category === "gdp" || category === "unemployment") {
                const indicator = category === "gdp"
                    ? "gdp"
                    : category;

                const history = await DATA.fetchWorldBankIndicator(
                    state.country,
                    indicator,
                    2000
                );

                rows = history.map(item => ({
                    date: item.year,
                    category: indicator,
                    value: item.value,
                    unit: "%",
                    source: "World Bank"
                }));
            }

            const search =
                ($("#historySearch")?.value || "").toLowerCase();

            const start = $("#historyStartDate")?.value;
            const end = $("#historyEndDate")?.value;

            rows = rows.filter(function (item) {
                const searchable =
                    `${item.category} ${item.unit} ${item.source}`.toLowerCase();

                if (search && !searchable.includes(search)) {
                    return false;
                }

                if (
                    start &&
                    String(item.date) < start
                ) {
                    return false;
                }

                if (
                    end &&
                    String(item.date) > end
                ) {
                    return false;
                }

                return true;
            });

            body.replaceChildren();

            rows.forEach(function (item) {
                const row = document.createElement("tr");

                [
                    item.date,
                    item.category,
                    item.value,
                    item.unit,
                    item.source
                ].forEach(function (value) {
                    const cell = document.createElement("td");
                    cell.textContent = String(value);
                    row.appendChild(cell);
                });

                body.appendChild(row);
            });

            createChart("historicalChart", {
                labels: rows.map(item => item.date),
                values: rows.map(item => item.value),
                color: "#d9a85d"
            });

            if (!rows.length) {
                body.innerHTML =
                    '<tr><td colspan="5">No records match the selected filters.</td></tr>';
            }

        } catch (error) {
            console.error(error);

            body.innerHTML =
                '<tr><td colspan="5">Historical data unavailable.</td></tr>';
        }
    }


    /* =====================================================
       COUNTRY GLOBE EVENTS
    ===================================================== */

    async function handleCountrySelected(event) {
        const country = event.detail;

        if (!country) return;

        setText("countryName", country.name);
        setText("countryCode", country.code || "Code unavailable");

        $("#countryDetails")?.removeAttribute("hidden");

        const placeholder = $(".country-placeholder");

        if (placeholder) {
            placeholder.hidden = true;
        }

        setText("countryCurrency", country.currency || "Unavailable");

        setText("countryGDP", "Loading...");
        setText("countryInflation", "Loading...");
        setText("countryUnemployment", "Loading...");
        setText("countryGDPPerCapita", "Loading...");

        if (!country.code) {
            setText("countryGDP", "Unavailable");
            setText("countryInflation", "Unavailable");
            setText("countryUnemployment", "Unavailable");
            setText("countryGDPPerCapita", "Unavailable");
            setText("countryDataSource", "World Bank unavailable");
            setText("countryObservationDate", "Unavailable");
            return;
        }

        try {
            const profile = await DATA.getCountryProfile(country.code);

            const economy = profile.economy;

            setText(
                "countryGDP",
                economy.gdp ? formatPercent(economy.gdp.value) : "Unavailable"
            );

            setText(
                "countryInflation",
                economy.inflation
                    ? formatPercent(economy.inflation.value)
                    : "Unavailable"
            );

            setText(
                "countryUnemployment",
                economy.unemployment
                    ? formatPercent(economy.unemployment.value)
                    : "Unavailable"
            );

            setText(
                "countryGDPPerCapita",
                economy.gdpPerCapita
                    ? formatMoney(economy.gdpPerCapita.value, "USD")
                    : "Unavailable"
            );

            setText("countryDataSource", "World Bank");

            const dates = Object.values(economy)
                .filter(Boolean)
                .map(item => item.year);

            setText(
                "countryObservationDate",
                dates.length ? Math.max(...dates) : "Unavailable"
            );

        } catch (error) {
            console.error(error);

            setText("countryDataSource", "World Bank unavailable");

            [
                "countryGDP",
                "countryInflation",
                "countryUnemployment",
                "countryGDPPerCapita",
                "countryObservationDate"
            ].forEach(id => setText(id, "Unavailable"));
        }
    }


    /* =====================================================
       GLOBAL SEARCH
    ===================================================== */

    const SEARCH_ITEMS = [
        { name: "Dashboard", page: "dashboard", keywords: "home overview" },
        { name: "Currencies", page: "currencies", keywords: "exchange rates money forex" },
        { name: "Gold", page: "gold", keywords: "precious metals" },
        { name: "Bitcoin", page: "bitcoin", keywords: "crypto BTC markets" },
        { name: "Inflation", page: "inflation", keywords: "prices CPI purchasing power" },
        { name: "Economy", page: "economy", keywords: "GDP unemployment indicators" },
        { name: "Global Globe", page: "globe", keywords: "earth world countries map" },
        { name: "Calculators", page: "calculators", keywords: "interest future value converter" },
        { name: "Historical Archive", page: "history", keywords: "history records past data" },
        { name: "Reports", page: "reports", keywords: "export csv" },
        { name: "Settings", page: "settings", keywords: "preferences configuration" }
    ];


    function installSearch() {
        const input = $("#globalSearch");
        const results = $("#searchResults");

        if (!input || !results) return;

        input.addEventListener("input", function () {
            const query = input.value.trim().toLowerCase();

            results.replaceChildren();

            if (!query) {
                results.hidden = true;
                return;
            }

            const matches = SEARCH_ITEMS.filter(function (item) {
                return (
                    item.name.toLowerCase().includes(query) ||
                    item.keywords.includes(query)
                );
            });

            matches.forEach(function (item) {
                const button = document.createElement("button");

                button.className = "search-result-item";
                button.type = "button";
                button.textContent = item.name;

                button.addEventListener("click", function () {
                    openPage(item.page);
                    results.hidden = true;
                    input.value = "";
                });

                results.appendChild(button);
            });

            if (!matches.length) {
                const empty = document.createElement("div");

                empty.className = "empty-state";
                empty.textContent = "No matching sections.";

                results.appendChild(empty);
            }

            results.hidden = false;
        });

        document.addEventListener("click", function (event) {
            if (
                !input.contains(event.target) &&
                !results.contains(event.target)
            ) {
                results.hidden = true;
            }
        });

        input.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                results.hidden = true;
                input.blur();
            }
        });
    }


    /* =====================================================
       DATA EXPORT
    ===================================================== */

    function downloadCSV(filename, rows) {
        if (!rows || !rows.length) {
            showNotification("There is no data to export.", "error");
            return;
        }

        const csv = rows.map(function (row) {
            return row.map(function (value) {
                const text = String(value ?? "")
                    .replace(/"/g, '""');

                return `"${text}"`;
            }).join(",");
        }).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }


    async function exportData(type) {
        try {
            if (type === "currencies") {
                const rates = await DATA.getExchangeRates();

                downloadCSV("monetary-archive-currencies.csv", [
                    ["Currency", "Rate in PLN", "Previous rate", "Change", "Source"],
                    ...rates.rows.map(item => [
                        item.code,
                        item.rate,
                        item.previousRate,
                        item.change,
                        item.source
                    ])
                ]);

                return;
            }

            if (type === "economy") {
                const economy = await DATA.fetchCountryEconomy(state.country);

                const rows = [
                    ["Indicator", "Year", "Value", "Source"]
                ];

                Object.entries(economy).forEach(function ([name, values]) {
                    values.forEach(function (item) {
                        rows.push([
                            name,
                            item.year,
                            item.value,
                            item.source
                        ]);
                    });
                });

                downloadCSV("monetary-archive-economy.csv", rows);

                return;
            }

            if (type === "markets") {
                const bitcoin = await DATA.fetchBitcoinCurrent(
                    state.currency.toLowerCase()
                );

                downloadCSV("monetary-archive-markets.csv", [
                    ["Asset", "Price", "Currency", "Market cap", "24h volume", "24h change", "Source"],
                    [
                        "Bitcoin",
                        bitcoin.price,
                        bitcoin.currency,
                        bitcoin.marketCap,
                        bitcoin.volume24h,
                        bitcoin.change24h,
                        bitcoin.source
                    ]
                ]);
            }

        } catch (error) {
            showNotification(
                `Export failed: ${error.message}`,
                "error"
            );
        }
    }


    function installExports() {
        $all("[data-export]").forEach(function (button) {
            button.addEventListener("click", function () {
                exportData(button.dataset.export);
            });
        });
    }


    /* =====================================================
       ACTION BUTTONS
    ===================================================== */

    function installActionButtons() {
        $all("[data-action]").forEach(function (button) {
            button.addEventListener("click", function () {
                const action = button.dataset.action;

                const actions = {
                    "open-archive": "history",
                    "open-currencies": "currencies",
                    "open-economy": "economy",
                    "open-bitcoin": "bitcoin",
                    "open-history": "history"
                };

                if (action === "refresh-currencies") {
                    renderCurrenciesTable();
                    return;
                }

                if (actions[action]) {
                    openPage(actions[action]);
                }
            });
        });
    }


    /* =====================================================
       SETTINGS
    ===================================================== */

    function readSettings() {
        try {
            const saved = localStorage.getItem("monetaryArchiveSettings");

            if (saved) {
                state.settings = {
                    ...state.settings,
                    ...JSON.parse(saved)
                };
            }

        } catch (error) {
            console.warn("Settings could not be loaded.", error);
        }

        state.currency = state.settings.currency || "USD";

        document.body.classList.toggle(
            "reduce-motion",
            !state.settings.animations
        );
    }


    function saveSettings() {
        try {
            localStorage.setItem(
                "monetaryArchiveSettings",
                JSON.stringify(state.settings)
            );

        } catch (error) {
            console.warn("Settings could not be saved.", error);
        }
    }


    function renderSettings() {
        const currency = $("#defaultCurrency");
        const autoRefresh = $("#autoRefreshSetting");
        const interval = $("#refreshInterval");
        const animations = $("#animationsSetting");

        if (currency) currency.value = state.currency;

        if (autoRefresh) {
            autoRefresh.checked = state.settings.autoRefresh;
        }

        if (interval) {
            interval.value = String(state.settings.refreshInterval);
        }

        if (animations) {
            animations.checked = state.settings.animations;
        }
    }


    function applyCurrency(currency) {
        const code = String(currency || "USD").toUpperCase();

        state.currency = code;
        state.settings.currency = code;

        saveSettings();

        renderDashboard(state.dashboard || {});

        if (state.activePage === "bitcoin") {
            loadBitcoinPage();
        }

        if (state.activePage === "gold") {
            loadGoldPage();
        }

        renderDashboardChart();
    }


    function installSettings() {
        $("#defaultCurrency")?.addEventListener("change", function () {
            applyCurrency(this.value);

            showNotification(
                `Display currency changed to ${this.value}.`,
                "success"
            );
        });

        $("#autoRefreshSetting")?.addEventListener("change", function () {
            state.settings.autoRefresh = this.checked;

            saveSettings();
            setupAutoRefresh();
        });

        $("#refreshInterval")?.addEventListener("change", function () {
            state.settings.refreshInterval = Number(this.value);

            saveSettings();
            setupAutoRefresh();
        });

        $("#animationsSetting")?.addEventListener("change", function () {
            state.settings.animations = this.checked;

            document.body.classList.toggle(
                "reduce-motion",
                !this.checked
            );

            saveSettings();
        });

        $("#clearCache")?.addEventListener("click", function () {
            DATA.clearCache();

            showNotification(
                "Cached financial data has been cleared.",
                "success"
            );

            loadDashboard();
        });

        $("#resetSettings")?.addEventListener("click", function () {
            state.settings = {
                autoRefresh: true,
                refreshInterval: 300000,
                animations: true,
                currency: "USD"
            };

            state.currency = "USD";

            saveSettings();
            renderSettings();
            setupAutoRefresh();

            showNotification("Settings restored.", "success");
        });
    }


    /* =====================================================
       COUNTRY SELECTION
    ===================================================== */

    function installCountrySelector() {
        $("#selectedCountry")?.addEventListener("change", function () {
            state.country = this.value;

            setText(
                "inflationCountryLabel",
                COUNTRY_NAMES[state.country] || state.country
            );

            setText(
                "gdpCountryLabel",
                COUNTRY_NAMES[state.country] || state.country
            );

            loadDashboard();

            if (state.activePage === "economy") {
                const selector = $("#economyCountry");

                if (selector) selector.value = state.country;

                loadEconomyPage();
            }
        });
    }


    /* =====================================================
       CONVERTER EVENTS
    ===================================================== */

    function installConverter() {
        $("#convertCurrency")?.addEventListener(
            "click",
            convertFromForm
        );

        $("#swapCurrencies")?.addEventListener(
            "click",
            swapCurrencies
        );

        $("#converterFromAmount")?.addEventListener(
            "input",
            function () {
                if (this.value && Number(this.value) >= 0) {
                    convertFromForm();
                }
            }
        );

        $("#converterFrom")?.addEventListener(
            "change",
            convertFromForm
        );

        $("#converterTo")?.addEventListener(
            "change",
            convertFromForm
        );

        $("#currencySearch")?.addEventListener(
            "input",
            renderCurrenciesTable
        );

        $("#currencyDisplay")?.addEventListener(
            "change",
            renderCurrenciesTable
        );

        $("#currencySort")?.addEventListener(
            "change",
            renderCurrenciesTable
        );

        $("#searchHistory")?.addEventListener(
            "click",
            renderHistory
        );

        $("#historyCategory")?.addEventListener(
            "change",
            renderHistory
        );
    }


    /* =====================================================
       AUTOMATIC REFRESH
    ===================================================== */

    let refreshTimer = null;

    function setupAutoRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }

        if (!state.settings.autoRefresh) return;

        const interval = Math.max(
            60000,
            Number(state.settings.refreshInterval) || 300000
        );

        refreshTimer = setInterval(function () {
            loadDashboard();
        }, interval);
    }


    /* =====================================================
       INITIALIZATION
    ===================================================== */

    async function initialize() {
        if (!DATA) {
            console.error("ArchiveData module is missing.");

            setApplicationStatus("Data module not found.");

            setConnectionStatus(false, "Module error");

            showNotification(
                "data.js could not be loaded. Check your script files.",
                "error"
            );

            return;
        }

        readSettings();

        updateClock();

        setInterval(updateClock, 1000);

        installNavigation();
        installSearch();
        installChartControls();
        installCalculatorControls();
        installExports();
        installActionButtons();
        installSettings();
        installCountrySelector();
        installConverter();

        installCountrySelector();

        window.addEventListener(
            "archive:country-selected",
            handleCountrySelected
        );

        $("#selectedCountry").value = state.country;

        $("#trendCurrency").value = state.currency;

        $("#currencyDisplay").value = state.currency;

        renderSettings();

        setupAutoRefresh();

        await loadDashboard();

        await convertFromForm().catch(() => {});

        console.info("The Monetary Archive initialized.");
    }


    document.addEventListener("DOMContentLoaded", initialize);

})();
