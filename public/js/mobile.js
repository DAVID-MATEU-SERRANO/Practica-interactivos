import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

// Socket io
const socket = io();

// Elementos del DOM
const btnIniciar = document.getElementById('btn-iniciar');
const startOverlay = document.getElementById('start-overlay');
const mobileContent = document.getElementById('mobile-content');
const pulseCircle = document.querySelector('.pulse-circle');

// Variables para la detección de golpes
const UMBRAL_GESTO = 18; // umbral de aceleración para detectar un golpe
const TIEMPO_MIN_ENTRE_GOLPES = 850; // tiempo mínimo entre golpes
const COOLDOWN_PUNTO = 1500; // tiempo de espera entre puntos
const BUFFER_SIZE = 4; // tamaño del buffer para suavizar los datos del sensor
const UMBRAL_ROTACION_PUNTO = 10.0; // umbral de rotación de muñeca para puntuar
const MAX_ACCEL_GESTO = 20.0; // aceleración máxima para detectar un golpe
const VENTANA_ROTACION = 1000; // tiempo para confirmar 1 o 2 giros
const HISTORIAL_MAX_SIZE = 30; // tamaño del historial para detectar giros

// Estado interno
let saqueDefinido = false; // indica si se ha definido el saque
let quienSaca = ''; // indica quién saca
let modoActual = ''; // indica el modo actual
let esSegundoSaque = false; // indica si es el segundo saque
let lastStrikeTime = 0; // tiempo del último golpe
let confirmTimer = null; // temporizador para confirmar un golpe
let lockGestos = false;  // bloquea los gestos
let isPointRunning = false; // indica si se está ejecutando un punto
let esperandoConfirmacionSalir = false;
let timeoutConfirmacion = null;

// Variables para el modo entrenamiento
let poseLandmarker = undefined;
let webcamRunning = false;
const videoElement = document.getElementById("webcam");
let currentFacingMode = "user"; // "user" (front) o "environment" (back)
let currentSubModo = null;

// Reutilizar canvas para el envío de video
const smallCanvas = document.createElement('canvas');
const sCtx = smallCanvas.getContext('2d');
smallCanvas.width = 320;
smallCanvas.height = 240;

// Variables para las métricas de los golpes
let pointStartTime = Date.now();
let gameStartTime = Date.now();
let lastStrokeMetrics = {
    power: 0,
    trajectory: 'Plano'
};
let currentPointStrokes = [];

// Sensores adicionales
let gyroSensor = null;

// Buffers para suavizar los datos del sensor
const buffers = {
    ax: [], ay: [], az: [], rx: [], ry: []
};
// función para suavizar los datos del sensor
function movingAverage(buffer, newVal) {
    buffer.push(newVal);
    if (buffer.length > BUFFER_SIZE) buffer.shift();
    return buffer.reduce((a, b) => a + b, 0) / buffer.length;
}

// Valores actuales filtrados
let currentMA = { ax: 0, ay: 0, az: 0, rx: 0, ry: 0 };
let rawMag = { ax: 0, ay: 0, az: 0 }; // Sin filtrar, para capturar pico real
let peakPower = 0;
let capturingPeak = false;

// Estado para giros de puntuación
let rotationCount = 0;
let rotationSigns = [];
let lastRotationPeakTime = 0;
let rotationTimer = null;

// Historial circular para análisis de impacto
let sensorHistory = [];
let peakTime = 0;


// Inicio del sistema (Interacción Obligatoria)
if (btnIniciar) {
    btnIniciar.addEventListener('click', () => {
        // Interfaces
        startOverlay.style.display = 'none';
        mobileContent.style.display = 'block';
        // Sensores y voz
        activarSensores();
        activarVoz();
    });

    // AUTO-INICIO tras un RESET (salir)
    if (sessionStorage.getItem('skipStartOverlay') === 'true') {
        sessionStorage.removeItem('skipStartOverlay');
        setTimeout(() => { btnIniciar.click(); }, 300);
    }
}

// Sincroniza el modo del sistema (Partido, Entrenamiento o Lobby)
socket.on('modo-actualizado', (modo) => {
    modoActual = modo;
    if (modo === 'MODO PARTIDO') {
        stopTraining();
    } else if (modo === 'MODO ENTRENAMIENTO') {
        // No iniciamos la cámara aquí. Esperamos a que se seleccione un submodo
        // para saber qué cámara encender (frontal o trasera).
    } else {
        // Reset de estados internos al volver al Lobby
        saqueDefinido = false;
        esSegundoSaque = false;
        esperandoConfirmacionSalir = false;
        if (timeoutConfirmacion) clearTimeout(timeoutConfirmacion);
        stopTraining();
    }
});

// Sincroniza el saque del sistema
// Inicializamos
socket.on('saque-definido', (quien) => {
    saqueDefinido = true;
    quienSaca = quien;
    gameStartTime = Date.now();
    isPointRunning = false;
    currentPointStrokes = [];
    esSegundoSaque = false;
});

// Lo actualiza
socket.on('saque-actualizado', (quien) => {
    quienSaca = quien;
    saqueDefinido = true;
});

// Sincroniza el punto del sistema
socket.on('punto-registrado', () => {
    isPointRunning = false;
    currentPointStrokes = [];
    esSegundoSaque = false;
    lockGestos = false;
    capturingPeak = false;
});

// Registra el fin del juego
socket.on('registrar-fin-juego', (data) => {
    // El servidor nos avisa que el juego terminó, enviamos la duración acumulada
    const duration = (Date.now() - gameStartTime) / 1000;
    // Enviamos la duración acumulada
    socket.emit('registrar-fin-juego', {
        ...data,
        duracion: duration.toFixed(1) + "s"
    });
    gameStartTime = Date.now();
    isPointRunning = false;
});

// Sincroniza el submodo del sistema
socket.on('submodo-actualizado', (submodo) => {
    const oldFacingMode = currentFacingMode;
    currentSubModo = submodo;

    if (!submodo) {
        stopTraining();
        return;
    }

    currentFacingMode = (submodo === 'LINEA') ? 'environment' : 'user';

    // Gestión de cámara según el modo
    if (!webcamRunning) {
        // Si la cámara estaba apagada (por un "salir"), la encendemos
        startTraining();
    } else if (oldFacingMode !== currentFacingMode) {
        // Si ya estaba encendida pero hay que cambiar de cámara (Fondo <-> Línea)
        stopTraining();
        setTimeout(() => { startTraining(); }, 400);
    }
});


// Sensores
function activarSensores() {
    // Intenta usar LinearAccelerationSensor (ignora la gravedad) o Accelerometer (estándar).
    const SensorType = window.LinearAccelerationSensor || window.Accelerometer;

    if (SensorType) {
        // Configuramos el sensor a 60Hz (60 lecturas por segundo) para máxima precisión
        const sensor = new SensorType({ frequency: 60 });

        sensor.onreading = () => {
            try {
                // No procesar si los gestos están bloqueados, no estamos en partido o no se ha definido quién saca
                if (lockGestos || modoActual !== 'MODO PARTIDO' || !saqueDefinido) return;

                // Aplicamos el "Moving Average" para limpiar el ruido eléctrico del sensor en los 3 ejes
                currentMA.ax = movingAverage(buffers.ax, sensor.x);
                currentMA.ay = movingAverage(buffers.ay, sensor.y);
                currentMA.az = movingAverage(buffers.az, sensor.z);

                // Guardamos los valores reales (sin filtrar) para no perder el "pico" máximo de fuerza del impacto
                rawMag.ax = sensor.x;
                rawMag.ay = sensor.y;
                rawMag.az = sensor.z;

                // Calculamos la magnitud del vector (Pitágoras 3D) para saber la aceleración total
                const rawMagnitude = Math.sqrt(rawMag.ax ** 2 + rawMag.ay ** 2 + rawMag.az ** 2);
                // Convertimos a fuerzas G (dividiendo por la gravedad terrestre 9.8)
                const rawPowerG = rawMagnitude / 9.8;

                const now = Date.now();

                // Usamos la magnitud SUAVIZADA solo para detectar si hubo un movimiento brusco (umbral)
                const magnitude = Math.sqrt(currentMA.ax ** 2 + currentMA.ay ** 2 + currentMA.az ** 2);
                const currentPowerG = rawPowerG; // Usamos el valor real para la potencia final del golpe

                // DETECCIÓN DE GOLPE (Swing)
                if (magnitude > UMBRAL_GESTO) {
                    // Evitamos detectar dos veces el mismo golpe (filtro de tiempo)
                    if (now - lastStrikeTime < TIEMPO_MIN_ENTRE_GOLPES) return;

                    // Si no estamos capturando ya un pico de fuerza, empezamos ahora
                    if (!capturingPeak) {
                        lastStrikeTime = now;
                        capturingPeak = true;
                        peakPower = currentPowerG;
                        peakTime = now;

                        // Esperamos 500ms para analizar todo el recorrido del brazo antes de confirmar el golpe
                        setTimeout(() => {
                            // Si el golpe tuvo una fuerza mínima realista (> 1.8G), lo registramos
                            if (peakPower > 1.8) {
                                registrarGolpeTenis(now);
                            }
                            capturingPeak = false;
                        }, 500);
                    }
                }

                // Si estamos en medio de un swing, guardamos el valor más alto alcanzado
                if (capturingPeak) {
                    if (rawPowerG > peakPower) {
                        peakPower = rawPowerG;
                        peakTime = now;
                    }
                }

                // Guardamos el estado del sensor en una lista circular para poder analizar la trayectoria después
                sensorHistory.push({
                    t: now,
                    mag: currentPowerG,
                    ax: currentMA.ax,
                    ay: currentMA.ay,
                    az: currentMA.az,
                    rx: currentMA.rx,
                    ry: currentMA.ry
                });
                // Si el historial es muy viejo, borramos el primer elemento
                if (sensorHistory.length > HISTORIAL_MAX_SIZE) sensorHistory.shift();
            } catch (error) {
                console.error("Error crítico en acelerómetro:", error);
                capturingPeak = false;
                lockGestos = false;
            }
        };

        sensor.start(); // Encendemos el acelerómetro
    }

    // Se encarga de medir la rotación (giros de muñeca).
    if ('Gyroscope' in window) {
        gyroSensor = new Gyroscope({ frequency: 60 });

        gyroSensor.onreading = () => {
            try {
                // Suavizamos los datos de rotación en X e Y
                currentMA.rx = movingAverage(buffers.rx, gyroSensor.x);
                currentMA.ry = movingAverage(buffers.ry, gyroSensor.y);

                if (lockGestos || modoActual !== 'MODO PARTIDO' || !saqueDefinido) return;

                const now = Date.now();
                const magnitude = Math.sqrt(currentMA.ax ** 2 + currentMA.ay ** 2 + currentMA.az ** 2);

                // Si el móvil gira rápido (en el eje Y) pero el brazo NO se está moviendo fuerte (baja aceleración),
                // el sistema entiende que es un gesto de "girar la muñeca" para sumar un punto al marcador.
                if (Math.abs(currentMA.ry) > UMBRAL_ROTACION_PUNTO && magnitude < MAX_ACCEL_GESTO) {
                    if (now - lastRotationPeakTime > 400) {
                        lastRotationPeakTime = now;
                        gestionarGiroPuntuacion(currentMA.ry);
                    }
                }
            } catch (error) {
                console.error("Error crítico en giroscopio:", error);
                lockGestos = false;
            }
        };
        gyroSensor.start(); // Encendemos el giroscopio
    }
}

// Gestiona los puntos al girar el movil
function gestionarGiroPuntuacion(val) {
    // Incrementa el contador de giros detectados en la ráfaga actual
    rotationCount++;
    rotationSigns.push(val);

    // Si ya había un temporizador en marcha, lo cancelamos (reinicio de ventana de tiempo)
    if (rotationTimer) clearTimeout(rotationTimer);

    rotationTimer = setTimeout(() => {

        // Sumamos todos los valores y sacamos el promedio
        // Si el resultado es positivo, el giro predominante fue Antihorario
        const avgSign = rotationSigns.reduce((a, b) => a + b, 0) / rotationSigns.length;
        const esAntihorario = avgSign > 0;
        let motivo = "";

        if (rotationCount === 1) {
            // UN SOLO GIRO = Punto para el usuario ('yo')
            // Si giró a la izquierda es Winner, si fue a la derecha es fallo del otro
            motivo = esAntihorario ? "Winner" : "Fallo Rival";
            ejecutarPuntoGesto('yo', motivo);

        } else if (rotationCount >= 2) {
            // DOS O MÁS GIROS = Punto para el contrincante ('rival')
            // Útil para marcar cuando tú has fallado o el otro ha hecho un puntazo
            motivo = esAntihorario ? "Winner" : "Fallo Mío";
            ejecutarPuntoGesto('rival', motivo);
        }

        // Limpiamos los contadores para el próximo punto
        rotationCount = 0;
        rotationSigns = [];

    }, VENTANA_ROTACION);
}

function registrarGolpeTenis(now) {
    // Si detectamos un golpe fuerte de tenis, cancelamos cualquier gesto de rotación a medias
    rotationCount = 0;
    if (rotationTimer) clearTimeout(rotationTimer);

    if (!isPointRunning) {
        pointStartTime = now;
        isPointRunning = true;
    }

    const esValido = capturarMetricas();
    if (!esValido) return; // Ignorar si fue detectado como backswing/preparación

    // Feedback visual móvil
    if (pulseCircle) {
        pulseCircle.classList.add('golpe');
        setTimeout(() => pulseCircle.classList.remove('golpe'), 400);
    }

    currentPointStrokes.push({ ...lastStrokeMetrics });
    socket.emit('nuevo-golpe', lastStrokeMetrics);
}

function capturarMetricas() {
    const power = peakPower;
    let trajectory = 'Plano';

    // 1. ANÁLISIS DE VENTANA (±150ms alrededor del impacto)
    let maxGyroRY = 0;
    let maxGyroRX = 0;
    let azAtImpact = 0;
    const windowMs = 150;

    sensorHistory.forEach(s => {
        if (s.t >= peakTime - windowMs && s.t <= peakTime + windowMs) {
            // Buscamos el valor con mayor magnitud absoluta en ambos ejes
            if (Math.abs(s.ry) > Math.abs(maxGyroRY)) {
                maxGyroRY = s.ry;
            }
            if (Math.abs(s.rx) > Math.abs(maxGyroRX)) {
                maxGyroRX = s.rx;
            }
            // Capturamos el impulso Z en el milisegundo exacto del impacto
            if (Math.abs(s.t - peakTime) < 30) {
                azAtImpact = s.az;
            }
        }
    });

    // Un golpe real de tenis siempre genera una rotación de muñeca mínima
    if (Math.abs(maxGyroRY) < 0.4 && Math.abs(maxGyroRX) < 0.4) {
        return false;
    }

    // DERECHA (impacto pantalla) -> Z positivo potente. REVÉS (impacto trasera o flick suave) -> Z bajo o negativo.
    // Refinamiento v6 (Final): Ajuste fino de bandas para golpes suaves y laterales
    const esReves = azAtImpact <= 3.0;
    const ladoStr = esReves ? "REVÉS" : "DERECHA";

    const scoreLiftado = (-maxGyroRX * 0.7) + (maxGyroRY * 1.3);

    // Solo aplicamos lógica de saque si el sistema indica que sacas "tú"
    if (quienSaca === 'yo') {
        if (!esSegundoSaque && currentPointStrokes.length === 0) {
            trajectory = '1er SAQUE';
        } else if (esSegundoSaque) {
            // Solo clasificamos como 2º saque el primer golpe que se de tras marcar la media
            const yaDioSegundoSaque = currentPointStrokes.some(s => s.trajectory === '2º SAQUE');
            if (!yaDioSegundoSaque) {
                trajectory = '2º SAQUE';
            }
        }
    }

    if (trajectory === 'Plano') { // Si no se ha definido como saque aún...
        // LÓGICA DE TRAYECTORIA (Golpes normales)
        if (esReves) {
            // Backhand (REVÉS)
            if (azAtImpact < -12.0 || maxGyroRX < -4.5) {
                trajectory = 'Plano';
            } else if (maxGyroRX < -2.2) {
                trajectory = 'Topspin (Liftado)';
            } else if (azAtImpact > -4.5 || (azAtImpact > -8.5 && maxGyroRY > 0.5)) {
                trajectory = 'Slice (Cortado)';
            } else {
                trajectory = 'Topspin (Liftado)';
            }
        } else {
            // Forehand (DERECHA)
            if (azAtImpact < 11.5) {
                trajectory = 'Slice (Cortado)';
            } else if (maxGyroRX < -5.0 || scoreLiftado > 2.2) {
                trajectory = 'Topspin (Liftado)';
            } else {
                trajectory = 'Plano';
            }
        }
    }

    // Escalar potencia para ampliar diferencias perceptuales (v11: FULL TURBO - Exp 2.3 * 1.5)
    const powerScaled = (Math.pow(power, 2.3) * 0.25).toFixed(1);

    lastStrokeMetrics = {
        power: powerScaled,
        trajectory: trajectory,
        side: ladoStr
    };

    return true; // Golpe válido
}

function ejecutarPuntoGesto(destino, motivo) {
    if (capturingPeak) {
        // Un golpe se está analizando. Esperamos para que el golpe se registre antes de cerrar el punto.
        setTimeout(() => ejecutarPuntoGesto(destino, motivo), 100);
        return;
    }

    // Feedback visual móvil de puntuación/gesto
    if (pulseCircle) {
        pulseCircle.classList.add('punto');
        setTimeout(() => pulseCircle.classList.remove('punto'), 600);
    }

    // --- LÓGICA DE MEDIA / SEGUNDO SAQUE ---
    // Si el usuario falla su propio saque y es el primero (y no ha habido peloteo)
    const noHayGolpesDeRally = currentPointStrokes.every(s => s.trajectory.includes('SAQUE'));
    if (destino === 'rival' && motivo === 'Fallo Mío' && !esSegundoSaque && quienSaca === 'yo' && noHayGolpesDeRally) {
        esSegundoSaque = true;
        lockGestos = true;

        setTimeout(() => {
            lockGestos = false;
        }, 1500);
        return; // Interrumpimos: no se anota punto
    }

    // Si ya era segundo saque y vuelve a fallar, es Doble Falta
    if (esSegundoSaque && destino === 'rival' && motivo === 'Fallo Mío') {
        // Se considera doble falta si la secuencia de golpes es solo de saques (o vacía)
        const soloSaques = currentPointStrokes.every(s => s.trajectory.includes('SAQUE'));
        if (soloSaques) {
            motivo = "Doble Falta";
        }
    }

    // Resetear estado de saque para el siguiente punto
    esSegundoSaque = false;

    lockGestos = true;
    const pointDuration = (Date.now() - pointStartTime) / 1000;

    socket.emit('anotar-punto', {
        quien: destino,
        metrics: {
            strokes: currentPointStrokes,
            duracion_punto: pointDuration.toFixed(1) + "s",
            motivo: motivo
        }
    });

    golpeCount = 0;
    sequenceStrokes = [];
    currentPointStrokes = [];
    isPointRunning = false;
    if (confirmTimer) clearTimeout(confirmTimer);
    setTimeout(() => { lockGestos = false; }, COOLDOWN_PUNTO);
    setTimeout(() => { lockGestos = false; capturingPeak = false; }, 3000); // Watchdog rescate
}

// --- LÓGICA DE VOZ ---
function activarVoz() {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'es-ES';
        recognition.onend = () => { try { recognition.start(); } catch (e) { } };
        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();

            // ── COMANDOS GLOBALES (funcionan siempre) ──────────────────────────
            if (transcript.includes("silenciar")) { socket.emit('alternar-audio', true); return; }
            if (transcript.includes("activar")) { socket.emit('alternar-audio', false); return; }

            // ── DESDE LOBBY: únicos comandos válidos para cambiar de modo ──────
            if (modoActual === '' || modoActual === 'LOBBY') {
                if (transcript.includes("partido")) { socket.emit('cambiar-modo', 'MODO PARTIDO'); }
                else if (transcript.includes("entrenamiento")) { socket.emit('cambiar-modo', 'MODO ENTRENAMIENTO'); }
                // En lobby no se acepta nada más
                return;
            }

            // ── MODO PARTIDO ───────────────────────────────────────────────────
            if (modoActual === 'MODO PARTIDO') {
                // Definir saque (solo si aún no se ha definido)
                if (!saqueDefinido) {
                    if (transcript === "yo" || transcript.includes(" yo")) { socket.emit('definir-saque', 'yo'); return; }
                    if (transcript === "rival" || transcript.includes("rival")) { socket.emit('definir-saque', 'rival'); return; }
                    if (transcript === "rafa" || transcript.includes("rafa") || transcript.includes("nadal")) {
                        socket.emit('definir-saque', 'Nadal'); return;
                    }
                }

                // Deshacer punto
                if (transcript.includes("deshacer")) { socket.emit('deshacer-punto'); return; }

                // Salir (con confirmación de doble "salir")
                if (transcript.includes("salir") || transcript.includes("volver")) {
                    if (!esperandoConfirmacionSalir) {
                        esperandoConfirmacionSalir = true;
                        socket.emit('solicitar-confirmacion-salir');
                        if (timeoutConfirmacion) clearTimeout(timeoutConfirmacion);
                        timeoutConfirmacion = setTimeout(() => {
                            esperandoConfirmacionSalir = false;
                        }, 10000);
                    } else {
                        // Segunda confirmación con "salir"
                        if (timeoutConfirmacion) clearTimeout(timeoutConfirmacion);
                        esperandoConfirmacionSalir = false;
                        socket.emit('resetear-a-inicio');
                    }
                    return;
                }

                // Confirmación explícita sí/no tras pedir salir
                if (esperandoConfirmacionSalir) {
                    if (transcript.includes("si")) {
                        if (timeoutConfirmacion) clearTimeout(timeoutConfirmacion);
                        esperandoConfirmacionSalir = false;
                        socket.emit('resetear-a-inicio');
                    } else if (transcript.includes("no")) {
                        if (timeoutConfirmacion) clearTimeout(timeoutConfirmacion);
                        esperandoConfirmacionSalir = false;
                    }
                    return;
                }

                // En modo partido NO se aceptan comandos de entrenamiento
                // (partido, entrenamiento, fondo, saque como submodo, línea → ignorados)
                return;
            }

            // ── MODO ENTRENAMIENTO ─────────────────────────────────────────────
            if (modoActual === 'MODO ENTRENAMIENTO') {
                // Reiniciar drill (prioridad alta para no ser bloqueado por submodos)
                if (transcript.includes("reiniciar")) { socket.emit('reiniciar-drill'); return; }

                // Salir/Volver (prioridad alta)
                if (transcript.includes("salir") || transcript.includes("volver")) {
                    if (currentSubModo) {
                        socket.emit('cambiar-submodo', null); // Vuelve a selección dentro de entrenamiento
                    } else {
                        socket.emit('resetear-a-inicio'); // Vuelve al lobby
                    }
                    return;
                }

                if (transcript.includes("fondo")) {
                    if (!currentSubModo) {
                        socket.emit('cambiar-submodo', 'FONDO');
                    }
                    return;
                }
                if (transcript.includes("línea") || transcript.includes("linea")) {
                    if (!currentSubModo) {
                        socket.emit('cambiar-submodo', 'LINEA');
                    }
                    return;
                }
                // "saque" como submodo (cuidado: no confundir con definir saque de partido)
                if (transcript.includes("saque")) {
                    if (!currentSubModo) {
                        socket.emit('cambiar-submodo', 'SAQUE');
                    }
                    return;
                }

                // En entrenamiento NO se acepta "partido" ni comandos de partido
                return;
            }
        };
        recognition.start();
    }
}

// --- LÓGICA DE ENTRENAMIENTO (MEDIAPIPE) ---

async function startTraining() {
    // Solo cargar MediaPipe si NO estamos en modo línea y no está ya cargado
    if (currentSubModo !== 'LINEA' && !poseLandmarker) {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
                delegate: "CPU"
            },
            runningMode: "VIDEO",
            numPoses: 1
        });
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const constraints = {
            video: {
                facingMode: currentFacingMode,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;

        // Usar .onloadeddata para SOBREESCRIBIR y evitar acumulación de listeners
        videoElement.onloadeddata = () => {
            if (requestID) cancelAnimationFrame(requestID);
            predictWebcam();
        };
        webcamRunning = true;
    }
}

function stopTraining() {
    if (webcamRunning) {
        if (requestID) cancelAnimationFrame(requestID);
        requestID = null;
        if (videoElement.srcObject) {
            const stream = videoElement.srcObject;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            videoElement.srcObject = null;
        }
        webcamRunning = false;
    }
}

let lastVideoTime = -1;
let lastFrameSent = 0;
let requestID = null;

async function predictWebcam() {
    // Si la cámara se ha parado o el modo no es entrenamiento, salir definitivamente
    if (!webcamRunning || (modoActual !== 'MODO ENTRENAMIENTO' && !window.debugTraining)) {
        if (requestID) cancelAnimationFrame(requestID);
        requestID = null;
        return;
    }

    let startTimeMs = performance.now();

    // --- NUEVO: ENVÍO DE VIDEO EN TIEMPO REAL ---
    if (startTimeMs - lastFrameSent > 80) {
        sCtx.drawImage(videoElement, 0, 0, smallCanvas.width, smallCanvas.height);
        const imageData = smallCanvas.toDataURL('image/jpeg', 0.6);
        socket.emit('video-frame', imageData);
        lastFrameSent = startTimeMs;
    }
    // --------------------------------------------

    if (lastVideoTime !== videoElement.currentTime) {
        lastVideoTime = videoElement.currentTime;

        // --- OPTIMIZACIÓN: Solo ejecutar MediaPipe si NO es modo LÍNEA ---
        if (poseLandmarker && currentSubModo !== 'LINEA') {
            const result = poseLandmarker.detectForVideo(videoElement, startTimeMs);
            if (result.landmarks && result.landmarks.length > 0) {
                const landmarks = result.landmarks[0];

                // Mapeo explícito para forzar que propiedades como 'visibility' o 'score' se incluyan
                // ya que JSON.stringify a veces las ignora si son no-enumerables.
                const cleanLandmarks = landmarks.map(l => ({
                    x: l.x,
                    y: l.y,
                    z: l.z,
                    visibility: (l.visibility !== undefined) ? l.visibility : (l.score !== undefined ? l.score : 0.9)
                }));

                socket.emit('training-data', {
                    landmarks: cleanLandmarks,
                    timestamp: startTimeMs
                });
            }
        } else if (currentSubModo === 'LINEA') {
            // Heartbeat para mantener vivo el dibujo del dashboard
            socket.emit('training-data', {
                landmarks: [],
                timestamp: startTimeMs
            });
        }
    }
    requestID = window.requestAnimationFrame(predictWebcam);
}

// Reset y Funciones Auxiliares
