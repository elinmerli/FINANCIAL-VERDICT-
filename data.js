/* THE MONETARY ARCHIVE — public-data engine. No API keys. */

(() => {
  "use strict";

  const API = {
    nbp: "https://api.nbp.pl/api",
    wb: "https://api.worldbank.org/v2",
    coin: "https://api.coingecko.com/api/v3"
  };

  const COUNTRIES = {
    US: { name: "United States", wb: "USA", currency: "USD", exchanges: ["New York Stock Exchange (NYSE)", "NASDAQ"] },
    GB: { name: "United Kingdom", wb: "GBR", currency: "GBP", exchanges: ["London Stock Exchange"] },
    JP: { name: "Japan", wb: "JPN", currency: "JPY", exchanges: ["Tokyo Stock Exchange"] },
    DE: { name: "Germany", wb: "DEU", currency: "EUR", exchanges: ["Frankfurt Stock Exchange · Xetra"] },
    FR: { name: "France", wb: "FRA", currency: "EUR", exchanges: ["Euronext Paris"] },
    CN: { name: "China", wb: "CHN", currency: "CNY", exchanges: ["Shanghai Stock Exchange", "Shenzhen Stock Exchange"] },
    IN: { name: "India", wb: "IND", currency: "INR", exchanges: ["National Stock Exchange of India", "BSE"] },
    CA: { name: "Canada", wb: "CAN", currency: "CAD", exchanges: ["Toronto Stock Exchange"] },
    AU: { name: "Australia", wb: "AUS", currency: "AUD", exchanges: ["Australian Securities Exchange"] },
    CH: { name: "Switzerland", wb: "CHE", currency: "CHF", exchanges: ["SIX Swiss Exchange"] },
    BR: { name: "Brazil", wb: "BRA", currency: "BRL", exchanges: ["B3"] },
    PL: { name: "Poland", wb: "POL", currency: "PLN", exchanges: ["Warsaw Stock Exchange"] },
    KR: { name: "South Korea", wb: "KOR", currency: "KRW", exchanges: ["Korea Exchange"] },
    SG: { name: "Singapore", wb: "SGP", currency: "SGD", exchanges: ["Singapore Exchange"] },
    MX: { name: "Mexico", wb: "MEX", currency: "MXN", exchanges: ["Bolsa Mexicana de Valores"] },
    ZA: { name: "South Africa", wb: "ZAF", currency: "ZAR", exchanges: ["Johannesburg Stock Exchange"] },
    SE: { name: "Sweden", wb: "SWE", currency: "SEK", exchanges: ["Nasdaq Stockholm"] },
    NO: { name: "Norway", wb: "NOR", currency: "NOK", exchanges: ["Oslo Børs"] },
    DK: { name: "Denmark", wb: "DNK", currency: "DKK", exchanges: ["Nasdaq Copenhagen"] },
    CZ: { name: "Czechia", wb: "CZE", currency: "CZK", exchanges: ["Prague Stock Exchange"] },
    HU: { name: "Hungary", wb: "HUN", currency: "HUF", exchanges: ["Budapest Stock Exchange"] },
    TR: { name: "Türkiye", wb: "TUR", currency: "TRY", exchanges: ["Borsa Istanbul"] },
    ID: { name: "Indonesia", wb: "IDN", currency: "IDR", exchanges: ["Indonesia Stock Exchange"] },
    TH: { name: "Thailand", wb: "THA", currency: "THB", exchanges: ["Stock Exchange of Thailand"] },
    NZ: { name: "New Zealand", wb: "NZL", currency: "NZD", exchanges: ["New Zealand Exchange"] },
    AR: { name: "Argentina", wb: "ARG", currency: "ARS", exchanges: ["BYMA"] },
    NG: { name: "Nigeria", wb: "NGA", currency: "NGN", exchanges: ["Nigerian Exchange"] },
    EG: { name: "Egypt", wb: "EGY", currency: "EGP", exchanges: ["Egyptian Exchange"] },
    RU: { name: "Russian Federation", wb: "RUS", currency: "RUB", exchanges: ["Moscow Exchange"] },
    UA: { name: "Ukraine", wb: "UKR", currency: "UAH", exchanges: ["PFTS / Ukrainian Exchange"] }
  };

  const CURRENCIES = [
    "USD", "EUR", "GBP", "CHF", "JPY", "CAD", "AUD",
    "CNY", "INR", "BRL", "PLN", "SEK", "NOK", "DKK",
    "CZK", "HUF", "KRW", "SGD", "MXN", "ZAR", "TRY",
    "IDR", "THB", "NZD", "ARS", "NGN", "EGP", "RUB", "UAH"
  ];

  const cache = new Map();

  let dashboard = null;
  let loading = null;
  let lastSuccess = null;

  async function getJSON(url, ttl = 300000) {
    const cached = cache.get(url);

    if (cached && Date.now() - cached.at < ttl) {
      return cached.data;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 16000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      cache.set(url, {
        at: Date.now(),
        data
      });

      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  const num = value => {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    return Number.isFinite(Number(value))
      ? Number(value)
      : null;
  };

  /* NATIONAL BANK OF POLAND */

  async function nbp() {
    const [tableResult, goldResult] = await Promise.allSettled([
      getJSON(`${API.nbp}/exchangerates/tables/a/?format=json`),
      getJSON(`${API.nbp}/cenyzlota/last/1/?format=json`)
    ]);

    if (
      tableResult.status !== "fulfilled" ||
      !tableResult.value?.[0]?.rates
    ) {
      throw new Error("NBP rate table unavailable");
    }

    const table = tableResult.value[0];

    const gold = goldResult.status === "fulfilled"
      ? goldResult.value
      : null;

    const plnPerUnit = {
      PLN: 1
    };

    for (const item of table.rates) {
      plnPerUnit[item.code] = num(item.mid);
    }

    return {
      plnPerUnit,
      tableDate: table.effectiveDate,
      tableNo: table.no,

      goldPLNPerGram: num(gold?.[0]?.cena),
      goldDate: gold?.[0]?.data,

      rates: table.rates.map(item => ({
        code: item.code,
        name: item.currency,
        pln: num(item.mid)
      })),

      goldError: goldResult.status === "rejected"
        ? goldResult.reason.message
        : null
    };
  }

  /* COINGECKO */

  async function bitcoin() {
    const [spotResult, historyResult] = await Promise.allSettled([
      getJSON(
        `${API.coin}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true`,
        120000
      ),

      getJSON(
        `${API.coin}/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily`,
        600000
      )
    ]);

    if (spotResult.status !== "fulfilled") {
      throw spotResult.reason;
    }

    const bitcoinData = spotResult.value.bitcoin;

    if (!bitcoinData || !Number.isFinite(bitcoinData.usd)) {
      throw new Error("Bitcoin price unavailable");
    }

    const history = historyResult.status === "fulfilled"
      ? historyResult.value
      : null;

    return {
      usd: bitcoinData.usd,

      change24h: num(bitcoinData.usd_24h_change),

      marketCapUsd: num(bitcoinData.usd_market_cap),

      volume24hUsd: num(bitcoinData.usd_24h_vol),

      updatedAt: bitcoinData.last_updated_at
        ? new Date(bitcoinData.last_updated_at * 1000).toISOString()
        : new Date().toISOString(),

      history: (history?.prices || [])
        .map(item => ({
          time: item[0],
          value: num(item[1])
        }))
        .filter(item => item.value !== null),

      historyError: historyResult.status === "rejected"
        ? historyResult.reason.message
        : null
    };
  }

  /* WORLD BANK */

  const wbToIso = Object.fromEntries(
    Object.entries(COUNTRIES).map(([iso, country]) => [
      country.wb,
      iso
    ])
  );

  async function wbIndicator(iso, indicator) {
    const country = COUNTRIES[iso];

    if (!country) {
      throw new Error("Country profile is not configured");
    }

    const url =
      `${API.wb}/country/${country.wb}/indicator/${indicator}?format=json&per_page=5`;

    const data = await getJSON(url, 3600000);

    return (data?.[1] || [])
      .filter(item => item.value !== null)
      .map(item => ({
        country: iso,
        countryName: country.name,
        indicator,
        indicatorName: item.indicator?.value || indicator,
        value: num(item.value),
        year: String(item.date),
        date: String(item.date),
        unit: "%",
        source: "World Bank"
      }))
      .filter(item => item.value !== null)
      .sort((a, b) => b.year - a.year);
  }

  async function economics() {
    const codes = {
      inflation: "FP.CPI.TOTL.ZG",
      gdp: "NY.GDP.MKTP.KD.ZG",
      unemployment: "SL.UEM.TOTL.ZS"
    };

    const countryList = Object.values(COUNTRIES)
      .map(country => country.wb)
      .join(";");

    const jobs = Object.entries(codes);

    const results = await Promise.allSettled(
      jobs.map(([kind, indicator]) =>
        getJSON(
          `${API.wb}/country/${countryList}/indicator/${indicator}?format=json&per_page=2000`,
          3600000
        )
      )
    );

    const records = [];
    const failures = [];

    results.forEach((result, index) => {
      const [kind, indicator] = jobs[index];

      if (result.status !== "fulfilled") {
        failures.push(
          `${kind}: ${result.reason?.message || "unavailable"}`
        );
        return;
      }

      const rows = result.value?.[1] || [];

      for (const item of rows) {
        if (item.value === null) {
          continue;
        }

        const iso = wbToIso[item.country?.id];

        if (!iso) {
          continue;
        }

        records.push({
          country: iso,
          countryName: COUNTRIES[iso].name,
          indicator,
          indicatorName: item.indicator?.value || indicator,
          value: num(item.value),
          year: String(item.date),
          date: String(item.date),
          unit: "%",
          source: "World Bank",
          kind
        });
      }
    });

    return {
      records: records.filter(item => item.value !== null),
      failures
    };
  }

  /* MAIN DASHBOARD */

  async function loadDashboard(force = false) {
    if (loading) {
      return loading;
    }

    if (
      !force &&
      dashboard &&
      Date.now() - dashboard.checkedAt < 300000
    ) {
      return dashboard;
    }

    loading = (async () => {
      const [fx, btc, econ] = await Promise.allSettled([
        nbp(),
        bitcoin(),
        economics()
      ]);

      const data = {
        checkedAt: Date.now(),
        generatedAt: new Date().toISOString(),

        fx: fx.status === "fulfilled"
          ? fx.value
          : null,

        bitcoin: btc.status === "fulfilled"
          ? btc.value
          : null,

        economy: econ.status === "fulfilled"
          ? econ.value.records
          : [],

        errors: {
          fx: fx.status === "rejected"
            ? fx.reason.message
            : null,

          bitcoin: btc.status === "rejected"
            ? btc.reason.message
            : null,

          economy: econ.status === "rejected"
            ? econ.reason.message
            : null
        },

        sources: [
          {
            name: "National Bank of Poland",
            status: fx.status === "fulfilled" ? "online" : "error",
            date: fx.status === "fulfilled"
              ? fx.value.tableDate
              : null,
            error: fx.status === "rejected"
              ? fx.reason.message
              : null
          },

          {
            name: "CoinGecko",
            status: btc.status === "fulfilled" ? "online" : "error",
            date: btc.status === "fulfilled"
              ? btc.value.updatedAt
              : null,
            error: btc.status === "rejected"
              ? btc.reason.message
              : null
          },

          {
            name: "World Bank",
            status: econ.status === "fulfilled" ? "online" : "error",
            date: null,
            error: econ.status === "rejected"
              ? econ.reason.message
              : null
          }
        ]
      };

      if (
        !data.fx &&
        !data.bitcoin &&
        !data.economy.length &&
        lastSuccess
      ) {
        return lastSuccess;
      }

      dashboard = data;

      if (data.fx || data.bitcoin || data.economy.length) {
        lastSuccess = data;
      }

      return data;
    })().finally(() => {
      loading = null;
    });

    return loading;
  }

  /* CURRENCY CONVERSION */

  function rate(currency, fx = dashboard?.fx) {
    if (currency === "PLN") {
      return 1;
    }

    return fx?.plnPerUnit?.[currency] ?? null;
  }

  function convert(amount, from, to, fx = dashboard?.fx) {
    const value = num(amount);
    const fromRate = rate(from, fx);
    const toRate = rate(to, fx);

    if (
      value === null ||
      fromRate === null ||
      toRate === null ||
      toRate === 0
    ) {
      return null;
    }

    return value * fromRate / toRate;
  }

  function format(value, currency = "USD", digits = 2) {
    if (!Number.isFinite(value)) {
      return "—";
    }

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      }).format(value);
    } catch {
      return `${value.toFixed(digits)} ${currency}`;
    }
  }

  /* GOLD */

  function goldIn(currency, fx = dashboard?.fx) {
    if (!fx || !Number.isFinite(fx.goldPLNPerGram)) {
      return null;
    }

    const perGram = convert(
      fx.goldPLNPerGram,
      "PLN",
      currency,
      fx
    );

    return perGram === null
      ? null
      : perGram * 31.1034768;
  }

  /* COUNTRY DATA */

  function getCountry(code) {
    return COUNTRIES[code] || null;
  }

  async function getCountryData(code) {
    const country = getCountry(code);

    if (!country) {
      throw new Error("Country profile is not configured");
    }

    const definitions = {
      "GDP growth": "NY.GDP.MKTP.KD.ZG",
      "Inflation": "FP.CPI.TOTL.ZG",
      "Unemployment": "SL.UEM.TOTL.ZS"
    };

    const results = await Promise.allSettled(
      Object.entries(definitions).map(([name, indicator]) =>
        wbIndicator(code, indicator).then(rows => ({
          name,
          latest: rows[0] || null,
          history: rows
        }))
      )
    );

    return {
      country,

      indicators: results
        .filter(result => result.status === "fulfilled")
        .map(result => result.value),

      errors: results
        .filter(result => result.status === "rejected")
        .map(result => result.reason.message)
    };
  }

  /* BITCOIN HISTORY */

  async function getBitcoinHistory(days = 30) {
    const safeDays = Math.max(
      1,
      Math.min(365, Number(days) || 30)
    );

    const data = await getJSON(
      `${API.coin}/coins/bitcoin/market_chart?vs_currency=usd&days=${safeDays}&interval=daily`,
      600000
    );

    return (data.prices || [])
      .map(item => ({
        time: item[0],
        value: num(item[1])
      }))
      .filter(item => item.value !== null);
  }

  /* PUBLIC INTERFACE */

  window.ArchiveData = Object.freeze({
    version: "2.0.0",

    currencies: CURRENCIES,
    countries: COUNTRIES,

    loadDashboard,
    convert,
    format,
    goldIn,

    getCountry,
    getCountryData,
    getBitcoinHistory,

    clearCache() {
      cache.clear();
      dashboard = null;
    },

    getDashboard: () => dashboard
  });

})();
