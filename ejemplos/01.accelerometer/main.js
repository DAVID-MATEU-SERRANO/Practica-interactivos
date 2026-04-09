const startBtn = document.getElementById('startBtn');
const dataDiv = document.getElementById('data');
const pitchDisplay = document.getElementById('pitch');
const rollDisplay = document.getElementById('roll');


startBtn.addEventListener('click', () => {
    // 1. Verificamos si la API Accelerometer existe en el navegador
    if ("Accelerometer" in window) {
        try {
            // Creamos el sensor con una frecuencia de 30Hz
            const sensor = new Accelerometer({ frequency: 30 });

            sensor.onerror = (event) => {
                alert("Error del sensor: " + event.error.name);
                console.error("Error del sensor:", event.error.name);
            };

            sensor.addEventListener('reading', function (e) {

            });

            sensor.onreading = () => {
                // Obtenemos lecturas o valores por defecto
                const ax = sensor.x || 0;
                const ay = sensor.y || 0;
                const az = sensor.z || 9.8;
                console.log(ax, ay, az);

                // Cálculo de Pitch y Roll usando las fórmulas
                // Pitch: Inclinación respecto al eje X
                const pitch = Math.atan2(ay, Math.sqrt(ax * ax + az * az)) * (180 / Math.PI);

                // Roll: Inclinación respecto al eje Y
                const roll = Math.atan2(ax, Math.sqrt(ay * ay + az * az)) * (180 / Math.PI);

                // Actualizamos la interfaz
                pitchDisplay.innerText = pitch.toFixed(1) + "°";
                rollDisplay.innerText = roll.toFixed(1) + "°";
            };

            sensor.start();
            startBtn.style.display = 'none';
            dataDiv.style.display = 'block';

        } catch (error) {
            alert("No se pudo iniciar el acelerómetro. Asegúrate de usar HTTPS.");
        }
    } else {
        alert("Tu navegador no soporta la Generic Sensor API (Accelerometer).");
    }
});