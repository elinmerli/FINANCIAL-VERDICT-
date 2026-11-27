
"use strict";

window.ArchiveData = (() => {
  const state = {
    rates: {},
    rateDate: null,
    gold: null,
    goldDate: null,
    bitcoin: null,
    bitcoinHistory: [],
    goldHistory: [],
    fxHistory: [],
    cache: new Map()
  };

  const currencies = [
    "USD", "EUR", "GBP", "CHF", "JPY", "PLN",
    "CAD", "AUD", "CNY", "INR", "BRL", "SEK",
    "NOK", "DKK", "CZK", "HUF"
  ];

  const names = {
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

  async function request(url, cacheSeconds = 60) {
    const cached = state.cache.get(url);

    if (cached && Date.now() - cached.time < cacheSeconds * 1000) {
      return cached.value;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      state.cache.set(url, {
        time: Date.now(),
        value: result
      });

      return result;
    } finally {
      clearTimeout(timeout);
    }
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  }

  function number(value, digits = 2) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "Unavailable";
    }

    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits
    }).format(Number(value));
  }

  function money(value, currency) {
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
      return `${number(value)} ${currency}`;
    }
  }

  async function loadRates(base = "EUR") {
    const data = await request(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`,
      300
    );

    state.rates = {
      [base]: 1,
      ...data.rates
    };

    state.rateDate = data.date;

    return {
      base,
      date: data.date,
      rates: state.rates
    };
  }

  function convert(value, from, to) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) return null;
    if (from === to) return amount;

    const rates = state.rates;

    if (!rates[from] || !rates[to]) return null;

    return amount / rates[from] * rates[to];
  }

  async function loadGold() {
    const data = await request(
      "https://api.nbp.pl/api/cenyzlota/last/30/?format=json",
      3600
    );

    if (!Array.isArray(data) || !data.length) {
      throw new Error("Gold data is unavailable.");
    }

    const latest = data[data.length - 1];

    state.gold = Number(latest.cena);
    state.goldDate = latest.data;

    state.goldHistory = data.map(item => ({
      date: item.data,
      value: Number(item.cena)
    }));

    return {
      value: state.gold,
      date: state.goldDate,
      history: state.goldHistory
    };
  }

  async function loadBitcoin(currency = "usd") {
    const id = "bitcoin";
    const quote = currency.toLowerCase();

    const data = await request(
      `https://api.coincap.io/v2/assets/${id}`,
      60
    );

    const asset = data.data;

    const usdPrice = Number(asset.priceUsd);
    const usdMarketCap = Number(asset.marketCapUsd);
    const usdVolume = Number(asset.volumeUsd24Hr);
    const change = Number(asset.changePercent24Hr);

    const conversion = quote === "usd"
      ? 1
      : await getUsdConversion(quote);

    state.bitcoin = {
      usdPrice,
      price: usdPrice * conversion,
      marketCap: usdMarketCap * conversion,
      volume: usdVolume * conversion,
      change,
      symbol: quote.toUpperCase(),
      updated: asset.changePercent24Hr !== undefined
        ? new Date().toISOString()
        : null
    };

    return state.bitcoin;
  }

  async function getUsdConversion(currency) {
    if (currency === "usd") return 1;

    const data = await request(
      `https://api.frankfurter.app/latest?from=USD&to=${currency.toUpperCase()}`,
      300
    );

    const rate = data.rates[currency.toUpperCase()];

    if (!rate) {
      throw new Error(`No USD conversion rate for ${currency}.`);
    }

    return Number(rate);
  }

  async function loadBitcoinHistory(days = 30, currency = "usd") {
    const interval = days <= 1 ? "m5" : "h1";
    const start = Date.now() - Number(days) * 24 * 60 * 60 * 1000;

    const url =
      `https://api.coincap.io/v2/assets/bitcoin/history` +
      `?interval=${interval}&start=${start}&end=${Date.now()}`;

    const data = await request(url, 180);

    let conversion = 1;

    if (currency.toLowerCase() !== "usd") {
      conversion = await getUsdConversion(currency.toLowerCase());
    }

    const history = (data.data || []).map(item => ({
      date: new Date(item.time).toLocaleDateString(),
      timestamp: item.time,
      value: Number(item.priceUsd) * conversion
    }));

    state.bitcoinHistory = history;
    return history;
  }

  async function loadGoldHistory(days = 30, currency = "USD") {
    const start = dateDaysAgo(days);
    const end = today();

    const data = await request(
      `https://api.nbp.pl/api/cenyzlota/${start}/${end}/?format=json`,
      3600
    );

    let conversion = 1;

    if (currency !== "PLN") {
      const rates = await request(
        `https://api.frankfurter.app/latest?from=PLN&to=${currency}`,
        300
      );

      conversion = rates.rates[currency];

      if (!conversion) throw new Error("Gold currency conversion unavailable.");
    }

    const history = data.map(item => ({
      date: item.data,
      value: Number(item.cena) * conversion
    }));

    state.goldHistory = history;
    return history;
  }

  async function loadFxHistory(currency, days = 30) {
    const start = dateDaysAgo(days);
    const end = today();

    const data = await request(
      `https://api.frankfurter.app/${start}..${end}?from=EUR&to=${currency}`,
      600
    );

    const history = Object.entries(data.rates || {}).map(([date, rates]) => ({
      date,
      value: Number(rates[currency])
    }));

    state.fxHistory = history;
    return history;
  }

  async function loadEconomy(country) {
    const indicators = {
      inflation: "FP.CPI.TOTL.ZG",
      gdp: "NY.GDP.MKTP.KD.ZG",
      unemployment: "SL.UEM.TOTL.ZS"
    };

    const result = {};

    for (const [key, indicator] of Object.entries(indicators)) {
      const url =
        `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}` +
        `?format=json&per_page=20`;

      const response = await request(url, 3600);
      const rows = response[1] || [];

      const valid = rows.find(row =>
        row.value !== null && Number.isFinite(Number(row.value))
      );

      result[key] = valid
        ? { value: Number(valid.value), year: valid.date }
        : null;
    }

    return result;
  }

  async function loadCountryProfile(country) {
    const [economy, rates] = await Promise.allSettled([
      loadEconomy(country),
      loadRates("EUR")
    ]);

    return {
      economy: economy.status === "fulfilled" ? economy.value : null,
      rates: rates.status === "fulfilled" ? rates.value : null
    };
  }

  function getCurrencies() {
    return currencies.map(code => ({
      code,
      name: names[code] || code
    }));
  }

  return {
    state,
    currencies,
    names,
    request,
    number,
    money,
    loadRates,
    convert,
    loadGold,
    loadBitcoin,
    loadBitcoinHistory,
    loadGoldHistory,
    loadFxHistory,
    loadEconomy,
    loadCountryProfile,
    getCurrencies,
    dateDaysAgo,
    today
  };
})();
