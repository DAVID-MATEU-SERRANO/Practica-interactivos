// Eliminado Transformers.js local para usar DeepSeek en el servidor

const socket = io();
const modoTexto = document.getElementById('modo-texto');

// Referencias a la UI Base
const startOverlay = document.getElementById('start-overlay');
const btnIniciar = document.getElementById('btn-iniciar');
const dashboardContent = document.getElementById('dashboard-content');
const marcadorPartido = document.getElementById('marcador-partido');
const avisoPista = document.getElementById('aviso-pista');
const qrSection = document.getElementById('qr-section');
const statusContainer = document.getElementById('status-container');
const pingButton = document.getElementById('pingButton');

// Referencias al Marcador
const uiPuntos = { yo: document.getElementById('puntos-yo'), rival: document.getElementById('puntos-rival') };
const uiSaque = { yo: document.getElementById('saque-yo'), rival: document.getElementById('saque-rival') };

// UI Métricas
const uiMetrics = {
    power: document.getElementById('metric-power'),
    strokes: document.getElementById('metric-strokes'),
    trajectory: document.getElementById('metric-traj'),
    duration: document.getElementById('metric-dur'),
    reason: document.getElementById('metric-reason'),
    listaGolpes: document.getElementById('lista-golpes')
};

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
    inicioUltimoJuego: Date.now(), // Tracking de duración de juego
    gameHistory: [] // Registro de duraciones de juegos
};

// Referencias Stats Overlay
const statsOverlay = document.getElementById('stats-overlay');
const btnCloseStats = document.getElementById('close-stats');
if (btnCloseStats) btnCloseStats.onclick = () => statsOverlay.classList.remove('visible');

const labelsPuntos = ["0", "15", "30", "40", "AD"];

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

// --- INICIO DEL SISTEMA ---
if (btnIniciar) {
    btnIniciar.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        dashboardContent.style.display = 'block';

        fetch('/ip')
            .then(response => response.json())
            .then(data => {
                const mobileUrl = `http://${data.ip}:3000/mobile.html`;
                new QRCode(document.getElementById("qrcode"), {
                    text: mobileUrl, width: 128, height: 128,
                    colorDark: "#2c3e50", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            })
            .catch(err => console.error("Error obteniendo IP:", err));

        hablar("Bienvenido");
        recuperarEstadisticas();
    });
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
    partido.quienSaca = (quien === 'yo') ? 0 : 1;
    partido.servidorInicialSet = partido.quienSaca;
    actualizarMarcadorUI();
    hablar("Saque inicial definido. Empieza sacando " + (quien === 'yo' ? "usted" : "el rival"));
});

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

    // Actualizar UI de métricas
    if (metrics && metrics.strokes && metrics.strokes.length > 0) {
        const strokes = metrics.strokes;
        const totalStrokes = strokes.length;

        // Calcular potencia media
        const avgPower = strokes.reduce((acc, s) => acc + parseFloat(s.power), 0) / totalStrokes;

        // Última trayectoria (la del golpe ganador)
        const lastTraj = strokes[totalStrokes - 1].trajectory;

        uiMetrics.power.innerText = avgPower.toFixed(1) + "G";
        uiMetrics.strokes.innerText = totalStrokes;
        uiMetrics.trajectory.innerText = lastTraj;
        uiMetrics.duration.innerText = metrics.duracion_punto;
        uiMetrics.reason.innerText = metrics.motivo || "--";

        // Mostrar detalles individuales
        uiMetrics.listaGolpes.innerHTML = "";
        strokes.forEach((s, idx) => {
            const span = document.createElement('span');
            span.className = 'stroke-pill';
            span.innerHTML = `<strong>G${idx + 1}:</strong> ${s.power}G <small>(${s.trajectory})</small>`;
            uiMetrics.listaGolpes.appendChild(span);
        });
    }

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
    verificarCambioPista();
});

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
        duracion: duracionJuego
    };
    socket.emit('registrar-fin-juego', payload);

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
    const sumaJuegos = partido.games[0] + partido.games[1];
    const esCambio = (sumaJuegos % 2 !== 0);
    avisoPista.style.display = esCambio ? 'block' : 'none';

    // Si es cambio de pista y el juego acaba de terminar (puntos a 0)
    if (esCambio && partido.puntos[0] === 0 && partido.puntos[1] === 0) {
        mostrarEstadisticas("Descanso de Pista");
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
            if (m.motivo === 'Winner' && m.strokes.length === 1 && m.strokes[0].trajectory.includes('SAQUE')) {
                stats.serves.aces++;
            }
        }
        if (p.ganador === 'rival' && m.motivo === 'Doble Falta') {
            stats.serves.doubleFaults++;
        }
        
        // Primeros saques dentro (Aproximación: si no hubo Segundo Saque gestual)
        // Nota: En un sistema real trackearíamos cada intento de saque.
        // Aquí asumimos que si se anotó punto sin marcar 'media', el 1er saque entró.
        const huboSegundo = m.strokes.some(s => s.trajectory === '2º SAQUE');
        if (!huboSegundo) {
            stats.serves.firstIn++;
        }
        stats.serves.firstTotal++;

        // Potencia y Golpes
        m.strokes.forEach(s => {
            const pwr = parseFloat(s.power);
            stats.power.sum += pwr;
            stats.power.count++;
            if (pwr > stats.power.max) {
                stats.power.max = pwr;
                stats.power.maxDetail = `${s.side} ${s.trajectory}`;
            }
        });

        // Clasificación Winners / Errores (Solo para 'Yo')
        if (m.motivo === 'Winner' && p.ganador === 'yo') {
            stats.winners.total++;
            const last = m.strokes[m.strokes.length - 1];
            if (last) {
                if (last.side === 'DERECHA') stats.winners.der++;
                else stats.winners.rev++;
                const key = `${last.side} ${last.trajectory}`;
                stats.winners.tipos[key] = (stats.winners.tipos[key] || 0) + 1;
            }
        } else if (m.motivo === 'Fallo Mío' && p.ganador === 'rival') {
            stats.errors.total++;
            const last = m.strokes[m.strokes.length - 1];
            if (last) {
                if (last.side === 'DERECHA') stats.errors.der++;
                else stats.errors.rev++;
                const key = `${last.side} ${last.trajectory}`;
                stats.errors.tipos[key] = (stats.errors.tipos[key] || 0) + 1;
            }
        }
    });

    return stats;
}

function mostrarEstadisticas(titulo) {
    const globalHistory = partido.matchHistory;
    let currentPoints = [];
    let baselinePoints = null;
    let isSetSummary = titulo.startsWith("Fin del Set");
    let setIndexComp = -1;

    if (isSetSummary) {
        // Extraer número de set (e.g., "Fin del Set 1" -> index 0)
        const match = titulo.match(/Fin del Set (\d+)/);
        if (match) {
            setIndexComp = parseInt(match[1]) - 1;
            currentPoints = globalHistory.filter(p => p.setIndex === setIndexComp);
            // Si es Set 2 o 3, comparamos con los sets anteriores
            if (setIndexComp > 0) {
                baselinePoints = globalHistory.filter(p => p.setIndex < setIndexComp);
            }
        }
    } else {
        // Descanso de Pista: último tramo vs todo el partido
        currentPoints = globalHistory.slice(partido.ultimoIndiceDescanso);
        baselinePoints = globalHistory;
        partido.ultimoIndiceDescanso = globalHistory.length;
    }
    
    const statsCurrent = calcularEstadisticas(currentPoints);
    const statsBaseline = baselinePoints ? calcularEstadisticas(baselinePoints) : null;
    
    document.getElementById('stats-moment').innerText = titulo;

    // --- Helper para Deltas ---
    const getDelta = (curr, baseline) => {
        if (!baseline || baseline === 0 || isNaN(baseline) || !isFinite(baseline)) return 0;
        const c = parseFloat(curr) || 0;
        const b = parseFloat(baseline);
        return ((c - b) / b * 100).toFixed(0);
    };

    const updateValueWithDelta = (id, curr, globValue, inverse = false) => {
        const el = document.getElementById(id);
        if (!el) return;
        
        let deltaText = "";
        let colorClass = "";

        if (statsBaseline) {
            // Normalizar el valor del baseline al volumen de puntos actual para que la comparación sea justa
            const normalizationFactor = (baselinePoints.length / (currentPoints.length || 1)) || 1;
            const normalizedBaseline = globValue / normalizationFactor;
            
            const delta = getDelta(curr, normalizedBaseline);
            colorClass = delta >= 0 ? 'positive' : 'negative';
            if (inverse) colorClass = delta <= 0 ? 'positive' : 'negative'; 
            deltaText = `(${delta >= 0 ? '+' : ''}${delta}%)`;
        }
        
        el.querySelector('.value').innerHTML = `${curr} <small class="delta ${colorClass}">${deltaText}</small>`;
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
    document.getElementById('stat-error-rate').querySelector('.value').innerText = errorRate + "%";

    document.getElementById('sub-err-der').innerText = statsCurrent.errors.der;
    document.getElementById('sub-err-rev').innerText = statsCurrent.errors.rev;

    // Saque
    const firstServePct = statsCurrent.serves.firstTotal > 0 ? (statsCurrent.serves.firstIn / statsCurrent.serves.firstTotal * 100).toFixed(0) : 0;
    document.getElementById('stat-first-serve').innerText = firstServePct + "%";
    document.getElementById('stat-aces').innerText = statsCurrent.serves.aces;
    document.getElementById('stat-double-faults').innerText = statsCurrent.serves.doubleFaults;

    // Potencia
    const avgPwr = statsCurrent.power.count > 0 ? (statsCurrent.power.sum / statsCurrent.power.count).toFixed(1) : 0;
    
    let pwrDeltaText = "";
    let pwrClass = "";
    if (statsBaseline && statsBaseline.power.count > 0) {
        const globAvgPwr = statsBaseline.power.sum / statsBaseline.power.count;
        const pwrDelta = getDelta(avgPwr, globAvgPwr);
        pwrClass = pwrDelta >= 0 ? 'positive' : 'negative';
        pwrDeltaText = `(${pwrDelta >= 0 ? '+':''}${pwrDelta}%)`;
    }
    
    document.getElementById('stat-power-avg').innerHTML = `${avgPwr}G <small class="delta ${pwrClass}">${pwrDeltaText}</small>`;
    
    document.getElementById('stat-power-max').innerText = statsCurrent.power.max + "G";
    document.getElementById('stat-power-max-desc').innerText = statsCurrent.power.maxDetail || "--";

    // Tiempos
    const avgTime = statsCurrent.time.pointCount > 0 ? (statsCurrent.time.pointSum / statsCurrent.time.pointCount).toFixed(1) : 0;
    document.getElementById('stat-time-point').innerText = avgTime + "s";
    
    // Tiempo medio por juego
    const playedGames = partido.gameHistory;
    if (playedGames.length > 0) {
        const avgGameTime = (playedGames.reduce((acc, g) => acc + g.duracion, 0) / playedGames.length).toFixed(0);
        document.getElementById('stat-time-game').innerText = avgGameTime + "s";
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

socket.on('modo-actualizado', (modo) => {
    if (modoTexto) modoTexto.innerText = modo;

    if (modo === "MODO PARTIDO") {
        document.body.classList.add('match-active');
        marcadorPartido.style.display = 'block';
        qrSection.style.display = 'none';
        statusContainer.style.display = 'none';
        if (pingButton) pingButton.style.display = 'none';

        if (partido.quienSaca === null) {
            hablar("Modo partido activado.");
        }
    } else {
        document.body.classList.remove('match-active');
        marcadorPartido.style.display = 'none';
        qrSection.style.display = 'block';
        statusContainer.style.display = 'block';
        if (pingButton) pingButton.style.display = 'block';
    }
});

socket.on('reset-confirmado', () => {
    hablar("Volviendo a la pantalla de inicio.");
    setTimeout(() => { window.location.reload(); }, 2000);
});

function hablar(mensaje) {
    if (partido.estaSilenciado) return;
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-ES';
    synth.speak(utterance);
}