const btn = document.getElementById('btn');
const bar = document.getElementById('bar');
const valText = document.getElementById('val');

async function startAudio() {
    // 1. Inicializar el contexto de audio
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // 2. Solicitar acceso al micrófono
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);

    // 3. Crear el ScriptProcessorNode (Tamaño de buffer, Canales entrada, Canales salida)
    // El tamaño del buffer (4096) determina cada cuántas muestras se dispara el evento.
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    // 4. Definir el evento onaudioprocess (Aquí está el inputData)
    processor.onaudioprocess = (audioProcessingEvent) => {
        // Obtenemos el Float32Array del canal 0 (mono)
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

        // --- PROCESAMIENTO DE LA SEÑAL ---
        // Calculamos el valor RMS (Root Mean Square) para medir el volumen
        let sumSquares = 0;
        for (let i = 0; i < inputData.length; i++) {
            sumSquares += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sumSquares / inputData.length);

        // Actualizar la interfaz (Esto ocurre en el Main Thread)
        const volume = Math.min(100, rms * 500); // Escalado para visualización
        bar.style.width = volume + '%';
        valText.innerText = rms.toFixed(4);
    };

    // 5. Conectar los nodos (Obligatorio conectar a destination para que el evento se dispare)
    source.connect(processor);
    processor.connect(audioContext.destination);

    btn.innerText = "Escuchando...";
    btn.disabled = true;
}

btn.addEventListener('click', () => {
    startAudio().catch(err => console.error("Error de micro:", err));
});