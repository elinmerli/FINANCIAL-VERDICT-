
# THE MONETARY ARCHIVE

International financial and economic information portal.

## Project files

- index.html — application entry point
- styles.css — visual design and responsive layout
- data.js — financial data providers and calculations
- script.js — shared formatting and interface helpers
- globe.js — interactive 3D Earth
- app.js — navigation, pages, charts and application logic

## Installation

1. Keep all seven files in the same folder.
2. Open the folder in Visual Studio Code.
3. Install the Live Server extension.
4. Right-click index.html.
5. Select Open with Live Server.
6. Wait for the financial data providers to respond.

Do not open index.html directly using file://.

## Data providers

- Frankfurter — currency reference rates
- Narodowy Bank Polski — gold prices
- CoinPaprika — Bitcoin market information
- World Bank — economic indicators
- World Atlas — country boundaries
- Globe.gl — interactive 3D globe
- Chart.js — financial charts

## Important notes

Public APIs may have temporary outages, rate limits or unavailable historical observations.

Reference exchange rates are not live trading quotes.

Stock exchange and cryptocurrency exchange names are currently directory entries, not connected live trading feeds.

Unavailable values are not replaced with fabricated data.

## Troubleshooting

If the page is blank:

1. Check that all filenames match exactly.
2. Check that all seven files are in the same folder.
3. Open the browser developer console with F12.
4. Check the Console and Network tabs.
5. Check whether external libraries and API requests loaded successfully.
