import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import 'dotenv/config';

// Variables globales
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa la aplicación
const app = express();
const server = createServer(app);
const io = new Server(server);
app.use(express.json());

// Almacenamiento del estado del servidor
let modoActual = 'LOBBY';
let subModoActual = null; // Para entrenamiento
let matchStats = {
    points: [],
    games: [],
    servidorInicial: null,
    startTime: Date.now()
};

// Archivo para guardar las estadísticas del partido
const STATS_FILE = path.join(process.cwd(), 'match_stats.json');

// Guarda las estadísticas en el archivo (se reinicia cada vez que se comienza un partido)
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

// Recuperamos estadísticas del json 
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

// Conexión de Socket.IO
io.on('connection', (socket) => {
    // Evento para sincronizar el cambio de modo (Partido/Entrenamiento)
    socket.on('cambiar-modo', (modo) => {
        // Solo se puede cambiar de modo desde el LOBBY
        const desdelobby = (modoActual === 'LOBBY' || modoActual === '');
        const aModoPrincipal = (modo === 'MODO PARTIDO' || modo === 'MODO ENTRENAMIENTO');

        if (aModoPrincipal && !desdelobby) {
            return; // Ignorar la petición ya que no se puede realizar ese cambio
        }

        // Actualizamos el modo y lo enviamos a todos los dispositivos
        modoActual = modo;
        io.emit('modo-actualizado', modo);
    });

    // Evento para resetear el sistema al Lobby
    socket.on('resetear-a-inicio', () => {
        // Reiniciamos las estadísticas del partido
        matchStats = {
            points: [],
            games: [],
            servidorInicial: null,
            startTime: Date.now()
        };
        saveStats();
        modoActual = 'LOBBY';
        subModoActual = null;
        // Enviamos el cambio de modo a todos los dispositivos
        io.emit('modo-actualizado', 'LOBBY');
    });

    // Evento puente para solicitar confirmación de voz al salir del partido
    socket.on('solicitar-confirmacion-salir', () => {
        io.emit('solicitar-confirmacion-salir');
    });

    // Evento para anotar puntos en modo partido con métricas
    socket.on('anotar-punto', (payload) => {
        // Obtenemos el ganador y las métricas
        let quien, metrics;
        if (typeof payload === 'string') {
            quien = payload;
            metrics = {};
        } else {
            quien = payload.quien;
            metrics = payload.metrics;
        }
        // Guardamos el punto en las estadísticas
        matchStats.points.push({
            winner: quien,
            timestamp: Date.now(),
            ...metrics
        });
        saveStats();

        // Enviamos el punto registrado a todos los dispositivos
        io.emit('punto-registrado', payload);
    });

    // Evento para deshacer el último punto anotado
    socket.on('deshacer-punto', () => {
        if (matchStats.points.length > 0) {
            matchStats.points.pop(); // Quitamos el último punto
            saveStats();
            io.emit('punto-deshecho', matchStats);
        }
    });

    // Evento para registrar el fin de un juego
    socket.on('registrar-fin-juego', (gameData) => {
        // Solo guardamos cuando el dato incluye la duración (viene del móvil)
        if (gameData.duracion === undefined) {
            // Es la señal del portatil, hacemos broadcast para que el móvil calcule
            socket.broadcast.emit('registrar-fin-juego', gameData);
            return;
        }
        // Tiene duración: viene del móvil, guardamos
        matchStats.games.push({
            timestamp: Date.now(),
            ...gameData
        });
        saveStats();
        // Avisamos que hemos guardado el juego correctamente para que el portatil guarde la stats
        io.emit('juego-guardado', gameData);
    });

    // Evento para sincronizar los juegos re-calculados
    socket.on('sync-games', (games) => {
        matchStats.games = games;
        saveStats();
    });

    socket.on('cambiar-submodo', (submodo) => {
        // Solo se puede saltar a un submodo si no hay ninguno activo
        if (submodo !== null && subModoActual !== null && submodo !== subModoActual) {
            return; // Evitar cambios de submodo no permitidos
        }
        if (submodo === subModoActual) return; // Evitar reenviar el mismo estado y crear bucle
        // Actualizamos el submodo y lo enviamos a todos los dispositivos
        subModoActual = submodo;
        io.emit('submodo-actualizado', submodo);
    });

    // Evento para sincronizar el saque cuando cambia el juego/marcador
    socket.on('notificar-saque', (quien) => {
        io.emit('saque-actualizado', quien);
    });

    // Evento para definir el saque inicial desde el móvil
    socket.on('definir-saque', (quien) => {
        // Reiniciar estadísticas al comenzar un partido nuevo
        matchStats = {
            points: [],
            games: [],
            servidorInicial: quien,
            startTime: Date.now()
        };
        saveStats();
        io.emit('saque-definido', quien);
    });

    // Evento para silenciar/activar audio
    socket.on('alternar-audio', (estado) => {
        io.emit('audio-actualizado', estado);
    });

    // Evento para reiniciar el drill
    socket.on('reiniciar-drill', () => {
        io.emit('reiniciar-drill');
    });

    // Evento para recibir los datos del entrenamiento
    socket.on('training-data', (data) => {
        // Reenviamos los landmarks a todos los clientes
        io.emit('training-data', data);
    });

    // Evento para recibir el frame de video
    socket.on('video-frame', (frame) => {
        io.emit('render-video', frame);
    });
});

// Puerto en el que corre el servidor, añadimos texto de depuración
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});