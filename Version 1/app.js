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

        if (exclusionMode) {
            if (areas.length > 0) {
                // Add exclusion to the last land area
                areas[areas.length - 1].exclusions.push({ overlay: currentOverlay, area });
            }
        } else {
            areas.push({ label: `Land ${areas.length + 1}`, overlay: currentOverlay, area, exclusions: [] });
        }

        updateDisplay();

        google.maps.event.addListener(path, 'insert_at', updateDisplay);
        google.maps.event.addListener(path, 'remove_at', updateDisplay);
        google.maps.event.addListener(path, 'set_at', updateDisplay);
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

    function updateDisplay() {
        let totalArea = 0;
        let output = areas.map((areaObj, index) => {
            let currentArea = areaObj.area;
            let exclusionAreaSum = 0;

            const exclusionAreas = areaObj.exclusions.map((exclusionObj, exclusionIndex) => {
                const exclusionArea = google.maps.geometry.spherical.computeArea(exclusionObj.overlay.getPath());
                exclusionAreaSum += exclusionArea;
                return `<div style="padding-left: 20px;">Excluded ${areaObj.label}-${exclusionIndex + 1}: ${(exclusionArea / 10000).toFixed(2)} ha</div>`;
            });

            totalArea += (currentArea - exclusionAreaSum);

            return `<div>${areaObj.label}: ${(currentArea / 10000).toFixed(2)} ha</div>${exclusionAreas.join('')}`;
        }).join('');

        output += `<div>Total Area: ${(totalArea / 10000).toFixed(2)} ha</div>`;

        document.getElementById('area').innerHTML = output;
    }
}

window.onload = initMap;
