
(function () {
    "use strict";

    const CACHE_TIME = 5 * 60 * 1000;
    const cache = new Map();

    const state = {
        currencies: [],
        ratesPLN: { PLN: 1 },
        rateDate: null,
        gold: null,
        bitcoin: null,
        lastUpdated: null
    };

    const currencyNames = {
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

    function readCache(key) {
        const item = cache.get(key);

        if (!item) return null;

        if (Date.now() - item.time > CACHE_TIME) {
            cache.delete(key);
            return null;
        }

        return item.value;
    }

    function writeCache(key, value) {
        cache.set(key, {
            time: Date.now(),
            value
        });
    }

    async function request(url, cacheKey) {
        if (cacheKey) {
            const cached = readCache(cacheKey);
            if (cached) return cached;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { "Accept": "application/json" }
            });

            if (!response.ok) {
                throw new Error("Request failed: " + response.status);
            }

            const result = await response.json();

            if (cacheKey) writeCache(cacheKey, result);

            return result;
        } finally {
            clearTimeout(timeout);
        }
    }

    function round(value, digits = 4) {
        const number = Number(value);
        if (!Number.isFinite(number)) return null;

        return Number(number.toFixed(digits));
    }

    function formatNumber(value, digits = 2) {
        const number = Number(value);

        if (!Number.isFinite(number)) return "Unavailable";

        return new Intl.NumberFormat("en-US", {
            maximumFractionDigits: digits
        }).format(number);
    }

    function formatMoney(value, currency, digits = 2) {
        const number = Number(value);

        if (!Number.isFinite(number)) return "Unavailable";

        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: currency || "USD",
                maximumFractionDigits: digits
            }).format(number);
        } catch {
            return formatNumber(number, digits) + " " + (currency || "");
        }
    }

    function formatDate(value) {
        if (!value) return "Unavailable";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) return String(value);

        return new Intl.DateTimeFormat("en-GB", {
            year: "numeric",
            month: "short",
            day: "2-digit"
        }).format(date);
    }

    async function loadCurrencies(force = false) {
        if (force) cache.delete("nbp-table");

        const data = await request(
            "https://api.nbp.pl/api/exchangerates/tables/A/?format=json",
            "nbp-table"
        );

        if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0].rates)) {
            throw new Error("Unexpected NBP currency response.");
        }

        const table = data[0];
        const rates = { PLN: 1 };

        table.rates.forEach(item => {
            if (item.code && Number(item.mid) > 0) {
                rates[item.code] = Number(item.mid);
            }
        });

        state.ratesPLN = rates;
        state.rateDate = table.effectiveDate;
        state.currencies = Object.keys(rates).map(code => ({
            code,
            name: currencyNames[code] || code,
            ratePLN: rates[code]
        }));

        return state.currencies;
    }

    function convert(amount, from, to) {
        const value = Number(amount);

        if (!Number.isFinite(value)) return null;

        const fromRate = state.ratesPLN[from];
        const toRate = state.ratesPLN[to];

        if (!fromRate || !toRate) return null;

        const valueInPLN = value * fromRate;

        return valueInPLN / toRate;
    }

    function toDisplayCurrency(amountPLN, currency) {
        return convert(amountPLN, "PLN", currency);
    }

    function getCurrencyRows() {
        return state.currencies.map(item => ({
            ...item,
            selectedRate: convert(1, item.code, window.ArchiveData.displayCurrency || "USD")
        }));
    }

    async function loadGold(force = false) {
        if (force) cache.delete("nbp-gold");

        const data = await request(
            "https://api.nbp.pl/api/cenyzlota/?format=json",
            "nbp-gold"
        );

        if (!Array.isArray(data) || !data[0]) {
            throw new Error("Unexpected NBP gold response.");
        }

        const item = data[0];

        state.gold = {
            date: item.data,
            pricePLNPerGram: Number(item.cena),
            source: "National Bank of Poland"
        };

        return state.gold;
    }

    async function loadBitcoin(force = false) {
        if (force) cache.delete("bitcoin-current");

        const data = await request(
            "https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false",
            "bitcoin-current"
        );

        const market = data.market_data;

        if (!market) throw new Error("Bitcoin market data is unavailable.");

        state.bitcoin = {
            name: data.name,
            symbol: data.symbol,
            usd: market.current_price.usd,
            change24h: market.price_change_percentage_24h,
            marketCapUSD: market.market_cap.usd,
            volumeUSD: market.total_volume.usd,
            highUSD: market.high_24h.usd,
            lowUSD: market.low_24h.usd,
            circulatingSupply: market.circulating_supply,
            updatedAt: data.last_updated
        };

        return state.bitcoin;
    }

    async function loadBitcoinHistory(days = 7, currency = "usd", force = false) {
        const key = "bitcoin-history-" + days + "-" + currency;

        if (force) cache.delete(key);

        const data = await request(
            "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=" +
            encodeURIComponent(currency.toLowerCase()) +
            "&days=" + encodeURIComponent(days),
            key
        );

        if (!Array.isArray(data.prices)) {
            throw new Error("Bitcoin historical prices are unavailable.");
        }

        return data.prices.map(point => ({
            date: new Date(point[0]),
            value: Number(point[1])
        }));
    }

    async function loadEconomy(iso3) {
        const indicators = {
            GDP: "NY.GDP.MKTP.KD.ZG",
            inflation: "FP.CPI.TOTL.ZG",
            unemployment: "SL.UEM.TOTL.ZS",
            population: "SP.POP.TOTL"
        };

        const result = {};

        await Promise.all(Object.entries(indicators).map(async ([key, indicator]) => {
            const url =
                "https://api.worldbank.org/v2/country/" +
                encodeURIComponent(iso3) +
                "/indicator/" +
                indicator +
                "?format=json&per_page=1&mrv=1";

            try {
                const response = await request(url, null);
                const row = Array.isArray(response) && response[1] && response[1][0]
                    ? response[1][0]
                    : null;

                result[key] = row && row.value !== null
                    ? {
                        value: Number(row.value),
                        year: row.date,
                        source: "World Bank"
                    }
                    : null;
            } catch {
                result[key] = null;
            }
        }));

        return result;
    }

    async function loadEconomyHistory(iso3, indicator) {
        const url =
            "https://api.worldbank.org/v2/country/" +
            encodeURIComponent(iso3) +
            "/indicator/" +
            encodeURIComponent(indicator) +
            "?format=json&per_page=30";

        const response = await request(url, null);

        if (!Array.isArray(response) || !Array.isArray(response[1])) {
            return [];
        }

        return response[1]
            .filter(row => row.value !== null)
            .map(row => ({
                date: row.date,
                value: Number(row.value)
            }))
            .reverse();
    }

    async function loadGoldHistory() {
        const url = "https://api.nbp.pl/api/cenyzlota/last/30/?format=json";
        const data = await request(url, null);

        if (!Array.isArray(data)) return [];

        return data.map(item => ({
            date: item.data,
            value: Number(item.cena)
        }));
    }

    async function loadCurrencyHistory(code, startDate, endDate) {
        if (code === "PLN") return [];

        const url =
            "https://api.nbp.pl/api/exchangerates/rates/A/" +
            encodeURIComponent(code.toLowerCase()) +
            "/" + startDate + "/" + endDate +
            "/?format=json";

        const data = await request(url, null);

        if (!data || !Array.isArray(data.rates)) return [];

        return data.rates.map(item => ({
            date: item.effectiveDate,
            value: Number(item.mid)
        }));
    }

    function clearCache() {
        cache.clear();
    }

    window.ArchiveData = {
        state,
        currencyNames,
        displayCurrency: "USD",
        loadCurrencies,
        loadGold,
        loadBitcoin,
        loadBitcoinHistory,
        loadEconomy,
        loadEconomyHistory,
        loadGoldHistory,
        loadCurrencyHistory,
        getCurrencyRows,
        convert,
        toDisplayCurrency,
        formatNumber,
        formatMoney,
        formatDate,
        clearCache,
        round
    };
})();
