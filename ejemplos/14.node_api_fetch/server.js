import express from 'express';


const app = express();
const PORT = 3000;

// Middleware para procesar JSON en el cuerpo de las peticiones (req.body)
app.use(express.json());

// Servir archivos estáticos (index.html, script.js) desde la carpeta 'public'
app.use(express.static('public'));


app.get('/mi/ruta', (req, res) => {
    res.send("Hola, Mundo!");
    res.end();
});


app.listen(PORT, () => {
    console.log(`Servidor de ejemplo SIU corriendo en http://localhost:${PORT}`);
});