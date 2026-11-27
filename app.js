
(() => {
  "use strict";

  const D = window.ArchiveData;
  const UI = window.ArchiveUI;

  if (!D || !UI) {
    document.getElementById("app").innerHTML =
      '<div class="status error">Application modules failed to load. Check data.js and script.js.</div>';
    return;
  }

  const pages = [
    ["overview", "Overview"],
    ["globe", "Global Globe"],
    ["currencies", "Currencies"],
    ["markets", "Markets & Bitcoin"],
    ["economy", "Inflation & Economy"],
    ["calculators", "Calculators"],
    ["archive", "Historical Archive"],
    ["exchanges", "Exchanges"]
  ];

  let currentPage = "overview";
  let currency = "USD";
  let charts = [];
  let loadVersion = 0;

  const app = document.getElementById("app");

  app.innerHTML = `
    <div id="layout">
      <aside class="sidebar">
        <h1 class="brand">The Monetary<br>Archive</h1>
        <div class="brand-subtitle">International financial record</div>
        <nav class="navigation" id="navigation"></nav>
        <div class="sidebar-note">
          A GLOBAL RECORD OF<br>
          MARKETS, CURRENCIES<br>
          AND ECONOMIC HISTORY
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <div class="eyebrow">The international financial archive</div>
            <div class="update-time" id="update-time">Connecting to data sources…</div>
          </div>
          <select class="currency-select" id="display-currency" aria-label="Display currency">
            ${D.currencies.map(code =>
              `<option value="${code}" ${code === "USD" ? "selected" : ""}>${code}</option>`
            ).join("")}
          </select>
        </header>

        <div id="page-content"></div>

        <footer class="footer">
          DATA IS PROVIDED FOR INFORMATIONAL PURPOSES.
          MARKET DATA MAY BE DELAYED.
          ECONOMIC INDICATORS RETAIN THEIR ORIGINAL OBSERVATION DATES.
          UNAVAILABLE DATA IS NEVER REPLACED WITH INVENTED VALUES.
        </footer>
      </main>
    </div>
  `;

  const nav = document.getElementById("navigation");
  const content = document.getElementById("page-content");
  const currencySelect = document.getElementById("display-currency");

  function money(value, from = currency) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "Unavailable";
    }

    if (from === currency) return UI.money(value, currency);

    const converted = D.convert(Number(value), from, currency);
    return converted === null ? "Unavailable" : UI.money(converted, currency);
  }

  function title(text, description) {
    return `
      <h1 class="page-title">${UI.escape(text)}</h1>
      <p class="page-description">${UI.escape(description)}</p>
    `;
  }

  function clearCharts() {
    charts.forEach(chart => {
      try { chart.destroy(); } catch {}
    });
    charts = [];
  }

  function makeChart(id, labels, values, label) {
    const canvas = document.getElementById(id);
    if (!canvas || !window.Chart || !values.length) return;

    const instance = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: "#a58b59",
          backgroundColor: "rgba(165,139,89,0.10)",
          fill: true,
          tension: 0.25,
          pointRadius: 1.5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#c9c1b2" }
          }
        },
        scales: {
          x: {
            ticks: { color: "#928c7e", maxTicksLimit: 8 },
            grid: { color: "#302f29" }
          },
          y: {
            ticks: { color: "#928c7e" },
            grid: { color: "#302f29" }
          }
        }
      }
    });

    charts.push(instance);
  }

  function showPage(page) {
    if (!pages.some(item => item[0] === page)) page = "overview";

    currentPage = page;
    loadVersion++;
    clearCharts();

    if (page !== "globe") {
      window.ArchiveGlobe?.destroy();
    }

    nav.querySelectorAll("button").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });

    const renderers = {
      overview: renderOverview,
      globe: renderGlobe,
      currencies: renderCurrencies,
      markets: renderMarkets,
      economy: renderEconomy,
      calculators: renderCalculators,
      archive: renderArchive,
      exchanges: renderExchanges
    };

    renderers[page]();
  }

  pages.forEach(([id, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.page = id;
    button.addEventListener("click", () => showPage(id));
    nav.appendChild(button);
  });

  async function renderOverview() {
    const version = loadVersion;
    const s = D.state;
    const btc = s.bitcoin;
    const gold = s.gold;

    content.innerHTML =
      title("Global Financial Overview",
        "A consolidated view of currency markets, precious metals and the international economy.") +
      `<div class="metric-grid">
        ${UI.metric("Bitcoin", btc ? money(btc.priceUSD, "USD") : "Unavailable",
          btc ? `24h change: ${UI.number(btc.change24h)}% · CoinPaprika` : "Source unavailable")}
        ${UI.metric("Gold · per gram", gold ? money(gold.pricePLN, "PLN") : "Unavailable",
          gold ? `NBP · ${gold.date}` : "Source unavailable")}
        ${UI.metric("USD / EUR", s.rates.USD ? UI.number(s.rates.USD) : "Unavailable",
          `Frankfurter · ${s.rateDate || "Date unavailable"}`)}
        ${UI.metric("EUR / USD", s.rates.USD ? UI.number(1 / s.rates.USD) : "Unavailable",
          "Reference conversion")}
      </div>` +
      UI.panel("Bitcoin Market", `
        <div class="metric-grid">
          ${UI.metric("24-hour change", btc ? `${UI.number(btc.change24h)}%` : "Unavailable", "CoinPaprika")}
          ${UI.metric("Market capitalization", btc ? money(btc.marketCapUSD, "USD") : "Unavailable", "Converted from USD")}
          ${UI.metric("24-hour volume", btc ? money(btc.volumeUSD, "USD") : "Unavailable", "Converted from USD")}
          ${UI.metric("Last update", btc ? UI.date(btc.updated) : "Unavailable", "Provider timestamp")}
        </div>
      `) +
      UI.panel("Bitcoin · Historical Price", `
        <div class="chart-area"><canvas id="overview-chart"></canvas></div>
      `) +
      UI.panel("United States · Economic Indicators", `
        <div id="overview-economy">${UI.status("Loading World Bank indicators…")}</div>
      `) +
      `<div id="overview-errors"></div>`;

    if (s.bitcoinHistory.length) {
      makeChart(
        "overview-chart",
        s.bitcoinHistory.map(x => new Date(x.date).toLocaleDateString()),
        s.bitcoinHistory.map(x => {
          const value = D.convert(x.priceUSD, "USD", currency);
          return value === null ? null : value;
        }),
        `Bitcoin / ${currency}`
      );
    }

    try {
      const economy = await D.loadEconomy("USA");
      if (version !== loadVersion || currentPage !== "overview") return;

      const labels = {
        inflation: "Inflation",
        gdpGrowth: "GDP growth",
        unemployment: "Unemployment",
        gdpPerCapita: "GDP per capita"
      };

      const rows = Object.entries(labels).map(([key, label]) => {
        const item = economy[key];
        return [
          label,
          item ? `${UI.number(item.value)}${key === "gdpPerCapita" ? " USD" : "%"}` : "Unavailable",
          item?.year || "—",
          "World Bank"
        ];
      });

      document.getElementById("overview-economy").innerHTML =
        UI.table(["Indicator", "Value", "Year", "Source"], rows);
    } catch {
      const target = document.getElementById("overview-economy");
      if (target) target.innerHTML = UI.status("World Bank data is unavailable.", true);
    }

    const errors = Object.entries(s.errors);
    const errorTarget = document.getElementById("overview-errors");

    if (errorTarget && errors.length) {
      errorTarget.innerHTML = UI.status(
        "Some data sources did not respond: " +
        errors.map(([name, error]) => `${name}: ${error}`).join(" · "),
        true
      );
    }
  }

  function renderCurrencies() {
    const rows = Object.entries(D.state.rates)
      .filter(([code]) => D.currencies.includes(code))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, rate]) => [
        code,
        UI.number(rate),
        `1 EUR = ${UI.number(rate)} ${code}`,
        D.state.rateDate || "Unavailable"
      ]);

    content.innerHTML =
      title("Currencies",
        "Reference exchange rates from the European Central Bank via Frankfurter. These are not live bank trading quotes.") +
      `<div class="panel">
        <input class="field" id="currency-search" placeholder="Search currency">
        ${UI.table(["Currency", "Rate", "EUR reference", "Date"], rows)}
      </div>` +
      UI.panel("Currency Converter", `
        <div class="form-grid">
          <label class="field-label">Amount
            <input class="field" id="fx-amount" type="number" min="0" value="100">
          </label>
          <label class="field-label">From
            <select class="field" id="fx-from">
              ${D.currencies.map(c => `<option>${c}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">To
            <select class="field" id="fx-to">
              ${D.currencies.map(c => `<option ${c === currency ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </label>
        </div>
        <button class="action-button" id="fx-run">Convert</button>
        <div class="result" id="fx-result">—</div>
      `);

    document.getElementById("currency-search").addEventListener("input", event => {
      const query = event.target.value.toLowerCase();
      document.querySelectorAll(".data-table tbody tr").forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    });

    document.getElementById("fx-run").addEventListener("click", () => {
      const amount = Number(document.getElementById("fx-amount").value);
      const from = document.getElementById("fx-from").value;
      const to = document.getElementById("fx-to").value;
      const result = D.convert(amount, from, to);

      document.getElementById("fx-result").textContent =
        result === null ? "Rate unavailable" : UI.money(result, to);
    });
  }

  function renderMarkets() {
    const btc = D.state.bitcoin;
    const gold = D.state.gold;

    content.innerHTML =
      title("Markets & Bitcoin",
        "Cryptocurrency market data and precious metals. Exchange names are not presented as live market quotes.") +
      `<div class="metric-grid">
        ${UI.metric("Bitcoin price", btc ? money(btc.priceUSD, "USD") : "Unavailable", "CoinPaprika")}
        ${UI.metric("24h change", btc ? `${UI.number(btc.change24h)}%` : "Unavailable", "24-hour percentage")}
        ${UI.metric("Market capitalization", btc ? money(btc.marketCapUSD, "USD") : "Unavailable", "CoinPaprika")}
        ${UI.metric("Trading volume", btc ? money(btc.volumeUSD, "USD") : "Unavailable", "24-hour volume")}
      </div>` +
      UI.panel("Bitcoin Historical Price", `
        <div class="chart-area"><canvas id="market-chart"></canvas></div>
        <p class="panel-note">Historical data is subject to the provider's availability and free-tier limits.</p>
      `) +
      UI.panel("Gold", `
        <div class="metric-grid">
          ${UI.metric("Gold per gram", gold ? money(gold.pricePLN, "PLN") : "Unavailable",
            gold ? `NBP · ${gold.date}` : "Source unavailable")}
        </div>
        <p class="panel-note">NBP reference price in PLN per gram, converted using the loaded FX rates.</p>
      `) +
      UI.panel("Market Venues", UI.table(
        ["Venue", "Market", "Quote status"],
        [
          ["Nasdaq", "Equities", "Live quote feed not connected"],
          ["New York Stock Exchange", "Equities", "Live quote feed not connected"],
          ["London Stock Exchange", "Equities", "Live quote feed not connected"],
          ["Tokyo Stock Exchange", "Equities", "Live quote feed not connected"],
          ["Binance", "Crypto", "Live exchange feed not connected"],
          ["Coinbase", "Crypto", "Live exchange feed not connected"],
          ["Kraken", "Crypto", "Live exchange feed not connected"]
        ]
      ));

    if (D.state.bitcoinHistory.length) {
      makeChart(
        "market-chart",
        D.state.bitcoinHistory.map(x => new Date(x.date).toLocaleDateString()),
        D.state.bitcoinHistory.map(x => D.convert(x.priceUSD, "USD", currency)),
        `BTC / ${currency}`
      );
    }
  }

  async function renderEconomy() {
    content.innerHTML =
      title("Inflation & Economy",
        "Macroeconomic indicators from the World Bank. Values retain their original observation years.") +
      `<div class="panel">
        <div class="form-grid">
          <label class="field-label">Country
            <select class="field" id="economy-country">
              <option value="USA">United States</option>
              <option value="POL">Poland</option>
              <option value="GBR">United Kingdom</option>
              <option value="DEU">Germany</option>
              <option value="FRA">France</option>
              <option value="JPN">Japan</option>
              <option value="CHN">China</option>
              <option value="IND">India</option>
              <option value="BRA">Brazil</option>
              <option value="CAN">Canada</option>
              <option value="AUS">Australia</option>
              <option value="CHE">Switzerland</option>
            </select>
          </label>
        </div>
        <button class="action-button" id="economy-load">Load indicators</button>
      </div>
      <div id="economy-results">${UI.status("Choose a country to load its indicators.")}</div>`;

    async function load() {
      const country = document.getElementById("economy-country").value;
      const target = document.getElementById("economy-results");
      target.innerHTML = UI.status("Loading World Bank data…");

      const data = await D.loadEconomy(country);
      if (currentPage !== "economy") return;

      const labels = {
        inflation: "Inflation",
        gdpGrowth: "GDP growth",
        unemployment: "Unemployment",
        gdpPerCapita: "GDP per capita"
      };

      const rows = Object.entries(labels).map(([key, label]) => {
        const item = data[key];
        return [
          label,
          item ? `${UI.number(item.value)}${key === "gdpPerCapita" ? " USD" : "%"}` : "Unavailable",
          item?.year || "—",
          "World Bank"
        ];
      });

      target.innerHTML = UI.panel("Latest Available Indicators",
        UI.table(["Indicator", "Value", "Year", "Source"], rows));
    }

    document.getElementById("economy-load").addEventListener("click", load);
    await load();
  }

  function renderCalculators() {
    content.innerHTML =
      title("Financial Calculators",
        "Currency conversion, interest and inflation calculations. All calculations run locally in your browser.") +
      UI.panel("Currency Converter", `
        <div class="form-grid">
          <label class="field-label">Amount
            <input class="field" id="calc-fx-amount" type="number" value="100" min="0">
          </label>
          <label class="field-label">From
            <select class="field" id="calc-fx-from">
              ${D.currencies.map(c => `<option>${c}</option>`).join("")}
            </select>
          </label>
          <label class="field-label">To
            <select class="field" id="calc-fx-to">
              ${D.currencies.map(c => `<option ${c === currency ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </label>
        </div>
        <button class="action-button" id="calc-fx-run">Calculate</button>
        <div class="result" id="calc-fx-result">—</div>
      `) +
      UI.panel("Compound Interest", `
        <div class="form-grid">
          <label class="field-label">Initial amount<input class="field" id="ci-p" type="number" value="1000" min="0"></label>
          <label class="field-label">Annual rate (%)<input class="field" id="ci-r" type="number" value="5" min="0"></label>
          <label class="field-label">Years<input class="field" id="ci-t" type="number" value="10" min="0"></label>
          <label class="field-label">Compounds per year<input class="field" id="ci-n" type="number" value="12" min="1"></label>
        </div>
        <button class="action-button" id="ci-run">Calculate</button>
        <div class="result" id="ci-result">—</div>
      `) +
      UI.panel("Simple Interest", `
        <div class="form-grid">
          <label class="field-label">Principal<input class="field" id="si-p" type="number" value="1000" min="0"></label>
          <label class="field-label">Annual rate (%)<input class="field" id="si-r" type="number" value="5" min="0"></label>
          <label class="field-label">Years<input class="field" id="si-t" type="number" value="3" min="0"></label>
        </div>
        <button class="action-button" id="si-run">Calculate</button>
        <div class="result" id="si-result">—</div>
      `) +
      UI.panel("Inflation Calculator", `
        <div class="form-grid">
          <label class="field-label">Starting amount<input class="field" id="inf-p" type="number" value="1000" min="0"></label>
          <label class="field-label">Annual inflation (%)<input class="field" id="inf-r" type="number" value="3"></label>
          <label class="field-label">Years<input class="field" id="inf-t" type="number" value="10" min="0"></label>
        </div>
        <button class="action-button" id="inf-run">Calculate</button>
        <div class="result" id="inf-result">—</div>
      `);

    document.getElementById("calc-fx-run").onclick = () => {
      const amount = Number(document.getElementById("calc-fx-amount").value);
      const from = document.getElementById("calc-fx-from").value;
      const to = document.getElementById("calc-fx-to").value;
      const value = D.convert(amount, from, to);
      document.getElementById("calc-fx-result").textContent =
        value === null ? "Rate unavailable" : UI.money(value, to);
    };

    document.getElementById("ci-run").onclick = () => {
      const p = Number(document.getElementById("ci-p").value);
      const r = Number(document.getElementById("ci-r").value) / 100;
      const t = Number(document.getElementById("ci-t").value);
      const n = Number(document.getElementById("ci-n").value);
      const valid = [p, r, t, n].every(Number.isFinite) &&
        p >= 0 && r >= 0 && t >= 0 && n > 0;
      const result = valid ? p * Math.pow(1 + r / n, n * t) : NaN;
      document.getElementById("ci-result").textContent =
        Number.isFinite(result) ? UI.money(result, currency) : "Check the entered values";
    };

    document.getElementById("si-run").onclick = () => {
      const p = Number(document.getElementById("si-p").value);
      const r = Number(document.getElementById("si-r").value) / 100;
      const t = Number(document.getElementById("si-t").value);
      const result = p * (1 + r * t);
      document.getElementById("si-result").textContent =
        Number.isFinite(result) && p >= 0 && r >= 0 && t >= 0
          ? UI.money(result, currency)
          : "Check the entered values";
    };

    document.getElementById("inf-run").onclick = () => {
      const p = Number(document.getElementById("inf-p").value);
      const r = Number(document.getElementById("inf-r").value) / 100;
      const t = Number(document.getElementById("inf-t").value);
      const result = p * Math.pow(1 + r, t);
      document.getElementById("inf-result").textContent =
        Number.isFinite(result) && p >= 0 && t >= 0
          ? UI.money(result, currency)
          : "Check the entered values";
    };
  }

  async function renderArchive() {
    content.innerHTML =
      title("Historical Archive",
        "Historical observations available from the connected public data providers.") +
      UI.panel("Bitcoin · Historical Price", `
        <div class="chart-area"><canvas id="archive-btc-chart"></canvas></div>
      `) +
      UI.panel("Gold · NBP Daily Reference", `
        <div id="archive-gold">${UI.status("Loading gold history…")}</div>
      `);

    const history = D.state.bitcoinHistory;
    if (history.length) {
      makeChart(
        "archive-btc-chart",
        history.map(x => new Date(x.date).toLocaleDateString()),
        history.map(x => D.convert(x.priceUSD, "USD", currency)),
        `Bitcoin / ${currency}`
      );
    }

    try {
      const rows = await D.loadGoldHistory();
      if (currentPage !== "archive") return;

      document.getElementById("archive-gold").innerHTML =
        UI.table(["Date", "Gold · PLN / gram", `Gold · ${currency} / gram`, "Source"],
          rows.slice().reverse().map(item => [
            item.date,
            UI.number(item.pricePLN),
            money(item.pricePLN, "PLN"),
            "NBP"
          ]));
    } catch {
      const target = document.getElementById("archive-gold");
      if (target) target.innerHTML = UI.status("Gold history unavailable.", true);
    }
  }

  function renderExchanges() {
    content.innerHTML =
      title("Exchanges",
        "A directory of major stock and cryptocurrency exchanges. Live exchange feeds are not connected in this version.") +
      UI.panel("Stock Exchanges", UI.table(
        ["Exchange", "Location", "Market", "Quote status"],
        [
          ["Nasdaq", "New York, USA", "Equities", "Not connected"],
          ["New York Stock Exchange", "New York, USA", "Equities", "Not connected"],
          ["London Stock Exchange", "London, UK", "Equities", "Not connected"],
          ["Tokyo Stock Exchange", "Tokyo, Japan", "Equities", "Not connected"],
          ["Euronext", "Europe", "Equities", "Not connected"],
          ["Hong Kong Stock Exchange", "Hong Kong", "Equities", "Not connected"],
          ["SIX Swiss Exchange", "Zurich, Switzerland", "Equities", "Not connected"]
        ]
      )) +
      UI.panel("Cryptocurrency Exchanges", UI.table(
        ["Exchange", "Market", "Quote status"],
        [
          ["Binance", "Cryptocurrency", "Not connected"],
          ["Coinbase", "Cryptocurrency", "Not connected"],
          ["Kraken", "Cryptocurrency", "Not connected"],
          ["Bitstamp", "Cryptocurrency", "Not connected"],
          ["OKX", "Cryptocurrency", "Not connected"]
        ]
      ));
  }

  async function renderGlobe() {
    content.innerHTML =
      title("Global Globe",
        "Explore geographic borders and request available economic indicators for individual countries.") +
      `<div id="globe-container"></div>
       <div id="country-profile">${UI.status("Select a country on the globe.")}</div>`;

    const container = document.getElementById("globe-container");
    const profile = document.getElementById("country-profile");

    try {
      await window.ArchiveGlobe.create(container, async country => {
        profile.innerHTML = UI.status(
          country.code
            ? `Loading economic indicators for ${country.name}…`
            : `${country.name}: country code mapping is not configured. No data will be invented.`,
          !country.code
        );

        if (!country.code) return;

        try {
          const data = await D.loadEconomy(country.code);
          if (currentPage !== "globe") return;

          const labels = {
            inflation: "Inflation",
            gdpGrowth: "GDP growth",
            unemployment: "Unemployment",
            gdpPerCapita: "GDP per capita"
          };

          const rows = Object.entries(labels).map(([key, label]) => {
            const item = data[key];
            return [
              label,
              item ? `${UI.number(item.value)}${key === "gdpPerCapita" ? " USD" : "%"}` : "Unavailable",
              item?.year || "—",
              "World Bank"
            ];
          });

          profile.innerHTML = UI.panel(country.name,
            UI.table(["Indicator", "Value", "Year", "Source"], rows));
        } catch {
          profile.innerHTML = UI.status("Country data could not be loaded.", true);
        }
      });
    } catch (error) {
      container.innerHTML = UI.status(
        `Globe could not be loaded: ${error.message}`,
        true
      );
    }
  }

  currencySelect.addEventListener("change", () => {
    currency = currencySelect.value;
    UI.setCurrency(currency);
    showPage(currentPage);
  });

  async function initialize() {
    document.getElementById("update-time").textContent =
      "Loading financial data…";

    const result = await D.refresh();

    const errors = Object.keys(result.errors);
    document.getElementById("update-time").textContent =
      errors.length
        ? `Some sources unavailable · ${new Date().toLocaleString()}`
        : `Data refreshed · ${new Date().toLocaleString()}`;

    showPage("overview");
  }

  window.ArchiveApp = {
    showPage,
    refresh: initialize,
    get currency() {
      return currency;
    }
  };

  initialize().catch(error => {
    content.innerHTML = UI.status(
      `Application initialization failed: ${error.message}`,
      true
    );
  });
})();
