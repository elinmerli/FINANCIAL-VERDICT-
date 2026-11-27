# The Monetary Archive

A public-data financial dashboard.

## Files

- index.html — website structure
- styles.css — visual design
- data.js — public data sources and calculations
- globe.js — interactive 3D globe
- script.js — application behaviour

## Run locally

The site uses external APIs and CDN libraries. It should be opened through a local web server rather than directly as a file.

If Python is installed, open a terminal in this folder and run:

    python -m http.server 8000

Then open:

    http://localhost:8000

## Public data sources

- National Bank of Poland (NBP): exchange rates and gold reference prices
- CoinGecko: Bitcoin market data and historical prices
- World Bank: GDP growth, inflation and unemployment indicators
- world-atlas / world-countries: geographical boundaries and country codes

## Important

Some providers apply request limits. If a provider is temporarily unavailable,
the relevant panel will display an unavailable message.

NBP exchange rates and gold prices are reference data, not tick-by-tick market quotes.
World Bank indicators are annual statistics and may be published with a delay.
The stock-index section is deliberately marked as not connected rather than
displaying invented prices.
