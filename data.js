/* ============================================================
   THE MONETARY ARCHIVE
   DATA ENGINE
   Version: 2.0.0

   DATA SOURCES:
   - National Bank of Poland (NBP)
   - CoinGecko
   - World Bank
   - Eurostat

   No API keys required for the endpoints used here.
   ============================================================ */

(function () {
    "use strict";


    /* ========================================================
       01. CONFIGURATION
       ======================================================== */

    const CONFIG = {

        version: "2.0.0",

        timeout: 18000,

        refreshInterval: 5 * 60 * 1000,

        currencyHistoryCount: 30,

        goldHistoryCount: 30,

        bitcoinHistoryDays: 30,

        worldBankYears: 10,

        endpoints: {

            nbp: "https://api.nbp.pl/api",

            worldBank: "https://api.worldbank.org/v2",

            eurostat:
                "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data",

            coinGecko:
                "https://api.coingecko.com/api/v3"

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


    /* ========================================================
       02. INTERNAL STATE
       ======================================================== */

    let dashboardCache = null;

    let lastSuccessfulDashboard = null;

    let lastRefreshTime = null;

    let refreshPromise = null;

    let bitcoinHistoryCache = null;

    let bitcoinHistoryTime = null;


    /* ========================================================
       03. GENERAL HELPERS
       ======================================================== */

    function nowISO() {

        return new Date().toISOString();

    }


    function isFiniteNumber(value) {

        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );

    }


    function toNumber(value) {

        if (typeof value === "number") {

            return Number.isFinite(value)
                ? value
                : null;

        }

        if (typeof value === "string") {

            const parsed = Number(value);

            return Number.isFinite(parsed)
                ? parsed
                : null;

        }

        return null;

    }


    function safeArray(value) {

        return Array.isArray(value)
            ? value
            : [];

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


    function sleep(milliseconds) {

        return new Promise(resolve => {

            setTimeout(resolve, milliseconds);

        });

    }


    /* ========================================================
       04. NETWORK REQUEST ENGINE
       ======================================================== */

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


    /* ========================================================
       05. NATIONAL BANK OF POLAND
       CURRENCY TABLE
       ======================================================== */

    async function getNBPCurrencyTable() {

        const url =
            `${CONFIG.endpoints.nbp}/exchangerates/tables/a/?format=json`;

        const response = await requestJSON(url);


        if (!Array.isArray(response) || !response.length) {

            throw new Error(
                "NBP returned an empty currency table"
            );

        }


        const table = response[0];


        if (!Array.isArray(table.rates)) {

            throw new Error(
                "NBP currency table has no rates"
            );

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


        // PLN is the base currency of NBP quotations.
        // One PLN is equal to one PLN.

        rates.push({

            code: "PLN",

            name: "Polish zloty",

            value: 1,

            unit: "PLN",

            date: table.effectiveDate || null,

            source: "NBP",

            category: "currency",

            country: "PL",

            countryName: "Poland"

        });


        return {

            table: table.no || null,

            date: table.effectiveDate || null,

            base: "PLN",

            rates

        };

    }


    /* ========================================================
       06. CURRENCY CONVERSION
       ======================================================== */

    function getPLNRate(currencyTable, currencyCode) {

        const code = String(currencyCode || "PLN")
            .toUpperCase();

        if (code === "PLN") {
            return 1;
        }

        const rate = safeArray(currencyTable?.rates)
            .find(item => item.code === code);

        return rate && isFiniteNumber(rate.value)
            ? rate.value
            : null;

    }


    function convertCurrency(
        amount,
        fromCurrency,
        toCurrency,
        currencyTable
    ) {

        const value = toNumber(amount);

        if (!isFiniteNumber(value)) {
            return null;
        }


        const from = String(fromCurrency || "PLN")
            .toUpperCase();

        const to = String(toCurrency || "PLN")
            .toUpperCase();


        const fromRate = getPLNRate(
            currencyTable,
            from
        );

        const toRate = getPLNRate(
            currencyTable,
            to
        );


        if (
            !isFiniteNumber(fromRate) ||
            !isFiniteNumber(toRate) ||
            toRate === 0
        ) {

            return null;

        }


        // NBP rates represent the price of one unit
        // of foreign currency in PLN.

        const valueInPLN = value * fromRate;

        return valueInPLN / toRate;

    }


    function getCurrencyRate(
        currencyTable,
        fromCurrency,
        toCurrency
    ) {

        return convertCurrency(
            1,
            fromCurrency,
            toCurrency,
            currencyTable
        );

    }


    function getConvertedCurrencyTable(
        currencyTable,
        displayCurrency = "USD"
    ) {

        const target = String(displayCurrency)
            .toUpperCase();

        return safeArray(currencyTable?.rates)
            .map(rate => {

                const converted = convertCurrency(
                    rate.value,
                    "PLN",
                    target,
                    currencyTable
                );

                return {

                    ...rate,

                    originalValue: rate.value,

                    originalCurrency: "PLN",

                    value: converted,

                    displayCurrency: target

                };

            })
            .filter(rate => isFiniteNumber(rate.value));

    }


    /* ========================================================
       07. NBP CURRENCY HISTORY
       ======================================================== */

    async function getNBPCurrencyHistory(
        currencyCode = "USD",
        count = CONFIG.currencyHistoryCount
    ) {

        const code = String(currencyCode).toLowerCase();

        const safeCount = Math.max(
            1,
            Math.min(90, Number(count) || 30)
        );


        if (code === "pln") {

            return {

                currency: "PLN",

                table: "A",

                date: nowISO(),

                observations: []

            };

        }


        const url =
            `${CONFIG.endpoints.nbp}/exchangerates/rates/a/${encodeURIComponent(code)}/last/${safeCount}/?format=json`;


        const response = await requestJSON(url);


        if (!response || !Array.isArray(response.rates)) {

            throw new Error(
                "Invalid NBP history response"
            );

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


    /* ========================================================
       08. NBP GOLD PRICES
       ======================================================== */

    async function getNBPGold() {

        const url =
            `${CONFIG.endpoints.nbp}/cenyzlota/?format=json`;

        const response = await requestJSON(url);


        if (!Array.isArray(response) || !response.length) {

            throw new Error(
                "NBP returned no gold quotation"
            );

        }


        const latest = response[0];

        const value = toNumber(latest.cena);


        if (!isFiniteNumber(value)) {

            throw new Error(
                "Invalid NBP gold price"
            );

        }


        return {

            value,

            date: latest.data || null,

            currency: "PLN",

            unit: "gram",

            source: "NBP",

            // One troy ounce = 31.1034768 grams.

            valuePerTroyOunce: value * 31.1034768

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

            throw new Error(
                "Invalid NBP gold history response"
            );

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


    /* ========================================================
       09. BITCOIN — COINGECKO
       ======================================================== */

    async function getBitcoinPrice() {

        const url =
            `${CONFIG.endpoints.coinGecko}/simple/price?ids=bitcoin&vs_currencies=usd,eur,gbp,pln,chf&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true`;


        const response = await requestJSON(url);

        const bitcoin = response?.bitcoin;


        if (!bitcoin) {

            throw new Error(
                "CoinGecko returned no Bitcoin data"
            );

        }


        const usd = toNumber(bitcoin.usd);


        if (!isFiniteNumber(usd)) {

            throw new Error(
                "Invalid Bitcoin USD price"
            );

        }


        return {

            id: "bitcoin",

            symbol: "BTC",

            name: "Bitcoin",

            price: {

                USD: usd,

                EUR: toNumber(bitcoin.eur),

                GBP: toNumber(bitcoin.gbp),

                PLN: toNumber(bitcoin.pln),

                CHF: toNumber(bitcoin.chf)

            },

            change24h: {

                USD: toNumber(bitcoin.usd_24h_change),

                EUR: toNumber(bitcoin.eur_24h_change),

                GBP: toNumber(bitcoin.gbp_24h_change),

                PLN: toNumber(bitcoin.pln_24h_change),

                CHF: toNumber(bitcoin.chf_24h_change)

            },

            marketCap: {

                USD: toNumber(bitcoin.usd_market_cap)

            },

            volume24h: {

                USD: toNumber(bitcoin.usd_24h_vol)

            },

            lastUpdated: bitcoin.last_updated_at
                ? new Date(
                    bitcoin.last_updated_at * 1000
                ).toISOString()
                : nowISO(),

            source: "CoinGecko",

            sourceUrl: "https://www.coingecko.com/en/coins/bitcoin"

        };

    }


    async function getBitcoinHistory(
        days = CONFIG.bitcoinHistoryDays,
        currency = "usd"
    ) {

        const safeDays = Math.max(
            1,
            Math.min(365, Number(days) || 30)
        );

        const vsCurrency = String(currency || "usd")
            .toLowerCase();


        const allowedCurrencies = [
            "usd",
            "eur",
            "gbp",
            "pln",
            "chf"
        ];


        if (!allowedCurrencies.includes(vsCurrency)) {

            throw new Error(
                "Unsupported Bitcoin history currency"
            );

        }


        const url =
            `${CONFIG.endpoints.coinGecko}/coins/bitcoin/market_chart?vs_currency=${encodeURIComponent(vsCurrency)}&days=${safeDays}`;


        const response = await requestJSON(url);


        if (!Array.isArray(response?.prices)) {

            throw new Error(
                "CoinGecko returned invalid Bitcoin history"
            );

        }


        const observations = response.prices.map(item => ({

            timestamp: item[0],

            date: new Date(item[0]).toISOString(),

            value: toNumber(item[1]),

            source: "CoinGecko"

        })).filter(item => (

            item.date &&
            isFiniteNumber(item.value)

        ));


        return {

            currency: vsCurrency.toUpperCase(),

            days: safeDays,

            observations,

            source: "CoinGecko"

        };

    }


    /* ========================================================
       10. WORLD BANK INDICATORS
       ======================================================== */

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

            .filter(item => isFiniteNumber(item.value))

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


    /* ========================================================
       11. EUROSTAT
       HICP ANNUAL RATE OF CHANGE
       ======================================================== */

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


    /* ========================================================
       12. OBSERVATION NORMALIZATION
       ======================================================== */

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


    function createBitcoinObservation(bitcoin) {

        if (!bitcoin || !isFiniteNumber(bitcoin.price?.USD)) {
            return null;
        }


        return {

            id: "COINGECKO-BTC",

            name: "Bitcoin",

            indicator: "Bitcoin price",

            country: "GLOBAL",

            countryName: "Global market",

            category: "crypto",

            value: bitcoin.price.USD,

            unit: "USD",

            date: bitcoin.lastUpdated,

            source: "CoinGecko",

            sourceUrl:
                "https://www.coingecko.com/en/coins/bitcoin"

        };

    }


    function createWorldBankObservations(data) {

        return safeArray(data?.observations).map(item => ({

            id:
                `WB-${item.country}-${item.indicator}-${item.year}`,

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

            id:
                `EUROSTAT-${item.country}-${item.date}`,

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


    /* ========================================================
       13. DASHBOARD BUILDER
       ======================================================== */

    async function buildDashboard() {

        const sourceTasks = [


            // NBP: currencies and gold.

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

                            data.errors
                                .map(item => item.error)
                                .join("; ")

                        );

                    }


                    return data;

                }
            ),


            // Bitcoin market data.

            executeSource(
                "CoinGecko",
                getBitcoinPrice
            ),


            // World Bank indicators.

            executeSource(
                "World Bank",
                getWorldBankDashboard
            ),


            // Eurostat inflation data.

            executeSource(
                "Eurostat",
                getEurostatDashboard
            )

        ];


        const sources = await Promise.all(sourceTasks);


        const nbp = sources.find(
            item => item.name === "NBP"
        );

        const bitcoinSource = sources.find(
            item => item.name === "CoinGecko"
        );

        const worldBank = sources.find(
            item => item.name === "World Bank"
        );

        const eurostat = sources.find(
            item => item.name === "Eurostat"
        );


        const nbpData = nbp?.data || {};

        const currencyTable = nbpData.currencies;

        const gold = nbpData.gold;

        const bitcoin = bitcoinSource?.data || null;

        const worldBankData = worldBank?.data;

        const eurostatData = eurostat?.data;


        const currencies = safeArray(
            currencyTable?.rates
        );


        const observations = [

            ...createCurrencyObservations(currencyTable),

            createGoldObservation(gold),

            createBitcoinObservation(bitcoin),

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

            USD: safeArray(
                nbpData.usdHistory?.observations
            ),

            EUR: safeArray(
                nbpData.eurHistory?.observations
            ),

            GOLD: safeArray(
                nbpData.goldHistory
            ),

            BTC: []

        };


        const sourceSummary = sources.map(source => ({

            name: source.name,

            status: source.status,

            checkedAt: source.checkedAt,

            duration: source.duration || null,

            error: source.error || null,

            details: source.data?.errors || []

        }));


        return {

            version: CONFIG.version,

            generatedAt: nowISO(),

            lastCheckedAt: nowISO(),

            currencies,

            currencyTable,

            gold,

            bitcoin,

            inflation: inflationObservations,

            economy: economyObservations,

            observations,

            history,

            sources: sourceSummary,

            errors: {

                nbp: nbpData.errors || [],

                bitcoin:
                    bitcoinSource?.error || null,

                worldBank:
                    worldBankData?.failures || [],

                eurostat:
                    eurostatData?.failures || []

            },

            metadata: {

                currencyDate:
                    currencyTable?.date || null,

                goldDate:
                    gold?.date || null,

                bitcoinDate:
                    bitcoin?.lastUpdated || null,

                currencyCount:
                    currencies.length,

                observationCount:
                    observations.length,

                inflationCount:
                    inflationObservations.length,

                economyCount:
                    economyObservations.length

            }

        };

    }


    /* ========================================================
       14. PUBLIC DASHBOARD LOADER
       ======================================================== */

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


    /* ========================================================
       15. PUBLIC HISTORY LOADERS
       ======================================================== */

    async function loadCurrencyHistory(
        currencyCode,
        count = 30
    ) {

        const code = String(currencyCode || "USD")
            .toUpperCase();


        if (!/^[A-Z]{3}$/.test(code)) {

            throw new Error(
                "Invalid currency code"
            );

        }


        return getNBPCurrencyHistory(code, count);

    }


    async function loadGoldHistory(count = 30) {

        return getNBPGoldHistory(count);

    }


    async function loadBitcoinHistory(
        days = 30,
        currency = "usd",
        options = {}
    ) {

        const force = Boolean(options.force);


        if (
            !force &&
            bitcoinHistoryCache &&
            bitcoinHistoryTime &&
            Date.now() - bitcoinHistoryTime < CONFIG.refreshInterval
        ) {

            if (
                bitcoinHistoryCache.days === Number(days) &&
                bitcoinHistoryCache.currency ===
                    String(currency).toUpperCase()
            ) {

                return bitcoinHistoryCache;

            }

        }


        const history = await getBitcoinHistory(
            days,
            currency
        );


        bitcoinHistoryCache = history;

        bitcoinHistoryTime = Date.now();


        return history;

    }


    /* ========================================================
       16. MANUAL CACHE CONTROL
       ======================================================== */

    function clearCache() {

        dashboardCache = null;

        lastSuccessfulDashboard = null;

        lastRefreshTime = null;

        bitcoinHistoryCache = null;

        bitcoinHistoryTime = null;

    }


    function getCachedDashboard() {

        return dashboardCache;

    }


    function getLastRefreshTime() {

        return lastRefreshTime
            ? new Date(lastRefreshTime).toISOString()
            : null;

    }


    /* ========================================================
       17. FORMATTING HELPERS
       ======================================================== */

    function formatCurrency(
        value,
        currency = "USD"
    ) {

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

                String(b.date).localeCompare(
                    String(a.date)
                )

            ))[0] || null;

    }


    function getLatestBitcoinPrice(
        dashboard,
        currency = "USD"
    ) {

        const bitcoin = dashboard?.bitcoin;

        if (!bitcoin) {
            return null;
        }


        const code = String(currency).toUpperCase();

        const directPrice = bitcoin.price?.[code];


        if (isFiniteNumber(directPrice)) {
            return directPrice;
        }


        // If CoinGecko did not return the selected
        // currency, convert the USD price using NBP.

        if (
            isFiniteNumber(bitcoin.price?.USD) &&
            dashboard?.currencyTable
        ) {

            return convertCurrency(

                bitcoin.price.USD,

                "USD",

                code,

                dashboard.currencyTable

            );

        }


        return null;

    }


    function getGoldPrice(
        dashboard,
        currency = "USD"
    ) {

        const gold = dashboard?.gold;

        if (!gold || !isFiniteNumber(gold.value)) {
            return null;
        }


        return convertCurrency(

            gold.value,

            "PLN",

            currency,

            dashboard.currencyTable

        );

    }


    function getGoldPricePerOunce(
        dashboard,
        currency = "USD"
    ) {

        const pricePerGram = getGoldPrice(
            dashboard,
            currency
        );

        if (!isFiniteNumber(pricePerGram)) {
            return null;
        }


        return pricePerGram * 31.1034768;

    }


    /* ========================================================
       18. PUBLIC API
       ======================================================== */

    window.ArchiveData = Object.freeze({

        version: CONFIG.version,

        config: CONFIG,


        // Main dashboard.

        loadDashboard,


        // Currency functions.

        loadCurrencyHistory,

        convertCurrency,

        getCurrencyRate,

        getConvertedCurrencyTable,


        // Gold functions.

        loadGoldHistory,

        getGoldPrice,

        getGoldPricePerOunce,


        // Bitcoin functions.

        loadBitcoinHistory,

        getLatestBitcoinPrice,


        // Cache controls.

        clearCache,

        getCachedDashboard,

        getLastRefreshTime,


        // Formatting.

        formatDate,

        formatDateTime,

        formatNumber,

        formatCurrency,

        formatPercent,


        // General helpers.

        getLatestObservation,

        isFiniteNumber,

        nowISO

    });


    /* ========================================================
       19. INITIALIZATION EVENT
       ======================================================== */

    window.dispatchEvent(

        new CustomEvent(
            "archive:data-engine-ready",
            {

                detail: {

                    version: CONFIG.version

                }

            }
        )

    );


})();
