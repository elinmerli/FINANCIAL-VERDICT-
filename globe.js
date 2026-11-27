/* ============================================================
   THE MONETARY ARCHIVE
   globe.js — Interactive 3D World Globe
   Version: 1.0.0
   ============================================================ */

(() => {
    "use strict";

    /* --------------------------------------------------------
       CONFIGURATION
    -------------------------------------------------------- */

    const CONFIG = {
        containerSelector: "#globe-container",

        worldDataUrl:
            "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",

        countryNamesUrl:
            "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.tsv",

        backgroundColor: "#080b10",

        globeResolution: 3,

        autoRotate: true,
        autoRotateSpeed: 0.35,

        polygonColor: "rgba(181, 145, 83, 0.22)",
        polygonHoverColor: "rgba(218, 183, 112, 0.75)",
        polygonSelectedColor: "rgba(218, 183, 112, 0.55)",

        polygonSideColor: "rgba(120, 91, 48, 0.35)",
        polygonStrokeColor: "rgba(193, 157, 94, 0.55)",

        polygonAltitude: 0.012,
        polygonHoverAltitude: 0.075,
        polygonSelectedAltitude: 0.045,

        transitionDuration: 250
    };


    /* --------------------------------------------------------
       STATE
    -------------------------------------------------------- */

    let globeInstance = null;

    let countries = [];

    let hoveredCountry = null;

    let selectedCountry = null;

    let resizeObserver = null;

    let isInitialized = false;


    /* --------------------------------------------------------
       DOM ELEMENTS
    -------------------------------------------------------- */

    const container = document.querySelector(
        CONFIG.containerSelector
    );

    if (!container) {
        console.error(
            "[Monetary Archive] Globe container not found:",
            CONFIG.containerSelector
        );

        return;
    }


    /* --------------------------------------------------------
       HELPERS
    -------------------------------------------------------- */

    function getCountryName(country) {
        if (!country) {
            return "Unknown country";
        }

        return (
            country.properties?.name ||
            country.properties?.NAME ||
            "Unknown country"
        );
    }


    function getCountryId(country) {
        if (!country) {
            return null;
        }

        return country.id || country.properties?.id || null;
    }


    function setText(selector, value) {
        const element = document.querySelector(selector);

        if (element) {
            element.textContent = value;
        }
    }


    function setLoadingMessage(message) {
        const loadingElement = document.querySelector(
            ".globe-loading"
        );

        if (loadingElement) {
            loadingElement.textContent = message;
        }
    }


    function hideLoadingMessage() {
        const loadingElement = document.querySelector(
            ".globe-loading"
        );

        if (loadingElement) {
            loadingElement.style.display = "none";
        }
    }


    function showLoadingMessage() {
        const loadingElement = document.querySelector(
            ".globe-loading"
        );

        if (loadingElement) {
            loadingElement.style.display = "block";
        }
    }


    function getPolygonColor(country) {
        if (country === selectedCountry) {
            return CONFIG.polygonSelectedColor;
        }

        if (country === hoveredCountry) {
            return CONFIG.polygonHoverColor;
        }

        return CONFIG.polygonColor;
    }


    function getPolygonAltitude(country) {
        if (country === hoveredCountry) {
            return CONFIG.polygonHoverAltitude;
        }

        if (country === selectedCountry) {
            return CONFIG.polygonSelectedAltitude;
        }

        return CONFIG.polygonAltitude;
    }


    /* --------------------------------------------------------
       COUNTRY INFORMATION
    -------------------------------------------------------- */

    function updateCountryInformation(country) {
        if (!country) {
            return;
        }

        const name = getCountryName(country);
        const id = getCountryId(country);

        /*
         * These selectors are optional.
         * If the elements exist in index.html,
         * their contents will be updated automatically.
         */

        setText("#selected-country-name", name);
        setText("#country-name", name);
        setText("[data-country-name]", name);

        setText("#selected-country-id", id || "—");


        /*
         * Send the selected country to the rest of the website.
         *
         * script.js can listen for this event and load
         * economic indicators for the selected country.
         */

        window.dispatchEvent(
            new CustomEvent("archive:country-selected", {
                detail: {
                    id: id,
                    name: name,
                    properties: country.properties || {}
                }
            })
        );
    }


    /* --------------------------------------------------------
       COUNTRY SELECTION
    -------------------------------------------------------- */

    function selectCountry(country) {
        if (!country) {
            return;
        }

        selectedCountry = country;

        updateCountryInformation(country);

        if (globeInstance) {
            globeInstance
                .polygonsData(countries)
                .polygonCapColor(getPolygonColor)
                .polygonAltitude(getPolygonAltitude);
        }

        console.info(
            "[Monetary Archive] Selected country:",
            getCountryName(country)
        );
    }


    /* --------------------------------------------------------
       COUNTRY HOVER
    -------------------------------------------------------- */

    function handleCountryHover(country) {
        hoveredCountry = country || null;

        container.style.cursor = country
            ? "pointer"
            : "grab";

        if (!globeInstance) {
            return;
        }

        globeInstance
            .polygonCapColor(getPolygonColor)
            .polygonAltitude(getPolygonAltitude);
    }


    /* --------------------------------------------------------
       LOAD COUNTRY NAMES
    -------------------------------------------------------- */

    async function loadCountryNames() {
        const response = await fetch(
            CONFIG.countryNamesUrl,
            {
                cache: "force-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Could not load country names."
            );
        }

        const text = await response.text();

        const lines = text.trim().split(/\r?\n/);

        const names = new Map();

        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split("\t");

            const id = columns[0];
            const name = columns.slice(1).join("\t");

            if (id && name) {
                names.set(String(id), name);
            }
        }

        return names;
    }


    /* --------------------------------------------------------
       LOAD WORLD GEOGRAPHY
    -------------------------------------------------------- */

    async function loadWorldData() {
        const response = await fetch(
            CONFIG.worldDataUrl,
            {
                cache: "force-cache"
            }
        );

        if (!response.ok) {
            throw new Error(
                "Could not load world map data."
            );
        }

        return await response.json();
    }


    /* --------------------------------------------------------
       PREPARE COUNTRY POLYGONS
    -------------------------------------------------------- */

    async function prepareCountries() {
        if (!window.topojson) {
            throw new Error(
                "TopoJSON library is missing. Check index.html."
            );
        }

        const [worldData, countryNames] = await Promise.all([
            loadWorldData(),
            loadCountryNames()
        ]);

        const countryObject =
            worldData.objects.countries;

        if (!countryObject) {
            throw new Error(
                "Country geometry was not found in world data."
            );
        }

        const geoJson = window.topojson.feature(
            worldData,
            countryObject
        );

        countries = geoJson.features.map(country => {
            const id = String(country.id);

            country.properties = {
                ...(country.properties || {}),

                id: id,

                name:
                    countryNames.get(id) ||
                    country.properties?.name ||
                    "Unknown country"
            };

            return country;
        });

        return countries;
    }


    /* --------------------------------------------------------
       CREATE GLOBE
    -------------------------------------------------------- */

    function createGlobe() {
        if (typeof window.Globe !== "function") {
            throw new Error(
                "Globe.gl library is missing. Check index.html."
            );
        }

        const width = Math.max(
            container.clientWidth,
            300
        );

        const height = Math.max(
            container.clientHeight,
            350
        );

        globeInstance = window.Globe({
            animateIn: true,
            waitForGlobeReady: true
        })(container);


        /* Globe appearance */

        globeInstance
            .width(width)
            .height(height)

            .backgroundColor(CONFIG.backgroundColor)

            .showAtmosphere(true)
            .atmosphereColor("#9a7744")
            .atmosphereAltitude(0.16)

            .showGraticules(true)

            .globeImageUrl(
                "https://unpkg.com/three-globe/example/img/earth-night.jpg"
            )

            .bumpImageUrl(
                "https://unpkg.com/three-globe/example/img/earth-topology.png"
            );


        /* Country polygons */

        globeInstance
            .polygonsData(countries)

            .polygonCapColor(getPolygonColor)

            .polygonSideColor(
                () => CONFIG.polygonSideColor
            )

            .polygonStrokeColor(
                () => CONFIG.polygonStrokeColor
            )

            .polygonAltitude(getPolygonAltitude)

            .polygonLabel(country => {
                return `
                    <div class="globe-country-tooltip">
                        <strong>
                            ${getCountryName(country)}
                        </strong>
                    </div>
                `;
            })

            .polygonsTransitionDuration(
                CONFIG.transitionDuration
            )

            .onPolygonHover(handleCountryHover)

            .onPolygonClick(selectCountry);


        /* Camera and controls */

        const controls = globeInstance.controls();

        controls.enableDamping = true;
        controls.dampingFactor = 0.08;

        controls.enableZoom = true;

        controls.minDistance = 150;
        controls.maxDistance = 450;

        controls.autoRotate =
            CONFIG.autoRotate &&
            !window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches;

        controls.autoRotateSpeed =
            CONFIG.autoRotateSpeed;


        /* Initial camera position */

        globeInstance.pointOfView(
            {
                lat: 25,
                lng: 10,
                altitude: 2.4
            },
            1000
        );


        /* Renderer quality */

        const renderer = globeInstance.renderer();

        renderer.setPixelRatio(
            Math.min(window.devicePixelRatio || 1, 2)
        );

        renderer.setClearColor(
            CONFIG.backgroundColor,
            0
        );


        /* Globe is ready */

        globeInstance.onGlobeReady(() => {
            hideLoadingMessage();

            container.classList.add(
                "globe-ready"
            );

            console.info(
                "[Monetary Archive] Globe successfully initialized."
            );
        });
    }


    /* --------------------------------------------------------
       RESPONSIVE RESIZING
    -------------------------------------------------------- */

    function handleResize() {
        if (!globeInstance) {
            return;
        }

        const width = Math.max(
            container.clientWidth,
            300
        );

        const height = Math.max(
            container.clientHeight,
            350
        );

        globeInstance
            .width(width)
            .height(height);
    }


    function initializeResizeObserver() {
        if ("ResizeObserver" in window) {
            resizeObserver = new ResizeObserver(() => {
                handleResize();
            });

            resizeObserver.observe(container);

            return;
        }

        window.addEventListener(
            "resize",
            handleResize
        );
    }


    /* --------------------------------------------------------
       PUBLIC GLOBE API
    -------------------------------------------------------- */

    window.ArchiveGlobe = {

        getInstance() {
            return globeInstance;
        },

        getCountries() {
            return countries;
        },

        getSelectedCountry() {
            return selectedCountry;
        },

        selectByName(name) {
            if (!name) {
                return false;
            }

            const country = countries.find(item => {
                return (
                    getCountryName(item).toLowerCase() ===
                    String(name).toLowerCase()
                );
            });

            if (!country) {
                return false;
            }

            selectCountry(country);

            return true;
        },

        selectById(id) {
            if (!id) {
                return false;
            }

            const country = countries.find(item => {
                return getCountryId(item) === String(id);
            });

            if (!country) {
                return false;
            }

            selectCountry(country);

            return true;
        },

        rotate(enabled = true) {
            if (!globeInstance) {
                return;
            }

            globeInstance.controls().autoRotate =
                Boolean(enabled);
        },

        focusCountry(name) {
            if (!globeInstance) {
                return false;
            }

            const country = countries.find(item => {
                return (
                    getCountryName(item).toLowerCase() ===
                    String(name).toLowerCase()
                );
            });

            if (!country) {
                return false;
            }

            const coordinates =
                country.geometry?.coordinates;

            if (!coordinates) {
                return false;
            }

            selectCountry(country);

            return true;
        },

        resize() {
            handleResize();
        }
    };


    /* --------------------------------------------------------
       INITIALIZATION
    -------------------------------------------------------- */

    async function initializeGlobe() {
        if (isInitialized) {
            return;
        }

        isInitialized = true;

        showLoadingMessage();

        setLoadingMessage(
            "Loading global financial map..."
        );

        try {
            await prepareCountries();

            if (!countries.length) {
                throw new Error(
                    "No countries were loaded."
                );
            }

            setLoadingMessage(
                "Preparing the interactive globe..."
            );

            createGlobe();

            initializeResizeObserver();

            console.info(
                `[Monetary Archive] Loaded ${countries.length} countries.`
            );

        } catch (error) {
            console.error(
                "[Monetary Archive] Globe initialization failed:",
                error
            );

            setLoadingMessage(
                "The globe could not be loaded. Please refresh the page."
            );

            container.classList.add(
                "globe-error"
            );

            isInitialized = false;
        }
    }


    /* --------------------------------------------------------
       START
    -------------------------------------------------------- */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializeGlobe,
            { once: true }
        );
    } else {
        initializeGlobe();
    }


    /* --------------------------------------------------------
       CLEANUP
    -------------------------------------------------------- */

    window.addEventListener(
        "pagehide",
        () => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }

            if (globeInstance) {
                globeInstance._destructor?.();
            }
        },
        { once: true }
    );

})();
