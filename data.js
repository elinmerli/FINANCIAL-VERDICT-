/* THE MONETARY ARCHIVE — DATA ENGINE */
(() => {
  "use strict";

  const API = {
    fx: "https://api.frankfurter.dev/v1",
    nbp: "https://api.nbp.pl/api",
    crypto: "https://api.coinpaprika.com/v1",
    worldBank: "https://api.worldbank.org/v2"
  };

  const supported = [
    "USD","EUR","GBP","CHF","JPY","PLN","CAD","AUD",
    "CNY","INR","BRL","SEK","NOK","DKK","CZK","HUF"
  ];

  const state = {
    rates: {},
    rateDate: null,
    gold: null,
    goldDate: null,
    bitcoin: null,
    bitcoinHistory: [],
    economy: {},
    errors: {},
    lastUpdated: null
  };

  async function get(url, source, timeout = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`${source}: HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      state.errors[source] = error.message || "Ошибка соединения";
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadRates(base = "EUR") {
    const url = `${API.fx}/latest?base=${encodeURIComponent(base)}`;
    const data = await get(url, "Валюты");

    if (!data || !data.rates || !data.date) {
      throw new Error("Сервис валют вернул некорректные данные");
    }

    state.rates = {
      ...data.rates,
      [data.base]: 1
    };
    state.rateDate = data.date;
    return data;
  }

  function convert(amount, from, to) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;
    if (from === to) return value;

    const rates = state.rates;
    const fromRate = rates[from];
    const toRate = rates[to];

    if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || toRate === 0) {
      return null;
    }

    return value * toRate / fromRate;
  }

  async function loadGold() {
    const data = await get(
      `${API.nbp}/cenyzlota/last/30/?format=json`,
      "Золото"
    );

    if (!Array.isArray(data) || !data.length) {
      throw new Error("NBP не вернул данные о золоте");
    }

    const latest = data[data.length - 1];

    state.gold = {
      plnPerGram: Number(latest.cena),
      date: latest.data,
      source: "Narodowy Bank Polski"
    };
    state.goldDate = latest.data;

    return state.gold;
  }

  async function loadBitcoin() {
    const data = await get(
      `${API.crypto}/tickers/btc-bitcoin?quotes=USD`,
      "Bitcoin"
    );

    const quote = data?.quotes?.USD;
    if (!quote || !Number.isFinite(Number(quote.price))) {
      throw new Error("Сервис Bitcoin вернул неполные данные");
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
    start.setDate(start.getDate() - Number(days));

    const date = start.toISOString().slice(0, 10);
    const url =
      `${API.crypto}/tickers/btc-bitcoin/historical` +
      `?start=${date}&interval=24h&quote=usd&limit=366`;

    const data = await get(url, "История Bitcoin");

    if (!Array.isArray(data)) {
      throw new Error("История Bitcoin недоступна");
    }

    state.bitcoinHistory = data
      .map(item => ({
        date: item.timestamp,
        price: Number(item.price)
      }))
      .filter(item => Number.isFinite(item.price));

    return state.bitcoinHistory;
  }

  async function loadGoldHistory() {
    const data = await get(
      `${API.nbp}/cenyzlota/last/30/?format=json`,
      "История золота"
    );

    return data.map(item => ({
      date: item.data,
      pricePLN: Number(item.cena)
    }));
  }

  async function loadEconomy(country = "USA") {
    const indicators = {
      inflation: "FP.CPI.TOTL.ZG",
      gdp: "NY.GDP.MKTP.KD.ZG",
      unemployment: "SL.UEM.TOTL.ZS",
      gdpPerCapita: "NY.GDP.PCAP.CD"
    };

    const result = {};

    await Promise.all(Object.entries(indicators).map(async ([key, code]) => {
      try {
        const url =
          `${API.worldBank}/country/${encodeURIComponent(country)}` +
          `/indicator/${code}?format=json&per_page=20`;

        const response = await get(url, `Экономика: ${key}`);
        const rows = response?.[1];

        if (!Array.isArray(rows)) {
          result[key] = null;
          return;
        }

        const latest = rows.find(row => row.value !== null);

        result[key] = latest ? {
          value: Number(latest.value),
          year: latest.date,
          country: latest.country?.value || country,
          indicator: code,
          source: "World Bank"
        } : null;
      } catch {
        result[key] = null;
      }
    }));

    state.economy[country] = result;
    return result;
  }

  async function loadCountryProfile(country) {
    const [economy] = await Promise.all([
      loadEconomy(country)
    ]);

    return {
      country,
      economy,
      currency: null,
      source: "World Bank"
    };
  }

  async function refresh() {
    state.errors = {};

    const tasks = await Promise.allSettled([
      loadRates("EUR"),
      loadGold(),
      loadBitcoin(),
      loadBitcoinHistory(30)
    ]);

    state.lastUpdated = new Date().toISOString();

    return {
      results: tasks,
      state,
      errors: { ...state.errors }
    };
  }

  window.ArchiveData = {
    state,
    supported,
    get,
    loadRates,
    convert,
    loadGold,
    loadBitcoin,
    loadBitcoinHistory,
    loadGoldHistory,
    loadEconomy,
    loadCountryProfile,
    refresh
  };
})();
