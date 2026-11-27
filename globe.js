
"use strict";

window.ArchiveGlobe = (() => {
  const instances = new Map();

  const WORLD_DATA =
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

  async function create(containerId, options = {}) {
    const container = document.getElementById(containerId);

    if (!container) return null;
    if (typeof Globe !== "function" || !window.topojson) {
      container.innerHTML =
        '<div class="loading-text">Globe libraries could not be loaded.</div>';
      return null;
    }

    if (instances.has(containerId)) {
      return instances.get(containerId);
    }

    container.innerHTML = "";

    try {
      const response = await fetch(WORLD_DATA);

      if (!response.ok) {
        throw new Error("Geographical data unavailable.");
      }

      const topology = await response.json();
      const countries = topojson.feature(
        topology,
        topology.objects.countries
      ).features;

      const globe = Globe()(container)
        .width(container.clientWidth)
        .height(container.clientHeight)
        .backgroundColor("#10110f")
        .showAtmosphere(true)
        .atmosphereColor("#8b7955")
        .atmosphereAltitude(0.13)
        .globeImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-night.jpg"
        )
        .bumpImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-topology.png"
        )
        .polygonsData(countries)
        .polygonCapColor(() => "rgba(91, 83, 61, 0.18)")
        .polygonSideColor(() => "rgba(30, 30, 25, 0.65)")
        .polygonStrokeColor(() => "rgba(183, 159, 111, 0.45)")
        .polygonAltitude(feature =>
          feature === selectedCountry ? 0.025 : 0.006
        )
        .polygonLabel(feature => {
          const name = feature.properties?.name || "Unknown country";
          return `<div style="background:#181916;color:#e4dfd1;padding:9px 12px;border:1px solid #a89568;font-family:serif">${name}</div>`;
        })
        .onPolygonClick(feature => {
          selectedCountry = feature;
          globe
            .polygonAltitude(item =>
              item === selectedCountry ? 0.025 : 0.006
            );

          if (typeof options.onCountryClick === "function") {
            options.onCountryClick(feature);
          }
        })
        .onPolygonHover(feature => {
          globe.polygonCapColor(item =>
            item === feature
              ? "rgba(168, 149, 104, 0.65)"
              : "rgba(91, 83, 61, 0.18)"
          );

          container.style.cursor = feature ? "pointer" : "grab";
        });

      let selectedCountry = null;

      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.35;
      globe.controls().enableDamping = true;
      globe.controls().dampingFactor = 0.08;
      globe.controls().minDistance = 130;
      globe.controls().maxDistance = 450;

      instances.set(containerId, globe);

      const resize = () => {
        if (!container.isConnected) return;

        globe
          .width(container.clientWidth)
          .height(container.clientHeight);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(container);

      if (options.onReady) options.onReady(globe);

      return globe;
    } catch (error) {
      console.error("Globe error:", error);
      container.innerHTML =
        '<div class="loading-text">Unable to load the globe. Check your internet connection and reload the page.</div>';
      return null;
    }
  }

  function get(containerId) {
    return instances.get(containerId) || null;
  }

  function reset(containerId) {
    const globe = get(containerId);
    if (!globe) return;

    globe.pointOfView({
      lat: 20,
      lng: 0,
      altitude: 2.2
    }, 900);
  }

  function zoom(containerId, direction) {
    const globe = get(containerId);
    if (!globe) return;

    const current = globe.pointOfView();
    const altitude = Math.max(
      0.8,
      Math.min(4, current.altitude - direction * 0.3)
    );

    globe.pointOfView({
      ...current,
      altitude
    }, 400);
  }

  return {
    create,
    get,
    reset,
    zoom
  };
})();
