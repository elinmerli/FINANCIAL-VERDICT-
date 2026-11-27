"use strict";

window.ArchiveData = (() => {

    const CACHE_DURATION = 5 * 60 * 1000;

    const cache = new Map();

    const state = {
        currency: "USD",
        rates: {},
        bitcoin: null,
        gold: null,
        economy: {},
        lastUpdate: null,
        errors: []
    };

    const CURRENCY_NAMES = {
        USD: "US Dollar",
        EUR: "Euro",
        GBP: "British Pound",
        CHF: "Swiss Franc",
        JPY: "Japanese Yen",
        PLN: "Polish Zloty",
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

    const COUNTRIES = {
        USA: { name: "United States", iso2: "US" },
        POL: { name: "Poland", iso2: "PL" },
        DEU: { name: "Germany", iso2: "DE" },
        FRA: { name: "France", iso2: "FR" },
        GBR: { name: "United Kingdom", iso2: "GB" },
        JPN: { name: "Japan", iso2: "JP" },
        CHN: { name: "China", iso2: "CN" },
        IND: { name: "India", iso2: "IN" },
        BRA: { name: "Brazil", iso2: "BR" },
        CAN: { name: "Canada", iso2: "CA" },
        AUS: { name: "Australia", iso2: "AU" },
        CHE: { name: "Switzerland", iso2: "CH" },
        ITA: { name: "Italy", iso2: "IT" },
        ESP: { name: "Spain", iso2: "ES" },
        NLD: { name: "Netherlands", iso2: "NL" },
        SWE: { name: "Sweden", iso2: "SE" },
        NOR: { name: "Norway", iso2: "NO" },
        KOR: { name: "South Korea", iso2: "KR" },
        MEX: { name: "Mexico", iso2: "MX" },
        ZAF: { name: "South Africa", iso2: "ZA" }
    };

    function cacheGet(key) {
        const item = cache.get(key);

        if (!item) {
            return null;
        }

        if (Date.now() - item.time > CACHE_DURATION) {
            cache.delete(key);
            return null;
        }

        return item.value;
    }

    function cacheSet(key, value) {
        cache.set(key, {
            value,
            time: Date.now()
        });
    }

    async function request(url, options = {}) {
        const cached = cacheGet(url);

        if (cached !== null) {
            return cached;
        }

        const controller = new AbortController();

        const timeout = setTimeout(() => {
            controller.abort();
        }, 15000);

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
                    `HTTP ${response.status}: ${response.statusText}`
                );
            }

            const result = await response.json();

            cacheSet(url, result);

            return result;

        } finally {
            clearTimeout(timeout);
        }
    }

    async function safeRequest(name, url) {
        try {
            const result = await request(url);

            return {
                success: true,
                data: result,
                source: name,
                error: null
            };

        } catch (error) {
            state.errors.push({
                source: name,
                message: error.message,
                time: new Date().toISOString()
            });

            return {
                success: false,
                data: null,
                source: name,
                error: error.message
            };
        }
    }

    function getCurrency() {
        return state.currency;
    }

    function setCurrency(currency) {
        if (!CURRENCY_NAMES[currency] && currency !== "PLN") {
            throw new Error("Unsupported currency");
        }

        state.currency = currency;
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

    function getChangeClass(value) {
        if (!Number.isFinite(Number(value))) {
            return "neutral";
        }

        return Number(value) >= 0 ? "positive" : "negative";
    }

    async function loadCurrencyRates() {
        const result = await safeRequest(
            "NBP",
            "https://api.nbp.pl/api/exchangerates/tables/A/?format=json"
        );

        if (!result.success || !result.data?.[0]?.rates) {
            return false;
        }

        const rates = {
            PLN: 1
        };

        result.data[0].rates.forEach(item => {
            rates[item.code] = Number(item.mid);
        });

        state.rates = rates;

        return true;
    }

    async function loadFallbackRates() {
        const result = await safeRequest(
            "Frankfurter",
            "https://api.frankfurter.dev/v1/latest?base=PLN"
        );

        if (!result.success || !result.data?.rates) {
            return false;
        }

        const rates = {
            PLN: 1,
            ...result.data.rates
        };

        for (const [code, value] of Object.entries(rates)) {
            if (!state.rates[code]) {
                state.rates[code] = Number(value);
            }
        }

        return true;
    }

    function convertFromPLN(value, currency = state.currency) {
        const rate = state.rates[currency];

        if (!Number.isFinite(Number(value)) || !rate) {
            return null;
        }

        return Number(value) * rate;
    }

    function convertBetweenCurrencies(value, from, to) {
        const fromRate = state.rates[from];
        const toRate = state.rates[to];

        if (
            !Number.isFinite(Number(value)) ||
            !fromRate ||
            !toRate
        ) {
            return null;
        }

        return Number(value) / fromRate * toRate;
    }

    function getCurrencyRate(code) {
        const plnPerUnit = state.rates[code];
        const displayRate = state.rates[state.currency];

        if (!plnPerUnit || !displayRate) {
            return null;
        }

        return plnPerUnit / displayRate;
    }

    async function loadBitcoin() {
        const result = await safeRequest(
            "CoinGecko",
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=pln&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true"
        );

        if (!result.success || !result.data?.bitcoin) {
            return false;
        }

        const btc = result.data.bitcoin;

        const price = convertFromPLN(btc.pln);

        const marketCap = convertFromPLN(btc.pln_market_cap);
        const volume = convertFromPLN(btc.pln_24h_vol);

        state.bitcoin = {
            price,
            pricePLN: btc.pln,
            marketCap,
            volume,
            change24h: btc.pln_24h_change,
            source: "CoinGecko",
            updatedAt: new Date().toISOString()
        };

        return true;
    }

    async function loadBitcoinHistory(days = 30) {
        const validDays = [1, 7, 30, 90, 365];

        if (!validDays.includes(Number(days))) {
            throw new Error("Invalid history period");
        }

        const result = await safeRequest(
            "CoinGecko",
            `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=pln&days=${days}`
        );

        if (!result.success || !result.data?.prices) {
            return [];
        }

        return result.data.prices.map(point => ({
            timestamp: point[0],
            date: new Date(point[0]),
            value: convertFromPLN(point[1])
        }));
    }

    async function loadGold() {
        const result = await safeRequest(
            "NBP Gold",
            "https://api.nbp.pl/api/cenyzlota/last/30/?format=json"
        );

        if (!result.success || !Array.isArray(result.data) || !result.data.length) {
            return false;
        }

        const latest = result.data[result.data.length - 1];

        state.gold = {
            pricePerGram: convertFromPLN(latest.cena),
            pricePerGramPLN: latest.cena,
            pricePerOunce: convertFromPLN(latest.cena * 31.1034768),
            date: latest.data,
            source: "National Bank of Poland"
        };

        return true;
    }

    async function loadGoldHistory() {
        const result = await safeRequest(
            "NBP Gold",
            "https://api.nbp.pl/api/cenyzlota/last/30/?format=json"
        );

        if (!result.success || !Array.isArray(result.data)) {
            return [];
        }

        return result.data.map(item => ({
            date: item.data,
            value: convertFromPLN(item.cena),
            valuePLN: item.cena
        }));
    }

    async function loadEconomy(countryCode, indicator) {
        const country = String(countryCode).toUpperCase();

        const allowedIndicators = [
            "NY.GDP.MKTP.KD.ZG",
            "FP.CPI.TOTL.ZG",
            "SL.UEM.TOTL.ZS",
            "NY.GDP.PCAP.CD",
            "SP.POP.TOTL"
        ];

        if (!/^[A-Z]{3}$/.test(country)) {
            throw new Error("Invalid country code");
        }

        if (!allowedIndicators.includes(indicator)) {
            throw new Error("Unsupported economic indicator");
        }

        const result = await safeRequest(
            "World Bank",
            `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=20`
        );

        if (!result.success || !Array.isArray(result.data?.[1])) {
            return [];
        }

        return result.data[1]
            .filter(item => item.value !== null)
            .map(item => ({
                year: item.date,
                value: Number(item.value),
                country: item.country?.value || country,
                indicator: item.indicator?.value || indicator,
                source: "World Bank"
            }));
    }

    async function loadCountryOverview(countryCode) {
        const country = String(countryCode).toUpperCase();

        const indicators = {
            gdp: "NY.GDP.MKTP.KD.ZG",
            inflation: "FP.CPI.TOTL.ZG",
            unemployment: "SL.UEM.TOTL.ZS",
            population: "SP.POP.TOTL"
        };

        const entries = Object.entries(indicators);

        const results = await Promise.all(
            entries.map(async ([name, indicator]) => ({
                name,
                data: await loadEconomy(country, indicator)
            }))
        );

        const output = {};

        results.forEach(item => {
            output[item.name] = item.data[0] || null;
        });

        return output;
    }

    async function loadCountryList() {
        const result = await safeRequest(
            "World Bank",
            "https://api.worldbank.org/v2/country?format=json&per_page=300"
        );

        if (!result.success || !Array.isArray(result.data?.[1])) {
            return [];
        }

        return result.data[1]
            .filter(country => country.region?.id !== "NA")
            .map(country => ({
                id: country.id,
                name: country.name,
                capital: country.capitalCity,
                region: country.region?.value,
                incomeLevel: country.incomeLevel?.value
            }));
    }

    async function loadAll() {
        state.errors = [];

        const results = await Promise.allSettled([
            loadCurrencyRates(),
            loadGold()
        ]);

        await loadFallbackRates();

        const bitcoinLoaded = await loadBitcoin();

        state.lastUpdate = new Date();

        return {
            currencyRates: state.rates,
            bitcoin: state.bitcoin,
            gold: state.gold,
            bitcoinLoaded,
            results,
            errors: [...state.errors],
            updatedAt: state.lastUpdate
        };
    }

    function getState() {
        return {
            currency: state.currency,
            rates: { ...state.rates },
            bitcoin: state.bitcoin ? { ...state.bitcoin } : null,
            gold: state.gold ? { ...state.gold } : null,
            lastUpdate: state.lastUpdate,
            errors: [...state.errors]
        };
    }

    function getCurrencies() {
        return Object.keys(state.rates)
            .sort()
            .map(code => ({
                code,
                name: CURRENCY_NAMES[code] || code,
                rate: getCurrencyRate(code)
            }));
    }

    function getCountryInfo(iso3) {
        return COUNTRIES[String(iso3).toUpperCase()] || null;
    }

    return {
        loadAll,
        loadCurrencyRates,
        loadFallbackRates,
        loadBitcoin,
        loadBitcoinHistory,
        loadGold,
        loadGoldHistory,
        loadEconomy,
        loadCountryOverview,
        loadCountryList,

        getState,
        getCurrencies,
        getCurrencyRate,
        getCountryInfo,

        getCurrency,
        setCurrency,

        convertFromPLN,
        convertBetweenCurrencies,

        formatMoney,
        formatNumber,
        formatPercent,
        getChangeClass
    };

})();
