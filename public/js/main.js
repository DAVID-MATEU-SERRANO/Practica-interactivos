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

// Tarjetas de Selección de Modo
const cardPartido = document.getElementById('card-partido');
const cardEntrenamiento = document.getElementById('card-entrenamiento');

// Referencias al Marcador y Otros
const marcadorPartido = document.getElementById('marcador-partido');
const avisoPista = document.getElementById('aviso-pista');
const qrSection = document.getElementById('qr-section');
const statusContainer = document.getElementById('status-container');

// Vista Entrenamiento Detalle
const canvasEntrenamiento = document.getElementById('canvas-entrenamiento');
const ctxEntrenamiento = canvasEntrenamiento ? canvasEntrenamiento.getContext('2d') : null;
const txtAngulo = document.getElementById('txt-angulo');
const feedbackBadge = document.getElementById('feedback-badge');

const angleDisplay = document.getElementById('angle-display');
const trainingTipsContainer = document.querySelector('.training-tips');

// Las tarjetas del Lobby se gestionan ahora SOLO mediante comandos de voz

// Referencias al Marcador
const uiPuntos = { yo: document.getElementById('puntos-yo'), rival: document.getElementById('puntos-rival') };
const uiSaque = { yo: document.getElementById('saque-yo'), rival: document.getElementById('saque-rival') };
const uiNombres = { yo: document.querySelector('#fila-yo .col-nombre'), rival: document.querySelector('#fila-rival .col-nombre') };

// Referencias Video Nadal
const nadalOverlay = document.getElementById('nadal-overlay');
const nadalVideo = document.getElementById('nadal-video');

const uiSets = [
    { yo: document.getElementById('s1-yo'), rival: document.getElementById('s1-rival') },
    { yo: document.getElementById('s2-yo'), rival: document.getElementById('s2-rival') },
    { yo: document.getElementById('s3-yo'), rival: document.getElementById('s3-rival') }
];

// --- ESTADO DEL PARTIDO ---
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
    inicioUltimoJuego: Date.now(), // Tracking de duración de juego
    gameHistory: [] // Registro de duraciones de juegos
};

// Referencias Stats Overlay
const statsOverlay = document.getElementById('stats-overlay');
const btnCloseStats = document.getElementById('close-stats');
if (btnCloseStats) btnCloseStats.onclick = () => statsOverlay.classList.remove('visible');

const labelsPuntos = ["0", "15", "30", "40", "AD"];
let golpeSeleccionado = 'DERECHA'; // Por defecto
let trainingActive = false;
let subModoTraining = null; // null, 'FONDO' o 'SAQUE'
let alturaMinimaMuñeca = 1.0; // Para el peak detector de saque
let isReplaying = false; // Flag para silenciar audio y eventos durante la reconstrucción

// --- VARIABLES DEL DESAFÍO DE 5 GOLPES ---
let contadorIntentos = 0;
let contadorExitos = 0;
let ultimaDeteccionDrill = 0;
let drillFinalizado = false;

// --- VARIABLES DE PRECISIÓN ---
let estadoPreparacion = false; // Para detectar ciclo Codo Doblado -> Estirado
let maxAnguloEnSalto = 0;      // Para capturar el mejor ángulo durante todo el saque/golpe
let maxSeparacionEnSalto = 0;  // Para capturar la mejor separación hombro-codo
let serveInProgress = false;    // Para saber cuándo se está realizando un saque alto

// --- VARIABLES TEACHABLE MACHINE (MODO LÍNEA) ---
let tmModel = null;
let isTMModelLoading = false;
let isProcessingTM = false; // Semáforo para evitar sobrecarga de predicciones
const TM_MODEL_URL = "https://teachablemachine.withgoogle.com/models/RexvBpOpyS/"; // URL remota del usuario
let lastFeedbackTime = 0; // Para cooldown de voz

async function cargarModeloLinea() {
    if (tmModel || isTMModelLoading) return;
    if (!window.tmImage) {
        console.error("⚠️ Librería Teachable Machine no cargada aún.");
        return;
    }
    try {
        isTMModelLoading = true;
        console.log("🤖 Cargando modelo de Teachable Machine...");
        const modelURL = TM_MODEL_URL + "model.json";
        const metadataURL = TM_MODEL_URL + "metadata.json";
        tmModel = await window.tmImage.load(modelURL, metadataURL);
        console.log("✅ Modelo TM cargado correctamente");
    } catch (e) {
        console.error("❌ Error al cargar modelo TM:", e);
    } finally {
        isTMModelLoading = false;
    }
}

function reiniciarDrill() {
    contadorIntentos = 0;
    contadorExitos = 0;
    drillFinalizado = false;
    ultimaDeteccionDrill = 0;
    alturaMinimaMuñeca = 1.0;
    estadoPreparacion = false;
    maxAnguloEnSalto = 0;
    maxSeparacionEnSalto = 0;
    serveInProgress = false;
}

// --- SINCRONIZACIÓN DE AUDIO ---
socket.on('audio-actualizado', (silenciar) => {
    partido.estaSilenciado = silenciar;
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

/**
 * Inicializa el sistema, limpia el overlay y genera el código QR
 */
if (btnIniciar) {
    btnIniciar.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        dashboardContent.style.display = 'block';

        // El sistema inicia siempre en el Lobby por defecto
        lobbyView.style.display = 'flex';
        marcadorView.style.display = 'none';
        entrenamientoView.style.display = 'none';

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

        hablar("Bienvenido al sistema de Tenis Inteligente. Puede decir Partido o Entrenamiento al móvil para comenzar.");
        recuperarEstadisticas();
    });

    // AUTO-INICIO tras un RESET (salir)
    if (sessionStorage.getItem('skipStartOverlay') === 'true') {
        sessionStorage.removeItem('skipStartOverlay');
        // Pequeño delay para asegurar que todo cargó
        setTimeout(() => { btnIniciar.click(); }, 300);
    }
}

function resetEstadoPartido() {
    console.log("Reiniciando estado del partido para reconstrucción...");
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
    partido.inicioUltimoJuego = Date.now();
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

function reconstruirPartido(stats) {
    if (!stats || !stats.points) return;
    const pointsToReplay = stats.points;
    console.log(`Iniciando reconstrucción de ${pointsToReplay.length} puntos...`);

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
        procesarPunto(payload, true); // true for silent (replay)
    });
    isReplaying = false;

    // Emitir socket para que el servidor actualice también los juegos usando nuestra reconstrucción
    socket.emit('sync-games', partido.gameHistory);

    actualizarMarcadorUI();
    
    // Al finalizar la re-construcción, verificamos el DOM para reflejar el estado correcto (ej. si quedó en descanso de pista)
    setTimeout(() => verificarCambioPista(), 0);
}

async function recuperarEstadisticas() {
    try {
        console.log("Intentando recuperar estadísticas del servidor...");
        const response = await fetch('/match-stats');
        const data = await response.json();

        if (data && data.points) {
            partido.matchHistory = data.points;
            console.log(`Recuperados ${data.points.length} puntos.`);
        }
        if (data && data.games) {
            partido.gameHistory = data.games;
            console.log(`Recuperados ${data.games.length} juegos.`);
        }
        actualizarMarcadorUI();
    } catch (err) {
        console.error("Error recuperando estadísticas:", err);
    }
}

// --- LÓGICA DE SAQUE RECIBIDA DEL MÓVIL ---
socket.on('saque-definido', (quien) => {
    if (quien === 'Nadal') {

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
    partido.quienSaca = (quien === 'yo') ? 0 : 1;
    partido.servidorInicialSet = partido.quienSaca;
    actualizarMarcadorUI();
    hablar("Saque inicial definido. Empieza sacando " + (quien === 'yo' ? "usted" : "el rival"));
});

function activarHomenajeNadal() {
    // Reproducir video
    if (nadalOverlay && nadalVideo) {
        nadalOverlay.style.display = 'flex';
        nadalVideo.play();

        // Al terminar el vídeo, ocultar overlay
        nadalVideo.onended = () => {
            nadalOverlay.style.display = 'none';
        };
    }
}


function cambiarServidorJuego() {
    partido.quienSaca = 1 - partido.quienSaca;
    const quien = (partido.quienSaca === 0) ? 'yo' : 'rival';
    socket.emit('notificar-saque', quien);
}

function verificarServidorTieBreak() {
    const totalPuntos = partido.tieBreakPoints[0] + partido.tieBreakPoints[1];
    const baseServer = partido.servidorInicialSet;
    const currentServer = (Math.floor((totalPuntos + 1) / 2) % 2 === 0) ? baseServer : 1 - baseServer;
    partido.quienSaca = currentServer;
    const quien = (partido.quienSaca === 0) ? 'yo' : 'rival';
    socket.emit('notificar-saque', quien);
}

// --- LÓGICA DE PUNTUACIÓN ---

socket.on('punto-registrado', (payload) => {
    procesarPunto(payload);
});

socket.on('punto-deshecho', (stats) => {
    console.log("Recuperando estado previo tras deshacer punto...");
    reconstruirPartido(stats);
    hablar("Punto deshecho.");
});

function procesarPunto(payload, silent = false) {
    if (!silent) statsOverlay.classList.remove('visible');
    if (partido.isMatchFinished || partido.quienSaca === null) return;

    let quien, metrics;
    if (typeof payload === 'string') {
        quien = payload;
        metrics = null;
    } else {
        quien = payload.quien;
        metrics = payload.metrics;
    }

    const winnerIdx = (quien === 'yo') ? 0 : 1;
    const loserIdx = (quien === 'yo') ? 1 : 0;

    if (partido.isTieBreak) {
        anotarPuntoTieBreak(winnerIdx, loserIdx);
        verificarServidorTieBreak();
    } else {
        anotarPuntoEstandar(winnerIdx, loserIdx);
    }

    // Guardar en el historial
    partido.matchHistory.push({
        ganador: quien,
        marcadorPost: `${partido.games[0]}-${partido.games[1]} (${partido.puntos[0]}-${partido.puntos[1]})`,
        metrics: metrics,
        setIndex: partido.currentSetIndex
    });

    actualizarMarcadorUI();

    // Desacoplar para asegurar que la UI reaccione y las promesas/estados sincrónicos estén limpios
    if (!silent) {
        setTimeout(() => verificarCambioPista(), 0);
    } else {
        // En reconstrucción (silent) replicamos la lógica sin mutar la UI, solo para avanzar el índice base de stats
        let esCambio = false;
        if (partido.isTieBreak) {
            const totalPuntosTie = partido.tieBreakPoints[0] + partido.tieBreakPoints[1];
            if (totalPuntosTie > 0 && totalPuntosTie % 6 === 0) esCambio = true;
        } else if (partido.puntos[0] === 0 && partido.puntos[1] === 0) {
            if (partido.games[0] === 0 && partido.games[1] === 0) {
                if (partido.currentSetIndex > 0) {
                    const prevSet = partido.setScores[partido.currentSetIndex - 1];
                    if ((prevSet[0] + prevSet[1]) % 2 !== 0) esCambio = true;
                }
            } else {
                if ((partido.games[0] + partido.games[1]) % 2 !== 0) esCambio = true;
            }
        }
        
        const esDescanso = (partido.isTieBreak || (partido.puntos[0] === 0 && partido.puntos[1] === 0));
        if (esCambio && esDescanso) {
            const setRecienTerminado = (partido.games[0] === 0 && partido.games[1] === 0 && partido.matchHistory.length > 0 && !partido.isTieBreak);
            if (!setRecienTerminado) {
                partido.ultimoIndiceDescanso = partido.matchHistory.length;
                partido.ultimoIndiceJuegosDescanso = partido.gameHistory.length;
            }
        }
    }
};

function anotarPuntoEstandar(w, l) {
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

function anotarPuntoTieBreak(w, l) {
    partido.tieBreakPoints[w]++;
    cantarPuntuacion();

    if (partido.tieBreakPoints[w] >= 7 && (partido.tieBreakPoints[w] - partido.tieBreakPoints[l] >= 2)) {
        partido.games[w]++;
        partido.setScores[partido.currentSetIndex] = [...partido.games];
        ganarSet(w);
    }
}

function cantarPuntuacion() {
    const s = partido.quienSaca;
    const r = 1 - s;

    if (partido.isTieBreak) {
        hablar(`${partido.tieBreakPoints[s]} a ${partido.tieBreakPoints[r]}`);
    } else {
        const pS = labelsPuntos[partido.puntos[s]] === "0" ? "Nada" : labelsPuntos[partido.puntos[s]];
        const pR = labelsPuntos[partido.puntos[r]] === "0" ? "Nada" : labelsPuntos[partido.puntos[r]];

        if (pS === pR && pS !== "AD") {
            hablar(pS === "Nada" ? "Nada iguales" : pS + " iguales");
        } else {
            hablar(`${pS} ${pR}`);
        }
    }
}

function ganarJuego(w) {
    // Calcular duración del juego si lo estuviéramos trackeando aquí centralizadamente
    // Pero el móvil lo enviará si le avisamos.

    partido.games[w]++;
    partido.puntos = [0, 0];
    partido.setScores[partido.currentSetIndex] = [...partido.games];

    // Calcular duración del juego
    const duracionJuego = Math.floor((Date.now() - partido.inicioUltimoJuego) / 1000); // en segundos
    partido.inicioUltimoJuego = Date.now(); // Reset para el siguiente juego

    // Notificar al móvil que el juego ha terminado para que guarde estadísticas
    const payload = {
        ganador: w === 0 ? 'yo' : 'rival',
        marcador: `${partido.games[0]}-${partido.games[1]}`,
        duracion: duracionJuego,
        setIndex: partido.currentSetIndex
    };
    
    if (!isReplaying) {
        socket.emit('registrar-fin-juego', payload);
    }

    // Guardar localmente para cálculos de media
    partido.gameHistory.push(payload);

    if (!partido.isTieBreak) cambiarServidorJuego();

    const s = partido.quienSaca;
    const r = 1 - s;

    // Anuncio conciso: "Juego usted. 4 2." o "Juego rival. 2 4."
    let msg = `Juego ${w === 0 ? "usted" : "rival"}. `;
    if (partido.games[s] === partido.games[r]) {
        msg += `${partido.games[s]} iguales.`;
    } else {
        msg += `${partido.games[s]} ${partido.games[r]}.`;
    }

    hablar(msg);
    checkSetStatus(w);
}

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

function ganarSet(w) {
    partido.sets[w]++;

    // Anuncio conciso: "Set usted. 6 4."
    let msg = `Set ${w === 0 ? "usted" : "rival"}. ${partido.games[0]} ${partido.games[1]}. `;
    if (partido.sets[0] !== 0 || partido.sets[1] !== 0) {
        msg += `${partido.sets[0]} sets a ${partido.sets[1]}.`;
    }

    hablar(msg);

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

function actualizarMarcadorUI() {
    if (partido.isTieBreak) {
        uiPuntos.yo.innerText = partido.tieBreakPoints[0];
        uiPuntos.rival.innerText = partido.tieBreakPoints[1];
    } else {
        uiPuntos.yo.innerText = labelsPuntos[partido.puntos[0]];
        uiPuntos.rival.innerText = labelsPuntos[partido.puntos[1]];
    }

    partido.setScores.forEach((score, idx) => {
        if (uiSets[idx]) {
            uiSets[idx].yo.innerText = score[0];
            uiSets[idx].rival.innerText = score[1];
        }
    });

    if (partido.quienSaca !== null) {
        uiSaque.yo.style.visibility = (partido.quienSaca === 0) ? 'visible' : 'hidden';
        uiSaque.rival.style.visibility = (partido.quienSaca === 1) ? 'visible' : 'hidden';
    }
}

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

    const esDescanso = (partido.isTieBreak || (partido.puntos[0] === 0 && partido.puntos[1] === 0));

    if (esCambio && esDescanso) {
        // Evitar pisar la pantalla de "Fin del Set" que ya muestra stats
        const setRecienTerminado = (partido.games[0] === 0 && partido.games[1] === 0 && partido.matchHistory.length > 0 && !partido.isTieBreak);
        if (!setRecienTerminado) {
            mostrarEstadisticas("Descanso de Pista");
        }
    }
}

// --- MOTOR DE ESTADÍSTICAS ---

function calcularEstadisticas(rangoPuntos) {
    let stats = {
        winners: { total: 0, der: 0, rev: 0, tipos: {} },
        errors: { total: 0, der: 0, rev: 0, tipos: {} },
        serves: { firstIn: 0, firstTotal: 0, aces: 0, doubleFaults: 0 },
        power: { sum: 0, count: 0, max: 0, maxDetail: "" },
        time: { pointSum: 0, pointCount: 0 }
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
            if (m.motivo === 'Winner' && m.strokes && m.strokes.length === 1 && m.strokes[0].trajectory.includes('SAQUE')) {
                stats.serves.aces++;
            }
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

    return stats;
}

function mostrarEstadisticas(titulo) {
    const globalHistory = partido.matchHistory;
    const globalGameHistory = partido.gameHistory;
    let currentPoints = [];
    let baselinePoints = null;
    let currentGames = [];
    let baselineGames = null;
    const isSetSummary = titulo.startsWith("Fin del Set") || titulo === "Fin del Partido";

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
            // Fin del Partido: todos los puntos
            currentPoints = globalHistory;
            currentGames = globalGameHistory;
        }
        // ⚠️ NO tocar ultimoIndiceDescanso aquí
    } else {
        // Descanso de Pista: último tramo vs lo jugado anteriormente
        currentPoints = globalHistory.slice(partido.ultimoIndiceDescanso);
        currentGames = globalGameHistory.slice(partido.ultimoIndiceJuegosDescanso);
        if (currentPoints.length === 0) return; // Guard para evitar errores de slice vacío
        baselinePoints = partido.ultimoIndiceDescanso > 0 ? globalHistory.slice(0, partido.ultimoIndiceDescanso) : null;
        baselineGames = partido.ultimoIndiceJuegosDescanso > 0 ? globalGameHistory.slice(0, partido.ultimoIndiceJuegosDescanso) : null;
        partido.ultimoIndiceDescanso = globalHistory.length; // Solo se actualiza aquí
        partido.ultimoIndiceJuegosDescanso = globalGameHistory.length;
    }

    const statsCurrent = calcularEstadisticas(currentPoints);
    const statsBaseline = baselinePoints ? calcularEstadisticas(baselinePoints) : null;

    document.getElementById('stats-moment').innerText = titulo;

    // --- Helper para Deltas ---
    const getDelta = (curr, baseline) => {
        const b = parseFloat(baseline);
        if (!b || isNaN(b) || !isFinite(b)) return 0;
        const c = parseFloat(curr) || 0;
        return ((c - b) / b * 100).toFixed(0);
    };

    const getDeltaAbs = (curr, baseline) => {
        const c = parseFloat(curr) || 0;
        const b = parseFloat(baseline) || 0;
        // Quitamos decimales si ambos son enteros, de lo contrario dejamos 1 decimal
        return (c - b).toFixed(1).replace(/\.0$/, '');
    };

    const formatDelta = (delta, inverse = false) => {
        const numDelta = parseFloat(delta);
        if (isNaN(numDelta) || numDelta === 0) return `<small class="delta">(0%)</small>`;
        let colorClass = "";
        if (numDelta > 0) colorClass = inverse ? 'negative' : 'positive';
        else if (numDelta < 0) colorClass = inverse ? 'positive' : 'negative';
        // Quitamos la terminación .0 visualmente si existe
        let displayDelta = delta.toString().replace(/\.0$/, '');
        return `<small class="delta ${colorClass}">(${numDelta > 0 ? '+' : ''}${displayDelta}%)</small>`;
    };

    const updateValueWithDelta = (id, curr, globValue, inverse = false) => {
        const el = document.getElementById(id);
        if (!el) return;

        let deltaText = "";
        if (statsBaseline) {
            const normalizationFactor = (baselinePoints.length / (currentPoints.length || 1)) || 1;
            const normalizedBaseline = globValue / normalizationFactor;
            const delta = getDelta(curr, normalizedBaseline);
            deltaText = formatDelta(delta, inverse);
        }

        el.querySelector('.value').innerHTML = `${curr} ${deltaText}`;
    };

    console.log(`Trigger: ${titulo}. Puntos actuales: ${currentPoints.length}. Baseline: ${baselinePoints ? baselinePoints.length : 'N/A'}`);

    // Winners e Inferiores
    updateValueWithDelta('stat-winners', statsCurrent.winners.total, statsBaseline ? statsBaseline.winners.total : 0);
    document.getElementById('sub-win-der').innerText = statsCurrent.winners.der;
    document.getElementById('sub-win-rev').innerText = statsCurrent.winners.rev;

    // Errores
    updateValueWithDelta('stat-errors', statsCurrent.errors.total, statsBaseline ? statsBaseline.errors.total : 0, true);

    // Tasa de Error (% de golpes que son fallos propios)
    const errorRate = statsCurrent.power.count > 0 ? (statsCurrent.errors.total / statsCurrent.power.count * 100).toFixed(1) : 0;
    let errDeltaHTML = "";
    if (statsBaseline && statsBaseline.power.count > 0) {
        const globErrorRate = (statsBaseline.errors.total / statsBaseline.power.count * 100).toFixed(1);
        errDeltaHTML = formatDelta(getDeltaAbs(errorRate, globErrorRate), true);
    }
    document.getElementById('stat-error-rate').querySelector('.value').innerHTML = `${errorRate}% ${errDeltaHTML}`;

    document.getElementById('sub-err-der').innerText = statsCurrent.errors.der;
    document.getElementById('sub-err-rev').innerText = statsCurrent.errors.rev;

    // Saque
    const firstServePct = statsCurrent.serves.firstTotal > 0 ? (statsCurrent.serves.firstIn / statsCurrent.serves.firstTotal * 100).toFixed(0) : 0;
    let serveDeltaHTML = "";
    if (statsBaseline && statsBaseline.serves.firstTotal > 0) {
        const globServePct = (statsBaseline.serves.firstIn / statsBaseline.serves.firstTotal * 100).toFixed(0);
        serveDeltaHTML = formatDelta(getDeltaAbs(firstServePct, globServePct), false);
    }
    // We update innerHTML for first-serve to include the delta HTML inline
    document.getElementById('stat-first-serve').innerHTML = `${firstServePct}% ${serveDeltaHTML}`;

    let acesDeltaHTML = "";
    if (statsBaseline && statsBaseline.serves.firstTotal > 0) {
        const currAceRate = statsCurrent.serves.firstTotal > 0 ? (statsCurrent.serves.aces / statsCurrent.serves.firstTotal * 100).toFixed(1) : 0;
        const globAceRate = (statsBaseline.serves.aces / statsBaseline.serves.firstTotal * 100).toFixed(1);
        acesDeltaHTML = formatDelta(getDeltaAbs(currAceRate, globAceRate), false);
    }
    document.getElementById('stat-aces').innerHTML = `${statsCurrent.serves.aces} ${acesDeltaHTML}`;

    let dfDeltaHTML = "";
    if (statsBaseline && statsBaseline.serves.firstTotal > 0) {
        const currDFRate = statsCurrent.serves.firstTotal > 0 ? (statsCurrent.serves.doubleFaults / statsCurrent.serves.firstTotal * 100).toFixed(1) : 0;
        const globDFRate = (statsBaseline.serves.doubleFaults / statsBaseline.serves.firstTotal * 100).toFixed(1);
        dfDeltaHTML = formatDelta(getDeltaAbs(currDFRate, globDFRate), true);
    }
    document.getElementById('stat-double-faults').innerHTML = `${statsCurrent.serves.doubleFaults} ${dfDeltaHTML}`;

    // Potencia
    const avgPwr = statsCurrent.power.count > 0 ? (statsCurrent.power.sum / statsCurrent.power.count).toFixed(1) : 0;
    let pwrDeltaHTML = "";
    if (statsBaseline && statsBaseline.power.count > 0) {
        const globAvgPwr = statsBaseline.power.sum / statsBaseline.power.count;
        pwrDeltaHTML = formatDelta(getDelta(avgPwr, globAvgPwr), false);
    }
    document.getElementById('stat-power-avg').innerHTML = `${avgPwr}G ${pwrDeltaHTML}`;

    document.getElementById('stat-power-max').innerText = statsCurrent.power.max + "G";
    document.getElementById('stat-power-max-desc').innerText = statsCurrent.power.maxDetail || "--";

    // Tiempos
    const avgTime = statsCurrent.time.pointCount > 0 ? (statsCurrent.time.pointSum / statsCurrent.time.pointCount).toFixed(1) : 0;
    let pointTimeDeltaHTML = "";
    if (statsBaseline && statsBaseline.time.pointCount > 0) {
        const globAvgTime = (statsBaseline.time.pointSum / statsBaseline.time.pointCount).toFixed(1);
        pointTimeDeltaHTML = formatDelta(getDelta(avgTime, globAvgTime), true); // Aumentar tiempo lo consideramos "malo" o rojo
    }
    document.getElementById('stat-time-point').innerHTML = `${avgTime}s ${pointTimeDeltaHTML}`;

    // Tiempo medio por juego
    if (currentGames.length > 0) {
        const avgGameTime = (currentGames.reduce((acc, g) => acc + g.duracion, 0) / currentGames.length).toFixed(0);
        let gameTimeDeltaHTML = "";
        if (baselineGames && baselineGames.length > 0) {
            const globAvgGameTime = (baselineGames.reduce((acc, g) => acc + g.duracion, 0) / baselineGames.length).toFixed(0);
            gameTimeDeltaHTML = formatDelta(getDelta(avgGameTime, globAvgGameTime), true);
        }
        document.getElementById('stat-time-game').innerHTML = `${avgGameTime}s ${gameTimeDeltaHTML}`;
    } else {
        document.getElementById('stat-time-game').innerHTML = `0s`;
    }

    // Detalle de tipos
    const formatTipos = (tipos) => {
        return Object.entries(tipos)
            .map(([tipo, count]) => `<div>${tipo}: <b>${count}</b></div>`)
            .join('');
    };
    document.getElementById('winner-types').innerHTML = formatTipos(statsCurrent.winners.tipos);
    document.getElementById('error-types').innerHTML = formatTipos(statsCurrent.errors.tipos);

    // Mostrar Overlay
    statsOverlay.classList.add('visible');
}

// --- SINCRONIZACIÓN DE MODOS ---

/**
 * Sincronización de estados y visibilidad de vistas
 */
socket.on('modo-actualizado', (modo) => {
    if (modoTexto) modoTexto.innerText = modo;
    trainingActive = (modo === "MODO ENTRENAMIENTO");

    if (modo === "MODO PARTIDO") {
        document.body.classList.add('match-active');
        lobbyView.style.display = 'none';
        marcadorView.style.display = 'block';
        entrenamientoView.style.display = 'none';

        if (partido.quienSaca === null) {
            hablar("Modo partido activado. El móvil está listo para registrar golpes. Antes de comenzar diga quien va a comenzar sacando");
        }
    } else if (modo === "MODO ENTRENAMIENTO") {
        document.body.classList.remove('match-active');
        lobbyView.style.display = 'none';
        marcadorView.style.display = 'none';
        entrenamientoView.style.display = 'flex';
        hablar("Modo entrenamiento activado. Seleccione su golpe en el controlador.");
        dibujarPantallaSeleccionEntrenamiento();

        // Ocultar extras inicialmente en la selección
        if (angleDisplay) angleDisplay.style.display = 'none';
        if (trainingTipsContainer) trainingTipsContainer.style.display = 'none';
        if (feedbackBadge) feedbackBadge.style.display = 'none';
    } else {
        // MODO DASHBOARD / LOBBY / RESET SOFT
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
    hablar("¿Seguro que desea salir del partido? Diga salir para confirmar o no para continuar.");
});


function hablar(mensaje) {
    if (partido.estaSilenciado || isReplaying) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-ES';
    synth.speak(utterance);
}

// --- LÓGICA DE ENTRENAMIENTO RECIBIDA DEL MÓVIL ---

function dibujarPantallaSeleccionEntrenamiento() {
    if (!ctxEntrenamiento) return;
    
    // Asegurar dimensiones
    if (canvasEntrenamiento.offsetWidth > 0) {
        canvasEntrenamiento.width = canvasEntrenamiento.offsetWidth;
        canvasEntrenamiento.height = canvasEntrenamiento.offsetHeight;
    }

    ctxEntrenamiento.clearRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);
    ctxEntrenamiento.fillStyle = "#111";
    ctxEntrenamiento.fillRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);

    ctxEntrenamiento.fillStyle = "white";
    ctxEntrenamiento.textAlign = "center";
    ctxEntrenamiento.font = "bold 34px Arial";
    ctxEntrenamiento.fillText("MODO ENTRENAMIENTO", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 - 40);

    const accentCol = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#fbbf24';
    ctxEntrenamiento.font = "26px Arial";
    ctxEntrenamiento.fillStyle = accentCol;
    ctxEntrenamiento.fillText("DI 'FONDO', 'SAQUE' O 'LÍNEA' EN EL MÓVIL", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 + 20);

    ctxEntrenamiento.fillStyle = "#888";
    ctxEntrenamiento.font = "18px Arial";
    ctxEntrenamiento.fillText("(La cámara se activará al elegir modo)", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 + 60);

    ctxEntrenamiento.textAlign = "start"; // Reset
}

// Variable para guardar el último frame recibido
let ultimoFrameVideo = new Image();

socket.on('render-video', (frameData) => {
    ultimoFrameVideo.src = frameData;
});

// Función auxiliar para obtener visibilidad de forma robusta
function getVisibility(p) {
    if (!p) return 0;
    return p.visibility !== undefined ? p.visibility : (p.score !== undefined ? p.score : 0);
}

socket.on('training-data', (data) => {
    if (!ctxEntrenamiento || !trainingActive) return;

    // --- DIAGNÓSTICO EN PANTALLA ---
    const debugDiv = document.getElementById('debug-datos');
    if (debugDiv && data.landmarks && data.landmarks.length > 0) {
        const hR = data.landmarks[12] || {};
        const hL = data.landmarks[11] || {};
        const visR = getVisibility(hR);
        const visL = getVisibility(hL);
        const status = (visR > 0.1 && visL > 0.1) ? 'POSICIONADO' : 'BUSCANDO JUGADOR...';
        debugDiv.innerHTML = `STATUS: ${status}<br><b>MODO: ${subModoTraining}</b>`;
        debugDiv.style.color = (status === 'POSICIONADO') ? 'lime' : 'orange';
    }
    // -------------------------------

    // Asegurar dimensiones correctas una sola vez (Bug 3)
    if (canvasEntrenamiento.offsetWidth > 0 &&
        canvasEntrenamiento.width !== canvasEntrenamiento.offsetWidth) {
        canvasEntrenamiento.width = canvasEntrenamiento.offsetWidth;
        canvasEntrenamiento.height = canvasEntrenamiento.offsetHeight;
    }

    const landmarks = data.landmarks;
    if (landmarks && landmarks.length > 0) {
        if (canvasEntrenamiento.width === 0 || canvasEntrenamiento.height === 0) {
            canvasEntrenamiento.width = canvasEntrenamiento.offsetWidth || 800;
            canvasEntrenamiento.height = canvasEntrenamiento.offsetHeight || 600;
        }
    } else if (subModoTraining !== 'LINEA') {
        // Solo cortamos si no hay landmarks Y no estamos en modo línea
        return;
    }

    ctxEntrenamiento.clearRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);

    // --- PANTALLA DE SELECCIÓN INICIAL ---
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

    // --- RENDERIZADO DE SKELETON Y ANÁLISIS ---
    dibujarPose(ctxEntrenamiento, landmarks);

    if (drillFinalizado) {
        ctxEntrenamiento.fillStyle = "rgba(0,0,0,0.85)";
        ctxEntrenamiento.fillRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);
        ctxEntrenamiento.fillStyle = "gold";
        ctxEntrenamiento.textAlign = "center";
        ctxEntrenamiento.font = "bold 42px Arial";
        ctxEntrenamiento.fillText("SERIE COMPLETADA", canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 - 20);
        ctxEntrenamiento.fillStyle = "white";
        ctxEntrenamiento.font = "32px Arial";
        ctxEntrenamiento.fillText(`RESULTADO: ${contadorExitos} de 5 perfectos`, canvasEntrenamiento.width / 2, canvasEntrenamiento.height / 2 + 40);
        ctxEntrenamiento.textAlign = "start";
        return;
    }

    if (subModoTraining === 'FONDO') {
        const h = landmarks[12], c = landmarks[14], m = landmarks[16], hip = landmarks[24];

        if (h && c && m && hip && getVisibility(h) > 0.1 && getVisibility(c) > 0.1 && getVisibility(m) > 0.1) {
            const anguloCodo = calcularAngulo(h, c, m);
            const separacionHombro = calcularAngulo(hip, h, c);
            const now = Date.now();

            // CONFIGURACIÓN DINÁMICA POR TIPO DE GOLPE
            const prepThreshold = 115;
            const impactThreshold = 145; // Equilibrio: brazo estirado pero no exige perfección absoluta

            // 1. Detección de Preparación (Codo doblado)
            if (anguloCodo < prepThreshold) {
                estadoPreparacion = true;
                maxAnguloEnSalto = 0;
                maxSeparacionEnSalto = 0;
            }

            // 2. Detección de Impacto (Extensión con cooldown de 1.5s)
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

                if (contadorIntentos >= 5) {
                    drillFinalizado = true;
                    hablar(`Serie terminada. Resultado: ${contadorExitos} de cinco.`);
                } else {
                    hablar(`Golpe ${contadorIntentos} de 5.`);
                }
            }

            // Monitorización de picos
            if (estadoPreparacion) {
                if (anguloCodo > maxAnguloEnSalto) maxAnguloEnSalto = anguloCodo;
                if (separacionHombro > maxSeparacionEnSalto) maxSeparacionEnSalto = separacionHombro;
            }

            // Feedback Visual (Sincronizado con la lógica de éxito)
            let mensaje = "";
            let color = "white";

            const okExtension = (anguloCodo >= 145);
            const okSeparacion = (separacionHombro >= 27); // 27 evita el pegado al cuerpo pero no es tan estricto como 32

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

            ctxEntrenamiento.fillStyle = color;
            ctxEntrenamiento.font = "bold 34px Arial";
            ctxEntrenamiento.fillText(mensaje, 50, 80);

            ctxEntrenamiento.fillStyle = "white";
            ctxEntrenamiento.font = "24px Arial";
            ctxEntrenamiento.fillText(`GOLPE ${contadorIntentos}/5 | ÉXITOS: ${contadorExitos}`, 50, 120);

            ctxEntrenamiento.font = "14px Arial";
            ctxEntrenamiento.fillStyle = "#888";

            if (estadoPreparacion) {
                ctxEntrenamiento.beginPath();
                ctxEntrenamiento.arc(30, 70, 8, 0, Math.PI * 2);
                ctxEntrenamiento.fillStyle = "cyan";
                ctxEntrenamiento.fill();
            }

            txtAngulo.innerText = Math.round(anguloCodo) + "°";
        }
    } else if (subModoTraining === 'SAQUE') {
        const hR = landmarks[12], eR = landmarks[14], wR = landmarks[16], orejaR = landmarks[8];

        if (hR && eR && wR && orejaR && getVisibility(hR) > 0.1 && getVisibility(wR) > 0.1) {
            const anguloCodo = calcularAngulo(hR, eR, wR);

            // DETECTAR INICIO DE SAQUE (Mano por encima de la cabeza)
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

            // DETECTAR FIN DE SAQUE (Mano baja del hombro)
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
        // --- MODO LÍNEA (TEACHABLE MACHINE) ---
        if (tmModel && !isProcessingTM && ultimoFrameVideo.src && ultimoFrameVideo.naturalWidth > 0) {
            isProcessingTM = true; // Bloquear nuevas predicciones hasta terminar esta

            tmModel.predict(ultimoFrameVideo).then(predictions => {
                if (subModoTraining !== 'LINEA') {
                    isProcessingTM = false;
                    return;
                }
                // Dibujar fondo del panel de feedback
                ctxEntrenamiento.fillStyle = "rgba(0, 0, 0, 0.6)";
                ctxEntrenamiento.fillRect(20, 20, 350, 150);

                ctxEntrenamiento.fillStyle = "white";
                ctxEntrenamiento.font = "bold 20px Arial";
                ctxEntrenamiento.fillText("MODO LÍNEA - CONFIANZA", 40, 50);

                let isPisando = false;
                let maxY = 80;

                // Mostrar todas las clases y sus porcentajes
                predictions.forEach((p, index) => {
                    const prob = (p.probability * 100).toFixed(1);
                    const isWinner = p.probability > 0.5;

                    ctxEntrenamiento.fillStyle = isWinner ? "#fbbf24" : "#aaa";
                    ctxEntrenamiento.font = isWinner ? "bold 18px Arial" : "16px Arial";
                    ctxEntrenamiento.fillText(`${p.className}: ${prob}%`, 40, maxY + (index * 25));

                    if (p.className.toUpperCase().includes("PISANDO") && p.probability > 0.7) {
                        isPisando = true;
                    }
                });

                // Feedback visual gigante si está pisando
                if (isPisando) {
                    ctxEntrenamiento.fillStyle = "rgba(255, 0, 0, 0.3)";
                    ctxEntrenamiento.fillRect(0, 0, canvasEntrenamiento.width, canvasEntrenamiento.height);

                    ctxEntrenamiento.fillStyle = "#ff4444";
                    ctxEntrenamiento.font = "bold 48px Arial";
                    ctxEntrenamiento.textAlign = "center";
                    ctxEntrenamiento.fillText("¡PISANDO LÍNEA!", canvasEntrenamiento.width / 2, canvasEntrenamiento.height - 100);
                    ctxEntrenamiento.textAlign = "start";
                } else {
                    ctxEntrenamiento.fillStyle = "white";
                    ctxEntrenamiento.font = "16px Arial";
                    ctxEntrenamiento.fillText("ESTADO: OK", 40, 150);
                }

                const now = Date.now();
                if (isPisando && now - lastFeedbackTime > 3000) {
                    hablar("¡Pie fuera!");
                    lastFeedbackTime = now;
                }

                isProcessingTM = false; // Liberar semáforo
            }).catch(err => {
                console.error("Error en predicción TM:", err);
                isProcessingTM = false;
            });
        } else if (!isProcessingTM && isTMModelLoading) {
            ctxEntrenamiento.fillStyle = "white";
            ctxEntrenamiento.font = "20px Arial";
            ctxEntrenamiento.fillText("Cargando modelo de detección...", 60, 100);
        } else if (!isProcessingTM && !tmModel) {
            ctxEntrenamiento.fillStyle = "#ff4444";
            ctxEntrenamiento.font = "16px Arial";
            ctxEntrenamiento.fillText("Error: Asegúrate de tener la carpeta 'my_model' en public/", 40, 100);
        }
    }
});

socket.on('submodo-actualizado', (submodo) => {
    subModoTraining = submodo;
    reiniciarDrill(); // Resetear al cambiar/salir de modo

    if (!submodo) {
        document.getElementById('training-title').innerText = "ENTRENAMIENTO";
        hablar("Volviendo a la selección de entrenamiento. Diga Fondo, Saque o Línea para comenzar una serie.");
        dibujarPantallaSeleccionEntrenamiento();
        
        // Ocultar extras al volver a selección
        if (angleDisplay) angleDisplay.style.display = 'none';
        if (trainingTipsContainer) trainingTipsContainer.style.display = 'none';
        if (feedbackBadge) feedbackBadge.style.display = 'none';
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
    } else {
        // En LINEA o selección, ocultamos los extras biomecánicos
        if (angleDisplay) angleDisplay.style.display = 'none';
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
    let radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

// Eliminado duplicado de lastFeedbackTime
// Eliminada evaluarTecnicaFrontal para simplificar según petición de usuario




function dibujarPose(ctx, landmarks) {
    const w = canvasEntrenamiento.width;
    const h = canvasEntrenamiento.height;

    // Obtener colores computados (Canvas no entiende var(--...))
    const accentCol = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#3498db';
    const goldCol = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#fbbf24';

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
