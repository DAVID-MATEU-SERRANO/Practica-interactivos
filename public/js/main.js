const socket = io();
const modoTexto = document.getElementById('modo-texto');

// Generar código QR para conectar el móvil
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

// Escuchar cambios de modo globales
socket.on('modo-actualizado', (modo) => {
    modoTexto.innerText = modo;
});

// Escuchar datos que lleguen desde el móvil
socket.on('render-portatil', (data) => {
    console.log("Datos de sensores recibidos:", data);
});

// Diagnóstico: Enviar ping al hacer clic
document.getElementById('pingButton').addEventListener('click', () => {
    socket.emit('ping', { origen: 'portatil', t: Date.now() });
});

// Diagnóstico: Escuchar el pong del servidor
socket.on('pong', (msg) => {
    console.log("Respuesta del servidor (PONG):", msg);
    alert("¡Conexión con el servidor correcta (PONG)!");
});