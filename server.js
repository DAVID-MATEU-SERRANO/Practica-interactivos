import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Obtener la IP local para el QR
app.get('/ip', (req, res) => {
    const networks = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(networks)) {
        for (const net of networks[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
                break;
            }
        }
    }
    res.json({ ip: localIp });
});

// Servir archivos estáticos desde la carpeta 'public' 
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Dispositivo conectado: ' + socket.id);

    // Evento para sincronizar el cambio de modo (Partido/Entrenamiento)
    socket.on('cambiar-modo', (modo) => {
        console.log('Cambiando sistema a modo: ' + modo);
        io.emit('modo-actualizado', modo);
    });

    // Evento para retransmitir datos de sensores del móvil al portátil
    socket.on('datos-sensor', (data) => {
        socket.broadcast.emit('render-portatil', data);
    });

    // Diagnóstico: evento 'ping' del ejemplo de referencia
    socket.on('ping', (msg) => {
        console.log('Ping recibido: ', JSON.stringify(msg));
        socket.emit('pong', 'pong');
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});