const socket = io();
const estadoLabel = document.getElementById('estado');

// Función vinculada a los botones del HTML
window.cambiarModo = function (nuevoModo) {
    socket.emit('cambiar-modo', nuevoModo);
};

// Confirmación de sincronización
socket.on('modo-actualizado', (modo) => {
    estadoLabel.innerText = "Sincronizado en: " + modo;
});