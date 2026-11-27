# The Monetary Archive

A financial and economic statistics archive with a Southern Gothic visual identity.

## Project structure

The project is intentionally built with three files:

- `index.html` — page structure, layout and styling.
- `script.js` — navigation, calculations, charts and data requests.
- `README.md` — documentation.

No Node.js installation or build process is required.

## Features

- Six main sections: Home, Statistics, Inflation, Calculator, Markets and Archive.
- Responsive desktop and mobile layout.
- Inflation and purchasing-power calculator.
- Historical CPI charts.
- Currency reference rates from the National Bank of Poland.
- Gold reference prices from the National Bank of Poland.
- Annual economic indicators from the World Bank.
- Historical data tables.
- CSV export.
- Automatic data refresh.
- Source status and error handling.

## Data sources

### National Bank of Poland

API:
https://api.nbp.pl/

Used for:
- Currency exchange rates.
- Gold prices in PLN per gram.

The API provides official reference observations, not tick-by-tick market prices.

### World Bank

API:
https://data.worldbank.org/

Used indicators:

- FP.CPI.TOTL.ZG — Inflation, consumer prices (annual %).
- NY.GDP.MKTP.KD.ZG — GDP growth (annual %).

The World Bank publishes annual observations. Recent years may not be available immediately.

### Federal Reserve / FRED

FRED is listed as a future integration.

A secure server-side proxy and an API key are required for a reliable protected integration. Never publish a private API key inside `script.js`.

## Deployment on GitHub Pages

1. Open the repository on GitHub.
2. Open Settings.
3. Select Pages.
4. Under Build and deployment, choose Deploy from a branch.
5. Select the `main` branch.
6. Select `/ (root)` as the folder.
7. Save.
8. Wait for GitHub Pages to publish the website.

Make sure that `index.html` and `script.js` are in the repository root.

## Troubleshooting

### The website opens, but the data does not load

Check:
- Whether the repository is public or Pages access is configured correctly.
- Whether the browser can access the NBP and World Bank APIs.
- Whether the browser console reports a network or CORS error.
- Whether the external provider is temporarily unavailable.

### The website looks unstyled

Check that the complete `index.html` was copied and saved.

### The calculator does not work

Check that:
- `script.js` is in the same folder as `index.html`.
- The script filename is exactly `script.js`.
- The browser console does not show a JavaScript error.

## Important limitations

GitHub Pages is static hosting.

It does not run private server-side code. It cannot securely store API keys or provide a protected backend.

Some financial data sources require a separate serverless function or backend proxy.

The website must distinguish:
- Official reference rates.
- Annual historical statistics.
- Live market prices.
- Estimated calculator results.

Unavailable data must never be replaced with invented values.

## Project principle

Accuracy before decoration.

Every displayed economic figure should have a source, a date and a clear definition.
