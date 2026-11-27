
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const D = () => window.ArchiveData;
  const charts = {};
  let currentPage = "overview";
  let selectedCurrency = "USD";
  let archiveRows = [];

  const money = (value, currency = selectedCurrency, digits = 2) =>
    D().format(value, currency, digits);

  const number = (value, digits = 2) =>
    Number.isFinite(Number(value))
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(Number(value))
      : "Unavailable";

  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[char]);

  const setText = (id, value) => {
    const element = $(id);
    if (element) element.textContent = value ?? "—";
  };

  const setHTML = (id, value) => {
    const element = $(id);
    if (element) element.innerHTML = value;
  };

  function navigate(page) {
    const target = $(`page-${page}`);
    if (!target) return;

    currentPage = page;
    all(".page").forEach(element => element.classList.toggle("active", element === target));
    all(".nav-link").forEach(element => element.classList.toggle("active", element.dataset.page === page));

    const active = all(".nav-link").find(element => element.dataset.page === page);
    setText("breadcrumb-current", active?.textContent?.trim().toUpperCase() || page.toUpperCase());

    $("sidebar")?.classList.remove("open");

    if (page === "globe") {
      window.dispatchEvent(new Event("archive:globe-page-open"));
      setTimeout(() => D().loadCountryData && window.ArchiveGlobe?.resize(), 100);
    }
    if (page === "currencies") renderCurrencyTable();
    if (page === "economy") loadEconomy();
    if (page === "crypto-exchanges") renderCryptoExchanges();
    if (page === "stock-exchanges") renderStockExchanges();
    if (page === "indices") renderIndices();
    if (page === "archive") renderArchive();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindNavigation() {
    all(".nav-link").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.page));
    });

    all("[data-open-page]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.openPage));
    });

    $("mobile-menu")?.addEventListener("click", () => $("sidebar")?.classList.toggle("open"));

    document.addEventListener("click", event => {
      if (window.innerWidth > 800) return;
      const sidebar = $("sidebar");
      if (sidebar?.classList.contains("open") &&
          !sidebar.contains(event.target) &&
          event.target !== $("mobile-menu")) {
        sidebar.classList.remove("open");
      }
    });
  }

  function startClock() {
    const update = () => {
      const now = new Date();
      setText("live-clock", now.toLocaleTimeString("en-GB"));
      setText("current-date", now.toLocaleDateString("en-GB", {
        day: "2-digit", month: "long", year: "numeric"
      }));
    };
    update();
    setInterval(update, 1000);
  }

  function fillCurrencySelects() {
    const options = D().currencies.map(currency =>
      `<option value="${currency.code}">${currency.code} — ${safe(currency.name)}</option>`
    ).join("");

    ["convert-from", "convert-to", "calc-from", "calc-to", "currency-history-code"]
      .forEach(id => {
        const select = $(id);
        if (!select) return;
        select.innerHTML = options;
      });

    if ($("convert-from")) $("convert-from").value = "USD";
    if ($("convert-to")) $("convert-to").value = "EUR";
    if ($("calc-from")) $("calc-from").value = "USD";
    if ($("calc-to")) $("calc-to").value = "EUR";
    if ($("currency-history-code")) $("currency-history-code").value = "USD";
  }

  function updateConnection(dashboard) {
    const good = Boolean(dashboard.fx || dashboard.bitcoin || dashboard.gold);
    const dot = $("connection-dot");
    if (dot) dot.className = `status-dot ${good ? "online" : "offline"}`;

    setText("connection-status", good ? "DATA SOURCES CONNECTED" : "DATA SOURCES UNAVAILABLE");
    setText("footer-time", `LAST CHECK: ${new Date(dashboard.loadedAt).toLocaleString()}`);
    setText("last-updated", new Date(dashboard.loadedAt).toLocaleString());
  }

  function updateCurrencyOptions() {
    const select = $("display-currency");
    if (select) select.value = selectedCurrency;
  }

  function renderTopTicker(dashboard) {
    const btc = dashboard.bitcoin;
    if (btc) {
      const price = convertBitcoin(btc.price, "USD", selectedCurrency);
      setText("ticker-btc", money(price));
      setText("ticker-btc-change", `${number(btc.change)}% · 24H`);
      setText("overview-btc", money(price));
      setText("overview-btc-change", `${number(btc.change)}% over 24 hours`);
      setText("overview-btc-meta", `CoinGecko · ${btc.stale ? "Cached data" : "Latest response"}`);
    }

    if (dashboard.gold) {
      const perGram = D().goldIn(selectedCurrency, dashboard.gold);
      const ounce = perGram === null ? null : perGram * 31.1034768;
      setText("ticker-gold", ounce === null ? "Unavailable" : money(ounce));
      setText("ticker-gold-meta", `NBP · ${dashboard.gold.date}`);
      setText("overview-gold", ounce === null ? "Unavailable" : money(ounce));
      setText("overview-gold-meta", `NBP reference · ${dashboard.gold.date}`);
      setText("gold-gram", perGram === null ? "Unavailable" : money(perGram));
      setText("gold-ounce", ounce === null ? "Unavailable" : money(ounce));
      setText("gold-date", dashboard.gold.date);
    }

    const eur = D().convert(1, "EUR", "USD");
    const usd = D().convert(1, "USD", "PLN");
    setText("ticker-eurusd", eur ? number(eur, 4) : "Unavailable");
    setText("ticker-usdpln", usd ? number(usd, 4) : "Unavailable");
    setText("overview-eurusd", eur ? number(eur, 4) : "Unavailable");
    setText("overview-eurusd-meta", `NBP reference · ${D().fxDate || "—"}`);
    setText("ticker-eurusd-meta", `Reference · ${D().fxDate || "—"}`);
    setText("ticker-usdpln-meta", `Reference · ${D().fxDate || "—"}`);
  }

  function convertBitcoin(value, from, to) {
    if (from === to) return value;
    return D().convert(value, from, to);
  }

  function renderOverviewRates() {
    const fx = D().fx;
    const date = D().fxDate;
    const preferred = ["USD", "EUR", "GBP", "CHF", "JPY", "PLN", "CAD", "AUD", "CNY", "INR"];
    const rows = preferred.map(code => {
      const currency = D().currencies.find(item => item.code === code);
      const rate = fx[code];
      if (!currency || !rate) return "";
      const inSelected = D().convert(1, code, selectedCurrency);
      return `<tr>
        <td><strong>${code}</strong></td>
        <td>${safe(currency.name)}</td>
        <td>${number(inSelected, 5)} ${selectedCurrency}</td>
        <td>1 ${code}</td>
        <td class="muted">NBP · ${safe(date || "—")}</td>
      </tr>`;
    }).join("");

    setHTML("overview-rates", rows || `<tr><td colspan="5">No exchange rates available.</td></tr>`);
    setText("overview-rates-date", date ? `OBSERVATION: ${date}` : "DATE UNAVAILABLE");
  }

  function renderCurrencyTable() {
    const search = ($("currency-search")?.value || "").trim().toLowerCase();
    const fx = D().fx;
    const list = D().currencies.filter(item =>
      item.code.toLowerCase().includes(search) ||
      item.name.toLowerCase().includes(search)
    );

    const rows = list.map(item => {
      const rate = D().convert(1, item.code, selectedCurrency);
      return `<tr>
        <td><strong>${item.code}</strong></td>
        <td>${safe(item.name)}</td>
        <td>${rate === null ? "Unavailable" : `${number(rate, 5)} ${selectedCurrency}`}</td>
        <td class="muted">No comparable previous observation</td>
        <td>${safe(D().fxDate || "—")}</td>
      </tr>`;
    }).join("");

    setHTML("currency-table", rows || `<tr><td colspan="5">No matching currencies or no rates available.</td></tr>`);
  }

  function runConverter() {
    const amount = Number($("convert-amount")?.value);
    const from = $("convert-from")?.value;
    const to = $("convert-to")?.value;
    const result = D().convert(amount, from, to);
    setText("convert-result", result === null ? "Rate unavailable or invalid amount" : money(result, to));
    setText("converter-note", `Reference date: ${D().fxDate || "unavailable"} · Source: NBP`);
  }

  function runCalcConverter() {
    const amount = Number($("calc-amount")?.value);
    const from = $("calc-from")?.value;
    const to = $("calc-to")?.value;
    const result = D().convert(amount, from, to);
    setText("calc-currency-result", result === null ? "Unable to calculate: check amount and rates." : money(result, to));
  }

  function renderBitcoin(dashboard) {
    const btc = dashboard.bitcoin;
    if (!btc) {
      ["btc-price","btc-change","btc-market-cap","btc-volume","market-btc","market-btc-change","market-btc-cap","market-btc-volume"]
        .forEach(id => setText(id, "Unavailable"));
      return;
    }

    const price = convertBitcoin(btc.price, "USD", selectedCurrency);
    const cap = convertBitcoin(btc.marketCap, "USD", selectedCurrency);
    const volume = convertBitcoin(btc.volume, "USD", selectedCurrency);

    setText("btc-price", money(price));
    setText("btc-change", `${number(btc.change)}%`);
    setText("btc-market-cap", money(cap, selectedCurrency, 0));
    setText("btc-volume", money(volume, selectedCurrency, 0));
    setText("btc-price-note", `CoinGecko · ${btc.stale ? "Cached response" : "Latest response"}`);

    setText("market-btc", money(price));
    setText("market-btc-meta", "Bitcoin reference price");
    setText("market-btc-change", `${number(btc.change)}%`);
    setText("market-btc-cap", money(cap, selectedCurrency, 0));
    setText("market-btc-volume", money(volume, selectedCurrency, 0));
  }

  function makeChart(id, labels, values, label, currency = selectedCurrency) {
    const canvas = $(id);
    if (!canvas || !window.Chart) return;

    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: "#a99a78",
          backgroundColor: "rgba(169,154,120,.10)",
          borderWidth: 2,
          fill: true,
          tension: .22,
          pointRadius: 0,
          pointHoverRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#17191e",
            borderColor: "#514b3d",
            borderWidth: 1,
            titleColor: "#c5b795",
            bodyColor: "#e7e4dc",
            callbacks: {
              label: context => `${label}: ${money(context.parsed.y, currency)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(120,120,120,.10)" },
            ticks: { color: "#858890", maxTicksLimit: 8 }
          },
          y: {
            grid: { color: "rgba(120,120,120,.12)" },
            ticks: {
              color: "#858890",
              callback: value => money(value, currency, 0)
            }
          }
        }
      }
    });
  }

  async function loadBitcoinChart() {
    const days = Number($("btc-period")?.value || 7);
    setText("btc-chart-note", "Loading historical market data...");
    try {
      const history = await D().loadBitcoinHistory(days, selectedCurrency.toLowerCase());
      makeChart(
        "btc-chart",
        history.map(item => item.date.toLocaleDateString()),
        history.map(item => item.value),
        `BTC / ${selectedCurrency}`
      );
      setText("btc-chart-note", `CoinGecko · ${history.length} observations · ${days}-day period`);
    } catch (error) {
      setText("btc-chart-note", `Historical data unavailable: ${error.message}`);
    }
  }

  async function loadCurrencyChart() {
    const code = $("currency-history-code")?.value || "USD";
    const canvas = $("currency-chart");
    if (!canvas) return;

    if (code === "PLN") {
      setText("converter-note", "PLN is the NBP base currency.");
      return;
    }

    try {
      const response = await fetch(
        `https://api.nbp.pl/api/exchangerates/rates/A/${encodeURIComponent(code)}/last/30/?format=json`
      );
      if (!response.ok) throw new Error(`NBP HTTP ${response.status}`);
      const data = await response.json();
      const rates = data.rates || [];
      makeChart(
        "currency-chart",
        rates.map(item => item.effectiveDate),
        rates.map(item => item.mid),
        `${code} / PLN`,
        "PLN"
      );
    } catch (error) {
      setText("converter-note", `Currency history unavailable: ${error.message}`);
    }
  }

  function renderStockExchanges() {
    const exchanges = D().stockExchanges;
    const cards = exchanges.map(exchange => `
      <article class="exchange-card">
        <span class="exchange-code">${safe(exchange.code)}</span>
        <h3>${safe(exchange.name)}</h3>
        <p>${safe(exchange.description)}</p>
        <p>Location: ${safe(exchange.city)}, ${safe(exchange.country)}</p>
        <p>Benchmark: ${safe(exchange.index)}</p>
        <div class="exchange-status">LIVE QUOTE: NOT CONNECTED · LICENSED DATA MAY BE REQUIRED</div>
      </article>
    `).join("");

    setHTML("stock-exchange-list", cards);
    setHTML("stock-exchange-table", exchanges.map(exchange => `
      <tr>
        <td>${safe(exchange.name)}</td>
        <td>${safe(exchange.city)}, ${safe(exchange.country)}</td>
        <td>${safe(exchange.index)}</td>
        <td class="muted">Reference directory · No live feed</td>
      </tr>
    `).join(""));
  }

  function renderIndices() {
    const exchanges = D().stockExchanges;
    const html = exchanges.slice(0, 6).map(exchange => `
      <article class="panel data-panel">
        <span class="eyebrow">${safe(exchange.country.toUpperCase())}</span>
        <h3>${safe(exchange.index)}</h3>
        <div class="large-data">—</div>
        <div class="data-note">Live quote not connected. ${safe(exchange.name)} reference.</div>
      </article>
    `).join("");
    setHTML("indices-grid", html);
  }

  function renderCryptoExchanges() {
    const list = D().cryptoExchanges;
    const html = list.map(exchange => `
      <article class="exchange-card">
        <span class="exchange-code">${safe(exchange.code)}</span>
        <h3>${safe(exchange.name)}</h3>
        <p>${safe(exchange.description)}</p>
        <div class="exchange-status"><a href="${safe(exchange.url)}" target="_blank" rel="noopener noreferrer">OFFICIAL WEBSITE ↗</a></div>
      </article>
    `).join("");
    setHTML("crypto-exchange-list", html);
    loadCryptoExchangeTable();
  }

  async function loadCryptoExchangeTable() {
    const body = $("crypto-exchange-table");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5">Loading exchange tickers...</td></tr>`;

    const results = await D().loadCryptoExchanges();
    body.innerHTML = results.map(item => {
      if (!item.available) {
        return `<tr><td>${safe(item.exchange)}</td><td>BTC pair</td><td>Unavailable</td><td>Unavailable</td><td class="negative">${safe(item.error || "Feed unavailable")}</td></tr>`;
      }
      return `<tr>
        <td>${safe(item.exchange)}</td>
        <td>${safe(item.pair)}</td>
        <td>${number(item.price, 4)}</td>
        <td>${number(item.volume, 2)}</td>
        <td class="positive">PUBLIC API RESPONSE</td>
      </tr>`;
    }).join("");
  }

  async function loadEconomy() {
    const body = $("economy-table");
    if (!body) return;
    body.innerHTML = `<tr><td colspan="5">Loading World Bank observations...</td></tr>`;

    const indicator = $("indicator-select")?.value || "NY.GDP.MKTP.KD.ZG";
    const records = await D().loadEconomy(indicator);

    body.innerHTML = records.length ? records.map(record => `
      <tr>
        <td>${safe(record.country)}</td>
        <td>${safe(record.indicator)}</td>
        <td>${number(record.value, 3)}</td>
        <td>${safe(record.year)}</td>
        <td>World Bank</td>
      </tr>
    `).join("") : `<tr><td colspan="5">No observations returned by the World Bank API.</td></tr>`;

    renderOverviewEconomy();
  }

  async function renderOverviewEconomy() {
    const records = await Promise.all([
      D().loadWorldBank ? D().loadWorldBank("WLD", "NY.GDP.MKTP.KD.ZG") : null,
      D().loadWorldBank ? D().loadWorldBank("WLD", "FP.CPI.TOTL.ZG") : null,
      D().loadWorldBank ? D().loadWorldBank("WLD", "SL.UEM.TOTL.ZS") : null
    ]);

    const labels = ["GDP Growth", "Inflation", "Unemployment"];
    setHTML("overview-indicators", records.map((record, index) => `
      <div class="panel data-panel">
        <span class="eyebrow">WORLD BANK · GLOBAL</span>
        <h3>${labels[index]}</h3>
        <div class="large-data">${record ? `${number(record.value, 2)}%` : "Unavailable"}</div>
        <div class="data-note">${record ? `Observation: ${safe(record.year)}` : "No available observation"}</div>
      </div>
    `).join(""));
  }

  async function renderCountryProfile(code, name) {
    const country = D().getCountry(code);
    if (!country) {
      setHTML("country-profile", `<div class="empty-state">${safe(name)}: no country profile is configured yet.</div>`);
      return;
    }

    setHTML("country-profile", `<div class="eyebrow">COUNTRY DOSSIER</div><h2>${safe(country.name)}</h2><p class="page-description">Retrieving economic observations...</p>`);

    const data = await D().loadCountryData(code);
    if (!data) return;

    const item = (label, record, suffix = "") => `
      <div class="country-stat"><span>${label}</span>
      <strong>${record ? `${number(record.value, 2)}${suffix}` : "Unavailable"}</strong>
      <small>${record ? `Year: ${safe(record.year)}` : "No observation"}</small></div>
    `;

    setHTML("country-profile", `
      <div class="eyebrow">COUNTRY DOSSIER · ${safe(data.code)}</div>
      <h2>${safe(data.name)}</h2>
      <p class="page-description">National currency: ${safe(data.currency)} · Source: World Bank</p>
      <div class="country-stats">
        ${item("GDP GROWTH", data.gdpGrowth, "%")}
        ${item("INFLATION", data.inflation, "%")}
        ${item("UNEMPLOYMENT", data.unemployment, "%")}
        ${item("GDP · CURRENT USD", data.gdp, "")}
      </div>
      <p class="data-note">${safe(data.observationNote)} Missing observations are not estimated.</p>
    `);
    window.ArchiveGlobe?.focusCountry(code);
  }

  function runInflation() {
    const amount = Number($("inflation-amount")?.value);
    const rate = Number($("inflation-rate")?.value);
    const years = Number($("inflation-years")?.value);

    if (![amount, rate, years].every(Number.isFinite) || amount < 0 || years < 0 || rate <= -100) {
      setText("inflation-result", "Please enter valid non-negative values.");
      return;
    }
    const future = amount * Math.pow(1 + rate / 100, years);
    setText("inflation-result", `Equivalent future cost: ${number(future, 2)}`);
  }

  function runCompound() {
    const principal = Number($("compound-principal")?.value);
    const rate = Number($("compound-rate")?.value);
    const years = Number($("compound-years")?.value);

    if (![principal, rate, years].every(Number.isFinite) || principal < 0 || years < 0 || rate <= -100) {
      setText("compound-result", "Please enter valid values.");
      return;
    }

    const total = principal * Math.pow(1 + rate / 100, years);
    setText("compound-result", `Future value: ${number(total, 2)} · Interest: ${number(total - principal, 2)}`);
  }

  function makeArchive() {
    const rows = [];
    const dashboard = D().getDashboard();

    if (dashboard?.gold) {
      rows.push({ date: dashboard.gold.date, type: "Gold", reference: "Gold · PLN/g", value: dashboard.gold.plnPerGram, source: "NBP" });
    }
    if (dashboard?.bitcoin) {
      rows.push({ date: dashboard.bitcoin.updatedAt, type: "Bitcoin", reference: "BTC/USD", value: dashboard.bitcoin.price, source: "CoinGecko" });
    }

    if (D().fxDate) {
      Object.entries(D().fx).forEach(([code, rate]) => {
        rows.push({ date: D().fxDate, type: "Currency", reference: `${code}/PLN`, value: rate, source: "NBP" });
      });
    }
    archiveRows = rows;
  }

  function renderArchive() {
    makeArchive();
    const search = ($("archive-search")?.value || "").toLowerCase();
    const rows = archiveRows.filter(row =>
      `${row.date} ${row.type} ${row.reference} ${row.source}`.toLowerCase().includes(search)
    );

    setHTML("archive-table", rows.length ? rows.map(row => `
      <tr><td>${safe(row.date)}</td><td>${safe(row.type)}</td><td>${safe(row.reference)}</td><td>${number(row.value, 5)}</td><td>${safe(row.source)}</td></tr>
    `).join("") : `<tr><td colspan="5">No records match the search.</td></tr>`);
    setText("archive-count", `${rows.length} available records · current source snapshots, not a complete historical database`);
  }

  function exportCSV() {
    makeArchive();
    if (!archiveRows.length) {
      alert("There are no records available to export.");
      return;
    }
    const columns = ["date", "type", "reference", "value", "source"];
    const csv = [
      columns.join(","),
      ...archiveRows.map(row => columns.map(key =>
        `"${String(row[key] ?? "").replace(/"/g, '""')}"`
      ).join(","))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "monetary-archive-records.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function bindControls() {
    $("display-currency")?.addEventListener("change", async event => {
      selectedCurrency = event.target.value;
      updateCurrencyOptions();
      await refreshDashboard(true);
      renderCurrencyTable();
      runConverter();
      runCalcConverter();
      loadBitcoinChart();
    });

    $("currency-search")?.addEventListener("input", renderCurrencyTable);
    $("archive-search")?.addEventListener("input", renderArchive);
    $("btc-period")?.addEventListener("change", loadBitcoinChart);
    $("currency-history-code")?.addEventListener("change", loadCurrencyChart);
    $("indicator-select")?.addEventListener("change", loadEconomy);
    $("refresh-crypto")?.addEventListener("click", loadCryptoExchangeTable);
    $("export-csv")?.addEventListener("click", exportCSV);

    ["convert-amount", "convert-from", "convert-to"].forEach(id => {
      const element = $(id);
      element?.addEventListener("input", runConverter);
      element?.addEventListener("change", runConverter);
    });

    $("calc-convert")?.addEventListener("click", runCalcConverter);
    $("calc-inflation")?.addEventListener("click", runInflation);
    $("calc-compound")?.addEventListener("click", runCompound);

    ["calc-amount", "calc-from", "calc-to"].forEach(id => {
      const element = $(id);
      element?.addEventListener("input", runCalcConverter);
      element?.addEventListener("change", runCalcConverter);
    });
  }

  async function refreshDashboard(force = false) {
    try {
      const dashboard = await D().loadDashboard(force);
      updateConnection(dashboard);
      renderTopTicker(dashboard);
      renderOverviewRates();
      renderBitcoin(dashboard);
      renderStockExchanges();
      renderIndices();
      renderCryptoExchanges();
      renderArchive();
      runConverter();
      runCalcConverter();
    } catch (error) {
      console.error("Dashboard loading failed:", error);
      setText("connection-status", "DATA SOURCES UNAVAILABLE");
      setText("overview-btc", "Unavailable");
      setText("overview-gold", "Unavailable");
      setText("ticker-btc", "Unavailable");
      setText("ticker-gold", "Unavailable");
    }
  }

  function bindGlobeEvents() {
    window.addEventListener("archive:country-selected", event => {
      const { code, name } = event.detail || {};
      renderCountryProfile(code, name);
      if (currentPage !== "globe") navigate("globe");
    });

    window.addEventListener("archive:country-unavailable", event => {
      const name = event.detail?.name || "Selected country";
      setHTML("country-profile", `<div class="empty-state">${safe(name)}: economic profile is not configured in this edition.</div>`);
      if (currentPage !== "globe") navigate("globe");
    });
  }

  async function init() {
    bindNavigation();
    bindControls();
    bindGlobeEvents();
    fillCurrencySelects();
    updateCurrencyOptions();
    startClock();
    renderStockExchanges();
    renderIndices();

    await refreshDashboard(false);
    await loadBitcoinChart();
    await loadCurrencyChart();
    await renderOverviewEconomy();

    setInterval(() => refreshDashboard(true), 5 * 60 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
