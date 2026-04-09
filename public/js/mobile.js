const socket = io();
const estadoLabel = document.getElementById('estado');
const controlesPartido = document.getElementById('controles-partido');
const seccionSaque = document.getElementById('seccion-saque');
const feedbackGesto = document.getElementById('feedback-gesto');
const btnIniciar = document.getElementById('btn-iniciar');
const startOverlay = document.getElementById('start-overlay');
const mobileContent = document.getElementById('mobile-content');

// --- CONFIGURACIÓN DE GESTOS ---
const UMBRAL_GESTO = 35;
const TIEMPO_MIN_ENTRE_GOLPES = 200; 
const VENTANA_CONFIRMACION = 600; 
const COOLDOWN_PUNTO = 1500; 
const AISLAMIENTO_EJE = 3.5; 

// Estado interno
let saqueDefinido = false;
let modoActual = '';
let lastStrikeTime = 0;
let golpeCount = 0;
let confirmTimer = null;
let lockGestos = false;

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
    }
});

socket.on('saque-definido', (quien) => {
    saqueDefinido = true;
    if (seccionSaque) seccionSaque.style.display = 'none';
    if (controlesPartido) controlesPartido.style.display = 'block';
});

// --- LÓGICA DE SENSORES ---
function activarSensores() {
    const SensorType = window.LinearAccelerationSensor || window.Accelerometer;
    if (SensorType) {
        try {
            const sensor = new SensorType({ frequency: 60 });
            sensor.onreading = () => {
                if (lockGestos || modoActual !== 'MODO PARTIDO' || !saqueDefinido) return;
                const ax = sensor.x;
                const ay = sensor.y;
                const az = sensor.z;
                const now = Date.now();

                if (ay < -UMBRAL_GESTO && 
                    Math.abs(ay) > Math.abs(ax) * AISLAMIENTO_EJE && 
                    Math.abs(ay) > Math.abs(az) * AISLAMIENTO_EJE) {
                    
                    if (now - lastStrikeTime < TIEMPO_MIN_ENTRE_GOLPES) return;
                    lastStrikeTime = now;
                    golpeCount++;
                    if (navigator.vibrate) navigator.vibrate(40);
                    mostrarFeedback(golpeCount);

                    if (confirmTimer) clearTimeout(confirmTimer);
                    confirmTimer = setTimeout(() => {
                        if (golpeCount === 2) ejecutarPuntoGesto('yo');
                        else if (golpeCount >= 3) ejecutarPuntoGesto('rival');
                        else { golpeCount = 0; feedbackGesto.innerText = ""; }
                    }, VENTANA_CONFIRMACION);
                }
            };
            sensor.onerror = (event) => console.error("Error sensor:", event.error.name);
            sensor.start();
        } catch (err) { console.error("No se pudo iniciar sensores:", err); }
    }
}

function mostrarFeedback(count) {
    feedbackGesto.innerText = `GOLPE ${count} DETECTADO...`;
    document.body.classList.add('flash-abajo');
    setTimeout(() => { document.body.classList.remove('flash-abajo'); }, 200);
}

function ejecutarPuntoGesto(destino) {
    lockGestos = true;
    feedbackGesto.innerText = `✅ PUNTO PARA: ${destino.toUpperCase()}`;
    socket.emit('anotar-punto', destino);
    golpeCount = 0;
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