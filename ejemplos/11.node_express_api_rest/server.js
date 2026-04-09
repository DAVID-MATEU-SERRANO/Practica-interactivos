import express from 'express';
import path from 'path';

const app = express();
const PORT = 3000;

// Middleware para procesar JSON en el cuerpo de las peticiones (req.body)
app.use(express.json());

// Servir archivos estáticos (index.html, script.js) desde la carpeta 'public'
app.use(express.static('public'));

// Almacenamiento temporal en memoria (In-memory storage)
let users = [];

// 1. GET: Obtener todos los usuarios
app.get('/api/users', (req, res) => {
    res.json(users);
});

// 2. GET: Obtener un usuario por ID
app.get('/api/users/:id', (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
});

// 3. POST: Crear un nuevo usuario
app.post('/api/users', (req, res) => {
    // Generar un ID básico basado en la longitud del array
    const user = {
        id: users.length + 1,
        name: req.body.name,
        email: req.body.email
    };

    users.push(user);

    // Devolver el usuario creado con estatus 201 (Created)
    res.status(201).json(user);
});

app.listen(PORT, () => {
    console.log(`Servidor de ejemplo SIU corriendo en http://localhost:${PORT}`);
});