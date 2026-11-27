"use strict";

window.ArchiveData = (() => {

    const API = {
        nbpRates: "https://api.nbp.pl/api/exchangerates/tables/A/?format=json",
        nbpGold: "https://api.nbp.pl/api/cenyzlota/last/30/?format=json",
        frankfurter: "https://api.frankfurter.dev/v1/latest?base=PLN",
        bitcoin: "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
        bitcoinCurrent: "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
        worldBank: "https://api.worldbank.org/v2"
    };

    const CACHE_TIME = 5 * 60 * 1000;
    const cache = new Map();

    const state = {
        currency: "USD",
        rates: { PLN: 1 },
        rateSources: {},
        bitcoin: null,
        gold: null,
        lastUpdate: null,
        errors: []
    };

    const CURRENCY_NAMES = {
        PLN: "Polish Zloty",
        USD: "US Dollar",
        EUR: "Euro",
        GBP: "British Pound",
        CHF: "Swiss Franc",
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
        HUF: "Hungarian Forint",
        ISK: "Icelandic Krona",
        MXN: "Mexican Peso",
        NZD: "New Zealand Dollar",
        SGD: "Singapore Dollar",
        HKD: "Hong Kong Dollar",
        KRW: "South Korean Won",
        TRY: "Turkish Lira",
        ZAR: "South African Rand",
        BGN: "Bulgarian Lev",
        RON: "Romanian Leu",
        ILS: "Israeli New Shekel",
        THB: "Thai Baht",
        MYR: "Malaysian Ringgit",
        PHP: "Philippine Peso"
    };

    const COUNTRIES = {
        USA: "United States",
        POL: "Poland",
        DEU: "Germany",
        FRA: "France",
        GBR: "United Kingdom",
        JPN: "Japan",
        CHN: "China",
        IND: "India",
        BRA: "Brazil",
        CAN: "Canada",
        AUS: "Australia",
        CHE: "Switzerland",
        ITA: "Italy",
        ESP: "Spain",
        NLD: "Netherlands",
        SWE: "Sweden",
        NOR: "Norway",
        KOR: "South Korea",
        MEX: "Mexico",
        ZAF: "South Africa"
    };

    function remember(key, value) {
        cache.set(key, {
            value,
            time: Date.now()
        });
    }

    function recall(key) {
        const entry = cache.get(key);

        if (!entry) {
            return null;
        }

        if (Date.now() - entry.time > CACHE_TIME) {
            cache.delete(key);
            return null;
        }

        return entry.value;
    }

    async function fetchJSON(url, options = {}) {
        const cached = recall(url);

        if (cached !== null) {
            return cached;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 18000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    ...(options.headers || {})
                }
            });

            if (!response.ok) {
                throw new Error(
                    `Request failed (${response.status})`
                );
            }

            const result = await response.json();

            remember(url, result);

            return result;

        } finally {
            clearTimeout(timeout);
        }
    }

    async function safeFetch(source, url) {
        try {
            const data = await fetchJSON(url);

            return {
                ok: true,
                data,
                source
            };

        } catch (error) {
            state.errors.push({
                source,
                message: error.message,
                date: new Date().toISOString()
            });

            return {
                ok: false,
                data: null,
                source,
                error: error.message
            };
        }
    }

    function setCurrency(code) {
        const currency = String(code).toUpperCase();

        if (!CURRENCY_NAMES[currency]) {
            throw new Error(`Unsupported currency: ${currency}`);
        }

        state.currency = currency;
    }

    function getCurrency() {
        return state.currency;
    }

    function getRate(code) {
        return state.rates[String(code).toUpperCase()] ?? null;
    }

    /*
     * Every rate is stored as:
     * how many units of this currency equal one PLN.
     *
     * Example:
     * PLN = 1
     * USD = 0.25
     *
     * This makes all conversions use one consistent base.
     */

    function convert(value, from, to) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return null;
        }

        const fromRate = getRate(from);
        const toRate = getRate(to);

        if (
            fromRate === null ||
            toRate === null ||
            fromRate <= 0 ||
            toRate <= 0
        ) {
            return null;
        }

        return amount / fromRate * toRate;
    }

    function convertToDisplay(value, sourceCurrency = "PLN") {
        return convert(value, sourceCurrency, state.currency);
    }

    function formatMoney(value, currency = state.currency) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
            return "Unavailable";
        }

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
                maximumFractionDigits: 2
            }).format(Number(value));

        } catch {
            return `${Number(value).toFixed(2)} ${currency}`;
        }
    }

    function formatNumber(value, decimals = 2) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
            return "Unavailable";
        }

        return new Intl.NumberFormat("en-US", {
            maximumFractionDigits: decimals
        }).format(Number(value));
    }

    function formatPercent(value) {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) {
            return "Unavailable";
        }

        const number = Number(value);

        return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
    }

    function changeClass(value) {
        if (!Number.isFinite(Number(value))) {
            return "neutral";
        }

        return Number(value) > 0
            ? "positive"
            : Number(value) < 0
                ? "negative"
                : "neutral";
    }

    async function loadNBPRates() {
        const result = await safeFetch("NBP", API.nbpRates);

        if (!result.ok || !Array.isArray(result.data?.[0]?.rates)) {
            return false;
        }

        const newRates = { PLN: 1 };
        const newSources = { PLN: "NBP base currency" };

        for (const item of result.data[0].rates) {
            const code = String(item.code).toUpperCase();
            const plnPerUnit = Number(item.mid);

            if (
                !Number.isFinite(plnPerUnit) ||
                plnPerUnit <= 0
            ) {
                continue;
            }

            newRates[code] = 1 / plnPerUnit;
            newSources[code] = "NBP";
        }

        state.rates = {
            ...state.rates,
            ...newRates
        };

        state.rateSources = {
            ...state.rateSources,
            ...newSources
        };

        return true;
    }

    async function loadFallbackRates() {
        const result = await safeFetch("Frankfurter", API.frankfurter);

        if (!result.ok || !result.data?.rates) {
            return false;
        }

        for (const [code, value] of Object.entries(result.data.rates)) {
            const numeric = Number(value);

            if (
                !Number.isFinite(numeric) ||
                numeric <= 0
            ) {
                continue;
            }

            if (!state.rates[code]) {
                state.rates[code] = numeric;
                state.rateSources[code] = "Frankfurter";
            }
        }

        return true;
    }

    async function loadBitcoin() {
        const url =
            "https://api.coingecko.com/api/v3/simple/price" +
            "?ids=bitcoin" +
            "&vs_currencies=usd" +
            "&include_market_cap=true" +
            "&include_24hr_vol=true" +
            "&include_24hr_change=true";

        const result = await safeFetch("CoinGecko", url);

        if (!result.ok || !result.data?.bitcoin) {
            state.bitcoin = null;
            return false;
        }

        const btc = result.data.bitcoin;

        const price = convert(
            btc.usd,
            "USD",
            state.currency
        );

        const marketCap = convert(
            btc.usd_market_cap,
            "USD",
            state.currency
        );

        const volume = convert(
            btc.usd_24h_vol,
            "USD",
            state.currency
        );

        state.bitcoin = {
            price,
            priceUSD: Number(btc.usd),
            marketCap,
            volume,
            change24h: Number(btc.usd_24h_change),
            source: "CoinGecko",
            currency: state.currency,
            updatedAt: new Date().toISOString()
        };

        return true;
    }

    async function loadBitcoinHistory(days = 30) {
        const allowed = [1, 7, 30, 90, 365];
        const period = Number(days);

        if (!allowed.includes(period)) {
            throw new Error("Unsupported Bitcoin history period.");
        }

        const url =
            `${API.bitcoin}/bitcoin/market_chart` +
            `?vs_currency=usd&days=${period}`;

        const result = await safeFetch("CoinGecko", url);

        if (!result.ok || !Array.isArray(result.data?.prices)) {
            return [];
        }

        return result.data.prices.map(point => ({
            timestamp: Number(point[0]),
            date: new Date(Number(point[0])),
            value: convert(
                Number(point[1]),
                "USD",
                state.currency
            )
        })).filter(item =>
            Number.isFinite(item.value)
        );
    }

    async function loadGold() {
        const result = await safeFetch("NBP Gold", API.nbpGold);

        if (!result.ok || !Array.isArray(result.data) || !result.data.length) {
            state.gold = null;
            return false;
        }

        const latest = result.data[result.data.length - 1];
        const pricePLN = Number(latest.cena);

        if (!Number.isFinite(pricePLN)) {
            state.gold = null;
            return false;
        }

        state.gold = {
            pricePerGram: convertToDisplay(pricePLN, "PLN"),
            pricePerOunce: convertToDisplay(
                pricePLN * 31.1034768,
                "PLN"
            ),
            pricePerGramPLN: pricePLN,
            date: latest.data,
            source: "National Bank of Poland",
            currency: state.currency
        };

        return true;
    }

    async function loadGoldHistory() {
        const result = await safeFetch("NBP Gold", API.nbpGold);

        if (!result.ok || !Array.isArray(result.data)) {
            return [];
        }

        return result.data.map(item => ({
            date: item.data,
            value: convertToDisplay(Number(item.cena), "PLN"),
            valuePLN: Number(item.cena)
        })).filter(item =>
            Number.isFinite(item.value)
        );
    }

    const ECONOMIC_INDICATORS = {
        gdp: {
            code: "NY.GDP.MKTP.KD.ZG",
            label: "GDP growth",
            unit: "%"
        },

        inflation: {
            code: "FP.CPI.TOTL.ZG",
            label: "Inflation",
            unit: "%"
        },

        unemployment: {
            code: "SL.UEM.TOTL.ZS",
            label: "Unemployment",
            unit: "%"
        },

        population: {
            code: "SP.POP.TOTL",
            label: "Population",
            unit: ""
        },

        gdpPerCapita: {
            code: "NY.GDP.PCAP.CD",
            label: "GDP per capita",
            unit: "USD"
        }
    };

    async function loadEconomy(countryCode, indicatorCode) {
        const country = String(countryCode).toUpperCase();

        if (!/^[A-Z]{3}$/.test(country)) {
            throw new Error("Invalid country code.");
        }

        const allowed = Object.values(ECONOMIC_INDICATORS)
            .map(item => item.code);

        if (!allowed.includes(indicatorCode)) {
            throw new Error("Unsupported economic indicator.");
        }

        const url =
            `${API.worldBank}/country/${country}` +
            `/indicator/${indicatorCode}` +
            "?format=json&per_page=30";

        const result = await safeFetch("World Bank", url);

        if (!result.ok || !Array.isArray(result.data?.[1])) {
            return [];
        }

        return result.data[1]
            .filter(item => item.value !== null)
            .map(item => ({
                year: String(item.date),
                value: Number(item.value),
                country: item.country?.value || country,
                indicator: item.indicator?.value || indicatorCode,
                source: "World Bank"
            }))
            .filter(item => Number.isFinite(item.value))
            .sort((a, b) => Number(b.year) - Number(a.year));
    }

    async function loadCountryOverview(countryCode) {
        const entries = Object.entries(ECONOMIC_INDICATORS);

        const results = await Promise.all(
            entries.map(async ([key, indicator]) => ({
                key,
                records: await loadEconomy(
                    countryCode,
                    indicator.code
                )
            }))
        );

        const output = {};

        for (const item of results) {
            output[item.key] = item.records[0] || null;
        }

        return output;
    }

    async function loadCountryList() {
        const url =
            `${API.worldBank}/country?format=json&per_page=300`;

        const result = await safeFetch("World Bank", url);

        if (!result.ok || !Array.isArray(result.data?.[1])) {
            return [];
        }

        return result.data[1]
            .filter(item =>
                item.region &&
                item.region.id !== "NA"
            )
            .map(item => ({
                code: item.id,
                name: item.name,
                capital: item.capitalCity,
                region: item.region.value,
                income: item.incomeLevel?.value
            }));
    }

    function getCurrencies() {
        return Object.keys(state.rates)
            .sort()
            .map(code => ({
                code,
                name: CURRENCY_NAMES[code] || code,
                rate: convert(1, code, state.currency),
                source: state.rateSources[code] || "Reference data"
            }));
    }

    async function loadAll() {
        state.errors = [];

        /*
         * Load exchange rates first because BTC and gold
         * conversions depend on them.
         */

        await Promise.all([
            loadNBPRates(),
            loadFallbackRates()
        ]);

        /*
         * Run financial requests after rates have been loaded.
         */

        const results = await Promise.allSettled([
            loadBitcoin(),
            loadGold()
        ]);

        state.lastUpdate = new Date();

        return {
            rates: { ...state.rates },
            bitcoin: state.bitcoin,
            gold: state.gold,
            errors: [...state.errors],
            results,
            updatedAt: state.lastUpdate
        };
    }

    function getState() {
        return {
            currency: state.currency,
            rates: { ...state.rates },
            rateSources: { ...state.rateSources },
            bitcoin: state.bitcoin
                ? { ...state.bitcoin }
                : null,
            gold: state.gold
                ? { ...state.gold }
                : null,
            lastUpdate: state.lastUpdate,
            errors: [...state.errors]
        };
    }

    return {
        loadAll,
        loadNBPRates,
        loadFallbackRates,
        loadBitcoin,
        loadBitcoinHistory,
        loadGold,
        loadGoldHistory,
        loadEconomy,
        loadCountryOverview,
        loadCountryList,

        setCurrency,
        getCurrency,
        getRate,
        getCurrencies,
        getState,

        convert,
        convertToDisplay,

        formatMoney,
        formatNumber,
        formatPercent,
        changeClass,

        currencyNames: { ...CURRENCY_NAMES },
        countries: { ...COUNTRIES },
        indicators: { ...ECONOMIC_INDICATORS }
    };

})();
