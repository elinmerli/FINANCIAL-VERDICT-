/* ==========================================================
   THE MONETARY ARCHIVE — APPLICATION CONTROLLER
========================================================== */

(() => {
  "use strict";

  const D = window.ArchiveData;
  if (!D) {
    console.error("ArchiveData was not loaded.");
    return;
  }

  const $ = id => document.getElementById(id);
  const charts = {};
  let currentCurrency = "USD";
  let allCurrencies = [];
  let currentBitcoinDays = 1;
  let currentEconomyCountry = "USA";

  const currencyToCoinGecko = code => code.toLowerCase();

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value ?? "—";
  }

  function setHTML(id, value) {
    const element = $(id);
    if (element) element.innerHTML = value;
  }

  function showError(id, message) {
    setText(id, message || "Data unavailable");
  }

  function formatPercent(value) {
    if (!Number.isFinite(Number(value))) return "Unavailable";
    const number = Number(value);
    return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
  }

  function formatCompactMoney(value, currency = currentCurrency) {
    if (!Number.isFinite(Number(value))) return "Unavailable";

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 2
      }).format(value);
    } catch {
      return `${D.formatNumber(value)} ${currency}`;
    }
  }

  function formatTimestamp(value) {
    if (!value) return "Unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unavailable";
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function showStatus(message, isError = false) {
    const status = $("lastUpdated");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("error-text", isError);
  }

  function setMetricChange(id, value) {
    const element = $(id);
    if (!element) return;

    element.textContent = formatPercent(value);
    element.classList.remove("positive", "negative", "neutral");

    if (!Number.isFinite(Number(value))) {
      element.classList.add("neutral");
    } else {
      element.classList.add(Number(value) >= 0 ? "positive" : "negative");
    }
  }

  function createOrUpdateChart(id, config) {
    const canvas = $(id);
    if (!canvas || typeof Chart === "undefined") return;

    if (charts[id]) {
      charts[id].destroy();
    }

    const context = canvas.getContext("2d");
    charts[id] = new Chart(context, config);
  }

  function lineChartConfig(labels, datasets, currencyLabel = "") {
    return {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: {
            display: datasets.length > 1,
            labels: { color: "#b9ad96", usePointStyle: true, boxWidth: 7 }
          },
          tooltip: {
            backgroundColor: "#191813",
            borderColor: "rgba(194,161,96,.4)",
            borderWidth: 1,
            titleColor: "#e9dfc9",
            bodyColor: "#d0c2a8",
            callbacks: {
              label: context =>
                `${context.dataset.label}: ${D.formatNumber(context.parsed.y, 2)} ${currencyLabel}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(200,180,140,.07)" },
            ticks: { color: "#8f8778", maxTicksLimit: 8 }
          },
          y: {
            grid: { color: "rgba(200,180,140,.08)" },
            ticks: { color: "#8f8778" }
          }
        }
      }
    };
  }

  function renderBitcoinChart(points, canvasId, captionId) {
    if (!points?.length) {
      setText(captionId, "No historical observations are available.");
      return;
    }

    const labels = points.map(point =>
      point.date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        ...(currentBitcoinDays > 30 ? { year: "2-digit" } : {})
      })
    );

    const values = points.map(point => point.price);

    createOrUpdateChart(canvasId, lineChartConfig(
      labels,
      [{
        label: `BTC / ${currentCurrency}`,
        data: values,
        borderColor: "#c7a86c",
        backgroundColor: "rgba(199,168,108,.12)",
        fill: true,
        tension: 0.28,
        pointRadius: 0,
        borderWidth: 2
      }],
      currentCurrency
    ));

    setText(captionId, `${points.length} historical observations · CoinGecko`);
  }

  async function refreshBitcoinHistory(days = currentBitcoinDays) {
    currentBitcoinDays = Number(days);

    try {
      const points = await D.loadBitcoinHistory(
        currentBitcoinDays,
        currencyToCoinGecko(currentCurrency)
      );

      renderBitcoinChart(points, "overviewBitcoinChart", "bitcoinChartCaption");
      renderBitcoinChart(points, "marketBitcoinChart", "marketChartNote");
    } catch (error) {
      console.error(error);
      setText("bitcoinChartCaption", "Bitcoin history is temporarily unavailable.");
      setText("marketChartNote", "Historical market data could not be loaded.");
    }
  }

  async function refreshBitcoin(force = false) {
    try {
      const btc = await D.loadBitcoin(
        currencyToCoinGecko(currentCurrency),
        force
      );

      const price = D.formatMoney(btc.price, currentCurrency, 2);
      const change = formatPercent(btc.change24h);

      setText("overviewBitcoin", price);
      setText("marketBitcoinPrice", price);
      setMetricChange("overviewBitcoinChange", btc.change24h);
      setMetricChange("marketBitcoinChange", btc.change24h);

      setText("bitcoinMarketCap", formatCompactMoney(btc.marketCap));
      setText("bitcoinVolume", formatCompactMoney(btc.volume));
      setText("bitcoinHigh", D.formatMoney(btc.high, currentCurrency, 2));
      setText("bitcoinLow", D.formatMoney(btc.low, currentCurrency, 2));
      setText("bitcoinSupply", D.formatNumber(btc.supply, 0) + " BTC");
      setText("bitcoinUpdated", formatTimestamp(btc.updated));

      setText("marketBitcoinCap", formatCompactMoney(btc.marketCap));
      setText("marketBitcoinVolume", formatCompactMoney(btc.volume));
      setText("marketBitcoinHigh", D.formatMoney(btc.high, currentCurrency, 2));
      setText("marketBitcoinLow", D.formatMoney(btc.low, currentCurrency, 2));
    } catch (error) {
      console.error("Bitcoin:", error);
      [
        "overviewBitcoin", "marketBitcoinPrice", "bitcoinMarketCap",
        "bitcoinVolume", "bitcoinHigh", "bitcoinLow", "bitcoinSupply",
        "bitcoinUpdated", "marketBitcoinCap", "marketBitcoinVolume",
        "marketBitcoinHigh", "marketBitcoinLow"
      ].forEach(id => showError(id, "Market data unavailable"));

      setText("overviewBitcoinChange", "Provider unavailable");
      setText("marketBitcoinChange", "Provider unavailable");
    }

    await refreshBitcoinHistory(currentBitcoinDays);
  }

  async function refreshGold(force = false) {
    try {
      const gold = await D.loadGold(force);
      const gram = D.toDisplayCurrency(gold.pricePLNPerGram, currentCurrency);

      if (!Number.isFinite(gram)) throw new Error("Currency conversion unavailable.");

      const ounce = gram * 31.1034768;

      setText("overviewGold", D.formatMoney(gram, currentCurrency, 2));
      setText("marketGoldGram", D.formatMoney(gram, currentCurrency, 2));
      setText("marketGoldOunce", D.formatMoney(ounce, currentCurrency, 2));
      setText("marketGoldDate", D.formatDate(gold.date));
      setText("goldCurrencyLabel", currentCurrency);
      setText("overviewGoldChange", `Reference date: ${D.formatDate(gold.date)}`);
    } catch (error) {
      console.error("Gold:", error);
      showError("overviewGold", "Unavailable");
      showError("marketGoldGram", "Unavailable");
      showError("marketGoldOunce", "Unavailable");
      showError("marketGoldDate", "Unavailable");
    }
  }

  function renderOverviewRates() {
    const selected = ["USD", "EUR", "GBP", "CHF", "JPY", "PLN"];
    const rows = selected.map(code => {
      const ratePLN = D.state.ratesPLN[code];
      if (!Number.isFinite(ratePLN)) return null;

      const converted = D.convert(1, code, currentCurrency);
      return `
        <tr>
          <td><strong>${code}</strong></td>
          <td>${D.currencyNames[code] || code}</td>
          <td>${D.formatNumber(converted, 4)} ${currentCurrency}</td>
          <td>NBP · ${D.formatDate(D.state.rateDate)}</td>
        </tr>`;
    }).filter(Boolean);

    setHTML(
      "overviewCurrencyRows",
      rows.length ? rows.join("") :
        '<tr><td colspan="4" class="loading-cell">Currency data unavailable.</td></tr>'
    );
  }

  function renderCurrencyTable() {
    const search = ($("currencySearch")?.value || "").trim().toLowerCase();
    const sort = $("currencySort")?.value || "code";

    let rows = [...allCurrencies].filter(row =>
      row.code.toLowerCase().includes(search) ||
      row.name.toLowerCase().includes(search)
    );

    rows.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "value-high") return b.valuePLN - a.valuePLN;
      if (sort === "value-low") return a.valuePLN - b.valuePLN;
      return a.code.localeCompare(b.code);
    });

    const html = rows.map(row => {
      const converted = D.convert(1, row.code, currentCurrency);

      return `
        <tr>
          <td><strong>${row.code}</strong></td>
          <td>${row.name}</td>
          <td>${D.formatNumber(row.valuePLN, 5)} PLN</td>
          <td>${D.formatNumber(converted, 5)} ${currentCurrency}</td>
          <td>${D.formatDate(row.date)}</td>
          <td>${row.source}</td>
        </tr>`;
    });

    setHTML(
      "currencyRows",
      html.length ? html.join("") :
        '<tr><td colspan="6" class="loading-cell">No matching currency records.</td></tr>'
    );

    setText("currencyCount", `${rows.length} records`);
    setText("currencySourceDate", `NBP reference date: ${D.formatDate(D.state.rateDate)}`);
    renderOverviewRates();
  }

  async function refreshCurrencies(force = false) {
    try {
      await D.loadCurrencies(force);
      allCurrencies = D.getCurrencyRows();
      renderCurrencyTable();

      const usd = D.state.ratesPLN.USD;
      const eur = D.state.ratesPLN.EUR;

      setText(
        "overviewUSD",
        Number.isFinite(usd)
          ? D.formatNumber(D.convert(1, "USD", currentCurrency), 4) + " " + currentCurrency
          : "Unavailable"
      );

      setText(
        "overviewEUR",
        Number.isFinite(eur)
          ? D.formatNumber(D.convert(1, "EUR", currentCurrency), 4) + " " + currentCurrency
          : "Unavailable"
      );
    } catch (error) {
      console.error("Currencies:", error);
      setText("currencyRows", "Currency data could not be loaded.");
      setText("overviewUSD", "Unavailable");
      setText("overviewEUR", "Unavailable");
      setText("currencySourceDate", "NBP service unavailable");
    }
  }

  async function refreshAll(force = false) {
    showStatus("Refreshing public data…");

    await Promise.allSettled([
      refreshCurrencies(force),
      refreshGold(force),
      refreshBitcoin(force)
    ]);

    const now = new Date();
    setText("currentDate", now.toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric"
    }));

    showStatus(`Last checked: ${now.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit"
    })}`);
  }

  function renderIndicator(value) {
    if (!value || !Number.isFinite(value.value)) {
      return { value: "Unavailable", year: "No published observation" };
    }

    return {
      value: `${value.value.toFixed(2)}%`,
      year: `Observation year: ${value.year}`
    };
  }

  async function loadCountryDossier(name, iso3) {
    setText("countryName", name);
    setText("countryISO", iso3 || "Unavailable");
    setText("countryIntro", "Retrieving the latest available World Bank indicators…");

    ["countryGDP", "countryInflation", "countryUnemployment"].forEach(id =>
      setText(id, "Loading…")
    );

    if (!iso3) {
      setText("countryIntro", "An ISO-3 code could not be matched to this territory.");
      ["countryGDP", "countryInflation", "countryUnemployment"].forEach(id =>
        setText(id, "Unavailable")
      );
      return;
    }

    try {
      const economy = await D.loadEconomy(iso3);
      const gdp = renderIndicator(economy.gdp);
      const inflation = renderIndicator(economy.inflation);
      const unemployment = renderIndicator(economy.unemployment);

      setText("countryGDP", gdp.value);
      setText("countryGDPYear", gdp.year);
      setText("countryInflation", inflation.value);
      setText("countryInflationYear", inflation.year);
      setText("countryUnemployment", unemployment.value);
      setText("countryUnemploymentYear", unemployment.year);
      setText("countryIntro", "Latest available annual observations from the World Bank.");
    } catch (error) {
      console.error(error);
      setText("countryIntro", "The economic record could not be retrieved.");
    }
  }

  async function loadEconomy(country = currentEconomyCountry) {
    currentEconomyCountry = country;
    setText("economyCountryStatus", "Loading annual World Bank indicators…");

    try {
      const [data, history] = await Promise.all([
        D.loadEconomy(country),
        D.loadEconomyHistory(country)
      ]);

      const gdp = renderIndicator(data.gdp);
      const inflation = renderIndicator(data.inflation);
      const unemployment = renderIndicator(data.unemployment);

      setText("economyGDP", gdp.value);
      setText("economyGDPYear", gdp.year);
      setText("economyInflation", inflation.value);
      setText("economyInflationYear", inflation.year);
      setText("economyUnemployment", unemployment.value);
      setText("economyUnemploymentYear", unemployment.year);

      const hasAny = Object.values(history).some(series => series.length);

      if (hasAny) {
        const allYears = [...new Set(
          Object.values(history).flat().map(item => item.year)
        )].sort((a, b) => a - b);

        const datasets = [
          { key: "gdp", label: "GDP growth", color: "#c4a36a" },
          { key: "inflation", label: "Inflation", color: "#a96c57" },
          { key: "unemployment", label: "Unemployment", color: "#91a18b" }
        ].map(item => ({
          label: item.label,
          data: allYears.map(year =>
            history[item.key].find(point => point.year === year)?.value ?? null
          ),
          borderColor: item.color,
          tension: 0.25,
          pointRadius: 1,
          spanGaps: true
        }));

        createOrUpdateChart("economyChart", {
          type: "line",
          data: { labels: allYears, datasets },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: { color: "#c5b99f", usePointStyle: true }
              }
            },
            scales: {
              x: {
                grid: { color: "rgba(200,180,140,.07)" },
                ticks: { color: "#938a79" }
              },
              y: {
                grid: { color: "rgba(200,180,140,.07)" },
                ticks: { color: "#938a79", callback: value => `${value}%` }
              }
            }
          }
        });
      } else {
        setText("economyCountryStatus", "No historical series are currently available.");
      }

      setText(
        "economyCountryStatus",
        `World Bank observations loaded for ${country}. Annual data; publication dates vary by indicator.`
      );
    } catch (error) {
      console.error(error);
      setText("economyCountryStatus", "Economic records could not be loaded.");
      ["economyGDP", "economyInflation", "economyUnemployment"].forEach(id =>
        setText(id, "Unavailable")
      );
    }
  }

  function readNumber(id) {
    const element = $(id);
    const value = Number(element?.value);

    if (!element || element.value.trim() === "" || !Number.isFinite(value)) {
      throw new Error("Please enter valid numbers in all fields.");
    }

    return value;
  }

  function writeCalculatorError(id, error) {
    setText(id, error.message || "Calculation could not be completed.");
  }

  function calculateCurrency() {
    try {
      const amount = readNumber("convertAmount");
      const from = $("convertFrom").value;
      const to = $("convertTo").value;

      if (amount < 0) throw new Error("Amount cannot be negative.");

      const result = D.convert(amount, from, to);
      setText("convertResult", `${D.formatNumber(result, 4)} ${to}`);
    } catch (error) {
      writeCalculatorError("convertResult", error);
    }
  }

  function calculateCompound() {
    try {
      const principal = readNumber("compoundPrincipal");
      const rate = readNumber("compoundRate") / 100;
      const years = readNumber("compoundYears");
      const frequency = readNumber("compoundFrequency");

      if (principal < 0 || years < 0 || frequency <= 0 || rate <= -1) {
        throw new Error("Check the entered values.");
      }

      const total = principal * Math.pow(1 + rate / frequency, frequency * years);
      const interest = total - principal;

      setText(
        "compoundResult",
        `Final value: ${D.formatMoney(total, currentCurrency)} · Interest: ${D.formatMoney(interest, currentCurrency)}`
      );
    } catch (error) {
      writeCalculatorError("compoundResult", error);
    }
  }

  function calculateSimple() {
    try {
      const principal = readNumber("simplePrincipal");
      const rate = readNumber("simpleRate") / 100;
      const years = readNumber("simpleYears");

      if (principal < 0 || years < 0 || rate < -1) {
        throw new Error("Check the entered values.");
      }

      const interest = principal * rate * years;
      const total = principal + interest;

      setText(
        "simpleResult",
        `Final value: ${D.formatMoney(total, currentCurrency)} · Interest: ${D.formatMoney(interest, currentCurrency)}`
      );
    } catch (error) {
      writeCalculatorError("simpleResult", error);
    }
  }

  function calculateInflation() {
    try {
      const amount = readNumber("inflationAmount");
      const rate = readNumber("inflationRate") / 100;
      const years = readNumber("inflationYears");

      if (amount < 0 || years < 0 || rate <= -1) {
        throw new Error("Check the entered values.");
      }

      const futureCost = amount * Math.pow(1 + rate, years);
      const purchasingPower = amount / Math.pow(1 + rate, years);

      setText(
        "inflationResult",
        `Equivalent future cost: ${D.formatMoney(futureCost, currentCurrency)} · Future purchasing power: ${D.formatMoney(purchasingPower, currentCurrency)}`
      );
    } catch (error) {
      writeCalculatorError("inflationResult", error);
    }
  }

  async function loadHistoricalArchive() {
    const type = $("historyType").value;
    const period = Number($("historyPeriod").value);
    const currency = $("historyCurrency").value;

    setText("historyChartTitle", "Loading historical record…");
    setHTML("historyRows", '<tr><td colspan="4" class="loading-cell">Retrieving records…</td></tr>');

    try {
      let rows = [];
      let source = "";

      if (type === "bitcoin") {
        const points = await D.loadBitcoinHistory(period, currency.toLowerCase(), true);
        rows = points.map(point => ({
          date: point.date,
          value: point.price,
          unit: currency
        }));
        source = "COINGECKO";
        setText("historyChartTitle", `Bitcoin historical price · ${currency}`);
      }

      if (type === "gold") {
        const response = await fetch(
          `https://api.nbp.pl/api/cenyzlota/last/${Math.min(period, 30)}?format=json`
        );
        if (!response.ok) throw new Error("Gold history service unavailable.");

        const gold = await response.json();
        rows = gold.map(item => ({
          date: new Date(`${item.data}T00:00:00`),
          value: D.toDisplayCurrency(Number(item.cena), currency),
          unit: `${currency} / gram`
        }));
        source = "NBP";
        setText("historyChartTitle", `Gold reference history · ${currency}`);
      }

      if (type === "currency") {
        const code = currency === "PLN" ? "USD" : currency;
        const response = await fetch(
          `https://api.nbp.pl/api/exchangerates/rates/A/${code}/last/${Math.min(period, 90)}?format=json`
        );

        if (!response.ok) throw new Error("Currency history service unavailable.");

        const result = await response.json();
        rows = result.rates.map(item => ({
          date: new Date(`${item.effectiveDate}T00:00:00`),
          value: Number(item.mid),
          unit: `PLN / ${code}`
        }));
        source = "NBP";
        setText("historyChartTitle", `${code} exchange rate history`);
      }

      const validRows = rows.filter(row => Number.isFinite(row.value));
      setText("historySource", source);

      setHTML(
        "historyRows",
        validRows.length
          ? validRows.slice().reverse().map(row => `
              <tr>
                <td>${D.formatDate(row.date)}</td>
                <td>${D.formatNumber(row.value, 5)}</td>
                <td>${row.unit}</td>
                <td>${source}</td>
              </tr>`).join("")
          : '<tr><td colspan="4" class="loading-cell">No historical observations were returned.</td></tr>'
      );

      const labels = validRows.map(row => D.formatDate(row.date));
      const values = validRows.map(row => row.value);

      createOrUpdateChart("historyChart", lineChartConfig(
        labels,
        [{
          label: type.toUpperCase(),
          data: values,
          borderColor: "#c7a86c",
          backgroundColor: "rgba(199,168,108,.12)",
          fill: true,
          tension: 0.25,
          pointRadius: 1
        }],
        validRows[0]?.unit || ""
      ));
    } catch (error) {
      console.error(error);
      setText("historyChartTitle", "Historical data unavailable");
      setHTML(
        "historyRows",
        `<tr><td colspan="4" class="loading-cell">${error.message}</td></tr>`
      );
    }
  }

  function setActivePeriod(days) {
    document.querySelectorAll("[data-btc-period]").forEach(button => {
      button.classList.toggle(
        "active",
        Number(button.dataset.btcPeriod) === Number(days)
      );
    });
  }

  function bindEvents() {
    $("displayCurrency")?.addEventListener("change", async event => {
      currentCurrency = event.target.value;
      await refreshAll(false);
      calculateCurrency();
      setText("goldCurrencyLabel", currentCurrency);
    });

    $("currencySearch")?.addEventListener("input", renderCurrencyTable);
    $("currencySort")?.addEventListener("change", renderCurrencyTable);

    $("refreshData")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "REFRESHING…";

      D.clearCache();
      await refreshAll(true);

      button.disabled = false;
      button.textContent = "↻ REFRESH DATA";
    });

    document.querySelectorAll("[data-btc-period]").forEach(button => {
      button.addEventListener("click", async () => {
        const days = Number(button.dataset.btcPeriod);
        setActivePeriod(days);
        await refreshBitcoinHistory(days);
      });
    });

    $("economyCountry")?.addEventListener("change", event => {
      loadEconomy(event.target.value);
    });

    $("convertButton")?.addEventListener("click", calculateCurrency);
    $("compoundButton")?.addEventListener("click", calculateCompound);
    $("simpleButton")?.addEventListener("click", calculateSimple);
    $("inflationButton")?.addEventListener("click", calculateInflation);
    $("loadHistory")?.addEventListener("click", loadHistoricalArchive);

    $("historyType")?.addEventListener("change", () => {
      const isCurrency = $("historyType").value === "currency";
      $("historyCurrencyWrap").style.display = isCurrency ? "" : "";
    });

    window.addEventListener("archive:country", event => {
      loadCountryDossier(event.detail.name, event.detail.iso3);
    });

    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", () => {
        document.querySelectorAll(".nav-link").forEach(item =>
          item.classList.remove("active")
        );
        link.classList.add("active");
      });
    });

    const navSections = document.querySelectorAll("main section[id]");
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const matching = document.querySelector(
            `.nav-link[href="#${entry.target.id}"]`
          );
          if (!matching) return;

          document.querySelectorAll(".nav-link").forEach(item =>
            item.classList.remove("active")
          );
          matching.classList.add("active");
        });
      }, { rootMargin: "-25% 0px -65% 0px" });

      navSections.forEach(section => observer.observe(section));
    }
  }

  async function initialise() {
    bindEvents();

    setText("currentDate", new Date().toLocaleDateString("en-GB", {
      day: "2-digit", month: "long", year: "numeric"
    }));

    await refreshAll(false);
    await loadEconomy(currentEconomyCountry);
    calculateCurrency();

    // Initialise the archive with an actual provider response.
    await loadHistoricalArchive();
  }

  document.addEventListener("DOMContentLoaded", initialise);
})();
