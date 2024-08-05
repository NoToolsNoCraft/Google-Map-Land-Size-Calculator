function initMap() {
    const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 37.7749, lng: -122.4194 },
        zoom: 8,
    });

    const drawingManager = new google.maps.drawing.DrawingManager({
        drawingMode: google.maps.drawing.OverlayType.POLYGON,
        drawingControl: true,
        drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: ['polygon'],
        },
        polygonOptions: {
            editable: true,
            draggable: true,
        }
    });

    drawingManager.setMap(map);

    let currentOverlay = null;
    let overlays = [];
    let areas = [];
    let exclusionMode = false;

    google.maps.event.addListener(drawingManager, 'overlaycomplete', function (event) {
        currentOverlay = event.overlay;
        overlays.push(currentOverlay);

        const path = currentOverlay.getPath();
        const area = google.maps.geometry.spherical.computeArea(path);
        let label = '';

        if (exclusionMode) {
            if (areas.length > 0) {
                currentOverlay.setOptions({
                    strokeColor: '#FF0000',
                    fillColor: '#FF0000',
                });
                // Add exclusion to the last land area
                const exclusionLabel = `Excluded from ${areas[areas.length - 1].label}`;
                areas[areas.length - 1].exclusions.push({ overlay: currentOverlay, area });
                label = exclusionLabel;
                placeLabelOnShape(map, currentOverlay, exclusionLabel);
            }
        } else {
            const landLabel = `Land ${areas.length + 1}`;
            areas.push({ label: landLabel, overlay: currentOverlay, area, exclusions: [] });
            label = landLabel;
            placeLabelOnShape(map, currentOverlay, landLabel);
        }

        updateDisplay();

        google.maps.event.addListener(path, 'insert_at', () => updateArea(areas[areas.length - 1]));
        google.maps.event.addListener(path, 'remove_at', () => updateArea(areas[areas.length - 1]));
        google.maps.event.addListener(path, 'set_at', () => updateArea(areas[areas.length - 1]));
    });

    document.getElementById('undo').addEventListener('click', function () {
        if (currentOverlay) {
            const path = currentOverlay.getPath();
            if (path.getLength() > 0) {
                path.pop();
                updateDisplay();
            }
        }
    });

    document.getElementById('clear-shape').addEventListener('click', function () {
        overlays.forEach(overlay => overlay.setMap(null));
        overlays = [];
        areas = [];
        currentOverlay = null;
        updateDisplay();
    });

    document.getElementById('toggle-exclusion').addEventListener('click', function () {
        exclusionMode = !exclusionMode;
        this.innerText = exclusionMode ? 'Switch to Land Mode' : 'Switch to Exclusion Mode';
        drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
    });

    const input = document.getElementById('search-box');
    const autocomplete = new google.maps.places.Autocomplete(input);

    autocomplete.bindTo('bounds', map);

    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.geometry.location) {
            window.alert("No details available for input: '" + place.name + "'");
            return;
        }

        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(15);
        }
    });

    function addPolygonListeners(polygon) {
        // Recalculate the area if the shape is modified
        google.maps.event.addListener(polygon.getPath(), 'set_at', function () {
            updatePolygonArea(polygon);
        });

        google.maps.event.addListener(polygon.getPath(), 'insert_at', function () {
            updatePolygonArea(polygon);
        });

        google.maps.event.addListener(polygon.getPath(), 'remove_at', function () {
            updatePolygonArea(polygon);
        });
    }

    function updateDisplay() {
        let totalArea = 0;
        let output = areas.map((areaObj, index) => {
            let currentArea = areaObj.area;
            let exclusionAreaSum = 0;
        
            const exclusionAreas = areaObj.exclusions.map((exclusionObj, exclusionIndex) => {
                const exclusionArea = google.maps.geometry.spherical.computeArea(exclusionObj.overlay.getPath());
                exclusionAreaSum += exclusionArea;
                return `
                    <div class="land-details" style="color: red;">
                        Excluded ${areaObj.label}-${exclusionIndex + 1}: ${(exclusionArea / 10000).toFixed(2)} ha (${exclusionArea.toFixed(2)} m²)
                        <button data-land-index="${index}" data-exclusion-index="${exclusionIndex}" style="color: red; font-weight: bold; margin-left: 10px;">X</button>
                    </div>
                `;
            });
        
            const sideLengths = getSideLengths(areaObj.overlay.getPath());
        
            totalArea += (currentArea - exclusionAreaSum);
        
            return `
                <div class="land-box">
                    <div class="land-header">
                        ${areaObj.label}: ${(currentArea / 10000).toFixed(2)} ha (${currentArea.toFixed(2)} m²)
                        <button data-land-index="${index}" style="color: red; font-weight: bold; margin-left: 10px;">X</button>
                    </div>
                    ${exclusionAreas.join('')}
                    <button onclick="toggleSideLengths(${index})">Show/Hide Side Lengths</button>
                    <div id="sides-${index}" style="display: none;" class="land-details">${sideLengths.map((length, idx) => `<div>Side ${idx + 1}: ${length.toFixed(2)} m</div>`).join('')}</div>
                </div>
            `;
        }).join('');
        
    
        output += `<div class="land-box"><div class="land-header">Total Area: ${(totalArea / 10000).toFixed(2)} ha (${totalArea.toFixed(2)} m²)</div></div>`;
    
        document.getElementById('area').innerHTML = output;
    }
    

    function updateArea(areaObj) {
        const newArea = google.maps.geometry.spherical.computeArea(areaObj.overlay.getPath());
        areaObj.area = newArea;
        updateDisplay();
    }
    
    function getSideLengths(path) {
        const sideLengths = [];
        for (let i = 0; i < path.getLength(); i++) {
            const start = path.getAt(i);
            const end = path.getAt((i + 1) % path.getLength());
            const length = google.maps.geometry.spherical.computeDistanceBetween(start, end);
            sideLengths.push(length);
        }
        return sideLengths;
    }

    function placeLabelOnShape(map, overlay, label) {
        const bounds = new google.maps.LatLngBounds();
        overlay.getPath().forEach(function (latLng) {
            bounds.extend(latLng);
        });

        const infoWindow = new google.maps.InfoWindow({
            content: label,
            position: bounds.getCenter(),
        });

        infoWindow.open(map);

        // Update label position when shape is edited
        google.maps.event.addListener(overlay.getPath(), 'set_at', function () {
            const newBounds = new google.maps.LatLngBounds();
            overlay.getPath().forEach(function (latLng) {
                newBounds.extend(latLng);
            });
            infoWindow.setPosition(newBounds.getCenter());
        });

        google.maps.event.addListener(overlay.getPath(), 'insert_at', function () {
            const newBounds = new google.maps.LatLngBounds();
            overlay.getPath().forEach(function (latLng) {
                newBounds.extend(latLng);
            });
            infoWindow.setPosition(newBounds.getCenter());
        });
        
        google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
            if (event.type === google.maps.drawing.OverlayType.POLYGON) {
                const polygon = event.overlay;
                addPolygonListeners(polygon);
                updatePolygonArea(polygon); // Initial area calculation
                areas.push({
                    overlay: polygon,
                    exclusions: [],
                });
                updateDisplay();
            }
        });
    }

   // Handle click events for removing land and exclusion overlays
document.getElementById('area').addEventListener('click', function (event) {
    const target = event.target;
    if (target.tagName === 'BUTTON' && target.dataset.landIndex !== undefined) {
        const landIndex = parseInt(target.dataset.landIndex, 10);
        const exclusionIndex = parseInt(target.dataset.exclusionIndex, 10);

        if (!isNaN(exclusionIndex)) {
            console.log(`Removing exclusion: landIndex=${landIndex}, exclusionIndex=${exclusionIndex}`);
            // Remove exclusion
            removeExclusion(landIndex, exclusionIndex);
        } else {
            console.log(`Removing land: landIndex=${landIndex}`);
            // Remove land
            removeLand(landIndex);
        }
    }
});
    


function toggleSideLengths(index) {
    const sidesDiv = document.getElementById(`sides-${index}`);
    sidesDiv.style.display = sidesDiv.style.display === 'none' ? 'block' : 'none';
}

function removeLand(landIndex) {
    const land = areas[landIndex];
    // Remove the overlay from the map
    land.overlay.setMap(null);

    // Remove all exclusion overlays from the map
    land.exclusions.forEach(exclusion => exclusion.overlay.setMap(null));

    // Remove the land from the areas array
    areas.splice(landIndex, 1);

    // Update the display
    updateDisplay();
}

function removeExclusion(landIndex, exclusionIndex) {
    const exclusion = areas[landIndex].exclusions[exclusionIndex];
    // Remove the exclusion overlay from the map
    exclusion.overlay.setMap(null);

    // Remove the exclusion from the exclusions array
    areas[landIndex].exclusions.splice(exclusionIndex, 1);

    // Update the display
    updateDisplay();
}

}

google.maps.event.addDomListener(window, 'load', initMap);
