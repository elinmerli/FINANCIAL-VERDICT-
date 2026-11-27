
/* ============================================================
   THE MONETARY ARCHIVE
   DATA ENGINE
   Version: 1.0.0

   Public data sources:
   - National Bank of Poland (NBP)
   - World Bank Indicators API
   - Eurostat Statistics API

   No API keys. No external server.
   ============================================================ */

(function () {
    "use strict";

    /* --------------------------------------------------------
       01. CONFIGURATION
       -------------------------------------------------------- */

    const CONFIG = {
        timeout: 15000,

        refreshInterval: 5 * 60 * 1000,

        currencyHistoryCount: 30,
        goldHistoryCount: 30,

        worldBankYears: 10,

        endpoints: {
            nbp: "https://api.nbp.pl/api",

            worldBank: "https://api.worldbank.org/v2",

            eurostat:
                "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data"
        },

        currencies: [
            "USD",
            "EUR",
            "GBP",
            "CHF",
            "JPY",
            "CAD",
            "AUD",
            "CZK",
            "SEK",
            "NOK",
            "DKK",
            "HUF"
        ],

        countries: {
            PL: {
                name: "Poland",
                worldBankCode: "POL"
            },

            US: {
                name: "United States",
                worldBankCode: "USA"
            }
        },

        indicators: {
            inflation: {
                code: "FP.CPI.TOTL.ZG",
                name: "Inflation, consumer prices"
            },

            gdpGrowth: {
                code: "NY.GDP.MKTP.KD.ZG",
                name: "GDP growth"
            }
        }
    };


    /* --------------------------------------------------------
       02. INTERNAL STATE
       -------------------------------------------------------- */

    let dashboardCache = null;

    let lastSuccessfulDashboard = null;

    let lastRefreshTime = null;

    let refreshPromise = null;


    /* --------------------------------------------------------
       03. GENERAL HELPERS
       -------------------------------------------------------- */

    function nowISO() {
        return new Date().toISOString();
    }


    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    function isFiniteNumber(value) {
        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );
    }


    function toNumber(value) {
        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value === "string") {
            const parsed = Number(value);

            return Number.isFinite(parsed)
                ? parsed
                : null;
        }

        return null;
    }


    function formatDate(dateValue) {
        if (!dateValue) {
            return "—";
        }

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return String(dateValue);
        }

        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
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


    function formatNumber(value, digits = 4) {
        if (!isFiniteNumber(value)) {
            return "—";
        }

        return new Intl.NumberFormat("en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: digits
        }).format(value);
    }


    function safeArray(value) {
        return Array.isArray(value) ? value : [];
    }


    function errorMessage(error) {
        if (!error) {
            return "Unknown error";
        }

        if (error.name === "AbortError") {
            return "Request timed out";
        }

        return error.message || "Data source unavailable";
    }


    /* --------------------------------------------------------
       04. NETWORK REQUEST ENGINE
       -------------------------------------------------------- */

    async function requestJSON(url, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, CONFIG.timeout);

        try {
            const response = await fetch(url, {
                method: "GET",

                headers: {
                    "Accept": "application/json",
                    ...options.headers
                },

                cache: options.cache || "no-cache",

                signal: controller.signal
            });

            if (!response.ok) {
                const error = new Error(
                    `HTTP ${response.status}: ${response.statusText}`
                );

                error.status = response.status;

                throw error;
            }

            return await response.json();

        } finally {
            clearTimeout(timeout);
        }
    }


    function createSourceResult(
        name,
        status,
        data = null,
        error = null
    ) {
        return {
            name,

            status,

            data,

            error,

            checkedAt: nowISO()
        };
    }


    async function executeSource(name, callback) {
        const startedAt = Date.now();

        try {
            const data = await callback();

            return {
                name,

                status: "online",

                data,

                error: null,

                checkedAt: nowISO(),

                duration: Date.now() - startedAt
            };

        } catch (error) {
            return {
                name,

                status: "error",

                data: null,

                error: errorMessage(error),

                checkedAt: nowISO(),

                duration: Date.now() - startedAt
            };
        }
    }


    /* --------------------------------------------------------
       05. NATIONAL BANK OF POLAND
       CURRENCY TABLE
       -------------------------------------------------------- */

    async function getNBPCurrencyTable() {
        const url =
            `${CONFIG.endpoints.nbp}/exchangerates/tables/a/?format=json`;

        const response = await requestJSON(url);

        if (!Array.isArray(response) || !response.length) {
            throw new Error("NBP returned an empty currency table");
        }

        const table = response[0];

        if (!Array.isArray(table.rates)) {
            throw new Error("NBP currency table has no rates");
        }

        const rates = table.rates.map(rate => ({
            code: String(rate.code || "").toUpperCase(),

            name: rate.currency || "Unknown currency",

            value: toNumber(rate.mid),

            unit: "PLN",

            date: table.effectiveDate || null,

            source: "NBP",

            category: "currency",

            country: "PL",

            countryName: "Poland"
        })).filter(rate => (
            rate.code &&
            isFiniteNumber(rate.value)
        ));

        return {
            table: table.no || null,

            date: table.effectiveDate || null,

            rates
        };
    }


    /* --------------------------------------------------------
       06. NBP CURRENCY HISTORY
       -------------------------------------------------------- */

    async function getNBPCurrencyHistory(
        currencyCode = "USD",
        count = CONFIG.currencyHistoryCount
    ) {
        const code = String(currencyCode).toLowerCase();

        const safeCount = Math.max(
            1,
            Math.min(90, Number(count) || 30)
        );

        const url =
            `${CONFIG.endpoints.nbp}/exchangerates/rates/a/${encodeURIComponent(code)}/last/${safeCount}/?format=json`;

        const response = await requestJSON(url);

        if (!response || !Array.isArray(response.rates)) {
            throw new Error("Invalid NBP history response");
        }

        return {
            currency: code.toUpperCase(),

            table: response.table || "A",

            date: response.rates.length
                ? response.rates[response.rates.length - 1].effectiveDate
                : null,

            observations: response.rates.map(item => ({
                date: item.effectiveDate,

                value: toNumber(item.mid),

                source: "NBP"
            })).filter(item => (
                item.date &&
                isFiniteNumber(item.value)
            ))
        };
    }


    /* --------------------------------------------------------
       07. NBP GOLD PRICES
       -------------------------------------------------------- */

    async function getNBPGold() {
        const url =
            `${CONFIG.endpoints.nbp}/cenyzlota/?format=json`;

        const response = await requestJSON(url);

        if (!Array.isArray(response) || !response.length) {
            throw new Error("NBP returned no gold quotation");
        }

        const latest = response[0];

        const value = toNumber(latest.cena);

        if (!isFiniteNumber(value)) {
            throw new Error("Invalid NBP gold price");
        }

        return {
            value,

            date: latest.data || null,

            currency: "PLN",

            unit: "gram",

            source: "NBP"
        };
    }


    async function getNBPGoldHistory(
        count = CONFIG.goldHistoryCount
    ) {
        const safeCount = Math.max(
            1,
            Math.min(90, Number(count) || 30)
        );

        const url =
            `${CONFIG.endpoints.nbp}/cenyzlota/last/${safeCount}/?format=json`;

        const response = await requestJSON(url);

        if (!Array.isArray(response)) {
            throw new Error("Invalid NBP gold history response");
        }

        return response.map(item => ({
            date: item.data,

            value: toNumber(item.cena),

            source: "NBP"
        })).filter(item => (
            item.date &&
            isFiniteNumber(item.value)
        ));
    }


    /* --------------------------------------------------------
       08. WORLD BANK INDICATORS
       -------------------------------------------------------- */

    async function getWorldBankIndicator(
        countryCode,
        indicatorCode,
        years = CONFIG.worldBankYears
    ) {
        const country = String(countryCode).toLowerCase();

        const safeYears = Math.max(
            1,
            Math.min(30, Number(years) || 10)
        );

        const currentYear = new Date().getUTCFullYear();

        const startYear = currentYear - safeYears;

        const url =
            `${CONFIG.endpoints.worldBank}/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicatorCode)}` +
            `?format=json&date=${startYear}:${currentYear}&per_page=100`;

        const response = await requestJSON(url);

        if (
            !Array.isArray(response) ||
            !Array.isArray(response[1])
        ) {
            throw new Error(
                `World Bank returned no observations for ${countryCode}`
            );
        }

        return response[1]
            .filter(item => item.value !== null)
            .map(item => ({
                country: countryCode.toUpperCase(),

                countryName:
                    item.country?.value ||
                    countryCode.toUpperCase(),

                indicator: indicatorCode,

                indicatorName:
                    item.indicator?.value ||
                    indicatorCode,

                year: String(item.date),

                date: String(item.date),

                value: toNumber(item.value),

                unit: "%",

                source: "World Bank",

                category:
                    indicatorCode === CONFIG.indicators.inflation.code
                        ? "inflation"
                        : "economy"
            }))
            .filter(item => (
                isFiniteNumber(item.value)
            ))
            .sort((a, b) => (
                Number(b.year) - Number(a.year)
            ));
    }


    async function getWorldBankDashboard() {
        const tasks = [];

        for (const countryCode of Object.keys(CONFIG.countries)) {
            tasks.push({
                countryCode,

                indicator: "inflation",

                promise: getWorldBankIndicator(
                    countryCode,
                    CONFIG.indicators.inflation.code
                )
            });

            tasks.push({
                countryCode,

                indicator: "gdpGrowth",

                promise: getWorldBankIndicator(
                    countryCode,
                    CONFIG.indicators.gdpGrowth.code
                )
            });
        }

        const results = await Promise.allSettled(
            tasks.map(task => task.promise)
        );

        const observations = [];

        const failures = [];

        results.forEach((result, index) => {
            const task = tasks[index];

            if (result.status === "fulfilled") {
                observations.push(...result.value);
            } else {
                failures.push({
                    country: task.countryCode,

                    indicator: task.indicator,

                    error: errorMessage(result.reason)
                });
            }
        });

        if (!observations.length) {
            throw new Error(
                failures.length
                    ? failures.map(item => item.error).join("; ")
                    : "World Bank returned no usable observations"
            );
        }

        return {
            observations,

            failures
        };
    }


    /* --------------------------------------------------------
       09. EUROSTAT
       HICP ANNUAL RATE OF CHANGE
       -------------------------------------------------------- */

    function getEurostatTimeValues(data) {
        if (
            !data ||
            !data.dimension ||
            !data.dimension.time ||
            !data.dimension.time.category
        ) {
            return [];
        }

        const timeCategory = data.dimension.time.category;

        const index = timeCategory.index;

        if (Array.isArray(index)) {
            return index.map((period, position) => ({
                period,

                position
            }));
        }

        if (index && typeof index === "object") {
            return Object.entries(index)
                .map(([period, position]) => ({
                    period,

                    position: Number(position)
                }))
                .sort((a, b) => a.position - b.position);
        }

        return [];
    }


    function getEurostatValueEntries(data) {
        if (!data || !data.value) {
            return [];
        }

        if (Array.isArray(data.value)) {
            return data.value.map((value, index) => ({
                index,

                value
            }));
        }

        if (typeof data.value === "object") {
            return Object.entries(data.value).map(
                ([index, value]) => ({
                    index: Number(index),

                    value
                })
            );
        }

        return [];
    }


    function decodeEurostat(data, countryCode) {
        const timeValues = getEurostatTimeValues(data);

        const entries = getEurostatValueEntries(data);

        if (!timeValues.length || !entries.length) {
            return [];
        }

        const ids = safeArray(data.id);

        const sizes = safeArray(data.size);

        const timeDimensionPosition = ids.indexOf("time");

        if (timeDimensionPosition < 0) {
            return [];
        }

        const timeSize = sizes[timeDimensionPosition];

        if (!Number.isFinite(timeSize) || timeSize < 1) {
            return [];
        }

        let stride = 1;

        for (
            let i = timeDimensionPosition + 1;
            i < sizes.length;
            i++
        ) {
            stride *= sizes[i];
        }

        const timeByPosition = new Map(
            timeValues.map(item => [
                item.position,
                item.period
            ])
        );

        return entries.map(entry => {
            const numericIndex = Number(entry.index);

            const timePosition = Math.floor(
                numericIndex / stride
            ) % timeSize;

            const period = timeByPosition.get(timePosition);

            return {
                country: countryCode,

                countryName:
                    countryCode === "PL"
                        ? "Poland"
                        : "European Union",

                indicator: "HICP",

                indicatorName:
                    "Harmonised index of consumer prices — annual rate",

                year: period,

                date: period,

                value: toNumber(entry.value),

                unit: "%",

                source: "Eurostat",

                category: "inflation"
            };
        }).filter(item => (
            item.date &&
            isFiniteNumber(item.value)
        )).sort((a, b) => (
            String(b.date).localeCompare(String(a.date))
        ));
    }


    async function getEurostatInflation(countryCode) {
        const geo = countryCode === "EU"
            ? "EU27_2020"
            : countryCode;

        const params = new URLSearchParams();

        params.set("geo", geo);
        params.set("coicop", "CP00");
        params.set("unit", "RCH_A");
        params.set("sinceTimePeriod", "2020");
        params.set("lang", "en");

        const url =
            `${CONFIG.endpoints.eurostat}/prc_hicp_minr?${params.toString()}`;

        const response = await requestJSON(url);

        const observations = decodeEurostat(
            response,
            countryCode
        );

        if (!observations.length) {
            throw new Error(
                `Eurostat returned no usable HICP observations for ${geo}`
            );
        }

        return observations;
    }


    async function getEurostatDashboard() {
        const results = await Promise.allSettled([
            getEurostatInflation("PL"),
            getEurostatInflation("EU")
        ]);

        const observations = [];

        const failures = [];

        results.forEach((result, index) => {
            const country = index === 0 ? "PL" : "EU";

            if (result.status === "fulfilled") {
                observations.push(...result.value);
            } else {
                failures.push({
                    country,

                    error: errorMessage(result.reason)
                });
            }
        });

        if (!observations.length) {
            throw new Error(
                failures.length
                    ? failures.map(item => item.error).join("; ")
                    : "Eurostat returned no usable observations"
            );
        }

        return {
            observations,

            failures
        };
    }


    /* --------------------------------------------------------
       10. OBSERVATION NORMALIZATION
       -------------------------------------------------------- */

    function createCurrencyObservations(table) {
        if (!table || !Array.isArray(table.rates)) {
            return [];
        }

        return table.rates.map(rate => ({
            id: `NBP-${rate.code}-${rate.date}`,

            name: `${rate.code} / PLN`,

            indicator: "Exchange rate",

            country: "PL",

            countryName: "Poland",

            category: "currency",

            value: rate.value,

            unit: "PLN",

            date: rate.date,

            source: "NBP",

            sourceUrl: "https://api.nbp.pl/"
        }));
    }


    function createGoldObservation(gold) {
        if (!gold || !isFiniteNumber(gold.value)) {
            return null;
        }

        return {
            id: `NBP-GOLD-${gold.date}`,

            name: "Gold price",

            indicator: "Gold price per gram",

            country: "PL",

            countryName: "Poland",

            category: "gold",

            value: gold.value,

            unit: "PLN / gram",

            date: gold.date,

            source: "NBP",

            sourceUrl: "https://api.nbp.pl/"
        };
    }


    function createWorldBankObservations(data) {
        return safeArray(data?.observations).map(item => ({
            id: `WB-${item.country}-${item.indicator}-${item.year}`,

            name: item.indicatorName,

            indicator: item.indicator,

            country: item.country,

            countryName: item.countryName,

            category: item.category,

            value: item.value,

            unit: item.unit,

            date: item.date,

            source: "World Bank",

            sourceUrl: "https://data.worldbank.org/"
        }));
    }


    function createEurostatObservations(data) {
        return safeArray(data?.observations).map(item => ({
            id: `EUROSTAT-${item.country}-${item.date}`,

            name: item.indicatorName,

            indicator: item.indicator,

            country: item.country,

            countryName: item.countryName,

            category: item.category,

            value: item.value,

            unit: item.unit,

            date: item.date,

            source: "Eurostat",

            sourceUrl: "https://ec.europa.eu/eurostat"
        }));
    }


    /* --------------------------------------------------------
       11. DASHBOARD BUILDER
       -------------------------------------------------------- */

    async function buildDashboard() {
        const sourceTasks = [
            executeSource(
                "NBP",
                async () => {
                    const results = await Promise.allSettled([
                        getNBPCurrencyTable(),
                        getNBPGold(),
                        getNBPCurrencyHistory("USD"),
                        getNBPCurrencyHistory("EUR"),
                        getNBPGoldHistory()
                    ]);

                    const [currencies, gold, usdHistory, eurHistory, goldHistory] =
                        results;

                    const data = {
                        currencies: null,
                        gold: null,
                        usdHistory: null,
                        eurHistory: null,
                        goldHistory: [],
                        errors: []
                    };

                    const fields = [
                        "currencies",
                        "gold",
                        "usdHistory",
                        "eurHistory",
                        "goldHistory"
                    ];

                    results.forEach((result, index) => {
                        if (result.status === "fulfilled") {
                            data[fields[index]] = result.value;
                        } else {
                            data.errors.push({
                                field: fields[index],

                                error: errorMessage(result.reason)
                            });
                        }
                    });

                    if (!data.currencies && !data.gold) {
                        throw new Error(
                            data.errors.map(item => item.error).join("; ")
                        );
                    }

                    return data;
                }
            ),

            executeSource(
                "World Bank",
                getWorldBankDashboard
            ),

            executeSource(
                "Eurostat",
                getEurostatDashboard
            )
        ];

        const sources = await Promise.all(sourceTasks);

        const nbp = sources.find(item => item.name === "NBP");

        const worldBank = sources.find(
            item => item.name === "World Bank"
        );

        const eurostat = sources.find(
            item => item.name === "Eurostat"
        );

        const nbpData = nbp?.data || {};

        const currencyTable = nbpData.currencies;

        const gold = nbpData.gold;

        const worldBankData = worldBank?.data;

        const eurostatData = eurostat?.data;

        const currencies = safeArray(
            currencyTable?.rates
        );

        const observations = [
            ...createCurrencyObservations(currencyTable),

            createGoldObservation(gold),

            ...createWorldBankObservations(worldBankData),

            ...createEurostatObservations(eurostatData)
        ].filter(Boolean);

        const inflationObservations = observations.filter(
            item => item.category === "inflation"
        );

        const economyObservations = observations.filter(
            item => item.category === "economy"
        );

        const history = {
            USD: safeArray(nbpData.usdHistory?.observations),

            EUR: safeArray(nbpData.eurHistory?.observations),

            GOLD: safeArray(nbpData.goldHistory)
        };

        const sourceSummary = sources.map(source => ({
            name: source.name,

            status: source.status,

            checkedAt: source.checkedAt,

            duration: source.duration || null,

            error: source.error || null,

            details: source.data?.errors || []
        }));

        const dashboard = {
            version: "1.0.0",

            generatedAt: nowISO(),

            lastCheckedAt: nowISO(),

            currencies,

            gold,

            inflation: inflationObservations,

            economy: economyObservations,

            observations,

            history,

            sources: sourceSummary,

            errors: {
                nbp: nbpData.errors || [],

                worldBank: worldBankData?.failures || [],

                eurostat: eurostatData?.failures || []
            },

            metadata: {
                currencyDate: currencyTable?.date || null,

                goldDate: gold?.date || null,

                currencyCount: currencies.length,

                observationCount: observations.length,

                inflationCount: inflationObservations.length,

                economyCount: economyObservations.length
            }
        };

        return dashboard;
    }


    /* --------------------------------------------------------
       12. PUBLIC DASHBOARD LOADER
       -------------------------------------------------------- */

    async function loadDashboard(options = {}) {
        const force = Boolean(options.force);

        if (refreshPromise) {
            return refreshPromise;
        }

        if (
            !force &&
            dashboardCache &&
            lastRefreshTime &&
            Date.now() - lastRefreshTime < CONFIG.refreshInterval
        ) {
            return dashboardCache;
        }

        refreshPromise = (async () => {
            try {
                const dashboard = await buildDashboard();

                dashboardCache = dashboard;

                lastSuccessfulDashboard = dashboard;

                lastRefreshTime = Date.now();

                return dashboard;

            } catch (error) {
                if (lastSuccessfulDashboard) {
                    return {
                        ...lastSuccessfulDashboard,

                        refreshError: errorMessage(error),

                        generatedAt: nowISO(),

                        usingPreviousData: true
                    };
                }

                throw error;

            } finally {
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    }


    /* --------------------------------------------------------
       13. PUBLIC HISTORY LOADER
       -------------------------------------------------------- */

    async function loadCurrencyHistory(
        currencyCode,
        count = 30
    ) {
        const code = String(currencyCode || "USD").toUpperCase();

        if (!/^[A-Z]{3}$/.test(code)) {
            throw new Error("Invalid currency code");
        }

        return getNBPCurrencyHistory(code, count);
    }


    async function loadGoldHistory(count = 30) {
        return getNBPGoldHistory(count);
    }


    /* --------------------------------------------------------
       14. MANUAL CACHE CONTROL
       -------------------------------------------------------- */

    function clearCache() {
        dashboardCache = null;

        lastSuccessfulDashboard = null;

        lastRefreshTime = null;
    }


    function getCachedDashboard() {
        return dashboardCache;
    }


    function getLastRefreshTime() {
        return lastRefreshTime
            ? new Date(lastRefreshTime).toISOString()
            : null;
    }


    /* --------------------------------------------------------
       15. FORMATTING HELPERS
       -------------------------------------------------------- */

    function formatCurrency(value, currency = "PLN") {
        if (!isFiniteNumber(value)) {
            return "—";
        }

        try {
            return new Intl.NumberFormat("en-GB", {
                style: "currency",

                currency,

                minimumFractionDigits: 2,

                maximumFractionDigits: 4
            }).format(value);

        } catch {
            return `${formatNumber(value)} ${currency}`;
        }
    }


    function formatPercent(value) {
        if (!isFiniteNumber(value)) {
            return "—";
        }

        return `${formatNumber(value, 2)}%`;
    }


    function getLatestObservation(
        observations,
        country,
        category
    ) {
        return safeArray(observations)
            .filter(item => (
                item.country === country &&
                item.category === category
            ))
            .sort((a, b) => (
                String(b.date).localeCompare(String(a.date))
            ))[0] || null;
    }


    /* --------------------------------------------------------
       16. PUBLIC API
       -------------------------------------------------------- */

    window.ArchiveData = Object.freeze({

        version: "1.0.0",

        config: CONFIG,

        loadDashboard,

        loadCurrencyHistory,

        loadGoldHistory,

        clearCache,

        getCachedDashboard,

        getLastRefreshTime,

        formatDate,

        formatDateTime,

        formatNumber,

        formatCurrency,

        formatPercent,

        getLatestObservation,

        isFiniteNumber,

        nowISO

    });


    /* --------------------------------------------------------
       17. INITIALIZATION
       -------------------------------------------------------- */

    window.dispatchEvent(
        new CustomEvent("archive:data-engine-ready", {
            detail: {
                version: "1.0.0"
            }
        })
    );

})();

