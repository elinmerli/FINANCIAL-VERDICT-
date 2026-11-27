
# THE MONETARY ARCHIVE

International financial and economic information archive.

## Files

- index.html — website structure and separate sections
- styles.css — visual design and responsive layout
- data.js — public data sources and calculations
- globe.js — interactive 3D globe
- script.js — navigation, charts, tables and calculators

## Installation

1. Create a repository on GitHub.
2. Upload all five files into the same repository folder.
3. Make sure the file names are exactly:
   - index.html
   - styles.css
   - data.js
   - globe.js
   - script.js
4. Open repository Settings.
5. Find Pages.
6. Select Deploy from a branch.
7. Select the main branch and root folder.
8. Save and wait for GitHub Pages to publish the website.

## Data sources

- National Bank of Poland: currency reference rates and gold prices.
- CoinGecko: Bitcoin market data and historical prices.
- World Bank Open Data: GDP growth, inflation, unemployment and population.
- Natural Earth: country boundary geometry for the globe.

## Important data notes

- NBP exchange rates are reference rates, not live trading quotes.
- NBP gold prices are published reference prices, not guaranteed market execution prices.
- CoinGecko data availability and update frequency depend on its public API.
- World Bank indicators may have different latest observation years.
- Missing observations are displayed as unavailable rather than fabricated.

## Requirements

A modern browser and an internet connection are required.
The site uses public APIs and third-party libraries loaded from CDNs.
No personal API key is configured in this version.
