import { pipeline, TextStreamer } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.7";

const chatBox = document.getElementById('chat-box');
const input = document.getElementById('input');
const btn = document.getElementById('btn');
const status = document.getElementById('status');

let messages = [{ role: "system", content: "Eres un asistente de IA." }];

// 1. Cargar el generador
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

    chatBox.innerHTML += `<div><b>Tú:</b> ${text}</div>`;
    messages.push({ role: "user", content: text });
    input.value = "";

    // Crear el contenedor para la respuesta
    const aiDiv = document.createElement('div');
    aiDiv.innerHTML = `<b>IA:</b> <span class="ai-content"></span>`;
    chatBox.appendChild(aiDiv);
    const aiSpan = aiDiv.querySelector('.ai-content');

    let fullResponse = "";

    // 2. Configurar el STREAMER
    // El callback se ejecuta por cada token generado
    const streamer = new TextStreamer(generator.tokenizer, {
        skip_prompt: true, // No repetir la pregunta del usuario
        callback_function: (token) => {
            fullResponse += token;
            aiSpan.innerText = fullResponse;
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    });

    // 3. Ejecutar generación pasándole el streamer
    const output = await generator(messages, {
        max_new_tokens: 128,
        streamer: streamer // Aquí es donde conectamos el streaming
    });

    // Guardar en el historial la respuesta final
    messages.push({ role: "assistant", content: fullResponse });
};