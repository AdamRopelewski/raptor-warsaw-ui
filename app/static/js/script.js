let startMarker = null;
let endMarker = null;
let currentRoute = null;

// Initialize map
const map = L.map('map').setView([52.2297, 21.0122], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Set default date to today at 12:00
function setDefaultDateTime() {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const datetimeLocal = now.toISOString().slice(0, 16);
    document.getElementById('dateTime').value = datetimeLocal;
}
setDefaultDateTime();

// Map click handler
map.on('click', (e) => {
    if (!startMarker) {
        setMarker('start', e.latlng);
    } else if (!endMarker) {
        setMarker('end', e.latlng);
    }
});

// Set marker function
function setMarker(type, latlng) {
    if (type === 'start') {
        if (startMarker) map.removeLayer(startMarker);
        startMarker = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({ className: 'start-icon', html: '🟢' })
        }).addTo(map);
        startMarker.bindPopup('Punkt startowy').openPopup();
    } else {
        if (endMarker) map.removeLayer(endMarker);
        endMarker = L.marker(latlng, {
            draggable: true,
            icon: L.divIcon({ className: 'end-icon', html: '🔴' })
        }).addTo(map);
        endMarker.bindPopup('Punkt końcowy').openPopup();
    }
}

// Find route button
document.getElementById('findRoute').addEventListener('click', async () => {
    if (!startMarker || !endMarker) {
        alert('Proszę wybrać zarówno punkt startowy jak i końcowy na mapie');
        return;
    }

    try {
        const response = await fetchRoute();
        if (response && Array.isArray(response) && response.length > 0) {
            drawRoute(response);
        } else {
            alert('Nie znaleziono trasy dla wybranych punktów');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Błąd podczas wyszukiwania trasy: ' + (error.message || 'Nieznany błąd'));
    }
});
// Clear route button
document.getElementById('clearRoute').addEventListener('click', () => {
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }
    if (startMarker) {
        map.removeLayer(startMarker);
        startMarker = null;
    }
    if (endMarker) {
        map.removeLayer(endMarker);
        endMarker = null;
    }
});

async function fetchRoute() {
    const requestParams = {
        sourceLatitude: startMarker.getLatLng().lat,
        sourceLongitude: startMarker.getLatLng().lng,
        targetLatitude: endMarker.getLatLng().lat,
        targetLongitude: endMarker.getLatLng().lng,
        dateTime: document.getElementById('dateTime').value,
        timeType: document.getElementById('timeType').value,
        maxWalkingDuration: document.getElementById('maxWalkingDuration').value,
        maxTransferNumber: document.getElementById('maxTransferNumber').value,
        minTransferTime: document.getElementById('minTransferTime').value,
        maxTravelTime: document.getElementById('maxTravelTime').value
    };

    try {
        const response = await fetch(`/routing/connections?${new URLSearchParams(requestParams)}`);
        const data = await response.json();
        updateApiRequestBox(requestParams);
        drawRoute(data, requestParams);
        return data;
    } catch (error) {
        console.error('Error:', error);
        alert('Błąd podczas wyszukiwania trasy: ' + error.message);
    }
}

function updateApiRequestBox(params) {
    let apiUrl = '';
    if (!params || Object.keys(params).length === 0) {
        apiUrl = "Brak parametrów trasy";
    } else {
        apiUrl = `${window.location.origin}/routing/connections?${new URLSearchParams(params)}`;
    }
    document.getElementById('api-request-content').textContent = apiUrl;
}

function drawRoute(routes, requestParams) {

    // 1. Sprawdzenie poprawności danych wejściowych
    if (!routes || !Array.isArray(routes)) {
        console.error('Invalid routes data:', routes);
        return;
    }

    // 2. Usunięcie poprzedniej trasy
    if (currentRoute) {
        map.removeLayer(currentRoute);
        currentRoute = null;
    }

    // 3. Inicjalizacja nowej warstwy
    currentRoute = L.layerGroup().addTo(map);

    try {
        // 4. Przetwarzanie każdej znalezionej trasy
        routes.forEach((route, routeIndex) => {
            if (!route.legs || !Array.isArray(route.legs)) {
                console.warn(`Route ${routeIndex} missing legs`, route);
                return;
            }

            // 5. Rysowanie każdego odcinka trasy
            route.legs.forEach((leg, legIndex) => {
                try {
                    // 5a. Ustawienie stylu w zależności od typu transportu
                    const color = getColorForLegType(leg.type);
                    const coordinates = getCoordinatesForLeg(leg);

                    if (!coordinates || coordinates.length < 2) {
                        console.warn(`Missing coordinates for leg ${legIndex}`, leg);
                        return;
                    }

                    // 5b. Narysowanie linii trasy
                    const polyline = L.polyline(coordinates, {
                        color: color,
                        weight: 6,
                        opacity: 0.8,
                        lineJoin: 'round'
                    }).addTo(currentRoute);

                    // 5c. Dodanie informacji o linii komunikacyjnej
                    if (leg.trip?.route) {
                        polyline.bindPopup(`
                            <div class="route-popup">
                                <h3>${leg.trip.route.shortName || 'N/A'} (${leg.trip.route.transportMode || 'N/A'})</h3>
                                <p><b>Kierunek:</b> ${leg.trip.headSign || 'N/A'}</p>
                                <p><b>Od:</b> ${leg.fromStop?.name || 'Start'}</p>
                                <p><b>Do:</b> ${leg.toStop?.name || 'Koniec'}</p>
                                <p><b>Godziny:</b> ${leg.departureTime} - ${leg.arrivalTime}</p>
                            </div>
                        `, { maxWidth: 300 });
                    }

                    // 5d. Dodanie przystanków
                    if (leg.trip?.stopTimes) {
                        leg.trip.stopTimes.forEach((stopTime, stopIndex) => {
                            try {
                                if (!stopTime.stop?.coordinates) return;

                                // Now, consider a stop transfer if both fromStop and toStop exist and the route type is "ROUTE"
                                const isTransferStop = (leg.fromStop && leg.toStop && leg.trip?.route?.type === 'ROUTE') && (stopIndex === 0);
                                const isTerminal = stopIndex === 0 || stopIndex === leg.trip.stopTimes.length - 1;

                                const marker = L.marker([
                                    stopTime.stop.coordinates.latitude,
                                    stopTime.stop.coordinates.longitude
                                ], {
                                    icon: L.divIcon({
                                        className: isTransferStop ? 'stop-icon transfer' : `stop-icon ${isTerminal ? 'terminal' : ''}`,
                                        html: isTerminal ? '🔵' : (isTransferStop ? '🔀' : '🟡'),
                                        iconSize: isTransferStop ? [20, 20] : [16, 16]
                                    }),
                                    riseOnHover: true,
                                    zIndexOffset: isTerminal ? 1000 : 0
                                });

                                // Zbieranie informacji o wszystkich liniach na przystanku
                                const lines = [];
                                routes.forEach(r => {
                                    r.legs?.forEach(l => {
                                        l.trip?.stopTimes?.forEach(st => {
                                            if (st.stop?.id === stopTime.stop.id && l.trip.route) {
                                                lines.push({
                                                    number: l.trip.route.shortName,
                                                    type: l.trip.route.transportMode,
                                                    direction: l.trip.headSign
                                                });
                                            }
                                        });
                                    });
                                });

                                // Usuwanie duplikatów
                                const uniqueLines = [];
                                const seen = new Set();
                                lines.forEach(line => {
                                    const key = `${line.number}-${line.direction}`;
                                    if (!seen.has(key)) {
                                        seen.add(key);
                                        uniqueLines.push(line);
                                    }
                                });

                                // Przygotowanie zawartości popupu
                                let popupContent = `
                                    <div class="stop-popup">
                                        <h3>${stopTime.stop.name}</h3>
                                        <p><b>ID:</b> ${stopTime.stop.id}</p>
                                        <p><b>Przyjazd:</b> ${stopTime.arrivalTime || 'N/A'}</p>
                                        <p><b>Odjazd:</b> ${stopTime.departureTime || 'N/A'}</p>
                                `;

                                if (uniqueLines.length > 0) {
                                    popupContent += `<div class="lines-list"><b>Linie:</b><ul>`;
                                    uniqueLines.forEach(line => {
                                        popupContent += `
                                            <li>
                                                <span class="line-badge" style="background-color: ${getColorForLegType(line.type)}">
                                                    ${line.number}
                                                </span>
                                                → ${line.direction} (${line.type})
                                            </li>`;
                                    });
                                    popupContent += `</ul></div>`;
                                }

                                popupContent += `</div>`;

                                marker.bindPopup(popupContent, {
                                    maxWidth: 350,
                                    minWidth: 250,
                                    className: 'stop-popup-container'
                                }).addTo(currentRoute);

                                // Otwieranie popupu po najechaniu
                                marker.on('mouseover', function () {
                                    this.openPopup();
                                });

                            } catch (stopError) {
                                console.error(`Error processing stop ${stopIndex}:`, stopError);
                            }
                        });
                    }
                } catch (legError) {
                    console.error(`Error processing leg ${legIndex}:`, legError);
                }
            });
        });

        // 6. Dopasowanie widoku mapy do trasy
        if (startMarker && endMarker) {
            const bounds = L.latLngBounds([
                startMarker.getLatLng(),
                endMarker.getLatLng()
            ]);

            // Dla długich tras dodajemy padding
            const isLongRoute = bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 5000;
            map.fitBounds(bounds, {
                padding: isLongRoute ? [50, 50] : [100, 100],
                maxZoom: isLongRoute ? 14 : 17
            });
        }

    } catch (error) {
        console.error('Error drawing route:', error);
        alert('Wystąpił błąd podczas rysowania trasy');
        if (currentRoute) {
            map.removeLayer(currentRoute);
            currentRoute = null;
        }
    }
}

function getColorForLegType(type) {
    const colors = {
        'WALK': '#ff0000',
        'BUS': '#0066ff',
        'TRAM': '#00aa00',
        'SUBWAY': '#ff6600',
        'RAIL': '#9900cc',
        'FERRY': '#0099cc'
    };
    return colors[type] || '#666666';
}

function getCoordinatesForLeg(leg) {
    if (leg.type === 'WALK') {
        return [
            [leg.from.latitude, leg.from.longitude],
            [leg.to.latitude, leg.to.longitude]
        ];
    }

    if (leg.trip?.stopTimes) {
        return leg.trip.stopTimes.map(st => [
            st.stop.coordinates.latitude,
            st.stop.coordinates.longitude
        ]);
    }

    return [];
}