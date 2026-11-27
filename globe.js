
(function () {
    "use strict";

    let globe = null;
    let countries = [];
    let initialized = false;

    const container = () => document.getElementById("globeViz");

    function showMessage(message) {
        const element = container();

        if (element) {
            element.innerHTML = '<div class="loading-message">' + message + "</div>";
        }
    }

    async function loadCountryShapes() {
        const response = await fetch(
            "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
        );

        if (!response.ok) {
            throw new Error("Could not load country boundaries.");
        }

        const geojson = await response.json();

        return (geojson.features || []).filter(feature => {
            return feature.geometry && feature.properties;
        });
    }

    function getCountryCode(feature) {
        const props = feature.properties || {};

        return (
            props.ADM0_A3 ||
            props.ISO_A3 ||
            props.SOV_A3 ||
            ""
        );
    }

    function getCountryName(feature) {
        const props = feature.properties || {};

        return (
            props.ADMIN ||
            props.NAME ||
            props.NAME_EN ||
            "Unknown country"
        );
    }

    function selectCountry(feature) {
        const name = getCountryName(feature);
        const code = getCountryCode(feature);

        document.dispatchEvent(new CustomEvent("archive:country-selected", {
            detail: {
                name,
                iso3: code,
                feature
            }
        }));
    }

    async function initGlobe() {
        if (initialized) return;

        const element = container();

        if (!element) return;

        if (typeof window.Globe !== "function") {
            showMessage("The globe library could not be loaded. Check your internet connection.");
            return;
        }

        showMessage("Preparing the geographical archive...");

        try {
            countries = await loadCountryShapes();

            element.innerHTML = "";

            globe = window.Globe()(element)
                .width(element.clientWidth)
                .height(element.clientHeight)
                .backgroundColor("#11110f")
                .showAtmosphere(true)
                .atmosphereColor("#9c8455")
                .atmosphereAltitude(0.13)
                .globeImageUrl(
                    "https://unpkg.com/three-globe/example/img/earth-night.jpg"
                )
                .polygonsData(countries)
                .polygonGeoJsonGeometry(feature => feature.geometry)
                .polygonCapColor(() => "rgba(151, 125, 75, 0.10)")
                .polygonSideColor(() => "rgba(151, 125, 75, 0.12)")
                .polygonStrokeColor(() => "rgba(205, 178, 123, 0.55)")
                .polygonAltitude(0.006)
                .polygonLabel(feature => {
                    return "<b>" + getCountryName(feature) + "</b>";
                })
                .onPolygonClick(feature => selectCountry(feature))
                .onPolygonHover(feature => {
                    if (feature) {
                        globe.polygonCapColor(item =>
                            item === feature
                                ? "rgba(190, 160, 98, 0.48)"
                                : "rgba(151, 125, 75, 0.10)"
                        );
                    } else {
                        globe.polygonCapColor(() => "rgba(151, 125, 75, 0.10)");
                    }
                });

            const controls = globe.controls();
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.35;
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;

            globe.pointOfView({
                lat: 20,
                lng: 5,
                altitude: 2.2
            });

            initialized = true;

            window.addEventListener("resize", resizeGlobe);

            document.getElementById("globeZoomIn")?.addEventListener("click", () => {
                changeZoom(0.75);
            });

            document.getElementById("globeZoomOut")?.addEventListener("click", () => {
                changeZoom(1.3);
            });

            document.getElementById("globeReset")?.addEventListener("click", () => {
                globe.pointOfView({
                    lat: 20,
                    lng: 5,
                    altitude: 2.2
                }, 800);
            });

        } catch (error) {
            console.error("Globe error:", error);
            showMessage("The globe could not be loaded. Please refresh the page.");
        }
    }

    function changeZoom(multiplier) {
        if (!globe) return;

        const current = globe.pointOfView();
        const nextAltitude = Math.max(
            0.8,
            Math.min(4.5, current.altitude * multiplier)
        );

        globe.pointOfView({
            ...current,
            altitude: nextAltitude
        }, 350);
    }

    function resizeGlobe() {
        if (!globe || !container()) return;

        globe
            .width(container().clientWidth)
            .height(container().clientHeight);
    }

    window.ArchiveGlobe = {
        init: initGlobe
    };
})();
