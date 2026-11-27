/* THE MONETARY ARCHIVE — responsive 3D world atlas */

(() => {
  "use strict";

  const NUMERIC_ISO = {
    US: "840",
    GB: "826",
    JP: "392",
    DE: "276",
    FR: "250",
    CN: "156",
    IN: "356",
    CA: "124",
    AU: "036",
    CH: "756",
    BR: "076",
    PL: "616",
    KR: "410",
    SG: "702",
    MX: "484",
    ZA: "710",
    SE: "752",
    NO: "578",
    DK: "208",
    CZ: "203",
    HU: "348",
    TR: "792",
    ID: "360",
    TH: "764",
    NZ: "554",
    AR: "032",
    NG: "566",
    EG: "818",
    RU: "643",
    UA: "804"
  };

  let globe = null;
  let activeHost = null;
  let rotating = true;
  let resizeObserver = null;
  let countriesCache = null;

  const $ = id => document.getElementById(id);

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));

  /* LOAD EXTERNAL LIBRARIES */

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = src;
      script.async = true;

      script.onload = resolve;

      script.onerror = () => {
        reject(new Error(`Could not load ${src}`));
      };

      document.head.appendChild(script);
    });
  }

  async function ensureLibraries() {
    if (!window.topojson?.feature) {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"
      );
    }

    if (typeof window.Globe !== "function") {
      await loadScript(
        "https://cdn.jsdelivr.net/npm/globe.gl@2.41.12/dist/globe.gl.min.js"
      );
    }
  }

  /* LOAD COUNTRY BOUNDARIES */

  async function getCountries() {
    if (countriesCache) {
      return countriesCache;
    }

    const response = await fetch(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
      {
        cache: "force-cache"
      }
    );

    if (!response.ok) {
      throw new Error(
        `World atlas HTTP ${response.status}`
      );
    }

    const topology = await response.json();

    if (
      !window.topojson?.feature ||
      !topology?.objects?.countries
    ) {
      throw new Error(
        "Country boundary data is unavailable"
      );
    }

    countriesCache = window.topojson.feature(
      topology,
      topology.objects.countries
    ).features;

    return countriesCache;
  }

  /* INITIALIZE GLOBE */

  async function init(hostId = "overview-globe-container") {
    const host = $(hostId);

    if (!host) {
      return;
    }

    if (activeHost === host && globe) {
      resize();
      return;
    }

    if (globe?.pauseAnimation) {
      globe.pauseAnimation();
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
    }

    globe = null;
    activeHost = host;

    host.innerHTML = `
      <div class="globe-loading">
        Loading the world atlas…
      </div>
    `;

    try {
      await ensureLibraries();

      if (typeof window.Globe !== "function") {
        throw new Error(
          "3D globe library did not load"
        );
      }

      const features = await getCountries();

      if (!host.isConnected || activeHost !== host) {
        return;
      }

      const countries =
        window.ArchiveData?.countries || {};

      const byNumeric = Object.fromEntries(
        Object.entries(NUMERIC_ISO).map(
          ([code, numeric]) => [numeric, code]
        )
      );

      const prepared = features.map(feature => {
        const numeric = String(
          feature.id ?? ""
        ).padStart(3, "0");

        const code = byNumeric[numeric] || null;

        const profile = code
          ? countries[code]
          : null;

        feature.properties = feature.properties || {};

        feature.properties.archiveCode =
          profile ? code : null;

        feature.properties.archiveName =
          profile?.name ||
          feature.properties.name ||
          feature.properties.NAME ||
          `Country ${feature.id}`;

        return feature;
      });

      host.innerHTML = "";

      const width = Math.max(260, host.clientWidth);
      const height = Math.max(260, host.clientHeight);

      globe = window.Globe()(host)
        .width(width)
        .height(height)

        .backgroundColor("rgba(0,0,0,0)")

        .globeImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-night.jpg"
        )

        .bumpImageUrl(
          "https://unpkg.com/three-globe/example/img/earth-topology.png"
        )

        .showAtmosphere(true)

        .atmosphereColor("#a98550")

        .atmosphereAltitude(0.16)

        .polygonsData(prepared)

        .polygonAltitude(feature =>
          feature.properties.archiveCode
            ? 0.012
            : 0.003
        )

        .polygonCapColor(feature =>
          feature.properties.archiveCode
            ? "rgba(181,139,75,0.25)"
            : "rgba(68,84,99,0.08)"
        )

        .polygonSideColor(() =>
          "rgba(120,98,66,0.08)"
        )

        .polygonStrokeColor(feature =>
          feature.properties.archiveCode
            ? "#c5a16b"
            : "rgba(105,124,139,0.35)"
        )

        .polygonLabel(feature => `
          <div style="
            padding:8px 11px;
            background:#0b121b;
            border:1px solid #9a794b;
            color:#eee2ce;
            font:12px Arial
          ">
            ${escapeHTML(feature.properties.archiveName)}
            ${
              feature.properties.archiveCode
                ? " · Open dossier"
                : " · General map"
            }
          </div>
        `)

        .onPolygonClick(feature => {
          const code = feature.properties.archiveCode;

          if (code) {
            window.dispatchEvent(
              new CustomEvent(
                "archive:country-selected",
                {
                  detail: { code }
                }
              )
            );
          } else {
            window.dispatchEvent(
              new CustomEvent(
                "archive:country-unavailable",
                {
                  detail: {
                    name: feature.properties.archiveName
                  }
                }
              )
            );
          }
        });

      /* ROTATION AND MOUSE CONTROLS */

      const controls = globe.controls();

      controls.autoRotate = rotating;
      controls.autoRotateSpeed = 0.28;

      controls.enableDamping = true;
      controls.dampingFactor = 0.08;

      controls.minDistance = 130;
      controls.maxDistance = 420;

      /* ROTATION BUTTON */

      const button = $("globe-auto-rotate");

      if (button && !button.dataset.bound) {
        button.dataset.bound = "1";

        button.addEventListener("click", () => {
          rotating = !rotating;

          if (globe) {
            globe.controls().autoRotate = rotating;
          }

          button.textContent = rotating
            ? "PAUSE ROTATION"
            : "RESUME ROTATION";
        });
      }

      /* RESPONSIVE SIZE */

      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
      } else {
        window.addEventListener(
          "resize",
          resize,
          { passive: true }
        );
      }

    } catch (error) {
      if (activeHost === host) {
        host.innerHTML = `
          <div class="globe-loading">
            The 3D atlas is unavailable.
            <br>
            <small>${escapeHTML(error.message)}</small>
          </div>
        `;
      }

      console.error(
        "The Monetary Archive globe:",
        error
      );
    }
  }

  /* RESIZE */

  function resize() {
    if (!globe || !activeHost?.isConnected) {
      return;
    }

    const width = Math.max(
      260,
      activeHost.clientWidth
    );

    const height = Math.max(
      260,
      activeHost.clientHeight
    );

    globe.width(width).height(height);
  }

  /* PUBLIC INTERFACE */

  window.ArchiveGlobe = Object.freeze({
    init,
    resize
  });

  document.addEventListener(
    "DOMContentLoaded",
    () => init("overview-globe-container"),
    { once: true }
  );

  window.addEventListener(
    "archive:globe-page-open",
    () => init("globe-container")
  );

  window.addEventListener(
    "archive:overview-open",
    () => init("overview-globe-container")
  );

})();
