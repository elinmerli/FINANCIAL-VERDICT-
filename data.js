/* ==========================================================
   THE MONETARY ARCHIVE — DATA ENGINE
   Sources: NBP, CoinGecko, World Bank
   No fabricated fallback market values.
========================================================== */

(() => {
  "use strict";

  const API = {
    nbp: "https://api.nbp.pl/api",
    coin: "https://api.coingecko.com/api/v3",
    worldBank: "https://api.worldbank.org/v2"
  };

  const CACHE_PREFIX = "monetary_archive_v2_";
  const CACHE_TIME = 5 * 60 * 1000;

  const state = {
    ratesPLN: { PLN: 1 },
    rateNames: {},
    rateDate: null,
    goldPLN: null,
    goldDate: null,
    bitcoin: null,
    bitcoinHistory: {},
    economy: {}
  };

  const currencyNames = {
    USD: "US Dollar", EUR: "Euro", GBP: "Pound Sterling",
    CHF: "Swiss Franc", JPY: "Japanese Yen", PLN: "Polish Zloty",
    CAD: "Canadian Dollar", AUD: "Australian Dollar",
    CNY: "Chinese Yuan", INR: "Indian Rupee", BRL: "Brazilian Real",
    SEK: "Swedish Krona", NOK: "Norwegian Krone",
    DKK: "Danish Krone", CZK: "Czech Koruna", HUF: "Hungarian Forint",
    TRY: "Turkish Lira", KRW: "South Korean Won",
    MXN: "Mexican Peso", SGD: "Singapore Dollar",
    HKD: "Hong Kong Dollar", NZD: "New Zealand Dollar",
    RON: "Romanian Leu", BGN: "Bulgarian Lev",
    ISK: "Icelandic Krona", ZAR: "South African Rand"
  };

  async function request(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16000);

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
        throw new Error(`Request failed (${response.status})`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function cacheRead(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.time > CACHE_TIME) return null;

      return parsed.data;
    } catch {
      return null;
    }
  }

  function cacheWrite(key, data) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ time: Date.now(), data })
      );
    } catch {
      // Storage may be unavailable or full. Data still works without it.
    }
  }

  async function cachedRequest(key, url, force = false) {
    if (!force) {
      const cached = cacheRead(key);
      if (cached) return cached;
    }

    const data = await request(url);
    cacheWrite(key, data);
    return data;
  }

  async function loadCurrencies(force = false) {
    const [tableA, tableB] = await Promise.all([
      cachedRequest(
        "nbp_table_a",
        `${API.nbp}/exchangerates/tables/A?format=json`,
        force
      ),
      cachedRequest(
        "nbp_table_b",
        `${API.nbp}/exchangerates/tables/B?format=json`,
        force
      )
    ]);

    const tables = [...tableA, ...tableB];
    const rates = { PLN: 1 };
    const names = { PLN: "Polish Zloty" };
    let latestDate = null;

    for (const table of tables) {
      if (!latestDate || table.effectiveDate > latestDate) {
        latestDate = table.effectiveDate;
      }

      for (const item of table.rates || []) {
        if (!item.code || !Number.isFinite(Number(item.mid))) continue;
        rates[item.code] = Number(item.mid);
        names[item.code] = item.currency || currencyNames[item.code] || item.code;
      }
    }

    state.ratesPLN = rates;
    state.rateNames = names;
    state.rateDate = latestDate;

    return getCurrencyRows();
  }

  function getCurrencyRows() {
    return Object.entries(state.ratesPLN)
      .map(([code, valuePLN]) => ({
        code,
        name: state.rateNames[code] || currencyNames[code] || code,
        valuePLN,
        date: state.rateDate,
        source: code === "PLN" ? "NBP BASE" : "NBP TABLE A/B"
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  function convert(amount, from, to) {
    const value = Number(amount);
    if (!Number.isFinite(value)) throw new Error("Enter a valid amount.");

    const fromRate = state.ratesPLN[from];
    const toRate = state.ratesPLN[to];

    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || toRate === 0) {
      throw new Error("A reference rate for this currency is unavailable.");
    }

    return value * fromRate / toRate;
  }

  async function loadGold(force = false) {
    const data = await cachedRequest(
      "nbp_gold",
      `${API.nbp}/cenyzlota/last/30?format=json`,
      force
    );

    if (!Array.isArray(data) || !data.length) {
      throw new Error("Gold reference data is unavailable.");
    }

    const latest = data[data.length - 1];
    state.goldPLN = Number(latest.cena);
    state.goldDate = latest.data;

    return {
      pricePLNPerGram: state.goldPLN,
      date: state.goldDate,
      source: "NBP"
    };
  }

  async function loadBitcoin(currency = "usd", force = false) {
    const key = `btc_market_${currency.toLowerCase()}`;
    const url = `${API.coin}/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;

    const data = await cachedRequest(key, url, force);
    const market = data.market_data;

    if (!market || !market.current_price) {
      throw new Error("Bitcoin market data is unavailable.");
    }

    const price = market.current_price[currency.toLowerCase()];
    const marketCap = market.market_cap[currency.toLowerCase()];
    const volume = market.total_volume[currency.toLowerCase()];
    const high = market.high_24h[currency.toLowerCase()];
    const low = market.low_24h[currency.toLowerCase()];

    state.bitcoin = {
      name: data.name,
      symbol: data.symbol,
      price,
      change24h: market.price_change_percentage_24h,
      marketCap,
      volume,
      high,
      low,
      supply: market.circulating_supply,
      updated: data.last_updated,
      currency: currency.toUpperCase()
    };

    return state.bitcoin;
  }

  async function loadBitcoinHistory(days = 30, currency = "usd", force = false) {
    const key = `btc_history_${days}_${currency.toLowerCase()}`;
    const url = `${API.coin}/coins/bitcoin/market_chart?vs_currency=${encodeURIComponent(currency.toLowerCase())}&days=${encodeURIComponent(days)}&interval=${days > 90 ? "daily" : "hourly"}`;

    const data = await cachedRequest(key, url, force);

    if (!Array.isArray(data.prices)) {
      throw new Error("Bitcoin historical prices are unavailable.");
    }

    state.bitcoinHistory[key] = data.prices.map(([timestamp, price]) => ({
      timestamp,
      date: new Date(timestamp),
      price: Number(price)
    }));

    return state.bitcoinHistory[key];
  }

  async function loadEconomy(iso3, force = false) {
    const country = String(iso3 || "").toUpperCase();
    if (!/^[A-Z]{3}$/.test(country)) {
      throw new Error("Invalid country code.");
    }

    const indicators = {
      gdp: "NY.GDP.MKTP.KD.ZG",
      inflation: "FP.CPI.TOTL.ZG",
      unemployment: "SL.UEM.TOTL.ZS"
    };

    const result = {};

    await Promise.all(
      Object.entries(indicators).map(async ([key, indicator]) => {
        const cacheKey = `wb_${country}_${indicator}`;
        const url = `${API.worldBank}/country/${country}/indicator/${indicator}?format=json&per_page=30`;

        try {
          const data = await cachedRequest(cacheKey, url, force);
          const rows = Array.isArray(data) && Array.isArray(data[1])
            ? data[1]
            : [];

          const valid = rows
            .filter(row => row.value !== null && Number.isFinite(Number(row.value)))
            .sort((a, b) => Number(b.date) - Number(a.date));

          result[key] = valid.length
            ? {
                value: Number(valid[0].value),
                year: valid[0].date,
                source: "World Bank"
              }
            : null;
        } catch {
          result[key] = null;
        }
      })
    );

    state.economy[country] = result;
    return result;
  }

  async function loadEconomyHistory(iso3, force = false) {
    const country = String(iso3 || "").toUpperCase();
    const indicators = {
      gdp: "NY.GDP.MKTP.KD.ZG",
      inflation: "FP.CPI.TOTL.ZG",
      unemployment: "SL.UEM.TOTL.ZS"
    };

    const series = {};

    await Promise.all(
      Object.entries(indicators).map(async ([key, indicator]) => {
        const cacheKey = `wb_history_${country}_${indicator}`;
        const url = `${API.worldBank}/country/${country}/indicator/${indicator}?format=json&per_page=35`;

        try {
          const data = await cachedRequest(cacheKey, url, force);
          const rows = Array.isArray(data) && Array.isArray(data[1])
            ? data[1]
            : [];

          series[key] = rows
            .filter(row => row.value !== null && Number.isFinite(Number(row.value)))
            .map(row => ({
              year: Number(row.date),
              value: Number(row.value)
            }))
            .sort((a, b) => a.year - b.year);
        } catch {
          series[key] = [];
        }
      })
    );

    return series;
  }

  function toDisplayCurrency(amountPLN, currency) {
    const rate = state.ratesPLN[currency];
    if (!Number.isFinite(rate) || rate === 0) return null;
    return amountPLN / rate;
  }

  function formatMoney(value, currency, maximumFractionDigits = 2) {
    if (!Number.isFinite(Number(value))) return "Unavailable";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits,
        minimumFractionDigits: maximumFractionDigits > 0 ? 2 : 0
      }).format(value);
    } catch {
      return `${Number(value).toFixed(2)} ${currency}`;
    }
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(Number(value))) return "Unavailable";
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits
    }).format(value);
  }

  function formatDate(date) {
    if (!date) return "Unavailable";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date);

    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function clearCache() {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(CACHE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
    } catch {
      // Nothing else required.
    }
  }

  window.ArchiveData = {
    state,
    currencyNames,
    loadCurrencies,
    getCurrencyRows,
    convert,
    loadGold,
    loadBitcoin,
    loadBitcoinHistory,
    loadEconomy,
    loadEconomyHistory,
    toDisplayCurrency,
    formatMoney,
    formatNumber,
    formatDate,
    clearCache
  };
})();
