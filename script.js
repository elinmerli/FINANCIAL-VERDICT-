/* ============================================================
   THE MONETARY ARCHIVE
   MAIN APPLICATION ENGINE
   Version: 1.0.0

   Responsibilities:
   - Dashboard initialization
   - Currency selection and conversion
   - Bitcoin market data
   - Gold price display
   - Economic indicators
   - Charts
   - Tables and filters
   - Navigation
   - Financial calculators
   - CSV export
   - Automatic refresh
   - Error handling
   ============================================================ */

(() => {
    "use strict";


    /* ========================================================
       01. CONFIGURATION
    ======================================================== */

    const CONFIG = {

        defaultCurrency: "USD",

        refreshInterval: 5 * 60 * 1000,

        bitcoinRefreshInterval: 60 * 1000,

        bitcoinHistoryDays: 30,

        bitcoinApi:
            "https://api.coingecko.com/api/v3",

        chartColors: {
            gold: "#c5a46d",
            green: "#79a88b",
            red: "#bd7777",
            blue: "#7895b8",
            muted: "#8c8a83",
            grid: "rgba(197, 164, 109, 0.12)"
        },

        currencies: [
            "USD",
            "EUR",
            "GBP",
            "CHF",
            "JPY",
            "CAD",
            "AUD",
            "PLN",
            "CZK",
            "SEK",
            "NOK",
            "DKK",
            "HUF"
        ],

        currencyNames: {
            USD: "US Dollar",
            EUR: "Euro",
            GBP: "British Pound",
            CHF: "Swiss Franc",
            JPY: "Japanese Yen",
            CAD: "Canadian Dollar",
            AUD: "Australian Dollar",
            PLN: "Polish Zloty",
            CZK: "Czech Koruna",
            SEK: "Swedish Krona",
            NOK: "Norwegian Krone",
            DKK: "Danish Krone",
            HUF: "Hungarian Forint"
        },

        countryNames: {
            PL: "Poland",
            US: "United States",
            EU: "European Union"
        },

        chartDefaults: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 500
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "#11151c",
                    titleColor: "#d8c29a",
                    bodyColor: "#f0eee8",
                    borderColor: "rgba(197, 164, 109, 0.35)",
                    borderWidth: 1,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: "#8c8a83"
                    }
                },
                y: {
                    grid: {
                        color: "rgba(197, 164, 109, 0.10)"
                    },
                    ticks: {
                        color: "#8c8a83"
                    }
                }
            }
        }
    };


    /* ========================================================
       02. APPLICATION STATE
    ======================================================== */

    const state = {

        dashboard: null,

        selectedCurrency: CONFIG.defaultCurrency,

        selectedCountry: "PL",

        selectedPeriod: 30,

        bitcoin: null,

        bitcoinHistory: null,

        charts: {},

        lastDashboardUpdate: null,

        lastBitcoinUpdate: null,

        isLoading: false,

        isRefreshing: false,

        errors: [],

        activeSection: "overview"
    };


    /* ========================================================
       03. DOM HELPERS
    ======================================================== */

    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }


    function $all(selector, parent = document) {
        return Array.from(
            parent.querySelectorAll(selector)
        );
    }


    function setText(selector, value) {
        const element = $(selector);

        if (element) {
            element.textContent = value;
        }
    }


    function setHTML(selector, value) {
        const element = $(selector);

        if (element) {
            element.innerHTML = value;
        }
    }


    function setValue(selector, value) {
        const element = $(selector);

        if (element) {
            element.value = value;
        }
    }


    function showElement(element) {
        if (element) {
            element.style.display = "";
        }
    }


    function hideElement(element) {
        if (element) {
            element.style.display = "none";
        }
    }


    function isNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
    }


    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }


    function safeNumber(value, fallback = null) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;
    }


    function escapeHTML(value) {
        return String(value ?? "").replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
    }


    function dispatchEvent(name, detail = {}) {
        window.dispatchEvent(
            new CustomEvent(name, {
                detail
            })
        );
    }


    /* ========================================================
       04. NOTIFICATIONS AND STATUS
    ======================================================== */

    function showNotification(message, type = "info") {
        let container = $("#archive-notifications");

        if (!container) {
            container = document.createElement("div");

            container.id = "archive-notifications";

            container.className = "archive-notifications";

            document.body.appendChild(container);
        }

        const notification = document.createElement("div");

        notification.className =
            `archive-notification archive-notification-${type}`;

        notification.textContent = message;

        container.appendChild(notification);

        requestAnimationFrame(() => {
            notification.classList.add("visible");
        });

        window.setTimeout(() => {
            notification.classList.remove("visible");

            window.setTimeout(() => {
                notification.remove();
            }, 300);

        }, 4500);
    }


    function setLoading(isLoading) {
        state.isLoading = isLoading;

        document.body.classList.toggle(
            "archive-loading",
            isLoading
        );

        $all("[data-loading]").forEach(element => {
            element.classList.toggle(
                "is-loading",
                isLoading
            );
        });
    }


    function updateConnectionStatus(status, message) {
        const element = $(
            "#connection-status, [data-connection-status]"
        );

        if (!element) {
            return;
        }

        element.dataset.status = status;

        element.textContent = message;
    }


    function updateLastUpdated(date) {
        if (!date) {
            return;
        }

        const formatted = formatDateTime(date);

        setText("#last-updated", formatted);

        setText("[data-last-updated]", formatted);
    }


    /* ========================================================
       05. DATE AND NUMBER FORMATTING
    ======================================================== */

    function formatDate(dateValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }


    function formatDateTime(dateValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }


    function formatNumber(value, digits = 2) {
        if (!isNumber(value)) {
            return "—";
        }

        return new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: digits
        }).format(value);
    }


    function formatPercent(value) {
        if (!isNumber(value)) {
            return "—";
        }

        const sign = value > 0 ? "+" : "";

        return `${sign}${formatNumber(value, 2)}%`;
    }


    function formatCurrency(value, currency = state.selectedCurrency) {
        if (!isNumber(value)) {
            return "—";
        }

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value);

        } catch {
            return `${formatNumber(value)} ${currency}`;
        }
    }


    function formatCompactCurrency(value) {
        if (!isNumber(value)) {
            return "—";
        }

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: state.selectedCurrency,
                notation: "compact",
                maximumFractionDigits: 2
            }).format(value);

        } catch {
            return formatCurrency(value);
        }
    }


    /* ========================================================
       06. CURRENCY CONVERSION
    ======================================================== */

    function getCurrencyRates() {
        return safeArray(
            state.dashboard?.currencies
        );
    }


    function getPLNRate(currency) {
        if (currency === "PLN") {
            return 1;
        }

        const rate = getCurrencyRates().find(item => {
            return item.code === currency;
        });

        return rate
            ? safeNumber(rate.value)
            : null;
    }


    /*
     * NBP values represent PLN for one unit of foreign currency.
     *
     * Example:
     * 1 USD = 4 PLN
     * 1 EUR = 4.3 PLN
     *
     * To convert USD to EUR:
     * USD amount * USD PLN rate / EUR PLN rate.
     */

    function convertCurrency(
        amount,
        fromCurrency,
        toCurrency
    ) {
        const value = safeNumber(amount);

        if (value === null) {
            return null;
        }

        if (fromCurrency === toCurrency) {
            return value;
        }

        const fromRate = getPLNRate(fromCurrency);

        const toRate = getPLNRate(toCurrency);

        if (
            fromRate === null ||
            toRate === null ||
            toRate === 0
        ) {
            return null;
        }

        const amountInPLN = value * fromRate;

        return amountInPLN / toRate;
    }


    function convertFromPLN(amount, currency) {
        return convertCurrency(
            amount,
            "PLN",
            currency
        );
    }


    function convertToPLN(amount, currency) {
        return convertCurrency(
            amount,
            currency,
            "PLN"
        );
    }


    function getCurrencySymbol(currency) {
        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency
            })
                .formatToParts(0)
                .find(part => part.type === "currency")
                ?.value || currency;

        } catch {
            return currency;
        }
    }


    /* ========================================================
       07. CURRENCY SELECTOR
    ======================================================== */

    function initializeCurrencySelector() {
        const selectors = $all(
            "#currency-select, " +
            "#display-currency, " +
            "[data-currency-selector]"
        );

        selectors.forEach(selector => {
            if (selector.dataset.initialized === "true") {
                return;
            }

            selector.dataset.initialized = "true";

            if (!selector.options.length) {
                selector.innerHTML = CONFIG.currencies
                    .map(currency => {
                        const name =
                            CONFIG.currencyNames[currency] ||
                            currency;

                        return `
                            <option value="${currency}">
                                ${currency} — ${name}
                            </option>
                        `;
                    })
                    .join("");
            }

            selector.value = state.selectedCurrency;

            selector.addEventListener("change", () => {
                changeCurrency(selector.value);
            });
        });
    }


    function changeCurrency(currency) {
        const code = String(currency || "").toUpperCase();

        if (!CONFIG.currencies.includes(code)) {
            showNotification(
                "This display currency is not supported.",
                "warning"
            );

            return;
        }

        state.selectedCurrency = code;

        $all(
            "#currency-select, " +
            "#display-currency, " +
            "[data-currency-selector]"
        ).forEach(selector => {
            selector.value = code;
        });

        localStorage.setItem(
            "archive-display-currency",
            code
        );

        renderDashboard();

        renderBitcoin();

        renderCurrencyTable();

        renderGold();

        updateCalculatorCurrency();

        dispatchEvent("archive:currency-changed", {
            currency: code
        });
    }


    function restoreCurrencyPreference() {
        try {
            const saved = localStorage.getItem(
                "archive-display-currency"
            );

            if (
                saved &&
                CONFIG.currencies.includes(saved)
            ) {
                state.selectedCurrency = saved;
            }

        } catch (error) {
            console.warn(
                "[Archive] Currency preference unavailable:",
                error
            );
        }
    }


    /* ========================================================
       08. LOAD MAIN DATA
    ======================================================== */

    async function loadMainData(force = false) {
        if (!window.ArchiveData) {
            throw new Error(
                "ArchiveData is not available. Check data.js."
            );
        }

        if (typeof window.ArchiveData.loadDashboard !== "function") {
            throw new Error(
                "ArchiveData.loadDashboard() is missing."
            );
        }

        const dashboard = await window.ArchiveData.loadDashboard({
            force
        });

        if (!dashboard) {
            throw new Error(
                "The data provider returned an empty dashboard."
            );
        }

        state.dashboard = dashboard;

        state.lastDashboardUpdate =
            dashboard.lastCheckedAt ||
            dashboard.generatedAt ||
            new Date().toISOString();

        updateLastUpdated(state.lastDashboardUpdate);

        return dashboard;
    }


    /* ========================================================
       09. BITCOIN DATA
    ======================================================== */

    async function requestBitcoinData(endpoint) {
        const response = await fetch(
            `${CONFIG.bitcoinApi}${endpoint}`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Bitcoin data request failed: HTTP ${response.status}`
            );
        }

        return response.json();
    }


    async function loadBitcoin() {
        const currencies = [
            "usd",
            "eur",
            "gbp",
            "pln",
            "chf",
            "jpy",
            "cad",
            "aud"
        ];

        const currencyList = currencies.join(",");

        const data = await requestBitcoinData(
            `/simple/price?ids=bitcoin&vs_currencies=${currencyList}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
        );

        const bitcoin = data?.bitcoin;

        if (!bitcoin) {
            throw new Error(
                "Bitcoin price data is unavailable."
            );
        }

        state.bitcoin = bitcoin;

        state.lastBitcoinUpdate = new Date().toISOString();

        renderBitcoin();

        return bitcoin;
    }


    function getBitcoinPrice(currency) {
        if (!state.bitcoin) {
            return null;
        }

        const key = currency.toLowerCase();

        const directPrice = safeNumber(
            state.bitcoin[key]
        );

        if (directPrice !== null) {
            return directPrice;
        }

        const usdPrice = safeNumber(
            state.bitcoin.usd
        );

        if (usdPrice === null) {
            return null;
        }

        return convertCurrency(
            usdPrice,
            "USD",
            currency
        );
    }


    function getBitcoinChange() {
        if (!state.bitcoin) {
            return null;
        }

        const key =
            `${state.selectedCurrency.toLowerCase()}_24h_change`;

        return safeNumber(
            state.bitcoin[key]
        );
    }


    function renderBitcoin() {
        if (!state.bitcoin) {
            return;
        }

        const currency = state.selectedCurrency;

        const price = getBitcoinPrice(currency);

        const change = getBitcoinChange();

        const marketCap = safeNumber(
            state.bitcoin[
                `${currency.toLowerCase()}_market_cap`
            ]
        );

        const volume = safeNumber(
            state.bitcoin[
                `${currency.toLowerCase()}_24h_vol`
            ]
        );

        setText(
            "#bitcoin-price",
            formatCurrency(price, currency)
        );

        setText(
            "#btc-price",
            formatCurrency(price, currency)
        );

        setText(
            "#bitcoin-change",
            formatPercent(change)
        );

        setText(
            "#bitcoin-market-cap",
            formatCompactCurrency(marketCap)
        );

        setText(
            "#bitcoin-volume",
            formatCompactCurrency(volume)
        );

        setText(
            "#bitcoin-updated",
            formatDateTime(state.lastBitcoinUpdate)
        );

        const changeElements = $all(
            "#bitcoin-change, " +
            "[data-bitcoin-change]"
        );

        changeElements.forEach(element => {
            element.classList.remove(
                "positive",
                "negative",
                "neutral"
            );

            element.classList.add(
                change > 0
                    ? "positive"
                    : change < 0
                        ? "negative"
                        : "neutral"
            );
        });
    }


    /* ========================================================
       10. BITCOIN HISTORY
    ======================================================== */

    async function loadBitcoinHistory(days = 30) {
        const currency =
            state.selectedCurrency.toLowerCase();

        const data = await requestBitcoinData(
            `/coins/bitcoin/market_chart?vs_currency=${currency}&days=${days}&interval=daily`
        );

        if (!Array.isArray(data.prices)) {
            throw new Error(
                "Bitcoin historical prices are unavailable."
            );
        }

        state.bitcoinHistory = data.prices.map(item => ({
            timestamp: item[0],
            date: new Date(item[0]),
            price: item[1]
        }));

        renderBitcoinChart();

        return state.bitcoinHistory;
    }


    function renderBitcoinChart() {
        const canvas = $(
            "#bitcoin-chart, " +
            "#btc-chart, " +
            "[data-chart='bitcoin']"
        );

        if (!canvas || !window.Chart) {
            return;
        }

        const history = safeArray(
            state.bitcoinHistory
        );

        if (!history.length) {
            return;
        }

        const labels = history.map(item => {
            return new Intl.DateTimeFormat("en-US", {
                day: "2-digit",
                month: "short"
            }).format(item.date);
        });

        const values = history.map(item => item.price);

        createChart(
            "bitcoin",
            canvas,
            {
                type: "line",

                data: {
                    labels,

                    datasets: [{
                        label: `Bitcoin (${state.selectedCurrency})`,

                        data: values,

                        borderColor: CONFIG.chartColors.gold,

                        backgroundColor:
                            "rgba(197, 164, 109, 0.10)",

                        borderWidth: 2,

                        fill: true,

                        tension: 0.35,

                        pointRadius: 0,

                        pointHoverRadius: 4
                    }]
                },

                options: {
                    ...CONFIG.chartDefaults,

                    interaction: {
                        intersect: false,
                        mode: "index"
                    },

                    scales: {
                        ...CONFIG.chartDefaults.scales,

                        y: {
                            ...CONFIG.chartDefaults.scales.y,

                            ticks: {
                                color: "#8c8a83",

                                callback(value) {
                                    return formatCurrency(
                                        value,
                                        state.selectedCurrency
                                    );
                                }
                            }
                        }
                    }
                }
            }
        );
    }


    /* ========================================================
       11. GOLD DATA
    ======================================================== */

    function getGoldPrice() {
        const gold = state.dashboard?.gold;

        if (!gold) {
            return null;
        }

        const pricePLN = safeNumber(gold.value);

        if (pricePLN === null) {
            return null;
        }

        return convertFromPLN(
            pricePLN,
            state.selectedCurrency
        );
    }


    function renderGold() {
        const gold = state.dashboard?.gold;

        if (!gold) {
            setText("#gold-price", "Unavailable");
            return;
        }

        const pricePerGram = getGoldPrice();

        const pricePerOunce = pricePerGram === null
            ? null
            : pricePerGram * 31.1034768;

        setText(
            "#gold-price",
            formatCurrency(
                pricePerGram,
                state.selectedCurrency
            )
        );

        setText(
            "#gold-gram-price",
            formatCurrency(
                pricePerGram,
                state.selectedCurrency
            )
        );

        setText(
            "#gold-ounce-price",
            formatCurrency(
                pricePerOunce,
                state.selectedCurrency
            )
        );

        setText(
            "#gold-date",
            formatDate(gold.date)
        );

        setText(
            "[data-gold-price]",
            formatCurrency(
                pricePerGram,
                state.selectedCurrency
            )
        );
    }


    /* ========================================================
       12. CURRENCY TABLE
    ======================================================== */

    function renderCurrencyTable() {
        const tableBody = $(
            "#currency-table-body, " +
            "#currencies-table-body, " +
            "[data-currency-table-body]"
        );

        if (!tableBody) {
            return;
        }

        const rates = getCurrencyRates();

        if (!rates.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5">
                        Currency data is currently unavailable.
                    </td>
                </tr>
            `;

            return;
        }

        const selectedRate = getPLNRate(
            state.selectedCurrency
        );

        const rows = rates.map(rate => {
            const code = rate.code;

            const valuePLN = safeNumber(rate.value);

            const converted = valuePLN !== null &&
                selectedRate !== null
                    ? valuePLN / selectedRate
                    : null;

            return `
                <tr>
                    <td>
                        <strong>${escapeHTML(code)}</strong>
                    </td>

                    <td>
                        ${escapeHTML(
                            CONFIG.currencyNames[code] || code
                        )}
                    </td>

                    <td>
                        ${formatNumber(valuePLN, 4)} PLN
                    </td>

                    <td>
                        ${converted === null
                            ? "—"
                            : formatNumber(converted, 4) +
                              " " +
                              escapeHTML(state.selectedCurrency)}
                    </td>

                    <td>
                        ${escapeHTML(rate.date || "—")}
                    </td>
                </tr>
            `;
        });

        tableBody.innerHTML = rows.join("");
    }


    /* ========================================================
       13. ECONOMIC INDICATORS
    ======================================================== */

    function getLatestObservation(
        country,
        category,
        indicator
    ) {
        const observations = safeArray(
            state.dashboard?.observations
        );

        return observations
            .filter(item => {
                const countryMatches =
                    item.country === country;

                const categoryMatches =
                    !category ||
                    item.category === category;

                const indicatorMatches =
                    !indicator ||
                    item.indicator === indicator;

                return (
                    countryMatches &&
                    categoryMatches &&
                    indicatorMatches
                );
            })
            .sort((a, b) => {
                return String(b.date).localeCompare(
                    String(a.date)
                );
            })[0] || null;
    }


    function renderEconomicIndicators() {
        const inflation = getLatestObservation(
            "PL",
            "inflation"
        );

        const gdp = getLatestObservation(
            "PL",
            "economy"
        );

        const europeanInflation = getLatestObservation(
            "EU",
            "inflation"
        );

        setText(
            "#inflation-value",
            inflation
                ? formatPercent(inflation.value)
                : "—"
        );

        setText(
            "#gdp-value",
            gdp
                ? formatPercent(gdp.value)
                : "—"
        );

        setText(
            "#eu-inflation-value",
            europeanInflation
                ? formatPercent(europeanInflation.value)
                : "—"
        );

        setText(
            "#inflation-date",
            formatDate(inflation?.date)
        );

        setText(
            "#gdp-date",
            formatDate(gdp?.date)
        );
    }


    function renderObservationTable() {
        const body = $(
            "#economic-table-body, " +
            "[data-economic-table-body]"
        );

        if (!body) {
            return;
        }

        const observations = safeArray(
            state.dashboard?.observations
        );

        if (!observations.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="6">
                        No economic observations available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = observations.map(item => `
            <tr>
                <td>${escapeHTML(item.countryName || item.country)}</td>

                <td>${escapeHTML(item.name || item.indicator)}</td>

                <td>${escapeHTML(item.category || "—")}</td>

                <td>${formatNumber(item.value, 3)}</td>

                <td>${escapeHTML(item.unit || "—")}</td>

                <td>${escapeHTML(item.date || "—")}</td>
            </tr>
        `).join("");
    }


    /* ========================================================
       14. DASHBOARD RENDERER
    ======================================================== */

    function renderDashboard() {
        if (!state.dashboard) {
            return;
        }

        renderCurrencyTable();

        renderGold();

        renderEconomicIndicators();

        renderObservationTable();

        renderBitcoin();

        renderSourceStatus();

        updateLastUpdated(
            state.lastDashboardUpdate
        );

        dispatchEvent("archive:dashboard-rendered", {
            dashboard: state.dashboard,
            currency: state.selectedCurrency
        });
    }


    /* ========================================================
       15. DATA SOURCE STATUS
    ======================================================== */

    function renderSourceStatus() {
        const container = $(
            "#source-status-list, " +
            "[data-source-status-list]"
        );

        if (!container) {
            return;
        }

        const sources = safeArray(
            state.dashboard?.sources
        );

        if (!sources.length) {
            container.textContent =
                "Source status is unavailable.";

            return;
        }

        container.innerHTML = sources.map(source => {
            const status = source.status || "unknown";

            const statusLabel =
                status === "online"
                    ? "Online"
                    : status === "error"
                        ? "Unavailable"
                        : "Unknown";

            return `
                <div class="source-status-item">
                    <span class="source-name">
                        ${escapeHTML(source.name)}
                    </span>

                    <span class="source-indicator ${escapeHTML(status)}">
                        ${statusLabel}
                    </span>

                    <span class="source-time">
                        ${formatDateTime(source.checkedAt)}
                    </span>

                    ${source.error
                        ? `<small>${escapeHTML(source.error)}</small>`
                        : ""}
                </div>
            `;
        }).join("");
    }


    /* ========================================================
       16. CHART MANAGEMENT
    ======================================================== */

    function createChart(name, canvas, config) {
        if (!window.Chart || !canvas) {
            return null;
        }

        if (state.charts[name]) {
            state.charts[name].destroy();

            state.charts[name] = null;
        }

        state.charts[name] = new Chart(
            canvas,
            config
        );

        return state.charts[name];
    }


    async function loadCurrencyChart(currency = "USD") {
        if (!window.ArchiveData) {
            return;
        }

        const canvas = $(
            "#currency-chart, " +
            "[data-chart='currency']"
        );

        if (!canvas) {
            return;
        }

        try {
            const history = await window.ArchiveData
                .loadCurrencyHistory(currency, 30);

            const observations = safeArray(
                history?.observations
            );

            if (!observations.length) {
                return;
            }

            const labels = observations.map(item => {
                return formatDate(item.effectiveDate);
            });

            const values = observations.map(item => {
                return safeNumber(item.mid);
            });

            createChart(
                "currency",
                canvas,
                {
                    type: "line",

                    data: {
                        labels,

                        datasets: [{
                            label: `${currency} / PLN`,

                            data: values,

                            borderColor: CONFIG.chartColors.blue,

                            backgroundColor:
                                "rgba(120, 149, 184, 0.10)",

                            borderWidth: 2,

                            fill: true,

                            tension: 0.3,

                            pointRadius: 1
                        }]
                    },

                    options: CONFIG.chartDefaults
                }
            );

        } catch (error) {
            console.error(
                "[Archive] Currency chart failed:",
                error
            );
        }
    }


    async function loadGoldChart() {
        if (!window.ArchiveData) {
            return;
        }

        const canvas = $(
            "#gold-chart, " +
            "[data-chart='gold']"
        );

        if (!canvas) {
            return;
        }

        try {
            const history = await window.ArchiveData
                .loadGoldHistory(30);

            const observations = safeArray(history);

            if (!observations.length) {
                return;
            }

            const labels = observations.map(item => {
                return formatDate(item.data);
            });

            const values = observations.map(item => {
                const price = safeNumber(item.cena);

                return price === null
                    ? null
                    : convertFromPLN(
                        price,
                        state.selectedCurrency
                    );
            });

            createChart(
                "gold",
                canvas,
                {
                    type: "line",

                    data: {
                        labels,

                        datasets: [{
                            label: "Gold price per gram",

                            data: values,

                            borderColor: CONFIG.chartColors.gold,

                            backgroundColor:
                                "rgba(197, 164, 109, 0.10)",

                            borderWidth: 2,

                            fill: true,

                            tension: 0.3,

                            pointRadius: 1
                        }]
                    },

                    options: CONFIG.chartDefaults
                }
            );

        } catch (error) {
            console.error(
                "[Archive] Gold chart failed:",
                error
            );
        }
    }


    /* ========================================================
       17. CHART PERIOD SELECTORS
    ======================================================== */

    function initializeChartPeriods() {
        $all("[data-chart-period]").forEach(button => {
            if (button.dataset.initialized === "true") {
                return;
            }

            button.dataset.initialized = "true";

            button.addEventListener("click", async () => {
                const period = safeNumber(
                    button.dataset.chartPeriod,
                    30
                );

                state.selectedPeriod = period;

                $all("[data-chart-period]").forEach(item => {
                    item.classList.toggle(
                        "active",
                        item === button
                    );
                });

                try {
                    await loadBitcoinHistory(period);

                } catch (error) {
                    console.error(
                        "[Archive] Could not update chart period:",
                        error
                    );

                    showNotification(
                        "Historical Bitcoin data is temporarily unavailable.",
                        "warning"
                    );
                }
            });
        });
    }


    /* ========================================================
       18. NAVIGATION
    ======================================================== */

    function initializeNavigation() {
        const links = $all(
            ".nav-link, " +
            "[data-section-link]"
        );

        links.forEach(link => {
            if (link.dataset.initialized === "true") {
                return;
            }

            link.dataset.initialized = "true";

            link.addEventListener("click", event => {
                const href = link.getAttribute("href");

                const sectionId =
                    link.dataset.sectionLink ||
                    (href && href.startsWith("#")
                        ? href.slice(1)
                        : null);

                if (!sectionId) {
                    return;
                }

                const section = document.getElementById(
                    sectionId
                );

                if (!section) {
                    return;
                }

                event.preventDefault();

                navigateToSection(sectionId);
            });
        });
    }


    function navigateToSection(sectionId) {
        const section = document.getElementById(
            sectionId
        );

        if (!section) {
            return;
        }

        state.activeSection = sectionId;

        section.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

        $all(".nav-link, [data-section-link]").forEach(link => {
            const target =
                link.dataset.sectionLink ||
                link.getAttribute("href")?.replace("#", "");

            link.classList.toggle(
                "active",
                target === sectionId
            );
        });

        dispatchEvent("archive:section-changed", {
            section: sectionId
        });
    }


    /* ========================================================
       19. MOBILE NAVIGATION
    ======================================================== */

    function initializeMobileNavigation() {
        const toggle = $(
            "#mobile-menu-toggle, " +
            "[data-mobile-menu-toggle]"
        );

        const sidebar = $(
            "#sidebar, " +
            ".sidebar"
        );

        if (!toggle || !sidebar) {
            return;
        }

        toggle.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");

            toggle.classList.toggle("active");
        });

        $all(".nav-link", sidebar).forEach(link => {
            link.addEventListener("click", () => {
                sidebar.classList.remove("mobile-open");

                toggle.classList.remove("active");
            });
        });
    }


    /* ========================================================
       20. TABLE SEARCH AND FILTERS
    ======================================================== */

    function initializeTableSearch() {
        $all("[data-table-search]").forEach(input => {
            if (input.dataset.initialized === "true") {
                return;
            }

            input.dataset.initialized = "true";

            const targetSelector =
                input.dataset.tableSearch;

            const target = $(targetSelector);

            if (!target) {
                return;
            }

            input.addEventListener("input", () => {
                const query = input.value
                    .trim()
                    .toLowerCase();

                $all("tr", target).forEach(row => {
                    const matches = row.textContent
                        .toLowerCase()
                        .includes(query);

                    row.style.display = matches
                        ? ""
                        : "none";
                });
            });
        });
    }


    /* ========================================================
       21. FINANCIAL CALCULATORS
    ======================================================== */

    function calculateCompoundInterest({
        principal,
        annualRate,
        years,
        contributions = 0
    }) {
        const P = safeNumber(principal, 0);

        const rate = safeNumber(annualRate, 0) / 100;

        const duration = safeNumber(years, 0);

        const monthlyContribution =
            safeNumber(contributions, 0);

        if (
            P < 0 ||
            duration < 0 ||
            monthlyContribution < 0
        ) {
            return null;
        }

        const months = Math.round(duration * 12);

        const monthlyRate = rate / 12;

        let balance = P;

        for (let month = 0; month < months; month++) {
            balance *= 1 + monthlyRate;

            balance += monthlyContribution;
        }

        const totalContributions =
            P + monthlyContribution * months;

        return {
            finalValue: balance,

            totalContributions,

            interest: balance - totalContributions
        };
    }


    function calculateSimpleInterest({
        principal,
        annualRate,
        years
    }) {
        const P = safeNumber(principal, 0);

        const rate = safeNumber(annualRate, 0) / 100;

        const duration = safeNumber(years, 0);

        if (
            P < 0 ||
            duration < 0
        ) {
            return null;
        }

        const interest = P * rate * duration;

        return {
            finalValue: P + interest,

            principal: P,

            interest
        };
    }


    function calculateInflationValue({
        amount,
        inflationRate,
        years
    }) {
        const value = safeNumber(amount, 0);

        const rate = safeNumber(inflationRate, 0) / 100;

        const duration = safeNumber(years, 0);

        if (
            value < 0 ||
            duration < 0 ||
            rate <= -1
        ) {
            return null;
        }

        const futureCost =
            value * Math.pow(1 + rate, duration);

        return {
            originalValue: value,

            futureCost,

            difference: futureCost - value
        };
    }


    function initializeCalculators() {
        const compoundForm = $(
            "#compound-interest-form"
        );

        if (compoundForm) {
            compoundForm.addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    const result = calculateCompoundInterest({
                        principal: $(
                            "#compound-principal"
                        )?.value,

                        annualRate: $(
                            "#compound-rate"
                        )?.value,

                        years: $(
                            "#compound-years"
                        )?.value,

                        contributions: $(
                            "#compound-contribution"
                        )?.value || 0
                    });

                    if (!result) {
                        showNotification(
                            "Please enter valid calculator values.",
                            "warning"
                        );

                        return;
                    }

                    setText(
                        "#compound-result",
                        formatCurrency(
                            result.finalValue
                        )
                    );

                    setText(
                        "#compound-invested",
                        formatCurrency(
                            result.totalContributions
                        )
                    );

                    setText(
                        "#compound-interest",
                        formatCurrency(
                            result.interest
                        )
                    );
                }
            );
        }


        const simpleForm = $(
            "#simple-interest-form"
        );

        if (simpleForm) {
            simpleForm.addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    const result = calculateSimpleInterest({
                        principal: $(
                            "#simple-principal"
                        )?.value,

                        annualRate: $(
                            "#simple-rate"
                        )?.value,

                        years: $(
                            "#simple-years"
                        )?.value
                    });

                    if (!result) {
                        showNotification(
                            "Please enter valid calculator values.",
                            "warning"
                        );

                        return;
                    }

                    setText(
                        "#simple-result",
                        formatCurrency(result.finalValue)
                    );

                    setText(
                        "#simple-interest-value",
                        formatCurrency(result.interest)
                    );
                }
            );
        }


        const inflationForm = $(
            "#inflation-calculator-form"
        );

        if (inflationForm) {
            inflationForm.addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    const result = calculateInflationValue({
                        amount: $(
                            "#inflation-amount"
                        )?.value,

                        inflationRate: $(
                            "#inflation-rate"
                        )?.value,

                        years: $(
                            "#inflation-years"
                        )?.value
                    });

                    if (!result) {
                        showNotification(
                            "Please enter valid calculator values.",
                            "warning"
                        );

                        return;
                    }

                    setText(
                        "#inflation-result",
                        formatCurrency(result.futureCost)
                    );

                    setText(
                        "#inflation-difference",
                        formatCurrency(result.difference)
                    );
                }
            );
        }


        const currencyForm = $(
            "#currency-calculator-form"
        );

        if (currencyForm) {
            currencyForm.addEventListener(
                "submit",
                event => {
                    event.preventDefault();

                    const amount = safeNumber(
                        $("#conversion-amount")?.value
                    );

                    const from = $(
                        "#conversion-from"
                    )?.value;

                    const to = $(
                        "#conversion-to"
                    )?.value;

                    const result = convertCurrency(
                        amount,
                        from,
                        to
                    );

                    setText(
                        "#conversion-result",
                        result === null
                            ? "Rate unavailable"
                            : formatCurrency(result, to)
                    );
                }
            );
        }
    }


    function updateCalculatorCurrency() {
        $all("[data-calculator-currency]").forEach(element => {
            element.textContent = state.selectedCurrency;
        });
    }


    /* ========================================================
       22. CSV EXPORT
    ======================================================== */

    function downloadCSV(filename, rows) {
        if (!Array.isArray(rows) || !rows.length) {
            showNotification(
                "There is no data available to export.",
                "warning"
            );

            return;
        }

        const csv = rows.map(row => {
            return row.map(value => {
                const safeValue = String(value ?? "")
                    .replace(/"/g, '""');

                return `"${safeValue}"`;
            }).join(",");
        }).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            {
                type: "text/csv;charset=utf-8;"
            }
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


    function exportCurrencies() {
        const rows = [
            [
                "Currency",
                "Currency name",
                "Value in PLN",
                `Value in ${state.selectedCurrency}`,
                "Date"
            ]
        ];

        getCurrencyRates().forEach(rate => {
            const converted = convertCurrency(
                rate.value,
                "PLN",
                state.selectedCurrency
            );

            rows.push([
                rate.code,
                CONFIG.currencyNames[rate.code] || rate.code,
                rate.value,
                converted ?? "",
                rate.date || ""
            ]);
        });

        downloadCSV(
            "monetary-archive-currencies.csv",
            rows
        );
    }


    function exportEconomicData() {
        const rows = [
            [
                "Country",
                "Indicator",
                "Category",
                "Value",
                "Unit",
                "Date",
                "Source"
            ]
        ];

        safeArray(
            state.dashboard?.observations
        ).forEach(item => {
            rows.push([
                item.countryName || item.country,
                item.name || item.indicator,
                item.category,
                item.value,
                item.unit,
                item.date,
                item.source
            ]);
        });

        downloadCSV(
            "monetary-archive-economic-data.csv",
            rows
        );
    }


    function initializeExports() {
        $all("[data-export-currencies]").forEach(button => {
            button.addEventListener(
                "click",
                exportCurrencies
            );
        });

        $all("[data-export-economy]").forEach(button => {
            button.addEventListener(
                "click",
                exportEconomicData
            );
        });
    }


    /* ========================================================
       23. MANUAL REFRESH
    ======================================================== */

    async function refreshAllData() {
        if (state.isRefreshing) {
            return;
        }

        state.isRefreshing = true;

        updateConnectionStatus(
            "loading",
            "Updating data..."
        );

        try {
            if (window.ArchiveData?.clearCache) {
                window.ArchiveData.clearCache();
            }

            await Promise.allSettled([
                loadMainData(true),
                loadBitcoin(),
                loadBitcoinHistory(state.selectedPeriod)
            ]);

            renderDashboard();

            updateConnectionStatus(
                "online",
                "Data updated"
            );

            showNotification(
                "The financial dashboard has been refreshed.",
                "success"
            );

        } catch (error) {
            console.error(
                "[Archive] Refresh failed:",
                error
            );

            updateConnectionStatus(
                "error",
                "Some data sources are unavailable"
            );

            showNotification(
                "Some data could not be refreshed.",
                "warning"
            );

        } finally {
            state.isRefreshing = false;
        }
    }


    function initializeRefreshButton() {
        const buttons = $all(
            "#refresh-button, " +
            "[data-refresh-dashboard]"
        );

        buttons.forEach(button => {
            button.addEventListener(
                "click",
                refreshAllData
            );
        });
    }


    /* ========================================================
       24. AUTOMATIC UPDATES
    ======================================================== */

    function startAutomaticUpdates() {
        window.setInterval(async () => {
            try {
                await loadMainData(true);

                renderDashboard();

            } catch (error) {
                console.warn(
                    "[Archive] Automatic dashboard update failed:",
                    error
                );
            }

        }, CONFIG.refreshInterval);


        window.setInterval(async () => {
            try {
                await loadBitcoin();

            } catch (error) {
                console.warn(
                    "[Archive] Automatic Bitcoin update failed:",
                    error
                );
            }

        }, CONFIG.bitcoinRefreshInterval);
    }


    /* ========================================================
       25. COUNTRY SELECTION FROM GLOBE
    ======================================================== */

    function initializeGlobeEvents() {
        window.addEventListener(
            "archive:country-selected",
            event => {
                const country = event.detail;

                if (!country) {
                    return;
                }

                state.selectedCountry =
                    country.id || state.selectedCountry;

                setText(
                    "#selected-country-name",
                    country.name || "Unknown country"
                );

                setText(
                    "#country-name",
                    country.name || "Unknown country"
                );

                renderSelectedCountry(country);
            }
        );
    }


    function renderSelectedCountry(country) {
        const panel = $(
            "#country-panel, " +
            "[data-country-panel]"
        );

        if (panel) {
            panel.classList.add("active");
        }

        /*
         * The current data engine provides World Bank
         * observations for Poland and the United States.
         *
         * Other countries are not assigned invented
         * economic figures.
         */

        const countryCode = country.id;

        const inflation = getLatestObservation(
            countryCode,
            "inflation"
        );

        const gdp = getLatestObservation(
            countryCode,
            "economy"
        );

        setText(
            "#country-inflation",
            inflation
                ? formatPercent(inflation.value)
                : "Not available"
        );

        setText(
            "#country-gdp",
            gdp
                ? formatPercent(gdp.value)
                : "Not available"
        );

        setText(
            "#country-data-date",
            formatDate(
                inflation?.date || gdp?.date
            )
        );

        dispatchEvent("archive:country-data-rendered", {
            country,
            inflation,
            gdp
        });
    }


    /* ========================================================
       26. TOOLTIP INITIALIZATION
    ======================================================== */

    function initializeTooltips() {
        $all("[data-tooltip]").forEach(element => {
            element.setAttribute(
                "title",
                element.dataset.tooltip
            );
        });
    }


    /* ========================================================
       27. ACCESSIBILITY
    ======================================================== */

    function initializeAccessibility() {
        $all("button").forEach(button => {
            if (!button.getAttribute("aria-label") &&
                !button.textContent.trim()) {

                button.setAttribute(
                    "aria-label",
                    "Website control"
                );
            }
        });
    }


    /* ========================================================
       28. INITIAL CHART LOADING
    ======================================================== */

    async function initializeCharts() {
        const tasks = [];

        if (
            $("#currency-chart") ||
            $("[data-chart='currency']")
        ) {
            tasks.push(
                loadCurrencyChart("USD")
            );
        }

        if (
            $("#gold-chart") ||
            $("[data-chart='gold']")
        ) {
            tasks.push(
                loadGoldChart()
            );
        }

        if (
            $("#bitcoin-chart") ||
            $("#btc-chart") ||
            $("[data-chart='bitcoin']")
        ) {
            tasks.push(
                loadBitcoinHistory(
                    state.selectedPeriod
                )
            );
        }

        await Promise.allSettled(tasks);
    }


    /* ========================================================
       29. APPLICATION INITIALIZATION
    ======================================================== */

    async function initializeApplication() {
        console.info(
            "[Monetary Archive] Initializing application..."
        );

        setLoading(true);

        restoreCurrencyPreference();

        initializeCurrencySelector();

        initializeNavigation();

        initializeMobileNavigation();

        initializeTableSearch();

        initializeCalculators();

        initializeExports();

        initializeRefreshButton();

        initializeChartPeriods();

        initializeGlobeEvents();

        initializeTooltips();

        initializeAccessibility();

        try {
            const results = await Promise.allSettled([
                loadMainData(false),
                loadBitcoin()
            ]);

            const dashboardResult = results[0];

            const bitcoinResult = results[1];

            if (dashboardResult.status === "fulfilled") {
                renderDashboard();

                updateConnectionStatus(
                    "online",
                    "Data connected"
                );

            } else {
                console.error(
                    "[Archive] Main data failed:",
                    dashboardResult.reason
                );

                updateConnectionStatus(
                    "error",
                    "Economic data unavailable"
                );

                showNotification(
                    "The economic data service could not be reached.",
                    "warning"
                );
            }

            if (bitcoinResult.status === "rejected") {
                console.error(
                    "[Archive] Bitcoin data failed:",
                    bitcoinResult.reason
                );

                setText(
                    "#bitcoin-price",
                    "Temporarily unavailable"
                );
            }

            await initializeCharts();

            updateCalculatorCurrency();

            updateLastUpdated(
                state.lastDashboardUpdate
            );

        } catch (error) {
            console.error(
                "[Monetary Archive] Initialization error:",
                error
            );

            updateConnectionStatus(
                "error",
                "Initialization failed"
            );

        } finally {
            setLoading(false);

            document.body.classList.add(
                "archive-initialized"
            );

            dispatchEvent("archive:application-ready", {
                version: "1.0.0"
            });

            console.info(
                "[Monetary Archive] Application initialized."
            );
        }

        startAutomaticUpdates();
    }


    /* ========================================================
       30. PUBLIC APPLICATION API
    ======================================================== */

    window.MonetaryArchive = Object.freeze({

        version: "1.0.0",

        getState() {
            return {
                selectedCurrency: state.selectedCurrency,

                selectedCountry: state.selectedCountry,

                dashboard: state.dashboard,

                bitcoin: state.bitcoin,

                bitcoinHistory: state.bitcoinHistory,

                lastDashboardUpdate:
                    state.lastDashboardUpdate
            };
        },

        refresh: refreshAllData,

        changeCurrency,

        navigateToSection,

        convertCurrency,

        formatCurrency,

        formatNumber,

        formatPercent,

        exportCurrencies,

        exportEconomicData,

        calculateCompoundInterest,

        calculateSimpleInterest,

        calculateInflationValue
    });


    /* ========================================================
       31. START APPLICATION
    ======================================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeApplication,
            { once: true }
        );

    } else {
        initializeApplication();
    }

})();
