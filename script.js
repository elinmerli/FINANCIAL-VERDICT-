"use strict";

(() => {

    const Data = window.ArchiveData;
    const Globe = window.ArchiveGlobe;

    const app = {
        page: "overview",
        currency: "USD",
        bitcoinPeriod: 30,
        chart: null,
        historyRecords: [],
        loading: false,
        economyCountry: "USA",
        economyRequest: 0
    };

    const PAGE_NAMES = {
        overview: "Overview",
        globe: "Global Globe",
        currencies: "Currencies",
        markets: "Markets & Bitcoin",
        economy: "Inflation & Economy",
        calculators: "Calculators",
        history: "Historical Archive"
    };

    const COUNTRIES = [
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

    const INDICATORS = [
        ["gdp", "GDP growth", "NY.GDP.MKTP.KD.ZG", "%"],
        ["inflation", "Inflation", "FP.CPI.TOTL.ZG", "%"],
        ["unemployment", "Unemployment", "SL.UEM.TOTL.ZS", "%"],
        ["population", "Population", "SP.POP.TOTL", ""]
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

    function money(value) {
        return Data.formatMoney(value, app.currency);
    }

    function numeric(value, digits = 2) {
        return Data.formatNumber(value, digits);
    }

    function safeText(value) {
        return value === null || value === undefined
            ? "Unavailable"
            : String(value);
    }

    function heading(title, description, eyebrow = "FINANCIAL RECORDS") {
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

    function metric(label, value, note = "Latest available information", className = "") {
        return `
            <div class="metric-card">
                <div class="metric-label">${escapeHTML(label)}</div>
                <div class="metric-value">${escapeHTML(value)}</div>
                <div class="metric-change ${className}">
                    ${escapeHTML(note)}
                </div>
            </div>
        `;
    }

    function panel(title, subtitle, content) {
        return `
            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title">${escapeHTML(title)}</h2>
                        <p class="panel-subtitle">${escapeHTML(subtitle)}</p>
                    </div>
                </div>
                ${content}
            </section>
        `;
    }

    function sourceLine(text) {
        return `<div class="source-line">${escapeHTML(text)}</div>`;
    }

    function formatDate(date) {
        if (!date) {
            return "Unavailable";
        }

        const parsed = date instanceof Date
            ? date
            : new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return "Unavailable";
        }

        return parsed.toLocaleString();
    }

    function updateClock() {
        const dateElement = document.getElementById("current-date");

        if (dateElement) {
            dateElement.textContent = new Date().toLocaleDateString(
                "en-GB",
                {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }
            );
        }
    }

    function updateStatus() {
        const state = Data.getState();

        const status = document.getElementById("connection-status");
        const dot = document.getElementById("status-dot");
        const lastUpdate = document.getElementById("last-update");

        const connected =
            Object.keys(state.rates).length > 1 ||
            Boolean(state.bitcoin) ||
            Boolean(state.gold);

        if (status) {
            status.textContent = connected
                ? "DATA AVAILABLE"
                : "DATA UNAVAILABLE";
        }

        if (dot) {
            dot.classList.toggle("online", connected);
            dot.classList.toggle("offline", !connected);
        }

        if (lastUpdate) {
            lastUpdate.textContent = state.lastUpdate
                ? `Updated ${state.lastUpdate.toLocaleTimeString()}`
                : "Awaiting data";
        }
    }

    function destroyChart() {
        if (app.chart) {
            app.chart.destroy();
            app.chart = null;
        }
    }

    function drawLineChart(canvasId, labels, values, label) {
        const canvas = document.getElementById(canvasId);

        if (!canvas || typeof Chart === "undefined") {
            return;
        }

        destroyChart();

        app.chart = new Chart(canvas, {
            type: "line",

            data: {
                labels,

                datasets: [{
                    label,
                    data: values,

                    borderColor: "#a48b61",
                    backgroundColor: "rgba(164,139,97,0.10)",

                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    fill: true,
                    tension: 0.28
                }]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    mode: "index",
                    intersect: false
                },

                plugins: {
                    legend: {
                        display: false
                    },

                    tooltip: {
                        backgroundColor: "#191916",
                        borderColor: "#69583b",
                        borderWidth: 1,
                        titleColor: "#e4ddcf",
                        bodyColor: "#c0a77a"
                    }
                },

                scales: {
                    x: {
                        grid: {
                            color: "rgba(255,255,255,0.035)"
                        },

                        ticks: {
                            color: "#8c8578",
                            maxTicksLimit: 9
                        }
                    },

                    y: {
                        grid: {
                            color: "rgba(255,255,255,0.06)"
                        },

                        ticks: {
                            color: "#a49b8b"
                        }
                    }
                }
            }
        });
    }

    function chartDateLabel(date, period) {
        if (period === 1) {
            return date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        return date.toLocaleDateString([], {
            day: "2-digit",
            month: "short"
        });
    }

    async function loadBitcoinChart(canvasId, period) {
        const records = await Data.loadBitcoinHistory(period);

        if (!records.length) {
            const canvas = document.getElementById(canvasId);

            if (canvas) {
                const parent = canvas.parentElement;

                if (parent) {
                    parent.insertAdjacentHTML(
                        "beforeend",
                        `<div class="source-line">Historical Bitcoin data is currently unavailable.</div>`
                    );
                }
            }

            return;
        }

        drawLineChart(
            canvasId,
            records.map(item => chartDateLabel(item.date, period)),
            records.map(item => item.value),
            `Bitcoin (${app.currency})`
        );
    }

    function periodButtons(attribute, active) {
        const periods = [
            [1, "24H"],
            [7, "7D"],
            [30, "30D"],
            [90, "90D"],
            [365, "1Y"]
        ];

        return `
            <div class="chart-controls">
                ${periods.map(([days, label]) => `
                    <button
                        class="period-button ${days === active ? "active" : ""}"
                        ${attribute}="${days}"
                    >
                        ${label}
                    </button>
                `).join("")}
            </div>
        `;
    }

    function renderOverview() {
        const state = Data.getState();

        const btc = state.bitcoin;
        const gold = state.gold;

        return `
            ${heading(
                "Global Financial Overview",
                "An international financial archive containing market references, monetary values and economic indicators."
            )}

            <div class="metric-grid" id="overview-metrics">
                ${metric(
                    "Bitcoin",
                    btc ? money(btc.price) : "Unavailable",
                    btc ? Data.formatPercent(btc.change24h) : "CoinGecko data unavailable",
                    btc ? Data.changeClass(btc.change24h) : ""
                )}

                ${metric(
                    "Gold / gram",
                    gold ? money(gold.pricePerGram) : "Unavailable",
                    gold ? `Observation: ${gold.date}` : "NBP data unavailable"
                )}

                ${metric(
                    "Gold / troy ounce",
                    gold ? money(gold.pricePerOunce) : "Unavailable"
                )}

                ${metric(
                    "Currency records",
                    String(Object.keys(state.rates).length),
                    `Display currency: ${app.currency}`
                )}
            </div>

            <div class="content-grid">

                ${panel(
                    "The Living Planet",
                    "Interactive geographic and financial atlas",
                    `
                        <div class="globe-panel">
                            <div class="globe-overlay">
                                <h2>EARTH / FINANCIAL ATLAS</h2>
                                <p>ROTATE · ZOOM · EXPLORE</p>
                            </div>

                            <div id="globe-container"></div>
                        </div>

                        ${sourceLine("Select a country on the globe to display its available economic indicators.")}
                    `
                )}

                ${panel(
                    "Selected Country",
                    "Economic information from the World Bank",
                    `
                        <div class="eyebrow">COUNTRY PROFILE</div>

                        <h2 class="panel-title" id="overview-country-name">
                            No country selected
                        </h2>

                        <p class="panel-subtitle" id="overview-country-description">
                            Select a country on the planet.
                        </p>

                        <div class="country-data" id="overview-country-data">
                            ${countryPlaceholders()}
                        </div>
                    `
                )}

            </div>

            <div class="content-grid">

                ${panel(
                    "Bitcoin Historical Movement",
                    "Historical reference prices in the selected display currency",
                    `
                        ${periodButtons("data-overview-period", app.bitcoinPeriod)}

                        <div class="chart-container">
                            <canvas id="overview-bitcoin-chart"></canvas>
                        </div>
                    `
                )}

                ${panel(
                    "Market Summary",
                    "Latest available reference values",
                    `
                        <div class="country-data" id="overview-market-summary">
                            <div class="country-data-item">
                                <span>BTC PRICE</span>
                                <strong>${btc ? escapeHTML(money(btc.price)) : "Unavailable"}</strong>
                            </div>

                            <div class="country-data-item">
                                <span>24H CHANGE</span>
                                <strong class="${btc ? Data.changeClass(btc.change24h) : ""}">
                                    ${btc ? escapeHTML(Data.formatPercent(btc.change24h)) : "Unavailable"}
                                </strong>
                            </div>

                            <div class="country-data-item">
                                <span>BTC MARKET CAP</span>
                                <strong>${btc ? escapeHTML(money(btc.marketCap)) : "Unavailable"}</strong>
                            </div>

                            <div class="country-data-item">
                                <span>GOLD / GRAM</span>
                                <strong>${gold ? escapeHTML(money(gold.pricePerGram)) : "Unavailable"}</strong>
                            </div>
                        </div>

                        ${sourceLine("Bitcoin: CoinGecko. Gold: National Bank of Poland.")}
                    `
                )}

            </div>

            ${renderCurrencyTable("overview-currency-table", 12)}

            ${sourceLine("Exchange rates: NBP and Frankfurter. Bitcoin: CoinGecko. Economic indicators: World Bank.")}
        `;
    }

    function countryPlaceholders() {
        return `
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
        `;
    }

    function renderCurrencyTable(elementId, limit = Infinity) {
        const rows = Data.getCurrencies()
            .filter(item => item.code !== app.currency)
            .slice(0, limit);

        return `
            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2 class="panel-title">International Currency Rates</h2>
                        <p class="panel-subtitle">
                            Value of one currency unit in ${escapeHTML(app.currency)}
                        </p>
                    </div>
                </div>

                <div class="data-table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Currency</th>
                                <th>Value</th>
                                <th>Source</th>
                            </tr>
                        </thead>

                        <tbody id="${elementId}">
                            ${rows.map(item => `
                                <tr>
                                    <td>${escapeHTML(item.code)}</td>
                                    <td>${escapeHTML(item.name)}</td>
                                    <td>${item.rate === null ? "Unavailable" : numeric(item.rate, 5)}</td>
                                    <td>${escapeHTML(item.source)}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function renderGlobePage() {
        return `
            ${heading(
                "The Global Globe",
                "Explore the world and inspect available country-level economic observations."
            )}

            <div class="content-grid">

                <section class="globe-panel">
                    <div class="globe-overlay">
                        <h2>EARTH / FINANCIAL ATLAS</h2>
                        <p>ROTATE · ZOOM · SELECT A COUNTRY</p>
                    </div>

                    <div id="globe-container"></div>
                </section>

                <section class="country-panel">
                    <div class="eyebrow">COUNTRY PROFILE</div>

                    <h3 id="globe-country-name">Select a country</h3>

                    <p class="panel-subtitle" id="globe-country-description">
                        Click a country to inspect its available data.
                    </p>

                    <div class="country-data" id="globe-country-data">
                        ${countryPlaceholders()}
                    </div>

                    <div class="source-line" id="globe-country-source">
                        Source: World Bank Open Data.
                    </div>
                </section>

            </div>
        `;
    }

    function renderCurrenciesPage() {
        const currencies = Data.getCurrencies();

        return `
            ${heading(
                "International Currencies",
                "Reference exchange rates, currency comparisons and conversion tools."
            )}

            <div class="metric-grid">
                ${metric("Display currency", app.currency, "Base for displayed conversions")}
                ${metric("Available currencies", String(currencies.length), "Loaded reference rates")}
                ${metric("Primary source", "NBP", "National Bank of Poland")}
                ${metric("Additional source", "Frankfurter", "Additional reference rates")}
            </div>

            ${panel(
                "Currency Reference Table",
                "Search for a currency or currency code",
                `
                    <input
                        class="table-search"
                        type="search"
                        id="currency-search"
                        placeholder="Search currency..."
                    >

                    <div class="data-table-wrap" style="margin-top:16px">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Currency</th>
                                    <th>Rate</th>
                                    <th>Display currency</th>
                                    <th>Source</th>
                                </tr>
                            </thead>

                            <tbody id="currency-table-body">
                                ${currencyRows(currencies)}
                            </tbody>
                        </table>
                    </div>
                `
            )}

            <div class="content-grid equal" style="margin-top:17px">

                ${panel(
                    "Currency Converter",
                    "Convert between currencies with available reference rates",
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
                                    ${currencyOptions(app.currency)}
                                </select>
                            </div>

                        </div>

                        <button class="archive-button" id="convert-currency" style="margin-top:15px">
                            Convert currency
                        </button>

                        <div class="result-box" id="currency-result">
                            <div class="result-label">CONVERSION RESULT</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

                ${panel(
                    "Exchange Rate Information",
                    "How the rates should be interpreted",
                    `
                        <div class="notice">
                            Exchange rates shown here are reference rates.
                            They are not guaranteed trading or bank transaction prices.

                            Actual transactions may include fees, spreads and different execution rates.
                        </div>

                        ${sourceLine("The displayed rate is calculated from the latest available reference data.")}
                    `
                )}

            </div>
        `;
    }

    function currencyRows(currencies) {
        return currencies.map(item => `
            <tr>
                <td>${escapeHTML(item.code)}</td>
                <td>${escapeHTML(item.name)}</td>
                <td>${item.rate === null ? "Unavailable" : numeric(item.rate, 6)}</td>
                <td>${escapeHTML(app.currency)}</td>
                <td>${escapeHTML(item.source)}</td>
            </tr>
        `).join("");
    }

    function currencyOptions(selected) {
        const codes = Object.keys(Data.getState().rates)
            .sort();

        if (!codes.includes(selected)) {
            codes.push(selected);
        }

        return codes.map(code => `
            <option value="${escapeHTML(code)}" ${code === selected ? "selected" : ""}>
                ${escapeHTML(code)} — ${escapeHTML(Data.currencyNames[code] || code)}
            </option>
        `).join("");
    }

    function renderMarketsPage() {
        const state = Data.getState();
        const btc = state.bitcoin;
        const gold = state.gold;

        return `
            ${heading(
                "Markets & Bitcoin",
                "Cryptocurrency reference prices, market capitalization, trading volume and precious-metal data."
            )}

            <div class="metric-grid" id="market-metrics">
                ${metric("Bitcoin price", btc ? money(btc.price) : "Unavailable")}
                ${metric(
                    "24-hour change",
                    btc ? Data.formatPercent(btc.change24h) : "Unavailable",
                    btc ? "CoinGecko reference data" : "Data unavailable",
                    btc ? Data.changeClass(btc.change24h) : ""
                )}
                ${metric("Market capitalization", btc ? money(btc.marketCap) : "Unavailable")}
                ${metric("24-hour volume", btc ? money(btc.volume) : "Unavailable")}
            </div>

            ${panel(
                "Bitcoin Historical Price",
                `BTC price history in ${app.currency}`,
                `
                    ${periodButtons("data-market-period", app.bitcoinPeriod)}

                    <div class="chart-container large">
                        <canvas id="market-bitcoin-chart"></canvas>
                    </div>

                    ${sourceLine("Source: CoinGecko. Historical data is subject to API availability and rate limits.")}
                `
            )}

            <div class="content-grid equal" style="margin-top:17px">

                ${panel(
                    "Gold Reference Price",
                    "Latest available NBP observation",
                    `
                        <div class="country-data" id="market-gold">
                            <div class="country-data-item">
                                <span>PRICE / GRAM</span>
                                <strong>${gold ? escapeHTML(money(gold.pricePerGram)) : "Unavailable"}</strong>
                            </div>

                            <div class="country-data-item">
                                <span>PRICE / TROY OUNCE</span>
                                <strong>${gold ? escapeHTML(money(gold.pricePerOunce)) : "Unavailable"}</strong>
                            </div>

                            <div class="country-data-item">
                                <span>OBSERVATION DATE</span>
                                <strong>${gold ? escapeHTML(gold.date) : "Unavailable"}</strong>
                            </div>

                            <div class="country-data-item">
                                <span>SOURCE</span>
                                <strong>NBP</strong>
                            </div>
                        </div>
                    `
                )}

                ${panel(
                    "Market Data Sources",
                    "Reference data and limitations",
                    `
                        <div class="notice">
                            Bitcoin: CoinGecko API.<br><br>
                            Gold: National Bank of Poland.<br><br>
                            Currency conversion: NBP and Frankfurter.
                        </div>

                        ${sourceLine("Live stock exchange quotes and exchange indices are not displayed unless a verified source is available.")}
                    `
                )}

            </div>
        `;
    }

    function renderEconomyPage() {
        return `
            ${heading(
                "Inflation & Economy",
                "Macroeconomic statistics from the World Bank, including GDP growth, inflation, unemployment and population."
            )}

            <div class="content-grid equal">

                ${panel(
                    "Country Selection",
                    "Choose a country for the economic report",
                    `
                        <div class="form-field">
                            <label for="economy-country">Country</label>

                            <select id="economy-country">
                                ${COUNTRIES.map(([code, name]) => `
                                    <option
                                        value="${code}"
                                        ${code === app.economyCountry ? "selected" : ""}
                                    >
                                        ${escapeHTML(name)}
                                    </option>
                                `).join("")}
                            </select>
                        </div>
                    `
                )}

                ${panel(
                    "Indicator Definitions",
                    "Description of the economic measurements",
                    `
                        <div class="notice">
                            GDP growth — annual percentage change in real GDP.<br><br>
                            Inflation — annual consumer price change.<br><br>
                            Unemployment — percentage of the labor force unemployed.<br><br>
                            Population — total population estimate.
                        </div>
                    `
                )}

            </div>

            <div class="metric-grid" id="economy-metrics" style="margin-top:17px">
                ${metric("GDP growth", "Loading...")}
                ${metric("Inflation", "Loading...")}
                ${metric("Unemployment", "Loading...")}
                ${metric("Population", "Loading...")}
            </div>

            ${panel(
                "Economic Observations",
                "Latest available country statistics",
                `
                    <div class="data-table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Indicator</th>
                                    <th>Value</th>
                                    <th>Year</th>
                                    <th>Source</th>
                                </tr>
                            </thead>

                            <tbody id="economy-table">
                                <tr>
                                    <td colspan="4">Loading economic data...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `
            )}

            ${sourceLine("Source: World Bank Open Data. Different indicators may have different observation years.")}
        `;
    }

    function renderCalculatorsPage() {
        return `
            ${heading(
                "Financial Calculators",
                "Financial calculations for currency conversion, interest and inflation scenarios."
            )}

            <div class="content-grid equal">

                ${panel(
                    "Compound Interest",
                    "Calculate future value with periodic compounding",
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

                        <button class="archive-button" data-action="compound" style="margin-top:15px">
                            Calculate
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

                        <button class="archive-button" data-action="simple" style="margin-top:15px">
                            Calculate
                        </button>

                        <div class="result-box" id="simple-result">
                            <div class="result-label">TOTAL VALUE</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

            </div>

            <div class="content-grid equal" style="margin-top:17px">

                ${panel(
                    "Inflation Calculator",
                    "Estimate the future cost of an amount",
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

                        <button class="archive-button" data-action="inflation" style="margin-top:15px">
                            Calculate
                        </button>

                        <div class="result-box" id="inflation-result">
                            <div class="result-label">ESTIMATED FUTURE COST</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

                ${panel(
                    "Currency Converter",
                    "Convert using loaded reference rates",
                    `
                        <div class="form-grid">

                            <div class="form-field">
                                <label for="calc-amount">Amount</label>
                                <input id="calc-amount" type="number" min="0" value="100">
                            </div>

                            <div class="form-field">
                                <label for="calc-from">From</label>
                                <select id="calc-from">
                                    ${currencyOptions("USD")}
                                </select>
                            </div>

                            <div class="form-field">
                                <label for="calc-to">To</label>
                                <select id="calc-to">
                                    ${currencyOptions(app.currency)}
                                </select>
                            </div>

                        </div>

                        <button class="archive-button" data-action="currency" style="margin-top:15px">
                            Convert
                        </button>

                        <div class="result-box" id="calc-currency-result">
                            <div class="result-label">CONVERTED AMOUNT</div>
                            <div class="result-value">—</div>
                        </div>
                    `
                )}

            </div>

            ${sourceLine("Calculators provide mathematical estimates. User-entered rates are assumptions, not financial forecasts.")}
        `;
    }

    function renderHistoryPage() {
        return `
            ${heading(
                "Historical Archive",
                "Historical Bitcoin and gold observations available from connected public data sources."
            )}

            <div class="content-grid equal">

                ${panel(
                    "Archive Search",
                    "Choose the historical dataset and period",
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

                        <button class="archive-button" data-action="history" style="margin-top:15px">
                            Load records
                        </button>

                        <div class="source-line" id="history-status">
                            Select a dataset and load its records.
                        </div>
                    `
                )}

                ${panel(
                    "Archive Information",
                    "Historical data sources",
                    `
                        <div class="notice">
                            Bitcoin historical data: CoinGecko.<br><br>
                            Gold historical data: National Bank of Poland.<br><br>
                            Available periods depend on the source API.
                        </div>
                    `
                )}

            </div>

            <div style="margin-top:17px">

                ${panel(
                    "Historical Price Chart",
                    "Selected historical series",
                    `
                        <div class="chart-container large">
                            <canvas id="history-chart"></canvas>
                        </div>
                    `
                )}

            </div>

            <div style="margin-top:17px">

                ${panel(
                    "Historical Records",
                    "Date, value, display currency and source",
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
                                    <tr>
                                        <td colspan="4">No records loaded.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `
                )}

            </div>
        `;
    }

    function renderPage() {
        const container = document.getElementById("page-content");

        if (!container) {
            return;
        }

        destroyChart();

        if (Globe) {
            Globe.destroy();
        }

        const renderers = {
            overview: renderOverview,
            globe: renderGlobePage,
            currencies: renderCurrenciesPage,
            markets: renderMarketsPage,
            economy: renderEconomyPage,
            calculators: renderCalculatorsPage,
            history: renderHistoryPage
        };

        const renderer = renderers[app.page];

        if (!renderer) {
            return;
        }

        container.innerHTML = renderer();

        document.getElementById("current-section-title").textContent =
            PAGE_NAMES[app.page];

        document.querySelectorAll(".nav-link").forEach(button => {
            button.classList.toggle(
                "active",
                button.dataset.page === app.page
            );
        });

        if (app.page === "overview") {
            initializeGlobe("overview");
            loadBitcoinChart("overview-bitcoin-chart", app.bitcoinPeriod);
        }

        if (app.page === "globe") {
            initializeGlobe("globe");
        }

        if (app.page === "currencies") {
            bindCurrencySearch();
        }

        if (app.page === "markets") {
            loadBitcoinChart("market-bitcoin-chart", app.bitcoinPeriod);
        }

        if (app.page === "economy") {
            loadEconomyPage();
        }

        if (app.page === "history") {
            loadHistory();
        }
    }

    function openPage(page) {
        if (!PAGE_NAMES[page]) {
            return;
        }

        app.page = page;

        renderPage();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    async function initializeGlobe(location) {
        const container = document.getElementById("globe-container");

        if (!container) {
            return;
        }

        await Globe.initialize(
            container,
            async selection => {
                await showCountry(selection, location);
            }
        );
    }

    async function showCountry(selection, location) {
        const name = selection.name;
        const code = selection.code;

        const prefix = location === "overview"
            ? "overview"
            : "globe";

        const nameElement = document.getElementById(
            `${prefix}-country-name`
        );

        const descriptionElement = document.getElementById(
            `${prefix}-country-description`
        );

        const dataElement = document.getElementById(
            `${prefix}-country-data`
        );

        if (nameElement) {
            nameElement.textContent = name;
        }

        if (descriptionElement) {
            descriptionElement.textContent =
                "Loading available World Bank observations...";
        }

        if (dataElement) {
            dataElement.innerHTML = `
                <div class="empty-state">Loading country indicators...</div>
            `;
        }

        if (!code) {
            if (descriptionElement) {
                descriptionElement.textContent =
                    "A valid country code is not available for this territory.";
            }

            if (dataElement) {
                dataElement.innerHTML = `
                    <div class="empty-state">Economic information unavailable.</div>
                `;
            }

            return;
        }

        try {
            const information = await Data.loadCountryOverview(code);

            const definitions = [
                ["gdp", "GDP GROWTH", true],
                ["inflation", "INFLATION", true],
                ["unemployment", "UNEMPLOYMENT", true],
                ["population", "POPULATION", false]
            ];

            if (dataElement) {
                dataElement.innerHTML = definitions.map(([key, label, percent]) => {
                    const item = information[key];

                    return `
                        <div class="country-data-item">
                            <span>${label}</span>

                            <strong>
                                ${item
                                    ? numeric(item.value, percent ? 2 : 0) + (percent ? "%" : "")
                                    : "Unavailable"}
                            </strong>

                            ${item
                                ? `<span>Observation: ${escapeHTML(item.year)}</span>`
                                : ""}
                        </div>
                    `;
                }).join("");
            }

            if (descriptionElement) {
                descriptionElement.textContent =
                    "Latest available observations. The indicators may refer to different years.";
            }

        } catch (error) {
            console.error("Country information error:", error);

            if (descriptionElement) {
                descriptionElement.textContent =
                    "Country information could not be loaded.";
            }

            if (dataElement) {
                dataElement.innerHTML = `
                    <div class="empty-state">
                        ${escapeHTML(error.message)}
                    </div>
                `;
            }
        }
    }

    function bindCurrencySearch() {
        const input = document.getElementById("currency-search");

        if (!input) {
            return;
        }

        input.addEventListener("input", () => {
            const query = input.value.toLowerCase();

            const rows = Data.getCurrencies().filter(item =>
                item.code.toLowerCase().includes(query) ||
                item.name.toLowerCase().includes(query)
            );

            const body = document.getElementById("currency-table-body");

            if (!body) {
                return;
            }

            body.innerHTML = rows.length
                ? currencyRows(rows)
                : `<tr><td colspan="5">No matching currency records.</td></tr>`;
        });
    }

    function readNumber(id) {
        const input = document.getElementById(id);

        if (!input) {
            throw new Error("A required input field is missing.");
        }

        const value = Number(input.value);

        if (!Number.isFinite(value) || value < 0) {
            throw new Error("Enter a valid non-negative number.");
        }

        return value;
    }

    function displayResult(id, label, value) {
        const element = document.getElementById(id);

        if (!element) {
            return;
        }

        element.innerHTML = `
            <div class="result-label">${escapeHTML(label)}</div>
            <div class="result-value">${escapeHTML(value)}</div>
        `;
    }

    function calculateCompound() {
        const principal = readNumber("compound-principal");
        const annualRate = readNumber("compound-rate") / 100;
        const years = readNumber("compound-years");
        const frequency = readNumber("compound-frequency");

        if (frequency <= 0) {
            throw new Error("Select a valid compounding frequency.");
        }

        const total = principal * Math.pow(
            1 + annualRate / frequency,
            frequency * years
        );

        displayResult(
            "compound-result",
            "FUTURE VALUE",
            money(total)
        );
    }

    function calculateSimple() {
        const principal = readNumber("simple-principal");
        const rate = readNumber("simple-rate") / 100;
        const years = readNumber("simple-years");

        const interest = principal * rate * years;
        const total = principal + interest;

        displayResult(
            "simple-result",
            "TOTAL VALUE",
            `${money(total)} · Interest: ${money(interest)}`
        );
    }

    function calculateInflation() {
        const amount = readNumber("inflation-amount");
        const rate = readNumber("inflation-rate") / 100;
        const years = readNumber("inflation-years");

        const result = amount * Math.pow(1 + rate, years);

        displayResult(
            "inflation-result",
            "ESTIMATED FUTURE COST",
            money(result)
        );
    }

    function calculateCurrency(amountId, fromId, toId, resultId) {
        const amount = readNumber(amountId);

        const from = document.getElementById(fromId)?.value;
        const to = document.getElementById(toId)?.value;

        if (!from || !to) {
            throw new Error("Select both currencies.");
        }

        const result = Data.convert(amount, from, to);

        if (result === null) {
            displayResult(
                resultId,
                "CONVERSION RESULT",
                "Required exchange rate unavailable"
            );

            return;
        }

        displayResult(
            resultId,
            "CONVERSION RESULT",
            money(result) + ` ${to}`
        );
    }

    function showCalculationError(error) {
        window.alert(error.message || "Calculation failed.");
    }

    async function loadEconomyPage() {
        const requestNumber = ++app.economyRequest;
        const country = app.economyCountry;

        const metrics = document.getElementById("economy-metrics");
        const table = document.getElementById("economy-table");

        if (metrics) {
            metrics.innerHTML = `
                ${metric("GDP growth", "Loading...")}
                ${metric("Inflation", "Loading...")}
                ${metric("Unemployment", "Loading...")}
                ${metric("Population", "Loading...")}
            `;
        }

        if (table) {
            table.innerHTML = `
                <tr><td colspan="4">Retrieving World Bank records...</td></tr>
            `;
        }

        const results = await Promise.all(
            INDICATORS.map(async ([key, label, code, unit]) => ({
                key,
                label,
                unit,
                records: await Data.loadEconomy(country, code)
            }))
        );

        if (requestNumber !== app.economyRequest) {
            return;
        }

        const latest = {};

        results.forEach(item => {
            latest[item.key] = item.records[0] || null;
        });

        if (metrics) {
            metrics.innerHTML = `
                ${metric(
                    "GDP growth",
                    latest.gdp ? `${numeric(latest.gdp.value)}%` : "Unavailable",
                    latest.gdp ? `Observation: ${latest.gdp.year}` : "No available observation"
                )}

                ${metric(
                    "Inflation",
                    latest.inflation ? `${numeric(latest.inflation.value)}%` : "Unavailable",
                    latest.inflation ? `Observation: ${latest.inflation.year}` : "No available observation"
                )}

                ${metric(
                    "Unemployment",
                    latest.unemployment ? `${numeric(latest.unemployment.value)}%` : "Unavailable",
                    latest.unemployment ? `Observation: ${latest.unemployment.year}` : "No available observation"
                )}

                ${metric(
                    "Population",
                    latest.population ? numeric(latest.population.value, 0) : "Unavailable",
                    latest.population ? `Observation: ${latest.population.year}` : "No available observation"
                )}
            `;
        }

        if (table) {
            table.innerHTML = results.map(item => {
                const observation = item.records[0];

                return `
                    <tr>
                        <td>${escapeHTML(item.label)}</td>
                        <td>
                            ${observation
                                ? numeric(observation.value, 2) + item.unit
                                : "Unavailable"}
                        </td>
                        <td>${observation ? escapeHTML(observation.year) : "—"}</td>
                        <td>World Bank</td>
                    </tr>
                `;
            }).join("");
        }
    }

    async function loadHistory() {
        const type = document.getElementById("history-type")?.value;
        const period = Number(
            document.getElementById("history-period")?.value
        );

        if (!type || !period) {
            return;
        }

        const status = document.getElementById("history-status");
        const table = document.getElementById("history-table");

        if (status) {
            status.textContent = "Loading historical observations...";
        }

        if (table) {
            table.innerHTML = `
                <tr><td colspan="4">Loading records...</td></tr>
            `;
        }

        let records = [];

        if (type === "bitcoin") {
            records = await Data.loadBitcoinHistory(period);
        } else if (type === "gold") {
            records = await Data.loadGoldHistory();

            if (period < 30) {
                records = records.slice(-period);
            }
        }

        app.historyRecords = records;

        if (!records.length) {
            if (status) {
                status.textContent = "No historical observations are currently available.";
            }

            if (table) {
                table.innerHTML = `
                    <tr><td colspan="4">No records available.</td></tr>
                `;
            }

            return;
        }

        const labels = records.map(item => {
            const date = item.date instanceof Date
                ? item.date
                : new Date(item.date);

            return date.toLocaleDateString();
        });

        const values = records.map(item => item.value);

        drawLineChart(
            "history-chart",
            labels,
            values,
            type === "bitcoin" ? "Bitcoin" : "Gold"
        );

        if (table) {
            table.innerHTML = records.slice().reverse().map(item => {
                const date = item.date instanceof Date
                    ? item.date.toLocaleString()
                    : String(item.date);

                return `
                    <tr>
                        <td>${escapeHTML(date)}</td>
                        <td>${numeric(item.value, 4)}</td>
                        <td>${escapeHTML(app.currency)}</td>
                        <td>${type === "bitcoin" ? "CoinGecko" : "NBP"}</td>
                    </tr>
                `;
            }).join("");
        }

        if (status) {
            status.textContent = `${records.length} historical observations loaded.`;
        }
    }

    async function refreshData() {
        if (app.loading) {
            return;
        }

        app.loading = true;

        const button = document.getElementById("refresh-data");

        if (button) {
            button.disabled = true;
            button.textContent = "…";
        }

        try {
            await Data.loadAll();

            updateStatus();

            renderPage();

        } catch (error) {
            console.error("Refresh failed:", error);

            window.alert(
                "Some financial information could not be refreshed."
            );

        } finally {
            app.loading = false;

            if (button) {
                button.disabled = false;
                button.textContent = "↻";
            }
        }
    }

    function bindNavigation() {
        document.querySelectorAll(".nav-link").forEach(button => {
            button.addEventListener("click", () => {
                openPage(button.dataset.page);
            });
        });
    }

    function bindGlobalControls() {
        const currencySelect = document.getElementById("display-currency");

        currencySelect.addEventListener("change", async event => {
            const currency = event.target.value;

            try {
                Data.setCurrency(currency);

                app.currency = currency;

                try {
                    localStorage.setItem("archive-currency", currency);
                } catch {
                    // Local storage may be unavailable in private browsing.
                }

                await Data.loadAll();

                updateStatus();
                renderPage();

            } catch (error) {
                console.error("Currency update failed:", error);
                window.alert("The selected currency could not be loaded.");
            }
        });

        document.getElementById("refresh-data").addEventListener(
            "click",
            refreshData
        );
    }

    function bindPageEvents() {
        const container = document.getElementById("page-content");

        container.addEventListener("click", async event => {
            const target = event.target;

            const overviewPeriod = target.closest("[data-overview-period]");

            if (overviewPeriod) {
                app.bitcoinPeriod = Number(
                    overviewPeriod.dataset.overviewPeriod
                );

                renderPage();
                return;
            }

            const marketPeriod = target.closest("[data-market-period]");

            if (marketPeriod) {
                app.bitcoinPeriod = Number(
                    marketPeriod.dataset.marketPeriod
                );

                renderPage();
                return;
            }

            const actionButton = target.closest("[data-action]");

            if (!actionButton) {
                if (target.id === "convert-currency") {
                    try {
                        calculateCurrency(
                            "convert-amount",
                            "convert-from",
                            "convert-to",
                            "currency-result"
                        );
                    } catch (error) {
                        showCalculationError(error);
                    }
                }

                return;
            }

            const action = actionButton.dataset.action;

            try {
                if (action === "compound") {
                    calculateCompound();
                }

                if (action === "simple") {
                    calculateSimple();
                }

                if (action === "inflation") {
                    calculateInflation();
                }

                if (action === "currency") {
                    calculateCurrency(
                        "calc-amount",
                        "calc-from",
                        "calc-to",
                        "calc-currency-result"
                    );
                }

                if (action === "history") {
                    await loadHistory();
                }

            } catch (error) {
                showCalculationError(error);
            }
        });

        container.addEventListener("change", event => {
            if (event.target.id === "economy-country") {
                app.economyCountry = event.target.value;
                loadEconomyPage();
            }
        });
    }

    async function start() {
        updateClock();

        window.setInterval(updateClock, 60000);

        bindNavigation();
        bindGlobalControls();
        bindPageEvents();

        const currencySelect = document.getElementById("display-currency");

        let savedCurrency = "USD";

        try {
            savedCurrency = localStorage.getItem("archive-currency") || "USD";
        } catch {
            savedCurrency = "USD";
        }

        if (Data.currencyNames[savedCurrency]) {
            app.currency = savedCurrency;
            Data.setCurrency(savedCurrency);
            currencySelect.value = savedCurrency;
        }

        /*
         * The globe is the first visual element on the Overview page.
         * Financial requests begin immediately.
         */

        await Data.loadAll();

        updateStatus();

        renderPage();
    }

    document.addEventListener("DOMContentLoaded", start);

})();
