import express from 'express';

const app = express();
const PORT = 3000;

// Express gestiona automáticamente:
// - Seguridad (impide Path Traversal)
// - Tipos MIME (reconoce cientos de extensiones, no solo 3)
// - Streams internos para eficiencia
// - Cabeceras de caché y ETags
app.use(express.static('public'));

app.get('/about', (req, res) => {
    res.json({ name: 'John Doe', age: 30, course: 'Ubicomp' });
});

app.get('/api/data', (req, res) => {
    res.json({ name: 'John Doe', age: 30, course: 'Ubicomp' });
})

app.listen(PORT, () => {
    console.log(`Servidor Express funcionando en http://localhost:${PORT}`);
});