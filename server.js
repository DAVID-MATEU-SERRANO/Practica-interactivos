import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

// Servir archivos estáticos desde la carpeta 'public' 
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Dispositivo conectado: ' + socket.id);

    // Evento para sincronizar el cambio de modo (Partido/Entrenamiento)
    socket.on('cambiar-modo', (modo) => {
        console.log('Cambiando sistema a modo: ' + modo);
        io.emit('modo-actualizado', modo);
    });

    // Evento para retransmitir datos de sensores del móvil al portátil [cite: 34]
    socket.on('datos-sensor', (data) => {
        socket.broadcast.emit('render-portatil', data);
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});