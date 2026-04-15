
const socket = io();

// --- REFERENCIAS A LA UI BASE ---
const modoTexto = document.getElementById('modo-texto');
const startOverlay = document.getElementById('start-overlay');
const btnIniciar = document.getElementById('btn-iniciar');
const dashboardContent = document.getElementById('dashboard-content');

// Vistas Principales
const lobbyView = document.getElementById('lobby-view');
const marcadorView = document.getElementById('marcador-view');
const entrenamientoView = document.getElementById('entrenamiento-view');

// Referencias al Marcador y Otros
const avisoPista = document.getElementById('aviso-pista');
const uiPuntos = { yo: document.getElementById('puntos-yo'), rival: document.getElementById('puntos-rival') };
const uiSaque = { yo: document.getElementById('saque-yo'), rival: document.getElementById('saque-rival') };
const uiSets = [
    { yo: document.getElementById('s1-yo'), rival: document.getElementById('s1-rival') },
    { yo: document.getElementById('s2-yo'), rival: document.getElementById('s2-rival') },
    { yo: document.getElementById('s3-yo'), rival: document.getElementById('s3-rival') }
];

// Vista Entrenamiento Detalle
const canvasEntrenamiento = document.getElementById('canvas-entrenamiento');
const ctxEntrenamiento = canvasEntrenamiento ? canvasEntrenamiento.getContext('2d') : null;
const txtAngulo = document.getElementById('txt-angulo');
const feedbackBadge = document.getElementById('feedback-badge');
const angleDisplay = document.getElementById('angle-display');

// Referencias Video Nadal
const nadalOverlay = document.getElementById('nadal-overlay');
const nadalVideo = document.getElementById('nadal-video');

// Estado global del partido
let partido = {
    sets: [0, 0],
    games: [0, 0],
    puntos: [0, 0],
    setScores: [[0, 0], [0, 0], [0, 0]],
    currentSetIndex: 0,
    isTieBreak: false,
    tieBreakPoints: [0, 0],
    isMatchFinished: false,
    quienSaca: null,
    servidorInicialSet: null,
    estaSilenciado: false,
    matchHistory: [], // Registro de todos los puntos
    ultimoIndiceDescanso: 0, // Para calcular deltas
    ultimoIndiceJuegosDescanso: 0, // Para deltas de juegos
    gameHistory: [] // Registro de duraciones de juegos
};

// Referencias Stats Overlay
const statsOverlay = document.getElementById('stats-overlay');

// Variable para el marcador
const labelsPuntos = ["0", "15", "30", "40", "AD"];

// Variables para el entrenamiento
let trainingActive = false;
let subModoTraining = null; // null, 'FONDO' o 'SAQUE'
let isReplaying = false; // Flag para silenciar audio y eventos durante la reconstrucción

// Variables del desafío de 5 golpes (entrenamiento)
let contadorIntentos = 0;
let contadorExitos = 0;
let ultimaDeteccionDrill = 0;
let drillFinalizado = false;

// Variables de precisión (entrenamiento)
let estadoPreparacion = false; // Para detectar ciclo Codo Doblado -> Estirado
let maxAnguloEnSalto = 0;      // Para capturar el mejor ángulo durante todo el saque/golpe
let maxSeparacionEnSalto = 0;  // Para capturar la mejor separación hombro-codo
let serveInProgress = false;    // Para saber cuándo se está realizando un saque alto

// Variables Teachable Machine (modo línea)
let tmModel = null;
let isTMModelLoading = false;
let isProcessingTM = false; // Semáforo para evitar sobrecarga de predicciones
const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/tBz8aUiIP/"; // URL  del modelo TM
let lastFeedbackTime = 0; // Para cooldown de voz
let lastLineState = null; // Cache del último estado del modo LÍNEA: null | 'PISANDO' | 'PERFECTO'

// Función para cargar el modelo TM
async function cargarModeloLinea() {
    if (tmModel || isTMModelLoading) return;
    if (!window.tmImage) {
        console.error("⚠️ Librería Teachable Machine no cargada aún.");
        return;
    }
    try {
        isTMModelLoading = true;
        const modelURL = TM_MODEL_URL + "model.json";
        const metadataURL = TM_MODEL_URL + "metadata.json";
        tmModel = await window.tmImage.load(modelURL, metadataURL);
    } catch (e) {
        console.error("❌ Error al cargar modelo TM:", e);
    } finally {
        isTMModelLoading = false;
    }
}

// Función para reiniciar el drill en el modo entrenamiento
function reiniciarDrill() {
    contadorIntentos = 0;
    contadorExitos = 0;
    drillFinalizado = false;
    ultimaDeteccionDrill = 0;
    estadoPreparacion = false;
    maxAnguloEnSalto = 0;
    maxSeparacionEnSalto = 0;
    serveInProgress = false;
}

// Sincronización de audio
socket.on('audio-actualizado', (silenciar) => {
    partido.estaSilenciado = silenciar;

    const muteIndicator = document.getElementById('mute-indicator');
    if (muteIndicator) {
        muteIndicator.style.display = silenciar ? 'flex' : 'none';
        if (silenciar) muteIndicator.classList.add('muted');
        else muteIndicator.classList.remove('muted');
    }

    if (silenciar) {
        // Un mensaje final antes de callar
        const synth = window.speechSynthesis;
        const ut = new SpeechSynthesisUtterance("Sistema silenciado.");
        ut.lang = 'es-ES';
        synth.speak(ut);
    } else {
        const synth = window.speechSynthesis;
        const ut = new SpeechSynthesisUtterance("Sonido activado.");
        ut.lang = 'es-ES';
        synth.speak(ut);
    }
});

// Inicializa el sistema, limpia el overlay y genera el código QR
if (btnIniciar) {
    btnIniciar.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        dashboardContent.style.display = 'block';

        // El sistema inicia siempre en el Lobby por defecto
        lobbyView.style.display = 'flex';
        marcadorView.style.display = 'none';
        entrenamientoView.style.display = 'none';

        // Generar QR para móvil
        fetch('/ip')
            .then(response => response.json())
            .then(data => {
                const mobileUrl = `http://${data.ip}:3000/mobile.html`;
                const qrContainer = document.getElementById("qrcode");
                qrContainer.innerHTML = ""; // Limpiar previo
                new QRCode(qrContainer, {
                    text: mobileUrl, width: 200, height: 200,
                    colorDark: "#0f172a", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            })
            .catch(err => console.error("Error obteniendo IP:", err));

        hablar("Bienvenido al sistema de Tenis Inteligente. Diga Partido o Entrenamiento para comenzar.");
        recuperarEstadisticas();
    });

    // Auto-inicio tras un RESET (salir)
    if (sessionStorage.getItem('skipStartOverlay') === 'true') {
        sessionStorage.removeItem('skipStartOverlay');
        // Pequeño delay para asegurar que todo cargó
        setTimeout(() => { btnIniciar.click(); }, 300);
    }
}

// Función para resetear el estado del partido, de manera que se pueda volver a jugar
function resetEstadoPartido() {
    partido.sets = [0, 0];
    partido.games = [0, 0];
    partido.puntos = [0, 0];
    partido.setScores = [[0, 0], [0, 0], [0, 0]];
    partido.currentSetIndex = 0;
    partido.isTieBreak = false;
    partido.tieBreakPoints = [0, 0];
    partido.isMatchFinished = false;
    partido.quienSaca = null;            // Asegurar que vuelve a estar nulo
    partido.servidorInicialSet = null;   // Asegurar que vuelve a estar nulo
    partido.matchHistory = [];
    partido.gameHistory = [];
    partido.ultimoIndiceDescanso = 0;
    partido.ultimoIndiceJuegosDescanso = 0;

    // Restaurar nombres originales (por si se activó el Easter Egg de Rafa)
    if (document.getElementById("nombre-yo")) {
        document.getElementById("nombre-yo").innerHTML = 'YO <span class="pelota-saque" id="saque-yo" style="visibility: hidden;">🎾</span>';
        uiSaque.yo = document.getElementById('saque-yo');
    }

    // Detener vídeo de Nadal si estuviera corriendo
    if (nadalOverlay) {
        nadalOverlay.style.display = 'none';
        if (nadalVideo) {
            nadalVideo.pause();
            nadalVideo.currentTime = 0;
        }
    }

    actualizarMarcadorUI();
}

// Función para reconstruir el partido a partir de las estadísticas (para cuando se deshace un punto)
function reconstruirPartido(stats) {
    if (!stats || !stats.points) return;
    const pointsToReplay = stats.points;

    // Preservar quién empezó sacando (del objeto stats o del estado actual)
    const servidorOriginal = stats.servidorInicial || (partido.servidorInicialSet === 0 ? 'yo' : (partido.servidorInicialSet === 1 ? 'rival' : null));

    resetEstadoPartido();

    // Si tenemos servidor definido, restaurarlo antes de procesar puntos
    if (servidorOriginal) {
        if (servidorOriginal === 'Nadal') {
            partido.quienSaca = 0;
            partido.servidorInicialSet = 0;
            document.getElementById("nombre-yo").innerHTML = 'NADAL  <span class="pelota-saque" id="saque-yo" style="visibility: hidden;">🎾</span>';
            uiSaque.yo = document.getElementById('saque-yo');
        } else {
            partido.quienSaca = (servidorOriginal === 'yo') ? 0 : 1;
            partido.servidorInicialSet = partido.quienSaca;
        }
    }

    isReplaying = true;
    pointsToReplay.forEach(p => {
        const payload = {
            quien: p.winner || p.ganador,
            metrics: p.metrics || null
        };
        procesarPunto(payload, true);
    });
    isReplaying = false;

    // Emitir socket para que el servidor actualice también los juegos usando nuestra reconstrucción
    socket.emit('sync-games', partido.gameHistory);

    actualizarMarcadorUI();

    // Al finalizar la re-construcción, verificamos el DOM para reflejar el estado correcto
    setTimeout(() => verificarCambioPista(), 0);

    // Para la duración de los juegos
    if (stats.games) {
        partido.gameHistory = [...stats.games];
    }
}

// Función para recuperar las estadísticas del partido
async function recuperarEstadisticas() {
    try {
        // Hacemos una petición al servidor para obtener las estadísticas
        const response = await fetch('/match-stats');
        const data = await response.json();

        // Actualizamos las estadísticas del partido
        if (data && data.points) {
            partido.matchHistory = data.points;
        }
        if (data && data.games) {
            partido.gameHistory = data.games;
        }
        actualizarMarcadorUI();
    } catch (err) {
        console.error("Error recuperando estadísticas:", err);
    }
}

// Lógica de saque recibida del móvil
socket.on('saque-definido', (quien) => {
    if (quien === 'Nadal') {
        // Easter egg
        hablar("Homenaje a Rafa Nadal activado. El rey de la tierra batida saca para usted.");
        document.getElementById("nombre-yo").innerHTML = 'NADAL  <span class="pelota-saque" id="saque-yo" style="visibility: hidden;">🎾</span>';
        uiSaque.yo = document.getElementById('saque-yo'); // Actualizar referencia del elemento recreado
        partido.quienSaca = 0;
        partido.servidorInicialSet = 0;

        actualizarMarcadorUI();
        setTimeout(() => {
            activarHomenajeNadal();
        }, 5000);
        return;
    }
    // Actualizamos el saque normal
    partido.quienSaca = (quien === 'yo') ? 0 : 1;
    partido.servidorInicialSet = partido.quienSaca;
    actualizarMarcadorUI();
    hablar("Saque inicial definido. Empieza sacando " + (quien === 'yo' ? "usted" : "el rival"));
});

// Función para activar el homenaje a Rafa Nadal
function activarHomenajeNadal() {
    // Reproducir vídeo
    if (nadalOverlay && nadalVideo) {
        nadalOverlay.style.display = 'flex';
        nadalVideo.play();
        // Al terminar el vídeo, ocultar overlay
        nadalVideo.onended = () => {
            nadalOverlay.style.display = 'none';
        };
    }
}

// Función para cambiar el servidor del juego (van alternando)
function cambiarServidorJuego() {
    partido.quienSaca = 1 - partido.quienSaca;
    const quien = (partido.quienSaca === 0) ? 'yo' : 'rival';
    socket.emit('notificar-saque', quien);
}

// Función para verificar el servidor del tie break (aquí la lógica es distinta)
function verificarServidorTieBreak() {
    const totalPuntos = partido.tieBreakPoints[0] + partido.tieBreakPoints[1];
    const baseServer = partido.servidorInicialSet;
    const currentServer = (Math.floor((totalPuntos + 1) / 2) % 2 === 0) ? baseServer : 1 - baseServer;
    partido.quienSaca = currentServer;
    const quien = (partido.quienSaca === 0) ? 'yo' : 'rival';
    socket.emit('notificar-saque', quien);
}

// LÓGICA DE PUNTUACIÓN

socket.on('punto-registrado', (payload) => {
    procesarPunto(payload);
});

socket.on('punto-deshecho', (stats) => {
    reconstruirPartido(stats);
    hablar("Punto deshecho.");
});


// Procesamos el punto con la información que nos ha llegado
function procesarPunto(payload, silent = false) {
    // Si no estamos en modo silencioso, ocultamos el overlay de estadísticas
    if (!silent) {
        statsOverlay.classList.remove('visible');
        document.body.classList.remove('stats-visible');
    }
    // Si el partido ha terminado o no hay saque, no hacemos nada
    if (partido.isMatchFinished || partido.quienSaca === null) return;

    // Obtenemos el ganador y las métricas
    let quien, metrics;
    if (typeof payload === 'string') {
        quien = payload;
        metrics = null;
    } else {
        quien = payload.quien;
        metrics = payload.metrics;
    }

    // Obtenemos el índice del ganador y del perdedor
    const winnerIdx = (quien === 'yo') ? 0 : 1;
    const loserIdx = (quien === 'yo') ? 1 : 0;

    // Si es tie break, anotamos el punto de tie break (ya que va distinto)
    if (partido.isTieBreak) {
        anotarPuntoTieBreak(winnerIdx, loserIdx);
        verificarServidorTieBreak();
    } else {
        anotarPuntoEstandar(winnerIdx, loserIdx);
    }

    // Guardamos el punto en el historial
    partido.matchHistory.push({
        ganador: quien,
        metrics: metrics,
        setIndex: partido.currentSetIndex
    });

    actualizarMarcadorUI();

    // Desacoplar para asegurar que la UI reaccione y los estados sincrónicos estén limpios
    if (!silent) {
        setTimeout(() => verificarCambioPista(), 0);
    } else {
        // En reconstrucción (silent) replicamos la lógica sin mutar la UI, solo para avanzar el índice base de stats
        let esCambio = false;
        if (partido.isTieBreak) {
            // En tie-break: cambia cada 6 puntos
            const totalPuntosTie = partido.tieBreakPoints[0] + partido.tieBreakPoints[1];
            if (totalPuntosTie > 0 && totalPuntosTie % 6 === 0) esCambio = true;
        } else if (partido.puntos[0] === 0 && partido.puntos[1] === 0) {
            // En sets normales: cambia cada 2 juegos
            if (partido.games[0] === 0 && partido.games[1] === 0) {
                // Inicio de un nuevo set
                if (partido.currentSetIndex > 0) {
                    const prevSet = partido.setScores[partido.currentSetIndex - 1];
                    if ((prevSet[0] + prevSet[1]) % 2 !== 0) esCambio = true;
                }
            } else {
                // Durante el transcurso del set
                if ((partido.games[0] + partido.games[1]) % 2 !== 0) esCambio = true;
            }
        }

        // Identificamos si estamos en un momento de pausa (Fin de juego o durante Tie-break)
        const esDescanso = (partido.isTieBreak || (partido.puntos[0] === 0 && partido.puntos[1] === 0));
        if (esCambio && esDescanso) {
            // Verificamos si acabamos de empezar un set
            const setRecienTerminado = (partido.games[0] === 0 && partido.games[1] === 0 && partido.matchHistory.length > 0 && !partido.isTieBreak);
            if (!setRecienTerminado) {
                // Registramos el punto exacto en el historial donde ocurre el descanso
                partido.ultimoIndiceDescanso = partido.matchHistory.length;
                partido.ultimoIndiceJuegosDescanso = partido.gameHistory.length;
            }
        }
    }
};

// Función para anotar un punto estándar (no tie break)
function anotarPuntoEstandar(w, l) {
    // Sigue la lógica del tenis -> 15, 30, 40 (trata las ventajas también), Juego
    if (partido.puntos[w] < 3) {
        partido.puntos[w]++;
        cantarPuntuacion();
    } else if (partido.puntos[w] === 3) {
        if (partido.puntos[l] < 3) {
            ganarJuego(w);
        } else if (partido.puntos[l] === 3) {
            partido.puntos[w] = 4; // AD
            hablar("Ventaja para " + (w === 0 ? "usted" : "el rival"));
        } else if (partido.puntos[l] === 4) {
            partido.puntos[l] = 3;
            hablar("Iguales");
        }
    } else if (partido.puntos[w] === 4) {
        ganarJuego(w);
    }
}

// Función para anotar un punto en tie break (hasta 7 puntos, con diferencia de 2)
function anotarPuntoTieBreak(w, l) {
    partido.tieBreakPoints[w]++;
    cantarPuntuacion();

    if (partido.tieBreakPoints[w] >= 7 && (partido.tieBreakPoints[w] - partido.tieBreakPoints[l] >= 2)) {
        partido.games[w]++;
        partido.setScores[partido.currentSetIndex] = [...partido.games];
        ganarSet(w);
    }
}

// Función para cantar la puntuación
function cantarPuntuacion() {
    const s = partido.quienSaca;
    const r = 1 - s;

    if (partido.isTieBreak) {
        hablar(`${partido.tieBreakPoints[s]} a ${partido.tieBreakPoints[r]}`);
    } else {
        const pS = labelsPuntos[partido.puntos[s]] === "0" ? "Nada" : labelsPuntos[partido.puntos[s]];
        const pR = labelsPuntos[partido.puntos[r]] === "0" ? "Nada" : labelsPuntos[partido.puntos[r]];

        if (pS === pR && pS !== "AD") {
            // Si están iguales
            hablar(pS === "Nada" ? "Nada iguales" : pS + " iguales");
        } else {
            hablar(`${pS} ${pR}`);
        }
    }
}

// Función que trata cuando se gana un juego
function ganarJuego(w) {
    // Actualizamos la puntuación
    partido.games[w]++;
    partido.puntos = [0, 0];
    partido.setScores[partido.currentSetIndex] = [...partido.games];

    // Mandamos los datos al servidor
    const payload = {
        ganador: w === 0 ? 'yo' : 'rival',
        marcador: `${partido.games[0]}-${partido.games[1]}`,
        // No incluimos la duración para que la calcule el móvil
        setIndex: partido.currentSetIndex
    };
    if (!isReplaying) {
        // Enviamos el payload al servidor
        socket.emit('registrar-fin-juego', payload);
    }

    if (!partido.isTieBreak) cambiarServidorJuego(); // Actualizamos quien saca

    const s = partido.quienSaca;
    const r = 1 - s;

    // Anuncio de que ha acabado el juego
    let msg = `Juego ${w === 0 ? "usted" : "rival"}. `;
    if (partido.games[s] === partido.games[r]) {
        msg += `${partido.games[s]} iguales.`;
    } else {
        msg += `${partido.games[s]} ${partido.games[r]}.`;
    }

    hablar(msg);
    checkSetStatus(w);
}

// Cuando se recibe la confirmación de que se ha guardado el juego (con la duración del movil) se guarda todo
socket.on('juego-guardado', (gameData) => {
    partido.gameHistory.push(gameData);

    // Si estamos en descanso pendiente, mostrar ahora
    if (partido.puntos[0] === 0 && partido.puntos[1] === 0) {
        setTimeout(() => {
            verificarCambioPista();
        }, 0);
    }
});
// Comprueba si se ha ganado el set
function checkSetStatus(w) {
    const l = 1 - w;
    const gW = partido.games[w];
    const gL = partido.games[l];

    if (gW >= 6 && (gW - gL >= 2)) {
        ganarSet(w);
    } else if (gW === 7 && gL === 5) {
        ganarSet(w);
    } else if (gW === 6 && gL === 6) {
        partido.isTieBreak = true;
        partido.tieBreakPoints = [0, 0];
        hablar("Empate a seis. Tie break.");
    }
}

// Función que trata cuando se gana un set
function ganarSet(w) {
    // Actualizamos el número de sets ganados
    partido.sets[w]++;

    // Anuncio de que se ha ganado el set
    let msg = `Set ${w === 0 ? "usted" : "rival"}. ${partido.games[0]} ${partido.games[1]}. `;
    if (partido.sets[0] !== 0 || partido.sets[1] !== 0) {
        msg += `${partido.sets[0]} sets a ${partido.sets[1]}.`;
    }

    hablar(msg);

    // Comprueba si se ha ganado el partido
    if (partido.sets[w] === 2) {
        partido.isMatchFinished = true;
        mostrarEstadisticas("Fin del Partido");
        setTimeout(() => {
            hablar(`Partido ${w === 0 ? "usted" : "rival"}.`);
        }, 1000);
    } else {
        mostrarEstadisticas("Fin del Set " + (partido.currentSetIndex + 1));
        partido.currentSetIndex++;
        partido.games = [0, 0];
        partido.isTieBreak = false;
        cambiarServidorJuego();
    }
}

// Actualiza la UI del marcador
function actualizarMarcadorUI() {
    // Actualiza los puntos
    if (partido.isTieBreak) {
        uiPuntos.yo.innerText = partido.tieBreakPoints[0];
        uiPuntos.rival.innerText = partido.tieBreakPoints[1];
    } else {
        uiPuntos.yo.innerText = labelsPuntos[partido.puntos[0]];
        uiPuntos.rival.innerText = labelsPuntos[partido.puntos[1]];
    }
    // Actualiza los sets
    partido.setScores.forEach((score, idx) => {
        if (uiSets[idx]) {
            uiSets[idx].yo.innerText = score[0];
            uiSets[idx].rival.innerText = score[1];
        }
    });
    // Actualiza quien saca
    if (partido.quienSaca !== null) {
        uiSaque.yo.style.visibility = (partido.quienSaca === 0) ? 'visible' : 'hidden';
        uiSaque.rival.style.visibility = (partido.quienSaca === 1) ? 'visible' : 'hidden';
    }
}

// Verifica si toca cambiar de pista
function verificarCambioPista() {
    let esCambio = false;

    if (partido.isTieBreak) {
        // En tie-break: cambia cada 6 puntos
        const totalPuntosTie = partido.tieBreakPoints[0] + partido.tieBreakPoints[1];
        if (totalPuntosTie > 0 && totalPuntosTie % 6 === 0) {
            esCambio = true;
        }
    } else {
        // En juego normal, chequear si estamos entre juegos
        if (partido.puntos[0] === 0 && partido.puntos[1] === 0) {
            // Si games =[0,0] significa que acabamos de terminar un set o empezamos el partido
            if (partido.games[0] === 0 && partido.games[1] === 0) {
                if (partido.currentSetIndex > 0) {
                    const prevSet = partido.setScores[partido.currentSetIndex - 1];
                    const juegosPrev = prevSet[0] + prevSet[1];
                    if (juegosPrev % 2 !== 0) {
                        esCambio = true;
                    }
                }
            } else {
                // En medio del set, tomamos los juegos actuales del set
                const totalJuegosEnSet = partido.games[0] + partido.games[1];
                if (totalJuegosEnSet % 2 !== 0) {
                    esCambio = true;
                }
            }
        }
    }

    if (esCambio) {
        avisoPista.style.display = 'block';
    } else if (partido.puntos[0] !== 0 || partido.puntos[1] !== 0) {
        avisoPista.style.display = 'none';
    }

    // 
    const esDescanso = (partido.isTieBreak || (partido.puntos[0] === 0 && partido.puntos[1] === 0));

    if (esCambio && esDescanso) {
        // Evitar pisar la pantalla de "Fin del Set" que ya muestra stats
        const setRecienTerminado = (partido.games[0] === 0 && partido.games[1] === 0 && partido.matchHistory.length > 0 && !partido.isTieBreak);
        if (!setRecienTerminado) {
            mostrarEstadisticas("Descanso de Pista");
        }
    }
}

// Estadísticas
function calcularEstadisticas(rangoPuntos, rangoJuegos = []) {
    let stats = {
        winners: { total: 0, der: 0, rev: 0, tipos: {} },
        errors: { total: 0, der: 0, rev: 0, tipos: {} },
        serves: { firstIn: 0, firstTotal: 0, aces: 0, doubleFaults: 0 },
        power: { sum: 0, count: 0, max: 0, maxDetail: "" },
        time: { pointSum: 0, pointCount: 0, gameSum: 0, gameCount: 0 }
    };

    rangoPuntos.forEach(p => {
        const m = p.metrics;
        if (!m) return;

        // Tiempos
        const dur = parseFloat(m.duracion_punto);
        if (!isNaN(dur)) {
            stats.time.pointSum += dur;
            stats.time.pointCount++;
        }

        // Saque
        if (p.ganador === 'yo') {
            const esAce = m.motivo === 'Winner'
                && m.strokes
                && m.strokes.length > 0
                && m.strokes.some(s => s.trajectory?.includes('SAQUE'))
                && !m.strokes.some(s => !s.trajectory?.includes('SAQUE'));
            if (esAce) stats.serves.aces++;
        }
        if (p.ganador === 'rival' && m.motivo === 'Doble Falta') {
            stats.serves.doubleFaults++;
        }

        let isMyServe = false;
        if (m.motivo === 'Doble Falta' && p.ganador === 'rival') {
            isMyServe = true;
        } else if (m.strokes && m.strokes.length > 0) {
            if (m.strokes[0].trajectory && m.strokes[0].trajectory.includes('SAQUE')) {
                isMyServe = true;
            }
        }

        if (isMyServe) {
            stats.serves.firstTotal++;
            const huboSegundo = m.strokes ? m.strokes.some(s => s.trajectory === '2º SAQUE') : false;
            if (!huboSegundo) {
                stats.serves.firstIn++;
            }
        }

        // Potencia y Golpes
        if (m.strokes) {
            m.strokes.forEach(s => {
                const pwr = parseFloat(s.power);
                stats.power.sum += pwr;
                stats.power.count++;
                if (pwr > stats.power.max) {
                    stats.power.max = pwr;
                    const isServe = s.trajectory && s.trajectory.includes('SAQUE');
                    stats.power.maxDetail = isServe ? s.trajectory : `${s.side} ${s.trajectory}`;
                }
            });
        }

        // Clasificación Winners / Errores (Solo para 'Yo')
        if (m.motivo === 'Winner' && p.ganador === 'yo') {
            stats.winners.total++;
            const last = m.strokes ? m.strokes[m.strokes.length - 1] : null;
            if (last) {
                const isServe = last.trajectory && last.trajectory.includes('SAQUE');
                if (!isServe) {
                    if (last.side === 'DERECHA') stats.winners.der++;
                    else stats.winners.rev++;
                }
                const key = isServe ? last.trajectory : `${last.side} ${last.trajectory}`;
                stats.winners.tipos[key] = (stats.winners.tipos[key] || 0) + 1;
            }
        } else if (m.motivo === 'Fallo Mío' && p.ganador === 'rival') {
            stats.errors.total++;
            const last = m.strokes ? m.strokes[m.strokes.length - 1] : null;
            if (last) {
                const isServe = last.trajectory && last.trajectory.includes('SAQUE');
                if (!isServe) {
                    if (last.side === 'DERECHA') stats.errors.der++;
                    else stats.errors.rev++;
                }
                const key = isServe ? last.trajectory : `${last.side} ${last.trajectory}`;
                stats.errors.tipos[key] = (stats.errors.tipos[key] || 0) + 1;
            }
        }
    });

    // Juegos
    rangoJuegos.forEach(g => {
        const dur = parseFloat(g.duracion);
        if (!isNaN(dur)) {
            stats.time.gameSum += dur;
            stats.time.gameCount++;
        }
    });

    return stats;
}

// Mostrar estadísticas
function mostrarEstadisticas(titulo) {
    const globalHistory = partido.matchHistory;
    const globalGameHistory = partido.gameHistory;
    let currentPoints = [];
    let baselinePoints = null;
    let currentGames = [];
    let baselineGames = null;
    const isSetSummary = titulo.startsWith("Fin del Set") || titulo === "Fin del Partido";
    // Solo mostramos deltas si no es un resumen de set/partido y si no es el primer descanso del partido
    const mostrarDeltas = !isSetSummary && partido.ultimoIndiceDescanso > 0;

    if (isSetSummary) {
        const match = titulo.match(/Fin del Set (\d+)/);
        if (match) {
            const setIndexComp = parseInt(match[1]) - 1;
            currentPoints = globalHistory.filter(p => p.setIndex === setIndexComp);
            currentGames = globalGameHistory.filter(g => g.setIndex === setIndexComp);
            if (setIndexComp > 0) {
                baselinePoints = globalHistory.filter(p => p.setIndex < setIndexComp);
                baselineGames = globalGameHistory.filter(g => g.setIndex < setIndexComp);
            }
        } else {
            // Fin del Partido -> todos los puntos
            currentPoints = globalHistory;
            currentGames = globalGameHistory;
        }
    } else {
        // Descanso de Pista -> último tramo vs lo jugado anteriormente
        currentPoints = globalHistory.slice(partido.ultimoIndiceDescanso);
        currentGames = globalGameHistory.slice(partido.ultimoIndiceJuegosDescanso);
        if (currentPoints.length === 0) return; // Evita errores de slice vacío

        // El baseline es todo el historial para una media global estable del partido
        baselinePoints = globalHistory;
        baselineGames = globalGameHistory;

        partido.ultimoIndiceDescanso = globalHistory.length;
        partido.ultimoIndiceJuegosDescanso = globalGameHistory.length;
    }

    const statsCurrent = calcularEstadisticas(currentPoints, currentGames);
    const statsBaseline = baselinePoints ? calcularEstadisticas(baselinePoints, baselineGames) : null;

    document.getElementById('stats-moment').innerText = titulo;

    // Helper de deltas
    const getDelta = (curr, baseline) => {
        const b = parseFloat(baseline);
        const c = parseFloat(curr) || 0;

        // Si el baseline es 0 pero hay valor actual, es un incremento infinito pero lo mostramos como 100% de tendencia positiva
        if (!b || isNaN(b) || !isFinite(b)) {
            return c > 0 ? 100 : 0;
        }

        const res = ((c - b) / b * 100);
        // Devolvemos 1 decimal si el cambio es pequeño, sino redondeado
        return Math.abs(res) < 10 && res !== 0 ? res.toFixed(1) : res.toFixed(0);
    };

    const formatDelta = (delta, inverse = false) => {
        const numDelta = parseFloat(delta);
        if (isNaN(numDelta) || numDelta === 0) return ""; // No mostrar si es 0 exacto o inválido

        // Mostramos en rojo o en verde dependiendo de si es bueno o no
        let colorClass = "";
        if (numDelta > 0) colorClass = inverse ? 'negative' : 'positive';
        else if (numDelta < 0) colorClass = inverse ? 'positive' : 'negative';

        let displayDelta = delta.toString().replace(/\.0$/, '');
        return ` <small class="delta ${colorClass}">(${numDelta > 0 ? '+' : ''}${displayDelta}%)</small>`;
    };

    // Todos los deltas que vamos a mostrar
    let deltaWinners = "";
    let deltaErrors = "";
    let deltaAces = "";
    let deltaDF = "";
    let deltaServe = "";
    let deltaPwr = "";
    let deltaPointTime = "";
    let deltaGameTime = "";

    // Cálculos adicionales
    const firstServePct = statsCurrent.serves.firstTotal > 0 ? (statsCurrent.serves.firstIn / statsCurrent.serves.firstTotal * 100).toFixed(0) : 0;
    const avgPwr = statsCurrent.power.count > 0 ? (statsCurrent.power.sum / statsCurrent.power.count).toFixed(1) : 0;
    const avgPointTime = statsCurrent.time.pointCount > 0 ? (statsCurrent.time.pointSum / statsCurrent.time.pointCount).toFixed(1) : 0;
    const avgGameTime = statsCurrent.time.gameCount > 0 ? (statsCurrent.time.gameSum / statsCurrent.time.gameCount).toFixed(1) : 0;

    if (mostrarDeltas && statsBaseline) {
        // Cálculo de deltas
        const normalizationFactor = (baselinePoints.length / (currentPoints.length || 1)) || 1;

        const normalizedBaselineWinners = statsBaseline.winners.total / normalizationFactor;
        deltaWinners = formatDelta(getDelta(statsCurrent.winners.total, normalizedBaselineWinners), false);

        const normalizedBaselineErrors = statsBaseline.errors.total / normalizationFactor;
        deltaErrors = formatDelta(getDelta(statsCurrent.errors.total, normalizedBaselineErrors), true);

        const normalizedBaselineAces = statsBaseline.serves.aces / normalizationFactor;
        deltaAces = formatDelta(getDelta(statsCurrent.serves.aces, normalizedBaselineAces), false);

        const normalizedBaselineDF = statsBaseline.serves.doubleFaults / normalizationFactor;
        deltaDF = formatDelta(getDelta(statsCurrent.serves.doubleFaults, normalizedBaselineDF), true);

        if (statsBaseline.serves.firstTotal > 0) {
            const currP = parseFloat(firstServePct);
            const baselineP = (statsBaseline.serves.firstIn / statsBaseline.serves.firstTotal * 100);
            const diff = (currP - baselineP).toFixed(1).replace(/\.0$/, '');
            if (diff !== "0") {
                deltaServe = ` <small class="delta ${diff > 0 ? 'positive' : 'negative'}">(${diff > 0 ? '+' : ''}${diff}%)</small>`;
            }
        }

        if (statsBaseline.power.count > 0) {
            const globAvgPwr = statsBaseline.power.sum / statsBaseline.power.count;
            deltaPwr = formatDelta(getDelta(avgPwr, globAvgPwr), false);
        }

        if (statsBaseline.time.pointCount > 0) {
            const globAvgPointTime = statsBaseline.time.pointSum / statsBaseline.time.pointCount;
            deltaPointTime = formatDelta(getDelta(avgPointTime, globAvgPointTime), true);
        }

        if (statsBaseline.time.gameCount > 0) {
            const globAvgGameTime = statsBaseline.time.gameSum / statsBaseline.time.gameCount;
            deltaGameTime = formatDelta(getDelta(avgGameTime, globAvgGameTime), true);
        }
    }

    // Ayudante para actualizar valores con delta opcional
    const updateStat = (id, value, deltaHTML) => {
        const el = document.getElementById(id);
        if (!el) return;
        const valEl = el.classList.contains('value') ? el : el.querySelector('.value');
        if (valEl) {
            valEl.innerHTML = `${value}${mostrarDeltas ? deltaHTML : ''}`;
        }
    };

    // Renderizado

    // BLOQUE ATAQUE
    updateStat('stat-winners', statsCurrent.winners.total, deltaWinners);
    document.getElementById('sub-win-der').innerText = statsCurrent.winners.der;
    document.getElementById('sub-win-rev').innerText = statsCurrent.winners.rev;

    // BLOQUE ERRORES  
    updateStat('stat-errors', statsCurrent.errors.total, deltaErrors);
    document.getElementById('sub-err-der').innerText = statsCurrent.errors.der;
    document.getElementById('sub-err-rev').innerText = statsCurrent.errors.rev;

    // BLOQUE SAQUE Y POTENCIA
    updateStat('stat-aces', statsCurrent.serves.aces, deltaAces);
    updateStat('stat-double-faults', statsCurrent.serves.doubleFaults, deltaDF);
    updateStat('stat-first-serve', firstServePct + '%', deltaServe);
    updateStat('stat-power-avg', avgPwr + 'G', deltaPwr);

    // Tiempos
    const elPointTime = document.getElementById('stat-avg-point-time');
    if (elPointTime) {
        elPointTime.innerHTML = `${avgPointTime}s${mostrarDeltas ? deltaPointTime : ''}`;
    }
    const elGameTime = document.getElementById('stat-avg-game-time');
    if (elGameTime) {
        elGameTime.innerHTML = `${avgGameTime}s${mostrarDeltas ? deltaGameTime : ''}`;
    }

    // Potencia Máxima
    document.getElementById('stat-power-max').innerText = statsCurrent.power.max + "G";
    document.getElementById('stat-power-max-desc').innerText = statsCurrent.power.maxDetail || "--";

    // DESGLOSE DE GOLPES (Listado)
    const formatTipos = (tipos) => {
        return Object.entries(tipos)
            .sort((a, b) => b[1] - a[1]) // Ordenar por frecuencia
            .map(([tipo, count]) => `<div style="display:flex; justify-content:space-between; margin-bottom:6px; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px;">
                <span style="color: white; font-weight: 500;">${tipo}</span>
                <span style="font-weight:700; color:var(--accent);">${count}</span>
            </div>`)
            .join('');
    };

    document.getElementById('winner-types').innerHTML = formatTipos(statsCurrent.winners.tipos);
    document.getElementById('error-types').innerHTML = formatTipos(statsCurrent.errors.tipos);

    // Mostrar Overlay
    statsOverlay.classList.add('visible');
    document.body.classList.add('stats-visible');
}

// Sincronización de estados y visibilidad de vistas
socket.on('modo-actualizado', (modo) => {
    if (modoTexto) modoTexto.innerText = modo;
    trainingActive = (modo === "MODO ENTRENAMIENTO");

    if (modo === "MODO PARTIDO") {
        document.body.classList.add('match-active');
        lobbyView.style.display = 'none';
        marcadorView.style.display = 'block';
        entrenamientoView.style.display = 'none';

        if (partido.quienSaca === null) {
            hablar("Modo partido activado. Antes de comenzar diga quien va a empezar sacando");
        }
    } else if (modo === "MODO ENTRENAMIENTO") {
        document.body.classList.remove('match-active');
        lobbyView.style.display = 'none';
        marcadorView.style.display = 'none';
        entrenamientoView.style.display = 'flex';
        hablar("Modo entrenamiento activado. Seleccione que quiere entrenar.");
        dibujarPantallaSeleccionEntrenamiento();

        // Ocultar extras inicialmente en la selección
        if (angleDisplay) angleDisplay.style.display = 'none';
        if (feedbackBadge) feedbackBadge.style.display = 'none';
    } else {
        // MODO DASHBOARD / LOBBY
        document.body.classList.remove('match-active');
        lobbyView.style.display = 'flex';
        marcadorView.style.display = 'none';
        entrenamientoView.style.display = 'none';

        // Resetar estados locales
        resetEstadoPartido();
        reiniciarDrill();
        hablar("Volviendo al menú principal.");
    }
});
socket.on('solicitar-confirmacion-salir', () => {
    hablar("¿Seguro que desea salir del partido? Diga salir para confirmar");
});

// Función para hablar
function hablar(mensaje) {
    if (partido.estaSilenciado || isReplaying) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-ES';
    synth.speak(utterance);
}

// Lógica de entrenamiento recibida del móvil
function dibujarPantallaSeleccionEntrenamiento() {
    if (!ctxEntrenamiento) return;

    // Asegurar dimensiones
    if (canvasEntrenamiento.offsetWidth > 0) {
        canvasEntrenamiento.width = canvasEntrenamiento.offsetWidth;
        canvasEntrenamiento.height = canvasEntrenamiento.offsetHeight;
    }

    // Limpiamos el canvas
    ctxEntrenamiento.clearRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);
    ctxEntrenamiento.fillStyle = "#111";
    ctxEntrenamiento.fillRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);

    // Dibujamos el texto
    ctxEntrenamiento.fillStyle = "white";
    ctxEntrenamiento.textAlign = "center";
    ctxEntrenamiento.font = "bold 34px Arial";
    ctxEntrenamiento.fillText("MODO ENTRENAMIENTO", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 - 40);

    // Color de acento
    const accentCol = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#fbbf24';
    ctxEntrenamiento.font = "26px Arial";
    ctxEntrenamiento.fillStyle = accentCol;
    ctxEntrenamiento.fillText("DI 'FONDO', 'SAQUE' O 'LÍNEA' EN EL MÓVIL", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 + 20);

    // Texto de ayuda
    ctxEntrenamiento.fillStyle = "#888";
    ctxEntrenamiento.font = "18px Arial";
    ctxEntrenamiento.fillText("(La cámara se activará al elegir modo)", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 + 60);

    ctxEntrenamiento.textAlign = "start"; // Reset
}

// Variable para guardar el último frame recibido (siempre contiene una imagen lista)
let ultimoFrameVideo = new Image();

socket.on('render-video', (frameData) => {
    // Doble buffer: cargar en una imagen temporal y sólo actualizar ultimoFrameVideo cuando esté completamente decodificada.
    const tmpImg = new Image();
    tmpImg.onload = () => {
        ultimoFrameVideo = tmpImg;
    };
    tmpImg.src = frameData;
});


// Función auxiliar para obtener visibilidad de forma robusta
function getVisibility(p) {
    if (!p) return 0;
    return p.visibility !== undefined ? p.visibility : (p.score !== undefined ? p.score : 0);
}

socket.on('training-data', (data) => {
    if (!ctxEntrenamiento || !trainingActive) return;

    // DIAGNÓSTICO EN PANTALLA
    const debugDiv = document.getElementById('debug-datos');
    if (debugDiv && data.landmarks && data.landmarks.length > 0) {
        // Obtenemos puntos de referencia clave (ej. hombros 11 y 12) para validar presencia
        const hR = data.landmarks[12] || {};
        const hL = data.landmarks[11] || {};
        const visR = getVisibility(hR);
        const visL = getVisibility(hL);
        // Si ambos hombros son visibles, el jugador está posicionado, si no, está buscando jugador
        const status = (visR > 0.1 && visL > 0.1) ? 'POSICIONADO' : 'BUSCANDO JUGADOR...';
        debugDiv.innerHTML = `STATUS: ${status}<br><b>MODO: ${subModoTraining}</b>`;
        debugDiv.style.color = (status === 'POSICIONADO') ? 'lime' : 'orange';
    }

    // Asegurar dimensiones correctas una sola vez
    if (canvasEntrenamiento.offsetWidth > 0 &&
        canvasEntrenamiento.width !== canvasEntrenamiento.offsetWidth) {
        canvasEntrenamiento.width = canvasEntrenamiento.offsetWidth;
        canvasEntrenamiento.height = canvasEntrenamiento.offsetHeight;
    }

    const landmarks = data.landmarks;
    if (landmarks && landmarks.length > 0) {
        // Inicialización forzada de dimensiones si el canvas está en 0
        if (canvasEntrenamiento.width === 0 || canvasEntrenamiento.height === 0) {
            canvasEntrenamiento.width = canvasEntrenamiento.offsetWidth || 800;
            canvasEntrenamiento.height = canvasEntrenamiento.offsetHeight || 600;
        }
    } else if (subModoTraining !== 'LINEA') {
        // Solo cortamos si no hay landmarks Y no estamos en modo línea
        return;
    }

    // Limpiar el frame anterior antes de redibujar
    ctxEntrenamiento.clearRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);

    // PANTALLA DE SELECCIÓN INICIAL
    if (!subModoTraining) {
        dibujarPantallaSeleccionEntrenamiento();
        return;
    }

    // Dibujar vídeo si está disponible (solo si hay modo seleccionado)
    if (ultimoFrameVideo.src && ultimoFrameVideo.naturalWidth > 0) {
        ctxEntrenamiento.globalAlpha = 0.6;
        ctxEntrenamiento.drawImage(ultimoFrameVideo, 0, 0,
            canvasEntrenamiento.width, canvasEntrenamiento.height);
        ctxEntrenamiento.globalAlpha = 1.0;
    }

    // RENDERIZADO DE SKELETON Y ANÁLISIS
    dibujarPose(ctxEntrenamiento, landmarks);

    // PANTALLA DE FINALIZACIÓN (Overlay de Resultados)
    if (drillFinalizado) {
        ctxEntrenamiento.fillStyle = "rgba(0,0,0,0.85)";
        ctxEntrenamiento.fillRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);
        ctxEntrenamiento.fillStyle = "gold";
        ctxEntrenamiento.textAlign = "center";
        ctxEntrenamiento.font = "bold 42px Arial";
        ctxEntrenamiento.fillText("SERIE COMPLETADA", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 - 20);
        ctxEntrenamiento.fillStyle = "white";
        ctxEntrenamiento.font = "32px Arial";
        // Resultado
        ctxEntrenamiento.fillText(`RESULTADO: ${contadorExitos} de 5 perfectos`, canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 + 40);
        ctxEntrenamiento.textAlign = "start";
        return;
    }

    if (subModoTraining === 'FONDO') {
        // Hombro (12), Codo (14), Muñeca (16) y Cadera (24) para calcular ángulos de brazo y tronco.
        const h = landmarks[12], c = landmarks[14], m = landmarks[16], hip = landmarks[24];

        // Validación de visibilidad mínima para evitar saltos o detecciones fantasma
        if (h && c && m && hip && getVisibility(h) > 0.1 && getVisibility(c) > 0.1 && getVisibility(m) > 0.1) {
            // Cálculo de métricas
            const anguloCodo = calcularAngulo(h, c, m);
            const separacionHombro = calcularAngulo(hip, h, c);
            const now = Date.now();

            // Umbrales de movimiento
            const prepThreshold = 115; // Codo flexionado (Carga del golpe)
            const impactThreshold = 145; // Codo extendido (Punto de impacto)

            // Detección de Preparación (Codo doblado)
            if (anguloCodo < prepThreshold) {
                estadoPreparacion = true;
                maxAnguloEnSalto = 0;
                maxSeparacionEnSalto = 0;
            }

            // Detección de Impacto
            if (estadoPreparacion && anguloCodo >= impactThreshold && now - ultimaDeteccionDrill > 1500) {
                contadorIntentos++;
                ultimaDeteccionDrill = now;
                estadoPreparacion = false;

                // Guardamos el pico alcanzado en este golpe exacto
                const extensionFinal = Math.max(anguloCodo, maxAnguloEnSalto);
                const separacionFinal = Math.max(separacionHombro, maxSeparacionEnSalto);

                // Exito balanceado: brazo un poco separado (27) y extensión decente (145)
                const esExito = (extensionFinal >= 145 && separacionFinal >= 27);
                if (esExito) contadorExitos++;

                // Gestión de fin de serie (5 intentos)
                if (contadorIntentos >= 5) {
                    drillFinalizado = true;
                    hablar(`Serie terminada. Resultado: ${contadorExitos} de cinco.`);
                } else {
                    hablar(`Golpe ${contadorIntentos} de 5.`);
                }
            }

            // Mientras el usuario prepara el golpe, registramos el máximo alcanzado para el análisis posterior.
            if (estadoPreparacion) {
                if (anguloCodo > maxAnguloEnSalto) maxAnguloEnSalto = anguloCodo;
                if (separacionHombro > maxSeparacionEnSalto) maxSeparacionEnSalto = separacionHombro;
            }

            // Feedback Visual
            let mensaje = "";
            let color = "white";

            const okExtension = (anguloCodo >= 145);
            const okSeparacion = (separacionHombro >= 27);

            if (okExtension && okSeparacion) {
                mensaje = "¡PERFECTO!";
                color = "#00FF00"; // Verde
            } else if (okExtension && !okSeparacion) {
                mensaje = "ESTIRADO, PERO SEPARA CODO";
                color = "#FFA500"; // Naranja
            } else if (anguloCodo > 130) {
                mensaje = "GOLPEANDO...";
                color = "#FFFF00"; // Amarillo
            } else {
                mensaje = "PREPARANDO...";
                color = "white";
            }

            // Dibujamos el feedback visual
            ctxEntrenamiento.fillStyle = color;
            ctxEntrenamiento.font = "bold 34px Arial";
            ctxEntrenamiento.fillText(mensaje, 50, 80);

            ctxEntrenamiento.fillStyle = "white";
            ctxEntrenamiento.font = "24px Arial";
            ctxEntrenamiento.fillText(`GOLPE ${contadorIntentos}/5 | ÉXITOS: ${contadorExitos}`, 50, 120);

            ctxEntrenamiento.font = "14px Arial";
            ctxEntrenamiento.fillStyle = "#888";

            // Círculo de preparación
            if (estadoPreparacion) {
                ctxEntrenamiento.beginPath();
                ctxEntrenamiento.arc(30, 70, 8, 0, Math.PI * 2);
                ctxEntrenamiento.fillStyle = "cyan";
                ctxEntrenamiento.fill();
            }

            // Actualizar el valor numérico en la interfaz HTML
            txtAngulo.innerText = Math.round(anguloCodo) + "°";
        }
    } else if (subModoTraining === 'SAQUE') {
        // Hombro (12), Codo (14), Muñeca (16) y Oreja (8) para calcular el ángulo del brazo y la posición de la mano.
        const hR = landmarks[12], eR = landmarks[14], wR = landmarks[16], orejaR = landmarks[8];

        // Validación de visibilidad de los puntos críticos del brazo ejecutor
        if (hR && eR && wR && orejaR && getVisibility(hR) > 0.1 && getVisibility(wR) > 0.1) {
            // Cálculo del ángulo de apertura del codo
            const anguloCodo = calcularAngulo(hR, eR, wR);

            // Detectar inicio del saque (Mano por encima de la cabeza)
            if (wR.y < orejaR.y) {
                if (!serveInProgress) {
                    serveInProgress = true;
                    maxAnguloEnSalto = 0;
                }
                // Monitorizar el mejor ángulo alcanzado en toda la fase alta
                if (anguloCodo > maxAnguloEnSalto) {
                    maxAnguloEnSalto = anguloCodo;
                }
            }

            // Detectar fin del saque (Mano baja del hombro)
            if (serveInProgress && wR.y > hR.y) {
                contadorIntentos++;
                const esExito = maxAnguloEnSalto > 165;
                if (esExito) contadorExitos++;

                if (contadorIntentos >= 5) {
                    drillFinalizado = true;
                    hablar(`Saque finalizado. Resultado: ${contadorExitos} de 5.`);
                } else {
                    hablar(`Saque ${contadorIntentos} de 5.`);
                }

                serveInProgress = false;
                maxAnguloEnSalto = 0;
            }

            // Feedback Visual (Tiempo Real)
            ctxEntrenamiento.fillStyle = "white";
            ctxEntrenamiento.font = "bold 30px Arial";
            ctxEntrenamiento.fillText(`SAQUE ${contadorIntentos}/5 | ÉXITOS: ${contadorExitos}`, 60, 80);

            if (serveInProgress) {
                ctxEntrenamiento.fillStyle = (maxAnguloEnSalto > 165) ? "lime" : "yellow";
                ctxEntrenamiento.font = "24px Arial";
                ctxEntrenamiento.fillText(maxAnguloEnSalto > 165 ? "¡MÁXIMA EXTENSIÓN!" : "ESTIRA MÁS EL BRAZO", 60, 120);
                ctxEntrenamiento.font = "18px Arial";
                ctxEntrenamiento.fillText(`Mejor ángulo: ${Math.round(maxAnguloEnSalto)}°`, 60, 150);
            } else {
                ctxEntrenamiento.font = "20px Arial";
                ctxEntrenamiento.fillText("Preparado para el impacto...", 60, 120);
            }
        }
        txtAngulo.innerText = "--";
    } else if (subModoTraining === 'LINEA') {
        // Teachable machine

        // Dibuja los mensajes de advertencia o éxito sobre el canvas.
        const drawLineState = (state) => {
            ctxEntrenamiento.textAlign = "center";
            if (state === 'PISANDO') {
                ctxEntrenamiento.fillStyle = "rgba(255, 0, 0, 0.3)";
                ctxEntrenamiento.fillRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);
                ctxEntrenamiento.fillStyle = "#ff4444";
                ctxEntrenamiento.font = "bold 70px Arial";
                ctxEntrenamiento.fillText("PISANDO L\u00CDNEA", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2);
            } else if (state === 'PERFECTO') {
                ctxEntrenamiento.fillStyle = "#00FF00";
                ctxEntrenamiento.font = "bold 70px Arial";
                ctxEntrenamiento.fillText("PERFECTO", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2);
            }
            ctxEntrenamiento.textAlign = "start";
        };

        // Dibujar el último estado conocido antes de cualquier predicción nueva
        if (lastLineState) drawLineState(lastLineState);

        // Lanzar predicción asíncrona (solo si no hay una en vuelo)
        if (tmModel && !isProcessingTM && ultimoFrameVideo.src && ultimoFrameVideo.naturalWidth > 0) {
            isProcessingTM = true;

            // Predicción
            tmModel.predict(ultimoFrameVideo).then(predictions => {
                if (subModoTraining !== 'LINEA') {
                    isProcessingTM = false;
                    return;
                }

                // Determinar la clase más probable
                let maxProb = 0;
                let bestClass = "";
                predictions.forEach(p => {
                    if (p.probability > maxProb) {
                        maxProb = p.probability;
                        bestClass = p.className.toUpperCase();
                    }
                });
                // Clase 1 -> pisando, Clase 2 -> perfecto
                const isPisando = bestClass.includes("CLASS 1");
                const newState = isPisando ? 'PISANDO' : 'PERFECTO';
                lastLineState = newState;


                const now = Date.now();
                if (isPisando && now - lastFeedbackTime > 3000) {
                    hablar("\u00A1Pisando línea!");
                    lastFeedbackTime = now;
                }

                isProcessingTM = false;
            }).catch(err => {
                console.error("Error en predicci\u00F3n TM:", err);
                isProcessingTM = false;
            });
            // Si no hay modelo, mostrar error
        } else if (!isProcessingTM && isTMModelLoading) {
            ctxEntrenamiento.fillStyle = "white";
            ctxEntrenamiento.font = "20px Arial";
            ctxEntrenamiento.fillText("Cargando modelo de detecci\u00F3n...", 60, 100);
        } else if (!isProcessingTM && !tmModel) {
            ctxEntrenamiento.fillStyle = "#ff4444";
            ctxEntrenamiento.font = "16px Arial";
            ctxEntrenamiento.fillText("Error: Aseg\u00FArate de tener la carpeta 'my_model' en public/", 40, 100);
        }
    }
});

socket.on('submodo-actualizado', (submodo) => {
    subModoTraining = submodo;
    lastLineState = null;
    reiniciarDrill(); // Resetear al salir de modo

    if (!submodo) {
        document.getElementById('training-title').innerText = "ENTRENAMIENTO";
        hablar("Volviendo a la selección de entrenamiento. Diga Fondo, Saque o Línea para comenzar una serie.");
        dibujarPantallaSeleccionEntrenamiento();

        // Ocultar extras al volver a selección
        if (angleDisplay) angleDisplay.style.display = 'none';
        if (feedbackBadge) feedbackBadge.style.display = 'none';
        const hintReiniciar = document.getElementById('hint-reiniciar');
        if (hintReiniciar) hintReiniciar.style.display = 'none';
        return;
    }

    // Actualizar título dinámico
    const titleEl = document.getElementById('training-title');
    if (submodo) {
        titleEl.innerText = "ENTRENAMIENTO " + submodo;
    }

    // Mostrar extras solo en modos biomecánicos (Fondo y Saque)
    if (submodo === 'FONDO' || submodo === 'SAQUE') {
        if (angleDisplay) angleDisplay.style.display = 'block';
        const hintReiniciar = document.getElementById('hint-reiniciar');
        if (hintReiniciar) hintReiniciar.style.display = 'flex';
    } else {
        // En LINEA o selección, ocultamos los extras biomecánicos
        if (angleDisplay) angleDisplay.style.display = 'none';
        const hintReiniciar = document.getElementById('hint-reiniciar');
        if (hintReiniciar) hintReiniciar.style.display = 'none';
    }

    if (submodo === 'LINEA') {
        cargarModeloLinea();
        hablar("Modo detección de línea activado. Vigila donde pisas.");
    } else if (submodo) {
        hablar(`Modo ${submodo.toLowerCase()} activado. Empezamos serie de cinco.`);
    }
});

socket.on('reiniciar-drill', () => {
    reiniciarDrill();
    hablar("Serie reiniciada. ¡Vamos otra vez!");
});

function calcularAngulo(A, B, C) {
    // Calcula el ángulo entre tres puntos
    let radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

function dibujarPose(ctx, landmarks) {
    // Dibuja la pose en el canvas
    const w = canvasEntrenamiento.width;
    const h = canvasEntrenamiento.height;

    // Obtener colores computados
    const accentCol = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3498db';

    // Conexiones de ambos brazos y torso
    const conexiones = [[12, 14], [14, 16], [11, 13], [13, 15], [12, 24], [11, 23]];

    ctx.lineWidth = 5;
    conexiones.forEach(([i, j]) => {
        const p1 = landmarks[i];
        const p2 = landmarks[j];
        if (p1 && p2 && getVisibility(p1) > 0.1 && getVisibility(p2) > 0.1) {
            ctx.beginPath();
            ctx.moveTo(p1.x * w, p1.y * h);
            ctx.lineTo(p2.x * w, p2.y * h);
            ctx.strokeStyle = ([14, 13].includes(i) || [14, 13].includes(j)) ? "rgba(52, 152, 219, 0.8)" : "white";
            ctx.stroke();
        }
    });

    // Puntos clave
    const keys = [11, 12, 13, 14, 15, 16, 23, 24];
    landmarks.forEach((p, idx) => {
        if (p && getVisibility(p) > 0.1 && keys.includes(idx)) {
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 6, 0, 2 * Math.PI);
            ctx.fillStyle = ([15, 16].includes(idx)) ? accentCol : "white";
            ctx.fill();
        }
    });
}
