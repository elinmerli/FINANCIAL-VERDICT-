"use strict";

window.initializeArchiveGlobe = async function (options = {}) {

    const container = document.getElementById("globe-container");

    if (!container) {
        return;
    }

    if (typeof window.Globe !== "function") {
        container.innerHTML = `
            <div class="empty-state">
                The 3D globe library could not be loaded.
                Check your internet connection and reload the page.
            </div>
        `;

        return;
    }

    if (container.dataset.initialized === "true") {
        return;
    }

    container.dataset.initialized = "true";

    const GEOJSON_URL =
        "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

    try {
        const response = await fetch(GEOJSON_URL);

        if (!response.ok) {
            throw new Error(`Geographic data error: ${response.status}`);
        }

        const geoData = await response.json();

        if (!geoData || !Array.isArray(geoData.features)) {
            throw new Error("Invalid geographic dataset.");
        }

        const width = Math.max(container.clientWidth, 300);
        const height = Math.max(container.clientHeight, 400);

        const globe = Globe()(container)

            .width(width)
            .height(height)

            .backgroundColor("#10100f")

            .globeImageUrl(
                "https://unpkg.com/three-globe/example/img/earth-night.jpg"
            )

            .bumpImageUrl(
                "https://unpkg.com/three-globe/example/img/earth-topology.png"
            )

            .showAtmosphere(true)

            .atmosphereColor("#75684e")

            .atmosphereAltitude(0.13)

            .polygonsData(geoData.features)

            .polygonAltitude(feature => {
                return feature === selectedCountry ? 0.025 : 0.008;
            })

            .polygonCapColor(feature => {
                return feature === selectedCountry
                    ? "rgba(190,157,101,0.65)"
                    : "rgba(125,112,84,0.16)";
            })

            .polygonSideColor(() => "rgba(70,62,47,0.15)")

            .polygonStrokeColor(() => "rgba(181,157,113,0.45)")

            .polygonLabel(feature => {
                const name =
                    feature.properties?.ADMIN ||
                    feature.properties?.NAME ||
                    feature.properties?.name ||
                    "Unknown territory";

                return `
                    <div style="
                        padding:9px 12px;
                        background:#191916;
                        border:1px solid #806d4d;
                        color:#e6dfd0;
                        font-family:Arial,sans-serif;
                        font-size:12px;
                    ">
                        ${escapeGlobeText(name)}
                    </div>
                `;
            })

            .onPolygonClick(feature => {
                selectedCountry = feature;

                if (typeof options.onCountrySelected === "function") {
                    options.onCountrySelected(feature);
                }

                globe.polygonsData([]);

                requestAnimationFrame(() => {
                    globe.polygonsData(geoData.features);
                });
            });

        let selectedCountry = null;

        const controls = globe.controls();

        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.35;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 130;
        controls.maxDistance = 500;

        globe.pointOfView({
            lat: 20,
            lng: 0,
            altitude: 2.2
        });

        const resizeObserver = new ResizeObserver(() => {
            const newWidth = container.clientWidth;
            const newHeight = container.clientHeight;

            if (newWidth > 0 && newHeight > 0) {
                globe
                    .width(newWidth)
                    .height(newHeight);
            }
        });

        resizeObserver.observe(container);

        container.dataset.initialized = "true";

        container._archiveGlobe = {
            instance: globe,
            resizeObserver
        };

    } catch (error) {
        console.error("Globe initialization failed:", error);

        container.dataset.initialized = "false";

        container.innerHTML = `
            <div class="empty-state">
                <h3>Global atlas unavailable</h3>
                <p>${escapeGlobeText(error.message)}</p>
                <p>Check your connection and try opening this section again.</p>
            </div>
        `;
    }
};

function escapeGlobeText(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}
