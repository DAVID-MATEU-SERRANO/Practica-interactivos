const startBtn = document.getElementById('startBtn');
const visualCard = document.getElementById('visualCard');
const dataDiv = document.getElementById('data');

// Función de conversión exacta de tu transparencia
function quaternionToEuler(q) {
    const [x, y, z, w] = q;

    // Fórmulas matemáticas para la conversión
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const roll = Math.asin(2 * (w * y - z * x));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));

    return {
        roll: roll * (180 / Math.PI),  // Convertir a grados
        pitch: pitch * (180 / Math.PI),
        yaw: yaw * (180 / Math.PI)
    };
}

startBtn.addEventListener('click', () => {
    if ('AbsoluteOrientationSensor' in window) {
        try {
            // Frecuencia de 60Hz para máxima fluidez visual
            const sensor = new AbsoluteOrientationSensor({ frequency: 60 });

            sensor.addEventListener('reading', () => {
                const q = sensor.quaternion; // Obtener cuaternión [x, y, z, w]

                if (q) {
                    let { roll, pitch, yaw } = quaternionToEuler(q);

                    // Actualizar texto informativo
                    document.getElementById('r').innerText = roll.toFixed(1);
                    document.getElementById('p').innerText = pitch.toFixed(1);
                    document.getElementById('y').innerText = yaw.toFixed(1);

                    // Aplicar la rotación al "Móvil Virtual" en CSS
                    // Nota: Los ejes de CSS pueden variar respecto a los del sensor
                    visualCard.style.transform = `rotateX(${-pitch}deg) rotateY(${roll}deg) rotateZ(${-yaw}deg)`;
                }
            });

            sensor.onerror = (event) => alert("Error: " + event.error.name);
            sensor.start();

            startBtn.style.display = 'none';
            dataDiv.style.display = 'block';

        } catch (error) {
            alert("El sensor no pudo iniciarse.");
        }
    } else {
        alert("AbsoluteOrientationSensor no soportado. Prueba en Chrome (Android) y vía HTTPS.");
    }
});