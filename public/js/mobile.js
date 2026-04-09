const socket = io();
const estadoLabel = document.getElementById('estado');

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

// Confirmación de sincronización
socket.on('modo-actualizado', (modo) => {
    estadoLabel.innerText = "Sincronizado en: " + modo;
});

// Diagnóstico: Enviar ping al hacer clic
document.getElementById('pingButton').addEventListener('click', () => {
    socket.emit('ping', { origen: 'movil', t: Date.now() });
});

// Diagnóstico: Escuchar el pong del servidor
socket.on('pong', (msg) => {
    console.log("Respuesta del servidor (PONG):", msg);
    alert("¡Conexión del móvil con el servidor correcta (PONG)!");
});

// Escuchar reset global
socket.on('reset-confirmado', () => {
    window.location.reload(); // Recargar para volver al estado inicial/QR
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
        try {
            recognition.start(); // Reiniciar para escucha continua
        } catch (e) {
            console.log("Reconocimiento ya estaba activo");
        }
    };

    recognition.onerror = (event) => {
        console.error("Error en reconocimiento móvil:", event.error);
        voiceLabel.innerText = "Error: " + event.error;
        voiceLabel.style.color = "red";
    };

    recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.toLowerCase().trim();
        const confidence = event.results[last][0].confidence;

        console.log(`Voz móvil: "${transcript}" (Confianza: ${confidence})`);

        if (confidence < 0.8) return;

        if (transcript.includes("partido")) {
            socket.emit('cambiar-modo', 'MODO PARTIDO');
        } else if (transcript.includes("entrenamiento")) {
            socket.emit('cambiar-modo', 'MODO ENTRENAMIENTO');
        } else if (transcript.includes("salir")) {
            socket.emit('resetear-a-inicio');
        }
    };

    recognition.start();
} else {
    voiceLabel.innerText = "Voz no soportada.";
    voiceLabel.style.color = "orange";
}