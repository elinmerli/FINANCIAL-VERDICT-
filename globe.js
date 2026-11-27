"use strict";

window.ArchiveGlobe = (() => {

    let instance = null;
    let resizeObserver = null;
    let selectedFeature = null;
    let currentContainer = null;
    let features = [];

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]);
    }

    function countryName(feature) {
        const properties = feature?.properties || {};

        return (
            properties.ADMIN ||
            properties.NAME ||
            properties.name ||
            properties.NAME_EN ||
            "Unknown territory"
        );
    }

    function countryCode(feature) {
        const properties = feature?.properties || {};

        const candidates = [
            properties.ISO_A3,
            properties.ADM0_A3,
            properties.iso_a3,
            properties.SOV_A3
        ];

        for (const candidate of candidates) {
            const code = String(candidate || "").toUpperCase();

            if (/^[A-Z]{3}$/.test(code) && code !== "XXX") {
                return code;
            }
        }

        return null;
    }

    function getPolygonColor(feature) {
        return feature === selectedFeature
            ? "rgba(190, 160, 105, 0.72)"
            : "rgba(120, 105, 78, 0.16)";
    }

    function setSelection(feature) {
        selectedFeature = feature;

        if (instance) {
            instance
                .polygonCapColor(getPolygonColor)
                .polygonAltitude(item =>
                    item === selectedFeature ? 0.025 : 0.008
                );
        }
    }

    async function loadGeography() {
        const urls = [
            "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
            "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
        ];

        let lastError = null;

        for (const url of urls) {
            try {
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error(`Geographic source returned ${response.status}`);
                }

                const data = await response.json();

                if (!Array.isArray(data.features) || !data.features.length) {
                    throw new Error("Geographic source contains no country features.");
                }

                return data.features;

            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error("Unable to load geographic data.");
    }

    function destroy() {
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }

        if (instance) {
            try {
                instance._destructor?.();
            } catch (error) {
                console.warn("Globe cleanup:", error);
            }

            instance = null;
        }

        currentContainer = null;
    }

    async function initialize(container, onSelect) {
        if (!container) {
            return;
        }

        if (currentContainer === container && instance) {
            return;
        }

        destroy();

        currentContainer = container;

        if (typeof window.Globe !== "function") {
            container.innerHTML = `
                <div class="empty-state">
                    The globe library could not be loaded.
                    Check your internet connection and reload the page.
                </div>
            `;

            return;
        }

        container.innerHTML = `
            <div class="empty-state">Loading geographic atlas...</div>
        `;

        try {
            features = await loadGeography();

            if (!container.isConnected) {
                return;
            }

            container.innerHTML = "";

            const width = Math.max(container.clientWidth, 300);
            const height = Math.max(container.clientHeight, 400);

            instance = Globe()(container)
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
                .atmosphereColor("#827253")
                .atmosphereAltitude(0.13)

                .polygonsData(features)

                .polygonAltitude(feature =>
                    feature === selectedFeature ? 0.025 : 0.008
                )

                .polygonCapColor(getPolygonColor)

                .polygonSideColor(() =>
                    "rgba(80, 68, 47, 0.12)"
                )

                .polygonStrokeColor(() =>
                    "rgba(174, 151, 112, 0.50)"
                )

                .polygonLabel(feature => {
                    const name = countryName(feature);

                    return `
                        <div style="
                            padding:10px 13px;
                            background:#171714;
                            border:1px solid #806d4d;
                            color:#e4ddcf;
                            font-family:Arial,sans-serif;
                            font-size:12px;
                        ">
                            ${escapeHTML(name)}
                        </div>
                    `;
                })

                .onPolygonClick(feature => {
                    setSelection(feature);

                    if (typeof onSelect === "function") {
                        onSelect({
                            name: countryName(feature),
                            code: countryCode(feature),
                            feature
                        });
                    }
                });

            const controls = instance.controls();

            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.32;
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.minDistance = 130;
            controls.maxDistance = 500;

            instance.pointOfView({
                lat: 20,
                lng: 0,
                altitude: 2.2
            });

            resizeObserver = new ResizeObserver(() => {
                if (!instance || !container.isConnected) {
                    return;
                }

                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;

                if (newWidth > 0 && newHeight > 0) {
                    instance
                        .width(newWidth)
                        .height(newHeight);
                }
            });

            resizeObserver.observe(container);

        } catch (error) {
            console.error("Globe initialization error:", error);

            container.innerHTML = `
                <div class="empty-state">
                    <strong>Geographic atlas unavailable</strong>
                    <p>${escapeHTML(error.message)}</p>
                    <p>Check your internet connection and reload the section.</p>
                </div>
            `;
        }
    }

    function rotateTo(lat, lng, altitude = 1.8) {
        if (!instance) {
            return;
        }

        instance.pointOfView({
            lat,
            lng,
            altitude
        }, 1000);
    }

    return {
        initialize,
        destroy,
        rotateTo,
        countryName,
        countryCode
    };

})();
