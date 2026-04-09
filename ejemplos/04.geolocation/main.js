const btn = document.getElementById('getPosBtn');
const statusEl = document.getElementById('status');
const resultDiv = document.getElementById('result');

btn.addEventListener('click', () => {
    if ("geolocation" in navigator) {
        statusEl.innerText = "Solicitando permiso y buscando señal...";

        // Opciones para mayor precisión
        const options = {
            enableHighAccuracy: true, // Fuerza el uso de GPS si está disponible
            timeout: 10000,           // Espera máxima de 10 segundos
            maximumAge: 0             // No usar ubicaciones cacheadas
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                // Actualizar interfaz
                document.getElementById('lat').innerText = lat.toFixed(6);
                document.getElementById('lng').innerText = lng.toFixed(6);
                document.getElementById('acc').innerText = accuracy.toFixed(1);

                // Crear enlace a Google Maps
                document.getElementById('mapUrl').href = `https://www.google.com/maps?q=${lat},${lng}`;

                statusEl.innerText = "¡Ubicación encontrada!";
                resultDiv.style.display = 'block';
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        statusEl.innerText = "Error: El usuario denegó el permiso.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        statusEl.innerText = "Error: Ubicación no disponible.";
                        break;
                    case error.TIMEOUT:
                        statusEl.innerText = "Error: Tiempo de espera agotado.";
                        break;
                    default:
                        statusEl.innerText = "Error desconocido.";
                        break;
                }
            },
            options
        );
    } else {
        alert("Tu navegador no soporta geolocalización.");
    }
});