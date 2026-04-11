const socket = io();
const estadoLabel = document.getElementById('estado');
const controlesPartido = document.getElementById('controles-partido');
const seccionSaque = document.getElementById('seccion-saque');
const feedbackGesto = document.getElementById('feedback-gesto');
const btnIniciar = document.getElementById('btn-iniciar');
const startOverlay = document.getElementById('start-overlay');
const mobileContent = document.getElementById('mobile-content');

// --- CONFIGURACIÓN DE GESTOS ---
const UMBRAL_GESTO = 18; // Bajado de 22 para detectar slices suaves
const TIEMPO_MIN_ENTRE_GOLPES = 850; // Ajustado para evitar doble conteo en liftados largos
const COOLDOWN_PUNTO = 1500;
const BUFFER_SIZE = 4; // Menos suavizado, picos más reales
const UMBRAL_ROTACION = 5.0; // Incrementado para evitar falsos positivos en golpes planos intensos
const UMBRAL_ROTACION_PUNTO = 10.0; // Giro de muñeca seco para puntuar
const MAX_ACCEL_GESTO = 20.0; // Si te mueves mucho, es un golpe, no un punto
const VENTANA_ROTACION = 1000; // Tiempo para confirmar 1 o 2 giros
const HISTORIAL_MAX_SIZE = 30; // ~500ms a 60Hz para asegurar ventana antes/después

// Estado interno
let saqueDefinido = false;
let quienSaca = ''; // Rastrear quién saca el juego actual
let modoActual = '';
let esSegundoSaque = false;
let lastStrikeTime = 0;
let golpeCount = 0;
let confirmTimer = null;
let lockGestos = false;
let isPointRunning = false;
let sequenceStrokes = []; // Búfer temporal para gestos en curso

// --- MÉTRICAS ---
let pointStartTime = Date.now();
let gameStartTime = Date.now();
let lastStrokeMetrics = {
    power: 0,
    trajectory: 'Plano'
};
let currentPointStrokes = [];

// Sensores adicionales
let gyroSensor = null;

// --- FILTROS Y PROCESAMIENTO ---
const buffers = {
    ax: [], ay: [], az: [], rx: [], ry: []
};

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


// --- INICIO DEL SISTEMA (Interacción Obligatoria) ---
if (btnIniciar) {
    btnIniciar.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        mobileContent.style.display = 'block';

        // 1. Inicializar Sensores
        activarSensores();

        // 2. Inicializar Voz
        activarVoz();
    });
}

// Sincronización Socket.io
socket.on('connect', () => {
    estadoLabel.innerText = "Estado: Conectado (" + socket.id + ")";
    estadoLabel.style.color = "green";
});

socket.on('modo-actualizado', (modo) => {
    estadoLabel.innerText = "Sincronizado en: " + modo;
    modoActual = modo;
    if (modo === 'MODO PARTIDO') {
        if (!saqueDefinido) {
            seccionSaque.style.display = 'block';
            controlesPartido.style.display = 'none';
        } else {
            seccionSaque.style.display = 'none';
            controlesPartido.style.display = 'block';
        }
    } else {
        seccionSaque.style.display = 'none';
        controlesPartido.style.display = 'none';
        saqueDefinido = false;
        esSegundoSaque = false; // Resetear explícitamente al salir de modo partido
    }
});

socket.on('saque-definido', (quien) => {
    saqueDefinido = true;
    quienSaca = quien;
    if (seccionSaque) seccionSaque.style.display = 'none';
    if (controlesPartido) controlesPartido.style.display = 'block';
    gameStartTime = Date.now();
    isPointRunning = false;
    currentPointStrokes = [];
    esSegundoSaque = false;
});

socket.on('punto-registrado', () => {
    isPointRunning = false;
    currentPointStrokes = [];
    esSegundoSaque = false;
});

socket.on('saque-actualizado', (quien) => {
    quienSaca = quien;
    console.log("Saque actualizado automáticamente a: " + quien);
});

socket.on('registrar-fin-juego', (data) => {
    // El servidor nos avisa que el juego terminó, enviamos la duración acumulada
    const duration = (Date.now() - gameStartTime) / 1000;
    socket.emit('registrar-fin-juego', {
        ...data,
        duracion: duration.toFixed(1) + "s"
    });
    gameStartTime = Date.now();
    isPointRunning = false;
});

// --- LÓGICA DE SENSORES ---
function activarSensores() {
    // 1. Acelerómetro (Potencia con Magnitud Vectorial y Moving Average)
    const SensorType = window.LinearAccelerationSensor || window.Accelerometer;
    if (SensorType) {
        try {
            const sensor = new SensorType({ frequency: 60 });
            if (SensorType === window.Accelerometer) {
                console.warn("LinearAccelerationSensor no disponible. Usando Accelerometer (peligro de gravedad).");
            }
            sensor.onreading = () => {
                if (lockGestos || modoActual !== 'MODO PARTIDO' || !saqueDefinido) return;

                // Aplicar Moving Average para suavizar sin retardo excesivo
                currentMA.ax = movingAverage(buffers.ax, sensor.x);
                currentMA.ay = movingAverage(buffers.ay, sensor.y);
                currentMA.az = movingAverage(buffers.az, sensor.z);

                // Magnitud RAW para detectar el pico real de impacto
                rawMag.ax = sensor.x;
                rawMag.ay = sensor.y;
                rawMag.az = sensor.z;
                const rawMagnitude = Math.sqrt(rawMag.ax ** 2 + rawMag.ay ** 2 + rawMag.az ** 2);
                const rawPowerG = rawMagnitude / 9.8;

                const now = Date.now();
                // Magnitud suavizada solo para DETECCIÓN de umbral (evita falsos positivos)
                const magnitude = Math.sqrt(currentMA.ax ** 2 + currentMA.ay ** 2 + currentMA.az ** 2);
                const currentPowerG = rawPowerG; // Potencia = valor RAW para fidelidad

                if (magnitude > UMBRAL_GESTO) {
                    if (now - lastStrikeTime < TIEMPO_MIN_ENTRE_GOLPES) return;

                    if (!capturingPeak) {
                        lastStrikeTime = now;
                        capturingPeak = true;
                        peakPower = currentPowerG;
                        peakTime = now;


                            setTimeout(() => {
                                // Solo registrar si el pico superó un umbral mínimo de impacto real
                                if (peakPower > 1.8) {
                                    registrarGolpeTenis(now);
                                } else {
                                    console.log("Gesto ignorado: potencia insuficiente (" + peakPower.toFixed(2) + "G)");
                                }
                                capturingPeak = false;
                            }, 500); // Más tiempo para capturar el pico real del swing
                    }
                }

                if (capturingPeak) {
                    if (rawPowerG > peakPower) {
                        peakPower = rawPowerG;
                        peakTime = now;
                    }
                }


                sensorHistory.push({
                    t: now,
                    mag: currentPowerG,
                    ax: currentMA.ax,
                    ay: currentMA.ay,
                    az: currentMA.az,
                    rx: currentMA.rx,
                    ry: currentMA.ry
                });
                if (sensorHistory.length > HISTORIAL_MAX_SIZE) sensorHistory.shift();
            };
            sensor.onerror = (event) => console.error("Error sensor:", event.error.name);
            sensor.start();
        } catch (err) { console.error("No se pudo iniciar sensores:", err); }
    }

    // 2. Giroscopio (Trayectorias y Gestos de Rotación)
    if ('Gyroscope' in window) {
        gyroSensor = new Gyroscope({ frequency: 60 });
        gyroSensor.onreading = () => {
            currentMA.rx = movingAverage(buffers.rx, gyroSensor.x);
            currentMA.ry = movingAverage(buffers.ry, gyroSensor.y); // Usado para puntuación

            if (lockGestos || modoActual !== 'MODO PARTIDO' || !saqueDefinido) return;

            const now = Date.now();
            const magnitude = Math.sqrt(currentMA.ax ** 2 + currentMA.ay ** 2 + currentMA.az ** 2);

            // DETECTAR GIRO DE MUÑECA (Solo si no hay mucha aceleración)
            if (Math.abs(currentMA.ry) > UMBRAL_ROTACION_PUNTO && magnitude < MAX_ACCEL_GESTO) {
                if (now - lastRotationPeakTime > 400) { // Cooldown entre picos del mismo giro
                    lastRotationPeakTime = now;
                    gestionarGiroPuntuacion(currentMA.ry);
                }
            }
        };
        gyroSensor.start();
    }

}

function gestionarGiroPuntuacion(val) {
    rotationCount++;
    rotationSigns.push(val);
    if (navigator.vibrate) navigator.vibrate(40);

    feedbackGesto.innerHTML = `<span style="color:cyan">GIRO ${rotationCount} DETECTADO</span>`;

    if (rotationTimer) clearTimeout(rotationTimer);
    rotationTimer = setTimeout(() => {
        // Calcular dirección predominante (promedio de los signos detectados)
        const avgSign = rotationSigns.reduce((a, b) => a + b, 0) / rotationSigns.length;
        const esAntihorario = avgSign > 0;
        let motivo = "";

        if (rotationCount === 1) {
            motivo = esAntihorario ? "Winner" : "Fallo Rival";
            ejecutarPuntoGesto('yo', motivo);
        } else if (rotationCount >= 2) {
            motivo = esAntihorario ? "Winner" : "Fallo Mío";
            ejecutarPuntoGesto('rival', motivo);
        }
        rotationCount = 0;
        rotationSigns = [];
        feedbackGesto.innerText = "";
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

    currentPointStrokes.push({ ...lastStrokeMetrics });

    if (navigator.vibrate) navigator.vibrate([60]);
    const labelFeedback = lastStrokeMetrics.trajectory === 'SAQUE' ? "SAQUE" : "GOLPE";
    mostrarFeedback(labelFeedback, lastStrokeMetrics);
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

    // --- FILTRO DE BACKSWING / PREPARACIÓN ---
    // Un golpe real de tenis siempre genera una rotación de muñeca mínima
    if (Math.abs(maxGyroRY) < 0.4 && Math.abs(maxGyroRX) < 0.4) {
        const msgBackswing = `Gesto ignorado: backswing/preparación detectado (RY=${maxGyroRY.toFixed(2)}, RX=${maxGyroRX.toFixed(2)})`;
        console.log(msgBackswing);
        socket.emit('debug-logs', msgBackswing);
        return false;
    }


    // 2. LÓGICA DE DECISIÓN (Detección Física por Impacto en Eje Z)
    // DERECHA (impacto pantalla) -> Z positivo potente. REVÉS (impacto trasera o flick suave) -> Z bajo o negativo.
    // Refinamiento v6 (Final): Ajuste fino de bandas para golpes suaves y laterales
    const esReves = azAtImpact <= 3.0; 
    const ladoStr = esReves ? "REVÉS" : "DERECHA";

    const scoreLiftado = (-maxGyroRX * 0.7) + (maxGyroRY * 1.3);

    // --- DETECCIÓN DE SAQUE ---
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
    } else {
        // Si saca el rival, nos aseguramos de que ningún golpe sea etiquetado como saque propio
        // (Por defecto trajectory es 'Plano' y entrará en la lógica de golpes normales)
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

    const msgDebug = `[${ladoStr}] Power=${power.toFixed(2)} | Z-Imp=${azAtImpact.toFixed(1)} | RX=${maxGyroRX.toFixed(2)} | RY=${maxGyroRY.toFixed(2)} | Score=${scoreLiftado.toFixed(1)} | Tray=${trajectory}`;
    console.log("DEPURACIÓN GOLPE:", msgDebug);
    socket.emit('debug-logs', msgDebug);

    // Escalar potencia para ampliar diferencias perceptuales (v11: FULL TURBO - Exp 2.3 * 1.5)
    const powerScaled = (Math.pow(power, 2.3) * 1.5).toFixed(1);

    lastStrokeMetrics = {
        power: powerScaled,
        trajectory: trajectory,
        side: ladoStr
    };

    return true; // Golpe válido
}

function mostrarFeedback(titulo, metrics) {
    const power = parseFloat(metrics.power);
    let flashClass = 'flash-abajo'; // Verde (Normal)
    let labelPotencia = 'NORMAL';
    let vibePattern = [80];

    if (power < 15) {
        flashClass = 'flash-control';
        labelPotencia = 'CONTROL';
        vibePattern = [40];
    } else if (power > 100) {
        flashClass = 'flash-extremo';
        labelPotencia = 'EXTREMO (SMASH!)';
        vibePattern = [100, 50, 100, 50, 150]; // Pulso potente
    } else if (power > 50) {
        flashClass = 'flash-potente';
        labelPotencia = 'POTENTE';
        vibePattern = [150];
    }

    feedbackGesto.innerHTML = `
        <span style="font-size: 1.2rem; color: var(--gold)">${labelPotencia}</span><br>
        ${titulo} DETECTADO<br>
        <small>Potencia: ${metrics.power}G | ${metrics.trajectory}</small>
    `;

    if (navigator.vibrate) navigator.vibrate(vibePattern);

    document.body.classList.add(flashClass);
    setTimeout(() => { document.body.classList.remove(flashClass); }, 300);
}

function ejecutarPuntoGesto(destino, motivo) {
    // --- LÓGICA DE MEDIA / SEGUNDO SAQUE ---
    // Si el usuario falla su propio saque y es el primero (y no ha habido peloteo)
    const noHayGolpesDeRally = currentPointStrokes.every(s => s.trajectory.includes('SAQUE'));
    if (destino === 'rival' && motivo === 'Fallo Mío' && !esSegundoSaque && quienSaca === 'yo' && noHayGolpesDeRally) {
        esSegundoSaque = true;
        lockGestos = true;
        feedbackGesto.innerHTML = `<span style="color:var(--gold)">⚠️ MEDIA / 2º SAQUE</span>`;
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        socket.emit('debug-logs', "Estado: 2º SAQUE activado por gesto");
        
        // NO limpiamos golpes, queremos que se acumulen (1er saque + 2º saque + ...)
        
        setTimeout(() => { 
            feedbackGesto.innerText = ""; 
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

    feedbackGesto.innerHTML = `✅ PUNTO PARA: ${destino.toUpperCase()}<br><small>${motivo}</small>`;

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
    setTimeout(() => { feedbackGesto.innerText = ""; lockGestos = false; }, COOLDOWN_PUNTO);
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
            if (transcript.includes("partido")) { socket.emit('cambiar-modo', 'MODO PARTIDO'); }
            else if (transcript.includes("entrenamiento")) { socket.emit('cambiar-modo', 'MODO ENTRENAMIENTO'); }
            else if (transcript.includes("salir")) { socket.emit('resetear-a-inicio'); }
            else if (transcript.includes("silenciar")) { socket.emit('alternar-audio', true); }
            else if (transcript.includes("activar")) { socket.emit('alternar-audio', false); }
            else if (modoActual === 'MODO PARTIDO' && !saqueDefinido) {
                if (transcript === "yo" || transcript.includes(" yo")) { socket.emit('definir-saque', 'yo'); }
                else if (transcript === "rival" || transcript.includes("rival")) { socket.emit('definir-saque', 'rival'); }
            }
        };
        recognition.start();
    }
}

// Reset y Funciones Auxiliares
window.cambiarModo = function (nuevoModo) { socket.emit('cambiar-modo', nuevoModo); };
socket.on('reset-confirmado', () => { window.location.reload(); });
const pingBtn = document.getElementById('pingButton');
if (pingBtn) pingBtn.addEventListener('click', () => { socket.emit('ping', { origen: 'movil', t: Date.now() }); });