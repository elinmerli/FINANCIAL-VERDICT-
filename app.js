
(() => {
  "use strict";

  const app = document.getElementById("app");
  const D = window.ArchiveData;
  const UI = window.ArchiveUI;

  if (!app || !D || !UI) {
    if (app) app.innerHTML = '<div class="status error">A required application file failed to load. Check the script filenames and browser console.</div>';
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

  const countryCodes = {
    "United States of America": "USA",
    "United States": "USA",
    "Poland": "POL",
    "United Kingdom": "GBR",
    "Germany": "DEU",
    "France": "FRA",
    "Japan": "JPN",
    "China": "CHN",
    "India": "IND",
    "Brazil": "BRA",
    "Canada": "CAN",
    "Australia": "AUS",
    "Switzerland": "CHE",
    "Spain": "ESP",
    "Italy": "ITA",
    "Netherlands": "NLD",
    "Sweden": "SWE",
    "Norway": "NOR",
    "Denmark": "DNK",
    "South Korea": "KOR",
    "Mexico": "MEX",
    "South Africa": "ZAF",
    "Turkey": "TUR",
    "Ukraine": "UKR",
    "Argentina": "ARG",
    "New Zealand": "NZL",
    "Ireland": "IRL",
    "Portugal": "PRT",
    "Belgium": "BEL",
    "Austria": "AUT",
    "Greece": "GRC",
    "Finland": "FIN",
    "Romania": "ROU",
    "Czechia": "CZE",
    "Hungary": "HUN",
    "Bulgaria": "BGR",
    "Croatia": "HRV",
    "Egypt": "EGY",
    "Nigeria": "NGA",
    "Indonesia": "IDN",
    "Thailand": "THA",
    "Singapore": "SGP",
    "Chile": "CHL",
    "Colombia": "COL",
    "Peru": "PER",
    "Saudi Arabia": "SAU",
    "Pakistan": "PAK",
    "Bangladesh": "BGD",
    "Vietnam": "VNM",
    "Malaysia": "MYS"
  };

  let currentPage = "overview";
  let displayCurrency = "USD";
  let pageToken = 0;

  app.innerHTML = `
    <div id="layout">
      <aside class="sidebar">
        <div class="brand">The Monetary<br>Archive</div>
        <div class="brand-subtitle">International financial record</div>
        <nav class="nav" id="nav"></nav>
        <div class="sidebar-foot">
          A GLOBAL RECORD OF<br>
          MARKETS, CURRENCIES<br>
          AND ECONOMIC HISTORY
        </div>
      </aside>

      <main class="main">
        <header class="topbar">
          <div>
            <div class="eyebrow">The international financial archive</div>
            <div id="update-status">Connecting to financial sources…</div>
          </div>
          <select id="display-currency" aria-label="Display currency">
            ${D.currencies.map(code =>
              `<option value="${code}" ${code === "USD" ? "selected" : ""}>${code}</option>`
            ).join("")}
          </select>
        </header>

        <div id="page-content"></div>

        <footer class="footer">
          DATA SOURCES: FRANKFURTER · NBP · COINPAPRIKA · WORLD BANK.
          REFERENCE RATES MAY BE DELAYED. UNAVAILABLE OBSERVATIONS ARE NOT FABRICATED.
        </footer>
      </main>
    </div>
  `;

  const nav = document.getElementById("nav");
  const content = document.getElementById("page-content");
  const currencySelect = document.getElementById("display-currency");
  const updateStatus = document.getElementById("update-status");

  function money(value, from = displayCurrency) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "Unavailable";
    }

    if (from === displayCurrency) {
      return UI.money(value, displayCurrency);
    }

    const converted = D.convert(value, from, displayCurrency);
    return converted === null ? "Unavailable" : UI.money(converted, displayCurrency);
  }

  function pageHeading(heading, description) {
    return `<h1 class="page-title">${UI.escape(heading)}</h1>
      <p class="page-description">${UI.escape(description)}</p>`;
  }

  function showError(message) {
    content.insertAdjacentHTML("afterbegin", UI.status(message, true));
  }

  function chart(id, records, valueKey, sourceCurrency, label) {
    const values = records.map(record => {
      const raw = Number(record[valueKey]);
      if (!Number.isFinite(raw)) return null;
      if (!sourceCurrency) return raw;
      return D.convert(raw, sourceCurrency, displayCurrency);
    });

    UI.drawChart(
      id,
      records.map(record => record.date),
      values,
      label
    );
  }

  function render(page) {
    if (!pages.some(item => item[0] === page)) page = "overview";

    currentPage = page;
    const token = ++pageToken;

    if (page !== "globe" && window.ArchiveGlobe) {
      window.ArchiveGlobe.destroy();
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

    try {
      renderers[page](token);
    } catch (error) {
      content.innerHTML = UI.status(`Page error: ${error.message}`, true);
    }
  }

  pages.forEach(([id, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.page = id;
    button.addEventListener("click", () => render(id));
    nav.appendChild(button);
  });

  async function renderOverview(token) {
    const state = D.state;
    const btc = state.bitcoin;
    const gold = state.gold;
    const usdRate = state.rates.USD;

    content.innerHTML =
      pageHeading(
        "Global Financial Overview",
        "An international overview of currency markets, precious metals, digital assets and economic indicators."
      ) +
      `<div class="metrics">
        ${UI.metric("Bitcoin", btc ? money(btc.priceUSD, "USD") : "Unavailable",
          btc ? `24h: ${UI.number(btc.change24h)}% · CoinPaprika` : "Source unavailable")}
        ${UI.metric("Gold · per gram", gold ? money(gold.pricePLN, "PLN") : "Unavailable",
          gold ? `NBP · ${gold.date}` : "Source unavailable")}
        ${UI.metric("USD / EUR", usdRate ? UI.number(usdRate) : "Unavailable",
          `Frankfurter · ${state.rateDate || "Date unavailable"}`)}
        ${UI.metric("EUR / USD", usdRate ? UI.number(1 / usdRate) : "Unavailable",
          "Reference conversion")}
      </div>` +
      UI.panel("Bitcoin Market", `
        <div class="metrics">
          ${UI.metric("24-hour change", btc ? `${UI.number(btc.change24h)}%` : "Unavailable", "CoinPaprika")}
          ${UI.metric("Market capitalization", btc ? money(btc.marketCapUSD, "USD") : "Unavailable", "USD reference")}
          ${UI.metric("24-hour volume", btc ? money(btc.volumeUSD, "USD") : "Unavailable", "USD reference")}
          ${UI.metric("Last provider update", btc ? UI.date(btc.updated) : "Unavailable", "Provider timestamp")}
        </div>
      `) +
      UI.panel("Bitcoin Historical Price", `
        <canvas id="overview-chart" class="chart"></canvas>
      `) +
      UI.panel("United States · Economic Indicators", `
        <div id="overview-economy">${UI.status("Requesting World Bank observations…")}</div>
      `) +
      `<div id="overview-source-errors"></div>`;

    if (state.bitcoinHistory.length) {
      chart("overview-chart", state.bitcoinHistory, "priceUSD", "USD", `BTC / ${displayCurrency}`);
    } else {
      const canvas = document.getElementById("overview-chart");
      if (canvas) UI.drawChart("overview-chart", [], [], "Bitcoin history");
    }

    try {
      const data = await D.loadEconomy("USA");
      if (token !== pageToken || currentPage !== "overview") return;

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

      document.getElementById("overview-economy").innerHTML =
        UI.table(["Indicator", "Value", "Observation year", "Source"], rows);
    } catch {
      const target = document.getElementById("overview-economy");
      if (target) target.innerHTML = UI.status("World Bank data could not be loaded.", true);
    }

    const errorTarget = document.getElementById("overview-source-errors");
    const errors = Object.entries(state.errors);

    if (errorTarget && errors.length) {
      errorTarget.innerHTML = UI.status(
        "Some providers did not respond: " +
        errors.map(([name, error]) => `${name}: ${error}`).join(" · "),
        true
      );
    }
  }

  function renderCurrencies() {
    const entries = Object.entries(D.state.rates)
      .filter(([code]) => D.currencies.includes(code))
      .sort(([a], [b]) => a.localeCompare(b));

    const rows = entries.map(([code, rate]) => [
      code,
      UI.number(rate),
      `1 EUR = ${UI.number(rate)} ${code}`,
      D.state.rateDate || "Unavailable"
    ]);

    content.innerHTML =
      pageHeading(
        "Currencies",
        "Reference exchange rates published through Frankfurter. These rates are not live bank or exchange trading quotes."
      ) +
      UI.panel("Currency Reference Table", `
        <input id="currency-search" type="search" placeholder="Search currency code">
        <div id="currency-table">${UI.table(["Currency", "Rate", "EUR reference", "Date"], rows)}</div>
      `) +
      UI.panel("Currency Converter", `
        <div class="form-grid">
          <label class="field-label">Amount
            <input id="fx-amount" type="number" min="0" value="100">
          </label>
          <label class="field-label">From
            <select id="fx-from">${D.currencies.map(c => `<option>${c}</option>`).join("")}</select>
          </label>
          <label class="field-label">To
            <select id="fx-to">${D.currencies.map(c =>
              `<option ${c === displayCurrency ? "selected" : ""}>${c}</option>`
            ).join("")}</select>
          </label>
        </div>
        <button class="action" id="fx-calculate">Convert</button>
        <div class="result" id="fx-result">—</div>
      `);

    document.getElementById("currency-search").addEventListener("input", event => {
      const query = event.target.value.toLowerCase();
      document.querySelectorAll("#currency-table tbody tr").forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    });

    document.getElementById("fx-calculate").addEventListener("click", () => {
      const amount = Number(document.getElementById("fx-amount").value);
      const from = document.getElementById("fx-from").value;
      const to = document.getElementById("fx-to").value;
      const result = D.convert(amount, from, to);

      document.getElementById("fx-result").textContent =
        result === null ? "Rate unavailable for one or both currencies." : UI.money(result, to);
    });
  }

  function renderMarkets() {
    const btc = D.state.bitcoin;
    const gold = D.state.gold;

    content.innerHTML =
      pageHeading(
        "Markets & Bitcoin",
        "Bitcoin market indicators and precious metals reference prices. Exchange directory entries are not represented as live quotes."
      ) +
      `<div class="metrics">
        ${UI.metric("Bitcoin price", btc ? money(btc.priceUSD, "USD") : "Unavailable", "CoinPaprika")}
        ${UI.metric("24h change", btc ? `${UI.number(btc.change24h)}%` : "Unavailable", "24-hour percentage")}
        ${UI.metric("Market capitalization", btc ? money(btc.marketCapUSD, "USD") : "Unavailable", "USD reference")}
        ${UI.metric("24h trading volume", btc ? money(btc.volumeUSD, "USD") : "Unavailable", "USD reference")}
      </div>` +
      UI.panel("Bitcoin · Historical Price", `
        <canvas id="market-chart" class="chart"></canvas>
        <p class="panel-note">History depends on the provider's endpoint and free-tier availability.</p>
      `) +
      UI.panel("Gold Reference Price", `
        <div class="metrics">
          ${UI.metric("Gold per gram", gold ? money(gold.pricePLN, "PLN") : "Unavailable",
            gold ? `NBP · ${gold.date}` : "Source unavailable")}
        </div>
        <p class="panel-note">NBP reference price in Polish złoty per gram, converted using available exchange rates.</p>
      `) +
      UI.panel("Selected Market Venues", UI.table(
        ["Venue", "Market", "Quote connection"],
        [
          ["Nasdaq", "Equities", "Not connected"],
          ["New York Stock Exchange", "Equities", "Not connected"],
          ["London Stock Exchange", "Equities", "Not connected"],
          ["Tokyo Stock Exchange", "Equities", "Not connected"],
          ["Binance", "Cryptocurrency", "Not connected"],
          ["Coinbase", "Cryptocurrency", "Not connected"],
          ["Kraken", "Cryptocurrency", "Not connected"]
        ]
      ));

    if (D.state.bitcoinHistory.length) {
      chart("market-chart", D.state.bitcoinHistory, "priceUSD", "USD", `BTC / ${displayCurrency}`);
    } else {
      UI.drawChart("market-chart", [], [], "Bitcoin history");
    }
  }

  async function renderEconomy(token) {
    const options = [
      ["USA", "United States"], ["POL", "Poland"], ["GBR", "United Kingdom"],
      ["DEU", "Germany"], ["FRA", "France"], ["JPN", "Japan"],
      ["CHN", "China"], ["IND", "India"], ["BRA", "Brazil"],
      ["CAN", "Canada"], ["AUS", "Australia"], ["CHE", "Switzerland"],
      ["ESP", "Spain"], ["ITA", "Italy"], ["SWE", "Sweden"]
    ];

    content.innerHTML =
      pageHeading(
        "Inflation & Economy",
        "Macroeconomic observations from the World Bank. Each value is shown with its actual observation year."
      ) +
      UI.panel("Select a Country", `
        <div class="form-grid">
          <label class="field-label">Country
            <select id="economy-country">
              ${options.map(([code, name]) => `<option value="${code}">${name}</option>`).join("")}
            </select>
          </label>
        </div>
        <button class="action" id="economy-load">Load indicators</button>
      `) +
      `<div id="economy-results">${UI.status("Loading country indicators…")}</div>`;

    async function load() {
      const code = document.getElementById("economy-country").value;
      const target = document.getElementById("economy-results");
      target.innerHTML = UI.status("Requesting World Bank data…");

      try {
        const data = await D.loadEconomy(code);
        if (token !== pageToken || currentPage !== "economy") return;

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

        target.innerHTML = UI.panel("Latest Available Observations",
          UI.table(["Indicator", "Value", "Year", "Source"], rows));
      } catch (error) {
        if (target) target.innerHTML = UI.status(error.message, true);
      }
    }

    document.getElementById("economy-load").addEventListener("click", load);
    await load();
  }

  function renderCalculators() {
    content.innerHTML =
      pageHeading(
        "Financial Calculators",
        "Currency conversion uses available reference rates. Interest and inflation calculations run locally in your browser."
      ) +
      UI.panel("Currency Conversion", `
        <div class="form-grid">
          <label class="field-label">Amount<input id="calc-fx-amount" type="number" min="0" value="100"></label>
          <label class="field-label">From<select id="calc-fx-from">${D.currencies.map(c => `<option>${c}</option>`).join("")}</select></label>
          <label class="field-label">To<select id="calc-fx-to">${D.currencies.map(c => `<option ${c === displayCurrency ? "selected" : ""}>${c}</option>`).join("")}</select></label>
        </div>
        <button class="action" id="calc-fx">Calculate</button>
        <div class="result" id="calc-fx-result">—</div>
      `) +
      UI.panel("Compound Interest", `
        <div class="form-grid">
          <label class="field-label">Principal<input id="ci-p" type="number" min="0" value="1000"></label>
          <label class="field-label">Annual rate (%)<input id="ci-r" type="number" min="0" value="5"></label>
          <label class="field-label">Years<input id="ci-t" type="number" min="0" value="10"></label>
          <label class="field-label">Compounds per year<input id="ci-n" type="number" min="1" value="12"></label>
        </div>
        <button class="action" id="ci-run">Calculate</button>
        <div class="result" id="ci-result">—</div>
      `) +
      UI.panel("Simple Interest", `
        <div class="form-grid">
          <label class="field-label">Principal<input id="si-p" type="number" min="0" value="1000"></label>
          <label class="field-label">Annual rate (%)<input id="si-r" type="number" min="0" value="5"></label>
          <label class="field-label">Years<input id="si-t" type="number" min="0" value="3"></label>
        </div>
        <button class="action" id="si-run">Calculate</button>
        <div class="result" id="si-result">—</div>
      `) +
      UI.panel("Inflation & Future Cost", `
        <div class="form-grid">
          <label class="field-label">Current amount<input id="inf-p" type="number" min="0" value="1000"></label>
          <label class="field-label">Annual inflation (%)<input id="inf-r" type="number" value="3"></label>
          <label class="field-label">Years<input id="inf-t" type="number" min="0" value="10"></label>
        </div>
        <button class="action" id="inf-run">Calculate</button>
        <div class="result" id="inf-result">—</div>
      `);

    document.getElementById("calc-fx").onclick = () => {
      const amount = Number(document.getElementById("calc-fx-amount").value);
      const from = document.getElementById("calc-fx-from").value;
      const to = document.getElementById("calc-fx-to").value;
      const result = D.convert(amount, from, to);
      document.getElementById("calc-fx-result").textContent =
        result === null ? "Rate unavailable" : UI.money(result, to);
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
        Number.isFinite(result) ? UI.money(result, displayCurrency) : "Check the entered values";
    };

    document.getElementById("si-run").onclick = () => {
      const p = Number(document.getElementById("si-p").value);
      const r = Number(document.getElementById("si-r").value) / 100;
      const t = Number(document.getElementById("si-t").value);
      const result = p * (1 + r * t);

      document.getElementById("si-result").textContent =
        Number.isFinite(result) && p >= 0 && r >= 0 && t >= 0
          ? UI.money(result, displayCurrency)
          : "Check the entered values";
    };

    document.getElementById("inf-run").onclick = () => {
      const p = Number(document.getElementById("inf-p").value);
      const r = Number(document.getElementById("inf-r").value) / 100;
      const t = Number(document.getElementById("inf-t").value);
      const result = p * Math.pow(1 + r, t);

      document.getElementById("inf-result").textContent =
        Number.isFinite(result) && p >= 0 && t >= 0
          ? UI.money(result, displayCurrency)
          : "Check the entered values";
    };
  }

  async function renderArchive(token) {
    content.innerHTML =
      pageHeading(
        "Historical Archive",
        "Available historical observations from connected public data providers."
      ) +
      UI.panel("Bitcoin Historical Price", `
        <canvas id="archive-btc-chart" class="chart"></canvas>
      `) +
      UI.panel("Gold · NBP Daily Reference", `
        <div id="archive-gold">${UI.status("Loading historical gold observations…")}</div>
      `);

    if (D.state.bitcoinHistory.length) {
      chart("archive-btc-chart", D.state.bitcoinHistory, "priceUSD", "USD", `BTC / ${displayCurrency}`);
    } else {
      UI.drawChart("archive-btc-chart", [], [], "Bitcoin history");
    }

    try {
      if (!D.state.goldHistory.length) await D.loadGold();
      if (token !== pageToken || currentPage !== "archive") return;

      const rows = D.state.goldHistory.slice().reverse().map(item => [
        item.date,
        UI.number(item.pricePLN),
        money(item.pricePLN, "PLN"),
        "NBP"
      ]);

      document.getElementById("archive-gold").innerHTML =
        UI.table(["Date", "PLN / gram", `${displayCurrency} / gram`, "Source"], rows);
    } catch (error) {
      const target = document.getElementById("archive-gold");
      if (target) target.innerHTML = UI.status(error.message, true);
    }
  }

  function renderExchanges() {
    content.innerHTML =
      pageHeading(
        "Exchanges",
        "A directory of major stock and cryptocurrency exchanges. Live exchange trading feeds are not connected."
      ) +
      UI.panel("Stock Exchanges", UI.table(
        ["Exchange", "Location", "Market", "Live quotes"],
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
        ["Exchange", "Market", "Live quotes"],
        [
          ["Binance", "Cryptocurrency", "Not connected"],
          ["Coinbase", "Cryptocurrency", "Not connected"],
          ["Kraken", "Cryptocurrency", "Not connected"],
          ["Bitstamp", "Cryptocurrency", "Not connected"],
          ["OKX", "Cryptocurrency", "Not connected"]
        ]
      ));
  }

  async function renderGlobe(token) {
    content.innerHTML =
      pageHeading(
        "Global Globe",
        "Explore country borders on a 3D globe. Select a country to request its available economic indicators."
      ) +
      `<div id="globe"></div>
       <div id="country-profile">${UI.status("Preparing the globe…")}</div>`;

    const globeElement = document.getElementById("globe");
    const profile = document.getElementById("country-profile");

    try {
      if (!window.ArchiveGlobe) throw new Error("globe.js did not load");

      await window.ArchiveGlobe.create(globeElement, async name => {
        const code = countryCodes[name];

        if (!code) {
          profile.innerHTML = UI.status(
            `${name}: no country code mapping is configured. Economic data is not available in this view.`
          );
          return;
        }

        profile.innerHTML = UI.status(`Loading World Bank indicators for ${name}…`);

        try {
          const data = await D.loadEconomy(code);
          if (token !== pageToken || currentPage !== "globe") return;

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

          profile.innerHTML = UI.panel(name,
            UI.table(["Indicator", "Value", "Observation year", "Source"], rows));
        } catch (error) {
          profile.innerHTML = UI.status(error.message, true);
        }
      });
    } catch (error) {
      globeElement.innerHTML = UI.status(
        `The globe could not be loaded: ${error.message}. Other pages remain available.`,
        true
      );
    }
  }

  currencySelect.addEventListener("change", () => {
    displayCurrency = currencySelect.value;
    render(currentPage);
  });

  async function initialize() {
    updateStatus.textContent = "Loading public financial data…";
    const result = await D.refresh();

    const failures = Object.keys(result.errors);
    updateStatus.textContent = failures.length
      ? `Some data sources unavailable · ${new Date().toLocaleString()}`
      : `Data refreshed · ${new Date().toLocaleString()}`;

    render("overview");
  }

  window.ArchiveApp = {
    render,
    refresh: initialize,
    get currency() {
      return displayCurrency;
    }
  };

  initialize().catch(error => {
    content.innerHTML = UI.status(`Startup error: ${error.message}`, true);
    updateStatus.textContent = "Startup incomplete";
  });
})();
