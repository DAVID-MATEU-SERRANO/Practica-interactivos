const socket = io();
const modoTexto = document.getElementById('modo-texto');

// Referencias a la UI
const startOverlay = document.getElementById('start-overlay');
const btnIniciar = document.getElementById('btn-iniciar');
const dashboardContent = document.getElementById('dashboard-content');

// El sistema se inicia SOLO cuando el usuario pulsa el botón (para activar el audio)
btnIniciar.addEventListener('click', () => {
    // 1. Ocultar overlay y mostrar contenido
    startOverlay.style.display = 'none';
    dashboardContent.style.display = 'block';

    // 2. Generar código QR para conectar el móvil (solo ahora que el sistema "arranca")
    fetch('/ip')
        .then(response => response.json())
        .then(data => {
            const mobileUrl = `http://${data.ip}:3000/mobile.html`;
            console.log("Generando QR para:", mobileUrl);
            new QRCode(document.getElementById("qrcode"), {
                text: mobileUrl,
                width: 128,
                height: 128,
                colorDark: "#2c3e50",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        })
        .catch(err => console.error("Error obteniendo IP:", err));

    // 3. Hablar bienvenida (ahora el navegador lo permite por la interacción previa)
    hablar("Bienvenido al sistema de Tenis Inteligente. Por favor, indique qué modo desea iniciar o escanea el código QR con su móvil.");
});

// --- GESTIÓN DE MODOS Y FEEDBACK AUDITIVO (Laptop) ---

// Escuchar cambios de modo globales
socket.on('modo-actualizado', (modo) => {
    if (!modoTexto) return;
    modoTexto.innerText = modo;
    
    // El portátil habla cuando el modo se actualiza (orden del móvil)
    if (modo === "MODO PARTIDO") {
        hablar("Modo partido activado. Suerte en el encuentro.");
    } else if (modo === "MODO ENTRENAMIENTO") {
        hablar("Modo entrenamiento activado. Vamos a mejorar esa técnica.");
    }
});

// Escuchar reset global
socket.on('reset-confirmado', () => {
    hablar("Volviendo a la pantalla de inicio.");
    setTimeout(() => {
        window.location.reload(); 
    }, 2000); // Dar tiempo a que termine de hablar antes de recargar
});

// Escuchar datos que lleguen desde el móvil
socket.on('render-portatil', (data) => {
    console.log("Datos de sensores recibidos:", data);
});

// Diagnóstico: Enviar ping al hacer clic
const pingBtn = document.getElementById('pingButton');
if (pingBtn) {
    pingBtn.addEventListener('click', () => {
        socket.emit('ping', { origen: 'portatil', t: Date.now() });
    });
}

// Escuchar el pong del servidor
socket.on('pong', (msg) => {
    console.log("Respuesta del servidor (PONG):", msg);
    alert("¡Conexión con el servidor correcta (PONG)!");
});

// Función para que el portátil hable
window.hablar = function(mensaje) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(mensaje);
    utterance.lang = 'es-ES';
    synth.speak(utterance);
};