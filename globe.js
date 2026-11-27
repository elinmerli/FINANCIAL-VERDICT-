/* ==========================================================
   THE MONETARY ARCHIVE — INTERACTIVE 3D GLOBE
   Globe.gl + world-atlas + ISO country mapping
========================================================== */

(() => {
  "use strict";

  let globe = null;
  let countryFeatures = [];
  let selectedFeature = null;
  let resizeObserver = null;

  const container = document.getElementById("globeViz");

  function emitCountry(feature) {
    if (!feature) return;

    const properties = feature.properties || {};
    const iso3 = properties.iso3 || null;
    const name = properties.name || "Unknown country";

    window.dispatchEvent(new CustomEvent("archive:country", {
      detail: { name, iso3 }
    }));
  }

  function setSelected(feature) {
    selectedFeature = feature || null;

    if (globe) {
      globe.polygonsData(countryFeatures);
    }

    emitCountry(feature);
  }

  function polygonAltitude(feature) {
    return feature === selectedFeature ? 0.035 : 0.006;
  }

  function polygonColor(feature) {
    return feature === selectedFeature
      ? "rgba(224, 190, 112, 0.82)"
      : "rgba(180, 160, 118, 0.16)";
  }

  async function loadJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load map data (${response.status})`);
    return response.json();
  }

  async function initialiseGlobe() {
    if (!container) return;

    if (typeof Globe !== "function" || typeof topojson === "undefined") {
      container.innerHTML =
        '<div class="globe-loading">The globe libraries could not be loaded. Check your internet connection and reload the page.</div>';
      return;
    }

    try {
      const [topology, countryList] = await Promise.all([
        loadJSON("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"),
        loadJSON("https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json")
      ]);

      const countryMap = new Map();

      countryList.forEach(country => {
        if (country.ccn3 && country.cca3) {
          countryMap.set(String(country.ccn3).padStart(3, "0"), country.cca3);
        }
      });

      const collection = topojson.feature(
        topology,
        topology.objects.countries
      );

      countryFeatures = collection.features.map(feature => {
        const numericId = String(feature.id).padStart(3, "0");
        const matchingCountry = countryList.find(
          item => String(item.ccn3 || "").padStart(3, "0") === numericId
        );

        feature.properties = {
          ...(feature.properties || {}),
          iso3: countryMap.get(numericId) || null,
          name: matchingCountry?.name?.common ||
                feature.properties?.name ||
                "Unknown territory"
        };

        return feature;
      });

      container.innerHTML = "";

      globe = Globe()(container)
        .width(container.clientWidth)
        .height(container.clientHeight || 560)
        .backgroundColor("#10100f")
        .showAtmosphere(true)
        .atmosphereColor("#b79a5b")
        .atmosphereAltitude(0.13)
        .globeImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-night.jpg"
        )
        .bumpImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-topology.png"
        )
        .polygonsData(countryFeatures)
        .polygonCapColor(polygonColor)
        .polygonSideColor(() => "rgba(30, 27, 21, 0.8)")
        .polygonStrokeColor(() => "rgba(204, 177, 119, 0.45)")
        .polygonAltitude(polygonAltitude)
        .polygonLabel(feature => {
          const name = feature.properties?.name || "Unknown";
          return `<div class="globe-tooltip">${name}</div>`;
        })
        .onPolygonHover(feature => {
          if (globe) {
            globe.polygonCapColor(item => {
              if (item === selectedFeature) {
                return "rgba(224, 190, 112, 0.82)";
              }
              return item === feature
                ? "rgba(224, 190, 112, 0.48)"
                : "rgba(180, 160, 118, 0.16)";
            });
          }
        })
        .onPolygonClick(feature => {
          setSelected(feature);
        });

      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.28;
      globe.controls().enableDamping = true;
      globe.controls().dampingFactor = 0.08;
      globe.pointOfView({ lat: 18, lng: 8, altitude: 2.25 }, 1200);

      const zoomIn = document.getElementById("globeZoomIn");
      const zoomOut = document.getElementById("globeZoomOut");
      const reset = document.getElementById("globeReset");

      zoomIn?.addEventListener("click", () => {
        const view = globe.pointOfView();
        globe.pointOfView(
          { ...view, altitude: Math.max(0.8, view.altitude * 0.78) },
          350
        );
      });

      zoomOut?.addEventListener("click", () => {
        const view = globe.pointOfView();
        globe.pointOfView(
          { ...view, altitude: Math.min(5, view.altitude * 1.28) },
          350
        );
      });

      reset?.addEventListener("click", () => {
        setSelected(null);
        globe.pointOfView({ lat: 18, lng: 8, altitude: 2.25 }, 800);
      });

      resizeObserver = new ResizeObserver(() => {
        if (!globe || !container) return;
        globe.width(container.clientWidth);
        globe.height(container.clientHeight || 560);
      });

      resizeObserver.observe(container);

      window.dispatchEvent(new CustomEvent("archive:globe-ready"));
    } catch (error) {
      console.error("Globe initialisation failed:", error);
      container.innerHTML =
        '<div class="globe-loading">The geographical atlas could not be loaded. Please check your connection and refresh the page.</div>';
    }
  }

  document.addEventListener("DOMContentLoaded", initialiseGlobe);
})();
