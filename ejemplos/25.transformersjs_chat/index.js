import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.7";

const chatBox = document.getElementById('chat-box');
const input = document.getElementById('input');
const btn = document.getElementById('btn');
const status = document.getElementById('status');

// Historial para mantener la memoria del chat
let messages = [
    { role: "system", content: "Eres un asistente breve y conciso." }
];

// 1. Cargar el modelo
const generator = await pipeline("text-generation", "onnx-community/Qwen2.5-0.5B-Instruct", {
    dtype: "q4",
    device: "webgpu"
});

status.innerText = "Modelo listo.";
input.disabled = false;
btn.disabled = false;

btn.onclick = async () => {
    const text = input.value;
    if (!text) return;

    // Añadir mensaje del usuario a la UI y al historial
    chatBox.innerHTML += `<div><b>Tú:</b> ${text}</div>`;
    messages.push({ role: "user", content: text });
    input.value = "";

    // 2. Generar respuesta
    const result = await generator(messages, { max_new_tokens: 100 });

    // 3. Extraer y guardar la respuesta de la IA
    const aiMessage = result[0].generated_text.at(-1);
    messages.push(aiMessage);

    // Mostrar en la interfaz
    chatBox.innerHTML += `<div><b>IA:</b> ${aiMessage.content}</div>`;
    chatBox.scrollTop = chatBox.scrollHeight;
};