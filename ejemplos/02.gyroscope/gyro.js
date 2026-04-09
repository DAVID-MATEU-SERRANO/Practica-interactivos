const startBtn = document.getElementById('startBtn');
const visual = document.getElementById('visual');
const valZDisplay = document.getElementById('valZ');

startBtn.addEventListener('click', () => {
    if ('Gyroscope' in window) {
        try {
            // El giroscopio mide rad/s. 60Hz es ideal para detectar gestos rápidos.
            const gyro = new Gyroscope({ frequency: 60 });

            let lastRotationZ = 0;
            const threshold = 2.5; // Umbral de sensibilidad

            gyro.addEventListener('reading', () => {
                let rotationZ = gyro.z; // Velocidad angular en el eje Z

                // Actualizamos el número en pantalla para los alumnos
                valZDisplay.innerText = rotationZ.toFixed(2);

                // Detectar un cambio brusco (Gesto de muñeca)
                if (Math.abs(rotationZ - lastRotationZ) > threshold) {
                    visual.innerText = "¡DETECTADO!";
                    visual.classList.add('active');

                    // Quitamos la alerta visual tras medio segundo
                    setTimeout(() => {
                        visual.classList.remove('active');
                        visual.innerText = "ESPERANDO";
                    }, 500);
                }

                lastRotationZ = rotationZ;
            });

            gyro.onerror = (event) => {
                if (event.error.name === 'NotAllowedError') {
                    alert("Permiso denegado para usar el giroscopio.");
                } else {
                    alert("Error: " + event.error.name);
                }
            };

            gyro.start();
            startBtn.style.display = 'none';

        } catch (error) {
            alert("Error al inicializar el giroscopio: " + error.message);
        }
    } else {
        alert("Giroscopio no disponible en este navegador/dispositivo.");
    }
});