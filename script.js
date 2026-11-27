"use strict";

/* =========================================================
   THE MONETARY ARCHIVE
   Front-end application
   Hosting: GitHub Pages
   Data: NBP API + World Bank API
   ========================================================= */

const CONFIG = {
  refreshInterval: 5 * 60 * 1000,
  requestTimeout: 15000,
  historyStartYear: 2000,
  historyEndYear: new Date().getFullYear() - 1
};

const SOURCES = {
  nbp: "https://api.nbp.pl/api",
  worldBank: "https://api.worldbank.org/v2"
};

const INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  gdp: "NY.GDP.MKTP.KD.ZG"
};

const state = {
  rates: [],
  gold: null,
  goldDate: null,
  rateDate: null,
  polandInflation: [],
  usaInflation: [],
  polandGdp: [],
  sourceStatus: {
    nbp: { status: "waiting", date: "—", detail: "Not checked" },
    worldBank: { status: "waiting", date: "—", detail: "Not checked" },
    fred: { status: "not-connected", date: "—", detail: "Requires a secure API connection" }
  },
  lastUpdated: null
};

const $ = (id) => document.getElementById(id);

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "—";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value));
}

function formatMoney(value, currency = "PLN") {
  if (!Number.isFinite(Number(value))) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value));
}

function formatPercent(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "—";
  return `${formatNumber(value, digits)}%`;
}

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function setStatus(source, status, date = "—", detail = "") {
  state.sourceStatus[source] = { status, date, detail };
  renderSourceTable();
}

function setLoading(id, message = "Loading…") {
  const element = $(id);
  if (element) element.textContent = message;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

async function fetchJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function initNavigation() {
  const links = document.querySelectorAll(".nav-link");
  const pages = document.querySelectorAll(".page");
  const sidebar = $("sidebar");
  const menuButton = $("menu-button");

  function showPage(pageName) {
    links.forEach((link) => {
      link.classList.toggle("active", link.dataset.page === pageName);
    });

    pages.forEach((page) => {
      page.classList.toggle("active", page.id === `page-${pageName}`);
    });

    sidebar?.classList.remove("open");

    if (pageName === "calculator") {
      calculateInflation();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  links.forEach((link) => {
    link.addEventListener("click", () => showPage(link.dataset.page));
  });

  menuButton?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });
}

/* =========================================================
   NBP DATA
   ========================================================= */

async function loadNBPData() {
  try {
    const [ratesResponse, goldResponse] = await Promise.all([
      fetchJSON(`${SOURCES.nbp}/exchangerates/tables/A/?format=json`),
      fetchJSON(`${SOURCES.nbp}/cenyzlota/last/1/?format=json`)
    ]);

    if (!Array.isArray(ratesResponse) || !ratesResponse[0]?.rates) {
      throw new Error("Unexpected NBP exchange-rate response");
    }

    if (!Array.isArray(goldResponse) || !goldResponse[0]?.cena) {
      throw new Error("Unexpected NBP gold response");
    }

    const table = ratesResponse[0];

    state.rates = table.rates;
    state.rateDate = table.effectiveDate;
    state.gold = Number(goldResponse[0].cena);
    state.goldDate = goldResponse[0].data;

    if (!Number.isFinite(state.gold)) {
      throw new Error("Invalid gold value");
    }

    setStatus("nbp", "online", state.rateDate, "Reference rates loaded");

    renderNBPData();
  } catch (error) {
    console.error("NBP data error:", error);

    setStatus(
      "nbp",
      "error",
      "—",
      error.name === "AbortError" ? "Request timed out" : error.message
    );

    showNBPUnavailable();
  }
}

function findRate(code) {
  const item = state.rates.find((rate) => rate.code === code);
  return item ? Number(item.mid) : null;
}

function showNBPUnavailable() {
  [
    "home-usd", "home-eur", "home-gold",
    "market-usd", "market-eur", "market-gold"
  ].forEach((id) => setText(id, "Unavailable"));

  setText("home-usd-note", "NBP source did not respond");
  setText("home-eur-note", "NBP source did not respond");
  setText("home-gold-note", "NBP source did not respond");
}

function renderNBPData() {
  const usd = findRate("USD");
  const eur = findRate("EUR");

  setText("home-usd", usd === null ? "—" : formatNumber(usd));
  setText("home-eur", eur === null ? "—" : formatNumber(eur));
  setText("home-gold", state.gold === null ? "—" : formatNumber(state.gold));

  setText("home-usd-note", `NBP · ${state.rateDate || "Date unavailable"}`);
  setText("home-eur-note", `NBP · ${state.rateDate || "Date unavailable"}`);
  setText("home-gold-note", `NBP · ${state.goldDate || "Date unavailable"}`);

  setText("market-usd", usd === null ? "—" : formatNumber(usd));
  setText("market-eur", eur === null ? "—" : formatNumber(eur));
  setText("market-gold", state.gold === null ? "—" : formatNumber(state.gold));

  setText("market-usd-date", `NBP reference · ${state.rateDate || "—"}`);
  setText("market-eur-date", `NBP reference · ${state.rateDate || "—"}`);
  setText("market-gold-date", `NBP fixing · ${state.goldDate || "—"}`);

  renderCurrencyTable();
  renderHomeMarketList();
}

function renderCurrencyTable() {
  const body = $("currency-table");
  if (!body) return;

  if (!state.rates.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-state">No currency data available.</td></tr>`;
    return;
  }

  const preferred = ["USD", "EUR", "GBP", "CHF", "JPY", "CAD", "AUD", "CZK", "SEK", "NOK"];

  const ordered = [...state.rates].sort((a, b) => {
    const ai = preferred.indexOf(a.code);
    const bi = preferred.indexOf(b.code);

    if (ai === -1 && bi === -1) return a.code.localeCompare(b.code);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  body.innerHTML = ordered.map((item) => `
    <tr>
      <td>${escapeHTML(item.currency)}</td>
      <td>${escapeHTML(item.code)}</td>
      <td class="numeric">${formatNumber(item.mid, 4)} PLN</td>
      <td>${escapeHTML(state.rateDate || "—")}</td>
    </tr>
  `).join("");
}

function renderHomeMarketList() {
  const container = $("home-market-list");
  if (!container) return;

  const usd = findRate("USD");
  const eur = findRate("EUR");

  const rows = [
    ["US dollar", "USD / PLN", usd],
    ["Euro", "EUR / PLN", eur],
    ["Gold", "PLN / gram", state.gold]
  ];

  container.innerHTML = rows.map(([name, detail, value]) => `
    <div class="market-row">
      <div>
        <div class="market-name">${name}</div>
        <div class="market-detail">${detail}</div>
      </div>
      <div class="market-price">${value === null ? "—" : formatNumber(value)}</div>
    </div>
  `).join("");
}

/* =========================================================
   WORLD BANK DATA
   ========================================================= */

async function loadWorldBankIndicator(country, indicator) {
  const start = CONFIG.historyStartYear;
  const end = CONFIG.historyEndYear;

  const url =
    `${SOURCES.worldBank}/country/${country}/indicator/${indicator}` +
    `?date=${start}:${end}&format=json&per_page=100`;

  const response = await fetchJSON(url);

  if (!Array.isArray(response) || !Array.isArray(response[1])) {
    throw new Error(`Unexpected World Bank response for ${country}`);
  }

  return response[1]
    .filter((item) => item.value !== null && item.date)
    .map((item) => ({
      year: Number(item.date),
      value: Number(item.value)
    }))
    .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.value))
    .sort((a, b) => a.year - b.year);
}

async function loadWorldBankData() {
  try {
    const results = await Promise.allSettled([
      loadWorldBankIndicator("POL", INDICATORS.inflation),
      loadWorldBankIndicator("USA", INDICATORS.inflation),
      loadWorldBankIndicator("POL", INDICATORS.gdp)
    ]);

    const [polandInflation, usaInflation, polandGdp] = results;

    if (polandInflation.status === "fulfilled") {
      state.polandInflation = polandInflation.value;
    } else {
      console.error("Poland CPI error:", polandInflation.reason);
    }

    if (usaInflation.status === "fulfilled") {
      state.usaInflation = usaInflation.value;
    } else {
      console.error("US CPI error:", usaInflation.reason);
    }

    if (polandGdp.status === "fulfilled") {
      state.polandGdp = polandGdp.value;
    } else {
      console.error("Poland GDP error:", polandGdp.reason);
    }

    const successful = results.filter((result) => result.status === "fulfilled").length;

    if (successful === 0) {
      throw new Error("No World Bank indicators could be loaded");
    }

    setStatus(
      "worldBank",
      successful === 3 ? "online" : "partial",
      String(CONFIG.historyEndYear),
      `${successful} of 3 indicator series loaded`
    );

    renderWorldBankData();
  } catch (error) {
    console.error("World Bank data error:", error);
    setStatus("worldBank", "error", "—", error.message);
    showWorldBankUnavailable();
  }
}

function latestObservation(series) {
  if (!Array.isArray(series) || !series.length) return null;
  return series[series.length - 1];
}

function showWorldBankUnavailable() {
  [
    "home-pl-cpi",
    "stat-pl-inflation",
    "stat-us-inflation",
    "stat-pl-gdp"
  ].forEach((id) => setText(id, "Unavailable"));
}

function renderWorldBankData() {
  const plLatest = latestObservation(state.polandInflation);
  const usLatest = latestObservation(state.usaInflation);
  const gdpLatest = latestObservation(state.polandGdp);

  setText("home-pl-cpi", plLatest ? formatPercent(plLatest.value) : "Unavailable");
  setText(
    "home-pl-cpi-note",
    plLatest ? `World Bank · ${plLatest.year}` : "No observation available"
  );

  setText("stat-pl-inflation", plLatest ? formatPercent(plLatest.value) : "Unavailable");
  setText("stat-pl-inflation-year", plLatest ? `Observation year: ${plLatest.year}` : "No observation available");

  setText("stat-us-inflation", usLatest ? formatPercent(usLatest.value) : "Unavailable");
  setText("stat-us-inflation-year", usLatest ? `Observation year: ${usLatest.year}` : "No observation available");

  setText("stat-pl-gdp", gdpLatest ? formatPercent(gdpLatest.value) : "Unavailable");
  setText("stat-pl-gdp-year", gdpLatest ? `Observation year: ${gdpLatest.year}` : "No observation available");

  drawLineChart("home-inflation-chart", state.polandInflation, "value");
  drawLineChart("statistics-pl-chart", state.polandInflation, "value");
  drawLineChart("statistics-us-chart", state.usaInflation, "value");
  drawLineChart("inflation-pl-chart", state.polandInflation, "value");
  drawLineChart("inflation-us-chart", state.usaInflation, "value");

  renderComparisonTable(plLatest, usLatest, gdpLatest);
  renderInflationHistory();
  renderArchive();
}

function renderComparisonTable(pl, us, gdp) {
  const body = $("comparison-table");
  if (!body) return;

  const rows = [
    ["Annual CPI inflation", pl ? formatPercent(pl.value) : "—", us ? formatPercent(us.value) : "—", "World Bank"],
    ["GDP growth", gdp ? formatPercent(gdp.value) : "—", "—", "World Bank"]
  ];

  body.innerHTML = rows.map((row) => `
    <tr>
      <td>${row[0]}</td>
      <td class="numeric">${row[1]}</td>
      <td class="numeric">${row[2]}</td>
      <td>${row[3]}</td>
    </tr>
  `).join("");
}

function renderInflationHistory() {
  const body = $("inflation-history-table");
  if (!body) return;

  const pl = new Map(state.polandInflation.map((item) => [item.year, item.value]));
  const us = new Map(state.usaInflation.map((item) => [item.year, item.value]));

  const years = [...new Set([...pl.keys(), ...us.keys()])].sort((a, b) => b - a);

  if (!years.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-state">Historical data is unavailable.</td></tr>`;
    return;
  }

  body.innerHTML = years.map((year) => `
    <tr>
      <td>${year}</td>
      <td class="numeric">${pl.has(year) ? formatPercent(pl.get(year)) : "—"}</td>
      <td class="numeric">${us.has(year) ? formatPercent(us.get(year)) : "—"}</td>
      <td>World Bank</td>
    </tr>
  `).join("");
}

function renderArchive() {
  const body = $("archive-table");
  if (!body) return;

  const pl = new Map(state.polandInflation.map((item) => [item.year, item.value]));
  const us = new Map(state.usaInflation.map((item) => [item.year, item.value]));

  const years = [...new Set([...pl.keys(), ...us.keys()])].sort((a, b) => b - a);

  setText("archive-pl-count", String(state.polandInflation.length));
  setText("archive-us-count", String(state.usaInflation.length));

  if (!years.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty-state">No archived observations available.</td></tr>`;
    return;
  }

  body.innerHTML = years.map((year) => `
    <tr>
      <td>${year}</td>
      <td class="numeric">${pl.has(year) ? formatPercent(pl.get(year)) : "—"}</td>
      <td class="numeric">${us.has(year) ? formatPercent(us.get(year)) : "—"}</td>
      <td>World Bank</td>
    </tr>
  `).join("");
}

/* =========================================================
   CHART DRAWING
   ========================================================= */

function drawLineChart(canvasId, data, valueKey = "value") {
  const canvas = $(canvasId);
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(280, Math.floor(rect.width));
  const height = Math.max(180, Math.floor(rect.height));

  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  if (!Array.isArray(data) || data.length < 2) {
    ctx.fillStyle = "#9b8b7b";
    ctx.font = "12px monospace";
    ctx.fillText("Not enough published observations", 12, height / 2);
    return;
  }

  const values = data.map((item) => Number(item[valueKey]));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const padding = { top: 18, right: 12, bottom: 30, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const range = max - min || 1;

  const x = (index) => padding.left + (index / (data.length - 1)) * chartWidth;
  const y = (value) => padding.top + ((max - value) / range) * chartHeight;

  ctx.strokeStyle = "rgba(191,151,111,.14)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#8e7e70";
  ctx.font = "9px monospace";

  for (let i = 0; i <= 4; i++) {
    const value = min + (range * i) / 4;
    const yPos = y(value);

    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();

    ctx.fillText(`${formatNumber(value, 1)}%`, 2, yPos + 3);
  }

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(142,57,56,.28)");
  gradient.addColorStop(1, "rgba(142,57,56,0)");

  ctx.beginPath();
  values.forEach((value, index) => {
    if (index === 0) ctx.moveTo(x(index), y(value));
    else ctx.lineTo(x(index), y(value));
  });
  ctx.lineTo(x(values.length - 1), height - padding.bottom);
  ctx.lineTo(x(0), height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  values.forEach((value, index) => {
    if (index === 0) ctx.moveTo(x(index), y(value));
    else ctx.lineTo(x(index), y(value));
  });

  ctx.strokeStyle = "#b65d52";
  ctx.lineWidth = 2;
  ctx.stroke();

  values.forEach((value, index) => {
    if (index % Math.max(1, Math.floor(values.length / 10)) !== 0 &&
        index !== values.length - 1) return;

    ctx.beginPath();
    ctx.arc(x(index), y(value), 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#d8bd96";
    ctx.fill();
  });

  const labelCount = Math.min(5, data.length);

  for (let i = 0; i < labelCount; i++) {
    const index = Math.round((i / Math.max(1, labelCount - 1)) * (data.length - 1));
    const label = String(data[index].year);
    ctx.fillStyle = "#9b8b7b";
    ctx.textAlign = "center";
    ctx.fillText(label, x(index), height - 8);
  }
}

/* =========================================================
   INFLATION CALCULATOR
   ========================================================= */

function calculateInflation() {
  const amount = Number($("calc-amount")?.value);
  const annualRate = Number($("calc-inflation")?.value);
  const years = Number($("calc-years")?.value);
  const currency = $("calc-currency")?.value || "PLN";

  if (
    !Number.isFinite(amount) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(years) ||
    amount < 0 ||
    annualRate <= -100 ||
    annualRate > 1000 ||
    years < 0 ||
    years > 200
  ) {
    setText("calc-result", "Check your values");
    return;
  }

  const factor = Math.pow(1 + annualRate / 100, years);
  const adjusted = amount / factor;
  const loss = amount - adjusted;
  const remaining = amount === 0 ? 0 : (adjusted / amount) * 100;
  const totalInflation = (factor - 1) * 100;

  setText("calc-result", formatMoney(adjusted, currency));
  setText("calc-original", formatMoney(amount, currency));
  setText("calc-loss", formatMoney(loss, currency));
  setText("calc-remaining", formatPercent(remaining));
  setText("calc-total-inflation", formatPercent(totalInflation));

  const points = [];

  for (let year = 0; year <= years; year++) {
    const value = amount === 0
      ? 0
      : (Math.pow(1 + annualRate / 100, year) ** -1) * 100;

    points.push({ year, value });
  }

  drawLineChart("calculator-chart", points, "value");
}

function initCalculator() {
  const form = $("calculator-form");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    calculateInflation();
  });

  ["calc-amount", "calc-inflation", "calc-years", "calc-currency"].forEach((id) => {
    $(id)?.addEventListener("input", calculateInflation);
    $(id)?.addEventListener("change", calculateInflation);
  });

  calculateInflation();
}

/* =========================================================
   SOURCE STATUS AND REFRESH
   ========================================================= */

function renderSourceTable() {
  const body = $("source-table");
  if (!body) return;

  const definitions = [
    ["National Bank of Poland", "Currency rates and gold", "nbp"],
    ["World Bank", "Annual macroeconomic indicators", "worldBank"],
    ["Federal Reserve / FRED", "U.S. policy rate", "fred"]
  ];

  body.innerHTML = definitions.map(([name, information, key]) => {
    const item = state.sourceStatus[key];

    let label = "Waiting";
    let css = "waiting";

    if (item.status === "online") {
      label = "Connected";
      css = "";
    } else if (item.status === "partial") {
      label = "Partially connected";
      css = "waiting";
    } else if (item.status === "error") {
      label = "Unavailable";
      css = "error";
    } else if (item.status === "not-connected") {
      label = "Not connected";
      css = "error";
    }

    return `
      <tr>
        <td>${name}</td>
        <td>${information}</td>
        <td><span class="status-dot ${css}"></span>${label}</td>
        <td>${escapeHTML(item.date)}${item.detail ? ` · ${escapeHTML(item.detail)}` : ""}</td>
      </tr>
    `;
  }).join("");
}

async function refreshAllData() {
  const button = $("refresh-button");

  if (button) {
    button.disabled = true;
    button.textContent = "Refreshing…";
  }

  await Promise.allSettled([
    loadNBPData(),
    loadWorldBankData()
  ]);

  state.lastUpdated = new Date();

  const formatted = state.lastUpdated.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });

  setText("last-updated", formatted);
  setText("header-date", state.lastUpdated.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }));

  if (button) {
    button.disabled = false;
    button.textContent = "Refresh data";
  }

  calculateInflation();
  renderSourceTable();
}

/* =========================================================
   CSV EXPORT
   ========================================================= */

function exportArchiveCSV() {
  const pl = new Map(state.polandInflation.map((item) => [item.year, item.value]));
  const us = new Map(state.usaInflation.map((item) => [item.year, item.value]));
  const years = [...new Set([...pl.keys(), ...us.keys()])].sort((a, b) => a - b);

  if (!years.length) {
    alert("There are no historical observations to export yet.");
    return;
  }

  const rows = [
    ["Year", "Poland CPI annual %", "United States CPI annual %", "Source"],
    ...years.map((year) => [
      year,
      pl.has(year) ? pl.get(year) : "",
      us.has(year) ? us.get(year) : "",
      "World Bank"
    ])
  ];

  const csv = rows.map((row) =>
    row.map((value) => {
      const text = String(value);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "monetary-archive-inflation-history.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/* =========================================================
   STARTUP
   ========================================================= */

function initApplication() {
  initNavigation();
  initCalculator();
  renderSourceTable();

  $("refresh-button")?.addEventListener("click", refreshAllData);
  $("export-csv")?.addEventListener("click", exportArchiveCSV);

  refreshAllData();

  window.setInterval(() => {
    refreshAllData();
  }, CONFIG.refreshInterval);

  let resizeTimer;

  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);

    resizeTimer = window.setTimeout(() => {
      drawLineChart("home-inflation-chart", state.polandInflation);
      drawLineChart("statistics-pl-chart", state.polandInflation);
      drawLineChart("statistics-us-chart", state.usaInflation);
      drawLineChart("inflation-pl-chart", state.polandInflation);
      drawLineChart("inflation-us-chart", state.usaInflation);
      calculateInflation();
    }, 180);
  });
}

document.addEventListener("DOMContentLoaded", initApplication);
