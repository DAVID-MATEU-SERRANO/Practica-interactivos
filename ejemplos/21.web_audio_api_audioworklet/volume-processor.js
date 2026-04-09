class VolumeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        // inputs[0] es el primer dispositivo de entrada (micro)
        // inputs[0][0] es el primer canal (mono)
        const input = inputs[0];

        if (input.length > 0) {
            const inputData = input[0]; // Aquí está el Float32Array de 128 muestras

            // Cálculo de amplitud (RMS)
            let sumSquares = 0;
            for (let i = 0; i < inputData.length; i++) {
                sumSquares += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sumSquares / inputData.length);

            // Enviamos el dato al hilo principal mediante el puerto
            this.port.postMessage({
                rms: rms,
                timestamp: currentTime // Tiempo actual en el contexto de audio
            });
        }

        // Retornar true es vital para que el procesador siga vivo
        return true;
    }
}

registerProcessor('volume-processor', VolumeProcessor);