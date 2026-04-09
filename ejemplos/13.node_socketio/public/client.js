const socket = io();

const form = document.querySelector('#form');
const input = document.querySelector('#input');
const messages = document.querySelector('#messages');

// Enviar mensaje al servidor
form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        socket.emit('message', input.value);
        input.value = '';
    }
});

document.querySelector('#pingButton').addEventListener('click', () => {
    socket.emit('ping', { a: 1, b: "ACK" });
});

// Escuchar mensajes provenientes del servidor
socket.on('message', (msg) => {
    const item = document.createElement('li');
    item.textContent = msg;
    messages.appendChild(item);
    // Auto-scroll al último mensaje
    window.scrollTo(0, document.body.scrollHeight);
});

socket.on('pong', (msg) => {
    console.log(msg);
});