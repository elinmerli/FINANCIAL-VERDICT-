
(() => {
  "use strict";

  const API = {
    fx: "https://api.frankfurter.dev/v1",
    nbp: "https://api.nbp.pl/api",
    crypto: "https://api.coinpaprika.com/v1",
    worldBank: "https://api.worldbank.org/v2"
  };

  const currencies = [
    "USD","EUR","GBP","CHF","JPY","PLN","CAD","AUD",
    "CNY","INR","BRL","SEK","NOK","DKK","CZK","HUF"
  ];

  const state = {
    rates: {},
    rateDate: null,
    gold: null,
    bitcoin: null,
    bitcoinHistory: [],
    errors: {},
    updated: null
  };

  async function request(url, source, timeout = 18000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

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

  async function loadRates(base = "EUR") {
    const data = await request(
      `${API.fx}/latest?base=${encodeURIComponent(base)}`,
      "Currency rates"
    );

    if (!data || !data.rates || !data.date) {
      throw new Error("Invalid currency response");
    }

    state.rates = { ...data.rates, [data.base]: 1 };
    state.rateDate = data.date;
    return data;
  }

  function convert(amount, from, to) {
    amount = Number(amount);

    if (!Number.isFinite(amount)) return null;
    if (from === to) return amount;

    const fromRate = state.rates[from];
    const toRate = state.rates[to];

    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) {
      return null;
    }

    return amount * toRate / fromRate;
  }

  async function loadGold() {
    const data = await request(
      `${API.nbp}/cenyzlota/last/30/?format=json`,
      "Gold"
    );

    if (!Array.isArray(data) || !data.length) {
      throw new Error("No gold observations returned");
    }

    const latest = data[data.length - 1];

    state.gold = {
      pricePLN: Number(latest.cena),
      date: latest.data,
      source: "Narodowy Bank Polski"
    };

    return state.gold;
  }

  async function loadBitcoin() {
    const data = await request(
      `${API.crypto}/tickers/btc-bitcoin?quotes=USD`,
      "Bitcoin"
    );

    const quote = data?.quotes?.USD;

    if (!quote || !Number.isFinite(Number(quote.price))) {
      throw new Error("Bitcoin price unavailable");
    }

    state.bitcoin = {
      priceUSD: Number(quote.price),
      change24h: Number(quote.percent_change_24h),
      change7d: Number(quote.percent_change_7d),
      marketCapUSD: Number(quote.market_cap),
      volumeUSD: Number(quote.volume_24h),
      updated: data.last_updated,
      source: "CoinPaprika"
    };

    return state.bitcoin;
  }

  async function loadBitcoinHistory(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);

    const date = start.toISOString().slice(0, 10);
    const url =
      `${API.crypto}/tickers/btc-bitcoin/historical` +
      `?start=${date}&interval=24h&quote=usd&limit=366`;

    const data = await request(url, "Bitcoin history");

    if (!Array.isArray(data)) {
      throw new Error("Invalid Bitcoin history response");
    }

    state.bitcoinHistory = data
      .map(item => ({
        date: item.timestamp,
        priceUSD: Number(item.price)
      }))
      .filter(item => Number.isFinite(item.priceUSD));

    return state.bitcoinHistory;
  }

  async function loadGoldHistory() {
    const data = await request(
      `${API.nbp}/cenyzlota/last/30/?format=json`,
      "Gold history"
    );

    return data.map(item => ({
      date: item.data,
      pricePLN: Number(item.cena)
    }));
  }

  async function loadEconomy(country = "USA") {
    const indicators = {
      inflation: "FP.CPI.TOTL.ZG",
      gdpGrowth: "NY.GDP.MKTP.KD.ZG",
      unemployment: "SL.UEM.TOTL.ZS",
      gdpPerCapita: "NY.GDP.PCAP.CD"
    };

    const result = {};

    await Promise.all(Object.entries(indicators).map(async ([name, code]) => {
      try {
        const url =
          `${API.worldBank}/country/${encodeURIComponent(country)}` +
          `/indicator/${code}?format=json&per_page=20`;

        const response = await request(url, `World Bank ${name}`);
        const rows = response?.[1];

        if (!Array.isArray(rows)) {
          result[name] = null;
          return;
        }

        const latest = rows.find(row => row.value !== null);

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

    const results = await Promise.allSettled([
      loadRates("EUR"),
      loadGold(),
      loadBitcoin(),
      loadBitcoinHistory(30)
    ]);

    state.updated = new Date().toISOString();

    return {
      results,
      errors: { ...state.errors },
      state
    };
  }

  window.ArchiveData = {
    API,
    currencies,
    state,
    request,
    loadRates,
    convert,
    loadGold,
    loadBitcoin,
    loadBitcoinHistory,
    loadGoldHistory,
    loadEconomy,
    refresh
  };
})();
