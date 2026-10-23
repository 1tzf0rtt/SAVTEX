
"use strict";

// ==================================================
// SAVTEX REAL-TIME MAP
// ==================================================

let map = null;
let userMarker = null;
let alertLayer = null;
let routeLayer = null;


// ==================================================
// START MAP
// ==================================================

function initializeMap() {
    const mapElement = document.getElementById("map");

    if (!mapElement) return;

    if (typeof L === "undefined") {
        console.error("Leaflet was not loaded.");
        return;
    }

    if (map) return;

    map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([31.0, -99.9], 6);

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);

    alertLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);

    addDemoRoutes();
    loadTexasAlerts();

    setTimeout(() => map.invalidateSize(), 300);
}


// ==================================================
// DEMO ROUTES
// ==================================================

function addDemoRoutes() {
    if (!map || !routeLayer) return;

    const routes = [
        {
            name: "I-10",
            points: [
                [29.7604, -95.3698],
                [29.4241, -98.4936]
            ],
            color: "#21b66f",
            status: "Route Open",
            className: "route-open"
        },
        {
            name: "I-35",
            points: [
                [29.4241, -98.4936],
                [30.2672, -97.7431]
            ],
            color: "#e63946",
            status: "Route Blocked / Hazard",
            className: "route-blocked"
        },
        {
            name: "US-290",
            points: [
                [30.2672, -97.7431],
                [29.8833, -97.9403]
            ],
            color: "#e5b93f",
            status: "Use Caution",
            className: "route-caution"
        }
    ];

    routes.forEach(route => {
        L.polyline(route.points, {
            color: route.color,
            weight: 6,
            opacity: 0.9,
            lineCap: "round"
        })
        .bindPopup(`
            <div class="route-popup">
                <strong>${escapeHTML(route.name)}</strong>
                <br>
                <span class="${route.className}">
                    ● ${escapeHTML(route.status)}
                </span>
            </div>
        `)
        .addTo(routeLayer);
    });
}


// ==================================================
// ACTIVE ALERTS CONTAINER
// ==================================================

function createAlertsContainer() {
    let container = document.getElementById("activeAlertsList");

    if (container) return container;

    container = document.createElement("div");
    container.id = "activeAlertsList";

    container.style.cssText = `
        width: 100%;
        margin-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    const alertCount = document.getElementById("alertCount");

    if (alertCount && alertCount.parentElement) {
        const section = alertCount.closest(
            ".active-alerts, .alerts-section, .alert-section"
        );

        if (section) {
            section.appendChild(container);
        } else {
            alertCount.parentElement.insertAdjacentElement(
                "afterend",
                container
            );
        }
    } else {
        const mapElement = document.getElementById("map");

        if (mapElement) {
            mapElement.insertAdjacentElement("beforebegin", container);
        } else {
            document.body.appendChild(container);
        }
    }

    return container;
}


// ==================================================
// DISPLAY ONLY DISASTER NAMES
// ==================================================

function displayActiveAlerts(features) {
    const container = createAlertsContainer();

    container.innerHTML = "";

    if (!features || features.length === 0) {
        const empty = document.createElement("div");

        empty.style.cssText = `
            background: #DCEEFF;
            color: #12345A;
            padding: 12px 16px;
            border-left: 5px solid #12345A;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 700;
        `;

        empty.textContent = "No active disasters.";

        container.appendChild(empty);
        return;
    }

    const disasterIcons = {
        tornado: "🌪️",
        flood: "🌊",
        hurricane: "🌀",
        tropical: "🌀",
        thunderstorm: "⛈️",
        wildfire: "🔥",
        fire: "🔥",
        winter: "❄️",
        snow: "❄️",
        heat: "🌡️",
        drought: "☀️",
        wind: "💨",
        dust: "🌫️",
        lightning: "⚡",
        fog: "🌫️",
        earthquake: "🌎"
    };

    const disasters = [...new Set(
        features.map(feature => {
            const event =
                feature.properties?.event || "Unknown Disaster";

            const lower = event.toLowerCase();

            const iconKey = Object.keys(disasterIcons).find(
                key => lower.includes(key)
            );

            const icon = iconKey
                ? disasterIcons[iconKey]
                : "🚨";

            return {
                name: event,
                icon: icon
            };
        })
    )];

    disasters.forEach(disaster => {
        const item = document.createElement("div");

        item.style.cssText = `
            background: #DCEEFF;
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 5px solid #12345A;
            font-size: 14px;
            font-weight: 700;
            color: #12345A;
            box-shadow: 0 2px 6px rgba(18, 52, 90, 0.08);
            transition: background 0.2s ease;
        `;

        item.textContent =
            `${disaster.icon} ${disaster.name}`;

        container.appendChild(item);
    });
}


// ==================================================
// LOAD LIVE TEXAS ALERTS
// ==================================================

async function loadTexasAlerts() {
    const alertCount =
        document.getElementById("alertCount");

    const lastUpdated =
        document.getElementById("lastUpdated");

    try {
        if (lastUpdated) {
            lastUpdated.textContent =
                "Checking the National Weather Service...";
        }

        const response = await fetch(
            "/api/alerts/texas",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error("Alert request failed.");
        }

        const data = await response.json();

        const features = Array.isArray(data.features)
            ? data.features
            : [];

        if (alertCount) {
            alertCount.textContent = features.length;
        }

        displayActiveAlerts(features);

        drawAlerts(features);

        if (lastUpdated) {
            lastUpdated.textContent =
                "Updated " + new Date().toLocaleTimeString();
        }

    } catch (error) {
        console.error("SavTex alert error:", error);

        if (lastUpdated) {
            lastUpdated.textContent =
                "Live alerts temporarily unavailable.";
        }

        const container = createAlertsContainer();

        container.textContent =
            "Unable to retrieve live alerts.";
    }
}


// ==================================================
// DRAW ALERTS ON MAP
// ==================================================

function drawAlerts(features) {
    if (!map || !alertLayer) return;

    alertLayer.clearLayers();

    features.forEach(feature => {
        const properties = feature.properties || {};

        const event =
            properties.event || "Weather Alert";

        const severity =
            properties.severity || "Unknown";

        const headline =
            properties.headline || event;

        const description =
            properties.description ||
            "No additional information available.";

        const geometry = feature.geometry;

        const color = getSeverityColor(severity);

        const popup = createAlertPopup(
            event,
            severity,
            headline,
            description
        );

        if (!geometry) return;

        // POLYGON

        if (geometry.type === "Polygon") {
            const coordinates = geometry.coordinates[0];

            const latLngs = coordinates.map(point => [
                point[1],
                point[0]
            ]);

            L.polygon(latLngs, {
                color: color,
                fillColor: color,
                fillOpacity: 0.20,
                weight: 2
            })
            .bindPopup(popup)
            .addTo(alertLayer);
        }

        // MULTIPOLYGON

        if (geometry.type === "MultiPolygon") {
            geometry.coordinates.forEach(polygon => {
                const coordinates = polygon[0];

                const latLngs = coordinates.map(point => [
                    point[1],
                    point[0]
                ]);

                L.polygon(latLngs, {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.20,
                    weight: 2
                })
                .bindPopup(popup)
                .addTo(alertLayer);
            });
        }

        // POINT

        if (geometry.type === "Point") {
            const coordinates = geometry.coordinates;

            L.circleMarker(
                [coordinates[1], coordinates[0]],
                {
                    radius: 8,
                    color: "#ffffff",
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.9
                }
            )
            .bindPopup(popup)
            .addTo(alertLayer);
        }
    });
}


// ==================================================
// ALERT POPUP
// ==================================================

function createAlertPopup(
    event,
    severity,
    headline,
    description
) {
    return `
        <div class="alert-popup">

            <div class="alert-popup-title">
                ${escapeHTML(event)}
            </div>

            <div class="alert-popup-severity">
                <span class="popup-severity-dot ${getSeverityClass(severity)}"></span>

                <strong>
                    ${escapeHTML(getSeverityLabel(severity))}
                </strong>
            </div>

            <hr>

            <strong>
                ${escapeHTML(headline)}
            </strong>

            <p>
                ${escapeHTML(String(description).substring(0, 500))}
            </p>

            <small>
                Source: National Weather Service
            </small>

        </div>
    `;
}


// ==================================================
// HTML SAFETY
// ==================================================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}


// ==================================================
// SEVERITY
// ==================================================

function getSeverityClass(severity) {
    const value = String(severity).toLowerCase();

    if (
        value.includes("extreme") ||
        value.includes("severe") ||
        value.includes("warning")
    ) {
        return "high";
    }

    if (
        value.includes("moderate") ||
        value.includes("watch")
    ) {
        return "medium";
    }

    if (
        value.includes("minor") ||
        value.includes("advisory")
    ) {
        return "low";
    }

    return "low";
}


function getSeverityColor(severity) {
    const severityClass = getSeverityClass(severity);

    if (severityClass === "high") {
        return "#e63946";
    }

    if (severityClass === "medium") {
        return "#e5b93f";
    }

    return "#21b66f";
}


function getSeverityLabel(severity) {
    const value = String(severity).toLowerCase();

    if (
        value.includes("extreme") ||
        value.includes("severe") ||
        value.includes("warning")
    ) {
        return "High";
    }

    if (
        value.includes("moderate") ||
        value.includes("watch")
    ) {
        return "Medium";
    }

    if (
        value.includes("minor") ||
        value.includes("advisory")
    ) {
        return "Low";
    }

    return "Monitoring";
}


// ==================================================
// USER LOCATION
// ==================================================

function getLocation() {
    const status =
        document.getElementById("locationStatus");

    const locationText =
        document.getElementById("locationText");

    if (!navigator.geolocation) {
        if (status) {
            status.textContent =
                "Location services are not supported.";
        }

        return;
    }

    if (status) {
        status.textContent =
            "Finding your location...";
    }

    navigator.geolocation.getCurrentPosition(

        function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            if (status) {
                status.textContent =
                    "Your current location has been detected.";
            }

            if (locationText) {
                locationText.textContent =
                    "Coordinates: " +
                    lat.toFixed(5) +
                    ", " +
                    lon.toFixed(5);
            }

            if (!map) return;

            if (userMarker) {
                map.removeLayer(userMarker);
            }

            userMarker = L.circleMarker(
                [lat, lon],
                {
                    radius: 9,
                    color: "#ffffff",
                    weight: 3,
                    fillColor: "#1769aa",
                    fillOpacity: 1
                }
            )
            .bindPopup(`
                <div class="location-popup">
                    <strong>Your Location</strong>
                    <br>
                    <span>
                        ${lat.toFixed(5)},
                        ${lon.toFixed(5)}
                    </span>
                </div>
            `)
            .addTo(map);

            map.setView([lat, lon], 10);

            loadLocationAlerts(lat, lon);
        },

        function(error) {
            console.error("Location error:", error);

            if (status) {
                status.textContent =
                    "Unable to access your location. Please allow location access.";
            }
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        }
    );
}


// ==================================================
// LOCATION ALERTS
// ==================================================

async function loadLocationAlerts(lat, lon) {
    try {
        const response = await fetch(
            `/api/alerts/location?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) return;

        const data = await response.json();

        const features = Array.isArray(data.features)
            ? data.features
            : [];

        const status =
            document.getElementById("locationStatus");

        if (status) {
            if (features.length > 0) {
                const disasters = [
                    ...new Set(
                        features.map(feature =>
                            feature.properties?.event ||
                            "Unknown Alert"
                        )
                    )
                ];

                status.textContent =
                    features.length +
                    " active alert(s) near your location: " +
                    disasters.join(", ");

            } else {
                status.textContent =
                    "No active NWS alerts detected near your location.";
            }
        }

    } catch (error) {
        console.error("Location alert error:", error);
    }
}


// ==================================================
// PAGE STARTUP
// ==================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {
        initializeMap();
    }
);


// ==================================================
// AUTOMATIC ALERT REFRESH
// ==================================================

setInterval(function() {
    if (document.visibilityState === "visible") {
        loadTexasAlerts();
    }
}, 5 * 60 * 1000);
