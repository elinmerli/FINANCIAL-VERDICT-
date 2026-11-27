"use strict";

(() => {

    const D = window.ArchiveData;

    const app = {
        currentPage: "overview",
        charts: {},
        loading: false,
        bitcoinPeriod: 30,
        currencySearch: "",
        historyType: "bitcoin",
        economyCountry: "USA",
        globeReady: false
    };

    const PAGE_TITLES = {
        overview: "Overview",
        globe: "Global Globe",
        currencies: "Currencies",
        markets: "Markets & Bitcoin",
        economy: "Inflation & Economy",
        calculators: "Calculators",
        history: "Historical Archive"
    };

    const INDICATORS = {
        gdp: "NY.GDP.MKTP.KD.ZG",
        inflation: "FP.CPI.TOTL.ZG",
        unemployment: "SL.UEM.TOTL.ZS",
        population: "SP.POP.TOTL"
    };

    const COUNTRY_OPTIONS = [
        ["USA", "United States"],
        ["POL", "Poland"],
        ["DEU", "Germany"],
        ["FRA", "France"],
        ["GBR", "United Kingdom"],
        ["JPN", "Japan"],
        ["CHN", "China"],
        ["IND", "India"],
        ["BRA", "Brazil"],
        ["CAN", "Canada"],
        ["AUS", "Australia"],
        ["CHE", "Switzerland"],
        ["ITA", "Italy"],
        ["ESP", "Spain"],
        ["NLD", "Netherlands"],
        ["SWE", "Sweden"],
        ["NOR", "Norway"],
        ["KOR", "South Korea"],
        ["MEX", "Mexico"],
        ["ZAF", "South Africa"]
    ];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function number(value, digits = 2) {
        return D.formatNumber(value, digits);
    }

    function money(value) {
        return D.formatMoney(value);
    }

    function pageHeading(title, description, eyebrow = "FINANCIAL RECORDS") {
        return `
            <div class="page-heading">
                <div>
                    <div class="eyebrow">${escapeHTML(eyebrow)}</div>
                    <h1>${escapeHTML(title)}</h1>
                    <p>${escapeHTML(description)}</p>
                </div>
            </div>
        `;
    }

    function panel(title, subtitle, content, extraClass = "") {
        return `
            <section class="panel ${extraClass}">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title">${escapeHTML(title)}</h2>
                        ${subtitle ? `<p class="panel-subtitle">${escapeHTML(subtitle)}</p>` : ""}
                    </div>
                </div>
                ${content}
            </section>
        `;
    }

    function metric(label, value, change = null, changeClass = "neutral") {
        return `
            <div class="metric-card">
                <div class="metric-label">${escapeHTML(label)}</div>
                <div class="metric-value">${escapeHTML(value)}</div>
                <div class="metric-change ${changeClass}">
                    ${change === null ? "Source data pending" : escapeHTML(change)}
                </div>
            </div>
        `;
    }

    function destroyCharts() {
        Object.values(app.charts).forEach(chart => {
            if (chart && typeof chart.destroy === "function") {
                chart.destroy();
            }
        });

        app.charts = {};
    }

    function createLineChart(canvasId, labels, values, label) {
        const canvas = document.getElementById(canvasId);

        if (!canvas || !window.Chart) {
            return;
        }

        if (app.charts[canvasId]) {
            app.charts[canvasId].destroy();
        }

        app.charts[canvasId] = new Chart(canvas, {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label,
                    data: values,

                    borderColor: "#a48b5e",
                    backgroundColor: "rgba(164,139,94,.10)",

                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,

                    fill: true,
                    tension: 0.3
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        backgroundColor: "#191916",
                        borderColor: "#49402f",
                        borderWidth: 1,
                        titleColor: "#e6dfd0",
                        bodyColor: "#c1a77a"
                    }
                },

                scales: {
                    x: {
                        grid: {
                            color: "rgba(255,255,255,.035)"
                        },

                        ticks: {
                            color: "#716c62",
                            maxTicksLimit: 8
                        }
                    },

                    y: {
                        grid: {
                            color: "rgba(255,255,255,.06)"
                        },

                        ticks: {
                            color: "#a39b8d"
                        }
                    }
                }
            }
        });
    }

    function createBarChart(canvasId, labels, values, label) {
        const canvas = document.getElementById(canvasId);

        if (!canvas || !window.Chart) {
            return;
        }

        if (app.charts[canvasId]) {
            app.charts[canvasId].destroy();
        }

        app.charts[canvasId] = new Chart(canvas, {
            type: "bar",

            data: {
                labels,

                datasets: [{
                    label,
                    data: values,

                    backgroundColor: "#806d4d",
                    borderColor: "#a48b5e",
                    borderWidth: 1
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: false
                    }
                },

                scales: {
                    x: {
                        grid: {
                            display: false
                        },

                        ticks: {
                            color: "#a39b8d"
                        }
                    },

                    y: {
                        grid: {
                            color: "rgba(255,255,255,.06)"
                        },

                        ticks: {
                            color: "#a39b8d"
                        }
                    }
                }
            }
        });
    }

    function setPage(page) {
        if (!PAGE_TITLES[page]) {
            return;
        }

        app.currentPage = page;

        document.querySelectorAll(".nav-link").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === page
            );
        });

        document.getElementById("current-section-title").textContent =
            PAGE_TITLES[page];

        destroyCharts();

        renderPage();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function renderPage() {
        const container = document.getElementById("page-content");

        if (!container) {
            return;
        }

        const renderers = {
            overview: renderOverview,
            globe: renderGlobe,
            currencies: renderCurrencies,
            markets: renderMarkets,
            economy: renderEconomy,
            calculators: renderCalculators,
            history: renderHistory
        };

        const renderer = renderers[app.currentPage];

        if (renderer) {
            container.innerHTML = renderer();
        }

        if (app.currentPage === "overview") {
            updateOverview();
        }

        if (app.currentPage === "currencies") {
            updateCurrencyTable();
        }

        if (app.currentPage === "markets") {
            updateMarkets();
        }

        if (app.currentPage === "globe") {
            initializeGlobe();
        }

        if (app.currentPage === "economy") {
            loadEconomyPage();
        }

        if (app.currentPage === "history") {
            loadHistoryPage();
        }
    }

    function renderOverview() {
        const state = D.getState();

        return `
            ${pageHeading(
                "Global Financial Overview",
                "An international overview of financial markets, monetary values and economic indicators."
            )}

            <div class="metric-grid" id="overview-metrics">
                ${metric("Bitcoin", state.bitcoin ? money(state.bitcoin.price) : "Loading...")}
                ${metric("Gold / gram", state.gold ? money(state.gold.pricePerGram) : "Loading...")}
                ${metric("Display currency", D.getCurrency())}
                ${metric("Currency records", Object.keys(state.rates).length || "Loading...")}
            </div>

            <div class="content-grid">
                ${panel(
                    "Bitcoin Market History",
                    "Historical BTC price in the selected display currency",
                    `
                        <div class="chart-controls">
                            <button class="period-button" data-btc-period="1">24H</button>
                            <button class="period-button" data-btc-period="7">7D</button>
                            <button class="period-button active" data-btc-period="30">30D</button>
                            <button class="period-button" data-btc-period="90">90D</button>
                            <button class="period-button" data-btc-period="365">1Y</button>
                        </div>
                        <div class="chart-container">
                            <canvas id="overview-bitcoin-chart"></canvas>
                        </div>
                    `
                )}

                ${panel(
                    "Market Summary",
                    "Latest available financial information",
                    `
                        <div id="overview-summary" class="empty-state">
                            Loading market information...
                        </div>
                    `
                )}
            </div>

            ${panel(
                "International Currency Rates",
                "Reference exchange rates, converted into the selected display currency",
                `
                    <div class="data-table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Currency</th>
                                    <th>Name</th>
                                    <th>Rate</th>
                                </tr>
                            </thead>
                            <tbody id="overview-currency-table">
                                <tr><td colspan="3">Loading currency records...</td></tr>
                            </tbody>
                        </table>
                    </div>
                `
            )}

            <div class="source-line">
                Sources: NBP, CoinGecko and Frankfurter. Market data availability and update frequency depend on the source.
            </div>
        `;
    }

    function updateOverview() {
        const state = D.getState();

        const metrics = document.getElementById("overview-metrics");

        if (metrics) {
            metrics.innerHTML = `
                ${metric(
                    "Bitcoin",
                    state.bitcoin ? money(state.bitcoin.price) : "Unavailable",
                    state.bitcoin ? D.formatPercent(state.bitcoin.change24h) : null,
                    state.bitcoin ? D.getChangeClass(state.bitcoin.change24h) : "neutral"
                )}

                ${metric(
                    "Gold / gram",
                    state.gold ? money(state.gold.pricePerGram) : "Unavailable",
                    state.gold ? `Observation: ${state.gold.date}` : null
                )}

                ${metric(
                    "Display currency",
                    D.getCurrency(),
                    "Used throughout the archive"
                )}

                ${metric(
                    "Currency records",
                    Object.keys(state.rates).length,
                    "Available reference rates"
                )}
            `;
        }

        const summary = document.getElementById("overview-summary");

        if (summary) {
            summary.innerHTML = `
                <div class="country-data">
                    <div class="country-data-item">
                        <span>BTC PRICE</span>
                        <strong>${state.bitcoin ? escapeHTML(money(state.bitcoin.price)) : "Unavailable"}</strong>
                    </div>

                    <div class="country-data-item">
                        <span>24H CHANGE</span>
                        <strong class="${state.bitcoin ? D.getChangeClass(state.bitcoin.change24h) : "neutral"}">
                            ${state.bitcoin ? escapeHTML(D.formatPercent(state.bitcoin.change24h)) : "Unavailable"}
                        </strong>
                    </div>

                    <div class="country-data-item">
                        <span>GOLD / OUNCE</span>
                        <strong>${state.gold ? escapeHTML(money(state.gold.pricePerOunce)) : "Unavailable"}</strong>
                    </div>

                    <div class="country-data-item">
                        <span>GOLD OBSERVATION</span>
                        <strong>${state.gold ? escapeHTML(state.gold.date) : "Unavailable"}</strong>
                    </div>
                </div>

                <div class="source-line">
                    Bitcoin: CoinGecko. Gold: NBP.
                </div>
            `;
        }

        updateCurrencyTable();

        loadBitcoinChart("overview-bitcoin-chart", app.bitcoinPeriod);
    }

    async function loadBitcoinChart(canvasId, days) {
        const data = await D.loadBitcoinHistory(days);

        if (!data.length) {
            return;
        }

        createLineChart(
            canvasId,
            data.map(item => {
                if (days === 1) {
                    return item.date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                }

                return item.date.toLocaleDateString();
            }),
            data.map(item => item.value),
            "Bitcoin"
        );
    }

    function updateCurrencyTable() {
        const body = document.getElementById("overview-currency-table");

        if (!body) {
            return;
        }

        const currencies = D.getCurrencies()
            .filter(item => item.code !== D.getCurrency())
            .slice(0, 12);

        if (!currencies.length) {
            body.innerHTML = `
                <tr><td colspan="3">Currency information is currently unavailable.</td></tr>
            `;

            return;
        }

        body.innerHTML = currencies.map(item => `
            <tr>
                <td>${escapeHTML(item.code)}</td>
                <td>${escapeHTML(item.name)}</td>
                <td>${item.rate === null ? "Unavailable" : number(item.rate, 5)}</td>
            </tr>
        `).join("");
    }

    function renderGlobe() {
        return `
            ${pageHeading(
                "The Global Globe",
                "Explore countries and access available international economic indicators."
            )}

            <div class="content-grid">
                <section class="globe-panel">
                    <div class="globe-overlay">
                        <h2>EARTH / FINANCIAL ATLAS</h2>
                        <p>Rotate · Zoom · Select a country</p>
                    </div>

                    <div id="globe-container"></div>
                </section>

                <section class="country-panel" id="country-panel">
                    <div class="eyebrow">COUNTRY INFORMATION</div>
                    <h3 id="country-name">Select a country</h3>

                    <p class="panel-subtitle" id="country-description">
                        Select a country on the globe to view its available information.
                    </p>

                    <div class="country-data" id="country-data">
                        <div class="country-data-item">
                            <span>GDP GROWTH</span>
                            <strong>—</strong>
                        </div>

                        <div class="country-data-item">
                            <span>INFLATION</span>
                            <strong>—</strong>
                        </div>

                        <div class="country-data-item">
                            <span>UNEMPLOYMENT</span>
                            <strong>—</strong>
                        </div>

                        <div class="country-data-item">
                            <span>POPULATION</span>
                            <strong>—</strong>
                        </div>
                    </div>

                    <div class="source-line" id="country-source">
                        Source: World Bank. Country indicators may have different observation years.
                    </div>
                </section>
            </div>
        `;
    }

    function renderCurrencies() {
        return `
            ${pageHeading(
                "International Currencies",
                "Reference exchange rates, currency comparison and available historical records."
            )}

            <div class="metric-grid">
                ${metric("Display currency", D.getCurrency(), "Base for displayed conversions")}
                ${metric("Available currencies", Object.keys(D.getState().rates).length, "Reference currency records")}
                ${metric("Primary source", "NBP", "National Bank of Poland")}
                ${metric("Additional source", "Frankfurter", "Fallback currency reference")}
            </div>

            ${panel(
                "Currency Reference Table",
                "Search currencies and compare their value against the selected display currency",
                `
                    <input
                        class="table-search"
                        id="currency-search"
                        type="search"
                        placeholder="Search currency or currency code..."
                    >

                    <div class="data-table-wrap" style="margin-top:18px">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Currency</th>
                                    <th>Rate</th>
                                    <th>Compared with</th>
                                </tr>
                            </thead>

                            <tbody id="currency-table-body">
                                <tr><td colspan="4">Loading rates...</td></tr>
                            </tbody>
                        </table>
                    </div>
                `
            )}

            <div class="content-grid equal" style="margin-top:18px">
                ${panel(
                    "Currency Converter",
                    "Convert between supported currencies",
                    `
                        <div class="form-grid">
                            <div class="form-field">
                                <label for="convert-amount">Amount</label>
                                <input id="convert-amount" type="number" min="0" step="any" value="100">
                            </div>

                            <div class="form-field">
                                <label for="convert-from">From</label>
                                <select id="convert-from">
                                    ${currencyOptions("USD")}
                                </select>
                            </div>

                            <div class="form-field">
                                <label for="convert-to">To</label>
                                <select id="convert-to">
                                    ${currencyOptions(D.getCurrency())}
                                </select>
                            </div>
                        </div>

                        <button class="archive-button" id="convert-currency" style="margin-top:15px">
                            Calculate conversion
                        </button>

                        <div class="result-box" id="currency-conversion-result">
                            <div class="result-label">CONVERSION RESULT</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

                ${panel(
                    "Reference Information",
                    "Understanding currency data",
                    `
                        <div class="notice">
                            Exchange rates are reference rates, not guaranteed executable trading prices.
                            Bank spreads, fees and intraday movements may change the actual amount received.
                        </div>

                        <div class="source-line">
                            NBP provides reference tables for selected currencies.
                            Frankfurter supplies additional rates where supported.
                        </div>
                    `
                )}
            </div>
        `;
    }

    function currencyOptions(selected) {
        const codes = Object.keys(D.getState().rates).sort();

        if (!codes.includes(selected)) {
            codes.push(selected);
        }

        return codes.map(code => `
            <option value="${escapeHTML(code)}" ${code === selected ? "selected" : ""}>
                ${escapeHTML(code)}
            </option>
        `).join("");
    }

    function updateCurrencyPageTable() {
        const body = document.getElementById("currency-table-body");

        if (!body) {
            return;
        }

        const query = app.currencySearch.toLowerCase();

        const rows = D.getCurrencies().filter(item =>
            item.code.toLowerCase().includes(query) ||
            item.name.toLowerCase().includes(query)
        );

        body.innerHTML = rows.map(item => `
            <tr>
                <td>${escapeHTML(item.code)}</td>
                <td>${escapeHTML(item.name)}</td>
                <td>${item.rate === null ? "Unavailable" : number(item.rate, 6)}</td>
                <td>${escapeHTML(D.getCurrency())}</td>
            </tr>
        `).join("") || `
            <tr><td colspan="4">No matching currency records.</td></tr>
        `;
    }

    function renderMarkets() {
        const state = D.getState();

        return `
            ${pageHeading(
                "Markets & Bitcoin",
                "Cryptocurrency market information and precious-metal reference prices."
            )}

            <div class="metric-grid" id="market-metrics">
                ${metric("Bitcoin price", state.bitcoin ? money(state.bitcoin.price) : "Loading...")}
                ${metric("24H movement", state.bitcoin ? D.formatPercent(state.bitcoin.change24h) : "Loading...")}
                ${metric("Market capitalization", state.bitcoin ? money(state.bitcoin.marketCap) : "Loading...")}
                ${metric("24H trading volume", state.bitcoin ? money(state.bitcoin.volume) : "Loading...")}
            </div>

            ${panel(
                "Bitcoin Historical Price",
                "BTC reference price converted into the selected display currency",
                `
                    <div class="chart-controls">
                        <button class="period-button" data-market-period="1">24H</button>
                        <button class="period-button" data-market-period="7">7D</button>
                        <button class="period-button active" data-market-period="30">30D</button>
                        <button class="period-button" data-market-period="90">90D</button>
                        <button class="period-button" data-market-period="365">1Y</button>
                    </div>

                    <div class="chart-container large">
                        <canvas id="market-bitcoin-chart"></canvas>
                    </div>

                    <div class="source-line">
                        Source: CoinGecko. Historical data availability depends on API limits.
                    </div>
                `
            )}

            <div class="content-grid equal" style="margin-top:18px">
                ${panel(
                    "Gold Reference Price",
                    "National Bank of Poland reference price",
                    `
                        <div id="gold-market-details" class="empty-state">
                            Loading gold data...
                        </div>
                    `
                )}

                ${panel(
                    "Market Data Notes",
                    "Source and update information",
                    `
                        <div class="notice">
                            Bitcoin data is supplied by CoinGecko. Gold data is supplied by NBP.
                            These sources do not represent every exchange or trading venue.
                        </div>

                        <div class="source-line">
                            Stock exchange indices and live exchange quotes are not included unless a verified source is connected.
                            No simulated market prices are displayed.
                        </div>
                    `
                )}
            </div>
        `;
    }

    async function updateMarkets() {
        const state = D.getState();

        const metrics = document.getElementById("market-metrics");

        if (metrics) {
            metrics.innerHTML = `
                ${metric(
                    "Bitcoin price",
                    state.bitcoin ? money(state.bitcoin.price) : "Unavailable"
                )}

                ${metric(
                    "24H movement",
                    state.bitcoin ? D.formatPercent(state.bitcoin.change24h) : "Unavailable",
                    state.bitcoin ? "24-hour change" : null,
                    state.bitcoin ? D.getChangeClass(state.bitcoin.change24h) : "neutral"
                )}

                ${metric(
                    "Market capitalization",
                    state.bitcoin ? money(state.bitcoin.marketCap) : "Unavailable"
                )}

                ${metric(
                    "24H trading volume",
                    state.bitcoin ? money(state.bitcoin.volume) : "Unavailable"
                )}
            `;
        }

        const gold = document.getElementById("gold-market-details");

        if (gold) {
            gold.innerHTML = state.gold ? `
                <div class="country-data">
                    <div class="country-data-item">
                        <span>PRICE PER GRAM</span>
                        <strong>${escapeHTML(money(state.gold.pricePerGram))}</strong>
                    </div>

                    <div class="country-data-item">
                        <span>PRICE PER TROY OUNCE</span>
                        <strong>${escapeHTML(money(state.gold.pricePerOunce))}</strong>
                    </div>

                    <div class="country-data-item">
                        <span>OBSERVATION DATE</span>
                        <strong>${escapeHTML(state.gold.date)}</strong>
                    </div>

                    <div class="country-data-item">
                        <span>SOURCE</span>
                        <strong>NBP</strong>
                    </div>
                </div>
            ` : `<div class="empty-state">Gold data is currently unavailable.</div>`;
        }

        await loadBitcoinChart("market-bitcoin-chart", app.bitcoinPeriod);
    }

    function renderEconomy() {
        return `
            ${pageHeading(
                "Inflation & Economy",
                "International macroeconomic indicators based on published country statistics."
            )}

            <div class="content-grid equal">
                ${panel(
                    "Country Selection",
                    "Choose a country for available economic observations",
                    `
                        <div class="form-field">
                            <label for="economy-country">Country</label>
                            <select id="economy-country">
                                ${COUNTRY_OPTIONS.map(item => `
                                    <option value="${item[0]}" ${item[0] === app.economyCountry ? "selected" : ""}>
                                        ${escapeHTML(item[1])}
                                    </option>
                                `).join("")}
                            </select>
                        </div>

                        <div class="source-line">
                            Country indicators are published with different observation dates.
                        </div>
                    `
                )}

                ${panel(
                    "Indicator Definitions",
                    "What the indicators measure",
                    `
                        <div class="notice">
                            GDP growth: annual percentage change in real GDP.<br><br>
                            Inflation: annual percentage change in consumer prices.<br><br>
                            Unemployment: share of the labor force without work but available for and seeking employment.<br><br>
                            Population: total population estimate.
                        </div>
                    `
                )}
            </div>

            <div class="metric-grid" id="economy-metrics" style="margin-top:18px">
                ${metric("GDP growth", "Loading...")}
                ${metric("Inflation", "Loading...")}
                ${metric("Unemployment", "Loading...")}
                ${metric("Population", "Loading...")}
            </div>

            ${panel(
                "Economic Observations",
                "Latest available records from the World Bank",
                `
                    <div class="data-table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Indicator</th>
                                    <th>Value</th>
                                    <th>Observation year</th>
                                    <th>Source</th>
                                </tr>
                            </thead>
                            <tbody id="economy-table">
                                <tr><td colspan="4">Loading economic indicators...</td></tr>
                            </tbody>
                        </table>
                    </div>
                `
            )}

            <div class="source-line">
                Source: World Bank Open Data. Latest available observations may not refer to the same year.
            </div>
        `;
    }

    async function loadEconomyPage() {
        const country = app.economyCountry;

        const keys = Object.entries(INDICATORS);

        const results = await Promise.all(
            keys.map(async ([name, indicator]) => ({
                name,
                data: await D.loadEconomy(country, indicator)
            }))
        );

        const latest = {};

        results.forEach(item => {
            latest[item.name] = item.data[0] || null;
        });

        const metrics = document.getElementById("economy-metrics");

        if (metrics) {
            metrics.innerHTML = `
                ${metric(
                    "GDP growth",
                    latest.gdp ? `${number(latest.gdp.value)}%` : "Unavailable",
                    latest.gdp ? `Observation: ${latest.gdp.year}` : null
                )}

                ${metric(
                    "Inflation",
                    latest.inflation ? `${number(latest.inflation.value)}%` : "Unavailable",
                    latest.inflation ? `Observation: ${latest.inflation.year}` : null
                )}

                ${metric(
                    "Unemployment",
                    latest.unemployment ? `${number(latest.unemployment.value)}%` : "Unavailable",
                    latest.unemployment ? `Observation: ${latest.unemployment.year}` : null
                )}

                ${metric(
                    "Population",
                    latest.population ? number(latest.population.value, 0) : "Unavailable",
                    latest.population ? `Observation: ${latest.population.year}` : null
                )}
            `;
        }

        const table = document.getElementById("economy-table");

        if (table) {
            const labels = {
                gdp: "GDP growth",
                inflation: "Inflation",
                unemployment: "Unemployment",
                population: "Population"
            };

            table.innerHTML = Object.entries(latest).map(([key, item]) => `
                <tr>
                    <td>${labels[key]}</td>
                    <td>${item ? number(item.value, 2) : "Unavailable"}</td>
                    <td>${item ? escapeHTML(item.year) : "—"}</td>
                    <td>World Bank</td>
                </tr>
            `).join("");
        }
    }

    function renderCalculators() {
        return `
            ${pageHeading(
                "Financial Calculators",
                "Calculate currency conversions, compound interest and the effect of inflation."
            )}

            <div class="content-grid equal">
                ${panel(
                    "Compound Interest",
                    "Estimate the future value of a starting amount with periodic compounding",
                    `
                        <div class="form-grid">
                            <div class="form-field">
                                <label for="compound-principal">Initial amount</label>
                                <input id="compound-principal" type="number" min="0" value="1000">
                            </div>

                            <div class="form-field">
                                <label for="compound-rate">Annual interest (%)</label>
                                <input id="compound-rate" type="number" min="0" step="any" value="5">
                            </div>

                            <div class="form-field">
                                <label for="compound-years">Years</label>
                                <input id="compound-years" type="number" min="0" max="100" value="10">
                            </div>

                            <div class="form-field">
                                <label for="compound-frequency">Compounding frequency</label>
                                <select id="compound-frequency">
                                    <option value="1">Annually</option>
                                    <option value="2">Semi-annually</option>
                                    <option value="4">Quarterly</option>
                                    <option value="12" selected>Monthly</option>
                                    <option value="365">Daily</option>
                                </select>
                            </div>
                        </div>

                        <button class="archive-button" id="calculate-compound" style="margin-top:15px">
                            Calculate future value
                        </button>

                        <div class="result-box" id="compound-result">
                            <div class="result-label">FUTURE VALUE</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

                ${panel(
                    "Simple Interest",
                    "Calculate interest without compounding",
                    `
                        <div class="form-grid">
                            <div class="form-field">
                                <label for="simple-principal">Principal</label>
                                <input id="simple-principal" type="number" min="0" value="1000">
                            </div>

                            <div class="form-field">
                                <label for="simple-rate">Annual interest (%)</label>
                                <input id="simple-rate" type="number" min="0" step="any" value="5">
                            </div>

                            <div class="form-field">
                                <label for="simple-years">Years</label>
                                <input id="simple-years" type="number" min="0" value="5">
                            </div>
                        </div>

                        <button class="archive-button" id="calculate-simple" style="margin-top:15px">
                            Calculate simple interest
                        </button>

                        <div class="result-box" id="simple-result">
                            <div class="result-label">TOTAL VALUE</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}
            </div>

            <div class="content-grid equal" style="margin-top:18px">
                ${panel(
                    "Inflation Calculator",
                    "Estimate the future equivalent cost using an assumed constant annual inflation rate",
                    `
                        <div class="form-grid">
                            <div class="form-field">
                                <label for="inflation-amount">Current amount</label>
                                <input id="inflation-amount" type="number" min="0" value="1000">
                            </div>

                            <div class="form-field">
                                <label for="inflation-rate">Annual inflation (%)</label>
                                <input id="inflation-rate" type="number" min="0" step="any" value="3">
                            </div>

                            <div class="form-field">
                                <label for="inflation-years">Years</label>
                                <input id="inflation-years" type="number" min="0" value="10">
                            </div>
                        </div>

                        <button class="archive-button" id="calculate-inflation" style="margin-top:15px">
                            Calculate future cost
                        </button>

                        <div class="result-box" id="inflation-result">
                            <div class="result-label">ESTIMATED FUTURE COST</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

                ${panel(
                    "Currency Converter",
                    "Convert using currently available reference rates",
                    `
                        <div class="form-grid">
                            <div class="form-field">
                                <label for="calc-currency-amount">Amount</label>
                                <input id="calc-currency-amount" type="number" min="0" value="100">
                            </div>

                            <div class="form-field">
                                <label for="calc-currency-from">From</label>
                                <select id="calc-currency-from">
                                    ${currencyOptions("USD")}
                                </select>
                            </div>

                            <div class="form-field">
                                <label for="calc-currency-to">To</label>
                                <select id="calc-currency-to">
                                    ${currencyOptions(D.getCurrency())}
                                </select>
                            </div>
                        </div>

                        <button class="archive-button" id="calculate-currency" style="margin-top:15px">
                            Convert
                        </button>

                        <div class="result-box" id="calc-currency-result">
                            <div class="result-label">CONVERTED AMOUNT</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}
            </div>

            <div class="source-line">
                Calculators use mathematical estimates. Interest and inflation rates are assumptions entered by the user, not forecasts.
            </div>
        `;
    }

    function readPositive(id) {
        const element = document.getElementById(id);

        if (!element) {
            throw new Error("Calculator input is missing.");
        }

        const value = Number(element.value);

        if (!Number.isFinite(value) || value < 0) {
            throw new Error("Enter a valid non-negative number.");
        }

        return value;
    }

    function showResult(id, label, value) {
        const box = document.getElementById(id);

        if (!box) {
            return;
        }

        box.innerHTML = `
            <div class="result-label">${escapeHTML(label)}</div>
            <div class="result-value">${escapeHTML(value)}</div>
        `;
    }

    function calculateCompound() {
        const principal = readPositive("compound-principal");
        const rate = readPositive("compound-rate") / 100;
        const years = readPositive("compound-years");
        const frequency = readPositive("compound-frequency");

        if (frequency <= 0) {
            throw new Error("Compounding frequency must be greater than zero.");
        }

        const result = principal * Math.pow(
            1 + rate / frequency,
            frequency * years
        );

        showResult(
            "compound-result",
            "FUTURE VALUE",
            money(result)
        );
    }

    function calculateSimple() {
        const principal = readPositive("simple-principal");
        const rate = readPositive("simple-rate") / 100;
        const years = readPositive("simple-years");

        const interest = principal * rate * years;
        const total = principal + interest;

        showResult(
            "simple-result",
            "TOTAL VALUE",
            `${money(total)} · Interest: ${money(interest)}`
        );
    }

    function calculateInflation() {
        const amount = readPositive("inflation-amount");
        const rate = readPositive("inflation-rate") / 100;
        const years = readPositive("inflation-years");

        const futureCost = amount * Math.pow(1 + rate, years);

        showResult(
            "inflation-result",
            "ESTIMATED FUTURE COST",
            money(futureCost)
        );
    }

    function calculateCurrency(amountId, fromId, toId, resultId) {
        const amount = readPositive(amountId);

        const from = document.getElementById(fromId).value;
        const to = document.getElementById(toId).value;

        const converted = D.convertBetweenCurrencies(amount, from, to);

        if (converted === null) {
            showResult(resultId, "CONVERSION RESULT", "Rate unavailable");
            return;
        }

        showResult(
            resultId,
            "CONVERSION RESULT",
            `${money(converted)} ${to}`
        );
    }

    function renderHistory() {
        return `
            ${pageHeading(
                "Historical Archive",
                "Browse historical Bitcoin and gold observations available through connected public sources."
            )}

            <div class="content-grid equal">
                ${panel(
                    "Archive Type",
                    "Select the historical series",
                    `
                        <div class="form-field">
                            <label for="history-type">Dataset</label>
                            <select id="history-type">
                                <option value="bitcoin">Bitcoin</option>
                                <option value="gold">Gold</option>
                            </select>
                        </div>

                        <div class="form-field" style="margin-top:13px">
                            <label for="history-period">Period</label>
                            <select id="history-period">
                                <option value="7">7 days</option>
                                <option value="30" selected>30 days</option>
                                <option value="90">90 days</option>
                                <option value="365">1 year</option>
                            </select>
                        </div>

                        <button class="archive-button" id="load-history" style="margin-top:15px">
                            Load historical records
                        </button>
                    `
                )}

                ${panel(
                    "Archive Information",
                    "Data availability",
                    `
                        <div class="notice">
                            Bitcoin history is supplied by CoinGecko.
                            Gold history is supplied by NBP.
                            The number of available observations depends on each source.
                        </div>
                    `
                )}
            </div>

            <div style="margin-top:18px">
                ${panel(
                    "Historical Price Chart",
                    "Selected archive series",
                    `
                        <div class="chart-container large">
                            <canvas id="history-chart"></canvas>
                        </div>
                    `
                )}
            </div>

            <div style="margin-top:18px">
                ${panel(
                    "Historical Records",
                    "Available observations and their dates",
                    `
                        <div class="data-table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Value</th>
                                        <th>Currency</th>
                                        <th>Source</th>
                                    </tr>
                                </thead>

                                <tbody id="history-table">
                                    <tr><td colspan="4">Choose a dataset and load records.</td></tr>
                                </tbody>
                            </table>
                        </div>
                    `
                )}
            </div>
        `;
    }

    async function loadHistoryPage() {
        await updateHistory();
    }

    async function updateHistory() {
        const typeElement = document.getElementById("history-type");
        const periodElement = document.getElementById("history-period");

        if (!typeElement || !periodElement) {
            return;
        }

        const type = typeElement.value;
        const period = Number(periodElement.value);

        let records = [];

        if (type === "bitcoin") {
            records = await D.loadBitcoinHistory(period);
        } else {
            records = await D.loadGoldHistory();

            if (period < 30) {
                records = records.slice(-period);
            }
        }

        const labels = records.map(item => {
            const date = item.date instanceof Date
                ? item.date
                : new Date(item.date);

            return date.toLocaleDateString();
        });

        const values = records.map(item => item.value);

        createLineChart(
            "history-chart",
            labels,
            values,
            type === "bitcoin" ? "Bitcoin" : "Gold"
        );

        const table = document.getElementById("history-table");

        if (table) {
            table.innerHTML = records.slice().reverse().map(item => {
                const date = item.date instanceof Date
                    ? item.date.toLocaleString()
                    : item.date;

                return `
                    <tr>
                        <td>${escapeHTML(date)}</td>
                        <td>${item.value === null ? "Unavailable" : number(item.value, 4)}</td>
                        <td>${escapeHTML(D.getCurrency())}</td>
                        <td>${type === "bitcoin" ? "CoinGecko" : "NBP"}</td>
                    </tr>
                `;
            }).join("") || `
                <tr><td colspan="4">No historical observations are currently available.</td></tr>
            `;
        }
    }

    async function initializeGlobe() {
        if (typeof window.initializeArchiveGlobe !== "function") {
            return;
        }

        await window.initializeArchiveGlobe({
            onCountrySelected: async country => {
                await showCountryInformation(country);
            }
        });
    }

    async function showCountryInformation(country) {
        const name = country.properties?.ADMIN ||
            country.properties?.NAME ||
            country.properties?.name ||
            "Selected country";

        const iso3 = country.properties?.ISO_A3 ||
            country.properties?.ADM0_A3 ||
            country.properties?.iso_a3;

        const title = document.getElementById("country-name");
        const description = document.getElementById("country-description");
        const data = document.getElementById("country-data");

        if (title) title.textContent = name;

        if (description) {
            description.textContent = "Retrieving available World Bank observations...";
        }

        if (data) {
            data.innerHTML = `
                <div class="country-data-item"><span>GDP GROWTH</span><strong>Loading...</strong></div>
                <div class="country-data-item"><span>INFLATION</span><strong>Loading...</strong></div>
                <div class="country-data-item"><span>UNEMPLOYMENT</span><strong>Loading...</strong></div>
                <div class="country-data-item"><span>POPULATION</span><strong>Loading...</strong></div>
            `;
        }

        if (!iso3 || iso3 === "-99") {
            if (description) {
                description.textContent = "A recognized country code is not available for this territory.";
            }

            if (data) {
                data.innerHTML = `<div class="empty-state">Economic indicators unavailable.</div>`;
            }

            return;
        }

        const info = await D.loadCountryOverview(iso3);

        const definitions = [
            ["GDP GROWTH", info.gdp, true],
            ["INFLATION", info.inflation, true],
            ["UNEMPLOYMENT", info.unemployment, true],
            ["POPULATION", info.population, false]
        ];

        if (data) {
            data.innerHTML = definitions.map(([label, item, percent]) => `
                <div class="country-data-item">
                    <span>${label}</span>
                    <strong>
                        ${item
                            ? `${number(item.value, percent ? 2 : 0)}${percent ? "%" : ""}`
                            : "Unavailable"}
                    </strong>
                    ${item ? `<span>Year: ${escapeHTML(item.year)}</span>` : ""}
                </div>
            `).join("");
        }

        if (description) {
            description.textContent = "Latest available observations. Indicators may refer to different years.";
        }
    }

    async function refreshData() {
        if (app.loading) {
            return;
        }

        app.loading = true;

        const button = document.getElementById("refresh-data");
        const status = document.getElementById("connection-status");

        if (button) {
            button.disabled = true;
            button.textContent = "…";
        }

        if (status) {
            status.textContent = "UPDATING DATA";
        }

        try {
            await D.loadAll();

            updateStatus();

            renderPage();

        } catch (error) {
            console.error("Archive update failed:", error);

            if (status) {
                status.textContent = "UPDATE FAILED";
            }

        } finally {
            app.loading = false;

            if (button) {
                button.disabled = false;
                button.textContent = "↻";
            }
        }
    }

    function updateStatus() {
        const state = D.getState();

        const status = document.getElementById("connection-status");
        const update = document.getElementById("last-update");

        const hasData =
            Object.keys(state.rates).length > 1 ||
            Boolean(state.bitcoin) ||
            Boolean(state.gold);

        if (status) {
            status.textContent = hasData
                ? "DATA SOURCE AVAILABLE"
                : "DATA UNAVAILABLE";

            const dot = status.previousElementSibling;

            if (dot) {
                dot.classList.toggle("online", hasData);
                dot.classList.toggle("offline", !hasData);
            }
        }

        if (update) {
            update.textContent = state.lastUpdate
                ? `Updated ${state.lastUpdate.toLocaleTimeString()}`
                : "Awaiting data";
        }
    }

    function showCalculatorError(error) {
        alert(error.message || "Calculation could not be completed.");
    }

    function bindEvents() {
        document.querySelectorAll(".nav-link").forEach(button => {
            button.addEventListener("click", () => {
                setPage(button.dataset.page);
            });
        });

        const currencySelect = document.getElementById("display-currency");

        currencySelect.addEventListener("change", async event => {
            try {
                D.setCurrency(event.target.value);

                await D.loadAll();

                renderPage();

                updateStatus();

            } catch (error) {
                console.error("Currency change failed:", error);
            }
        });

        document.getElementById("refresh-data").addEventListener(
            "click",
            refreshData
        );

        document.getElementById("page-content").addEventListener(
            "click",
            async event => {

                const overviewPeriod = event.target.closest("[data-btc-period]");

                if (overviewPeriod) {
                    app.bitcoinPeriod = Number(overviewPeriod.dataset.btcPeriod);

                    document.querySelectorAll("[data-btc-period]").forEach(button => {
                        button.classList.toggle(
                            "active",
                            button === overviewPeriod
                        );
                    });

                    await loadBitcoinChart(
                        "overview-bitcoin-chart",
                        app.bitcoinPeriod
                    );

                    return;
                }

                const marketPeriod = event.target.closest("[data-market-period]");

                if (marketPeriod) {
                    app.bitcoinPeriod = Number(marketPeriod.dataset.marketPeriod);

                    document.querySelectorAll("[data-market-period]").forEach(button => {
                        button.classList.toggle(
                            "active",
                            button === marketPeriod
                        );
                    });

                    await loadBitcoinChart(
                        "market-bitcoin-chart",
                        app.bitcoinPeriod
                    );

                    return;
                }

                if (event.target.id === "convert-currency") {
                    try {
                        calculateCurrency(
                            "convert-amount",
                            "convert-from",
                            "convert-to",
                            "currency-conversion-result"
                        );
                    } catch (error) {
                        showCalculatorError(error);
                    }
                }

                if (event.target.id === "calculate-compound") {
                    try {
                        calculateCompound();
                    } catch (error) {
                        showCalculatorError(error);
                    }
                }

                if (event.target.id === "calculate-simple") {
                    try {
                        calculateSimple();
                    } catch (error) {
                        showCalculatorError(error);
                    }
                }

                if (event.target.id === "calculate-inflation") {
                    try {
                        calculateInflation();
                    } catch (error) {
                        showCalculatorError(error);
                    }
                }

                if (event.target.id === "calculate-currency") {
                    try {
                        calculateCurrency(
                            "calc-currency-amount",
                            "calc-currency-from",
                            "calc-currency-to",
                            "calc-currency-result"
                        );
                    } catch (error) {
                        showCalculatorError(error);
                    }
                }

                if (event.target.id === "load-history") {
                    await updateHistory();
                }
            }
        );

        document.getElementById("page-content").addEventListener(
            "input",
            event => {
                if (event.target.id === "currency-search") {
                    app.currencySearch = event.target.value;

                    updateCurrencyPageTable();
                }
            }
        );

        document.getElementById("page-content").addEventListener(
            "change",
            event => {
                if (event.target.id === "economy-country") {
                    app.economyCountry = event.target.value;

                    loadEconomyPage();
                }
            }
        );

        document.getElementById("page-content").addEventListener(
            "change",
            event => {
                if (event.target.id === "history-type") {
                    app.historyType = event.target.value;
                }
            }
        );
    }

    async function start() {
        const year = document.getElementById("footer-year");

        if (year) {
            year.textContent = new Date().getFullYear();
        }

        bindEvents();

        const savedCurrency = localStorage.getItem("archive-currency");

        if (savedCurrency) {
            const selector = document.getElementById("display-currency");

            if ([...selector.options].some(option => option.value === savedCurrency)) {
                selector.value = savedCurrency;
                D.setCurrency(savedCurrency);
            }
        }

        await D.loadAll();

        updateStatus();

        renderPage();

        document.getElementById("display-currency").addEventListener(
            "change",
            event => {
                localStorage.setItem("archive-currency", event.target.value);
            }
        );
    }

    document.addEventListener("DOMContentLoaded", start);

})();
