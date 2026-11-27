
"use strict";

(() => {
  const D = window.ArchiveData;

  if (!D) {
    console.error("ArchiveData module is missing.");
    return;
  }

  const $ = id => document.getElementById(id);

  const state = {
    currency: "USD",
    charts: {},
    archiveRows: [],
    loadedPages: new Set(),
    loading: new Set()
  };

  const pageTitles = {
    overview: "Overview",
    globe: "Global Globe",
    currencies: "Currencies",
    markets: "Markets & Bitcoin",
    economy: "Inflation & Economy",
    calculators: "Calculators",
    archive: "Historical Archive",
    exchanges: "Exchanges"
  };

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function formatMoney(value) {
    return D.money(value, state.currency);
  }

  function showError(id, message) {
    const element = $(id);
    if (element) element.textContent = message;
  }

  function chart(id, labels, values, label) {
    const canvas = $(id);
    if (!canvas || typeof Chart === "undefined") return;

    if (state.charts[id]) {
      state.charts[id].destroy();
    }

    state.charts[id] = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: "#b19b6d",
          backgroundColor: "rgba(168,149,104,.09)",
          fill: true,
          tension: 0.25,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index"
        },
        plugins: {
          legend: {
            labels: {
              color: "#b9b3a5",
              boxWidth: 12
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#999487", maxTicksLimit: 8 },
            grid: { color: "rgba(153,148,135,.08)" }
          },
          y: {
            ticks: { color: "#999487" },
            grid: { color: "rgba(153,148,135,.08)" }
          }
        }
      }
    });
  }

  function setConnection(status, text) {
    const element = $("connection-status");
    if (!element) return;

    element.className = "status " + status;
    element.textContent = text;
  }

  function openPage(name) {
    if (!pageTitles[name]) return;

    document.querySelectorAll(".page").forEach(page => {
      page.classList.remove("active");
    });

    document.querySelectorAll(".nav-button").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === name
      );
    });

    const page = $("page-" + name);
    if (page) page.classList.add("active");

    setText("page-title", pageTitles[name]);

    if (name === "globe") {
      setTimeout(() => initializeGlobe("main-globe"), 100);
    }

    if (name === "overview") {
      setTimeout(() => initializeGlobe("overview-globe"), 100);
    }

    loadPage(name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadPage(name) {
    if (state.loadedPages.has(name) || state.loading.has(name)) return;

    state.loading.add(name);

    try {
      if (name === "overview") await loadOverview();
      if (name === "currencies") await loadCurrencies();
      if (name === "markets") await loadMarkets();
      if (name === "economy") await loadEconomy();
      if (name === "exchanges") loadExchanges();

      state.loadedPages.add(name);
    } catch (error) {
      console.error(`Page ${name} failed:`, error);
    } finally {
      state.loading.delete(name);
    }
  }

  async function initializeGlobe(id) {
    if (!window.ArchiveGlobe) return;

    const existing = window.ArchiveGlobe.get(id);
    if (existing) return;

    await window.ArchiveGlobe.create(id, {
      onCountryClick: feature => showCountry(feature)
    });
  }

  async function showCountry(feature) {
    const name = feature.properties?.name || "Unknown country";
    setText("country-name", name);
    setText("country-details", "Loading available country records...");

    const details = $("country-details");

    try {
      const profile = await D.loadCountryProfile(
        feature.properties?.iso_a3 || ""
      );

      if (!details) return;

      if (!profile.economy) {
        details.textContent = "Economic records are currently unavailable.";
        return;
      }

      const entries = [
        ["Inflation", profile.economy.inflation],
        ["GDP growth", profile.economy.gdp],
        ["Unemployment", profile.economy.unemployment]
      ];

      details.innerHTML = "";

      entries.forEach(([label, item]) => {
        const row = document.createElement("div");
        row.className = "country-stat";

        const left = document.createElement("span");
        left.textContent = label;

        const right = document.createElement("span");
        right.textContent = item
          ? `${D.number(item.value, 2)}% · ${item.year}`
          : "No available observation";

        row.append(left, right);
        details.appendChild(row);
      });

      const note = document.createElement("p");
      note.className = "source-note";
      note.textContent = "Source: World Bank. Latest available observation; not necessarily the current year.";
      details.appendChild(note);

    } catch (error) {
      if (details) {
        details.textContent = "No country records could be retrieved.";
      }
    }
  }

  async function loadOverview() {
    initializeGlobe("overview-globe");

    const results = await Promise.allSettled([
      D.loadRates("EUR"),
      D.loadGold(),
      D.loadBitcoin(state.currency),
      D.loadBitcoinHistory(30, state.currency),
      D.loadGoldHistory(30, state.currency),
      D.loadEconomy("USA")
    ]);

    const rates = results[0].status === "fulfilled"
      ? results[0].value
      : null;

    const gold = results[1].status === "fulfilled"
      ? results[1].value
      : null;

    const bitcoin = results[2].status === "fulfilled"
      ? results[2].value
      : null;

    if (bitcoin) {
      setText("overview-btc", formatMoney(bitcoin.price));
      setText("overview-btc-change", `${D.number(bitcoin.change, 2)}% over 24 hours`);
      setText("overview-updated", new Date().toLocaleTimeString());
    } else {
      setText("overview-btc", "Unavailable");
    }

    if (gold) {
      let goldValue = gold.value;

      if (state.currency !== "PLN") {
        try {
          const converted = D.convert(goldValue, "PLN", state.currency);
          goldValue = converted;
        } catch {
          goldValue = null;
        }
      }

      setText(
        "overview-gold",
        goldValue === null ? "Unavailable" : formatMoney(goldValue)
      );
    } else {
      setText("overview-gold", "Unavailable");
    }

    if (rates) {
      const usdPerEur = rates.rates.USD;
      setText("overview-usdeur", usdPerEur ? `1 EUR = ${D.number(usdPerEur, 4)} USD` : "Unavailable");
      setText("fx-date", `REFERENCE DATE: ${rates.date}`);

      renderOverviewCurrencies(rates);
    } else {
      setText("overview-usdeur", "Unavailable");
    }

    if (results[3].status === "fulfilled") {
      const history = results[3].value;
      chart(
        "overview-btc-chart",
        history.map(item => item.date),
        history.map(item => item.value),
        `Bitcoin (${state.currency})`
      );
    }

    if (results[4].status === "fulfilled") {
      const history = results[4].value;
      chart(
        "overview-gold-chart",
        history.map(item => item.date),
        history.map(item => item.value),
        `Gold (${state.currency}) per gram`
      );
    }

    if (results[5].status === "fulfilled") {
      renderEconomySummary(results[5].value);
    }

    setText(
      "overview-source",
      "Sources: Frankfurter / ECB reference exchange rates; NBP gold prices; CoinCap Bitcoin data; World Bank economic indicators. Publication frequency differs by source."
    );

    setConnection(
      results.some(item => item.status === "fulfilled") ? "online" : "error",
      results.some(item => item.status === "fulfilled")
        ? "Data sources connected"
        : "Data unavailable"
    );
  }

  function renderOverviewCurrencies(data) {
    const body = $("overview-currencies");
    if (!body) return;

    body.innerHTML = "";

    ["USD", "GBP", "CHF", "JPY", "PLN", "CAD", "AUD"].forEach(code => {
      const value = data.rates[code];

      const row = document.createElement("tr");

      [code, value ? D.number(value, 4) : "Unavailable", "per EUR"]
        .forEach(text => {
          const cell = document.createElement("td");
          cell.textContent = text;
          row.appendChild(cell);
        });

      body.appendChild(row);
    });
  }

  function renderEconomySummary(data) {
    const container = $("overview-economy");
    if (!container) return;

    container.innerHTML = "";

    [
      ["Inflation", data.inflation],
      ["GDP growth", data.gdp],
      ["Unemployment", data.unemployment]
    ].forEach(([name, item]) => {
      const row = document.createElement("div");
      row.className = "indicator-row";

      const label = document.createElement("span");
      label.textContent = name;

      const value = document.createElement("strong");
      value.textContent = item
        ? `${D.number(item.value, 2)}% (${item.year})`
        : "Unavailable";

      row.append(label, value);
      container.appendChild(row);
    });
  }

  async function loadCurrencies() {
    const result = await D.loadRates("EUR");

    setText("fx-date", `REFERENCE DATE: ${result.date}`);

    const body = $("currency-table");
    if (!body) return;

    body.innerHTML = "";

    D.getCurrencies().forEach(currency => {
      const rate = result.rates[currency.code];

      const row = document.createElement("tr");

      [
        currency.code,
        currency.name,
        rate ? D.number(rate, 5) : "Not provided by source",
        "1 EUR"
      ].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      body.appendChild(row);
    });

    populateCurrencySelects();

    setText(
      "overview-source",
      `Exchange-rate source: Frankfurter API using ECB reference data. Date: ${result.date}.`
    );
  }

  function populateCurrencySelects() {
    const ids = [
      "convert-from",
      "convert-to",
      "history-currency",
      "archive-currency"
    ];

    ids.forEach(id => {
      const select = $(id);
      if (!select || select.options.length) return;

      D.getCurrencies().forEach(currency => {
        const option = document.createElement("option");
        option.value = currency.code;
        option.textContent = `${currency.code} — ${currency.name}`;
        select.appendChild(option);
      });
    });

    if ($("convert-from")) $("convert-from").value = "USD";
    if ($("convert-to")) $("convert-to").value = "EUR";
    if ($("history-currency")) $("history-currency").value = "USD";
    if ($("archive-currency")) $("archive-currency").value = "USD";
  }

  async function convertCurrency() {
    const amount = Number($("convert-amount")?.value);
    const from = $("convert-from")?.value;
    const to = $("convert-to")?.value;

    if (!Number.isFinite(amount) || amount < 0) {
      setText("convert-result", "Enter a valid non-negative amount.");
      return;
    }

    try {
      await D.loadRates(from);
      const result = D.convert(amount, from, to);

      setText(
        "convert-result",
        result === null
          ? "This currency pair is unavailable from the current source."
          : `${D.money(amount, from)} = ${D.money(result, to)}`
      );
    } catch (error) {
      setText("convert-result", "Currency conversion is currently unavailable.");
    }
  }

  async function loadFxHistory() {
    const currency = $("history-currency")?.value || "USD";
    const days = Number($("history-period")?.value || 30);

    try {
      const history = await D.loadFxHistory(currency, days);

      chart(
        "fx-history-chart",
        history.map(item => item.date),
        history.map(item => item.value),
        `${currency} per EUR`
      );
    } catch (error) {
      console.error(error);
      setText("fx-date", "Historical rates unavailable.");
    }
  }

  async function loadMarkets() {
    const results = await Promise.allSettled([
      D.loadBitcoin(state.currency),
      D.loadBitcoinHistory(30, state.currency),
      D.loadGold(),
      D.loadGoldHistory(30, state.currency)
    ]);

    if (results[0].status === "fulfilled") {
      renderBitcoin(results[0].value);
    } else {
      ["btc-price", "btc-change", "btc-marketcap", "btc-volume"]
        .forEach(id => setText(id, "Unavailable"));
    }

    if (results[1].status === "fulfilled") {
      renderBitcoinChart(results[1].value);
    }

    if (results[2].status === "fulfilled") {
      const gold = results[2].value;
      const converted = D.convert(gold.value, "PLN", state.currency);

      setText("gold-gram", converted === null ? "Unavailable" : formatMoney(converted));
      setText("gold-ounce", converted === null ? "Unavailable" : formatMoney(converted * 31.1034768));
    }

    if (results[3].status === "fulfilled") {
      const history = results[3].value;
      chart(
        "gold-history-chart",
        history.map(item => item.date),
        history.map(item => item.value),
        `Gold per gram (${state.currency})`
      );
    }
  }

  function renderBitcoin(data) {
    setText("btc-price", formatMoney(data.price));
    setText("btc-change", `${D.number(data.change, 2)}%`);
    setText("btc-marketcap", formatMoney(data.marketCap));
    setText("btc-volume", formatMoney(data.volume));

    const changeElement = $("btc-change");
    if (changeElement) {
      changeElement.classList.toggle("positive", data.change >= 0);
      changeElement.classList.toggle("negative", data.change < 0);
    }

    setText(
      "btc-source",
      `Source: CoinCap. Price and market statistics are provider-reported. Currency: ${state.currency}.`
    );
  }

  function renderBitcoinChart(history) {
    chart(
      "btc-history-chart",
      history.map(item => item.date),
      history.map(item => item.value),
      `Bitcoin (${state.currency})`
    );
  }

  async function updateBitcoinHistory() {
    const days = Number($("btc-period")?.value || 30);

    try {
      const history = await D.loadBitcoinHistory(days, state.currency);
      renderBitcoinChart(history);
    } catch {
      setText("btc-source", "Bitcoin historical data is currently unavailable.");
    }
  }

  async function updateGoldHistory() {
    try {
      const history = await D.loadGoldHistory(30, state.currency);

      chart(
        "gold-history-chart",
        history.map(item => item.date),
        history.map(item => item.value),
        `Gold per gram (${state.currency})`
      );
    } catch {
      setText("gold-gram", "Unavailable");
    }
  }

  async function loadEconomy() {
    const country = $("economy-country")?.value || "USA";
    const result = await D.loadEconomy(country);

    const mapping = [
      ["inflation", "economy-inflation", "economy-inflation-year"],
      ["gdp", "economy-gdp", "economy-gdp-year"],
      ["unemployment", "economy-unemployment", "economy-unemployment-year"]
    ];

    mapping.forEach(([key, valueId, yearId]) => {
      const item = result[key];

      setText(
        valueId,
        item ? `${D.number(item.value, 2)}%` : "Unavailable"
      );

      setText(
        yearId,
        item ? `Observation year: ${item.year}` : "No observation available"
      );
    });

    const valid = Object.entries(result)
      .filter(([, item]) => item)
      .map(([name, item]) => ({
        name,
        year: item.year,
        value: item.value
      }));

    chart(
      "economy-chart",
      valid.map(item => `${item.name} · ${item.year}`),
      valid.map(item => item.value),
      "Latest available percentage"
    );

    setText(
      "economy-source",
      "Source: World Bank Open Data. Latest non-null observation returned for each indicator. Observation years can differ."
    );
  }

  function calculate(id, callback) {
    const button = $(id);
    if (!button) return;
    button.addEventListener("click", callback);
  }

  function numeric(id) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : null;
  }

  function calculateCompound() {
    const principal = numeric("compound-principal");
    const rate = numeric("compound-rate");
    const years = numeric("compound-years");
    const frequency = numeric("compound-frequency");

    if (
      principal === null || rate === null || years === null ||
      frequency === null || principal < 0 || years < 0 || frequency <= 0
    ) {
      setText("compound-result", "Please enter valid values.");
      return;
    }

    const total = principal * Math.pow(
      1 + rate / 100 / frequency,
      frequency * years
    );

    setText(
      "compound-result",
      `Future value: ${D.money(total, state.currency)} · Interest: ${D.money(total - principal, state.currency)}`
    );
  }

  function calculateSimple() {
    const principal = numeric("simple-principal");
    const rate = numeric("simple-rate");
    const years = numeric("simple-years");

    if (
      principal === null || rate === null || years === null ||
      principal < 0 || years < 0
    ) {
      setText("simple-result", "Please enter valid values.");
      return;
    }

    const interest = principal * rate / 100 * years;
    const total = principal + interest;

    setText(
      "simple-result",
      `Final value: ${D.money(total, state.currency)} · Interest: ${D.money(interest, state.currency)}`
    );
  }

  function calculateInflation() {
    const amount = numeric("inflation-amount");
    const rate = numeric("inflation-rate");
    const years = numeric("inflation-years");

    if (
      amount === null || rate === null || years === null ||
      amount < 0 || years < 0 || rate <= -100
    ) {
      setText("inflation-result", "Please enter valid values.");
      return;
    }

    const futureCost = amount * Math.pow(1 + rate / 100, years);

    setText(
      "inflation-result",
      `Equivalent future cost: ${D.money(futureCost, state.currency)}`
    );
  }

  function calculateFuture() {
    const present = numeric("future-present");
    const rate = numeric("future-rate");
    const years = numeric("future-years");

    if (
      present === null || rate === null || years === null ||
      present < 0 || years < 0 || rate <= -100
    ) {
      setText("future-result", "Please enter valid values.");
      return;
    }

    const future = present * Math.pow(1 + rate / 100, years);

    setText(
      "future-result",
      `Future value: ${D.money(future, state.currency)}`
    );
  }

  async function loadArchive() {
    const currency = $("archive-currency")?.value || "USD";
    const days = Number($("archive-days")?.value || 30);
    const body = $("archive-table");

    if (!body) return;

    body.innerHTML = "<tr><td colspan='4'>Loading historical records...</td></tr>";

    try {
      const history = await D.loadFxHistory(currency, days);

      state.archiveRows = history.map(item => ({
        date: item.date,
        currency,
        value: item.value,
        base: "EUR"
      }));

      body.innerHTML = "";

      state.archiveRows.slice().reverse().forEach(item => {
        const row = document.createElement("tr");

        [
          item.date,
          item.currency,
          D.number(item.value, 5),
          item.base
        ].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });

        body.appendChild(row);
      });

      if (!state.archiveRows.length) {
        body.innerHTML = "<tr><td colspan='4'>No observations found.</td></tr>";
      }
    } catch (error) {
      body.innerHTML = "<tr><td colspan='4'>Historical data is currently unavailable.</td></tr>";
    }
  }

  function exportArchive() {
    if (!state.archiveRows.length) {
      alert("Load historical records before exporting.");
      return;
    }

    const rows = [
      ["Date", "Currency", "Rate", "Base"],
      ...state.archiveRows.map(item => [
        item.date,
        item.currency,
        item.value,
        item.base
      ])
    ];

    const csv = rows.map(row =>
      row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "monetary-archive.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function loadExchanges() {
    const stocks = [
      ["New York Stock Exchange", "United States", "New York", "https://www.nyse.com"],
      ["NASDAQ", "United States", "New York", "https://www.nasdaq.com"],
      ["London Stock Exchange", "United Kingdom", "London", "https://www.londonstockexchange.com"],
      ["Tokyo Stock Exchange", "Japan", "Tokyo", "https://www.jpx.co.jp"],
      ["Euronext", "Europe", "Multiple locations", "https://www.euronext.com"],
      ["Shanghai Stock Exchange", "China", "Shanghai", "https://english.sse.com.cn"],
      ["Hong Kong Exchange", "Hong Kong", "Hong Kong", "https://www.hkex.com.hk"],
      ["Deutsche Börse", "Germany", "Frankfurt", "https://www.deutsche-boerse.com"],
      ["SIX Swiss Exchange", "Switzerland", "Zurich", "https://www.six-group.com"]
    ];

    const crypto = [
      ["Binance", "Cryptocurrency exchange", "https://www.binance.com"],
      ["Coinbase", "Cryptocurrency exchange", "https://www.coinbase.com"],
      ["Kraken", "Cryptocurrency exchange", "https://www.kraken.com"],
      ["OKX", "Cryptocurrency exchange", "https://www.okx.com"],
      ["Bybit", "Cryptocurrency exchange", "https://www.bybit.com"],
      ["Bitstamp", "Cryptocurrency exchange", "https://www.bitstamp.net"]
    ];

    renderExchangeCards("stock-exchanges", stocks);
    renderExchangeCards("crypto-exchanges", crypto);
  }

  function renderExchangeCards(id, items) {
    const container = $(id);
    if (!container) return;

    container.innerHTML = "";

    items.forEach(item => {
      const [name, detail, location, url] = item;

      const card = document.createElement("article");
      card.className = "exchange-card";

      const heading = document.createElement("h4");
      heading.textContent = name;

      const description = document.createElement("p");
      description.textContent = detail;

      const locationText = document.createElement("p");
      locationText.textContent = location;

      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Official website ↗";

      card.append(heading, description, locationText, link);
      container.appendChild(card);
    });
  }

  async function changeCurrency(currency) {
    state.currency = currency;

    state.loadedPages.clear();

    await loadOverview();

    const activePage = document.querySelector(".page.active");
    if (activePage) {
      const name = activePage.id.replace("page-", "");

      if (name !== "overview") {
        await loadPage(name);
      }
    }
  }

  function bindEvents() {
    $("navigation")?.addEventListener("click", event => {
      const button = event.target.closest("[data-page]");
      if (button) openPage(button.dataset.page);
    });

    document.querySelectorAll("[data-open-page]").forEach(button => {
      button.addEventListener("click", () => {
        openPage(button.dataset.openPage);
      });
    });

    $("display-currency")?.addEventListener("change", event => {
      changeCurrency(event.target.value);
    });

    $("convert-button")?.addEventListener("click", convertCurrency);
    $("history-load")?.addEventListener("click", loadFxHistory);

    $("btc-history-load")?.addEventListener("click", updateBitcoinHistory);
    $("btc-period")?.addEventListener("change", updateBitcoinHistory);

    $("economy-load")?.addEventListener("click", loadEconomy);

    $("archive-load")?.addEventListener("click", loadArchive);
    $("archive-export")?.addEventListener("click", exportArchive);

    $("currency-search")?.addEventListener("input", event => {
      const query = event.target.value.toLowerCase();

      document.querySelectorAll("#currency-table tr").forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    });

    $("globe-reset")?.addEventListener("click", () => {
      ArchiveGlobe.reset("main-globe");
    });

    $("globe-zoom-in")?.addEventListener("click", () => {
      ArchiveGlobe.zoom("main-globe", 1);
    });

    $("globe-zoom-out")?.addEventListener("click", () => {
      ArchiveGlobe.zoom("main-globe", -1);
    });

    calculate("compound-calculate", calculateCompound);
    calculate("simple-calculate", calculateSimple);
    calculate("inflation-calculate", calculateInflation);
    calculate("future-calculate", calculateFuture);
  }

  async function initialize() {
    bindEvents();
    populateCurrencySelects();
    loadExchanges();

    const currencySelect = $("display-currency");
    if (currencySelect) {
      currencySelect.value = state.currency;
    }

    await loadPage("overview");
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();

