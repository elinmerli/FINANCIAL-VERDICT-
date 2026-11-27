/* ============================================================
   THE MONETARY ARCHIVE
   Main application controller
   Version: 1.0.0
   ============================================================ */

(() => {
    "use strict";

    /* ========================================================
       1. CONFIGURATION
       ======================================================== */

    const CONFIG = {
        refreshInterval: 5 * 60 * 1000,
        clockInterval: 1000,
        chartAnimation: false,
        locale: "en-GB",
        currency: "PLN",
        maximumTableRows: 500
    };

    const PAGE_NAMES = {
        overview: "Overview",
        statistics: "Statistics",
        inflation: "Inflation",
        calculator: "Calculator",
        markets: "Markets",
        archive: "Historical archive"
    };

    const CURRENCY_NAMES = {
        USD: "US dollar",
        EUR: "Euro",
        GBP: "British pound",
        CHF: "Swiss franc",
        JPY: "Japanese yen",
        CAD: "Canadian dollar",
        AUD: "Australian dollar",
        CZK: "Czech koruna",
        SEK: "Swedish krona",
        NOK: "Norwegian krone",
        DKK: "Danish krone",
        HUF: "Hungarian forint"
    };

    const COUNTRY_NAMES = {
        PL: "Poland",
        US: "United States",
        EU: "European Union"
    };

    const state = {
        dashboard: null,
        observations: [],
        currencies: [],
        gold: null,
        inflation: [],
        history: {},
        sources: {},
        errors: [],
        charts: {},
        currentPage: "overview",
        selectedObservation: null,
        lastSuccessfulLoad: null,
        loading: false,
        refreshTimer: null,
        historyRequestId: 0
    };


    /* ========================================================
       2. DOM HELPERS
       ======================================================== */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        const element = byId(id);

        if (element) {
            element.textContent =
                value === null || value === undefined || value === ""
                    ? "—"
                    : String(value);
        }
    }

    function setHTML(id, html) {
        const element = byId(id);

        if (element) {
            element.innerHTML = html;
        }
    }

    function showElement(element) {
        if (element) {
            element.classList.remove("hidden");
        }
    }

    function hideElement(element) {
        if (element) {
            element.classList.add("hidden");
        }
    }

    function setStatus(elementOrId, text, type = "neutral") {
        const element =
            typeof elementOrId === "string"
                ? byId(elementOrId)
                : elementOrId;

        if (!element) return;

        element.textContent = text;

        element.classList.remove(
            "status-neutral",
            "status-loading",
            "status-success",
            "status-error",
            "status-warning"
        );

        element.classList.add(`status-${type}`);
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

    function isValidNumber(value) {
        return (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            Number.isFinite(Number(value))
        );
    }

    function toNumber(value) {
        if (!isValidNumber(value)) return null;

        const number = Number(value);

        return Number.isFinite(number) ? number : null;
    }

    function firstDefined(...values) {
        return values.find(
            value => value !== undefined && value !== null
        );
    }

    function formatNumber(value, decimals = 2) {
        const number = toNumber(value);

        if (number === null) return "—";

        return new Intl.NumberFormat(CONFIG.locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    function formatMoney(value, currency = "PLN") {
        const number = toNumber(value);

        if (number === null) return "—";

        try {
            return new Intl.NumberFormat(CONFIG.locale, {
                style: "currency",
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 4
            }).format(number);
        } catch {
            return `${formatNumber(number, 2)} ${currency}`;
        }
    }

    function formatPercent(value) {
        const number = toNumber(value);

        if (number === null) return "—";

        return `${formatNumber(number, 2)}%`;
    }

    function formatDate(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(CONFIG.locale, {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(date);
    }

    function formatDateTime(value) {
        if (!value) return "—";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return new Intl.DateTimeFormat(CONFIG.locale, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }).format(date);
    }


    /* ========================================================
       3. DATA NORMALIZATION
       ======================================================== */

    function getObservationValue(item) {
        return toNumber(firstDefined(
            item?.value,
            item?.rate,
            item?.mid,
            item?.price,
            item?.amount,
            item?.observation
        ));
    }

    function getObservationDate(item) {
        return firstDefined(
            item?.date,
            item?.observationDate,
            item?.observation_date,
            item?.period,
            item?.year,
            item?.time
        ) ?? null;
    }

    function getObservationName(item) {
        return firstDefined(
            item?.name,
            item?.indicator,
            item?.label,
            item?.title,
            item?.description,
            item?.code
        ) ?? "Unnamed indicator";
    }

    function getObservationCountry(item) {
        const country = firstDefined(
            item?.country,
            item?.countryCode,
            item?.country_code,
            item?.geo
        );

        if (!country) return "—";

        return COUNTRY_NAMES[country] || country;
    }

    function getObservationSource(item) {
        return firstDefined(
            item?.source,
            item?.provider,
            item?.institution
        ) ?? "Unknown source";
    }

    function getObservationCategory(item) {
        const category = String(
            firstDefined(
                item?.category,
                item?.type,
                item?.group
            ) ?? ""
        ).toLowerCase();

        if (category.includes("inflation") || category.includes("cpi")) {
            return "inflation";
        }

        if (category.includes("gold")) {
            return "gold";
        }

        if (category.includes("currency") || category.includes("exchange")) {
            return "currency";
        }

        if (category.includes("econom") || category.includes("gdp")) {
            return "economy";
        }

        return category || "other";
    }

    function normalizeCurrency(item) {
        if (!item || typeof item !== "object") return null;

        const code = String(
            firstDefined(item.code, item.currency, item.currencyCode, "")
        ).toUpperCase();

        const rate = toNumber(
            firstDefined(item.rate, item.mid, item.value, item.price)
        );

        if (!code || rate === null) return null;

        return {
            code,
            name: firstDefined(
                item.name,
                item.currencyName,
                CURRENCY_NAMES[code],
                code
            ),
            rate,
            date: getObservationDate(item),
            source: getObservationSource(item)
        };
    }

    function normalizeObservation(item) {
        if (!item || typeof item !== "object") return null;

        const value = getObservationValue(item);

        if (value === null) return null;

        return {
            name: getObservationName(item),
            country: firstDefined(
                item.countryCode,
                item.country_code,
                item.geo,
                item.country,
                "—"
            ),
            countryName: getObservationCountry(item),
            value,
            unit: firstDefined(item.unit, item.unitLabel, "—"),
            date: getObservationDate(item),
            source: getObservationSource(item),
            category: getObservationCategory(item),
            description: firstDefined(
                item.description,
                item.note,
                ""
            ),
            raw: item
        };
    }

    function normalizeArray(value) {
        if (Array.isArray(value)) return value;

        if (value && typeof value === "object") {
            return Object.values(value);
        }

        return [];
    }

    function normalizeDashboard(dashboard) {
        if (!dashboard || typeof dashboard !== "object") {
            throw new Error("The data source returned an invalid response.");
        }

        const currenciesRaw = normalizeArray(
            dashboard.currencies
        );

        const observationsRaw = normalizeArray(
            dashboard.observations
        );

        const currencies = currenciesRaw
            .map(normalizeCurrency)
            .filter(Boolean);

        const observations = observationsRaw
            .map(normalizeObservation)
            .filter(Boolean);

        const history =
            dashboard.history && typeof dashboard.history === "object"
                ? dashboard.history
                : {};

        const sources =
            dashboard.sources && typeof dashboard.sources === "object"
                ? dashboard.sources
                : {};

        return {
            original: dashboard,
            currencies,
            observations,
            history,
            sources,
            errors: normalizeArray(dashboard.errors),
            gold: dashboard.gold ?? null,
            inflation: dashboard.inflation ?? null,
            generatedAt: dashboard.generatedAt ?? null,
            lastCheckedAt: dashboard.lastCheckedAt ?? null
        };
    }


    /* ========================================================
       4. DATA ENGINE
       ======================================================== */

    function getDataEngine() {
        if (!window.ArchiveData) {
            throw new Error(
                "ArchiveData was not found. Check that data.js loads before script.js."
            );
        }

        if (typeof window.ArchiveData.loadDashboard !== "function") {
            throw new Error(
                "The data engine does not contain loadDashboard()."
            );
        }

        return window.ArchiveData;
    }

    async function loadDashboard(options = {}) {
        if (state.loading && !options.force) {
            return;
        }

        state.loading = true;

        setStatus(
            "connection-status",
            "Updating",
            "loading"
        );

        setStatus(
            "sidebar-system-status",
            "Checking",
            "loading"
        );

        try {
            const engine = getDataEngine();

            if (options.force && typeof engine.clearCache === "function") {
                engine.clearCache();
            }

            const result = await engine.loadDashboard();

            const normalized = normalizeDashboard(result);

            state.dashboard = normalized.original;
            state.currencies = normalized.currencies;
            state.observations = normalized.observations;
            state.history = normalized.history;
            state.sources = normalized.sources;
            state.errors = normalized.errors;
            state.gold = normalized.gold;
            state.inflation = normalized.inflation;

            state.lastSuccessfulLoad = new Date();

            renderEverything();

            const hasData =
                state.currencies.length > 0 ||
                state.observations.length > 0 ||
                state.gold !== null;

            setStatus(
                "connection-status",
                hasData ? "Connected" : "No data",
                hasData ? "success" : "warning"
            );

            setStatus(
                "sidebar-system-status",
                hasData ? "Operational" : "Limited",
                hasData ? "success" : "warning"
            );

            setText(
                "last-update-time",
                formatDateTime(
                    normalized.lastCheckedAt ||
                    normalized.generatedAt ||
                    state.lastSuccessfulLoad
                )
            );

            setText(
                "overview-data-date",
                `Checked: ${formatDateTime(
                    normalized.lastCheckedAt ||
                    normalized.generatedAt ||
                    state.lastSuccessfulLoad
                )}`
            );

            setText(
                "source-monitor-status",
                hasData ? "Sources checked" : "No observations"
            );

            if (state.errors.length > 0) {
                console.warn(
                    "[Monetary Archive] Data source warnings:",
                    state.errors
                );
            }

        } catch (error) {
            console.error(
                "[Monetary Archive] Data loading failed:",
                error
            );

            setStatus(
                "connection-status",
                "Connection error",
                "error"
            );

            setStatus(
                "sidebar-system-status",
                "Unavailable",
                "error"
            );

            setText(
                "overview-data-date",
                "Data unavailable"
            );

            showDataError(error.message);

        } finally {
            state.loading = false;
        }
    }

    function showDataError(message) {
        const target = byId("overview-chart-note");

        if (target) {
            target.textContent =
                `Data could not be loaded: ${message}`;
        }

        setText(
            "statistics-table-status",
            "Source unavailable"
        );

        setText(
            "archive-status",
            "Source unavailable"
        );
    }


    /* ========================================================
       5. NAVIGATION
       ======================================================== */

    function navigateTo(pageName) {
        if (!PAGE_NAMES[pageName]) return;

        state.currentPage = pageName;

        $$(".nav-link").forEach(button => {
            const active =
                button.dataset.page === pageName;

            button.classList.toggle("active", active);

            if (active) {
                button.setAttribute("aria-current", "page");
            } else {
                button.removeAttribute("aria-current");
            }
        });

        $$(".page-section").forEach(section => {
            const active =
                section.dataset.section === pageName;

            section.classList.toggle("active", active);
        });

        setText(
            "breadcrumb-current",
            PAGE_NAMES[pageName]
        );

        closeMobileSidebar();

        if (pageName === "statistics") {
            renderStatistics();
        }

        if (pageName === "inflation") {
            renderInflation();
        }

        if (pageName === "markets") {
            renderMarkets();
        }

        if (pageName === "archive") {
            renderArchive();
        }

        if (pageName === "overview") {
            renderOverview();
        }
    }

    function openMobileSidebar() {
        const sidebar = byId("sidebar");
        const overlay = byId("sidebar-overlay");

        sidebar?.classList.add("open");
        overlay?.classList.add("visible");

        document.body.classList.add("sidebar-open");
    }

    function closeMobileSidebar() {
        const sidebar = byId("sidebar");
        const overlay = byId("sidebar-overlay");

        sidebar?.classList.remove("open");
        overlay?.classList.remove("visible");

        document.body.classList.remove("sidebar-open");
    }


    /* ========================================================
       6. CLOCK
       ======================================================== */

    function updateClock() {
        const now = new Date();

        setText(
            "live-clock",
            new Intl.DateTimeFormat(CONFIG.locale, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false
            }).format(now)
        );
    }


    /* ========================================================
       7. OVERVIEW
       ======================================================== */

    function findCurrency(code) {
        return state.currencies.find(
            currency => currency.code === code
        ) || null;
    }

    function getGoldValue() {
        if (!state.gold) return null;

        if (typeof state.gold === "number") {
            return state.gold;
        }

        return toNumber(
            firstDefined(
                state.gold.price,
                state.gold.value,
                state.gold.rate,
                state.gold.gold,
                state.gold.mid
            )
        );
    }

    function findInflation(countryCode) {
        const observations = state.observations.filter(item => {
            return (
                item.category === "inflation" &&
                item.country === countryCode
            );
        });

        observations.sort((a, b) => {
            return String(b.date).localeCompare(String(a.date));
        });

        return observations[0] || null;
    }

    function renderOverview() {
        const usd = findCurrency("USD");
        const eur = findCurrency("EUR");
        const gold = getGoldValue();

        const usInflation = findInflation("US");

        setText(
            "overview-usd",
            usd ? formatMoney(usd.rate) : "—"
        );

        setText(
            "overview-eur",
            eur ? formatMoney(eur.rate) : "—"
        );

        setText(
            "overview-gold",
            gold !== null ? formatMoney(gold) : "—"
        );

        setText(
            "overview-us-inflation",
            usInflation ? formatPercent(usInflation.value) : "—"
        );

        setText(
            "usd-status",
            usd ? formatDate(usd.date) : "Unavailable"
        );

        setText(
            "eur-status",
            eur ? formatDate(eur.date) : "Unavailable"
        );

        setText(
            "gold-status",
            gold !== null ? "Official quotation" : "Unavailable"
        );

        setText(
            "us-inflation-status",
            usInflation ? formatDate(usInflation.date) : "Unavailable"
        );

        renderOverviewTable();
        renderOverviewChart();
        renderSourceMonitor();
    }

    function renderOverviewTable() {
        const body = byId("overview-recent-table");

        if (!body) return;

        const records = [...state.observations]
            .sort((a, b) =>
                String(b.date).localeCompare(String(a.date))
            )
            .slice(0, 8);

        if (!records.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">
                        No official observations are currently available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td>${escapeHTML(item.name)}</td>
                <td>${escapeHTML(item.countryName)}</td>
                <td>${escapeHTML(formatNumber(item.value, 2))}</td>
                <td>${escapeHTML(formatDate(item.date))}</td>
                <td>${escapeHTML(item.source)}</td>
                <td>
                    <span class="status status-success">
                        Published
                    </span>
                </td>
            </tr>
        `).join("");
    }

    function renderSourceMonitor() {
        const sourceElements = {
            NBP: "source-nbp-status",
            Eurostat: "source-eurostat-status",
            WorldBank: "source-worldbank-status",
            "World Bank": "source-worldbank-status"
        };

        Object.entries(sourceElements).forEach(([key, id]) => {
            const source = state.sources[key];

            if (!source) return;

            const status = firstDefined(
                source.status,
                source.state,
                source.message
            );

            if (status) {
                setText(id, status);
            }
        });
    }

    function getHistoryPoints(value) {
        if (Array.isArray(value)) {
            return value;
        }

        if (value && Array.isArray(value.data)) {
            return value.data;
        }

        if (value && Array.isArray(value.rates)) {
            return value.rates;
        }

        return [];
    }

    function renderOverviewChart() {
        if (typeof Chart === "undefined") return;

        const canvas = byId("overview-chart");

        if (!canvas) return;

        const usdPoints = getHistoryPoints(
            state.history.USD
        );

        const eurPoints = getHistoryPoints(
            state.history.EUR
        );

        const usdMap = new Map(
            usdPoints.map(point => [
                getObservationDate(point),
                getObservationValue(point)
            ])
        );

        const eurMap = new Map(
            eurPoints.map(point => [
                getObservationDate(point),
                getObservationValue(point)
            ])
        );

        const dates = Array.from(
            new Set([
                ...usdMap.keys(),
                ...eurMap.keys()
            ])
        )
            .filter(Boolean)
            .sort();

        if (!dates.length) {
            setText(
                "overview-chart-note",
                "No historical currency observations are currently available."
            );

            return;
        }

        createChart("overview", canvas, {
            type: "line",

            data: {
                labels: dates.map(formatDate),

                datasets: [
                    {
                        label: "USD / PLN",
                        data: dates.map(date =>
                            usdMap.get(date) ?? null
                        ),
                        borderColor: "#b99a65",
                        backgroundColor: "rgba(185,154,101,0.08)",
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.25,
                        spanGaps: true
                    },
                    {
                        label: "EUR / PLN",
                        data: dates.map(date =>
                            eurMap.get(date) ?? null
                        ),
                        borderColor: "#9a5360",
                        backgroundColor: "rgba(154,83,96,0.08)",
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.25,
                        spanGaps: true
                    }
                ]
            },

            options: standardChartOptions("PLN")
        });

        setText(
            "overview-chart-note",
            `${dates.length} historical observations available.`
        );
    }


    /* ========================================================
       8. CHART ENGINE
       ======================================================== */

    function standardChartOptions(axisLabel = "") {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: CONFIG.chartAnimation,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    backgroundColor: "#171310",
                    titleColor: "#e8dfd0",
                    bodyColor: "#c6bba9",
                    borderColor: "rgba(185,154,101,0.25)",
                    borderWidth: 1,
                    padding: 12
                }
            },

            scales: {
                x: {
                    grid: {
                        color: "rgba(185,154,101,0.07)"
                    },

                    ticks: {
                        color: "#928779",
                        maxTicksLimit: 8
                    }
                },

                y: {
                    grid: {
                        color: "rgba(185,154,101,0.07)"
                    },

                    ticks: {
                        color: "#928779"
                    },

                    title: {
                        display: Boolean(axisLabel),
                        text: axisLabel,
                        color: "#928779"
                    }
                }
            }
        };
    }

    function createChart(name, canvas, configuration) {
        if (typeof Chart === "undefined" || !canvas) {
            return null;
        }

        if (state.charts[name]) {
            state.charts[name].destroy();
        }

        state.charts[name] = new Chart(
            canvas.getContext("2d"),
            configuration
        );

        return state.charts[name];
    }


    /* ========================================================
       9. STATISTICS
       ======================================================== */

    function getFilteredStatistics() {
        const search = (
            byId("statistics-search")?.value || ""
        ).trim().toLowerCase();

        const country =
            byId("statistics-country")?.value || "all";

        const category =
            byId("statistics-category")?.value || "all";

        const source =
            byId("statistics-source")?.value || "all";

        return state.observations.filter(item => {
            const searchable = [
                item.name,
                item.countryName,
                item.country,
                item.source,
                item.category,
                item.unit,
                item.date
            ].join(" ").toLowerCase();

            if (search && !searchable.includes(search)) {
                return false;
            }

            if (
                country !== "all" &&
                item.country !== country
            ) {
                return false;
            }

            if (
                category !== "all" &&
                item.category !== category
            ) {
                return false;
            }

            if (
                source !== "all" &&
                item.source.toLowerCase() !== source.toLowerCase()
            ) {
                return false;
            }

            return true;
        });
    }

    function renderStatistics() {
        const records = getFilteredStatistics();

        const countries = new Set(
            state.observations.map(item => item.country)
        );

        const sources = new Set(
            state.observations.map(item => item.source)
        );

        setText(
            "statistics-count",
            state.observations.length
        );

        setText(
            "statistics-countries",
            countries.size
        );

        setText(
            "statistics-sources",
            sources.size
        );

        setText(
            "statistics-table-status",
            `${records.length} records`
        );

        setText(
            "statistics-results-count",
            `${records.length} matching observations`
        );

        renderStatisticsTable(records);
    }

    function renderStatisticsTable(records) {
        const body = byId("statistics-table-body");

        if (!body) return;

        if (!records.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">
                        No observations match the selected filters.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = records
            .slice(0, CONFIG.maximumTableRows)
            .map((item, index) => `
                <tr
                    class="selectable-row"
                    data-observation-index="${index}"
                    tabindex="0"
                >
                    <td>${escapeHTML(item.name)}</td>
                    <td>${escapeHTML(item.countryName)}</td>
                    <td>${escapeHTML(formatNumber(item.value, 2))}</td>
                    <td>${escapeHTML(item.unit)}</td>
                    <td>${escapeHTML(formatDate(item.date))}</td>
                    <td>${escapeHTML(item.source)}</td>
                </tr>
            `).join("");

        $$("#statistics-table-body tr[data-observation-index]")
            .forEach(row => {
                const selectRow = () => {
                    const index = Number(
                        row.dataset.observationIndex
                    );

                    selectObservation(records[index]);
                };

                row.addEventListener("click", selectRow);

                row.addEventListener("keydown", event => {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        selectRow();
                    }
                });
            });
    }

    function selectObservation(item) {
        if (!item) return;

        state.selectedObservation = item;

        const container = byId("statistics-detail");

        if (!container) return;

        container.innerHTML = `
            <div class="stack">
                <div>
                    <div class="panel-kicker">Indicator</div>
                    <h3 class="panel-title">
                        ${escapeHTML(item.name)}
                    </h3>
                </div>

                <div class="stat-value">
                    ${escapeHTML(formatNumber(item.value, 3))}
                </div>

                <div class="source-list">
                    <div class="source-item">
                        <div>
                            <div class="source-name">Country</div>
                            <div class="source-description">
                                ${escapeHTML(item.countryName)}
                            </div>
                        </div>
                    </div>

                    <div class="source-item">
                        <div>
                            <div class="source-name">Unit</div>
                            <div class="source-description">
                                ${escapeHTML(item.unit)}
                            </div>
                        </div>
                    </div>

                    <div class="source-item">
                        <div>
                            <div class="source-name">Observation date</div>
                            <div class="source-description">
                                ${escapeHTML(formatDate(item.date))}
                            </div>
                        </div>
                    </div>

                    <div class="source-item">
                        <div>
                            <div class="source-name">Original source</div>
                            <div class="source-description">
                                ${escapeHTML(item.source)}
                            </div>
                        </div>
                    </div>
                </div>

                ${
                    item.description
                        ? `<div class="notice">
                            <div class="notice-text">
                                ${escapeHTML(item.description)}
                            </div>
                           </div>`
                        : ""
                }
            </div>
        `;
    }


    /* ========================================================
       10. INFLATION
       ======================================================== */

    function getInflationRecords() {
        return state.observations.filter(
            item => item.category === "inflation"
        );
    }

    function renderInflation() {
        const records = getInflationRecords();

        const latestByCountry = {};

        records.forEach(item => {
            const country = item.country;

            if (
                !latestByCountry[country] ||
                String(item.date) >
                String(latestByCountry[country].date)
            ) {
                latestByCountry[country] = item;
            }
        });

        setText(
            "inflation-poland",
            latestByCountry.PL
                ? formatPercent(latestByCountry.PL.value)
                : "—"
        );

        setText(
            "inflation-us",
            latestByCountry.US
                ? formatPercent(latestByCountry.US.value)
                : "—"
        );

        setText(
            "inflation-eu",
            latestByCountry.EU
                ? formatPercent(latestByCountry.EU.value)
                : "—"
        );

        renderInflationTable(records);
        renderInflationChart(latestByCountry);
    }

    function renderInflationTable(records) {
        const body = byId("inflation-table-body");

        if (!body) return;

        if (!records.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty">
                        No official inflation observations are available.
                    </td>
                </tr>
            `;

            return;
        }

        body.innerHTML = records.map(item => `
            <tr>
                <td>${escapeHTML(item.countryName)}</td>
                <td>${escapeHTML(item.name)}</td>
                <td>${escapeHTML(formatPercent(item.value))}</td>
                <td>${escapeHTML(formatDate(item.date))}</td>
                <td>${escapeHTML(item.source)}</td>
            </tr>
        `).join("");
    }

    function renderInflationChart(latestByCountry) {
        if (typeof Chart === "undefined") return;

        const canvas = byId("inflation-chart");

        if (!canvas) return;

        const entries = [
            ["PL", "Poland"],
            ["US", "United States"],
            ["EU", "European Union"]
        ].filter(([code]) => latestByCountry[code]);

        if (!entries.length) {
            setText(
                "inflation-chart-status",
                "No observations"
            );

            return;
        }

        createChart("inflation", canvas, {
            type: "bar",

            data: {
                labels: entries.map(([, name]) => name),

                datasets: [{
                    label: "Annual inflation",
                    data: entries.map(
                        ([code]) => latestByCountry[code].value
                    ),
                    backgroundColor: [
                        "#9a5360",
                        "#b99a65",
                        "#71675d"
                    ],
                    borderWidth: 0,
                    borderRadius: 3
                }]
            },

            options: {
                ...standardChartOptions("%"),
                plugins: {
                    ...standardChartOptions("%").plugins,
                    legend: {
                        display: false
                    }
                }
            }
        });

        setText(
            "inflation-chart-status",
            `${entries.length} observations`
        );
    }


    /* ========================================================
       11. MARKETS
       ======================================================== */

    function renderMarkets() {
        const usd = findCurrency("USD");
        const eur = findCurrency("EUR");
        const gold = getGoldValue();

        setText(
            "market-usd",
            usd ? formatMoney(usd.rate) : "—"
        );

        setText(
            "market-eur",
            eur ? formatMoney(eur.rate) : "—"
        );

        setText(
            "market-gold",
            gold !== null ? formatMoney(gold) : "—"
        );

        setText(
            "market-usd-date",
            usd ? `Observation: ${formatDate(usd.date)}` : "No observation"
        );

        setText(
            "market-eur-date",
            eur ? `Observation: ${formatDate(eur.date)}` : "No observation"
        );

        setText(
            "market-gold-date",
            state.gold?.date
                ? `Observation: ${formatDate(state.gold.date)}`
                : "No observation"
        );

        setText(
            "market-gold-large",
            gold !== null ? formatMoney(gold) : "—"
        );

        setText(
            "market-gold-large-date",
            state.gold?.date
                ? `Official observation: ${formatDate(state.gold.date)}`
                : "Waiting for source"
        );

        renderCurrencyTable();
        renderMarketHistory();
    }

    function renderCurrencyTable() {
        const body = byId("market-currency-table");

        if (!body) return;

        if (!state.currencies.length) {
            body.innerHTML = `
                <tr>
                    <td colspan="4" class="table-empty">
                        No official currency quotations are available.
                    </td>
                </tr>
            `;

            setText(
                "market-currency-status",
                "No quotations"
            );

            return;
        }

        body.innerHTML = state.currencies.map(currency => `
            <tr>
                <td>${escapeHTML(currency.name)}</td>
                <td>${escapeHTML(currency.code)}</td>
                <td>${escapeHTML(formatNumber(currency.rate, 4))} PLN</td>
                <td>${escapeHTML(formatDate(currency.date))}</td>
            </tr>
        `).join("");

        setText(
            "market-currency-status",
            `${state.currencies.length} quotations`
        );
    }

    async function loadMarketHistory() {
        const engine = getDataEngine();

        if (typeof engine.loadCurrencyHistory !== "function") {
            setText(
                "market-history-note",
                "Historical currency data is not supported by the data engine."
            );

            return;
        }

        const currency =
            byId("market-history-currency")?.value || "USD";

        const days = Number(
            byId("market-history-period")?.value || 30
        );

        const requestId = ++state.historyRequestId;

        setText(
            "market-history-note",
            "Loading historical observations..."
        );

        try {
            const result = await engine.loadCurrencyHistory(
                currency,
                days
            );

            if (requestId !== state.historyRequestId) return;

            const points = getHistoryPoints(result);

            renderMarketHistory(points, currency);

        } catch (error) {
            console.error(
                "[Monetary Archive] History loading failed:",
                error
            );

            setText(
                "market-history-note",
                "Historical data could not be loaded. Please try again."
            );
        }
    }

    function renderMarketHistory(points = null, currency = null) {
        if (typeof Chart === "undefined") return;

        const canvas = byId("market-history-chart");

        if (!canvas) return;

        const selectedCurrency =
            currency ||
            byId("market-history-currency")?.value ||
            "USD";

        let data = points;

        if (!data) {
            data = getHistoryPoints(
                state.history[selectedCurrency]
            );
        }

        if (!data.length) {
            setText(
                "market-history-note",
                "No historical observations are available for this instrument."
            );

            return;
        }

        const sorted = [...data].sort((a, b) => {
            return String(getObservationDate(a))
                .localeCompare(String(getObservationDate(b)));
        });

        createChart("marketHistory", canvas, {
            type: "line",

            data: {
                labels: sorted.map(point =>
                    formatDate(getObservationDate(point))
                ),

                datasets: [{
                    label: `${selectedCurrency} / PLN`,
                    data: sorted.map(getObservationValue),
                    borderColor: "#b99a65",
                    backgroundColor: "rgba(185,154,101,0.08)",
                    borderWidth: 2,
                    pointRadius: 1,
                    pointHoverRadius: 4,
                    tension: 0.2,
                    fill: true
                }]
            },

            options: standardChartOptions("PLN")
        });

        setText(
            "market-history-note",
            `${sorted.length} observations · ${selectedCurrency} / PLN`
        );
    }


    /* ========================================================
       12. CALCULATORS
       ======================================================== */

    function readInput(id) {
        const element = byId(id);

        if (!element) return null;

        return toNumber(element.value);
    }

    function showCalculationResult(resultId, noteId, value, note) {
        setText(resultId, value);
        setText(noteId, note);
    }

    function calculateCurrency() {
        const amount = readInput("currency-amount");
        const rate = readInput("currency-rate");

        const from = byId("currency-from")?.value || "PLN";
        const to = byId("currency-to")?.value || "USD";

        if (amount === null || rate === null) {
            showCalculationResult(
                "currency-result",
                "currency-result-note",
                "—",
                "Enter a valid amount and exchange rate."
            );

            return;
        }

        if (amount < 0 || rate <= 0) {
            showCalculationResult(
                "currency-result",
                "currency-result-note",
                "—",
                "The amount cannot be negative and the rate must be positive."
            );

            return;
        }

        const result = amount * rate;

        showCalculationResult(
            "currency-result",
            "currency-result-note",
            formatNumber(result, 4),
            `${formatNumber(amount, 2)} ${from} converted to ${to}.`
        );
    }

    function updateCurrencyRate() {
        const from = byId("currency-from")?.value || "PLN";
        const to = byId("currency-to")?.value || "USD";

        const rateInput = byId("currency-rate");
        const note = byId("currency-rate-note");

        if (!rateInput) return;

        if (from === to) {
            rateInput.value = "1";

            if (note) {
                note.textContent = "Same currency: conversion rate is 1.";
            }

            return;
        }

        const fromRate =
            from === "PLN"
                ? 1
                : findCurrency(from)?.rate;

        const toRate =
            to === "PLN"
                ? 1
                : findCurrency(to)?.rate;

        if (
            !isValidNumber(fromRate) ||
            !isValidNumber(toRate) ||
            Number(fromRate) <= 0
        ) {
            rateInput.value = "";

            if (note) {
                note.textContent =
                    "An official rate for this currency pair is unavailable. Enter a rate manually.";
            }

            return;
        }

        const calculatedRate =
            Number(fromRate) / Number(toRate);

        rateInput.value = calculatedRate.toFixed(8);

        if (note) {
            note.textContent =
                `Calculated from official PLN reference rates. ${from} → ${to}.`;
        }
    }

    function calculateInflation() {
        const amount = readInput("inflation-amount");
        const rate = readInput("inflation-rate");
        const years = readInput("inflation-years");

        if (
            amount === null ||
            rate === null ||
            years === null ||
            amount < 0 ||
            years < 0 ||
            years > 200 ||
            rate <= -100
        ) {
            showCalculationResult(
                "inflation-result",
                "inflation-result-note",
                "—",
                "Check the amount, inflation rate and number of years."
            );

            return;
        }

        const result =
            amount * Math.pow(1 + rate / 100, years);

        const difference = result - amount;

        showCalculationResult(
            "inflation-result",
            "inflation-result-note",
            formatMoney(result),
            `Estimated equivalent amount. Difference: ${formatMoney(difference)} over ${years} years.`
        );
    }

    function calculateCompound() {
        const principal = readInput("compound-principal");
        const rate = readInput("compound-rate");
        const years = readInput("compound-years");

        const frequency = Number(
            byId("compound-frequency")?.value || 12
        );

        if (
            principal === null ||
            rate === null ||
            years === null ||
            principal < 0 ||
            years < 0 ||
            years > 200 ||
            rate <= -100 ||
            frequency <= 0
        ) {
            showCalculationResult(
                "compound-result",
                "compound-result-note",
                "—",
                "Check the principal, rate, period and compounding frequency."
            );

            return;
        }

        const result =
            principal *
            Math.pow(
                1 + rate / 100 / frequency,
                frequency * years
            );

        const growth = result - principal;

        showCalculationResult(
            "compound-result",
            "compound-result-note",
            formatMoney(result),
            `Projected mathematical growth: ${formatMoney(growth)}.`
        );
    }

    function calculatePercentage() {
        const oldValue = readInput("percentage-old");
        const newValue = readInput("percentage-new");

        if (
            oldValue === null ||
            newValue === null ||
            oldValue === 0
        ) {
            showCalculationResult(
                "percentage-result",
                "percentage-result-note",
                "—",
                "Enter two valid values. The original value cannot be zero."
            );

            return;
        }

        const change =
            ((newValue - oldValue) / Math.abs(oldValue)) * 100;

        const direction =
            change > 0
                ? "Increase"
                : change < 0
                    ? "Decrease"
                    : "No change";

        showCalculationResult(
            "percentage-result",
            "percentage-result-note",
            formatPercent(change),
            `${direction}: ${formatNumber(oldValue)} → ${formatNumber(newValue)}.`
        );
    }

    function switchCalculator() {
        const type =
            byId("calculator-type")?.value || "currency";

        $$(".calculator-panel").forEach(panel => {
            const active =
                panel.id === `calculator-${type}`;

            panel.classList.toggle("hidden", !active);
        });
    }


    /* ========================================================
       13. HISTORICAL ARCHIVE
       ======================================================== */

    function getFilteredArchive() {
        const search = (
            byId("archive-search")?.value || ""
        ).trim().toLowerCase();

        const country =
            byId("archive-country")?.value || "all";

        const category =
            byId("archive-category")?.value || "all";

        return state.observations.filter(item => {
            const searchable = [
                item.name,
                item.countryName,
                item.country,
                item.source,
                item.category,
                item.date
            ].join(" ").toLowerCase();

            if (search && !searchable.includes(search)) {
                return false;
            }

            if (
                country !== "all" &&
                item.country !== country
            ) {
                return false;
            }

            if (
                category !== "all" &&
                item.category !== category
            ) {
                return false;
            }

            return true;
        });
    }

    function renderArchive() {
        const records = getFilteredArchive();

        const container = byId("archive-list");

        if (!container) return;

        setText(
            "archive-record-count",
            `${records.length} records`
        );

        setText(
            "archive-status",
            records.length
                ? `${records.length} records`
                : "No records"
        );

        if (!records.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-title">
                        No historical records found
                    </div>

                    <div class="empty-state-description">
                        Try changing the search term or filters.
                    </div>
                </div>
            `;

            return;
        }

        container.innerHTML = records
            .slice(0, CONFIG.maximumTableRows)
            .map(item => `
                <article class="archive-entry">
                    <div class="archive-entry-main">
                        <div class="panel-kicker">
                            ${escapeHTML(item.category)}
                        </div>

                        <div class="archive-entry-title">
                            ${escapeHTML(item.name)}
                        </div>

                        <div class="archive-entry-meta">
                            ${escapeHTML(item.countryName)}
                            ·
                            ${escapeHTML(formatDate(item.date))}
                            ·
                            ${escapeHTML(item.source)}
                        </div>
                    </div>

                    <div class="archive-entry-value">
                        ${escapeHTML(formatNumber(item.value, 3))}
                        <span>${escapeHTML(item.unit)}</span>
                    </div>
                </article>
            `).join("");
    }


    /* ========================================================
       14. CSV EXPORT
       ======================================================== */

    function csvEscape(value) {
        const text = String(value ?? "");

        return `"${text.replace(/"/g, '""')}"`;
    }

    function downloadCSV(filename, rows) {
        if (!rows.length) {
            alert("There are no records available to export.");
            return;
        }

        const csv = rows
            .map(row => row.map(csvEscape).join(","))
            .join("\r\n");

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

    function exportObservations(filename, records) {
        const rows = [
            [
                "Indicator",
                "Country",
                "Value",
                "Unit",
                "Observation date",
                "Source",
                "Category"
            ]
        ];

        records.forEach(item => {
            rows.push([
                item.name,
                item.countryName,
                item.value,
                item.unit,
                item.date,
                item.source,
                item.category
            ]);
        });

        downloadCSV(filename, rows);
    }

    function exportStatistics() {
        exportObservations(
            "monetary-archive-statistics.csv",
            getFilteredStatistics()
        );
    }

    function exportInflation() {
        exportObservations(
            "monetary-archive-inflation.csv",
            getInflationRecords()
        );
    }

    function exportArchive() {
        exportObservations(
            "monetary-archive-historical-records.csv",
            getFilteredArchive()
        );
    }


    /* ========================================================
       15. EVENT LISTENERS
       ======================================================== */

    function bindNavigation() {
        $$(".nav-link[data-page]").forEach(button => {
            button.addEventListener("click", () => {
                navigateTo(button.dataset.page);
            });
        });

        $$("[data-navigate]").forEach(button => {
            button.addEventListener("click", () => {
                navigateTo(button.dataset.navigate);
            });
        });

        byId("mobile-menu-button")
            ?.addEventListener("click", openMobileSidebar);

        byId("sidebar-overlay")
            ?.addEventListener("click", closeMobileSidebar);

        document.addEventListener("keydown", event => {
            if (event.key === "Escape") {
                closeMobileSidebar();
            }
        });
    }

    function bindRefreshButtons() {
        const refresh = () => loadDashboard({
            force: true
        });

        byId("refresh-button")
            ?.addEventListener("click", refresh);

        byId("overview-refresh-button")
            ?.addEventListener("click", refresh);

        byId("markets-refresh-button")
            ?.addEventListener("click", refresh);
    }

    function bindStatistics() {
        [
            "statistics-search",
            "statistics-country",
            "statistics-category",
            "statistics-source"
        ].forEach(id => {
            byId(id)?.addEventListener("input", renderStatistics);
            byId(id)?.addEventListener("change", renderStatistics);
        });

        byId("statistics-export-button")
            ?.addEventListener("click", exportStatistics);
    }

    function bindInflation() {
        byId("inflation-export-button")
            ?.addEventListener("click", exportInflation);
    }

    function bindMarkets() {
        byId("market-history-load")
            ?.addEventListener("click", loadMarketHistory);

        byId("market-history-currency")
            ?.addEventListener("change", loadMarketHistory);

        byId("market-history-period")
            ?.addEventListener("change", loadMarketHistory);
    }

    function bindArchive() {
        byId("archive-search")
            ?.addEventListener("input", renderArchive);

        byId("archive-country")
            ?.addEventListener("change", renderArchive);

        byId("archive-category")
            ?.addEventListener("change", renderArchive);

        byId("archive-export-button")
            ?.addEventListener("click", exportArchive);
    }

    function bindCalculators() {
        byId("calculator-type")
            ?.addEventListener("change", switchCalculator);

        byId("currency-calculate")
            ?.addEventListener("click", calculateCurrency);

        byId("inflation-calculate")
            ?.addEventListener("click", calculateInflation);

        byId("compound-calculate")
            ?.addEventListener("click", calculateCompound);

        byId("percentage-calculate")
            ?.addEventListener("click", calculatePercentage);

        byId("currency-from")
            ?.addEventListener("change", updateCurrencyRate);

        byId("currency-to")
            ?.addEventListener("change", updateCurrencyRate);

        byId("currency-amount")
            ?.addEventListener("input", calculateCurrency);

        byId("currency-rate")
            ?.addEventListener("input", calculateCurrency);

        byId("inflation-amount")
            ?.addEventListener("input", calculateInflation);

        byId("inflation-rate")
            ?.addEventListener("input", calculateInflation);

        byId("inflation-years")
            ?.addEventListener("input", calculateInflation);

        byId("compound-principal")
            ?.addEventListener("input", calculateCompound);

        byId("compound-rate")
            ?.addEventListener("input", calculateCompound);

        byId("compound-years")
            ?.addEventListener("input", calculateCompound);

        byId("compound-frequency")
            ?.addEventListener("change", calculateCompound);

        byId("percentage-old")
            ?.addEventListener("input", calculatePercentage);

        byId("percentage-new")
            ?.addEventListener("input", calculatePercentage);
    }


    /* ========================================================
       16. APPLICATION RENDERING
       ======================================================== */

    function renderEverything() {
        renderOverview();
        renderStatistics();
        renderInflation();
        renderMarkets();
        renderArchive();

        updateCurrencyRate();

        calculateCurrency();
        calculateInflation();
        calculateCompound();
        calculatePercentage();
    }


    /* ========================================================
       17. AUTOMATIC REFRESH
       ======================================================== */

    function startAutomaticRefresh() {
        if (state.refreshTimer) {
            clearInterval(state.refreshTimer);
        }

        state.refreshTimer = setInterval(() => {
            if (document.visibilityState === "visible") {
                loadDashboard();
            }
        }, CONFIG.refreshInterval);
    }

    document.addEventListener(
        "visibilitychange",
        () => {
            if (document.visibilityState === "visible") {
                updateClock();
            }
        }
    );


    /* ========================================================
       18. INITIALIZATION
       ======================================================== */

    function initializeApplication() {
        console.info(
            "%cTHE MONETARY ARCHIVE",
            "color:#b99a65;font-size:16px;font-weight:bold;"
        );

        console.info(
            "Financial Intelligence · Application initialized"
        );

        bindNavigation();
        bindRefreshButtons();
        bindStatistics();
        bindInflation();
        bindMarkets();
        bindArchive();
        bindCalculators();

        updateClock();
        setInterval(updateClock, CONFIG.clockInterval);

        switchCalculator();

        startAutomaticRefresh();

        loadDashboard();

        window.dispatchEvent(
            new CustomEvent("archive:application-ready")
        );
    }


    /* ========================================================
       19. PUBLIC APPLICATION INTERFACE
       ======================================================== */

    window.MonetaryArchive = Object.freeze({
        refresh: () => loadDashboard({ force: true }),

        navigate: navigateTo,

        getState: () => ({
            currentPage: state.currentPage,
            loading: state.loading,
            lastSuccessfulLoad: state.lastSuccessfulLoad,
            currencies: state.currencies.length,
            observations: state.observations.length,
            errors: [...state.errors]
        }),

        exportStatistics,
        exportInflation,
        exportArchive
    });


    /* ========================================================
       20. START
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
