// Importamos la última versión estable de Transformers.js (v3/v4-next)
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.7";

const input = document.querySelector("#input");
const outputDiv = document.querySelector("#output");
const status = document.querySelector("#status");
const btn = document.querySelector("#btn");

// 1. Inicialización del pipeline
// Por defecto usa 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
const classifier = await pipeline('sentiment-analysis');

status.innerText = "Modelo cargado en el navegador.";
status.className = "";

// 2. Función de inferencia
async function runAnalysis() {
    const text = input.value; // Obtenemos el texto del área de texto
    status.innerText = "Analizando...";

    // Inferencia: Todo sucede localmente en el dispositivo
    const output = await classifier(text);

    console.log(output);

    // 3. Renderizado de resultados
    const { label, score } = output[0];
    outputDiv.innerText = `${label} (Confianza: ${(score * 100).toFixed(2)}%)`;
    status.innerText = "Análisis completado.";
}

btn.addEventListener('click', runAnalysis);