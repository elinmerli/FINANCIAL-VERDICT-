/* THE MONETARY ARCHIVE — APPLICATION */
(() => {
  "use strict";

  const D = window.ArchiveData;
  if (!D) {
    document.body.innerHTML =
      "<main style='padding:40px;color:#eee;background:#111'>Ошибка: data.js не подключён. Проверь порядок подключения файлов.</main>";
    return;
  }

  const currencyNames = {
    USD:"US Dollar", EUR:"Euro", GBP:"Pound Sterling", CHF:"Swiss Franc",
    JPY:"Japanese Yen", PLN:"Polish Zloty", CAD:"Canadian Dollar",
    AUD:"Australian Dollar", CNY:"Chinese Yuan", INR:"Indian Rupee",
    BRL:"Brazilian Real", SEK:"Swedish Krona", NOK:"Norwegian Krone",
    DKK:"Danish Krone", CZK:"Czech Koruna", HUF:"Hungarian Forint"
  };

  const pages = [
    ["overview","Overview"],
    ["globe","Global Globe"],
    ["currencies","Currencies"],
    ["markets","Markets & Bitcoin"],
    ["economy","Inflation & Economy"],
    ["calculators","Calculators"],
    ["archive","Historical Archive"],
    ["exchanges","Exchanges"]
  ];

  const app = document.createElement("div");
  app.id = "monetary-archive-app";
  document.body.innerHTML = "";
  document.body.appendChild(app);

  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
    :root{--bg:#101110;--panel:#191a17;--panel2:#20211d;--line:#39372d;--gold:#a58b59;--cream:#e8e0cf;--muted:#9c978a;--green:#87977a;--red:#a36d67}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--cream);font-family:'DM Sans',sans-serif}
    button,input,select{font:inherit}
    button{cursor:pointer}
    #ma-shell{min-height:100vh;display:grid;grid-template-columns:245px minmax(0,1fr)}
    #ma-sidebar{background:#141512;border-right:1px solid var(--line);padding:28px 17px;min-height:100vh}
    .ma-brand{font:600 27px 'Cormorant Garamond',serif;letter-spacing:1px;color:var(--cream);line-height:1.05;margin:0 10px 8px}
    .ma-subbrand{font-size:9px;letter-spacing:3px;color:var(--gold);margin:0 10px 35px;text-transform:uppercase}
    .ma-nav{display:grid;gap:7px}
    .ma-nav button{background:transparent;border:1px solid transparent;color:#aaa395;text-align:left;padding:13px 12px;border-radius:3px;font-size:12px;letter-spacing:.5px}
    .ma-nav button:hover,.ma-nav button.active{background:#24231e;border-color:#514735;color:#e5d4b0}
    .ma-side-note{margin:35px 10px;color:#777366;font-size:10px;line-height:1.8}
    #ma-main{min-width:0;padding:27px clamp(18px,3vw,48px) 55px}
    .ma-top{display:flex;justify-content:space-between;align-items:center;gap:15px;border-bottom:1px solid var(--line);padding-bottom:19px;margin-bottom:28px;flex-wrap:wrap}
    .ma-kicker{font-size:9px;letter-spacing:3px;color:var(--gold);text-transform:uppercase}
    .ma-date{font-size:11px;color:var(--muted)}
    .ma-currency{background:#1b1c18;color:var(--cream);border:1px solid var(--line);padding:9px 12px}
    .ma-page-title{font:500 clamp(31px,4vw,47px) 'Cormorant Garamond',serif;margin:0 0 7px}
    .ma-description{color:var(--muted);font-size:12px;margin:0 0 25px;line-height:1.7}
    .ma-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:20px 0}
    .ma-card{background:linear-gradient(145deg,#20211d,#181916);border:1px solid var(--line);padding:18px;min-width:0}
    .ma-card-label{color:var(--muted);font-size:9px;letter-spacing:1.8px;text-transform:uppercase}
    .ma-value{font:500 clamp(21px,2.4vw,30px) 'Cormorant Garamond',serif;margin:12px 0 5px;overflow-wrap:anywhere}
    .ma-meta{font-size:10px;color:var(--muted);line-height:1.6}
    .ma-positive{color:var(--green)}.ma-negative{color:var(--red)}
    .ma-section{border:1px solid var(--line);background:#171815;margin:17px 0;padding:19px;min-width:0}
    .ma-section h2{font:500 24px 'Cormorant Garamond',serif;margin:0 0 15px}
    .ma-table-wrap{overflow:auto}
    .ma-table{border-collapse:collapse;width:100%;font-size:11px;min-width:480px}
    .ma-table th{text-align:left;color:var(--gold);font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:500}
    .ma-table th,.ma-table td{padding:12px 10px;border-bottom:1px solid #34342d}
    .ma-table td{color:#d5cebf}.ma-table tr:last-child td{border-bottom:0}
    .ma-status{padding:12px 14px;background:#28231d;border:1px solid #5b4b34;color:#c9b68f;font-size:11px;line-height:1.6;margin:15px 0}
    .ma-error{background:#2a201e;border-color:#62413b;color:#d4aaa2}
    .ma-chart{height:270px;position:relative}
    .ma-chart canvas{width:100%!important;height:100%!important}
    #ma-globe{height:min(67vh,610px);min-height:370px;background:#101722;border:1px solid var(--line)}
    .ma-controls{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .ma-controls input,.ma-controls select,.ma-controls button,.ma-field{background:#20211d;border:1px solid var(--line);color:var(--cream);padding:10px 12px}
    .ma-controls button{color:#d7c49c}
    .ma-field{width:100%;margin:7px 0 15px}
    .ma-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .ma-result{font:500 25px 'Cormorant Garamond',serif;color:#d7c49c;margin-top:12px}
    .ma-muted{font-size:10px;color:var(--muted);line-height:1.7}
    .ma-footer{border-top:1px solid var(--line);padding-top:15px;margin-top:35px;color:#777366;font-size:9px;line-height:1.8}
    @media(max-width:900px){#ma-shell{grid-template-columns:190px minmax(0,1fr)}.ma-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:620px){#ma-shell{display:block}#ma-sidebar{min-height:0;padding:18px;border-right:0;border-bottom:1px solid var(--line)}.ma-brand{font-size:23px;margin-bottom:4px}.ma-subbrand{margin-bottom:15px}.ma-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.ma-side-note{display:none}#ma-main{padding:20px 14px}.ma-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ma-form-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  app.innerHTML = `
    <div id="ma-shell">
      <aside id="ma-sidebar">
        <h1 class="ma-brand">The Monetary<br>Archive</h1>
        <div class="ma-subbrand">International financial record</div>
        <nav class="ma-nav" id="ma-nav"></nav>
        <div class="ma-side-note">A GLOBAL RECORD OF<br>MARKETS, CURRENCIES<br>AND ECONOMIC HISTORY</div>
      </aside>
      <main id="ma-main">
        <header class="ma-top">
          <div><div class="ma-kicker">The international financial archive</div><div class="ma-date" id="ma-updated">Connecting to data sources…</div></div>
          <select class="ma-currency" id="ma-currency" aria-label="Display currency">
            ${D.supported.map(c=>`<option value="${c}" ${c==="USD"?"selected":""}>${c}</option>`).join("")}
          </select>
        </header>
        <div id="ma-content"></div>
        <footer class="ma-footer">DATA IS PROVIDED FOR INFORMATIONAL PURPOSES. MARKET DATA MAY BE DELAYED. ECONOMIC INDICATORS ARE PUBLISHED WITH THEIR ORIGINAL OBSERVATION DATES. UNAVAILABLE DATA IS NOT ESTIMATED OR FABRICATED.</footer>
      </main>
    </div>`;

  const nav = document.getElementById("ma-nav");
  const content = document.getElementById("ma-content");
  const currencySelect = document.getElementById("ma-currency");
  let currentPage = "overview";
  let displayCurrency = "USD";
  let charts = [];
  let activeCountry = null;

  const money = (value, currency = displayCurrency) => {
    if (!Number.isFinite(Number(value))) return "Unavailable";
    try {
      return new Intl.NumberFormat("en-US", {
        style:"currency",currency,maximumFractionDigits:2
      }).format(value);
    } catch {
      return `${Number(value).toFixed(2)} ${currency}`;
    }
  };

  const number = value => Number.isFinite(Number(value))
    ? new Intl.NumberFormat("en-US",{maximumFractionDigits:2}).format(value)
    : "Unavailable";

  const dateText = value => value
    ? new Date(value).toLocaleString()
    : "Date unavailable";

  const converted = (amount, from, to = displayCurrency) =>
    from === to ? Number(amount) : D.convert(Number(amount), from, to);

  const setStatus = (message, error = false) => {
    const el = document.getElementById("ma-updated");
    if (el) el.textContent = message;
  };

  function showPage(page) {
    currentPage = page;
    [...nav.querySelectorAll("button")].forEach(button =>
      button.classList.toggle("active", button.dataset.page === page)
    );
    charts.forEach(chart => { try { chart.destroy(); } catch {} });
    charts = [];

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

    (renderers[page] || renderOverview)();
  }

  pages.forEach(([id,label]) => {
    const button = document.createElement("button");
    button.textContent = label;
    button.dataset.page = id;
    button.addEventListener("click", () => showPage(id));
    nav.appendChild(button);
  });

  function heading(title, description) {
    return `<h1 class="ma-page-title">${title}</h1><p class="ma-description">${description}</p>`;
  }

  function card(label,value,meta="") {
    return `<article class="ma-card"><div class="ma-card-label">${label}</div><div class="ma-value">${value}</div><div class="ma-meta">${meta}</div></article>`;
  }

  function section(title,body) {
    return `<section class="ma-section"><h2>${title}</h2>${body}</section>`;
  }

  function table(headers, rows) {
    return `<div class="ma-table-wrap"><table class="ma-table"><thead><tr>${headers.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x ?? "Unavailable"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function chart(canvasId, labels, values, label, color = "#a58b59") {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !window.Chart || !values.length) return;

    const instance = new Chart(canvas, {
      type:"line",
      data:{
        labels,
        datasets:[{
          label,
          data:values,
          borderColor:color,
          backgroundColor:"rgba(165,139,89,.10)",
          fill:true,
          tension:.25,
          pointRadius:1.5,
          borderWidth:2
        }]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        plugins:{legend:{labels:{color:"#c9c1b2"}}},
        scales:{
          x:{ticks:{color:"#928c7e",maxTicksLimit:8},grid:{color:"#302f29"}},
          y:{ticks:{color:"#928c7e"},grid:{color:"#302f29"}}
        }
      }
    });
    charts.push(instance);
  }

  function renderOverview() {
    const s = D.state;
    const btc = s.bitcoin;
    const goldUSD = s.gold ? converted(s.gold.plnPerGram,"PLN","USD") : null;
    const btcPrice = btc ? converted(btc.priceUSD,"USD") : null;
    const goldPrice = s.gold ? converted(s.gold.plnPerGram,"PLN") : null;

    content.innerHTML = heading("Global Financial Overview","A consolidated view of currency markets, precious metals and the international economy.") +
      `<div class="ma-grid">
        ${card("Bitcoin",btcPrice===null?"Unavailable":money(btcPrice),btc?`24h: ${number(btc.change24h)}% · CoinPaprika`:"Source unavailable")}
        ${card("Gold · per gram",goldPrice===null?"Unavailable":money(goldPrice),s.gold?`NBP · ${s.gold.date}`:"Source unavailable")}
        ${card("USD / EUR",s.rates.USD?number(s.rates.USD):"Unavailable",`Frankfurter · ${s.rateDate||"Date unavailable"}`)}
        ${card("Gold · USD / gram",goldUSD===null?"Unavailable":money(goldUSD,"USD"),"Calculated from NBP gold and FX data")}
      </div>` +
      section("Bitcoin Market",`
        <div class="ma-grid">
          ${card("24-hour change",btc?`${number(btc.change24h)}%`:"Unavailable",btc?"CoinPaprika":"Source unavailable")}
          ${card("Market capitalization",btc?money(converted(btc.marketCapUSD,"USD")):"Unavailable","Converted from USD")}
          ${card("24-hour volume",btc?money(converted(btc.volumeUSD,"USD")):"Unavailable","Converted from USD")}
          ${card("Last source update",btc?dateText(btc.updated):"Unavailable","CoinPaprika")}
        </div>`) +
      section("Bitcoin · Historical Price",`<div class="ma-chart"><canvas id="ma-overview-chart"></canvas></div>`) +
      section("Economic Indicators · United States",`<div id="ma-overview-economy" class="ma-muted">Loading World Bank indicators…</div>`) +
      `<div id="ma-overview-errors"></div>`;

    if (s.bitcoinHistory.length) {
      chart("ma-overview-chart",
        s.bitcoinHistory.map(x=>new Date(x.date).toLocaleDateString()),
        s.bitcoinHistory.map(x=>converted(x.price,"USD")),
        `Bitcoin (${displayCurrency})`
      );
    }

    D.loadEconomy("USA").then(data => {
      if (currentPage !== "overview") return;
      const labels = {
        inflation:"Inflation",
        gdp:"GDP growth",
        unemployment:"Unemployment",
        gdpPerCapita:"GDP per capita"
      };
      const rows = Object.entries(labels).map(([key,label]) => {
        const item = data[key];
        const value = item ? `${number(item.value)}${key==="gdpPerCapita"?" USD":"%"}` : "Unavailable";
        return [label,value,item?.year||"—",item?.source||"World Bank"];
      });
      const target = document.getElementById("ma-overview-economy");
      if (target) target.innerHTML = table(["Indicator","Value","Year","Source"],rows);
    }).catch(() => {
      const target = document.getElementById("ma-overview-economy");
      if (target) target.textContent = "World Bank data is temporarily unavailable.";
    });

    showErrors();
  }

  function showErrors() {
    const target = document.getElementById("ma-overview-errors");
    if (!target) return;
    const errors = Object.entries(D.state.errors);
    if (!errors.length) {
      target.innerHTML = `<div class="ma-status">Data sources responded. Values are shown with their source dates.</div>`;
      return;
    }
    target.innerHTML = `<div class="ma-status ma-error"><strong>Some sources are unavailable:</strong><br>${errors.map(([k,v])=>`${k}: ${v}`).join("<br>")}</div>`;
  }

  function renderCurrencies() {
    const rates = D.state.rates;
    const rows = Object.entries(rates)
      .filter(([code])=>D.supported.includes(code))
      .sort(([a],[b])=>a.localeCompare(b))
      .map(([code,rate])=>[
        `<strong>${code}</strong>`,
        currencyNames[code]||code,
        number(rate),
        `1 ${"EUR"} = ${number(rate)} ${code}`,
        D.state.rateDate||"Unavailable"
      ]);

    content.innerHTML = heading("Currencies","Reference exchange rates from the European Central Bank via Frankfurter. Rates are updated on working days, not tick-by-tick.") +
      `<div class="ma-controls"><input id="ma-currency-search" placeholder="Search currency code or name"></div>`+
      section("Reference Rates",table(["Code","Currency","Rate","EUR reference","Date"],rows)+`<p class="ma-muted">Base currency: EUR. These are reference rates, not executable bank or exchange quotes.</p>`) +
      section("Currency Converter",`
        <div class="ma-form-grid">
          <label>Amount<input class="ma-field" id="ma-convert-amount" type="number" min="0" value="100"></label>
          <label>From<select class="ma-field" id="ma-convert-from">${D.supported.map(c=>`<option>${c}</option>`).join("")}</select></label>
          <label>To<select class="ma-field" id="ma-convert-to">${D.supported.map(c=>`<option ${c===displayCurrency?"selected":""}>${c}</option>`).join("")}</select></label>
        </div>
        <button id="ma-convert-button">Convert</button><div class="ma-result" id="ma-convert-result">—</div>
      `);

    document.getElementById("ma-currency-search").addEventListener("input",e=>{
      const q=e.target.value.toLowerCase();
      document.querySelectorAll(".ma-table tbody tr").forEach(row=>{
        row.hidden=!row.textContent.toLowerCase().includes(q);
      });
    });

    document.getElementById("ma-convert-button").addEventListener("click",()=>{
      const amount=Number(document.getElementById("ma-convert-amount").value);
      const from=document.getElementById("ma-convert-from").value;
      const to=document.getElementById("ma-convert-to").value;
      const result=D.convert(amount,from,to);
      document.getElementById("ma-convert-result").textContent=
        result===null?"Rate unavailable":money(result,to);
    });
  }

  function renderMarkets() {
    const btc=D.state.bitcoin;
    const price=btc?converted(btc.priceUSD,"USD"):null;
    const gold=D.state.gold?converted(D.state.gold.plnPerGram,"PLN"):null;

    content.innerHTML=heading("Markets & Bitcoin","Cryptocurrency market data and precious metals. Exchange names are not represented as live stock quotes.")+
      `<div class="ma-grid">
        ${card("Bitcoin price",price===null?"Unavailable":money(price),btc?"CoinPaprika":"Source unavailable")}
        ${card("24h change",btc?`${number(btc.change24h)}%`:"Unavailable",btc?"24-hour percentage":"Source unavailable")}
        ${card("Market capitalization",btc?money(converted(btc.marketCapUSD,"USD")):"Unavailable","CoinPaprika")}
        ${card("24h trading volume",btc?money(converted(btc.volumeUSD,"USD")):"Unavailable","CoinPaprika")}
      </div>`+
      section("Bitcoin Price History",`<div class="ma-chart"><canvas id="ma-market-chart"></canvas></div><p class="ma-muted">Daily historical observations. History availability depends on the public provider's free-tier limits.</p>`)+
      section("Gold",`
        ${card("Gold per gram",gold===null?"Unavailable":money(gold),D.state.gold?`NBP · ${D.state.gold.date}`:"Source unavailable")}
        <p class="ma-muted">The NBP publishes the reference price in PLN per gram. The displayed value is converted using the loaded FX reference rates.</p>
      `)+
      section("Market venues",table(["Venue","Market","Data status"],[
        ["Nasdaq","Stock exchange","No live quote feed connected"],
        ["London Stock Exchange","Stock exchange","No live quote feed connected"],
        ["Tokyo Stock Exchange","Stock exchange","No live quote feed connected"],
        ["Binance","Crypto exchange","No live exchange feed connected"],
        ["Coinbase","Crypto exchange","No live exchange feed connected"],
        ["Kraken","Crypto exchange","No live exchange feed connected"]
      ]));

    if(D.state.bitcoinHistory.length) chart("ma-market-chart",
      D.state.bitcoinHistory.map(x=>new Date(x.date).toLocaleDateString()),
      D.state.bitcoinHistory.map(x=>converted(x.price,"USD")),
      `BTC / ${displayCurrency}`
    );
  }

  async function renderEconomy() {
    content.innerHTML=heading("Inflation & Economy","Country-level macroeconomic indicators from the World Bank. Each figure retains its observation year.")+
      `<div class="ma-controls"><select id="ma-country">
        <option value="USA">United States</option><option value="POL">Poland</option>
        <option value="GBR">United Kingdom</option><option value="DEU">Germany</option>
        <option value="FRA">France</option><option value="JPN">Japan</option>
        <option value="CHN">China</option><option value="IND">India</option>
        <option value="BRA">Brazil</option><option value="CAN">Canada</option>
        <option value="AUS">Australia</option><option value="CHE">Switzerland</option>
      </select><button id="ma-economy-load">Load indicators</button></div>
      <div id="ma-economy-results" class="ma-status">Select a country to load its latest available indicators.</div>`;

    const load=async()=>{
      const country=document.getElementById("ma-country").value;
      const target=document.getElementById("ma-economy-results");
      target.textContent="Loading World Bank data…";
      try{
        const data=await D.loadEconomy(country);
        const names={inflation:"Inflation",gdp:"GDP growth",unemployment:"Unemployment",gdpPerCapita:"GDP per capita"};
        const rows=Object.entries(names).map(([key,label])=>{
          const x=data[key];
          return [label,x?number(x.value)+(key==="gdpPerCapita"?" USD":"%"):"Unavailable",x?.year||"—","World Bank"];
        });
        target.className="ma-section";
        target.innerHTML=table(["Indicator","Value","Observation year","Source"],rows);
      }catch(error){target.textContent="The World Bank service is unavailable. "+error.message;}
    };
    document.getElementById("ma-economy-load").addEventListener("click",load);
    await load();
  }

  function renderCalculators() {
    content.innerHTML=heading("Financial Calculators","Calculations are performed locally in your browser. They do not execute transactions or provide financial recommendations.")+
      section("Currency Converter",`
        <label>Amount<input class="ma-field" id="calc-fx-amount" type="number" min="0" value="100"></label>
        <div class="ma-form-grid">
          <label>From<select class="ma-field" id="calc-fx-from">${D.supported.map(c=>`<option>${c}</option>`).join("")}</select></label>
          <label>To<select class="ma-field" id="calc-fx-to">${D.supported.map(c=>`<option ${c===displayCurrency?"selected":""}>${c}</option>`).join("")}</select></label>
        </div>
        <button id="calc-fx-run">Calculate</button><div id="calc-fx-result" class="ma-result">—</div>
      `)+
      section("Compound Interest",`
        <div class="ma-form-grid">
          <label>Initial amount<input class="ma-field" id="ci-principal" type="number" value="1000" min="0"></label>
          <label>Annual rate (%)<input class="ma-field" id="ci-rate" type="number" value="5" min="0" step=".1"></label>
          <label>Years<input class="ma-field" id="ci-years" type="number" value="10" min="0" step=".5"></label>
          <label>Compounds per year<input class="ma-field" id="ci-frequency" type="number" value="12" min="1"></label>
        </div>
        <button id="ci-run">Calculate</button><div id="ci-result" class="ma-result">—</div>
      `)+
      section("Inflation Calculator",`
        <label>Starting amount<input class="ma-field" id="inf-amount" type="number" value="1000" min="0"></label>
        <label>Annual inflation (%)<input class="ma-field" id="inf-rate" type="number" value="3" step=".1"></label>
        <label>Number of years<input class="ma-field" id="inf-years" type="number" value="10" min="0"></label>
        <button id="inf-run">Calculate</button><div id="inf-result" class="ma-result">—</div>
      `)+
      section("Simple Interest",`
        <div class="ma-form-grid">
          <label>Principal<input class="ma-field" id="si-principal" type="number" value="1000"></label>
          <label>Annual rate (%)<input class="ma-field" id="si-rate" type="number" value="5"></label>
          <label>Years<input class="ma-field" id="si-years" type="number" value="3"></label>
        </div>
        <button id="si-run">Calculate</button><div id="si-result" class="ma-result">—</div>
      `);

    document.getElementById("calc-fx-run").onclick=()=>{
      const amount=Number(document.getElementById("calc-fx-amount").value);
      const from=document.getElementById("calc-fx-from").value;
      const to=document.getElementById("calc-fx-to").value;
      const result=D.convert(amount,from,to);
      document.getElementById("calc-fx-result").textContent=result===null?"Rate unavailable":money(result,to);
    };
    document.getElementById("ci-run").onclick=()=>{
      const p=Number(document.getElementById("ci-principal").value);
      const r=Number(document.getElementById("ci-rate").value)/100;
      const t=Number(document.getElementById("ci-years").value);
      const n=Number(document.getElementById("ci-frequency").value);
      const valid=[p,r,t,n].every(Number.isFinite)&&p>=0&&r>=0&&t>=0&&n>0;
      const result=valid?p*Math.pow(1+r/n,n*t):NaN;
      document.getElementById("ci-result").textContent=Number.isFinite(result)?money(result):"Check the entered values";
    };
    document.getElementById("inf-run").onclick=()=>{
      const p=Number(document.getElementById("inf-amount").value);
      const r=Number(document.getElementById("inf-rate").value)/100;
      const t=Number(document.getElementById("inf-years").value);
      const result=p*Math.pow(1+r,t);
      document.getElementById("inf-result").textContent=Number.isFinite(result)&&p>=0&&t>=0?money(result):"Check the entered values";
    };
    document.getElementById("si-run").onclick=()=>{
      const p=Number(document.getElementById("si-principal").value);
      const r=Number(document.getElementById("si-rate").value)/100;
      const t=Number(document.getElementById("si-years").value);
      const result=p*(1+r*t);
      document.getElementById("si-result").textContent=Number.isFinite(result)&&p>=0&&r>=0&&t>=0?money(result):"Check the entered values";
    };
  }

  function renderArchive() {
    content.innerHTML=heading("Historical Archive","Available historical observations from public data providers.")+
      section("Bitcoin · Daily history",`<div class="ma-chart"><canvas id="ma-archive-chart"></canvas></div>`)+
      section("Gold · NBP daily reference",`<div id="ma-gold-history" class="ma-status">Loading gold history…</div>`);
    if(D.state.bitcoinHistory.length) chart("ma-archive-chart",
      D.state.bitcoinHistory.map(x=>new Date(x.date).toLocaleDateString()),
      D.state.bitcoinHistory.map(x=>converted(x.price,"USD")),
      `BTC / ${displayCurrency}`
    );
    D.loadGoldHistory().then(rows=>{
      const target=document.getElementById("ma-gold-history");
      if(!target)return;
      target.className="ma-section";
      target.innerHTML=table(["Date","Gold · PLN / gram","Gold · "+displayCurrency+"/gram","Source"],
        rows.slice().reverse().map(x=>[x.date,number(x.pricePLN),money(converted(x.pricePLN,"PLN")), "NBP"]));
    }).catch(error=>{
      const target=document.getElementById("ma-gold-history");
      if(target)target.textContent="Gold history unavailable: "+error.message;
    });
  }

  function renderExchanges() {
    content.innerHTML=heading("Exchanges","A reference directory of major stock and cryptocurrency exchanges. No live trading prices are claimed here.")+
      section("Stock Exchanges",table(["Exchange","Location","Market","Live quote feed"],[
        ["Nasdaq","New York, USA","Equities","Not connected"],
        ["New York Stock Exchange","New York, USA","Equities","Not connected"],
        ["London Stock Exchange","London, UK","Equities","Not connected"],
        ["Tokyo Stock Exchange","Tokyo, Japan","Equities","Not connected"],
        ["Euronext","Amsterdam / Europe","Equities","Not connected"],
        ["Hong Kong Stock Exchange","Hong Kong","Equities","Not connected"],
        ["SIX Swiss Exchange","Zurich, Switzerland","Equities","Not connected"]
      ]))+
      section("Cryptocurrency Exchanges",table(["Exchange","Market","Live quote feed"],[
        ["Binance","Digital assets","Not connected"],
        ["Coinbase","Digital assets","Not connected"],
        ["Kraken","Digital assets","Not connected"],
        ["Bitstamp","Digital assets","Not connected"],
        ["OKX","Digital assets","Not connected"]
      ]));
  }

  async function renderGlobe() {
    content.innerHTML=heading("Global Globe","Explore countries on the globe. Select a country to request its latest available World Bank indicators.")+
      `<div id="ma-globe"></div><div id="ma-country-profile" class="ma-status">Select a country on the globe to view its profile.</div>`;
    const target=document.getElementById("ma-globe");

    if(typeof window.Globe!=="function"||!window.topojson){
      target.innerHTML="<div class='ma-status ma-error'>The globe library did not load. Check the Globe.gl and TopoJSON script links in index.html.</div>";
      return;
    }

    try{
      const response=await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
      if(!response.ok)throw new Error("World map data could not be loaded");
      const world=await response.json();
      const countries=topojson.feature(world,world.objects.countries).features;

      const globe=Globe()(target)
        .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-night.jpg")
        .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
        .backgroundColor("#101722")
        .showAtmosphere(true)
        .atmosphereColor("#75694e")
        .atmosphereAltitude(.13)
        .polygonsData(countries)
        .polygonCapColor(()=> "rgba(165,139,89,0.22)")
        .polygonSideColor(()=> "rgba(90,78,56,0.18)")
        .polygonStrokeColor(()=> "rgba(190,166,119,0.65)")
        .polygonAltitude(.008)
        .polygonLabel(d=>`<b>${d.properties.name||"Country"}</b>`)
        .onPolygonClick(async feature=>{
          const name=feature.properties.name||"Country";
          activeCountry=name;
          const panel=document.getElementById("ma-country-profile");
          panel.className="ma-status";
          panel.textContent=`Loading available economic indicators for ${name}…`;

          const countryMap={
            "United States of America":"USA","Poland":"POL","United Kingdom":"GBR",
            "Germany":"DEU","France":"FRA","Japan":"JPN","China":"CHN",
            "India":"IND","Brazil":"BRA","Canada":"CAN","Australia":"AUS",
            "Switzerland":"CHE","Spain":"ESP","Italy":"ITA","Netherlands":"NLD",
            "Sweden":"SWE","Norway":"NOR","Denmark":"DNK","South Korea":"KOR",
            "Mexico":"MEX","South Africa":"ZAF","Turkey":"TUR","Ukraine":"UKR"
          };
          const code=countryMap[name];
          if(!code){
            panel.textContent=`${name}: country name identified, but an ISO code mapping is not configured for this country yet. No figures have been invented.`;
            return;
          }
          try{
            const data=await D.loadEconomy(code);
            if(!panel.isConnected||activeCountry!==name)return;
            const labels={inflation:"Inflation",gdp:"GDP growth",unemployment:"Unemployment",gdpPerCapita:"GDP per capita"};
            panel.className="ma-section";
            panel.innerHTML=`<h2>${name}</h2>`+table(["Indicator","Latest value","Year","Source"],
              Object.entries(labels).map(([key,label])=>{
                const item=data[key];
                return [label,item?number(item.value)+(key==="gdpPerCapita"?" USD":"%"):"Unavailable",item?.year||"—","World Bank"];
              }));
          }catch(error){panel.textContent=`${name}: data unavailable. ${error.message}`;}
        });

      globe.controls().autoRotate=true;
      globe.controls().autoRotateSpeed=.35;
      globe.controls().enableDamping=true;
      globe.pointOfView({lat:20,lng:0,altitude:2.2},0);

      if(window.ResizeObserver){
        new ResizeObserver(()=>globe.width(target.clientWidth).height(target.clientHeight)).observe(target);
      }
    }catch(error){
      target.innerHTML=`<div class="ma-status ma-error">Globe loading failed: ${error.message}</div>`;
    }
  }

  currencySelect.addEventListener("change",async()=>{
    displayCurrency=currencySelect.value;
    showPage(currentPage);
  });

  async function start() {
    setStatus("Connecting to financial data providers…");
    const result=await D.refresh();
    const errors=Object.keys(result.errors);
    setStatus(
      errors.length
        ? `Some data sources unavailable · ${new Date().toLocaleString()}`
        : `Data refreshed · ${new Date().toLocaleString()}`
    );
    showPage("overview");
  }

  start().catch(error=>{
    setStatus("Data loading error: "+error.message);
    content.innerHTML=`<div class="ma-status ma-error">The application could not start: ${error.message}</div>`;
  });

  window.addEventListener("online",()=>start());
})();
