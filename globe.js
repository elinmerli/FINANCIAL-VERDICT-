
(() => {
  "use strict";

  const countryCodes = {
    "United States of America": "USA",
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
    "Iceland": "ISL",
    "Singapore": "SGP",
    "Indonesia": "IDN",
    "Thailand": "THA",
    "Egypt": "EGY",
    "Nigeria": "NGA",
    "Kenya": "KEN",
    "Chile": "CHL",
    "Colombia": "COL",
    "Peru": "PER",
    "Saudi Arabia": "SAU",
    "United Arab Emirates": "ARE",
    "Pakistan": "PAK",
    "Bangladesh": "BGD",
    "Vietnam": "VNM",
    "Malaysia": "MYS",
    "Romania": "ROU",
    "Czechia": "CZE",
    "Hungary": "HUN",
    "Bulgaria": "BGR",
    "Croatia": "HRV"
  };

  let globeInstance = null;
  let resizeObserver = null;

  async function create(container, onCountryClick) {
    if (typeof window.Globe !== "function") {
      throw new Error("Globe.gl library did not load");
    }

    if (!window.topojson) {
      throw new Error("TopoJSON library did not load");
    }

    const response = await fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    );

    if (!response.ok) {
      throw new Error(`World map request failed: ${response.status}`);
    }

    const world = await response.json();
    const features = window.topojson.feature(
      world,
      world.objects.countries
    ).features;

    if (globeInstance) {
      globeInstance._destructor?.();
      globeInstance = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    globeInstance = window.Globe()(container)
      .globeImageUrl(
        "https://unpkg.com/three-globe/example/img/earth-night.jpg"
      )
      .bumpImageUrl(
        "https://unpkg.com/three-globe/example/img/earth-topology.png"
      )
      .backgroundColor("#101722")
      .showAtmosphere(true)
      .atmosphereColor("#75694e")
      .atmosphereAltitude(0.13)
      .polygonsData(features)
      .polygonCapColor(() => "rgba(165,139,89,0.22)")
      .polygonSideColor(() => "rgba(90,78,56,0.18)")
      .polygonStrokeColor(() => "rgba(190,166,119,0.65)")
      .polygonAltitude(0.008)
      .polygonLabel(feature =>
        `<b>${String(feature.properties?.name || "Country")}</b>`
      )
      .onPolygonClick(feature => {
        const name = feature.properties?.name || "Unknown country";
        const code = countryCodes[name] || null;

        if (typeof onCountryClick === "function") {
          onCountryClick({ name, code, feature });
        }
      });

    const controls = globeInstance.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;

    globeInstance.pointOfView({
      lat: 20,
      lng: 0,
      altitude: 2.2
    }, 0);

    resizeObserver = new ResizeObserver(() => {
      if (!globeInstance) return;
      globeInstance
        .width(container.clientWidth)
        .height(container.clientHeight);
    });

    resizeObserver.observe(container);

    return globeInstance;
  }

  function destroy() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (globeInstance) {
      globeInstance._destructor?.();
      globeInstance = null;
    }
  }

  window.ArchiveGlobe = {
    create,
    destroy,
    get instance() {
      return globeInstance;
    }
  };
})();
