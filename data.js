
(() => {
  "use strict";

  const API = {
    nbp: "https://api.nbp.pl/api",
    bitcoin: "https://api.coingecko.com/api/v3",
    worldBank: "https://api.worldbank.org/v2",
    binance: "https://api.binance.com/api/v3",
    coinbase: "https://api.exchange.coinbase.com",
    kraken: "https://api.kraken.com/0/public"
  };

  const CACHE_PREFIX = "monetary_archive_v2_";
  const CACHE_TIME = 5 * 60 * 1000;

  const currencies = [
    ["USD", "US Dollar"], ["EUR", "Euro"], ["GBP", "British Pound"],
    ["CHF", "Swiss Franc"], ["JPY", "Japanese Yen"], ["PLN", "Polish Zloty"],
    ["CAD", "Canadian Dollar"], ["AUD", "Australian Dollar"],
    ["CNY", "Chinese Yuan"], ["INR", "Indian Rupee"], ["SEK", "Swedish Krona"],
    ["NOK", "Norwegian Krone"], ["DKK", "Danish Krone"],
    ["CZK", "Czech Koruna"], ["HUF", "Hungarian Forint"],
    ["BRL", "Brazilian Real"], ["MXN", "Mexican Peso"],
    ["SGD", "Singapore Dollar"], ["HKD", "Hong Kong Dollar"],
    ["TRY", "Turkish Lira"], ["ZAR", "South African Rand"]
  ].map(([code, name]) => ({ code, name }));

  const countries = [
    { code:"US", name:"United States", iso:"840", currency:"USD", wb:"USA" },
    { code:"GB", name:"United Kingdom", iso:"826", currency:"GBP", wb:"GBR" },
    { code:"JP", name:"Japan", iso:"392", currency:"JPY", wb:"JPN" },
    { code:"PL", name:"Poland", iso:"616", currency:"PLN", wb:"POL" },
    { code:"DE", name:"Germany", iso:"276", currency:"EUR", wb:"DEU" },
    { code:"FR", name:"France", iso:"250", currency:"EUR", wb:"FRA" },
    { code:"IT", name:"Italy", iso:"380", currency:"EUR", wb:"ITA" },
    { code:"ES", name:"Spain", iso:"724", currency:"EUR", wb:"ESP" },
    { code:"CH", name:"Switzerland", iso:"756", currency:"CHF", wb:"CHE" },
    { code:"CA", name:"Canada", iso:"124", currency:"CAD", wb:"CAN" },
    { code:"AU", name:"Australia", iso:"036", currency:"AUD", wb:"AUS" },
    { code:"CN", name:"China", iso:"156", currency:"CNY", wb:"CHN" },
    { code:"IN", name:"India", iso:"356", currency:"INR", wb:"IND" },
    { code:"BR", name:"Brazil", iso:"076", currency:"BRL", wb:"BRA" },
    { code:"SE", name:"Sweden", iso:"752", currency:"SEK", wb:"SWE" },
    { code:"NO", name:"Norway", iso:"578", currency:"NOK", wb:"NOR" },
    { code:"DK", name:"Denmark", iso:"208", currency:"DKK", wb:"DNK" },
    { code:"CZ", name:"Czechia", iso:"203", currency:"CZK", wb:"CZE" },
    { code:"HU", name:"Hungary", iso:"348", currency:"HUF", wb:"HUN" },
    { code:"RU", name:"Russia", iso:"643", currency:"RUB", wb:"RUS" },
    { code:"KR", name:"South Korea", iso:"410", currency:"KRW", wb:"KOR" },
    { code:"MX", name:"Mexico", iso:"484", currency:"MXN", wb:"MEX" },
    { code:"SG", name:"Singapore", iso:"702", currency:"SGD", wb:"SGP" },
    { code:"TR", name:"Türkiye", iso:"792", currency:"TRY", wb:"TUR" },
    { code:"ZA", name:"South Africa", iso:"710", currency:"ZAR", wb:"ZAF" },
    { code:"NL", name:"Netherlands", iso:"528", currency:"EUR", wb:"NLD" },
    { code:"BE", name:"Belgium", iso:"056", currency:"EUR", wb:"BEL" },
    { code:"AT", name:"Austria", iso:"040", currency:"EUR", wb:"AUT" },
    { code:"IE", name:"Ireland", iso:"372", currency:"EUR", wb:"IRL" },
    { code:"PT", name:"Portugal", iso:"620", currency:"EUR", wb:"PRT" }
  ];

  const stockExchanges = [
    { name:"Nasdaq", country:"United States", city:"New York", code:"NASDAQ", index:"Nasdaq Composite", symbol:"^IXIC", description:"Technology-heavy US stock exchange." },
    { name:"New York Stock Exchange", country:"United States", city:"New York", code:"NYSE", index:"S&P 500", symbol:"^GSPC", description:"One of the world's major equity exchanges." },
    { name:"London Stock Exchange", country:"United Kingdom", city:"London", code:"LSE", index:"FTSE 100", symbol:"^FTSE", description:"Major UK and international listing venue." },
    { name:"Tokyo Stock Exchange", country:"Japan", city:"Tokyo", code:"TSE", index:"Nikkei 225", symbol:"^N225", description:"Japan's principal stock exchange." },
    { name:"Euronext", country:"Europe", city:"Amsterdam / Paris", code:"ENX", index:"Euronext 100", symbol:"", description:"Pan-European exchange group." },
    { name:"Shanghai Stock Exchange", country:"China", city:"Shanghai", code:"SSE", index:"SSE Composite", symbol:"000001.SS", description:"Major mainland Chinese stock exchange." },
    { name:"Hong Kong Exchanges", country:"Hong Kong", city:"Hong Kong", code:"HKEX", index:"Hang Seng", symbol:"^HSI", description:"International financial market in Hong Kong." },
    { name:"Deutsche Börse", country:"Germany", city:"Frankfurt", code:"DB", index:"DAX", symbol:"^GDAXI", description:"German exchange group." }
  ];

  const cryptoExchanges = [
    { name:"Binance", code:"BINANCE", url:"https://www.binance.com", description:"Global cryptocurrency trading venue." },
    { name:"Coinbase Exchange", code:"COINBASE", url:"https://www.coinbase.com/exchange", description:"US-based cryptocurrency exchange." },
    { name:"Kraken", code:"KRAKEN", url:"https://www.kraken.com", description:"Digital asset exchange with public market endpoints." }
  ];

  let dashboard = null;
  let fx = { PLN: 1 };
  let fxDate = null;
  let lastErrors = {};
  let historyCache = {};

  function cached(key) {
    try {
      const item = JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || "null");
      if (item && Date.now() - item.time < CACHE_TIME) return item.value;
    } catch (_) {}
    return null;
  }

  function store(key, value) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ time: Date.now(), value }));
    } catch (_) {}
  }

  async function fetchJSON(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { Accept: "application/json", ...(options.headers || {}) }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function cachedRequest(key, url, maxAge = CACHE_TIME) {
    const old = cached(key);
    if (old) return old;
    const value = await fetchJSON(url);
    store(key, value);
    return value;
  }

  async function loadFX() {
    const old = cached("fx");
    try {
      const data = await fetchJSON(`${API.nbp}/exchangerates/tables/A?format=json`);
      const table = data?.[0];
      if (!table?.rates) throw new Error("NBP returned no rates");

      const next = { PLN: 1 };
      for (const rate of table.rates) {
        if (rate.code && Number.isFinite(Number(rate.mid)) && Number(rate.mid) > 0) {
          next[rate.code] = Number(rate.mid);
        }
      }
      fx = next;
      fxDate = table.effectiveDate;
      store("fx", { rates: fx, date: fxDate });
      lastErrors.fx = null;
      return { rates: fx, date: fxDate, stale: false };
    } catch (error) {
      const saved = old || cached("fx");
      if (saved?.rates) {
        fx = saved.rates;
        fxDate = saved.date;
      }
      lastErrors.fx = error.message;
      if (fxDate) return { rates: fx, date: fxDate, stale: true, error: error.message };
      throw error;
    }
  }

  async function loadGold() {
    const old = cached("gold");
    try {
      const data = await fetchJSON(`${API.nbp}/cenyzlota/?format=json`);
      const row = data?.[0];
      if (!row || !Number.isFinite(Number(row.cena))) throw new Error("Gold price unavailable");
      const result = { plnPerGram: Number(row.cena), date: row.data };
      store("gold", result);
      lastErrors.gold = null;
      return result;
    } catch (error) {
      lastErrors.gold = error.message;
      if (old) return { ...old, stale: true };
      throw error;
    }
  }

  async function loadBitcoin(currency = "usd") {
    const key = "btc_" + currency;
    const old = cached(key);
    try {
      const data = await fetchJSON(
        `${API.bitcoin}/simple/price?ids=bitcoin&vs_currencies=${encodeURIComponent(currency)}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`
      );
      const btc = data?.bitcoin;
      if (!btc || !Number.isFinite(Number(btc[currency]))) throw new Error("Bitcoin data unavailable");
      const result = {
        price: Number(btc[currency]),
        change: Number(btc[currency + "_24h_change"]),
        marketCap: Number(btc[currency + "_market_cap"]),
        volume: Number(btc[currency + "_24h_vol"]),
        currency: currency.toUpperCase(),
        updatedAt: new Date().toISOString()
      };
      store(key, result);
      lastErrors.bitcoin = null;
      return result;
    } catch (error) {
      lastErrors.bitcoin = error.message;
      if (old) return { ...old, stale: true };
      throw error;
    }
  }

  async function loadBitcoinHistory(days = 7, currency = "usd") {
    const key = `btc_history_${days}_${currency}`;
    if (historyCache[key]) return historyCache[key];
    try {
      const data = await fetchJSON(
        `${API.bitcoin}/coins/bitcoin/market_chart?vs_currency=${encodeURIComponent(currency.toLowerCase())}&days=${days}`
      );
      if (!Array.isArray(data.prices)) throw new Error("No historical prices");
      const result = data.prices.map(([time, price]) => ({
        date: new Date(time),
        value: Number(price)
      }));
      historyCache[key] = result;
      return result;
    } catch (error) {
      lastErrors.bitcoinHistory = error.message;
      const saved = cached(key);
      if (saved) return saved;
      throw error;
    }
  }

  async function loadWorldBank(countryCode, indicator) {
    const key = `wb_${countryCode}_${indicator}`;
    try {
      const data = await cachedRequest(
        key,
        `${API.worldBank}/country/${countryCode}/indicator/${indicator}?format=json&per_page=30`
      );
      const observations = data?.[1] || [];
      const row = observations.find(item => item.value !== null);
      if (!row) return null;
      return {
        value: Number(row.value),
        year: row.date,
        country: row.country?.value || countryCode,
        indicator: row.indicator?.value || indicator,
        source: "World Bank"
      };
    } catch (error) {
      lastErrors[key] = error.message;
      return null;
    }
  }

  async function loadEconomy(indicator = "NY.GDP.MKTP.KD.ZG") {
    const results = await Promise.all(countries.map(async country => {
      const record = await loadWorldBank(country.wb, indicator);
      return record ? { ...record, code: country.code, country: country.name } : null;
    }));
    return results.filter(Boolean).sort((a, b) => a.country.localeCompare(b.country));
  }

  async function loadCountryData(code) {
    const country = countries.find(item => item.code === code || item.iso === String(code));
    if (!country) return null;

    const indicators = await Promise.all([
      loadWorldBank(country.wb, "NY.GDP.MKTP.KD.ZG"),
      loadWorldBank(country.wb, "FP.CPI.TOTL.ZG"),
      loadWorldBank(country.wb, "SL.UEM.TOTL.ZS"),
      loadWorldBank(country.wb, "NY.GDP.MKTP.CD")
    ]);

    return {
      ...country,
      gdpGrowth: indicators[0],
      inflation: indicators[1],
      unemployment: indicators[2],
      gdp: indicators[3],
      currencyRate: country.currency === "PLN" ? 1 : fx[country.currency] || null,
      currencyBase: "PLN",
      observationNote: "World Bank indicators may refer to different observation years."
    };
  }

  function convert(amount, from, to) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return null;
    if (!fx[from] || !fx[to]) return null;
    return value * fx[from] / fx[to];
  }

  function format(value, currency = "USD", digits = 2) {
    if (!Number.isFinite(Number(value))) return "Unavailable";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      }).format(Number(value));
    } catch (_) {
      return `${Number(value).toFixed(digits)} ${currency}`;
    }
  }

  function goldIn(currency = "USD", gold) {
    const source = gold || dashboard?.gold;
    if (!source || !fx[currency]) return null;
    return source.plnPerGram / fx[currency];
  }

  async function loadBinanceBTC() {
    const data = await fetchJSON(`${API.binance}/ticker/24hr?symbol=BTCUSDT`);
    return {
      exchange: "Binance",
      pair: "BTC/USDT",
      price: Number(data.lastPrice),
      change: Number(data.priceChangePercent),
      volume: Number(data.quoteVolume),
      source: "Binance public API"
    };
  }

  async function loadCoinbaseBTC() {
    const data = await fetchJSON(`${API.coinbase}/products/BTC-USD/ticker`);
    return {
      exchange: "Coinbase",
      pair: "BTC/USD",
      price: Number(data.price),
      volume: Number(data.volume),
      source: "Coinbase Exchange public API"
    };
  }

  async function loadKrakenBTC() {
    const data = await fetchJSON(`${API.kraken}/Ticker?pair=XBTUSD`);
    const pair = Object.values(data.result || {})[0];
    if (!pair) throw new Error("Kraken returned no ticker");
    return {
      exchange: "Kraken",
      pair: "XBT/USD",
      price: Number(pair.c[0]),
      volume: Number(pair.v[1]),
      source: "Kraken public API"
    };
  }

  async function loadCryptoExchanges() {
    const jobs = [
      ["Binance", loadBinanceBTC],
      ["Coinbase", loadCoinbaseBTC],
      ["Kraken", loadKrakenBTC]
    ];
    return Promise.all(jobs.map(async ([name, fn]) => {
      try {
        return { ...(await fn()), available: true };
      } catch (error) {
        return { exchange: name, available: false, error: error.message };
      }
    }));
  }

  async function loadDashboard(force = false) {
    if (dashboard && !force) return dashboard;

    const old = cached("dashboard");
    const tasks = await Promise.allSettled([
      loadFX(),
      loadGold(),
      loadBitcoin("usd"),
      loadCryptoExchanges()
    ]);

    const value = {
      fx: tasks[0].status === "fulfilled" ? tasks[0].value : old?.fx || null,
      gold: tasks[1].status === "fulfilled" ? tasks[1].value : old?.gold || null,
      bitcoin: tasks[2].status === "fulfilled" ? tasks[2].value : old?.bitcoin || null,
      cryptoExchanges: tasks[3].status === "fulfilled" ? tasks[3].value : old?.cryptoExchanges || [],
      loadedAt: new Date().toISOString(),
      errors: { ...lastErrors }
    };

    dashboard = value;
    if (value.fx || value.gold || value.bitcoin) store("dashboard", value);
    return value;
  }

  function getDashboard() { return dashboard; }
  function getCountry(code) {
    return countries.find(item => item.code === code || item.iso === String(code)) || null;
  }
  function clearCache() {
    Object.keys(localStorage).filter(key => key.startsWith(CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
    dashboard = null;
    historyCache = {};
  }

  window.ArchiveData = {
    version: "2.0.0",
    currencies,
    countries,
    stockExchanges,
    cryptoExchanges,
    loadDashboard,
    loadFX,
    loadGold,
    loadBitcoin,
    loadBitcoinHistory,
    loadEconomy,
    loadCountryData,
    loadCryptoExchanges,
    convert,
    format,
    goldIn,
    getCountry,
    getDashboard,
    clearCache,
    get fx() { return fx; },
    get fxDate() { return fxDate; },
    get errors() { return { ...lastErrors }; }
  };
})();
