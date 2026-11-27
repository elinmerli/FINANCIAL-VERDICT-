
/* =========================================================
   THE MONETARY ARCHIVE
   DATA ENGINE
   ========================================================= */

(function () {
    "use strict";

    const CONFIG = {
        cacheDuration: 5 * 60 * 1000,
        requestTimeout: 15000,

        endpoints: {
            nbp: "https://api.nbp.pl/api",
            coinGecko: "https://api.coingecko.com/api/v3",
            worldBank: "https://api.worldbank.org/v2"
        },

        currencies: [
            "USD", "EUR", "GBP", "CHF", "JPY",
            "CAD", "AUD", "CNY", "INR", "BRL",
            "SEK", "NOK", "DKK", "CZK", "HUF",
            "PLN", "TRY", "MXN", "SGD", "NZD",
            "KRW", "ZAR", "ILS", "THB", "RON",
            "BGN", "ISK", "HKD", "MYR", "PHP"
        ],

        countryNames: {
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
        }
    };


    const cache = new Map();

    let currentRates = null;
    let currentGold = null;
    let currentBitcoin = null;


    /* =====================================================
       HELPERS
    ===================================================== */

    function nowISO() {
        return new Date().toISOString();
    }


    function validNumber(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }


    function normalizeCode(code) {
        return String(code || "").trim().toUpperCase();
    }


    function formatDate(date) {
        if (!date) return "Unavailable";

        const parsed = new Date(date);

        if (Number.isNaN(parsed.getTime())) {
            return String(date);
        }

        return parsed.toLocaleDateString();
    }


    function cacheGet(key) {
        const item = cache.get(key);

        if (!item) return null;

        if (Date.now() - item.timestamp > CONFIG.cacheDuration) {
            cache.delete(key);
            return null;
        }

        return item.value;
    }


    function cacheSet(key, value) {
        cache.set(key, {
            timestamp: Date.now(),
            value: value
        });
    }


    async function request(url, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(
            () => controller.abort(),
            CONFIG.requestTimeout
        );

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

            return await response.json();

        } finally {
            clearTimeout(timeout);
        }
    }


    async function cachedRequest(key, url, maxAge = CONFIG.cacheDuration) {
        const existing = cache.get(key);

        if (
            existing &&
            Date.now() - existing.timestamp < maxAge
        ) {
            return existing.value;
        }

        const value = await request(url);

        cacheSet(key, value);

        return value;
    }


    function createResult(value, source, observationDate, updatedAt) {
        return {
            value: validNumber(value),
            source: source || "Unknown",
            observationDate: observationDate || null,
            updatedAt: updatedAt || nowISO(),
            available: validNumber(value) !== null
        };
    }


    function unavailable(source, error) {
        return {
            value: null,
            source: source,
            observationDate: null,
            updatedAt: nowISO(),
            available: false,
            error: error ? error.message : "Data unavailable"
        };
    }


    /* =====================================================
       NBP EXCHANGE RATES
    ===================================================== */

    async function fetchNBPRates() {
        const key = "nbp-rates";

        const cached = cacheGet(key);

        if (cached) {
            currentRates = cached;
            return cached;
        }

        const url =
            `${CONFIG.endpoints.nbp}/exchangerates/tables/A?format=json`;

        const data = await request(url);

        if (!Array.isArray(data) || !data[0] || !data[0].rates) {
            throw new Error("Invalid NBP exchange-rate response.");
        }

        const table = data[0];

        const rates = {
            PLN: 1,
            date: table.effectiveDate,
            source: "National Bank of Poland",
            updatedAt: nowISO(),
            values: {}
        };

        table.rates.forEach(function (item) {
            const code = normalizeCode(item.code);
            const value = validNumber(item.mid);

            if (code && value !== null) {
                rates.values[code] = value;
            }
        });

        rates.values.PLN = 1;

        cacheSet(key, rates);
        currentRates = rates;

        return rates;
    }


    async function fetchNBPPreviousRates() {
        const key = "nbp-rates-previous";

        const cached = cacheGet(key);

        if (cached) return cached;

        const url =
            `${CONFIG.endpoints.nbp}/exchangerates/tables/A/last/2?format=json`;

        const data = await request(url);

        if (!Array.isArray(data) || data.length < 2) {
            throw new Error("Previous NBP rates are unavailable.");
        }

        const previousTable = data[data.length - 2];

        const values = {
            PLN: 1
        };

        previousTable.rates.forEach(function (item) {
            values[normalizeCode(item.code)] = validNumber(item.mid);
        });

        cacheSet(key, values);

        return values;
    }


    function convertCurrency(amount, from, to, rates) {
        const value = validNumber(amount);

        if (value === null || value < 0) {
            throw new Error("Enter a valid non-negative amount.");
        }

        const source = normalizeCode(from);
        const target = normalizeCode(to);

        const rateData = rates || currentRates;

        if (!rateData || !rateData.values) {
            throw new Error("Exchange rates are not loaded.");
        }

        const sourceRate = rateData.values[source];
        const targetRate = rateData.values[target];

        if (
            !Number.isFinite(sourceRate) ||
            !Number.isFinite(targetRate) ||
            sourceRate <= 0 ||
            targetRate <= 0
        ) {
            throw new Error(
                `Exchange rate unavailable for ${source} or ${target}.`
            );
        }

        const amountInPLN = value * sourceRate;

        return amountInPLN / targetRate;
    }


    async function getExchangeRates() {
        const [current, previous] = await Promise.all([
            fetchNBPRates(),
            fetchNBPPreviousRates().catch(() => null)
        ]);

        const rows = Object.entries(current.values)
            .map(function ([code, rate]) {
                const previousRate = previous
                    ? validNumber(previous[code])
                    : null;

                let change = null;

                if (
                    previousRate !== null &&
                    previousRate !== 0
                ) {
                    change =
                        ((rate - previousRate) / previousRate) * 100;
                }

                return {
                    code: code,
                    rate: rate,
                    previousRate: previousRate,
                    change: change,
                    source: current.source,
                    date: current.date
                };
            });

        return {
            base: "PLN",
            date: current.date,
            updatedAt: current.updatedAt,
            source: current.source,
            rows: rows,
            values: current.values
        };
    }


    /* =====================================================
       NBP GOLD
    ===================================================== */

    async function fetchGoldCurrent() {
        const key = "nbp-gold-current";

        const cached = cacheGet(key);

        if (cached) {
            currentGold = cached;
            return cached;
        }

        const url =
            `${CONFIG.endpoints.nbp}/cenyzlota?format=json`;

        const data = await request(url);

        if (!Array.isArray(data) || !data.length) {
            throw new Error("NBP gold data is unavailable.");
        }

        const latest = data[data.length - 1];

        const result = {
            pricePerGramPLN: validNumber(latest.cena),
            date: latest.data,
            source: "National Bank of Poland",
            updatedAt: nowISO()
        };

        if (result.pricePerGramPLN === null) {
            throw new Error("Invalid gold price.");
        }

        cacheSet(key, result);
        currentGold = result;

        return result;
    }


    async function fetchGoldHistory(days = 30) {
        const count = Math.max(
            1,
            Math.min(365, Number(days) || 30)
        );

        const key = `nbp-gold-history-${count}`;

        const cached = cacheGet(key);

        if (cached) return cached;

        const url =
            `${CONFIG.endpoints.nbp}/cenyzlota/last/${count}?format=json`;

        const data = await request(url);

        if (!Array.isArray(data)) {
            throw new Error("Invalid gold history.");
        }

        const result = data.map(function (item) {
            return {
                date: item.data,
                value: validNumber(item.cena)
            };
        }).filter(item => item.value !== null);

        cacheSet(key, result);

        return result;
    }


    /* =====================================================
       BITCOIN / COINGECKO
    ===================================================== */

    async function fetchBitcoinCurrent(currency = "usd") {
        const code = normalizeCode(currency).toLowerCase();
        const key = `bitcoin-current-${code}`;

        const cached = cacheGet(key);

        if (cached) {
            currentBitcoin = cached;
            return cached;
        }

        const url =
            `${CONFIG.endpoints.coinGecko}/simple/price` +
            `?ids=bitcoin&vs_currencies=${encodeURIComponent(code)}` +
            `&include_market_cap=true&include_24hr_vol=true` +
            `&include_24hr_change=true&include_last_updated_at=true`;

        const data = await request(url);

        if (!data.bitcoin) {
            throw new Error("Bitcoin data is unavailable.");
        }

        const coin = data.bitcoin;

        const result = {
            currency: code.toUpperCase(),
            price: validNumber(coin[code]),
            marketCap: validNumber(coin[`${code}_market_cap`]),
            volume24h: validNumber(coin[`${code}_24h_vol`]),
            change24h: validNumber(coin[`${code}_24h_change`]),
            timestamp: coin.last_updated_at
                ? new Date(coin.last_updated_at * 1000).toISOString()
                : null,
            source: "CoinGecko",
            updatedAt: nowISO()
        };

        cacheSet(key, result);
        currentBitcoin = result;

        return result;
    }


    async function fetchBitcoinHistory(
        currency = "usd",
        days = 7
    ) {
        const code = normalizeCode(currency).toLowerCase();

        const validDays = [1, 7, 30, 90, 365].includes(Number(days))
            ? Number(days)
            : 7;

        const key = `bitcoin-history-${code}-${validDays}`;

        const cached = cacheGet(key);

        if (cached) return cached;

        const url =
            `${CONFIG.endpoints.coinGecko}/coins/bitcoin/market_chart` +
            `?vs_currency=${encodeURIComponent(code)}` +
            `&days=${validDays}`;

        const data = await request(url);

        if (!Array.isArray(data.prices)) {
            throw new Error("Bitcoin history is unavailable.");
        }

        const result = data.prices.map(function (item) {
            return {
                date: new Date(item[0]).toISOString(),
                value: validNumber(item[1])
            };
        }).filter(item => item.value !== null);

        cacheSet(key, result);

        return result;
    }


    /* =====================================================
       WORLD BANK INDICATORS
    ===================================================== */

    const INDICATORS = {
        gdp: "NY.GDP.MKTP.KD.ZG",
        inflation: "FP.CPI.TOTL.ZG",
        unemployment: "SL.UEM.TOTL.ZS",
        gdpPerCapita: "NY.GDP.PCAP.CD",
        population: "SP.POP.TOTL"
    };


    async function fetchWorldBankIndicator(
        countryCode,
        indicator,
        startYear = 2010,
        endYear = new Date().getFullYear()
    ) {
        const country = normalizeCode(countryCode);
        const indicatorCode = INDICATORS[indicator] || indicator;

        if (!/^[A-Z]{2,3}$/.test(country)) {
            throw new Error("Invalid country code.");
        }

        const start = Math.max(1960, Number(startYear) || 2010);
        const end = Math.min(
            new Date().getFullYear(),
            Number(endYear) || new Date().getFullYear()
        );

        const key =
            `wb-${country}-${indicatorCode}-${start}-${end}`;

        const cached = cacheGet(key);

        if (cached) return cached;

        const url =
            `${CONFIG.endpoints.worldBank}/country/${country}` +
            `/indicator/${indicatorCode}` +
            `?date=${start}:${end}&format=json&per_page=100`;

        const data = await request(url);

        if (!Array.isArray(data) || !Array.isArray(data[1])) {
            throw new Error("World Bank returned invalid indicator data.");
        }

        const result = data[1]
            .filter(item => item.value !== null)
            .map(item => ({
                year: Number(item.date),
                value: validNumber(item.value),
                country: item.country ? item.country.value : country,
                source: "World Bank"
            }))
            .filter(item => item.value !== null)
            .sort((a, b) => a.year - b.year);

        cacheSet(key, result);

        return result;
    }


    async function fetchCountryEconomy(countryCode) {
        const indicators = [
            "gdp",
            "inflation",
            "unemployment",
            "gdpPerCapita",
            "population"
        ];

        const entries = await Promise.allSettled(
            indicators.map(name =>
                fetchWorldBankIndicator(countryCode, name, 2010)
            )
        );

        const result = {};

        indicators.forEach(function (name, index) {
            const entry = entries[index];

            result[name] = entry.status === "fulfilled"
                ? entry.value
                : [];
        });

        return result;
    }


    async function fetchCountryComparisons(countries) {
        const list = countries || [
            "PL", "US", "GB", "DE", "FR",
            "CH", "JP", "CN", "IN", "BR"
        ];

        return Promise.all(
            list.map(async function (code) {
                const economy = await fetchCountryEconomy(code);

                return {
                    code: code,
                    name: CONFIG.countryNames[code] || code,
                    economy: economy
                };
            })
        );
    }


    /* =====================================================
       DASHBOARD DATA
    ===================================================== */

    async function safeLoad(promise, source) {
        try {
            return await promise;
        } catch (error) {
            console.error(`[ArchiveData] ${source}:`, error);

            return {
                available: false,
                error: error.message,
                source: source
            };
        }
    }


    async function loadDashboard(countryCode = "PL", currency = "USD") {
        const results = await Promise.all([
            safeLoad(getExchangeRates(), "NBP exchange rates"),
            safeLoad(fetchGoldCurrent(), "NBP gold"),
            safeLoad(fetchBitcoinCurrent(currency.toLowerCase()), "CoinGecko"),
            safeLoad(
                fetchCountryEconomy(countryCode),
                "World Bank indicators"
            )
        ]);

        return {
            rates: results[0],
            gold: results[1],
            bitcoin: results[2],
            economy: results[3],
            country: countryCode,
            displayCurrency: currency,
            updatedAt: nowISO()
        };
    }


    /* =====================================================
       DISPLAY CURRENCY CONVERSION
    ===================================================== */

    async function getCurrencyRate(from, to) {
        const rates = await fetchNBPRates();

        return convertCurrency(1, from, to, rates);
    }


    async function convertValue(amount, from, to) {
        const rates = await fetchNBPRates();

        return convertCurrency(amount, from, to, rates);
    }


    async function convertPLNValue(amountPLN, targetCurrency) {
        return convertValue(amountPLN, "PLN", targetCurrency);
    }


    /* =====================================================
       COUNTRY PROFILE HELPERS
    ===================================================== */

    async function getCountryProfile(countryCode) {
        const code = normalizeCode(countryCode);

        const economy = await fetchCountryEconomy(code);

        const latest = {};

        Object.keys(economy).forEach(function (key) {
            const values = economy[key];

            latest[key] = values.length
                ? values[values.length - 1]
                : null;
        });

        return {
            code: code,
            name: CONFIG.countryNames[code] || code,
            currency: getCountryCurrency(code),
            economy: latest,
            source: "World Bank",
            updatedAt: nowISO()
        };
    }


    function getCountryCurrency(code) {
        const currencies = {
            PL: "PLN",
            US: "USD",
            GB: "GBP",
            DE: "EUR",
            FR: "EUR",
            CH: "CHF",
            JP: "JPY",
            CN: "CNY",
            IN: "INR",
            BR: "BRL",
            CA: "CAD",
            AU: "AUD",
            IT: "EUR",
            ES: "EUR",
            NL: "EUR",
            SE: "SEK",
            NO: "NOK",
            DK: "DKK",
            CZ: "CZK",
            HU: "HUF"
        };

        return currencies[code] || "Unavailable";
    }


    /* =====================================================
       CACHE MANAGEMENT
    ===================================================== */

    function clearCache() {
        cache.clear();

        currentRates = null;
        currentGold = null;
        currentBitcoin = null;

        try {
            localStorage.removeItem("monetaryArchiveCache");
        } catch (_) {
            // Storage can be disabled by the browser.
        }
    }


    function getCacheInfo() {
        return {
            entries: cache.size,
            duration: CONFIG.cacheDuration
        };
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.ArchiveData = Object.freeze({

        config: CONFIG,

        getExchangeRates,
        fetchNBPRates,
        fetchNBPPreviousRates,

        convertCurrency,
        convertValue,
        convertPLNValue,
        getCurrencyRate,

        fetchGoldCurrent,
        fetchGoldHistory,

        fetchBitcoinCurrent,
        fetchBitcoinHistory,

        fetchWorldBankIndicator,
        fetchCountryEconomy,
        fetchCountryComparisons,
        getCountryProfile,

        loadDashboard,

        clearCache,
        getCacheInfo,

        formatDate,
        nowISO

    });

})();
