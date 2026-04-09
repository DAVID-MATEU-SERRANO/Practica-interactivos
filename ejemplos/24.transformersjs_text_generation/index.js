import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.7";

const status = document.getElementById('status');
const input = document.getElementById('input');
const btn = document.getElementById('btn');
const output = document.getElementById('output');

// 1. Configuración del generador
// dtype: "q4" -> Cuantización a 4 bits (ahorro de memoria)
// device: "webgpu" -> Ejecución en la tarjeta gráfica
const generator = await pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct", {
    dtype: "q4",
    device: "webgpu"
});

status.innerText = "Estado: Modelo listo en GPU.";
input.disabled = false;
btn.disabled = false;

btn.onclick = async () => {
    const prompt = input.value;
    output.innerText = "Generando...";

    // Estructura de chat para modelos tipo "Instruct"
    const messages = [{ role: "user", content: prompt }];

    // Inferencia
    const result = await generator(messages, { max_new_tokens: 50 });

    // Extraemos el contenido de la respuesta
    output.innerText = result[0].generated_text.at(-1).content;
};