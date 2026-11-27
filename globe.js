
(() => {
  "use strict";

  let instances = [];
  let autoRotate = true;
  let initialized = false;
  let worldFeatures = [];

  const WORLD_URL = "https://unpkg.com/world-atlas@2/countries-110m.json";

  const ISO_TO_CODE = {
    "840":"US","826":"GB","392":"JP","616":"PL","276":"DE",
    "250":"FR","380":"IT","724":"ES","756":"CH","124":"CA",
    "036":"AU","156":"CN","356":"IN","076":"BR","752":"SE",
    "578":"NO","208":"DK","203":"CZ","348":"HU","643":"RU",
    "410":"KR","484":"MX","702":"SG","792":"TR","710":"ZA",
    "528":"NL","056":"BE","040":"AT","372":"IE","620":"PT"
  };

  function loadWorld() {
    return fetch(WORLD_URL).then(response => {
      if (!response.ok) throw new Error(`Map data HTTP ${response.status}`);
      return response.json();
    }).then(topology => {
      if (!window.topojson) throw new Error("TopoJSON library unavailable");
      const object = topology.objects.countries;
      return window.topojson.feature(topology, object).features;
    });
  }

  function countryCode(feature) {
    const id = String(feature.id).padStart(3, "0");
    return ISO_TO_CODE[id] || null;
  }

  function label(feature) {
    const name = feature.properties?.name || "Country";
    const code = countryCode(feature);
    return `<div style="background:#111318;border:1px solid #74694f;padding:8px 11px;color:#eee;font:12px Arial;max-width:210px">
      <strong>${escapeHTML(name)}</strong>
      <div style="color:#b4a584;font-size:10px;margin-top:3px">${code || "Economic profile unavailable"}</div>
    </div>`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);
  }

  function showUnavailable(container, error) {
    container.innerHTML = `<div style="height:100%;display:grid;place-items:center;padding:25px;text-align:center;color:#aaa">
      <div><div style="font:22px Georgia;color:#d4c8ad;margin-bottom:9px">Global Observatory</div>
      <div>3D globe could not be loaded.</div>
      <small style="display:block;margin-top:8px;color:#777">${escapeHTML(error.message || "External map service unavailable")}</small></div>
    </div>`;
  }

  function buildGlobe(container, features) {
    if (!window.Globe) throw new Error("Globe.gl library unavailable");

    container.innerHTML = "";
    const width = Math.max(300, container.clientWidth);
    const height = Math.max(260, container.clientHeight);

    const globe = window.Globe()(container)
      .width(width)
      .height(height)
      .backgroundColor("rgba(0,0,0,0)")
      .showAtmosphere(true)
      .atmosphereColor("#77899b")
      .atmosphereAltitude(0.13)
      .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-night.jpg")
      .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
      .polygonsData(features)
      .polygonAltitude(feature => feature.properties?.__selected ? 0.035 : 0.008)
      .polygonCapColor(() => "rgba(110,125,142,0.12)")
      .polygonSideColor(() => "rgba(115,130,148,0.12)")
      .polygonStrokeColor(() => "rgba(177,166,139,0.45)")
      .polygonLabel(label)
      .onPolygonClick(feature => {
        const code = countryCode(feature);
        const name = feature.properties?.name || "Selected country";
        if (!code) {
          window.dispatchEvent(new CustomEvent("archive:country-unavailable", {
            detail: { name }
          }));
          return;
        }
        window.dispatchEvent(new CustomEvent("archive:country-selected", {
          detail: { code, name }
        }));
      });

    const controls = globe.controls();
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.32;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 130;
    controls.maxDistance = 500;

    globe.pointOfView({ lat: 20, lng: 5, altitude: 2.25 }, 0);
    instances.push({ globe, container });
    return globe;
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    try {
      worldFeatures = await loadWorld();
      const overview = document.getElementById("overview-globe-container");
      const full = document.getElementById("globe-container");

      if (overview) buildGlobe(overview, worldFeatures);
      if (full) buildGlobe(full, worldFeatures);
      attachControls();
    } catch (error) {
      document.querySelectorAll(".globe-container").forEach(container => {
        showUnavailable(container, error);
      });
      console.error("Archive globe error:", error);
    }
  }

  function attachControls() {
    document.getElementById("globe-zoom-in")?.addEventListener("click", () => {
      instances.forEach(({ globe }) => {
        const pov = globe.pointOfView();
        globe.pointOfView({ ...pov, altitude: Math.max(0.7, pov.altitude * 0.78) }, 350);
      });
    });

    document.getElementById("globe-zoom-out")?.addEventListener("click", () => {
      instances.forEach(({ globe }) => {
        const pov = globe.pointOfView();
        globe.pointOfView({ ...pov, altitude: Math.min(5, pov.altitude * 1.25) }, 350);
      });
    });

    document.getElementById("globe-auto-rotate")?.addEventListener("click", event => {
      autoRotate = !autoRotate;
      instances.forEach(({ globe }) => {
        globe.controls().autoRotate = autoRotate;
      });
      event.currentTarget.textContent = `AUTO ROTATE: ${autoRotate ? "ON" : "OFF"}`;
    });

    window.addEventListener("resize", resize);
  }

  function resize() {
    instances.forEach(({ globe, container }) => {
      if (!container.isConnected) return;
      globe.width(Math.max(300, container.clientWidth));
      globe.height(Math.max(260, container.clientHeight));
    });
  }

  function focusCountry(code) {
    const feature = worldFeatures.find(item => countryCode(item) === code);
    if (!feature) return;
    const coords = feature.geometry?.coordinates;
    if (!coords) return;

    let points = [];
    function collect(value) {
      if (!Array.isArray(value)) return;
      if (typeof value[0] === "number" && typeof value[1] === "number") {
        points.push(value);
      } else {
        value.forEach(collect);
      }
    }
    collect(coords);
    if (!points.length) return;

    const lng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const lat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    instances.forEach(({ globe }) => globe.pointOfView({ lat, lng, altitude: 1.45 }, 900));
  }

  window.ArchiveGlobe = { init, resize, focusCountry };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
