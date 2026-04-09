// Create WebSocket connection
const socket = new WebSocket('ws://localhost:3333');
// Event: Connection opened
socket.addEventListener('open', () => {
    console.log('Connected to WebSocket server');
    socket.send('Hello from the client!');
});
// Event: Message received from server
socket.addEventListener('message', (event) => {
    console.log('Message from server:', event.data);
});


const btn = document.querySelector('#sendBtn');
btn.addEventListener('click', () => {
    const message = document.querySelector('#messageInput').value;
    socket.send(message);
});


