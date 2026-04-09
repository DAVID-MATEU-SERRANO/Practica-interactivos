import express from 'express';
import { WebSocketServer } from 'ws';


const app = express();
const PORT = 3000;
app.use(express.static('public'));


app.listen(PORT, () => {
    console.log(`Servidor Express funcionando en http://localhost:${PORT}`);
});

const connectedClients = [];
const wss = new WebSocketServer({ port: 3333 });
wss.on('connection', manageConnection);

function manageConnection(ws) {
    connectedClients.push(ws);
    ws.send('Conexión establecida');
    ws.on('message', handleMessage);
}

function handleMessage(message) {
    console.log(message);
    connectedClients.forEach(function (c) {
        c.send(message);
    });
}
