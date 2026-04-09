// audio-processor.js
class AudioProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            // Enviamos el canal 0 al hilo principal
            this.port.postMessage(input[0]);
        }
        return true;
    }
}
registerProcessor('audio-processor', AudioProcessor);