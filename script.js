/* THE MONETARY ARCHIVE — interface controller */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  let state = null;
  let charts = {};
  let selectedCurrency = "USD";
  let archiveRows = [];

  const currencyNames = {
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "Pound Sterling",
    CHF: "Swiss Franc",
    JPY: "Japanese Yen",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    CNY: "Chinese Yuan",
    INR: "Indian Rupee",
    BRL: "Brazilian Real",
    PLN: "Polish Zloty",
    SEK: "Swedish Krona",
    NOK: "Norwegian Krone",
    DKK: "Danish Krone",
    CZK: "Czech Koruna",
    HUF: "Hungarian Forint",
    KRW: "South Korean Won",
    SGD: "Singapore Dollar",
    MXN: "Mexican Peso",
    ZAR: "South African Rand",
    TRY: "Turkish Lira",
    IDR: "Indonesian Rupiah",
    THB: "Thai Baht",
    NZD: "New Zealand Dollar",
    ARS: "Argentine Peso",
    NGN: "Nigerian Naira",
    EGP: "Egyptian Pound",
    RUB: "Russian Ruble",
    UAH: "Ukrainian Hryvnia"
  };

  const fmt = (value, currency = selectedCurrency, digits = 2) =>
    ArchiveData.format(value, currency, digits);

  const set = (id, value) => {
    const element = $(id);
    if (element) element.textContent = value;
  };

  const html = (id, value) => {
    const element = $(id);
    if (element) element.innerHTML = value;
  };

  /* =========================================
     NAVIGATION
  ========================================= */

  function navigate(page) {
    const target = document.getElementById(`page-${page}`);

    if (!target) return;

    document.querySelectorAll(".page").forEach(element => {
      element.classList.toggle("active", element === target);
    });

    document.querySelectorAll(".nav-link").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.page === page
      );
    });

    set(
      "breadcrumb",
      page.replaceAll("-", " ").toUpperCase()
    );

    $("sidebar")?.classList.remove("open");

    if (page === "globe") {
      window.dispatchEvent(
        new Event("archive:globe-page-open")
      );
    }

    if (page === "overview") {
      window.dispatchEvent(
        new Event("archive:overview-open")
      );
    }

    if (page === "inflation") {
      renderEconomy();
    }

    if (page === "currencies") {
      renderCurrencies();
    }

    if (page === "markets") {
      renderMarkets();
    }

    window.scrollTo({
      top: 0,
      behavior: "instant"
    });
  }

  /* =========================================
     CURRENCY SELECTORS
  ========================================= */

  function availableCurrencies() {
    if (!state?.fx) {
      return ["USD", "PLN"];
    }

    return Array.from(
      new Set([
        "USD",
        "PLN",
        ...state.fx.rates.map(rate => rate.code)
      ])
    ).filter(code =>
      ArchiveData.currencies.includes(code) ||
      code === "PLN"
    );
  }

  function fillCurrencySelect(id, defaultValue) {
    const element = $(id);

    if (!element) return;

    const currencies = availableCurrencies();

    element.innerHTML = currencies.map(code => `
      <option
        value="${code}"
        ${code === defaultValue ? "selected" : ""}
      >
        ${code} · ${currencyNames[code] || code}
      </option>
    `).join("");

    if (!currencies.includes(defaultValue)) {
      element.value = "USD";
    }
  }

  /* =========================================
     DATA SOURCE STATUS
  ========================================= */

  function renderStatus() {
    const sources = state?.sources || [];

    const online = sources.filter(
      source => source.status === "online"
    ).length;

    const total = sources.length;

    const status = $("connection-status");

    if (status) {
      status.classList.toggle("offline", online === 0);

      status.innerHTML = `
        <i></i>
        ${online}/${total} SOURCES ONLINE
      `;
    }

    const sourceBox = $("source-monitor");

    if (sourceBox) {
      sourceBox.innerHTML = sources.map(source => `
        <div class="source-row">
          <span>${source.name}</span>
          <span>
            ${source.status === "online"
              ? "AVAILABLE"
              : "UNAVAILABLE"}
          </span>
        </div>
      `).join("") || "No source status";
    }

    const marketBox = $("market-sources");

    if (marketBox) {
      marketBox.innerHTML = sources.map(source => `
        <div class="source-row">
          <span>
            ${source.name}
            <small>
              ${source.date || source.error || ""}
            </small>
          </span>

          <span>${source.status.toUpperCase()}</span>
        </div>
      `).join("");
    }
  }

  /* =========================================
     OVERVIEW
  ========================================= */

  function renderOverview() {
    const fx = state?.fx;
    const btc = state?.bitcoin;

    if (btc) {
      const convertedBitcoin = ArchiveData.convert(
        btc.usd,
        "USD",
        selectedCurrency
      );

      set(
        "overview-btc",
        fmt(convertedBitcoin)
      );

      set(
        "overview-btc-meta",
        `24h ${
          btc.change24h === null
            ? "—"
            : btc.change24h.toFixed(2) + "%"
        } · CoinGecko`
      );

      set(
        "ticker-btc",
        `BTC ${fmt(convertedBitcoin)}`
      );

      set(
        "btc-chart-current",
        fmt(convertedBitcoin, selectedCurrency)
      );

      const heading = document.querySelector(
        "#page-overview .chart-panel h2"
      );

      if (heading) {
        heading.textContent = `Bitcoin · ${selectedCurrency}`;
      }

    } else {
      set("overview-btc", "Unavailable");

      set(
        "overview-btc-meta",
        state?.errors?.bitcoin || "Source unavailable"
      );
    }

    if (fx) {
      const gold = ArchiveData.goldIn(
        selectedCurrency,
        fx
      );

      set(
        "overview-gold",
        gold === null ? "—" : fmt(gold)
      );

      set(
        "overview-gold-meta",
        `NBP ${fx.goldDate || ""} · per troy ounce`
      );

      set(
        "ticker-gold",
        `GOLD ${gold === null ? "—" : fmt(gold)}`
      );

      const eurusd = ArchiveData.convert(
        1,
        "EUR",
        "USD",
        fx
      );

      set(
        "overview-eurusd",
        eurusd === null ? "—" : eurusd.toFixed(4)
      );

      set(
        "overview-fx-meta",
        `NBP · ${fx.tableDate}`
      );

      set("ticker-usd", "USD 1.00");

      set(
        "ticker-eur",
        `EUR ${eurusd === null ? "—" : eurusd.toFixed(4)}`
      );

      set(
        "currency-date",
        `NBP TABLE ${fx.tableNo || "—"} · ${fx.tableDate || "—"}`
      );

    } else {
      set("overview-gold", "Unavailable");
      set("overview-eurusd", "Unavailable");
    }

    const usInflation = state?.economy
      ?.filter(item =>
        item.country === "US" &&
        item.kind === "inflation"
      )
      .sort((a, b) => b.year - a.year)[0];

    set(
      "overview-inflation",
      usInflation
        ? `${usInflation.value.toFixed(2)}%`
        : "—"
    );

    set(
      "overview-inflation-meta",
      usInflation
        ? `World Bank · ${usInflation.year}`
        : "No latest observation"
    );

    renderRates();
    renderIndicators();
    renderStatus();

    set(
      "last-updated",
      `Checked ${new Date(state.checkedAt).toLocaleTimeString()}`
    );

    set(
      "live-clock",
      new Date().toLocaleString("en-GB")
    );

    set(
      "footer-time",
      new Date().toLocaleDateString("en-GB")
    );

    drawBitcoinChart(
      btc?.history || [],
      "btc-chart"
    );
  }

  /* =========================================
     OVERVIEW CURRENCY RATES
  ========================================= */

  function renderRates() {
    const box = $("overview-rates");

    if (!box) return;

    if (!state?.fx) {
      box.innerHTML = `
        <div class="empty">
          NBP reference rates unavailable.
        </div>
      `;

      return;
    }

    const codes = [
      "EUR",
      "GBP",
      "CHF",
      "JPY",
      "CAD",
      "PLN"
    ];

    box.innerHTML = codes.map(code => {
      const value = ArchiveData.convert(
        1,
        code,
        selectedCurrency
      );

      return `
        <div class="rate-row">
          <span>
            ${code} · ${currencyNames[code]}
          </span>

          <b>
            ${
              value === null
                ? "—"
                : fmt(value, selectedCurrency, 4)
            }
          </b>

          <small>per 1 ${code}</small>
        </div>
      `;
    }).join("");
  }

  /* =========================================
     ECONOMIC INDICATORS ON OVERVIEW
  ========================================= */

  function renderIndicators() {
    const box = $("overview-indicators");

    if (!box) return;

    const countries = [
      "US",
      "GB",
      "DE",
      "JP",
      "CN",
      "PL"
    ];

    const picks = countries
      .map(code =>
        state?.economy
          ?.filter(item =>
            item.country === code &&
            item.kind === "gdp"
          )
          .sort((a, b) => b.year - a.year)[0]
      )
      .filter(Boolean);

    box.innerHTML = picks.length
      ? picks.map(item => `
          <div class="indicator-row">
            <span>
              ${item.countryName} · GDP growth
            </span>

            <b>
              ${item.value.toFixed(2)}%
              <small>${item.year}</small>
            </b>
          </div>
        `).join("")
      : `
        <div class="empty">
          No economic observations available.
        </div>
      `;
  }

  /* =========================================
     CURRENCY TABLE
  ========================================= */

  function renderCurrencies() {
    const body = $("currency-table");

    if (!body) return;

    if (!state?.fx) {
      body.innerHTML = `
        <tr>
          <td colspan="5">NBP data unavailable.</td>
        </tr>
      `;

      return;
    }

    const rows = state.fx.rates
      .filter(rate => rate.code !== "PLN")
      .map(rate => ({
        code: rate.code,
        name: rate.name,
        pln: rate.pln,

        display: ArchiveData.convert(
          1,
          rate.code,
          selectedCurrency
        )
      }));

    rows.push({
      code: "PLN",
      name: "Polish Zloty",
      pln: 1,

      display: ArchiveData.convert(
        1,
        "PLN",
        selectedCurrency
      )
    });

    body.innerHTML = rows
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(rate => `
        <tr>
          <td><b>${rate.code}</b></td>

          <td>${rate.name}</td>

          <td>
            ${
              rate.display === null
                ? "—"
                : fmt(rate.display, selectedCurrency, 5)
            }
          </td>

          <td>
            ${
              rate.pln === null
                ? "—"
                : rate.pln.toFixed(5)
            }
          </td>

          <td>NBP · ${state.fx.tableDate}</td>
        </tr>
      `).join("");

    document.querySelectorAll(".display-code").forEach(element => {
      element.textContent = selectedCurrency;
    });

    renderConverter();
  }

  /* =========================================
     CONVERTERS
  ========================================= */

  function renderConverter() {
    [
      "convert-from",
      "convert-to",
      "calc-from",
      "calc-to"
    ].forEach(id => {
      fillCurrencySelect(
        id,
        id.endsWith("from")
          ? "USD"
          : selectedCurrency
      );
    });

    [
      "convert-to",
      "calc-to"
    ].forEach(id => {
      if ($(id)) {
        $(id).value = selectedCurrency;
      }
    });

    convertUI(
      "convert-amount",
      "convert-from",
      "convert-to",
      "convert-result"
    );

    convertUI(
      "calc-amount",
      "calc-from",
      "calc-to",
      "calc-currency-result"
    );
  }

  function convertUI(
    amountId,
    fromId,
    toId,
    resultId
  ) {
    const amount = Number($(amountId)?.value);

    const from = $(fromId)?.value || "USD";

    const to = $(toId)?.value || selectedCurrency;

    const result = ArchiveData.convert(
      amount,
      from,
      to
    );

    set(
      resultId,
      result === null
        ? "Rate unavailable"
        : fmt(result, to)
    );

    set(
      "converter-note",
      `Reference rates: NBP table date ${
        state?.fx?.tableDate || "unavailable"
      }. Indicative conversion only.`
    );
  }

  /* =========================================
     ECONOMY TABLE
  ========================================= */

  function renderEconomy() {
    const kind = $("indicator-select")?.value || "inflation";

    const body = $("economy-table");

    if (!body) return;

    const rows = (state?.economy || [])
      .filter(item => item.kind === kind)
      .sort((a, b) =>
        a.countryName.localeCompare(b.countryName)
      );

    body.innerHTML = rows.length
      ? rows.map(item => `
          <tr>
            <td>${item.countryName}</td>
            <td>${item.indicatorName}</td>
            <td>${item.value.toFixed(2)}%</td>
            <td>${item.year}</td>
            <td>World Bank</td>
          </tr>
        `).join("")
      : `
          <tr>
            <td colspan="5">
              No observations returned for this indicator.
            </td>
          </tr>
        `;

    archiveRows = state?.economy || [];

    renderArchive();
  }

  /* =========================================
     BITCOIN CHART
  ========================================= */

  function drawBitcoinChart(points, id) {
    const canvas = $(id);

    if (
      !canvas ||
      !window.Chart ||
      !points?.length
    ) {
      return;
    }

    const labels = points.map(point =>
      new Date(point.time).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric"
        }
      )
    );

    const values = points.map(point =>
      ArchiveData.convert(
        point.value,
        "USD",
        selectedCurrency
      )
    );

    if (charts[id]) {
      charts[id].destroy();
    }

    charts[id] = new Chart(canvas, {
      type: "line",

      data: {
        labels,

        datasets: [{
          label: `BTC / ${selectedCurrency}`,

          data: values,

          borderColor: "#b99662",

          backgroundColor: "rgba(185,150,98,.10)",

          fill: true,

          tension: 0.25,

          pointRadius: 0,

          borderWidth: 2
        }]
      },

      options: {
        responsive: true,

        maintainAspectRatio: false,

        plugins: {
          legend: {
            display: false
          },

          tooltip: {
            callbacks: {
              label: context =>
                fmt(
                  context.parsed.y,
                  selectedCurrency
                )
            }
          }
        },

        scales: {
          x: {
            ticks: {
              color: "#87919a",
              maxTicksLimit: 7
            },

            grid: {
              color: "rgba(255,255,255,.04)"
            }
          },

          y: {
            ticks: {
              color: "#87919a",

              callback: value =>
                fmt(
                  Number(value),
                  selectedCurrency,
                  0
                )
            },

            grid: {
              color: "rgba(255,255,255,.07)"
            }
          }
        }
      }
    });
  }

  /* =========================================
     MARKETS AND BITCOIN
  ========================================= */

  function renderMarkets() {
    const btc = state?.bitcoin;

    const converted = value =>
      value === null || value === undefined
        ? null
        : ArchiveData.convert(
            value,
            "USD",
            selectedCurrency
          );

    set(
      "market-btc",
      btc
        ? fmt(converted(btc.usd), selectedCurrency)
        : "Unavailable"
    );

    set(
      "market-btc-meta",
      btc
        ? `CoinGecko · ${new Date(btc.updatedAt).toLocaleString()}`
        : state?.errors?.bitcoin || "Unavailable"
    );

    set(
      "market-btc-change",
      btc?.change24h === null ||
      btc?.change24h === undefined
        ? "—"
        : `${
            btc.change24h > 0 ? "+" : ""
          }${btc.change24h.toFixed(2)}%`
    );

    set(
      "market-btc-cap",
      btc
        ? fmt(
            converted(btc.marketCapUsd),
            selectedCurrency,
            0
          )
        : "Unavailable"
    );

    set(
      "market-btc-volume",
      btc
        ? fmt(
            converted(btc.volume24hUsd),
            selectedCurrency,
            0
          )
        : "Unavailable"
    );

    const gold = ArchiveData.goldIn(
      selectedCurrency
    );

    set(
      "market-gold",
      gold === null
        ? "Unavailable"
        : fmt(gold, selectedCurrency)
    );

    set(
      "market-gold-meta",
      `NBP ${state?.fx?.goldDate || ""} · troy ounce`
    );

    if (btc) {
      drawBitcoinChart(
        btc.history,
        "market-btc-chart"
      );

      const heading = document.querySelector(
        "#page-markets .chart-panel h2"
      );

      if (heading) {
        heading.textContent = `BTC / ${selectedCurrency}`;
      }
    }
  }

  /* =========================================
     HISTORICAL ARCHIVE
  ========================================= */

  function renderArchive() {
    const query = (
      $("archive-search")?.value || ""
    ).toLowerCase();

    const rows = archiveRows.filter(item =>
      `${item.countryName} ${item.indicatorName} ${item.source}`
        .toLowerCase()
        .includes(query)
    );

    const body = $("archive-table");

    if (body) {
      body.innerHTML = rows.length
        ? rows.map(item => `
            <tr>
              <td>${item.countryName}</td>
              <td>${item.indicatorName}</td>
              <td>${item.value.toFixed(3)} ${item.unit}</td>
              <td>${item.date}</td>
              <td>${item.source}</td>
            </tr>
          `).join("")
        : `
            <tr>
              <td colspan="5">
                No matching observations.
              </td>
            </tr>
          `;
    }

    set(
      "archive-count",
      `${rows.length} records · World Bank observations`
    );
  }

  /* =========================================
     COUNTRY DOSSIER
  ========================================= */

  function countryProfile(code) {
    const profile = ArchiveData.getCountry(code);

    if (!profile) return;

    set("country-name", profile.name);

    set(
      "country-description",
      `${profile.currency} · ${profile.name} country dossier`
    );

    html(
      "country-exchanges",
      profile.exchanges.map(exchange => `
        <div>◇ ${exchange}</div>
      `).join("")
    );

    set(
      "country-stats",
      "Loading country indicators…"
    );

    ArchiveData.getCountryData(code)
      .then(data => {
        const stats = data.indicators.map(indicator => {
          const latest = indicator.latest;

          return `
            <div class="country-stat">
              <small>${indicator.name.toUpperCase()}</small>

              <strong>
                ${
                  latest
                    ? latest.value.toFixed(2) + "%"
                    : "—"
                }
              </strong>

              <small>
                ${
                  latest
                    ? `Latest available · ${latest.year}`
                    : "No observation"
                }
              </small>
            </div>
          `;
        }).join("");

        html(
          "country-stats",
          stats || `
            <div class="empty">
              No indicators available.
            </div>
          `
        );
      })
      .catch(error => {
        set(
          "country-stats",
          `Unable to load indicators: ${error.message}`
        );
      });
  }

  /* =========================================
     CALCULATORS
  ========================================= */

  function calculate() {
    const amount = Number(
      $("inflation-amount")?.value
    );

    const inflationRate = Number(
      $("inflation-rate")?.value
    ) / 100;

    const years = Number(
      $("inflation-years")?.value
    );

    if (
      amount >= 0 &&
      inflationRate > -1 &&
      years >= 0 &&
      years <= 100
    ) {
      set(
        "inflation-result",
        fmt(
          amount / Math.pow(1 + inflationRate, years)
        )
      );
    } else {
      set("inflation-result", "Check inputs");
    }

    const principal = Number(
      $("compound-principal")?.value
    );

    const annualRate = Number(
      $("compound-rate")?.value
    ) / 100;

    const compoundYears = Number(
      $("compound-years")?.value
    );

    if (
      principal >= 0 &&
      annualRate > -1 &&
      compoundYears >= 0 &&
      compoundYears <= 100
    ) {
      set(
        "compound-result",
        fmt(
          principal *
          Math.pow(1 + annualRate, compoundYears)
        )
      );
    } else {
      set("compound-result", "Check inputs");
    }
  }

  /* =========================================
     EXPORT CSV
  ========================================= */

  function exportCSV() {
    const rows = archiveRows;

    const quote = '"';

    const csv = [
      [
        "Country",
        "Indicator",
        "Value",
        "Unit",
        "Date",
        "Source"
      ],

      ...rows.map(item => [
        item.countryName,
        item.indicatorName,
        item.value,
        item.unit,
        item.date,
        item.source
      ])

    ].map(row =>
      row.map(value =>
        quote +
        String(value ?? "").replaceAll(
          quote,
          quote + quote
        ) +
        quote
      ).join(",")
    ).join("\r\n");

    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + csv],
        {
          type: "text/csv;charset=utf-8"
        }
      )
    );

    const link = document.createElement("a");

    link.href = url;

    link.download =
      "monetary-archive-observations.csv";

    link.click();

    URL.revokeObjectURL(url);
  }

  /* =========================================
     EVENT HANDLERS
  ========================================= */

  function bind() {

    /* Navigation buttons */

    document.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", () => {
        navigate(button.dataset.page);
      });
    });

    document.querySelectorAll("[data-go]").forEach(button => {
      button.addEventListener("click", () => {
        navigate(button.dataset.go);
      });
    });

    /* Display currency */

    $("display-currency")?.addEventListener(
      "change",
      event => {
        selectedCurrency = event.target.value;

        renderOverview();
        renderCurrencies();
        renderMarkets();
        renderConverter();
      }
    );

    /* Mobile sidebar */

    $("mobile-menu")?.addEventListener(
      "click",
      () => {
        $("sidebar")?.classList.toggle("open");
      }
    );

    /* Main currency converter */

    [
      "convert-amount",
      "convert-from",
      "convert-to"
    ].forEach(id => {
      const element = $(id);

      element?.addEventListener("input", () => {
        convertUI(
          "convert-amount",
          "convert-from",
          "convert-to",
          "convert-result"
        );
      });

      element?.addEventListener("change", () => {
        convertUI(
          "convert-amount",
          "convert-from",
          "convert-to",
          "convert-result"
        );
      });
    });

    /* Calculator currency converter */

    [
      "calc-amount",
      "calc-from",
      "calc-to"
    ].forEach(id => {
      const element = $(id);

      element?.addEventListener("input", () => {
        convertUI(
          "calc-amount",
          "calc-from",
          "calc-to",
          "calc-currency-result"
        );
      });

      element?.addEventListener("change", () => {
        convertUI(
          "calc-amount",
          "calc-from",
          "calc-to",
          "calc-currency-result"
        );
      });
    });

    $("calc-convert")?.addEventListener(
      "click",
      () => {
        convertUI(
          "calc-amount",
          "calc-from",
          "calc-to",
          "calc-currency-result"
        );
      }
    );

    /* Financial calculators */

    $("calc-inflation")?.addEventListener(
      "click",
      calculate
    );

    $("calc-compound")?.addEventListener(
      "click",
      calculate
    );

    /* Economy filters */

    $("indicator-select")?.addEventListener(
      "change",
      renderEconomy
    );

    /* Historical archive search */

    $("archive-search")?.addEventListener(
      "input",
      renderArchive
    );

    /* CSV export */

    $("export-csv")?.addEventListener(
      "click",
      exportCSV
    );

    /* Bitcoin history period */

    $("btc-period")?.addEventListener(
      "change",
      async event => {
        try {
          const history =
            await ArchiveData.getBitcoinHistory(
              Number(event.target.value)
            );

          drawBitcoinChart(
            history,
            "market-btc-chart"
          );

        } catch (error) {
          set(
            "market-btc-note",
            `History unavailable: ${error.message}`
          );
        }
      }
    );

    /* Country selected on globe */

    window.addEventListener(
      "archive:country-selected",
      event => {
        navigate("globe");
        countryProfile(event.detail.code);
      }
    );

    /* Country without configured economic profile */

    window.addEventListener(
      "archive:country-unavailable",
      event => {
        navigate("globe");

        set(
          "country-name",
          event.detail.name || "Country profile unavailable"
        );

        set(
          "country-description",
          "The world map includes this country, but this archive does not yet have a configured country dataset for it."
        );

        set(
          "country-stats",
          "No verified indicators are configured for this country."
        );

        set(
          "country-exchanges",
          "No exchange directory is available."
        );
      }
    );
  }

  /* =========================================
     LOAD AND REFRESH DATA
  ========================================= */

  async function refresh(force = false) {
    const status = $("connection-status");

    if (status) {
      status.innerHTML = "<i></i> CHECKING SOURCES";
    }

    try {
      state = await ArchiveData.loadDashboard(force);

      const display = $("display-currency");

      if (display && state.fx) {
        const supported = availableCurrencies();

        display.innerHTML = supported.map(code => `
          <option value="${code}">
            ${code}
          </option>
        `).join("");

        if (!supported.includes(selectedCurrency)) {
          selectedCurrency = "USD";
        }

        display.value = selectedCurrency;
      }

      renderOverview();
      renderCurrencies();
      renderMarkets();
      renderEconomy();
      renderConverter();
      calculate();

      archiveRows = state.economy || [];

      renderArchive();

    } catch (error) {
      if (status) {
        status.classList.add("offline");
        status.textContent = "DATA UNAVAILABLE";
      }

      console.error(
        "Archive data load failed",
        error
      );
    }
  }

  /* =========================================
     APPLICATION START
  ========================================= */

  function init() {
    bind();

    fillCurrencySelect("convert-from", "USD");
    fillCurrencySelect("convert-to", "USD");

    fillCurrencySelect("calc-from", "USD");
    fillCurrencySelect("calc-to", "USD");

    refresh();

    setInterval(
      () => refresh(true),
      5 * 60 * 1000
    );

    setInterval(
      () => {
        set(
          "live-clock",
          new Date().toLocaleString("en-GB")
        );
      },
      1000
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
