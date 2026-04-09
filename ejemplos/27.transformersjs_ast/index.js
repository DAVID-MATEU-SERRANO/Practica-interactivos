// app.js - Módulo JavaScript Principal

// 1. Importar Transformers.js desde CDN
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.0-next.7';
console.log(env.version)
let classifier;
const status = document.getElementById('status');
const resultDiv = document.getElementById('result');

async function init() {
    status.innerText = "Cargando modelo AST (~300MB)...";
    // Cargamos el pipeline una sola vez al inicio
    const MODEL_NAME = "Xenova/ast-finetuned-audioset-10-10-0.4593";
    classifier = await pipeline('audio-classification', MODEL_NAME, {
        device: "webgpu"
    });
    status.innerText = "Modelo listo. Pulsa el botón.";
}

async function start() {
    const ctx = new AudioContext({ sampleRate: 16000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = ctx.createMediaStreamSource(stream);

    await ctx.audioWorklet.addModule('audio-processor.js');
    const worklet = new AudioWorkletNode(ctx, 'audio-processor');

    worklet.port.onmessage = async (e) => {
        // e.data es el Float32Array enviado desde el worklet
        const output = await classifier(e.data);
        console.log(output);

        // Renderizamos los 3 primeros resultados
        resultDiv.innerHTML = output.slice(0, 3).map(r =>
            `<div>${(r.score * 100).toFixed(1)}% - <b>${r.label}</b></div>`
        ).join('');
    };

    source.connect(worklet);
    status.innerText = "Escuchando en tiempo real...";
}

document.getElementById('start').onclick = start;
init();