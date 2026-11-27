
(() => {
  "use strict";

  let instance = null;
  let observer = null;

  async function create(container, onSelect) {
    if (typeof window.Globe !== "function") {
      throw new Error("The Globe.gl library did not load. Check your internet connection.");
    }

    const response = await fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    );

    if (!response.ok) {
      throw new Error(`Country map could not load: HTTP ${response.status}`);
    }

    const world = await response.json();

    if (!window.topojson || !world.objects?.countries) {
      throw new Error("The country-boundary data is unavailable.");
    }

    const countries = window.topojson.feature(
      world,
      world.objects.countries
    ).features;

    destroy();

    instance = window.Globe()(container)
      .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-night.jpg")
      .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
      .backgroundColor("#101722")
      .showAtmosphere(true)
      .atmosphereColor("#75694e")
      .atmosphereAltitude(0.14)
      .polygonsData(countries)
      .polygonCapColor(() => "rgba(165,139,89,0.20)")
      .polygonSideColor(() => "rgba(100,84,55,0.20)")
      .polygonStrokeColor(() => "rgba(190,166,119,0.7)")
      .polygonAltitude(0.008)
      .polygonLabel(feature =>
        `<span>${String(feature.properties?.name || "Country")}</span>`
      )
      .onPolygonClick(feature => {
        const name = feature.properties?.name || "Unknown country";
        if (typeof onSelect === "function") onSelect(name);
      });

    const controls = instance.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableDamping = true;

    instance.pointOfView({ lat: 20, lng: 0, altitude: 2.1 }, 0);

    observer = new ResizeObserver(() => {
      if (!instance) return;
      instance.width(container.clientWidth);
      instance.height(container.clientHeight);
    });
    observer.observe(container);

    return instance;
  }

  function destroy() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (instance) {
      try { instance._destructor(); } catch {}
      instance = null;
    }
  }

  window.ArchiveGlobe = { create, destroy };
})();
