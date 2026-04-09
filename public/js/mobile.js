const socket = io();
const estadoLabel = document.getElementById('estado');
const controlesPartido = document.getElementById('controles-partido');
const seccionSaque = document.getElementById('seccion-saque');

// Estado interno del móvil para saber si ya se eligió saque
let saqueDefinido = false;

// Actualizar estado al conectar
socket.on('connect', () => {
    estadoLabel.innerText = "Estado: Conectado (" + socket.id + ")";
    estadoLabel.style.color = "green";
});

socket.on('disconnect', () => {
    estadoLabel.innerText = "Estado: Desconectado";
    estadoLabel.style.color = "red";
});

// Función vinculada a los botones del HTML
window.cambiarModo = function (nuevoModo) {
    socket.emit('cambiar-modo', nuevoModo);
};

// Sincronizar UI del móvil con el modo actual
socket.on('modo-actualizado', (modo) => {
    estadoLabel.innerText = "Sincronizado en: " + modo;

    if (modo === 'MODO PARTIDO') {
        // Al entrar en modo partido, si no hay saque definido, mostrar selección
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
        // Resetear estado de saque si salimos del modo partido
        saqueDefinido = false;
    }
});

// Escuchar si el saque se definió (por si hay varios móviles o para sincronizar)
socket.on('saque-definido', (quien) => {
    saqueDefinido = true;
    if (seccionSaque) seccionSaque.style.display = 'none';
    if (controlesPartido) controlesPartido.style.display = 'block';
});

// --- ENVIAR ELECCIÓN DE SAQUE ---
document.getElementById('btn-saque-yo').addEventListener('click', () => {
    socket.emit('definir-saque', 'yo');
});

document.getElementById('btn-saque-rival').addEventListener('click', () => {
    socket.emit('definir-saque', 'rival');
});

// --- ENVIAR PUNTOS ---
document.getElementById('btn-punto-yo').addEventListener('click', () => {
    socket.emit('anotar-punto', 'yo');
});

document.getElementById('btn-punto-rival').addEventListener('click', () => {
    socket.emit('anotar-punto', 'rival');
});

// Escuchar reset global
socket.on('reset-confirmado', () => {
    window.location.reload();
});

// Diagnóstico: Enviar ping al hacer clic
const pingBtn = document.getElementById('pingButton');
if (pingBtn) {
    pingBtn.addEventListener('click', () => {
        socket.emit('ping', { origen: 'movil', t: Date.now() });
    });
}

socket.on('pong', (msg) => {
    console.log("Respuesta del servidor (PONG):", msg);
    alert("¡Conexión del móvil con el servidor correcta (PONG)!");
});

// --- RECONOCIMIENTO DE VOZ EN EL MÓVIL ---
const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
const voiceLabel = document.getElementById('voice-label');

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = 'es-ES';
    recognition.interimResults = false;

    recognition.onstart = () => {
        voiceLabel.innerText = "Escuchando...";
        voiceLabel.style.color = "green";
    };

    recognition.onend = () => {
        try { recognition.start(); } catch (e) { }
    };

    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.toLowerCase().trim();
        const confidence = event.results[last][0].confidence;
        if (confidence < 0.8) return;

        if (transcript.includes("partido")) {
            socket.emit('cambiar-modo', 'MODO PARTIDO');
        } else if (transcript.includes("entrenamiento")) {
            socket.emit('cambiar-modo', 'MODO ENTRENAMIENTO');
        } else if (transcript.includes("salir")) {
            socket.emit('resetear-a-inicio');
        } else if (transcript.includes("silenciar")) {
            socket.emit('alternar-audio', true);
        } else if (transcript.includes("activar")) {
            socket.emit('alternar-audio', false);
        }
    };

    recognition.start();
}