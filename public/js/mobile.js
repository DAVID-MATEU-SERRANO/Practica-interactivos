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