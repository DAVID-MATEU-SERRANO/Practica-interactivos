const btn = document.getElementById('btn');
const bar = document.getElementById('bar');
const valText = document.getElementById('val');

async function startAudioWorklet() {
    // 1. Crear contexto de audio
    const audioContext = new AudioContext();

    // 2. Cargar el archivo del procesador (debe estar en la misma carpeta o URL)
    await audioContext.audioWorklet.addModule('volume-processor.js');

    // 3. Obtener micro
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(stream);

    // 4. Crear el nodo del Worklet
    const volumeNode = new AudioWorkletNode(audioContext, 'volume-processor');

    // 5. Escuchar los mensajes que vienen del hilo de audio
    volumeNode.port.onmessage = (event) => {
        //console.log(event.data);
        const rms = event.data.rms;

        // Actualizar UI (Seguro, ya que los cálculos pesados se hicieron fuera)
        const volume = Math.min(100, rms * 500);
        bar.style.width = volume + '%';
        valText.innerText = rms.toFixed(4);
    };

    // 6. Conectar
    source.connect(volumeNode);
    volumeNode.connect(audioContext.destination);

    btn.innerText = "Escuchando con Worklet...";
    btn.disabled = true;
}

btn.addEventListener('click', startAudioWorklet);