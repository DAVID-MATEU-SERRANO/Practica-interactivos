const startBtn = document.getElementById('startBtn');
const visual = document.getElementById('visual');
const maxAccDisplay = document.getElementById('maxAcc');

let maxAcc = 0;

startBtn.addEventListener('click', () => {
    if ("Accelerometer" in window) {
        try {
            // Frecuencia alta (60Hz) para no perder el pico de la sacudida
            const sensor = new Accelerometer({ frequency: 60 });

            // Umbral de sacudida (m/s²). 
            // 15-20 es una sacudida moderada. 25-30 es fuerte.
            const SHAKE_THRESHOLD = 25;
            let lastShakeTime = 0;

            sensor.onreading = () => {
                // Calculamos la magnitud total del vector de aceleración
                // Usamos el teorema de Pitágoras en 3D
                const totalAcc = Math.sqrt(
                    sensor.x ** 2 +
                    sensor.y ** 2 +
                    sensor.z ** 2
                );

                // Guardamos el máximo para mostrar
                if (totalAcc > maxAcc) {
                    maxAcc = totalAcc;
                    maxAccDisplay.innerText = maxAcc.toFixed(1);
                }

                // Si la aceleración total supera el umbral
                if (totalAcc > SHAKE_THRESHOLD) {
                    const now = Date.now();

                    // Evitamos que el gesto se dispare mil veces por segundo (debounce)
                    if (now - lastShakeTime > 500) {
                        handleShake();
                        lastShakeTime = now;
                    }
                }
            };

            sensor.onerror = (event) => alert("Error: " + event.error.name);
            sensor.start();

            startBtn.style.display = 'none';

        } catch (error) {
            alert("Error al iniciar sensor: " + error.message);
        }
    } else {
        alert("Acelerómetro no disponible. Usa Chrome en Android y HTTPS.");
    }
});

function handleShake() {
    console.log("¡SHAKE detectado!");
    visual.innerText = "¡SHAKE!";
    visual.classList.add('shake-active');

    // Volver al estado normal después de un momento
    setTimeout(() => {
        visual.classList.remove('shake-active');
        visual.innerText = "ESPERANDO GESTO";
    }, 600);
}