import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import 'dotenv/config';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.json());

// --- ALMACENAMIENTO DE ESTADÍSTICAS ---
let matchStats = {
    points: [],
    games: [],
    servidorInicial: null, // null, 'yo', 'rival', 'Nadal'
    startTime: Date.now()
};

const STATS_FILE = path.join(process.cwd(), 'match_stats.json');

function saveStats() {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(matchStats, null, 2));
    } catch (err) {
        console.error("Error guardando estadísticas:", err);
    }
}

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

// Endpoint para recuperar las estadísticas guardadas
app.get('/match-stats', (_, res) => {
    try {
        if (fs.existsSync(STATS_FILE)) {
            const data = fs.readFileSync(STATS_FILE, 'utf8').trim();
            if (data) {
                return res.json(JSON.parse(data));
            }
        }
        res.json(matchStats); // Devolver estructura por defecto si no hay datos
    } catch (err) {
        console.error("Error leyendo estadísticas:", err);
        res.json(matchStats); // Devolver estructura por defecto en lugar de error 500
    }
});

// Servir archivos estáticos desde la carpeta 'public' 
app.use(express.static(path.join(__dirname, 'public')));



io.on('connection', (socket) => {
    console.log('Dispositivo conectado: ' + socket.id);

    // Evento para sincronizar el cambio de modo (Partido/Entrenamiento)
    socket.on('cambiar-modo', (modo) => {
        io.emit('modo-actualizado', modo);
    });

    // Evento para resetear el sistema a la pantalla inicial
    socket.on('resetear-a-inicio', () => {
        // Reiniciar estadísticas del partido
        matchStats = {
            points: [],
            games: [],
            startTime: Date.now()
        };
        saveStats();
        io.emit('modo-actualizado', 'LOBBY');
    });

    // Evento puente para solicitar confirmación de voz al Dashboard
    socket.on('solicitar-confirmacion-salir', () => {
        io.emit('solicitar-confirmacion-salir');
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

        // Guardar el punto en las estadísticas
        matchStats.points.push({
            winner: quien,
            timestamp: Date.now(),
            ...metrics
        });
        saveStats();

        // Notificar a todos los dispositivos (especialmente al Dashboard) con el payload completo
        io.emit('punto-registrado', payload);
    });

    // Evento para deshacer el último punto anotado
    socket.on('deshacer-punto', () => {
        console.log("Evento deshacer-punto recibido");
        if (matchStats.points.length > 0) {
            const lastPoint = matchStats.points.pop();
            
            // Si el punto deshecho cerró un juego, eliminar también el juego de la historia
            if (matchStats.games.length > 0) {
                const lastGame = matchStats.games[matchStats.games.length - 1];
                // Comprobamos si el marcador del juego coincide con el momento del punto
                // Una forma sencilla es ver si el timestamp del juego es posterior o igual al del punto
                if (lastGame.timestamp >= lastPoint.timestamp) {
                    matchStats.games.pop();
                    console.log("Juego deshecho también");
                }
            }
            
            saveStats();
            console.log("Punto deshecho");
            io.emit('punto-deshecho', matchStats);
        }
    });

    // Evento para registrar el fin de un juego
    socket.on('registrar-fin-juego', (gameData) => {
        matchStats.games.push({
            timestamp: Date.now(),
            ...gameData
        });
        saveStats();
    });

    // Evento para cambiar el sub-modo de entrenamiento (Fondo/Saque)
    socket.on('cambiar-submodo', (submodo) => {
        io.emit('submodo-actualizado', submodo);
    });

    // Evento para sincronizar el saque cuando cambia el juego/marcador
    socket.on('notificar-saque', (quien) => {
        io.emit('saque-actualizado', quien);
    });

    // Evento para definir el saque inicial desde el móvil
    socket.on('definir-saque', (quien) => {
        matchStats.servidorInicial = quien;
        saveStats();
        io.emit('saque-definido', quien);
    });

    // Evento para silenciar/activar audio
    socket.on('alternar-audio', (estado) => {
        console.log('Audio: ' + (estado ? 'SILENCIADO' : 'ACTIVADO'));
        io.emit('audio-actualizado', estado);
    });



    // --- MODO ENTRENAMIENTO ---
    socket.on('training-data', (data) => {
        if (data.landmarks) {
        }
        // Reenviamos los landmarks a todos los clientes (el Dashboard los procesará)
        io.emit('training-data', data);
    });

    socket.on('video-frame', (frame) => {
        // Reenviar el frame de video a todos los demás (el portátil)
        io.emit('render-video', frame);
    });

    socket.on('disconnect', () => {
        console.log('Dispositivo desconectado');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});