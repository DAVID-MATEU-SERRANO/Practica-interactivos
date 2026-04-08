const socket = io();
const modoTexto = document.getElementById('modo-texto');

// Escuchar cambios de modo globales
socket.on('modo-actualizado', (modo) => {
    modoTexto.innerText = modo;
});

// Escuchar datos que lleguen desde el móvil
socket.on('render-portatil', (data) => {
    console.log("Datos de sensores recibidos:", data);
});