
(() => {
  "use strict";

  const BASE = {
    fx: "https://api.frankfurter.dev/v1",
    nbp: "https://api.nbp.pl/api",
    crypto: "https://api.coinpaprika.com/v1",
    world: "https://api.worldbank.org/v2"
  };

  const currencies = [
    "USD", "EUR", "GBP", "CHF", "JPY", "PLN", "CAD", "AUD",
    "CNY", "INR", "BRL", "SEK", "NOK", "DKK", "CZK", "HUF"
  ];

  const state = {
    rates: {},
    rateDate: null,
    gold: null,
    goldHistory: [],
    bitcoin: null,
    bitcoinHistory: [],
    errors: {},
    updated: null
  };

  async function get(url, source, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      state.errors[source] = error.name === "AbortError"
        ? "Request timed out"
        : error.message;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadRates() {
    const data = await get(`${BASE.fx}/latest?base=EUR`, "Exchange rates");

    if (!data || !data.rates || !data.date) {
      throw new Error("Invalid exchange-rate response");
    }

    state.rates = { ...data.rates, EUR: 1 };
    state.rateDate = data.date;
    return data;
  }

  function convert(amount, from, to) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return null;
    if (from === to) return n;

    const a = state.rates[from];
    const b = state.rates[to];

    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return n / a * b;
  }

  async function loadGold() {
    const rows = await get(
      `${BASE.nbp}/cenyzlota/last/30/?format=json`,
      "Gold"
    );

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error("No gold data returned");
    }

    state.goldHistory = rows.map(row => ({
      date: row.data,
      pricePLN: Number(row.cena)
    })).filter(row => Number.isFinite(row.pricePLN));

    const latest = state.goldHistory[state.goldHistory.length - 1];

    state.gold = {
      pricePLN: latest.pricePLN,
      date: latest.date,
      source: "Narodowy Bank Polski"
    };

    return state.gold;
  }

  async function loadBitcoin() {
    const data = await get(
      `${BASE.crypto}/tickers/btc-bitcoin?quotes=USD`,
      "Bitcoin"
    );

    const q = data && data.quotes && data.quotes.USD;
    if (!q || !Number.isFinite(Number(q.price))) {
      throw new Error("Bitcoin quote is unavailable");
    }

    state.bitcoin = {
      priceUSD: Number(q.price),
      change24h: Number(q.percent_change_24h),
      change7d: Number(q.percent_change_7d),
      marketCapUSD: Number(q.market_cap),
      volumeUSD: Number(q.volume_24h),
      updated: data.last_updated,
      source: "CoinPaprika"
    };

    return state.bitcoin;
  }

  async function loadBitcoinHistory(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const date = start.toISOString().slice(0, 10);

    const url = `${BASE.crypto}/tickers/btc-bitcoin/historical?start=${date}&interval=24h&quote=usd`;
    const rows = await get(url, "Bitcoin history");

    if (!Array.isArray(rows)) throw new Error("Invalid history response");

    state.bitcoinHistory = rows.map(row => ({
      date: row.timestamp,
      priceUSD: Number(row.price)
    })).filter(row => Number.isFinite(row.priceUSD));

    return state.bitcoinHistory;
  }

  async function loadEconomy(countryCode) {
    const indicators = {
      inflation: "FP.CPI.TOTL.ZG",
      gdpGrowth: "NY.GDP.MKTP.KD.ZG",
      unemployment: "SL.UEM.TOTL.ZS",
      gdpPerCapita: "NY.GDP.PCAP.CD"
    };

    const result = {};

    await Promise.all(Object.entries(indicators).map(async ([name, code]) => {
      try {
        const url = `${BASE.world}/country/${encodeURIComponent(countryCode)}/indicator/${code}?format=json&per_page=20`;
        const response = await get(url, `World Bank ${name}`);
        const rows = response && response[1];
        const latest = Array.isArray(rows)
          ? rows.find(row => row.value !== null)
          : null;

        result[name] = latest ? {
          value: Number(latest.value),
          year: latest.date,
          source: "World Bank",
          indicator: code
        } : null;
      } catch {
        result[name] = null;
      }
    }));

    return result;
  }

  async function refresh() {
    state.errors = {};

    const tasks = await Promise.allSettled([
      loadRates(),
      loadGold(),
      loadBitcoin(),
      loadBitcoinHistory(30)
    ]);

    state.updated = new Date().toISOString();

    return {
      tasks,
      errors: { ...state.errors },
      state
    };
  }

  window.ArchiveData = {
    BASE,
    currencies,
    state,
    get,
    loadRates,
    convert,
    loadGold,
    loadBitcoin,
    loadBitcoinHistory,
    loadEconomy,
    refresh
  };
})();
