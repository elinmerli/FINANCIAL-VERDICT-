
/* =========================================================
   THE MONETARY ARCHIVE
   INTERACTIVE 3D GLOBE
   ========================================================= */

(function () {
    "use strict";

    const CONFIG = {
        topologyURL:
            "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",

        namesURL:
            "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv",

        countriesURL:
            "https://restcountries.com/v3.1/all?fields=name,cca2,cca3,currencies,capital,region",

        earthTexture:
            "https://unpkg.com/three-globe/example/img/earth-night.jpg",

        backgroundColor: "#070a10",

        initialAltitude: 2.25,
        minimumAltitude: 1.35,
        maximumAltitude: 5.5,

        autoRotateSpeed: 0.35
    };


    let globe = null;
    let polygons = [];
    let countryIndex = new Map();
    let selectedCountry = null;
    let autoRotate = true;
    let resizeObserver = null;


    /* =====================================================
       COUNTRY DATA
    ===================================================== */

    async function fetchText(url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Could not load ${url}`);
        }

        return response.text();
    }


    async function fetchJSON(url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Could not load ${url}`);
        }

        return response.json();
    }


    function normalizeName(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }


    function parseTSV(text) {
        const lines = text.trim().split(/\r?\n/);
        const result = new Map();

        lines.slice(1).forEach(function (line) {
            const columns = line.split("\t");

            if (columns.length < 2) return;

            result.set(
                String(columns[0]).trim(),
                String(columns[1]).trim()
            );
        });

        return result;
    }


    async function loadCountryIndex() {
        const countries = await fetchJSON(CONFIG.countriesURL);

        const index = new Map();

        countries.forEach(function (country) {
            const name = country.name
                ? country.name.common
                : "";

            const code = country.cca2 || "";

            if (!name || !code) return;

            index.set(normalizeName(name), {
                name: name,
                code: code,
                alpha3: country.cca3 || "",
                currencies: country.currencies || {},
                capital: country.capital || [],
                region: country.region || ""
            });
        });

        const aliases = {
            "unitedstatesofamerica": "US",
            "unitedstates": "US",
            "russia": "RU",
            "southkorea": "KR",
            "northkorea": "KP",
            "ivorycoast": "CI",
            "czechrepublic": "CZ",
            "democraticrepublicofthecongo": "CD",
            "republicofthecongo": "CG",
            "vietnam": "VN",
            "syria": "SY",
            "iran": "IR",
            "tanzania": "TZ",
            "bolivia": "BO",
            "venezuela": "VE",
            "moldova": "MD",
            "brunei": "BN",
            "laos": "LA",
            "micronesia": "FM",
            "palestine": "PS"
        };

        Object.entries(aliases).forEach(function ([name, code]) {
            const country = countries.find(item => item.cca2 === code);

            if (country) {
                index.set(name, {
                    name: country.name.common,
                    code: country.cca2,
                    alpha3: country.cca3 || "",
                    currencies: country.currencies || {},
                    capital: country.capital || [],
                    region: country.region || ""
                });
            }
        });

        countryIndex = index;
    }


    /* =====================================================
       BUILD GEOGRAPHY
    ===================================================== */

    async function loadPolygons() {
        if (!window.topojson) {
            throw new Error("TopoJSON library is not available.");
        }

        const [topology, namesText] = await Promise.all([
            fetchJSON(CONFIG.topologyURL),
            fetchText(CONFIG.namesURL)
        ]);

        const names = parseTSV(namesText);

        const countries = window.topojson.feature(
            topology,
            topology.objects.countries
        ).features;

        return countries.map(function (feature) {
            const id = String(feature.id);

            const name = names.get(id) || `Country ${id}`;

            const normalized = normalizeName(name);

            const profile = countryIndex.get(normalized) || null;

            return {
                ...feature,

                properties: {
                    ...(feature.properties || {}),
                    name: name,
                    code: profile ? profile.code : null,
                    alpha3: profile ? profile.alpha3 : null,
                    currency: profile
                        ? Object.keys(profile.currencies)[0] || null
                        : null
                }
            };
        });
    }


    /* =====================================================
       COUNTRY SELECTION
    ===================================================== */

    function selectCountry(feature) {
        if (!feature || !feature.properties) return;

        selectedCountry = feature;

        const properties = feature.properties;

        const country = {
            name: properties.name || "Unknown country",
            code: properties.code || null,
            alpha3: properties.alpha3 || null,
            currency: properties.currency || null
        };

        window.dispatchEvent(
            new CustomEvent("archive:country-selected", {
                detail: country
            })
        );

        if (globe) {
            globe
                .polygonCapColor(function (item) {
                    return item === selectedCountry
                        ? "rgba(255, 199, 110, 0.85)"
                        : "rgba(180, 119, 53, 0.22)";
                });
        }
    }


    /* =====================================================
       GLOBE INITIALIZATION
    ===================================================== */

    async function init() {
        const container = document.getElementById("globe-container");

        if (!container) return;

        if (globe) return;

        try {
            if (typeof window.Globe !== "function") {
                throw new Error("Globe.gl library is not available.");
            }

            if (!window.topojson) {
                throw new Error("TopoJSON library is not available.");
            }

            container.innerHTML = "";

            await loadCountryIndex();

            polygons = await loadPolygons();

            globe = window.Globe({
                animateIn: true,
                waitForGlobeReady: true
            })(container)

                .backgroundColor(CONFIG.backgroundColor)

                .globeImageUrl(CONFIG.earthTexture)

                .showAtmosphere(true)

                .atmosphereColor("#b37b43")

                .atmosphereAltitude(0.18)

                .polygonsData(polygons)

                .polygonCapColor(function (feature) {
                    return feature === selectedCountry
                        ? "rgba(255, 199, 110, 0.85)"
                        : "rgba(180, 119, 53, 0.20)";
                })

                .polygonSideColor(() => "rgba(90, 56, 27, 0.30)")

                .polygonStrokeColor(() => "rgba(237, 191, 125, 0.38)")

                .polygonAltitude(function (feature) {
                    return feature === selectedCountry
                        ? 0.018
                        : 0.004;
                })

                .polygonLabel(function (feature) {
                    const properties = feature.properties || {};

                    return `
                        <div style="
                            background:#11141b;
                            color:#f1e5d0;
                            border:1px solid #d7a45e;
                            border-radius:7px;
                            padding:9px 12px;
                            font-family:Arial,sans-serif;
                        ">
                            <strong style="color:#f1c47d">
                                ${escapeHTML(properties.name || "Unknown")}
                            </strong>
                            <br>
                            <small>
                                Click to view country information
                            </small>
                        </div>
                    `;
                })

                .onPolygonClick(function (feature) {
                    selectCountry(feature);
                });

            const controls = globe.controls();

            controls.autoRotate = true;
            controls.autoRotateSpeed = CONFIG.autoRotateSpeed;
            controls.enableDamping = true;
            controls.dampingFactor = 0.08;
            controls.minDistance = 150;
            controls.maxDistance = 600;

            globe.pointOfView(
                {
                    lat: 25,
                    lng: 15,
                    altitude: CONFIG.initialAltitude
                },
                1000
            );

            autoRotate = true;

            installControls();
            observeSize();

            const loading = container.querySelector(".globe-loading");

            if (loading) {
                loading.remove();
            }

            window.dispatchEvent(
                new CustomEvent("archive:globe-ready")
            );

        } catch (error) {
            console.error("[ArchiveGlobe]", error);

            container.innerHTML = `
                <div class="globe-loading">
                    <div>
                        <strong>Globe unavailable</strong>
                        <p style="margin-top:8px;color:#92939a">
                            ${escapeHTML(error.message)}
                        </p>
                        <button
                            id="retryGlobe"
                            style="
                                margin-top:14px;
                                padding:9px 15px;
                                background:#d7a45e;
                                color:#111;
                                border:0;
                                border-radius:6px;
                                cursor:pointer;
                            "
                        >
                            Retry
                        </button>
                    </div>
                </div>
            `;

            const retry = document.getElementById("retryGlobe");

            if (retry) {
                retry.addEventListener("click", function () {
                    globe = null;
                    init();
                });
            }
        }
    }


    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[char];
        });
    }


    /* =====================================================
       CONTROLS
    ===================================================== */

    function installControls() {
        const zoomIn = document.getElementById("globeZoomIn");
        const zoomOut = document.getElementById("globeZoomOut");
        const reset = document.getElementById("globeReset");
        const rotate = document.getElementById("globeAutoRotate");

        if (zoomIn) {
            zoomIn.addEventListener("click", function () {
                zoom(-0.45);
            });
        }

        if (zoomOut) {
            zoom(0.45);
        }

        if (zoomOut) {
            zoomOut.addEventListener("click", function () {
                zoom(0.45);
            });
        }

        if (reset) {
            reset.addEventListener("click", function () {
                if (!globe) return;

                globe.pointOfView(
                    {
                        lat: 25,
                        lng: 15,
                        altitude: CONFIG.initialAltitude
                    },
                    900
                );
            });
        }

        if (rotate) {
            rotate.addEventListener("click", toggleRotation);
        }
    }


    function zoom(amount) {
        if (!globe) return;

        const current = globe.pointOfView();

        const nextAltitude = Math.max(
            CONFIG.minimumAltitude,
            Math.min(
                CONFIG.maximumAltitude,
                current.altitude + amount
            )
        );

        globe.pointOfView(
            {
                ...current,
                altitude: nextAltitude
            },
            350
        );
    }


    function toggleRotation() {
        if (!globe) return;

        autoRotate = !autoRotate;

        globe.controls().autoRotate = autoRotate;

        const button = document.getElementById("globeAutoRotate");

        if (button) {
            button.classList.toggle("active", autoRotate);
        }
    }


    /* =====================================================
       RESIZE
    ===================================================== */

    function observeSize() {
        const container = document.getElementById("globe-container");

        if (!container || !globe) return;

        if (resizeObserver) {
            resizeObserver.disconnect();
        }

        resizeObserver = new ResizeObserver(function () {
            if (!globe) return;

            globe.width(container.clientWidth);
            globe.height(container.clientHeight);
        });

        resizeObserver.observe(container);
    }


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.ArchiveGlobe = Object.freeze({
        init: init,
        selectCountry: selectCountry,
        toggleRotation: toggleRotation,
        zoom: zoom,

        getSelectedCountry: function () {
            return selectedCountry
                ? selectedCountry.properties
                : null;
        },

        getGlobe: function () {
            return globe;
        }
    });

})();
