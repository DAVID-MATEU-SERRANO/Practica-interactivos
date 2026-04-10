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

// --- ALMACENAMIENTO DE ESTADÍSTICAS ---
let matchStats = {
    points: [],
    games: []
};

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

    // Evento para resetear el sistema a la pantalla inicial
    socket.on('resetear-a-inicio', () => {
        console.log('Reseteando sistema a inicio');
        io.emit('reset-confirmado');
    });

    // Evento para retransmitir datos de sensores del móvil al portátil
    socket.on('datos-sensor', (data) => {
        socket.broadcast.emit('render-portatil', data);
    });

    // Evento para anotar puntos en modo partido con métricas
    socket.on('anotar-punto', (payload) => {
        let quien, metrics;
        if (typeof payload === 'string') {
            quien = payload;
            metrics = {};
        } else {
            quien = payload.quien;
            metrics = payload.metrics;
        }

        console.log(`\n🎾 PUNTO PARA: ${quien.toUpperCase()}`);
        if (metrics.strokes) {
            console.log(`   - Golpes totales: ${metrics.strokes.length}`);
            metrics.strokes.forEach((s, i) => {
                console.log(`   - Golpe ${i+1}: ${s.power}G | ${s.trajectory} | Dir: ${s.yaw}°`);
            });
        }
        console.log(`   - Duración: ${metrics.duracion_punto}\n`);
        
        // Guardar el punto en las estadísticas
        matchStats.points.push({
            winner: quien,
            timestamp: Date.now(),
            ...metrics
        });

        io.emit('punto-registrado', quien);
    });

    // Evento para registrar el fin de un juego
    socket.on('registrar-fin-juego', (gameData) => {
        console.log('Juego finalizado:', gameData);
        matchStats.games.push({
            timestamp: Date.now(),
            ...gameData
        });
    });

    // Evento para definir el saque inicial desde el móvil
    socket.on('definir-saque', (quien) => {
        console.log('Saque inicial definido por el móvil: ' + quien);
        io.emit('saque-definido', quien);
    });

    // Evento para silenciar/activar audio
    socket.on('alternar-audio', (estado) => {
        console.log('Audio: ' + (estado ? 'SILENCIADO' : 'ACTIVADO'));
        io.emit('audio-actualizado', estado);
    });

    // Diagnóstico: evento 'ping' del ejemplo de referencia
    socket.on('ping', (msg) => {
        console.log('Ping recibido: ', JSON.stringify(msg));
        socket.emit('pong', 'pong');
    });

    socket.on('debug-logs', (msg) => {
        console.log(`🔍 [DEBUG MÓVIL] ${msg}`);
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});