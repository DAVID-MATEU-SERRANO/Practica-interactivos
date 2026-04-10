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
    estaSilenciado: false
};

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
    });
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
}

function verificarServidorTieBreak() {
    const totalPuntos = partido.tieBreakPoints[0] + partido.tieBreakPoints[1];
    const baseServer = partido.servidorInicialSet;
    const currentServer = (Math.floor((totalPuntos + 1) / 2) % 2 === 0) ? baseServer : 1 - baseServer;
    partido.quienSaca = currentServer;
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

    // Notificar al móvil que el juego ha terminado para que guarde estadísticas
    socket.emit('registrar-fin-juego', {
        ganador: w === 0 ? 'yo' : 'rival',
        marcador: `${partido.games[0]}-${partido.games[1]}`
    });

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
        setTimeout(() => {
            hablar(`Partido ${w === 0 ? "usted" : "rival"}.`);
        }, 1000);
    } else {
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
    avisoPista.style.display = (sumaJuegos % 2 !== 0) ? 'block' : 'none';
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