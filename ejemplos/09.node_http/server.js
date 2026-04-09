import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

// Responsabilidad del programador
const requestListener = (req, res) => {
    const { method, url } = req;

    // 1. FILTRADO POR MÉTODO: Solo aceptamos GET
    if (method !== 'GET') {
        res.writeHead(405);
        return res.end('Método no permitido');
    }

    // 2. SEGURIDAD DE RUTAS: Evitar que salgan de la carpeta pública
    if (url === '/') {
        const indexHtmlPath = path.join(process.cwd(), 'public', 'index.html');
        const indexHtml = fs.readFileSync(indexHtmlPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(indexHtml);
    }

    const safePath = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
    const imagePath = path.join(process.cwd(), 'public', safePath);

    const ext = path.extname(imagePath).toLowerCase();
    const imageTypes = { '.jpg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.ico': 'image/x-icon' };

    // 3. VALIDACIÓN DE EXTENSIÓN
    if (!ext || !imageTypes[ext]) {
        res.writeHead(400);
        return res.end('Tipo de archivo no soportado o ruta invalida');
    }

    // 4. GESTIÓN DE EXISTENCIA Y STREAMS (Eficiencia + Control)
    fs.access(imagePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404: La imagen no existe en el servidor');
            return;
        }

        // Enviamos las cabeceras manuales
        res.writeHead(200, { 'Content-Type': imageTypes[ext] || 'application/octet-stream' });

        // Usamos Streams
        const stream = fs.createReadStream(imagePath);

        // Manejo manual de errores del stream
        stream.on('error', () => {
            res.writeHead(500);
            res.end('Error interno al leer el archivo');
        });

        stream.pipe(res);
    });
};

const server = http.createServer(requestListener);
server.listen(3000, () => console.log('Servidor en http://localhost:3000'));